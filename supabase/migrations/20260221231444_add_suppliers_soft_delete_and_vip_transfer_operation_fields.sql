/*
  # Add soft delete to suppliers and operation fields to vip_transfers

  1. Modified Tables
    - `suppliers`
      - Added `deleted_at` (timestamptz, nullable) for soft delete support
    - `vip_transfers`
      - Added `operation_type` (text, default 'in_house') - 'in_house' or 'outsourced'
      - Added `supplier_id` (uuid, nullable, references suppliers) - selected supplier when outsourced
      - Added `transfer_cost` (numeric, default 0) - cost when outsourcing to a supplier

  2. Important Notes
    - operation_type 'in_house' means the company uses its own vehicle/driver
    - operation_type 'outsourced' means the transfer is handled by an external supplier
    - Profit = price - transfer_cost (for outsourced transfers)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vip_transfers' AND column_name = 'operation_type'
  ) THEN
    ALTER TABLE vip_transfers ADD COLUMN operation_type text NOT NULL DEFAULT 'in_house';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vip_transfers' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE vip_transfers ADD COLUMN supplier_id uuid REFERENCES suppliers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vip_transfers' AND column_name = 'transfer_cost'
  ) THEN
    ALTER TABLE vip_transfers ADD COLUMN transfer_cost numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vip_transfers_operation_type ON vip_transfers(operation_type);
CREATE INDEX IF NOT EXISTS idx_vip_transfers_supplier_id ON vip_transfers(supplier_id);
