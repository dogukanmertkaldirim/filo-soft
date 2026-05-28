import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Search, Clock, Copy, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import { usePagination } from '../hooks/usePagination';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';

interface KabisRental {
  id: string;
  start_date: string;
  end_date: string;
  start_datetime: string | null;
  end_datetime: string | null;
  status: string;
  kabis_notification_status: boolean;
  kabis_reported_by: string | null;
  kabis_reported_at: string | null;
  total_amount: number;
  vehicles: { id: string; plate: string; brand: string; model: string } | null;
  customers: {
    id: string;
    company_title: string;
    tc_kimlik_no: string | null;
    first_name: string | null;
    last_name: string | null;
    father_name: string | null;
    birth_place: string | null;
    birth_date: string | null;
    passport_no: string | null;
    nationality: string | null;
    is_foreign: boolean;
  } | null;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
      title={`${label} kopyala`}
    >
      {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? 'Kopyalandi' : label}</span>
    </button>
  );
}

export default function KabisBildirimleri() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [rentals, setRentals] = useState<KabisRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reported'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRental, setSelectedRental] = useState<KabisRental | null>(null);
  const [marking, setMarking] = useState(false);

  const pagination = usePagination(20);

  useEffect(() => {
    if (companyId) loadRentals();
  }, [companyId]);

  async function loadRentals() {
    if (!companyId) return;
    setLoading(true);

    const { data } = await supabase
      .from('rentals')
      .select(`
        id, start_date, end_date, start_datetime, end_datetime, status,
        kabis_notification_status, kabis_reported_by, kabis_reported_at, total_amount,
        vehicles(id, plate, brand, model),
        customers(id, company_title, tc_kimlik_no, first_name, last_name, father_name, birth_place, birth_date, passport_no, nationality, is_foreign)
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .in('status', ['active', 'completed'])
      .order('start_date', { ascending: false })
      .limit(500);

    setRentals((data as any[]) || []);
    setLoading(false);
  }

  const filtered = rentals.filter(r => {
    if (filterStatus === 'pending' && r.kabis_notification_status === true) return false;
    if (filterStatus === 'reported' && r.kabis_notification_status !== true) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const plate = r.vehicles?.plate?.toLowerCase() || '';
      const customer = r.customers?.company_title?.toLowerCase() || '';
      const tc = r.customers?.tc_kimlik_no?.toLowerCase() || '';
      if (!plate.includes(s) && !customer.includes(s) && !tc.includes(s)) return false;
    }
    return true;
  });

  useEffect(() => {
    pagination.setTotalCount(filtered.length);
  }, [filtered.length]);

  const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.pageSize);

  const pendingCount = rentals.filter(r => !r.kabis_notification_status).length;
  const reportedCount = rentals.filter(r => r.kabis_notification_status === true).length;

  async function handleMarkReported(rental: KabisRental) {
    setMarking(true);
    const { error } = await supabase
      .from('rentals')
      .update({
        kabis_notification_status: true,
        kabis_reported_by: user?.email || 'system',
        kabis_reported_at: new Date().toISOString(),
      } as any)
      .eq('id', rental.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'Rental',
        entityId: rental.id,
        details: `KABIS bildirimi yapildi: ${rental.vehicles?.plate} - ${rental.customers?.company_title}`,
        userEmail: user?.email || undefined,
        companyId: companyId!,
      });
      loadRentals();
    }
    setMarking(false);
    setSelectedRental(null);
  }

  async function handleUnmark(rental: KabisRental) {
    setMarking(true);
    const { error } = await supabase
      .from('rentals')
      .update({
        kabis_notification_status: false,
        kabis_reported_by: null,
        kabis_reported_at: null,
      } as any)
      .eq('id', rental.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'Rental',
        entityId: rental.id,
        details: `KABIS bildirimi geri alindi: ${rental.vehicles?.plate} - ${rental.customers?.company_title}`,
        userEmail: user?.email || undefined,
        companyId: companyId!,
      });
      loadRentals();
    }
    setMarking(false);
    setSelectedRental(null);
  }

  function getMissingFields(customer: KabisRental['customers']): string[] {
    if (!customer) return ['Musteri bilgisi yok'];
    const missing: string[] = [];
    if (!customer.is_foreign) {
      if (!customer.tc_kimlik_no) missing.push('TC Kimlik');
      if (!customer.first_name) missing.push('Ad');
      if (!customer.last_name) missing.push('Soyad');
      if (!customer.father_name) missing.push('Baba Adi');
      if (!customer.birth_place) missing.push('Dogum Yeri');
      if (!customer.birth_date) missing.push('Dogum Tarihi');
    } else {
      if (!customer.passport_no) missing.push('Pasaport No');
      if (!customer.nationality) missing.push('Uyruk');
    }
    return missing;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">KABIS Bildirimleri</h1>
          <p className="text-sm text-slate-500 mt-1">Kiralik Arac Bildirim Sistemi - Emniyet Genel Mudurlugu</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Shield className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Toplam Kiralama</p>
              <p className="text-xl font-bold text-slate-900">{rentals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Bildirilmedi</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Bildirildi</p>
              <p className="text-xl font-bold text-green-600">{reportedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Plaka, musteri veya TC ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            options={[
              { value: 'all', label: 'Tum Durumlar' },
              { value: 'pending', label: 'Bildirilmedi' },
              { value: 'reported', label: 'Bildirildi' },
            ]}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Shield className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">Kiralama kaydi bulunamadi</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Durum</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Plaka</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Musteri</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">TC / Pasaport</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Baslangic</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Bitis</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Eksikler</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Islem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((rental) => {
                    const missing = getMissingFields(rental.customers);
                    const isReported = rental.kabis_notification_status === true;
                    return (
                      <tr key={rental.id} className={`hover:bg-slate-50/50 transition-colors ${!isReported ? 'bg-amber-50/20' : ''}`}>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            isReported ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isReported ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {isReported ? 'Bildirildi' : 'Bekliyor'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-bold text-slate-900">{rental.vehicles?.plate || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700 truncate max-w-[160px] block">{rental.customers?.company_title || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-mono text-slate-600">
                            {rental.customers?.is_foreign
                              ? rental.customers?.passport_no || '-'
                              : rental.customers?.tc_kimlik_no || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600">{formatDate(rental.start_date)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600">{formatDate(rental.end_date)}</span>
                        </td>
                        <td className="py-3 px-4">
                          {missing.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {missing.slice(0, 2).map(m => (
                                <span key={m} className="px-1.5 py-0.5 text-[9px] font-medium bg-red-100 text-red-600 rounded">
                                  {m}
                                </span>
                              ))}
                              {missing.length > 2 && (
                                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-red-100 text-red-600 rounded">
                                  +{missing.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-green-600 font-medium">Tamam</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedRental(rental)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                          >
                            Detay
                            <ChevronRight className="h-3 w-3" />
                          </button>
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
              pageSizeOptions={[20, 50, 100]}
            />
          </>
        )}
      </div>

      {/* Detail/Quick Copy Modal */}
      <Modal
        isOpen={!!selectedRental}
        onClose={() => setSelectedRental(null)}
        title="KABIS Hizli Veri Kopyalama"
        size="md"
      >
        {selectedRental && (
          <div className="space-y-5">
            {/* Status */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
              selectedRental.kabis_notification_status
                ? 'bg-green-50 border-green-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              {selectedRental.kabis_notification_status
                ? <Shield className="h-5 w-5 text-green-600" />
                : <AlertTriangle className="h-5 w-5 text-amber-600" />
              }
              <div>
                <p className={`text-sm font-semibold ${selectedRental.kabis_notification_status ? 'text-green-800' : 'text-amber-800'}`}>
                  {selectedRental.kabis_notification_status ? 'Bildirildi' : 'Bildirilmedi'}
                </p>
                {selectedRental.kabis_reported_at && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(selectedRental.kabis_reported_at).toLocaleString('tr-TR')} - {selectedRental.kabis_reported_by}
                  </p>
                )}
              </div>
            </div>

            {/* Identity Fields */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                {selectedRental.customers?.is_foreign ? 'Yabanci Uyruklu' : 'TC Vatandasi'} Bilgileri
              </h4>
              <div className="space-y-2">
                {!selectedRental.customers?.is_foreign ? (
                  <>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">TC Kimlik No</span>
                        <span className="text-sm font-mono font-medium">{selectedRental.customers?.tc_kimlik_no || '-'}</span>
                      </div>
                      <CopyButton text={selectedRental.customers?.tc_kimlik_no || ''} label="TCKN" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Ad Soyad</span>
                        <span className="text-sm font-medium">{selectedRental.customers?.first_name || '-'} {selectedRental.customers?.last_name || ''}</span>
                      </div>
                      <CopyButton text={`${selectedRental.customers?.first_name || ''} ${selectedRental.customers?.last_name || ''}`.trim()} label="Ad Soyad" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Baba Adi</span>
                        <span className="text-sm font-medium">{selectedRental.customers?.father_name || '-'}</span>
                      </div>
                      <CopyButton text={selectedRental.customers?.father_name || ''} label="Baba Adi" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Dogum Yeri</span>
                        <span className="text-sm font-medium">{selectedRental.customers?.birth_place || '-'}</span>
                      </div>
                      <CopyButton text={selectedRental.customers?.birth_place || ''} label="Dogum Yeri" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Dogum Tarihi</span>
                        <span className="text-sm font-medium">{selectedRental.customers?.birth_date ? formatDate(selectedRental.customers.birth_date) : '-'}</span>
                      </div>
                      <CopyButton text={selectedRental.customers?.birth_date ? formatDate(selectedRental.customers.birth_date) : ''} label="Dogum Tarihi" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Pasaport No</span>
                        <span className="text-sm font-mono font-medium">{selectedRental.customers?.passport_no || '-'}</span>
                      </div>
                      <CopyButton text={selectedRental.customers?.passport_no || ''} label="Pasaport" />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Uyruk</span>
                        <span className="text-sm font-medium">{selectedRental.customers?.nationality || '-'}</span>
                      </div>
                      <CopyButton text={selectedRental.customers?.nationality || ''} label="Uyruk" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Rental Fields */}
            <div>
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Kiralama Bilgileri</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Plaka</span>
                    <span className="text-sm font-bold">{selectedRental.vehicles?.plate || '-'}</span>
                  </div>
                  <CopyButton text={selectedRental.vehicles?.plate || ''} label="Plaka" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Sozlesme Baslangic</span>
                    <span className="text-sm font-medium">
                      {selectedRental.start_datetime
                        ? new Date(selectedRental.start_datetime).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : formatDate(selectedRental.start_date)}
                    </span>
                  </div>
                  <CopyButton
                    text={selectedRental.start_datetime
                      ? new Date(selectedRental.start_datetime).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : formatDate(selectedRental.start_date)}
                    label="Baslangic"
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-50">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Sozlesme Bitis</span>
                    <span className="text-sm font-medium">
                      {selectedRental.end_datetime
                        ? new Date(selectedRental.end_datetime).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : formatDate(selectedRental.end_date)}
                    </span>
                  </div>
                  <CopyButton
                    text={selectedRental.end_datetime
                      ? new Date(selectedRental.end_datetime).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : formatDate(selectedRental.end_date)}
                    label="Bitis"
                  />
                </div>
              </div>
            </div>

            {/* Action */}
            <div className="pt-3 border-t border-slate-200">
              {selectedRental.kabis_notification_status ? (
                <Button
                  variant="secondary"
                  onClick={() => handleUnmark(selectedRental)}
                  disabled={marking}
                  className="w-full"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {marking ? 'Isleniyor...' : 'Bildirimi Geri Al'}
                </Button>
              ) : (
                <Button
                  onClick={() => handleMarkReported(selectedRental)}
                  disabled={marking}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {marking ? 'Isleniyor...' : 'KABIS Bildirildi Olarak Isaretle'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
