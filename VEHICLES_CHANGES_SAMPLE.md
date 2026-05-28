# Sample Before/After Comparisons

## 1. Auth Hook
**Before:**
```typescript
const { user } = useAuth();
```

**After:**
```typescript
const { user, companyId } = useAuth();
```

## 2. Load Data Function
**Before:**
```typescript
async function loadData() {
  setLoading(true);
  const [vehiclesRes, partnersRes, vpRes, customersRes, rentalsRes, companyProfilesRes, loansRes, vehicleSalesRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase.from('partners').select('*').order('name'),
    supabase.from('vehicle_partners').select('*'),
    supabase.from('customers').select('*').order('company_title'),
    supabase.from('rentals').select('*').eq('status', 'active'),
    supabase.from('company_profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('loans').select('*').eq('loan_type', 'vehicle'),
    supabase.from('vehicle_sales').select('*'),
  ]);
```

**After:**
```typescript
async function loadData() {
  if (!companyId) return;
  setLoading(true);
  const [vehiclesRes, partnersRes, vpRes, customersRes, rentalsRes, companyProfilesRes, loansRes, vehicleSalesRes] = await Promise.all([
    supabase.from('vehicles').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('partners').select('*').eq('company_id', companyId).order('name'),
    supabase.from('vehicle_partners').select('*').eq('company_id', companyId),
    supabase.from('customers').select('*').eq('company_id', companyId).order('company_title'),
    supabase.from('rentals').select('*').eq('company_id', companyId).eq('status', 'active'),
    supabase.from('company_profiles').select('*').eq('company_id', companyId).order('created_at', { ascending: true }),
    supabase.from('loans').select('*').eq('company_id', companyId).eq('loan_type', 'vehicle'),
    supabase.from('vehicle_sales').select('*').eq('company_id', companyId),
  ]);
```

## 3. Vehicle Insert
**Before:**
```typescript
const vehicleData = {
  plate: formData.plate,
  brand: formData.brand,
  model: formData.model,
  // ... other fields ...
  spare_tire_location: formData.spare_tire_location || null,
};
```

**After:**
```typescript
const vehicleData = {
  plate: formData.plate,
  brand: formData.brand,
  model: formData.model,
  // ... other fields ...
  spare_tire_location: formData.spare_tire_location || null,
  company_id: companyId,
};
```

## 4. Rental Insert
**Before:**
```typescript
const rentalInsert = {
  vehicle_id: rentalVehicle.id,
  customer_id: rentalData.customer_id,
  // ... other fields ...
  status: 'active',
};
```

**After:**
```typescript
const rentalInsert = {
  vehicle_id: rentalVehicle.id,
  customer_id: rentalData.customer_id,
  // ... other fields ...
  status: 'active',
  company_id: companyId,
};
```

## 5. Transaction Insert
**Before:**
```typescript
await supabase.from('transactions').insert({
  type: 'expense',
  category: 'Vehicle Purchase',
  description: `Purchase of ${formData.plate}`,
  amount: formData.purchase_price,
  transaction_date: formData.purchase_date || new Date().toISOString().split('T')[0],
  vehicle_id: vehicleId,
});
```

**After:**
```typescript
await supabase.from('transactions').insert({
  type: 'expense',
  category: 'Vehicle Purchase',
  description: `Purchase of ${formData.plate}`,
  amount: formData.purchase_price,
  transaction_date: formData.purchase_date || new Date().toISOString().split('T')[0],
  vehicle_id: vehicleId,
  company_id: companyId,
});
```

## 6. History Queries
**Before:**
```typescript
const [rentalsRes, maintenancesRes, accidentsRes, transactionsRes] = await Promise.all([
  supabase
    .from('rentals')
    .select('*, customers(company_title)')
    .eq('vehicle_id', vehicle.id)
    .order('start_date', { ascending: false }),
  supabase
    .from('maintenances')
    .select('*, supplier:suppliers(*)')
    .eq('vehicle_id', vehicle.id)
    .order('entry_date', { ascending: false }),
  supabase
    .from('accidents')
    .select('*')
    .eq('vehicle_id', vehicle.id)
    .order('accident_date', { ascending: false }),
  supabase
    .from('transactions')
    .select('*')
    .eq('vehicle_id', vehicle.id),
]);
```

**After:**
```typescript
const [rentalsRes, maintenancesRes, accidentsRes, transactionsRes] = await Promise.all([
  supabase
    .from('rentals')
    .select('*, customers(company_title)')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicle.id)
    .order('start_date', { ascending: false }),
  supabase
    .from('maintenances')
    .select('*, supplier:suppliers(*)')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicle.id)
    .order('entry_date', { ascending: false }),
  supabase
    .from('accidents')
    .select('*')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicle.id)
    .order('accident_date', { ascending: false }),
  supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicle.id),
]);
```
