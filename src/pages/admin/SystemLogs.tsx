import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { SystemLog } from '../../types/database';

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadData();
  }, [page, levelFilter, dateFilter]);

  async function loadData() {
    setLoading(true);
    try {
      let query = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (levelFilter !== 'all') {
        query = query.eq('level', levelFilter);
      }

      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        if (dateFilter === 'today') {
          startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (dateFilter === 'week') {
          startDate = new Date(now.setDate(now.getDate() - 7));
        } else {
          startDate = new Date(now.setMonth(now.getMonth() - 1));
        }
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(
    (log) => log.message.toLowerCase().includes(search.toLowerCase())
  );

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/20 text-red-400';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-blue-500/20 text-blue-400';
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sistem Loglari</h1>
          <p className="text-slate-400 mt-1">
            {totalCount} kayit bulundu
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Log ara..."
            className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value as typeof levelFilter);
              setPage(1);
            }}
            className="appearance-none pl-4 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Tum Seviyeler</option>
            <option value="error">Hata</option>
            <option value="warning">Uyari</option>
            <option value="info">Bilgi</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value as typeof dateFilter);
              setPage(1);
            }}
            className="appearance-none pl-4 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Tum Tarihler</option>
            <option value="today">Bugun</option>
            <option value="week">Son 7 Gun</option>
            <option value="month">Son 30 Gun</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">Log kaydi bulunamadi</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getLevelIcon(log.level)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelBadge(log.level)}`}>
                        {log.level === 'error' ? 'HATA' : log.level === 'warning' ? 'UYARI' : 'BILGI'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss', { locale: tr })}
                      </span>
                    </div>
                    <p className="text-white text-sm">{log.message}</p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-3 bg-slate-900 rounded-lg">
                        <pre className="text-xs text-slate-400 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                    {(log.ip_address || log.user_agent) && (
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                        {log.user_agent && (
                          <span className="truncate max-w-xs" title={log.user_agent}>
                            {log.user_agent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Sayfa {page} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
            >
              Onceki
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
