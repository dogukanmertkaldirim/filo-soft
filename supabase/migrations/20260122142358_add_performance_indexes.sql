/*
  # Performance Optimization Indexes

  This migration adds database indexes to frequently queried columns
  to improve query performance with large datasets (500+ vehicles).

  ## 1. Vehicles Table Indexes
    - `plate` - For plate lookups and search
    - `status` - For filtering by status (idle, rented, maintenance, sold)
    - `gps_device_id` - For GPS/telemetry lookups
    - `company_id` - For tenant filtering

  ## 2. Rentals Table Indexes
    - `customer_id` - For customer rental history
    - `vehicle_id` - For vehicle rental history
    - `status` - For filtering active/completed rentals
    - `company_id` - For tenant filtering
    - Composite index on (company_id, status) for common queries

  ## 3. Customers Table Indexes
    - `email` - For email lookups and login
    - `company_id` - For tenant filtering
    - `company_title` - For name search

  ## 4. Telemetry Logs Table Indexes (Critical for GPS performance)
    - `vehicle_id` - For vehicle telemetry lookups
    - `timestamp` - For time-based queries
    - Composite index on (vehicle_id, timestamp) for range queries

  ## 5. Transactions Table Indexes
    - `transaction_date` - For date range queries
    - `type` - For income/expense filtering
    - `company_id` - For tenant filtering

  ## Notes
    - Using IF NOT EXISTS to prevent errors on re-run
    - Using CONCURRENTLY where supported for minimal locking
*/

CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_gps_device_id ON vehicles(gps_device_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON vehicles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_status ON vehicles(company_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rentals_customer_id ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_vehicle_id ON rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_company_id ON rentals(company_id);
CREATE INDEX IF NOT EXISTS idx_rentals_deleted_at ON rentals(deleted_at);
CREATE INDEX IF NOT EXISTS idx_rentals_company_status ON rentals(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rentals_start_date ON rentals(start_date);
CREATE INDEX IF NOT EXISTS idx_rentals_end_date ON rentals(end_date);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_title ON customers(company_title);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);

CREATE INDEX IF NOT EXISTS idx_telemetry_logs_vehicle_id ON telemetry_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_timestamp ON telemetry_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_logs_vehicle_timestamp ON telemetry_logs(vehicle_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_company_date ON transactions(company_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_maintenances_vehicle_id ON maintenances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_company_id ON maintenances(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_entry_date ON maintenances(entry_date);

CREATE INDEX IF NOT EXISTS idx_loans_company_id ON loans(company_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_deleted_at ON loans(deleted_at);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_payment_date ON loan_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_is_paid ON loan_payments(is_paid);

CREATE INDEX IF NOT EXISTS idx_partners_company_id ON partners(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_partner_id ON partner_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_company_id ON partner_transactions(company_id);

CREATE INDEX IF NOT EXISTS idx_reservations_company_id ON reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_reservations_vehicle_id ON reservations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_users_company_id ON app_users(company_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);