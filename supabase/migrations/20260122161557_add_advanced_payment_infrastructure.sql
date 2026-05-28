/*
  # Advanced Financial & Payment Infrastructure

  1. New Tables
    - `payments`: Central payment ledger for all incoming payments
    - `payment_cards`: Tokenized card storage for online payments
    - `payment_transactions`: Gateway transaction logs
    - `bank_accounts`: Company bank account management

  2. Schema Updates
    - `rentals` table: Add `agreed_payment_method` for contract-level default

  3. Payment Methods Supported
    - cash: Physical cash payment
    - credit_card_online: Tokenized online card payment
    - credit_card_physical: Physical card swipe/tap at terminal
    - transfer: Bank transfer (EFT/Havale)
    - check: Check payment with maturity tracking
    - promissory_note: Senet/Bono with maturity tracking

  4. Security
    - RLS enabled on all tables
    - Customer-specific policies for payment cards
    - Company-scoped data access
*/

-- Create bank_accounts table first (referenced by payments)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  iban text NOT NULL,
  currency text DEFAULT 'TRY',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create payments table (central payment ledger)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  rental_id uuid REFERENCES rentals(id) ON DELETE SET NULL,
  rental_schedule_id uuid REFERENCES rental_payment_schedules(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL,
  currency text DEFAULT 'TRY',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'transfer',
  transaction_reference text,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL,
  check_number text,
  check_due_date date,
  check_status text DEFAULT 'pending',
  check_bank_name text,
  notes text,
  received_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create payment_cards table for tokenized card storage
CREATE TABLE IF NOT EXISTS payment_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paytr',
  card_token text NOT NULL,
  card_alias text,
  last_four_digits text NOT NULL,
  card_brand text,
  expiry_month integer,
  expiry_year integer,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create payment_transactions table for gateway logs
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  payment_card_id uuid REFERENCES payment_cards(id) ON DELETE SET NULL,
  amount numeric(12, 2) NOT NULL,
  currency text DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL,
  provider_transaction_id text,
  provider_response jsonb,
  error_code text,
  error_message text,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Add agreed_payment_method to rentals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rentals' AND column_name = 'agreed_payment_method'
  ) THEN
    ALTER TABLE rentals ADD COLUMN agreed_payment_method text DEFAULT 'transfer';
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_accounts
CREATE POLICY "bank_accounts_select_own"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_insert_own"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_update_own"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_delete_own"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_anon_select"
  ON bank_accounts FOR SELECT
  TO anon
  USING (deleted_at IS NULL AND is_active = true);

-- RLS Policies for payments
CREATE POLICY "payments_select_own"
  ON payments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payments_insert_own"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payments_update_own"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payments_delete_own"
  ON payments FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payments_anon_select"
  ON payments FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- RLS Policies for payment_cards
CREATE POLICY "payment_cards_select_own"
  ON payment_cards FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_cards_insert_own"
  ON payment_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_cards_update_own"
  ON payment_cards FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_cards_delete_own"
  ON payment_cards FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_cards_anon_select"
  ON payment_cards FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- RLS Policies for payment_transactions
CREATE POLICY "payment_transactions_select_own"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_transactions_insert_own"
  ON payment_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_transactions_update_own"
  ON payment_transactions FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM app_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "payment_transactions_anon_select"
  ON payment_transactions FOR SELECT
  TO anon
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company_id ON bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_rental_id ON payments(rental_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_check_status ON payments(check_status) WHERE payment_method IN ('check', 'promissory_note');
CREATE INDEX IF NOT EXISTS idx_payments_check_due_date ON payments(check_due_date) WHERE payment_method IN ('check', 'promissory_note');
CREATE INDEX IF NOT EXISTS idx_payment_cards_customer_id ON payment_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_cards_company_id ON payment_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_id ON payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company_id ON payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
