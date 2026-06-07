import { useState, useEffect } from 'react';
import { Fuel, TrendingUp, TrendingDown, Car, Wifi, WifiOff, BarChart3, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { getFleetFuelEfficiency, getMonthlyFuelTrend } from '../../utils/fuelAnalytics';
import type { FuelEfficiencyResult, MonthlyFuelData } from '../../utils/fuelAnalytics';
import { formatCurrency } from '../../utils/format';

interface Props {
  vehicleIds: string[];
  companyId: string;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Oca', '02': 'Sub', '03': 'Mar', '04': 'Nis',
  '05': 'May', '06': 'Haz', '07': 'Tem', '08': 'Agu',
  '09': 'Eyl', '10': 'Eki', '11': 'Kas', '12': 'Ara',
};

function formatMonth(month: string): string {
  const parts = month.split('-');
  if (parts.length !== 2) return month;
  return `${MONTH_NAMES[parts[1]] || parts[1]} ${parts[0].slice(2)}`;
}

export default function FuelAnalytics({ vehicleIds, companyId }: Props) {
  const [loading, setLoading] = useState(true);
  const [efficiencyData, setEfficiencyData] = useState<FuelEfficiencyResult[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyFuelData[]>([]);

  useEffect(() => {
    loadData();
  }, [vehicleIds, companyId]);

  async function loadData() {
    setLoading(true);
    const [efficiency, monthly] = await Promise.all([
      getFleetFuelEfficiency(vehicleIds, companyId),
      getMonthlyFuelTrend(vehicleIds, companyId),
    ]);
    setEfficiencyData(efficiency);
    setMonthlyData(monthly);
    setLoading(false);
  }

  const totalFuelCost = efficiencyData.reduce((sum, v) => sum + v.totalFuelCost, 0);
  const vehiclesWithData = efficiencyData.filter(v => v.costPerKm !== null);
  const avgFleetCostPerKm = vehiclesWithData.length > 0
    ? vehiclesWithData.reduce((sum, v) => sum + (v.costPerKm || 0), 0) / vehiclesWithData.length
    : null;
  const telematicsConnected = efficiencyData.filter(v => v.telematicsProvider && v.telematicsProvider !== 'None').length;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  const chartData = monthlyData.map(m => ({
    name: formatMonth(m.month),
    tutar: m.totalCost,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Fuel className="h-4 w-4 text-amber-700" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Toplam Yakit Gideri</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalFuelCost)}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-100 rounded-lg">
              <TrendingUp className="h-4 w-4 text-teal-700" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Filo Ort. Maliyet</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {avgFleetCostPerKm !== null
              ? `${avgFleetCostPerKm.toFixed(2)} TL/km`
              : 'Veri Yetersiz'
            }
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wifi className="h-4 w-4 text-blue-700" />
            </div>
            <p className="text-xs text-slate-500 font-medium">Telematik Bagli</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {telematicsConnected} / {efficiencyData.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">arac GPS entegreli</p>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-900">Aylik Yakit Harcamasi Trendi</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Yakit Gideri']}
                />
                <Bar dataKey="tutar" fill="#0d9488" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="tutar" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Vehicle Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Car className="h-4 w-4 text-slate-600" />
            Arac Verimlilik Siralamasi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">En ekonomikten en pahaliya siralanmistir</p>
        </div>

        {efficiencyData.length === 0 ? (
          <div className="p-8 text-center">
            <Fuel className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Yakit verisi bulunamadi</p>
            <p className="text-xs text-slate-400 mt-1">Yakit fisleri kaydedildikce analiz otomatik olusacaktir</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {efficiencyData.map((v, idx) => (
              <div key={v.vehicleId} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                {/* Rank */}
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  idx === 0 && v.costPerKm !== null ? 'bg-green-100 text-green-700' :
                  idx === efficiencyData.length - 1 && v.costPerKm !== null ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {idx + 1}
                </div>

                {/* Vehicle Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{v.plate}</p>
                  <p className="text-xs text-slate-500">{v.brand} {v.model}</p>
                </div>

                {/* KM Data */}
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-slate-500">{v.kmTraveled.toLocaleString('tr-TR')} km</p>
                  <p className="text-[10px] text-slate-400">{v.entryCount} yakit kaydi</p>
                </div>

                {/* Telematics Badge */}
                <div className="hidden sm:block">
                  {v.telematicsProvider && v.telematicsProvider !== 'None' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <Wifi className="h-2.5 w-2.5" />
                      {v.telematicsProvider}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                      <WifiOff className="h-2.5 w-2.5" />
                      Manuel
                    </span>
                  )}
                </div>

                {/* Efficiency Badge */}
                <div className="text-right flex-shrink-0">
                  {v.costPerKm !== null ? (
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      v.costPerKm <= 2 ? 'bg-green-100 text-green-700' :
                      v.costPerKm <= 4 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {v.costPerKm <= 3 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {v.costPerKm.toFixed(2)} TL/km
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">
                      <AlertCircle className="h-3 w-3" />
                      Veri Yetersiz
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">Hesaplama Formulu</p>
            <p className="text-xs text-blue-700 mt-1">
              Ortalama Maliyet (TL/km) = Toplam Yakit Gideri (TL) / (Guncel KM - Kiralama Baslangic KM)
            </p>
            <p className="text-xs text-blue-600 mt-1">
              En az 2 yakit kaydi olan araclar icin hesaplama yapilir. GPS/Telematik entegreli araclarda kilometre otomatik guncellenir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
