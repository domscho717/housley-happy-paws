# Cancellation System API Reference

## Endpoints

### 1. POST /api/cancel-booking

Cancels a booking or a single occurrence of a recurring booking.

**Request Body:**
```json
{
  "bookingRequestId": "uuid-string",
  "canceledBy": "client|owner|staff",
  "cancelSingle": true,
  "cancelDate": "2026-03-25"
}
```

**Parameters:**
- `bookingRequestId` (required): The ID of the booking to cancel
- `canceledBy` (required): Who is canceling - 'client', 'owner', or 'staff'
- `cancelSingle` (optional): For recurring bookings, set to `true` to cancel only one occurrence
- `cancelDate` (optional): Required if `cancelSingle` is true. Format: YYYY-MM-DD

**Response (Success):**
```json
{
  "success": true,
  "cancellationType": "free|late",
  "refunded": true|false,
  "message": "Booking canceled. No charge applied.",
  "details": {
    "isSingleCancel": true|false,
    "cancelDate": "2026-03-25|null",
    "stripeAction": {
      "action": "canceled_intent|captured_intent|...",
      "paymentIntentId": "pi_xxx"
    }
  }
}
```

**Response (Error):**
```json
{
  "error": "Booking not found|Booking is already canceled|..."
}
```

**Cancellation Policy:**
- **Free Cancel**: Booked before midnight EST, 2 days before service date
  - Uncaptured Stripe payment intents are canceled
  - Open Stripe invoices are voided
  - No charge to customer

- **Late Cancel**: After the 2-day cutoff
  - Uncaptured Stripe payment intents are captured (charge applies)
  - Booking is marked as canceled with late fee applied

---

### 2. GET/POST /api/capture-payments

Cron endpoint that captures authorized payments for bookings scheduled today. Runs automatically daily but can also be triggered manually.

**Authentication:**
- `Authorization` header: `Bearer <CRON_SECRET>` (for production)
- `x-cron-secret` header: `<CRON_SECRET>` (for manual trigger)

**Request:**
```
GET /api/capture-payments
POST /api/capture-payments
```

**Response:**
```json
{
  "message": "Payment capture processed for 2026-03-25",
  "processed": 5,
  "captured": 4,
  "skipped": 1,
  "failed": 0,
  "recurringProcessed": 3,
  "errors": []
}
```

**What it does:**
1. Finds all booking_requests where:
   - status = 'accepted'
   - scheduled_date = today
   - payment_intent_id is not null
2. Captures each payment intent with Stripe
3. Processes recurring invoices scheduled for today
4. Logs all results and errors

---

## Database Fields

### booking_requests Table Additions

| Column | Type | Description |
|--------|------|-------------|
| `payment_intent_id` | TEXT | Stripe PaymentIntent ID for manual capture/cancellation |
| `canceled_at` | TIMESTAMPTZ | When the booking was canceled |
| `canceled_by` | TEXT | Who canceled: 'client', 'owner', or 'staff' |
| `cancellation_type` | TEXT | 'free' or 'late' |
| `canceled_dates` | JSONB | Array of dates canceled (for recurring bookings) |

**Updated Constraints:**
- `status` CHECK constraint now includes 'canceled'

---

## Payment Flow

### One-Time Booking
1. Client requests booking
2. `charge-saved-card.js` creates PaymentIntent with `capture_method: 'manual'`
3. Payment is **authorized** (hold placed) - `payment_intent_id` stored on booking_request
4. Service date arrives
5. `capture-payments.js` cron **captures** the payment
6. If cancelled before service date:
   - **Free cancel** (before 2-day cutoff): intent is **canceled** (no charge)
   - **Late cancel** (after cutoff): intent is **captured** (charge applies)

### Recurring Booking
1. Client requests recurring booking
2. Each occurrence gets a PaymentIntent with manual capture
3. Day before service: `recurring-invoices.js` creates Stripe invoice
4. Service date arrives: `capture-payments.js` captures payment
5. If cancelled (single occurrence):
   - `canceled-booking.js` adds date to `canceled_dates` array
   - Corresponding recurring_invoice is voided (free) or captured (late)

---

## Migration Instructions

1. **Run the SQL migration** in Supabase:
   ```sql
   -- Copy contents of /api/add-cancellation-fields.sql
   -- Paste into Supabase > SQL Editor and execute
   ```

2. **Set up cron job** (in `vercel.json`):
   ```json
   {
     "crons": [
       {
         "path": "/api/capture-payments",
         "schedule": "0 0 * * *"
       }
     ]
   }
   ```

3. **Test the endpoints**:
   ```bash
   # Cancel a booking (free cancel)
   curl -X POST http://localhost:3000/api/cancel-booking \
     -H "Content-Type: application/json" \
     -d '{
       "bookingRequestId": "uuid-here",
       "canceledBy": "client"
     }'

   # Capture payments (manual trigger)
   curl -X POST http://localhost:3000/api/capture-payments \
     -H "x-cron-secret: your-secret-here"
   ```

---

## Error Handling

Common error codes:

| Error | Meaning |
|-------|---------|
| `bookingRequestId and canceledBy are required` | Missing required fields |
| `Booking not found` | Invalid booking ID |
| `Booking is already canceled` | Can't cancel twice |
| `STRIPE_SECRET_KEY not configured` | Missing environment variable |
| `Unauthorized` | Invalid cron secret |

---

## Notes

- EST timezone is used for the 2-day cancellation cutoff
- Payment status in `payments` table updates to 'authorized' when intent is created
- Status updates to 'paid' when intent is captured
- Recurring bookings can have individual dates canceled without affecting the whole series
- Late cancellation charges apply even if manual refund is issued later
