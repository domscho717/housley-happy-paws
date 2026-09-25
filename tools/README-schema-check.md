# schema-check

Catches Supabase calls that name columns or status values the database does
not have.

```bash
node tools/schema-check.js          # human output, exits 1 if anything is wrong
node tools/schema-check.js --json   # machine readable
```

## Why it exists

Two things make this class of bug invisible:

1. **The Supabase JS client resolves on a failed query.** It does not throw.
   `.catch()` never fires. You get `data: null` and carry on.
2. **PostgREST rejects the entire select if one column is wrong.** Not just
   that column - the whole query returns nothing.

Together: one typo makes a feature quietly return empty forever, and it looks
like "no data yet" rather than an error. Every one of these was found by a
person noticing something missing, months later:

| Wrong | Right | What broke |
|---|---|---|
| `messages.receiver_id` | `recipient_id` | Rachel's dashboard showed zero unread messages since it was built |
| `messages.content` | `body` | same query |
| `messages.read` | `read_at` | same query |
| `booking_requests.cancelled_at` | `canceled_at` | recent cancellations never appeared |
| `status = 'cancelled'` | `'canceled'` | same query, two reasons it could not work |
| `booking_requests.owner_id` | does not exist | house-sit messages sent from the client to themselves |
| `booking_requests.staff_id` | `assigned_to` | live timer query returned nothing |

## What it checks

- `.select('...')`, including aliases (`count:id`), casts, and embedded
  resources (`profiles(full_name)` is checked against `profiles`)
- `.eq()`, `.neq()`, `.gt()`, `.in()`, `.is()`, `.order()`, `.not()` and the
  rest of the filter methods
- `.insert({...})`, `.update({...})`, `.upsert({...})` object keys
- Values written to columns with a CHECK constraint, so `status: 'cancelled'`
  is caught when the constraint only allows `'canceled'`

It reads `tools/schema.json`. It does **not** connect to the database, so it
is safe to run anywhere and needs no keys.

## What it does not check

Column names built at runtime (`.select(cols)` where `cols` is a variable),
RPC calls, and raw SQL. It also skips root-level `.js` files that are shadowed
by a copy in `js/` or `api/` - those are stale and the site never loads them.

## Regenerating schema.json after a migration

Run both queries and paste the results into `tools/schema.json` under
`tables` and `allowedValues`.

```sql
-- tables
select json_object_agg(table_name, cols order by table_name)::text
from (
  select table_name, json_agg(column_name order by ordinal_position) as cols
  from information_schema.columns
  where table_schema = 'public'
  group by table_name
) t;
```

```sql
-- allowedValues (CHECK constraints)
select json_object_agg(k, vals)::text from (
  select c.relname || '.' || a.attname as k,
         json_agg(distinct m[1] order by m[1]) as vals
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname='public'
  join lateral unnest(con.conkey) ck(attnum) on true
  join pg_attribute a on a.attrelid = c.oid and a.attnum = ck.attnum
  cross join lateral regexp_matches(pg_get_constraintdef(con.oid), '''([^'']+)''', 'g') m
  where con.contype = 'c'
  group by 1
) t;
```

If `schema.json` goes stale the script reports columns that do exist as
missing. When something looks wrong, regenerate before assuming the code is
at fault.

## Accuracy

Validated against the codebase as it stood at R29, before tonight's fixes: it
found every one of the bugs in the table above. Two false positives showed up
in that first run and both are fixed - a scan window that ran past the end of
one query into the next, and DOM calls like `classList.contains('show')` being
read as filters. The window now stops at the next `.from(` or the end of the
statement, whichever comes first.
