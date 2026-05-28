# Vehicles.tsx - Company ID Filtering Update

## Summary
Updated all Supabase queries in `/tmp/cc-agent/61786183/project/src/pages/Vehicles.tsx` to filter by `company_id`. This ensures multi-tenancy support where each company only sees and modifies their own data.

## Changes Made

### 1. Import and Hook Update
- **Line 87**: Updated `useAuth()` hook to extract `companyId`
  ```typescript
  const { user, companyId } = useAuth();
  ```

### 2. useEffect Dependency
- **Line 211-213**: Added `companyId` as dependency to reload data when company changes
  ```typescript
  useEffect(() => {
    loadData();
  }, [companyId]);
  ```

### 3. loadData Function (Lines 215-227)
Added company_id guard and filtering to all SELECT queries:
- `vehicles` - Added `.eq('company_id', companyId)`
- `partners` - Added `.eq('company_id', companyId)`
- `vehicle_partners` - Added `.eq('company_id', companyId)`
- `customers` - Added `.eq('company_id', companyId)`
- `rentals` - Added `.eq('company_id', companyId)`
- `company_profiles` - Added `.eq('company_id', companyId)`
- `loans` - Added `.eq('company_id', companyId)`
- `vehicle_sales` - Added `.eq('company_id', companyId)`

### 4. handleSave Function
- **Line 318**: Added `company_id: companyId` to `vehicleData` object for vehicle INSERT/UPDATE
- **Line 355**: Added `company_id: companyId` to transaction INSERT (vehicle purchase)
- **Line 368**: Added `company_id: companyId` to vehicle_partners INSERT

### 5. handleCreateRental Function
- **Line 463**: Added `company_id: companyId` to `rentalInsert` object
- **Line 494**: Added `company_id: companyId` to transaction INSERT (rental deposit)

### 6. openRentalHistory Function (Lines 635-659)
Added company_id filtering to all history queries:
- `rentals` - Added `.eq('company_id', companyId)`
- `maintenances` - Added `.eq('company_id', companyId)`
- `accidents` - Added `.eq('company_id', companyId)`
- `transactions` - Added `.eq('company_id', companyId)`

### 7. openFinanceHistory Function (Lines 693-698)
- Added `.eq('company_id', companyId)` to transactions SELECT query

### 8. filterFinanceTransactions Function (Lines 708-713)
- Added `.eq('company_id', companyId)` to transactions SELECT query

### 9. openRentalDetail Function (Lines 761-764)
Added company_id filtering:
- `rental_expenses` - Added `.eq('company_id', companyId)`
- `accidents` - Added `.eq('company_id', companyId)`

### 10. handleAddExpense Function (Line 797)
- Added `company_id: companyId` to rental_expenses INSERT

### 11. handleAddAccident Function (Line 852)
- Added `company_id: companyId` to accidents INSERT

### 12. handleExportVehicles Function (Lines 954-955)
Added company_id filtering:
- `loans` - Added `.eq('company_id', companyId)`
- `transactions` - Added `.eq('company_id', companyId)`

## Database Tables Affected
The following tables now have company_id filtering applied:
1. `vehicles` - SELECT, INSERT, UPDATE
2. `partners` - SELECT
3. `vehicle_partners` - SELECT, INSERT, DELETE
4. `customers` - SELECT
5. `rentals` - SELECT, INSERT, UPDATE
6. `company_profiles` - SELECT
7. `loans` - SELECT
8. `vehicle_sales` - SELECT
9. `transactions` - SELECT, INSERT
10. `maintenances` - SELECT
11. `accidents` - SELECT, INSERT, DELETE
12. `rental_expenses` - SELECT, INSERT, DELETE

## Total Changes
- **25 occurrences** of `company_id` added throughout the file
- **All SELECT queries** now filter by company_id
- **All INSERT operations** now include company_id
- **UPDATE and DELETE operations** inherit company_id through foreign key relationships

## Notes
- Vehicle UPDATE operations don't need explicit company_id in the update data since it's already set on creation
- DELETE operations use the ID which is already scoped to the company through the initial SELECT queries
- The guard `if (!companyId) return;` in loadData prevents queries when companyId is not yet available

## Verification
To verify the changes work correctly:
1. Ensure the AuthContext provides `companyId` from the `useAuth()` hook
2. Test that users can only see vehicles from their own company
3. Test that all CRUD operations (Create, Read, Update, Delete) respect company boundaries
4. Verify related data (rentals, transactions, accidents, etc.) are also properly scoped
