-- =====================================================
-- Housley Happy Paws — Supabase Database Setup
-- Run this in Supabase > SQL Editor
-- =====================================================

-- 1. Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'staff', 'owner')),
  full_name TEXT,
  phone TEXT,
  pet_names TEXT,
  address TEXT,
  notes TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owner can read all profiles
CREATE POLICY "Owner can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'owner'
    )
  );

-- Owner can update all profiles (change roles, etc.)
CREATE POLICY "Owner can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'owner'
    )
  );

-- 4. Payments table (synced from Stripe webhooks)
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  client_email TEXT NOT NULL,
  client_name TEXT,
  amount DECIMAL(10,2) NOT NULL,
  service TEXT,
  pet_names TEXT,
  status TEXT DEFAULT 'paid',
  notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Clients can see their own payments
CREATE POLICY "Clients can read own payments"
  ON payments FOR SELECT
  USING (client_email = auth.jwt()->>'email');

-- Owner can see all payments
CREATE POLICY "Owner can read all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'owner'
    )
  );

-- 5. Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id),
  service TEXT NOT NULL,
  date DATE NOT NULL,
  time_slot TEXT,
  duration TEXT,
  pet_names TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own bookings"
  ON bookings FOR SELECT
  USING (client_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owner and staff can read all bookings"
  ON bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role IN ('owner', 'staff')
    )
  );

-- 6. Auto-create profile on signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, role, full_name)
  VALUES (
    NEW.id,
    'client',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- IMPORTANT: After running this SQL, manually set
-- Rachel's role to 'owner' and Alex's to 'staff':
--
-- UPDATE profiles SET role = 'owner'
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'housleyhappypaws@gmail.com');
--
-- UPDATE profiles SET role = 'staff'
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'alex_email@example.com');
-- =====================================================
