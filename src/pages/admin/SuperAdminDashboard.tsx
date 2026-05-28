import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  Package,
  Car,
  FileText,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface DashboardStats {
  totalVehicles: number;
  totalUsers: number;
  totalRevenue: number;
  activeRentals: number;
  recentLogs: Array<{
    id: string;
    level: string;
    message: string;
    created_at: string;
  }>;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVehicles: 0,
    totalUsers: 0,
    totalRevenue: 0,
    activeRentals: 0,
    recentLogs: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [vehiclesResult, usersResult, rentalsResult, logsResult] = await Promise.all([
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('app_users').select('id', { count: 'exact', head: true }),
        supabase.from('rentals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase
          .from('system_logs')
          .select('id, level, message, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        totalVehicles: vehiclesResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalRevenue: 0,
        activeRentals: rentalsResult.count || 0,
        recentLogs: logsResult.data || [],
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
        <p className="text-slate-400 mt-1">Sistem genel gorunumu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Toplam Arac</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalVehicles}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Car className="h-6 w-6 text-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-sm text-slate-400">
            <Activity className="h-4 w-4" />
            <span>Filodaki araclar</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Aktif Kiralamalar</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.activeRentals}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-sm text-emerald-400">
            <ArrowUpRight className="h-4 w-4" />
            <span>Devam eden kiralamalar</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Toplam Kullanici</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.totalUsers}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-sm text-slate-400">
            <Users className="h-4 w-4" />
            <span>Kayitli kullanicilar</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Abonelik Durumu</p>
              <p className="text-3xl font-bold text-white mt-1">Aktif</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Package className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 text-sm text-emerald-400">
            <ArrowUpRight className="h-4 w-4" />
            <span>Tek calisma alani</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Son Sistem Loglari</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {stats.recentLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Henuz log kaydi yok</p>
            </div>
          ) : (
            stats.recentLogs.map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      log.level === 'error'
                        ? 'bg-red-500'
                        : log.level === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{log.message}</p>
                    <span className="text-xs text-slate-500">
                      {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: tr })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Hizli Islemler</h3>
            <p className="text-sm text-slate-400 mt-1">
              Paketleri duzenlemek veya sistem loglarini incelemek icin yan menuyu kullanin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
