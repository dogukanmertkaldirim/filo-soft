import { supabase } from '../lib/supabase';

export interface FuelEfficiencyResult {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  totalFuelCost: number;
  startKm: number;
  latestKm: number;
  kmTraveled: number;
  costPerKm: number | null;
  entryCount: number;
  telematicsProvider: string | null;
}

export interface MonthlyFuelData {
  month: string;
  totalCost: number;
  avgCostPerKm: number | null;
}

export async function computeVehicleFuelEfficiency(
  vehicleId: string,
  rentalStartKm: number,
  companyId: string
): Promise<{ totalCost: number; latestKm: number; costPerKm: number | null; entryCount: number }> {
  const { data: expenses } = await supabase
    .from('transactions')
    .select('amount, description')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicleId)
    .eq('type', 'expense')
    .ilike('category', '%yakit%');

  const totalCost = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const entryCount = (expenses || []).length;

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('current_km, last_gps_km')
    .eq('id', vehicleId)
    .maybeSingle();

  const gpsKm = vehicle?.last_gps_km ? Number(vehicle.last_gps_km) : 0;
  const currentKm = vehicle?.current_km ? Number(vehicle.current_km) : 0;
  const latestKm = Math.max(gpsKm, currentKm);

  const kmTraveled = latestKm - rentalStartKm;

  let costPerKm: number | null = null;
  if (kmTraveled > 0 && entryCount >= 2) {
    costPerKm = totalCost / kmTraveled;
  }

  return { totalCost, latestKm, costPerKm, entryCount };
}

export async function getFleetFuelEfficiency(
  vehicleIds: string[],
  companyId: string
): Promise<FuelEfficiencyResult[]> {
  if (vehicleIds.length === 0) return [];

  const { data: rentals } = await supabase
    .from('rentals')
    .select('vehicle_id, starting_km')
    .in('vehicle_id', vehicleIds)
    .eq('company_id', companyId)
    .order('start_date', { ascending: false });

  const startKmMap = new Map<string, number>();
  (rentals || []).forEach(r => {
    if (!startKmMap.has(r.vehicle_id)) {
      startKmMap.set(r.vehicle_id, Number(r.starting_km || 0));
    }
  });

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, current_km, last_gps_km, telematics_provider')
    .in('id', vehicleIds);

  const { data: expenses } = await supabase
    .from('transactions')
    .select('vehicle_id, amount')
    .eq('company_id', companyId)
    .in('vehicle_id', vehicleIds)
    .eq('type', 'expense')
    .ilike('category', '%yakit%');

  const expenseMap = new Map<string, { total: number; count: number }>();
  (expenses || []).forEach(e => {
    const existing = expenseMap.get(e.vehicle_id) || { total: 0, count: 0 };
    existing.total += Number(e.amount || 0);
    existing.count += 1;
    expenseMap.set(e.vehicle_id, existing);
  });

  const results: FuelEfficiencyResult[] = (vehicles || []).map(v => {
    const startKm = startKmMap.get(v.id) || 0;
    const gpsKm = v.last_gps_km ? Number(v.last_gps_km) : 0;
    const currentKm = v.current_km ? Number(v.current_km) : 0;
    const latestKm = Math.max(gpsKm, currentKm);
    const kmTraveled = latestKm - startKm;

    const fuelData = expenseMap.get(v.id) || { total: 0, count: 0 };

    let costPerKm: number | null = null;
    if (kmTraveled > 0 && fuelData.count >= 2) {
      costPerKm = fuelData.total / kmTraveled;
    }

    return {
      vehicleId: v.id,
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      totalFuelCost: fuelData.total,
      startKm,
      latestKm,
      kmTraveled,
      costPerKm,
      entryCount: fuelData.count,
      telematicsProvider: v.telematics_provider || null,
    };
  });

  results.sort((a, b) => {
    if (a.costPerKm === null && b.costPerKm === null) return 0;
    if (a.costPerKm === null) return 1;
    if (b.costPerKm === null) return -1;
    return a.costPerKm - b.costPerKm;
  });

  return results;
}

export async function getMonthlyFuelTrend(
  vehicleIds: string[],
  companyId: string
): Promise<MonthlyFuelData[]> {
  if (vehicleIds.length === 0) return [];

  const { data: expenses } = await supabase
    .from('transactions')
    .select('amount, transaction_date')
    .eq('company_id', companyId)
    .in('vehicle_id', vehicleIds)
    .eq('type', 'expense')
    .ilike('category', '%yakit%')
    .order('transaction_date', { ascending: true });

  if (!expenses || expenses.length === 0) return [];

  const monthlyMap = new Map<string, number>();
  expenses.forEach(e => {
    if (!e.transaction_date) return;
    const month = e.transaction_date.substring(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + Number(e.amount || 0));
  });

  const sorted = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);

  return sorted.map(([month, totalCost]) => ({
    month,
    totalCost,
    avgCostPerKm: null,
  }));
}

export async function syncVehicleOdometer(vehicleId: string): Promise<{ success: boolean; km?: number; error?: string }> {
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('telematics_provider, telematics_device_id, last_gps_km')
    .eq('id', vehicleId)
    .maybeSingle();

  if (!vehicle) return { success: false, error: 'Arac bulunamadi' };
  if (!vehicle.telematics_device_id) return { success: false, error: 'Telematik cihaz tanimli degil' };

  // Placeholder: In production, this would call the telematics provider API
  // e.g., Arvento API: GET /api/v1/vehicles/{deviceId}/odometer
  // For now, return existing GPS KM or simulate
  const currentGpsKm = vehicle.last_gps_km ? Number(vehicle.last_gps_km) : null;

  if (currentGpsKm) {
    return { success: true, km: currentGpsKm };
  }

  return { success: false, error: 'Telematik verisi henuz alinamadi' };
}
