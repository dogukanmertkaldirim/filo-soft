import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Search, Filter, User, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { ActivityLog } from '../types/database';
import Select from '../components/ui/Select';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/ui/Pagination';

export default function AuditLogs() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const pagination = usePagination(30);

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;
    setLoading(true);

    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1000);

    setLogs(data || []);
    setLoading(false);
  }

  const uniqueUsers = Array.from(
    new Map(
      logs
        .filter(l => l.user_name || l.user_email)
        .map(l => [l.user_email || l.user_name, { name: l.user_name, email: l.user_email }])
    ).values()
  );

  const filteredLogs = logs.filter(log => {
    if (filterEntity && log.entity !== filterEntity) return false;
    if (filterAction && log.action !== filterAction) return false;
    if (filterUser) {
      const userMatch = log.user_email === filterUser || log.user_name === filterUser;
      if (!userMatch) return false;
    }

    if (dateFrom) {
      const logDate = new Date(log.created_at);
      const fromDate = new Date(dateFrom);
      if (logDate < fromDate) return false;
    }

    if (dateTo) {
      const logDate = new Date(log.created_at);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (logDate > toDate) return false;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        log.details.toLowerCase().includes(search) ||
        log.entity.toLowerCase().includes(search) ||
        (log.user_email?.toLowerCase().includes(search) || false) ||
        (log.user_name?.toLowerCase().includes(search) || false)
      );
    }
    return true;
  });

  useEffect(() => {
    pagination.setTotalCount(filteredLogs.length);
  }, [filteredLogs.length]);

  const paginatedLogs = filteredLogs.slice(
    pagination.offset,
    pagination.offset + pagination.pageSize
  );

  function getActionColor(action: string) {
    switch (action) {
      case 'DELETE': return 'bg-red-100 text-red-700';
      case 'UPDATE': return 'bg-amber-100 text-amber-700';
      case 'CREATE': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  function getEntityColor(entity: string) {
    const map: Record<string, string> = {
      Transaction: 'bg-blue-100 text-blue-700',
      Vehicle: 'bg-teal-100 text-teal-700',
      Customer: 'bg-cyan-100 text-cyan-700',
      Loan: 'bg-orange-100 text-orange-700',
      Partner: 'bg-emerald-100 text-emerald-700',
      Rental: 'bg-green-100 text-green-700',
      Supplier: 'bg-sky-100 text-sky-700',
      VehicleSale: 'bg-rose-100 text-rose-700',
      Bakim: 'bg-yellow-100 text-yellow-700',
      User: 'bg-slate-200 text-slate-700',
      Reservation: 'bg-blue-100 text-blue-700',
      ServiceAppointment: 'bg-teal-100 text-teal-700',
      ExternalService: 'bg-sky-100 text-sky-700',
    };
    return map[entity] || 'bg-slate-100 text-slate-700';
  }

  function getActionLabel(action: string) {
    switch (action) {
      case 'DELETE': return 'Silindi';
      case 'UPDATE': return 'Guncellendi';
      case 'CREATE': return 'Olusturuldu';
      default: return action;
    }
  }

  function getEntityLabel(entity: string) {
    const map: Record<string, string> = {
      Transaction: 'Islem',
      Vehicle: 'Arac',
      Customer: 'Musteri',
      Loan: 'Kredi',
      Partner: 'Ortak',
      Rental: 'Kiralama',
      Supplier: 'Tedarikci',
      VehicleSale: 'Arac Satisi',
      Bakim: 'Bakim',
      User: 'Kullanici',
      Reservation: 'Rezervasyon',
      ServiceAppointment: 'Servis Randevusu',
      ExternalService: 'Dis Hizmet',
      PartnerDocument: 'Ortak Belgesi',
      CustomerRequest: 'Musteri Talebi',
      DamageReport: 'Hasar Raporu',
      TransferRequest: 'Transfer Talebi',
      Payment: 'Odeme',
    };
    return map[entity] || entity;
  }

  const deleteCount = logs.filter(l => l.action === 'DELETE').length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-900 rounded-lg flex-shrink-0">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sistem Gunlukleri</h1>
          <p className="text-sm text-slate-500">Tum kullanici islemlerinin detayli kaydi</p>
        </div>
      </div>

      {deleteCount > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {deleteCount} silme islemi kayit altinda
            </p>
            <p className="text-xs text-red-600">
              Tum silme islemleri guvenlik icin loglanmaktadir
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ara... (islem detayi, kullanici adi)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-slate-400" />

              <Select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                options={[
                  { value: '', label: 'Tum Moduller' },
                  { value: 'Transaction', label: 'Islem' },
                  { value: 'Vehicle', label: 'Arac' },
                  { value: 'Customer', label: 'Musteri' },
                  { value: 'Partner', label: 'Ortak' },
                  { value: 'Loan', label: 'Kredi' },
                  { value: 'Rental', label: 'Kiralama' },
                  { value: 'Supplier', label: 'Tedarikci' },
                  { value: 'VehicleSale', label: 'Arac Satisi' },
                  { value: 'Bakim', label: 'Bakim' },
                  { value: 'User', label: 'Kullanici' },
                  { value: 'Reservation', label: 'Rezervasyon' },
                ]}
              />

              <Select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                options={[
                  { value: '', label: 'Tum Islemler' },
                  { value: 'DELETE', label: 'Silme' },
                  { value: 'UPDATE', label: 'Guncelleme' },
                  { value: 'CREATE', label: 'Olusturma' },
                ]}
              />

              <Select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                options={[
                  { value: '', label: 'Tum Kullanicilar' },
                  ...uniqueUsers.map(u => ({
                    value: u.email || u.name || '',
                    label: u.name ? `${u.name}${u.email ? ` (${u.email})` : ''}` : (u.email || 'Bilinmeyen')
                  }))
                ]}
              />

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Shield className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">Henuz kayitli islem yok</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Islemi Yapan</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Yapilan Islem</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Etkilenen Kayit</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tarih / Saat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log) => {
                    const displayName = log.user_name || log.user_email || 'Sistem';
                    const dateObj = new Date(log.created_at);
                    const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-teal-700" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
                              {log.user_email && log.user_name && (
                                <p className="text-[11px] text-slate-400 truncate">{log.user_email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getActionColor(log.action)}`}>
                              {getActionLabel(log.action)}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getEntityColor(log.entity)}`}>
                              {getEntityLabel(log.entity)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-slate-700 truncate max-w-xs" title={log.details}>{log.details}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>{dateStr}</span>
                            <span className="text-slate-400">{timeStr}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalCount={pagination.totalCount}
              pageSize={pagination.pageSize}
              hasNextPage={pagination.hasNextPage}
              hasPrevPage={pagination.hasPrevPage}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={[30, 50, 100]}
            />
          </>
        )}
      </div>
    </div>
  );
}
