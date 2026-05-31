import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle as EmergencyIcon,
  Car,
  CarFront,
  TrendingUp,
  TrendingDown,
  Wrench,
  DollarSign,
  AlertTriangle,
  Calendar,
  Clock,
  ChevronRight,
  RefreshCw,
  Shield,
  FileText,
  CreditCard,
  CalendarClock,
  ParkingCircle,
  Inbox,
  CalendarPlus,
  Gauge,
  Receipt,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from '../components/ui/Modal';
import EmergencyAssistanceModal from '../components/EmergencyAssistanceModal';

const FLEET_COLORS = ['#10b981', '#f59e0b', '#6366f1'];
const CHART_COLORS = { income: '#10b981', expense: '#ef4444' };

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color: string;
  bgColor: string;
  onClick?: () => void;
  badge?: number;
}

function StatCard({ title, value, icon, trend, color, bgColor, onClick, badge }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-left
        hover:shadow-md hover:border-slate-300 transition-all duration-200
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        relative overflow-hidden group
      `}
    >
      <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
        <div className={`w-full h-full rounded-full ${bgColor} opacity-20 group-hover:opacity-30 transition-opacity`} />
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 ${bgColor} rounded-lg`}>
            <div className={color}>{icon}</div>
          </div>
          {badge !== undefined && badge > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-500 mb-1">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>

        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.value >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-slate-400">{trend.label}</span>
          </div>
        )}
      </div>
    </button>
  );
}

function getAlertIcon(type: string) {
  switch (type) {
    case 'inspection': return <FileText className="h-4 w-4" />;
    case 'insurance':
    case 'kasko': return <Shield className="h-4 w-4" />;
    case 'rental_end': return <CalendarClock className="h-4 w-4" />;
    case 'loan_payment': return <CreditCard className="h-4 w-4" />;
    case 'reservation': return <Calendar className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
}

function getAlertColor(severity: string) {
  switch (severity) {
    case 'critical': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' };
    case 'warning': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' };
    default: return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' };
  }
}

function formatActivityAction(action: string, entity: string): string {
  const actionMap: Record<string, string> = {
    CREATE: 'eklendi',
    UPDATE: 'guncellendi',
    DELETE: 'silindi',
  };
  return `${entity} ${actionMap[action] || action.toLowerCase()}`;
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Az once';
  if (diffMins < 60) return `${diffMins} dk once`;
  if (diffHours < 24) return `${diffHours} saat once`;
  if (diffDays < 7) return `${diffDays} gun once`;
  return formatDate(dateStr);
}

interface InvoiceReminder {
  id: string;
  customerName: string;
  description: string;
  invoiceType: string;
  issueDate: string;
  daysUntil: number;
  amount: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, loading, refresh } = useDashboardStats();
  const { isModuleActive, effectiveCompanyId: companyId } = useAuth();
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [invoiceReminders, setInvoiceReminders] = useState<InvoiceReminder[]>([]);

  useEffect(() => {
    if (companyId) loadInvoiceReminders();
  }, [companyId]);

  async function loadInvoiceReminders() {
    if (!companyId) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, customer_id, amount, issue_date, invoice_type, description, customers(company_title)')
      .eq('company_id', companyId)
      .eq('status', 'Kesilmesi Bekleyen')
      .lte('issue_date', threeDaysStr)
      .order('issue_date');

    if (!invoices || invoices.length === 0) {
      setInvoiceReminders([]);
      return;
    }

    const reminders: InvoiceReminder[] = invoices.map((inv: any) => {
      const issueDate = new Date(inv.issue_date);
      const diffDays = Math.ceil((issueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: inv.id,
        customerName: inv.customers?.company_title || '-',
        description: inv.description || inv.invoice_type || '',
        invoiceType: inv.invoice_type || '',
        issueDate: inv.issue_date,
        daysUntil: diffDays,
        amount: Number(inv.amount) || 0,
      };
    });

    setInvoiceReminders(reminders);
  }

  const revenueTrend = stats.lastMonthRevenue > 0
    ? Math.round(((stats.monthlyRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100)
    : 0;

  const filteredAlerts = stats.upcomingAlerts.filter(alert => {
    if (alert.type === 'loan_payment' && !isModuleActive('loans')) return false;
    if ((alert.type === 'inspection' || alert.type === 'insurance' || alert.type === 'kasko') && !isModuleActive('maintenance')) return false;
    return true;
  });

  const fleetChartData = [
    { name: 'Kirada', value: stats.fleetStatus.rented, color: FLEET_COLORS[0] },
    { name: 'Bosta', value: stats.fleetStatus.idle, color: FLEET_COLORS[1] },
    { name: 'Bakımda', value: stats.fleetStatus.maintenance, color: FLEET_COLORS[2] },
  ].filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
          <p className="text-sm font-medium text-slate-900">{payload[0].payload.month}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)} TL
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kontrol Merkezi</h1>
          <p className="text-sm text-slate-500 mt-1">Filo durumunuza genel bakis</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmergency(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg shadow-sm hover:shadow transition-all animate-pulse hover:animate-none"
          >
            <EmergencyIcon className="h-4 w-4" />
            Acil Yol Yardim
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Toplam Arac"
              value={stats.totalVehicles}
              icon={<Car className="h-5 w-5" />}
              color="text-slate-700"
              bgColor="bg-slate-100"
              onClick={() => navigate('/vehicles')}
            />
            <StatCard
              title="Aktif Kiralamalar"
              value={stats.activeRentals}
              icon={<CarFront className="h-5 w-5" />}
              color="text-green-600"
              bgColor="bg-green-100"
              onClick={() => navigate('/vehicles?status=rented')}
              trend={{ value: stats.occupancyRate, label: 'doluluk' }}
            />
            <StatCard
              title="Bosta Bekleyen"
              value={stats.fleetStatus.idle}
              icon={<ParkingCircle className="h-5 w-5" />}
              color="text-amber-600"
              bgColor="bg-amber-100"
              onClick={() => navigate('/vehicles?status=idle')}
            />
            {isModuleActive('finance') && (
              <StatCard
                title="Aylik Gelir"
                value={`${formatCurrency(stats.monthlyRevenue)} TL`}
                icon={<DollarSign className="h-5 w-5" />}
                color="text-teal-600"
                bgColor="bg-teal-100"
                trend={revenueTrend !== 0 ? { value: revenueTrend, label: 'gecen aya gore' } : undefined}
              />
            )}
            <StatCard
              title="Yaklasan Islemler"
              value={filteredAlerts.length}
              icon={<Wrench className="h-5 w-5" />}
              color="text-rose-600"
              bgColor="bg-rose-100"
              onClick={() => setShowAlertsModal(true)}
              badge={filteredAlerts.filter(a => a.severity === 'critical').length}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">Filo Durumu</h2>
                <span className="text-xs text-slate-500">{stats.totalVehicles} arac</span>
              </div>
              {fleetChartData.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fleetChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {fleetChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} arac`, name]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                  Veri bulunamadı
                </div>
              )}
              <div className="flex justify-center gap-4 mt-2">
                {fleetChartData.map((item, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-slate-600">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {isModuleActive('finance') && (
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-900">Gelir/Gider Trendi</h2>
                  <span className="text-xs text-slate-500">Son 6 ay</span>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                        width={45}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                      <Bar dataKey="income" name="Gelir" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="Gider" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {isModuleActive('crm') && stats.pendingRequests.total > 0 && (
            <div
              onClick={() => navigate('/customer-requests')}
              className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-5 text-white cursor-pointer hover:from-teal-600 hover:to-teal-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  <h2 className="font-semibold">Bekleyen Talepler</h2>
                </div>
                <span className="text-3xl font-bold">{stats.pendingRequests.total}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {stats.pendingRequests.extensions > 0 && (
                  <div className="bg-white/20 rounded-lg p-2 text-center">
                    <CalendarPlus className="h-4 w-4 mx-auto mb-1 opacity-80" />
                    <p className="text-xs opacity-80">Uzatma</p>
                    <p className="font-bold">{stats.pendingRequests.extensions}</p>
                  </div>
                )}
                {stats.pendingRequests.kmReports > 0 && (
                  <div className="bg-white/20 rounded-lg p-2 text-center">
                    <Gauge className="h-4 w-4 mx-auto mb-1 opacity-80" />
                    <p className="text-xs opacity-80">KM</p>
                    <p className="font-bold">{stats.pendingRequests.kmReports}</p>
                  </div>
                )}
                {stats.pendingRequests.receipts > 0 && (
                  <div className="bg-white/20 rounded-lg p-2 text-center">
                    <Receipt className="h-4 w-4 mx-auto mb-1 opacity-80" />
                    <p className="text-xs opacity-80">Dekont</p>
                    <p className="font-bold">{stats.pendingRequests.receipts}</p>
                  </div>
                )}
                {stats.pendingRequests.maintenance > 0 && (
                  <div className="bg-white/20 rounded-lg p-2 text-center">
                    <Wrench className="h-4 w-4 mx-auto mb-1 opacity-80" />
                    <p className="text-xs opacity-80">Bakim</p>
                    <p className="font-bold">{stats.pendingRequests.maintenance}</p>
                  </div>
                )}
                {stats.pendingRequests.damages > 0 && (
                  <div className="bg-white/20 rounded-lg p-2 text-center">
                    <AlertTriangle className="h-4 w-4 mx-auto mb-1 opacity-80" />
                    <p className="text-xs opacity-80">Hasar</p>
                    <p className="font-bold">{stats.pendingRequests.damages}</p>
                  </div>
                )}
                {stats.pendingRequests.driverSubmissions > 0 && (
                  <div className="bg-white/20 rounded-lg p-2 text-center">
                    <AlertTriangle className="h-4 w-4 mx-auto mb-1 opacity-80" />
                    <p className="text-xs opacity-80">Sofor</p>
                    <p className="font-bold">{stats.pendingRequests.driverSubmissions}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-white/70 mt-3 flex items-center gap-1">
                Goruntule <ChevronRight className="h-3 w-3" />
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h2 className="font-semibold text-slate-900">Yaklasan Uyarilar</h2>
                </div>
                {filteredAlerts.length > 0 && (
                  <button
                    onClick={() => setShowAlertsModal(true)}
                    className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    Tumu <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {filteredAlerts.length > 0 ? (
                <div className="space-y-2">
                  {filteredAlerts.slice(0, 4).map((alert) => {
                    const colors = getAlertColor(alert.severity);
                    return (
                      <div
                        key={alert.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border}`}
                      >
                        <div className={`p-1.5 rounded-lg bg-white/60 ${colors.icon}`}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${colors.text} truncate`}>{alert.title}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {alert.vehiclePlate && <span className="font-medium">{alert.vehiclePlate}</span>}
                            {alert.vehiclePlate && alert.description && ' - '}
                            {alert.description}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-semibold ${colors.text}`}>
                            {alert.daysUntil < 0 ? `${Math.abs(alert.daysUntil)} gun gecikti` : alert.daysUntil === 0 ? 'Bugun!' : `${alert.daysUntil} gun`}
                          </p>
                          <p className="text-xs text-slate-400">{formatDate(alert.dueDate)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Calendar className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">Yaklasan uyari yok</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-slate-400" />
                <h2 className="font-semibold text-slate-900">Son Aktiviteler</h2>
              </div>

              {stats.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity) => {
                    const displayName = activity.user_name || activity.user_email || 'Sistem';
                    const timeStr = new Date(activity.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className={`
                          mt-1 w-2 h-2 rounded-full flex-shrink-0
                          ${activity.action === 'CREATE' ? 'bg-green-500' :
                            activity.action === 'UPDATE' ? 'bg-blue-500' : 'bg-red-500'}
                        `} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-slate-600 truncate">{displayName}</span>
                            <span className="text-xs text-slate-300 flex-shrink-0">[{timeStr}]</span>
                          </div>
                          <p className="text-sm text-slate-700 truncate">{activity.details}</p>
                          <span className="text-xs text-slate-400">{getTimeAgo(activity.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Clock className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">Henuz aktivite yok</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Due Reminders */}
          {invoiceReminders.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Yaklasan Fatura Kesimleri</h2>
                  <p className="text-xs text-slate-500">3 gun icinde kesilmesi gereken faturalar</p>
                </div>
              </div>
              <div className="space-y-2">
                {invoiceReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      reminder.daysUntil <= 0
                        ? 'bg-red-50 border-red-200'
                        : reminder.daysUntil === 1
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        <span className="font-bold">{reminder.customerName}</span>
                        {' - '}
                        <span className="text-slate-600">{reminder.invoiceType}</span>
                        {' - '}
                        <span className={`font-bold ${reminder.daysUntil <= 0 ? 'text-red-600' : 'text-amber-700'}`}>
                          {reminder.daysUntil <= 0 ? 'Gecikti!' : reminder.daysUntil === 1 ? 'Yarin!' : `${reminder.daysUntil} gun`}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatCurrency(reminder.amount)} TL - Kesim: {formatDate(reminder.issueDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/finance')}
                      className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Fatura Hazirla
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
              <p className="text-slate-400 text-sm mb-1">Doluluk Orani</p>
              <p className="text-3xl font-bold">{stats.occupancyRate}%</p>
              <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.occupancyRate}%` }}
                />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-slate-500 text-sm mb-1">Toplam Kredi Borcu</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.totalLoanDebt)}</p>
              <p className="text-xs text-slate-400 mt-1">TL</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-slate-500 text-sm mb-1">Aylik Kredi Odemesi</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.monthlyLoanPayment)}</p>
              <p className="text-xs text-slate-400 mt-1">TL</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <p className="text-slate-500 text-sm mb-1">Gecen Ay Gelir</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.lastMonthRevenue)}</p>
              <p className="text-xs text-slate-400 mt-1">TL</p>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
        title="Tum Uyarilar"
        size="lg"
      >
        <div className="space-y-3">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => {
              const colors = getAlertColor(alert.severity);
              return (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border ${colors.bg} ${colors.border}`}
                >
                  <div className={`p-2 rounded-lg bg-white/60 ${colors.icon}`}>
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${colors.text}`}>{alert.title}</p>
                    <p className="text-sm text-slate-600">
                      {alert.vehiclePlate && <span className="font-medium">{alert.vehiclePlate}</span>}
                      {alert.vehiclePlate && alert.description && ' - '}
                      {alert.description}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold ${colors.text}`}>
                      {alert.daysUntil < 0 ? `${Math.abs(alert.daysUntil)} gun gecikti` : alert.daysUntil === 0 ? 'Bugun!' : `${alert.daysUntil} gun`}
                    </p>
                    <p className="text-sm text-slate-500">{formatDate(alert.dueDate)}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Su an icin yaklasan uyari bulunmuyor</p>
            </div>
          )}
        </div>
      </Modal>

      <EmergencyAssistanceModal
        isOpen={showEmergency}
        onClose={() => setShowEmergency(false)}
      />
    </div>
  );
}
