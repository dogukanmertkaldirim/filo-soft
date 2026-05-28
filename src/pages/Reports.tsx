import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Percent, Printer, Car, Download, BarChart3, Users } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/format';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../utils/exportExcel';
import CustomerReports from '../components/reports/CustomerReports';

interface MonthlyData {
  month: string;
  monthKey: string;
  income: number;
  expense: number;
  profit: number;
}

interface VehicleRevenue {
  id: string;
  plate: string;
  brand: string;
  model: string;
  revenue: number;
}

interface KPIData {
  currentMonth: number;
  lastMonth: number;
  change: number;
}

const EXPENSE_COLORS = ['#0d9488', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  'Vehicle Purchase': 'Arac Alimi',
  'Fuel': 'Yakit',
  'Maintenance': 'Bakim',
  'Insurance': 'Sigorta',
  'Loan Payment': 'Kredi Odemesi',
  'Office Expense': 'Ofis Gideri',
  'Salary': 'Maas',
  'External Service Cost': 'Dis Hizmet',
  'Other Expense': 'Diger',
};

export default function Reports() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'financial' | 'customer'>('financial');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [revenueKPI, setRevenueKPI] = useState<KPIData>({ currentMonth: 0, lastMonth: 0, change: 0 });
  const [profitKPI, setProfitKPI] = useState<KPIData>({ currentMonth: 0, lastMonth: 0, change: 0 });
  const [occupancyKPI, setOccupancyKPI] = useState<KPIData>({ currentMonth: 0, lastMonth: 0, change: 0 });
  const [topVehicles, setTopVehicles] = useState<VehicleRevenue[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ name: string; value: number; label: string }[]>([]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, selectedYear, selectedMonth]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);

    const [transactionsRes, vehiclesRes, rentalsRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('company_id', companyId),
      supabase.from('vehicles').select('*').eq('company_id', companyId).is('deleted_at', null).neq('status', 'sold'),
      supabase.from('rentals').select('*').eq('company_id', companyId),
    ]);

    const transactions = transactionsRes.data || [];
    const vehicles = vehiclesRes.data || [];
    const rentals = rentalsRes.data || [];

    const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const lastMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const last12Months: MonthlyData[] = [];
    const monthNames = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const yearShort = d.getFullYear().toString().slice(-2);
      last12Months.push({
        month: `${monthNames[d.getMonth()]} ${yearShort}`,
        monthKey: key,
        income: 0,
        expense: 0,
        profit: 0,
      });
    }

    transactions.forEach(t => {
      const monthKey = t.transaction_date.substring(0, 7);
      const monthData = last12Months.find(m => m.monthKey === monthKey);
      if (monthData) {
        if (t.type === 'income') {
          monthData.income += t.amount;
        } else {
          monthData.expense += t.amount;
        }
      }
    });

    last12Months.forEach(m => {
      m.profit = m.income - m.expense;
    });

    setMonthlyData(last12Months);

    const currentMonthIncome = transactions
      .filter(t => t.type === 'income' && t.transaction_date.startsWith(currentMonthKey))
      .reduce((sum, t) => sum + t.amount, 0);
    const lastMonthIncome = transactions
      .filter(t => t.type === 'income' && t.transaction_date.startsWith(lastMonthKey))
      .reduce((sum, t) => sum + t.amount, 0);
    const revenueChange = lastMonthIncome > 0 ? ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    setRevenueKPI({ currentMonth: currentMonthIncome, lastMonth: lastMonthIncome, change: revenueChange });

    const currentMonthExpense = transactions
      .filter(t => t.type === 'expense' && t.transaction_date.startsWith(currentMonthKey))
      .reduce((sum, t) => sum + t.amount, 0);
    const lastMonthExpense = transactions
      .filter(t => t.type === 'expense' && t.transaction_date.startsWith(lastMonthKey))
      .reduce((sum, t) => sum + t.amount, 0);
    const currentProfit = currentMonthIncome - currentMonthExpense;
    const lastProfit = lastMonthIncome - lastMonthExpense;
    const profitChange = lastProfit !== 0 ? ((currentProfit - lastProfit) / Math.abs(lastProfit)) * 100 : 0;
    setProfitKPI({ currentMonth: currentProfit, lastMonth: lastProfit, change: profitChange });

    const totalVehicles = vehicles.length;
    const daysInCurrentMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const daysInLastMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate();
    const totalCapacityCurrent = totalVehicles * daysInCurrentMonth;
    const totalCapacityLast = totalVehicles * daysInLastMonth;

    let currentRentalDays = 0;
    let lastRentalDays = 0;

    rentals.forEach(rental => {
      if (!rental.start_date) return;
      const start = new Date(rental.start_date);
      const end = rental.end_date ? new Date(rental.end_date) : new Date();

      const currentMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
      const currentMonthEnd = new Date(selectedYear, selectedMonth, 0);
      const lastMonthStart = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
      const lastMonthEnd = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);

      const overlapStart = Math.max(start.getTime(), currentMonthStart.getTime());
      const overlapEnd = Math.min(end.getTime(), currentMonthEnd.getTime());
      if (overlapEnd >= overlapStart) {
        currentRentalDays += Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
      }

      const lastOverlapStart = Math.max(start.getTime(), lastMonthStart.getTime());
      const lastOverlapEnd = Math.min(end.getTime(), lastMonthEnd.getTime());
      if (lastOverlapEnd >= lastOverlapStart) {
        lastRentalDays += Math.ceil((lastOverlapEnd - lastOverlapStart) / (1000 * 60 * 60 * 24)) + 1;
      }
    });

    const currentOccupancy = totalCapacityCurrent > 0 ? (currentRentalDays / totalCapacityCurrent) * 100 : 0;
    const lastOccupancy = totalCapacityLast > 0 ? (lastRentalDays / totalCapacityLast) * 100 : 0;
    const occupancyChange = lastOccupancy > 0 ? currentOccupancy - lastOccupancy : 0;
    setOccupancyKPI({ currentMonth: currentOccupancy, lastMonth: lastOccupancy, change: occupancyChange });

    const vehicleRevenueMap = new Map<string, number>();
    transactions.forEach(t => {
      if (t.type === 'income' && t.vehicle_id && t.transaction_date.startsWith(currentMonthKey)) {
        vehicleRevenueMap.set(t.vehicle_id, (vehicleRevenueMap.get(t.vehicle_id) || 0) + t.amount);
      }
    });

    const vehicleRevenues: VehicleRevenue[] = [];
    vehicleRevenueMap.forEach((revenue, vehicleId) => {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (vehicle) {
        vehicleRevenues.push({
          id: vehicle.id,
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          revenue,
        });
      }
    });
    vehicleRevenues.sort((a, b) => b.revenue - a.revenue);
    setTopVehicles(vehicleRevenues.slice(0, 5));

    const expenseCatMap = new Map<string, number>();
    transactions.forEach(t => {
      if (t.type === 'expense' && t.transaction_date.startsWith(currentMonthKey)) {
        expenseCatMap.set(t.category, (expenseCatMap.get(t.category) || 0) + t.amount);
      }
    });

    const expenseData = Array.from(expenseCatMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        label: EXPENSE_CATEGORY_LABELS[name] || name,
      }))
      .sort((a, b) => b.value - a.value);
    setExpenseBreakdown(expenseData);

    setLoading(false);
  }

  function handlePrint() {
    window.print();
  }

  async function handleExportExcel() {
    const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    const [transactionsRes, vehiclesRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('company_id', companyId),
      supabase.from('vehicles').select('*').eq('company_id', companyId).is('deleted_at', null),
    ]);

    const transactions = (transactionsRes.data || []).filter(t =>
      t.transaction_date.startsWith(currentMonthKey)
    );
    const vehicles = vehiclesRes.data || [];

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const transactionData = transactions.map(t => {
      const vehicle = vehicles.find(v => v.id === t.vehicle_id);
      return {
        'Tarih': formatDate(t.transaction_date),
        'Tip': t.type === 'income' ? 'Gelir' : 'Gider',
        'Kategori': EXPENSE_CATEGORY_LABELS[t.category] || t.category,
        'Tutar': t.amount,
        'Aciklama': t.description || '',
        'Plaka': vehicle?.plate || '',
      };
    });

    const summaryData = [
      {
        'Metrik': 'Toplam Gelir',
        'Deger': revenueKPI.currentMonth,
      },
      {
        'Metrik': 'Toplam Gider',
        'Deger': revenueKPI.currentMonth - profitKPI.currentMonth,
      },
      {
        'Metrik': 'Net Kar',
        'Deger': profitKPI.currentMonth,
      },
      {
        'Metrik': 'Filo Doluluk (%)',
        'Deger': occupancyKPI.currentMonth,
      },
    ];

    const topVehiclesData = topVehicles.map((v, idx) => ({
      'Sira': idx + 1,
      'Plaka': v.plate,
      'Marka': v.brand,
      'Model': v.model,
      'Gelir': v.revenue,
    }));

    const expenseData = expenseBreakdown.map(e => ({
      'Kategori': e.label,
      'Tutar': e.value,
    }));

    const monthNames = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];
    const fileName = `Rapor_${monthNames[selectedMonth - 1]}_${selectedYear}`;

    exportToExcel(
      [
        { sheetName: 'Ozet', data: summaryData },
        { sheetName: 'Islemler', data: transactionData },
        { sheetName: 'En Iyi Araclar', data: topVehiclesData },
        { sheetName: 'Gider Dagilimi', data: expenseData },
      ],
      fileName
    );
  }

  function generateMonthOptions() {
    const options = [];
    const currentDate = new Date();
    const startYear = 2024;

    for (let year = currentDate.getFullYear(); year >= startYear; year--) {
      const maxMonth = year === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;
      for (let month = maxMonth; month >= 1; month--) {
        options.push({ year, month });
      }
    }
    return options;
  }

  function renderChangeIndicator(change: number, isPercentage = false) {
    const isPositive = change >= 0;
    const absChange = Math.abs(change);
    const displayValue = isPercentage ? `${absChange.toFixed(1)} puan` : `${absChange.toFixed(1)}%`;

    return (
      <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span>{isPositive ? '+' : '-'}{displayValue}</span>
        <span className="text-slate-400 text-xs ml-1">vs gecen ay</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area .bg-white {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>

      <div className="print-area">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Raporlar</h1>
              <p className="text-sm text-slate-500 mt-1">
                Detaylı finansal ve müşteri analizleri
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 no-print">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('financial')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'financial'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="h-5 w-5" />
                Mali Raporlar
              </button>
              <button
                onClick={() => setActiveTab('customer')}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === 'customer'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="h-5 w-5" />
                Müşteri Raporları
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'customer' ? (
          <CustomerReports companyId={companyId} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Aylık Yönetici Raporu</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })} Dönemi
                </p>
              </div>
              <div className="flex gap-2 no-print">
                <Button onClick={handleExportExcel} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Excel'e Aktar
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Yazdır / PDF
                </Button>
              </div>
            </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 no-print">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">Rapor Donemi:</label>
              <select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  setSelectedYear(parseInt(year));
                  setSelectedMonth(parseInt(month));
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {generateMonthOptions().map(({ year, month }) => {
                  const monthNames = ['Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran', 'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik'];
                  return (
                    <option key={`${year}-${month}`} value={`${year}-${month}`}>
                      {monthNames[month - 1]} {year}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Toplam Ciro</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-2">{formatCurrency(revenueKPI.currentMonth)} TL</p>
            {renderChangeIndicator(revenueKPI.change)}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${profitKPI.currentMonth >= 0 ? 'bg-teal-100' : 'bg-red-100'}`}>
                  {profitKPI.currentMonth >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <span className="text-sm font-medium text-slate-600">Net Kar</span>
              </div>
            </div>
            <p className={`text-3xl font-bold mb-2 ${profitKPI.currentMonth >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
              {formatCurrency(profitKPI.currentMonth)} TL
            </p>
            {renderChangeIndicator(profitKPI.change)}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Percent className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Filo Doluluk</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-2">{occupancyKPI.currentMonth.toFixed(1)}%</p>
            {renderChangeIndicator(occupancyKPI.change, true)}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Finansal Performans - Son 12 Ay</h2>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" angle={-45} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${formatCurrency(value)} TL`,
                  name === 'income' ? 'Gelir' : name === 'expense' ? 'Gider' : 'Net Kar',
                ]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend
                formatter={(value) =>
                  value === 'income' ? 'Gelir' : value === 'expense' ? 'Gider' : 'Net Kar'
                }
              />
              <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="profit"
                name="profit"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Car className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-slate-900">En Cok Kazandiran 5 Arac</h2>
            </div>
            {topVehicles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-medium text-slate-600">#</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">Plaka</th>
                      <th className="text-left py-3 px-2 font-medium text-slate-600">Marka/Model</th>
                      <th className="text-right py-3 px-2 font-medium text-slate-600">Gelir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVehicles.map((v, idx) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-700' :
                            idx === 1 ? 'bg-slate-200 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-medium">{v.plate}</td>
                        <td className="py-3 px-2 text-slate-600">{v.brand} {v.model}</td>
                        <td className="py-3 px-2 text-right font-semibold text-green-600">
                          {formatCurrency(v.revenue)} TL
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Car className="h-12 w-12 mb-3 opacity-50" />
                <p>Bu ay icin gelir verisi bulunamadi</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Gider Dagilimi</h2>
            {expenseBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="label"
                  >
                    {expenseBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${formatCurrency(value)} TL`}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-slate-600">{entry.payload.label}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <TrendingDown className="h-12 w-12 mb-3 opacity-50" />
                <p>Gider verisi bulunamadi</p>
              </div>
            )}
          </div>
        </div>

          </>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 no-print">
          Rapor Olusturulma Tarihi: {new Date().toLocaleString('tr-TR')}
        </div>
      </div>
    </>
  );
}
