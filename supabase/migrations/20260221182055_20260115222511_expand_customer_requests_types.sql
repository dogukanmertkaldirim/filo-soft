/*
  # Expand Customer Requests Types

  1. Changes
    - Alter `request_type` check constraint to include new types:
      - 'payment_receipt' - Customer uploading payment proof
      - 'maintenance_request' - Customer requesting maintenance/service
    - Add `is_read` boolean field to track if admin has seen the request
    - Add `resolved_at` timestamp to track resolution time

  2. Purpose
    - Enable customers to submit payment receipts for verification
    - Enable customers to request vehicle maintenance/service
    - Track which requests have been viewed by admin
*/

ALTER TABLE customer_requests 
DROP CONSTRAINT IF EXISTS customer_requests_request_type_check;

ALTER TABLE customer_requests 
ADD CONSTRAINT customer_requests_request_type_check 
CHECK (request_type IN ('extend_rental', 'km_report', 'accident_report', 'payment_receipt', 'maintenance_request'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_requests' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE customer_requests ADD COLUMN is_read boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_requests' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE customer_requests ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_requests_is_read ON customer_requests(is_read);
CREATE INDEX IF NOT EXISTS idx_customer_requests_status ON customer_requests(status);