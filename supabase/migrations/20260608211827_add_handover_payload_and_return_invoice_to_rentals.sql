
-- Add handover_payload JSONB to rentals for field-to-admin sync
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS handover_payload JSONB;
-- Stores: {km, fuel_level, cleanliness, damage_schema, photos, signature_url, submitted_by, submitted_at, operational_task_id}

-- Add return_extra_charges_invoice_id to link rental returns to generated invoices
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS return_invoice_id UUID;
