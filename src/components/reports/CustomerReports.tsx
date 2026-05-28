import { useState, useEffect } from 'react';
import { TrendingUp, Users, AlertTriangle, Award, Download } from 'lucide-react';
import {
  BarChart,
  Bar,
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
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';
import Button from '../ui/Button';
import { exportToExcel } from '../../utils/exportExcel';

interface CustomerAnalytics {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company_type: string;
  total_rentals: number;
  total_revenue: number;
  total_paid: number;
  balance: number;
  risk_level: 'high' | 'medium' | 'low';
}

interface CustomerReportsProps {
  companyId: string | null;
}

const RISK_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const RISK_LABELS = {
  high: 'Yüksek Risk',
  medium: 'Orta Risk',
  low: 'Düşük Risk',
};

const PIE_COLORS = ['#0d9488', '#f59e0b'];

export default function CustomerReports({ companyId }: CustomerReportsProps) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerAnalytics[]>([]);
  const [topCustomer, setTopCustomer] = useState<CustomerAnalytics | null>(null);
  const [topDebtor, setTopDebtor] = useState<CustomerAnalytics | null>(null);
  const [mostFrequent, setMostFrequent] = useState<CustomerAnalytics | null>(null);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);

    const { data, error } = await supabase.rpc('get_customer_analytics', {
      p_company_id: companyId,
    });

    if (error) {
      console.error('Error loading customer analytics:', error);
      setLoading(false);
      return;
    }

    const analyticsData = (data || []) as CustomerAnalytics[];
    setCustomers(analyticsData);

    if (analyticsData.length > 0) {
      const sortedByRevenue = [...analyticsData].sort((a, b) => b.total_revenue - a.total_revenue);
      setTopCustomer(sortedByRevenue[0]);

      const sortedByDebt = [...analyticsData].sort((a, b) => b.balance - a.balance);
      setTopDebtor(sortedByDebt[0]);

      const sortedByRentals = [...analyticsData].sort((a, b) => b.total_rentals - a.total_rentals);
      setMostFrequent(sortedByRentals[0]);
    }

    setLoading(false);
  }

  function getRiskBadgeClass(risk: string) {
    return RISK_COLORS[risk as keyof typeof RISK_COLORS] || 'bg-slate-100 text-slate-700';
  }

  function getRiskLabel(risk: string) {
    return RISK_LABELS[risk as keyof typeof RISK_LABELS] || risk;
  }

  function getTop5RevenueData() {
    return customers.slice(0, 5).map(c => ({
      name: c.customer_name.length > 20 ? c.customer_name.substring(0, 20) + '...' : c.customer_name,
      revenue: c.total_revenue,
    }));
  }

  function getCustomerTypeData() {
    const corporate = customers.filter(c => c.company_type === 'corporate').length;
    const individual = customers.filter(c => c.company_type === 'individual').length;

    return [
      { name: 'Kurumsal', value: corporate },
      { name: 'Bireysel', value: individual },
    ];
  }

  async function handleExportExcel() {
    const customerData = customers.map(c => ({
      'Müşteri Adı': c.customer_name,
      'E-posta': c.customer_email || '-',
      'Telefon': c.customer_phone || '-',
      'Tür': c.company_type === 'corporate' ? 'Kurumsal' : 'Bireysel',
      'Toplam Kiralama': c.total_rentals,
      'Toplam Gelir': c.total_revenue,
      'Toplam Ödenen': c.total_paid,
      'Bakiye/Borç': c.balance,
      'Risk Seviyesi': getRiskLabel(c.risk_level),
    }));

    const summaryData = [
      {
        'Metrik': 'En Çok Gelir Getiren Müşteri',
        'Değer': topCustomer?.customer_name || '-',
        'Tutar': topCustomer?.total_revenue || 0,
      },
      {
        'Metrik': 'En Çok Borçlu Müşteri',
        'Değer': topDebtor?.customer_name || '-',
        'Tutar': topDebtor?.balance || 0,
      },
      {
        'Metrik': 'En Sık Kiralayan Müşteri',
        'Değer': mostFrequent?.customer_name || '-',
        'Tutar': mostFrequent?.total_rentals || 0,
      },
    ];

    exportToExcel(
      [
        { sheetName: 'Özet', data: summaryData },
        { sheetName: 'Müşteri Detayları', data: customerData },
      ],
      'Musteri_Analizi'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Müşteri Performans Analizi</h2>
          <p className="text-sm text-slate-500 mt-1">Müşteri gelir ve risk analizi</p>
        </div>
        <Button onClick={handleExportExcel} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Excel'e Aktar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Award className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-teal-100 text-sm font-medium">En Çok Gelir Getiren</p>
            <p className="text-2xl font-bold">{topCustomer?.customer_name || '-'}</p>
            <p className="text-teal-100 text-lg">{formatCurrency(topCustomer?.total_revenue || 0)}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-red-100 text-sm font-medium">En Çok Borçlu</p>
            <p className="text-2xl font-bold">{topDebtor?.customer_name || '-'}</p>
            <p className="text-red-100 text-lg">{formatCurrency(topDebtor?.balance || 0)}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white/20 p-3 rounded-lg">
              <Users className="h-6 w-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-blue-100 text-sm font-medium">En Sık Kiralayan</p>
            <p className="text-2xl font-bold">{mostFrequent?.customer_name || '-'}</p>
            <p className="text-blue-100 text-lg">{mostFrequent?.total_rentals || 0} kiralama</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">En Çok Gelir Getiren 5 Müşteri</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getTop5RevenueData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#0d9488" name="Gelir" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Müşteri Tipi Dağılımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={getCustomerTypeData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {getCustomerTypeData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Müşteri Performans Tablosu</h3>
          <p className="text-sm text-slate-500 mt-1">Tüm müşterilerin detaylı analizi</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Müşteri
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  İletişim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tip
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Kiralama
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Toplam Gelir
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ödenen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Bakiye/Borç
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Risk
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Henüz müşteri verisi bulunmuyor
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.customer_id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{customer.customer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">
                        {customer.customer_email && <div>{customer.customer_email}</div>}
                        {customer.customer_phone && <div>{customer.customer_phone}</div>}
                        {!customer.customer_email && !customer.customer_phone && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">
                        {customer.company_type === 'corporate' ? 'Kurumsal' : 'Bireysel'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      {customer.total_rentals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-900">
                      {formatCurrency(customer.total_revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      {formatCurrency(customer.total_paid)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                      customer.balance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(customer.balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getRiskBadgeClass(customer.risk_level)}`}>
                        {getRiskLabel(customer.risk_level)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {customers.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Toplam {customers.length} müşteri</span>
              <div className="flex gap-4">
                <span>Toplam Gelir: <span className="font-semibold text-slate-900">
                  {formatCurrency(customers.reduce((sum, c) => sum + c.total_revenue, 0))}
                </span></span>
                <span>Toplam Borç: <span className="font-semibold text-red-600">
                  {formatCurrency(customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0))}
                </span></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
