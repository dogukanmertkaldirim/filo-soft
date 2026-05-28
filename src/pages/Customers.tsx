import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, FileSpreadsheet, Mail, Eye, AlertTriangle, Ban, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Customer, Rental, Transaction, CompanyProfile } from '../types/database';
import { exportToExcel } from '../utils/exportExcel';
import { logActivity, formatCustomerDetails } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import { formatCurrency, formatDate, calculateAccruedAmount, calculateCurrentDebt } from '../utils/format';
import { generatePaymentReminderEmail } from '../utils/emailTemplates';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import FileUpload from '../components/ui/FileUpload';
import Pagination from '../components/ui/Pagination';

interface CustomerFormData {
  customer_code: string;
  company_title: string;
  authorized_person: string;
  tax_id: string;
  email: string;
  address: string;
  tax_plate_url: string | null;
  signature_circular_url: string | null;
  trade_registry_url: string | null;
  findeks_report_url: string | null;
  is_blacklisted: boolean;
  blacklist_reason: string;
  is_foreign: boolean;
  tc_kimlik_no: string;
  first_name: string;
  last_name: string;
  father_name: string;
  birth_place: string;
  birth_date: string;
  passport_no: string;
  nationality: string;
}

const emptyForm: CustomerFormData = {
  customer_code: '',
  company_title: '',
  authorized_person: '',
  tax_id: '',
  email: '',
  address: '',
  tax_plate_url: null,
  signature_circular_url: null,
  trade_registry_url: null,
  findeks_report_url: null,
  is_blacklisted: false,
  blacklist_reason: '',
  is_foreign: false,
  tc_kimlik_no: '',
  first_name: '',
  last_name: '',
  father_name: '',
  birth_place: '',
  birth_date: '',
  passport_no: '',
  nationality: '',
};

function generateCustomerCode(): string {
  const prefix = 'M';
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export default function Customers() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

  const pagination = usePagination(20);

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      pagination.reset();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, viewMode, debouncedSearch, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (companyId) {
      loadSupportingData();
    }
  }, [companyId]);

  async function loadSupportingData() {
    if (!companyId) return;

    const [rentalsRes, transactionsRes, profilesRes] = await Promise.all([
      supabase.from('rentals').select('*').eq('company_id', companyId),
      supabase.from('transactions').select('*').eq('company_id', companyId),
      supabase.from('company_profiles').select('*').eq('company_id', companyId).order('created_at', { ascending: true }),
    ]);
    setRentals(rentalsRes.data || []);
    setTransactions(transactionsRes.data || []);
    setCompanyProfiles(profilesRes.data || []);
  }

  async function loadData() {
    if (!companyId) return;

    setLoading(true);

    let customersQuery = supabase.from('customers').select('*', { count: 'exact' }).eq('company_id', companyId);

    if (viewMode === 'active') {
      customersQuery = customersQuery.is('deleted_at', null);
    } else if (viewMode === 'trash') {
      customersQuery = customersQuery.filter('deleted_at', 'not.is', null);
    }

    if (debouncedSearch) {
      customersQuery = customersQuery.or(`company_title.ilike.%${debouncedSearch}%,authorized_person.ilike.%${debouncedSearch}%,tax_id.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,customer_code.ilike.%${debouncedSearch}%`);
    }

    customersQuery = customersQuery
      .order('company_title')
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    const customersRes = await customersQuery;

    setCustomers(customersRes.data || []);
    pagination.setTotalCount(customersRes.count || 0);
    setLoading(false);
  }

  function calculateCustomerDebt(customerId: string): number {
    const customerRentals = rentals.filter(r => r.customer_id === customerId && r.status === 'active');

    let totalAccruedAmount = 0;
    let totalPayments = 0;

    customerRentals.forEach(rental => {
      const accruedAmount = calculateAccruedAmount(
        rental.daily_rate,
        rental.start_date,
        rental.end_date,
        rental.status
      );
      totalAccruedAmount += accruedAmount;

      const rentalPayments = transactions.filter(
        t => t.type === 'income' && t.rental_id === rental.id
      );
      const paymentsSum = rentalPayments.reduce((sum, t) => sum + t.amount, 0);
      totalPayments += paymentsSum;
    });

    return totalAccruedAmount - totalPayments;
  }

  function openDetailModal(customer: Customer) {
    setDetailCustomer(customer);
    setShowDetailModal(true);
  }

  function handleSendPaymentReminder(customer: Customer) {
    const debt = calculateCustomerDebt(customer.id);
    if (debt <= 0) {
      alert('Bu musterinin borcu bulunmuyor');
      return;
    }
    const defaultProfile = companyProfiles.find(p => p.is_default) || companyProfiles[0];
    const mailto = generatePaymentReminderEmail({
      customer,
      debtAmount: debt,
      companyProfile: defaultProfile,
    });
    window.open(mailto, '_blank');
  }

  function openAddForm() {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      customer_code: customer.customer_code || '',
      company_title: customer.company_title,
      authorized_person: customer.authorized_person || '',
      tax_id: customer.tax_id || '',
      email: customer.email || '',
      address: customer.address || '',
      tax_plate_url: customer.tax_plate_url,
      signature_circular_url: customer.signature_circular_url,
      trade_registry_url: customer.trade_registry_url,
      findeks_report_url: customer.findeks_report_url,
      is_blacklisted: customer.is_blacklisted || false,
      blacklist_reason: customer.blacklist_reason || '',
      is_foreign: customer.is_foreign || false,
      tc_kimlik_no: customer.tc_kimlik_no || '',
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      father_name: customer.father_name || '',
      birth_place: customer.birth_place || '',
      birth_date: customer.birth_date || '',
      passport_no: customer.passport_no || '',
      nationality: customer.nationality || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.company_title.trim()) {
      alert('Lutfen firma unvanini girin.');
      return;
    }

    if (!companyId) {
      console.error('Company ID missing - user.company_id:', user?.company_id);
      alert('Sirket bilgisi bulunamadi. Lutfen cikis yapip tekrar giris yapin.');
      return;
    }

    setSaving(true);
    const code = formData.customer_code.trim() || generateCustomerCode();
    const customerData = {
      customer_code: code,
      company_title: formData.company_title.trim(),
      authorized_person: formData.authorized_person.trim() || null,
      tax_id: formData.tax_id.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      tax_plate_url: formData.tax_plate_url,
      signature_circular_url: formData.signature_circular_url,
      trade_registry_url: formData.trade_registry_url,
      findeks_report_url: formData.findeks_report_url,
      is_blacklisted: formData.is_blacklisted,
      blacklist_reason: formData.is_blacklisted ? formData.blacklist_reason.trim() || null : null,
      is_foreign: formData.is_foreign,
      tc_kimlik_no: formData.tc_kimlik_no.trim() || null,
      first_name: formData.first_name.trim() || null,
      last_name: formData.last_name.trim() || null,
      father_name: formData.father_name.trim() || null,
      birth_place: formData.birth_place.trim() || null,
      birth_date: formData.birth_date || null,
      passport_no: formData.passport_no.trim() || null,
      nationality: formData.nationality.trim() || null,
      company_id: companyId,
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(customerData).eq('id', editingCustomer.id).eq('company_id', companyId);
        if (error) {
          console.error('Supabase Update Error:', error);
          throw error;
        }
        await logActivity({
          action: 'UPDATE',
          entity: 'Customer',
          entityId: editingCustomer.id,
          details: `Musteri guncellendi: ${formData.company_title}`,
          userEmail: user?.email,
          companyId: companyId,
        });
      } else {
        const { data, error } = await supabase.from('customers').insert(customerData).select().single();
        if (error) {
          console.error('Supabase Insert Error:', error);
          throw error;
        }
        await logActivity({
          action: 'CREATE',
          entity: 'Customer',
          entityId: data?.id,
          details: `Yeni musteri eklendi: ${formData.company_title}`,
          userEmail: user?.email,
          companyId: companyId,
        });
      }
      setShowForm(false);
      loadData();
    } catch (err: unknown) {
      console.error('Customer save error:', err);
      alert('Musteri kaydedilirken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`${customer.company_title} musterisini silmek istediginize emin misiniz?`) || !companyId) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Customer',
      entityId: customer.id,
      details: formatCustomerDetails(customer),
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', customer.id).eq('company_id', companyId);
    loadData();
  }

  async function handleRestore(customer: Customer) {
    if (!companyId || !confirm('Bu musteriyi geri yuklemek istediginizden emin misiniz?')) return;

    await supabase
      .from('customers')
      .update({ deleted_at: null })
      .eq('id', customer.id)
      .eq('company_id', companyId);

    loadData();
  }

  const filteredCustomers = customers;

  function handleExportCustomers() {
    const columns = [
      { key: 'customer_code' as const, header: 'Cari Kod' },
      { key: 'company_title' as const, header: 'Firma Unvani' },
      { key: 'authorized_person' as const, header: 'Yetkili Kisi' },
      { key: 'tax_id' as const, header: 'Vergi No' },
      { key: 'email' as const, header: 'E-posta' },
      { key: 'address' as const, header: 'Adres' },
    ];
    exportToExcel(filteredCustomers, columns, 'Musteriler');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Musteriler</h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExportCustomers}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel'e Aktar
          </Button>
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            Musteri Ekle
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setViewMode('active')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === 'active'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Aktif Musteriler
            </button>
            <button
              onClick={() => setViewMode('trash')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                viewMode === 'trash'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Silinenler
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Musteri ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Cari Kod</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Firma Unvani</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Yetkili Kisi</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Vergi No</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">E-posta</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Bakiye</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Belgeler</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => {
                  const docCount = [c.tax_plate_url, c.signature_circular_url, c.trade_registry_url, c.findeks_report_url].filter(Boolean).length;
                  const debt = calculateCustomerDebt(c.id);
                  return (
                    <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 ${c.is_blacklisted ? 'bg-red-50' : ''}`}>
                      <td className="py-3 px-4">
                        {c.customer_code ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-mono font-semibold rounded bg-slate-100 text-slate-700">
                            {c.customer_code}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          {c.is_blacklisted && (
                            <span className="text-red-500" title={c.blacklist_reason || 'Kara Listede'}>
                              <Ban className="h-4 w-4" />
                            </span>
                          )}
                          <span className={c.is_blacklisted ? 'text-red-700' : ''}>{c.company_title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{c.authorized_person || '-'}</td>
                      <td className="py-3 px-4">{c.tax_id || '-'}</td>
                      <td className="py-3 px-4">{c.email || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {debt > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            {formatCurrency(debt)} TL
                          </span>
                        ) : debt < 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            {formatCurrency(Math.abs(debt))} TL Kredi
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                          {docCount}/4
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetailModal(c)}
                            className="p-1.5 hover:bg-slate-100 rounded"
                            title="Detaylar"
                          >
                            <Eye className="h-4 w-4 text-slate-500" />
                          </button>
                          {viewMode === 'active' && debt > 0 && (
                            <button
                              onClick={() => handleSendPaymentReminder(c)}
                              className="p-1.5 hover:bg-blue-50 rounded"
                              title="Borc Hatirlatmasi Gonder"
                            >
                              <Mail className="h-4 w-4 text-blue-500" />
                            </button>
                          )}
                          {viewMode === 'active' && (
                            <>
                              <button
                                onClick={() => openEditForm(c)}
                                className="p-1.5 hover:bg-slate-100 rounded"
                                title="Duzenle"
                              >
                                <Edit2 className="h-4 w-4 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(c)}
                                className="p-1.5 hover:bg-red-50 rounded"
                                title="Sil"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </>
                          )}
                          {viewMode === 'trash' && (
                            <button
                              onClick={() => handleRestore(c)}
                              className="p-1.5 hover:bg-green-50 rounded"
                              title="Geri Yukle"
                            >
                              <RotateCcw className="h-4 w-4 text-green-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && !loading && (
              <p className="text-center py-8 text-slate-500">Musteri bulunamadi</p>
            )}

            {pagination.totalCount > 0 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                pageSize={pagination.pageSize}
                hasNextPage={pagination.hasNextPage}
                hasPrevPage={pagination.hasPrevPage}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingCustomer ? 'Musteri Duzenle' : 'Musteri Ekle'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Cari Kod"
              value={formData.customer_code}
              onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
              placeholder="Bos birakirsaniz otomatik olusturulur"
            />
            <div className="md:col-span-2">
              <Input
                label="Firma Unvani *"
                value={formData.company_title}
                onChange={(e) => setFormData({ ...formData, company_title: e.target.value })}
                placeholder="Firma adini girin"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Yetkili Kisi"
              value={formData.authorized_person}
              onChange={(e) => setFormData({ ...formData, authorized_person: e.target.value })}
            />
            <Input
              label="Vergi No"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            />
          </div>

          <Input
            label="E-posta"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label="Adres"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-900">KABIS Kimlik Bilgileri</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_foreign}
                  onChange={(e) => setFormData({ ...formData, is_foreign: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                />
                <span className="text-xs text-slate-600">Yabanci Uyruklu</span>
              </label>
            </div>
            {!formData.is_foreign ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="TC Kimlik No"
                  value={formData.tc_kimlik_no}
                  onChange={(e) => setFormData({ ...formData, tc_kimlik_no: e.target.value })}
                  placeholder="11 haneli TC No"
                  maxLength={11}
                />
                <Input
                  label="Ad"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
                <Input
                  label="Soyad"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
                <Input
                  label="Baba Adi"
                  value={formData.father_name}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                />
                <Input
                  label="Dogum Yeri"
                  value={formData.birth_place}
                  onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                />
                <Input
                  label="Dogum Tarihi"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Pasaport No"
                  value={formData.passport_no}
                  onChange={(e) => setFormData({ ...formData, passport_no: e.target.value })}
                />
                <Input
                  label="Uyruk (Nationality)"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                />
                <Input
                  label="Ad"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
                <Input
                  label="Soyad"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4">Belgeler (Opsiyonel)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUpload
                label="Vergi Levhasi"
                value={formData.tax_plate_url}
                onChange={(v) => setFormData({ ...formData, tax_plate_url: v })}
                downloadFilename={`${formData.company_title || 'musteri'}_vergi_levhasi`}
              />
              <FileUpload
                label="Imza Sirküleri"
                value={formData.signature_circular_url}
                onChange={(v) => setFormData({ ...formData, signature_circular_url: v })}
                downloadFilename={`${formData.company_title || 'musteri'}_imza_sirkuleri`}
              />
              <FileUpload
                label="Ticaret Sicil Gazetesi"
                value={formData.trade_registry_url}
                onChange={(v) => setFormData({ ...formData, trade_registry_url: v })}
                downloadFilename={`${formData.company_title || 'musteri'}_ticaret_sicil`}
              />
              <FileUpload
                label="Findeks Raporu"
                value={formData.findeks_report_url}
                onChange={(v) => setFormData({ ...formData, findeks_report_url: v })}
                downloadFilename={`${formData.company_title || 'musteri'}_findeks`}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_blacklisted}
                  onChange={(e) => setFormData({ ...formData, is_blacklisted: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
              <span className="text-sm font-medium text-slate-700">Kara Listeye Al</span>
              {formData.is_blacklisted && <Ban className="h-4 w-4 text-red-500" />}
            </div>
            {formData.is_blacklisted && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kara Liste Sebebi
                </label>
                <textarea
                  value={formData.blacklist_reason}
                  onChange={(e) => setFormData({ ...formData, blacklist_reason: e.target.value })}
                  placeholder="Kara listeye alma sebebini yazin..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingCustomer ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Musteri Detaylari: ${detailCustomer?.company_title}`}
        size="lg"
      >
        {detailCustomer && (() => {
          const customerRentals = rentals.filter(r => r.customer_id === detailCustomer.id);
          const debt = calculateCustomerDebt(detailCustomer.id);
          return (
            <div className="space-y-6">
              {detailCustomer.customer_code && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm text-slate-500">Cari Kod:</span>
                  <span className="font-mono font-bold text-slate-900">{detailCustomer.customer_code}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Yetkili Kisi</p>
                  <p className="font-medium">{detailCustomer.authorized_person || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">E-posta</p>
                  <p className="font-medium">{detailCustomer.email || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Vergi No</p>
                  <p className="font-medium">{detailCustomer.tax_id || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Toplam Kiralama</p>
                  <p className="font-medium">{customerRentals.length} adet</p>
                </div>
              </div>

              {debt !== 0 && (
                <div className={`p-4 rounded-lg border ${debt > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`flex items-center gap-2 mb-1 ${debt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-semibold">{debt > 0 ? 'Guncel Cari Borc' : 'Odenecek Kredi'}</span>
                      </div>
                      <p className={`text-2xl font-bold ${debt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {formatCurrency(Math.abs(debt))} TL
                      </p>
                    </div>
                    {debt > 0 && (
                      <Button onClick={() => handleSendPaymentReminder(detailCustomer)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Borc Hatirlatmasi Gonder
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Kiralama Gecmisi</h3>
                {customerRentals.length === 0 ? (
                  <p className="text-slate-500 text-sm">Henuz kiralama yok</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {customerRentals.map(r => (
                      <div
                        key={r.id}
                        className="p-3 bg-slate-50 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {formatDate(r.start_date)} - {formatDate(r.end_date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {r.status === 'active' ? 'Aktif' : r.status === 'completed' ? 'Tamamlandi' : 'Iptal'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(r.total_amount)} TL</p>
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            r.status === 'active' ? 'bg-green-100 text-green-700' :
                            r.status === 'completed' ? 'bg-slate-100 text-slate-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {r.status === 'active' ? 'Aktif' : r.status === 'completed' ? 'Tamamlandi' : 'Iptal'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                  Kapat
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
