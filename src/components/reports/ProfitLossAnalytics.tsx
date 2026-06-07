import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';

interface MonthlyPnL {
  month: string;
  monthLabel: string;
  totalIncome: number;
  fleetCosts: number;
  overheadCosts: number;
  totalExpenses: number;
  netProfit: number;
}

const MONTHS_TR = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export default function ProfitLossAnalytics() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [data, setData] = useState<MonthlyPnL[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (companyId) loadPnLData();
  }, [companyId, year]);

  async function loadPnLData() {
    setLoading(true);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const [incomeRes, expenseRes, overheadRes, maintenanceRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, transaction_date')
        .eq('company_id', companyId)
        .eq('type', 'income')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate),
      supabase
        .from('transactions')
        .select('amount, transaction_date')
        .eq('company_id', companyId)
        .eq('type', 'expense')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate),
      supabase
        .from('company_expenses')
        .select('amount, due_date, status')
        .eq('company_id', companyId)
        .gte('due_date', startDate)
        .lte('due_date', endDate),
      supabase
        .from('maintenances')
        .select('cost, maintenance_date')
        .eq('company_id', companyId)
        .gte('maintenance_date', startDate)
        .lte('maintenance_date', endDate),
    ]);

    const incomes = incomeRes.data || [];
    const expenses = expenseRes.data || [];
    const overhead = overheadRes.data || [];
    const maintenance = maintenanceRes.data || [];

    const monthlyMap: Record<string, MonthlyPnL> = {};

    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      monthlyMap[key] = {
        month: key,
        monthLabel: MONTHS_TR[m],
        totalIncome: 0,
        fleetCosts: 0,
        overheadCosts: 0,
        totalExpenses: 0,
        netProfit: 0,
      };
    }

    incomes.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key && monthlyMap[key]) monthlyMap[key].totalIncome += t.amount || 0;
    });

    expenses.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key && monthlyMap[key]) monthlyMap[key].fleetCosts += t.amount || 0;
    });

    maintenance.forEach((m: any) => {
      const key = m.maintenance_date?.slice(0, 7);
      if (key && monthlyMap[key]) monthlyMap[key].fleetCosts += m.cost || 0;
    });

    overhead.forEach((o: any) => {
      const key = o.due_date?.slice(0, 7);
      if (key && monthlyMap[key]) monthlyMap[key].overheadCosts += o.amount || 0;
    });

    Object.values(monthlyMap).forEach(m => {
      m.totalExpenses = m.fleetCosts + m.overheadCosts;
      m.netProfit = m.totalIncome - m.totalExpenses;
    });

    setData(Object.values(monthlyMap));
    setLoading(false);
  }

  const totals = data.reduce(
    (acc, m) => ({
      income: acc.income + m.totalIncome,
      fleet: acc.fleet + m.fleetCosts,
      overhead: acc.overhead + m.overheadCosts,
      expenses: acc.expenses + m.totalExpenses,
      profit: acc.profit + m.netProfit,
    }),
    { income: 0, fleet: 0, overhead: 0, expenses: 0, profit: 0 }
  );

  const profitMargin = totals.income > 0 ? (totals.profit / totals.income) * 100 : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {[2024, 2025, 2026, 2027].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <h2 className="text-lg font-bold text-slate-900">Kar-Zarar Analizi</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Toplam Gelir</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totals.income)}</p>
          <p className="text-[10px] text-slate-400 mt-1">TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Filo Maliyeti</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totals.fleet)}</p>
          <p className="text-[10px] text-slate-400 mt-1">TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Genel Gider</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totals.overhead)}</p>
          <p className="text-[10px] text-slate-400 mt-1">TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Toplam Gider</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totals.expenses)}</p>
          <p className="text-[10px] text-slate-400 mt-1">TL</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 ${
          totals.profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className="text-xs font-medium text-slate-500 mb-1">Net Kar/Zarar</p>
          <div className="flex items-center gap-2">
            {totals.profit >= 0 ? (
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <p className={`text-xl font-bold ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatCurrency(Math.abs(totals.profit))}
            </p>
          </div>
          <p className={`text-[10px] mt-1 ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            Marj: %{profitMargin.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Aylik Gelir - Gider - Kar Karsilastirmasi</h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                formatter={(value: number, name: string) => [
                  `${formatCurrency(value)} TL`,
                  name === 'totalIncome' ? 'Gelir' :
                  name === 'totalExpenses' ? 'Toplam Gider' :
                  name === 'netProfit' ? 'Net Kar' : name
                ]}
                labelFormatter={(label) => `${label} ${year}`}
              />
              <Legend
                formatter={(value) =>
                  value === 'totalIncome' ? 'Gelir' :
                  value === 'totalExpenses' ? 'Toplam Gider' :
                  value === 'netProfit' ? 'Net Kar/Zarar' : value
                }
              />
              <Bar dataKey="totalIncome" name="totalIncome" radius={[4, 4, 0, 0]} barSize={24}>
                {data.map((_, index) => (
                  <Cell key={`income-${index}`} fill="#10b981" />
                ))}
              </Bar>
              <Bar dataKey="totalExpenses" name="totalExpenses" radius={[4, 4, 0, 0]} barSize={24}>
                {data.map((_, index) => (
                  <Cell key={`expense-${index}`} fill="#ef4444" />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="netProfit"
                name="netProfit"
                stroke="#1d4ed8"
                strokeWidth={2.5}
                dot={{ fill: '#1d4ed8', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Aylik Detay Tablosu</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Ay</th>
                <th className="text-right px-4 py-2.5 font-medium text-green-700">Gelir</th>
                <th className="text-right px-4 py-2.5 font-medium text-red-600">Filo</th>
                <th className="text-right px-4 py-2.5 font-medium text-orange-600">Genel</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Toplam Gider</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-900">Net Kar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map(m => (
                <tr key={m.month} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{m.monthLabel} {year}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{formatCurrency(m.totalIncome)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{formatCurrency(m.fleetCosts)}</td>
                  <td className="px-4 py-2.5 text-right text-orange-600">{formatCurrency(m.overheadCosts)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(m.totalExpenses)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${m.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {m.netProfit >= 0 ? '+' : ''}{formatCurrency(m.netProfit)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td className="px-4 py-2.5 text-slate-900">TOPLAM</td>
                <td className="px-4 py-2.5 text-right text-green-700">{formatCurrency(totals.income)}</td>
                <td className="px-4 py-2.5 text-right text-red-600">{formatCurrency(totals.fleet)}</td>
                <td className="px-4 py-2.5 text-right text-orange-600">{formatCurrency(totals.overhead)}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{formatCurrency(totals.expenses)}</td>
                <td className={`px-4 py-2.5 text-right ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {totals.profit >= 0 ? '+' : ''}{formatCurrency(totals.profit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
