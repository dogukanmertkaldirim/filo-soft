import { useState, useEffect } from 'react';
import { Plus, FileText, Search, Filter, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/format';
import { logActivity } from '../../utils/auditLog';
import { usePagination } from '../../hooks/usePagination';
import type { Invoice, InvoiceStatus, InvoiceType, Customer } from '../../types/database';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import CurrencyInput from '../ui/CurrencyInput';
import Pagination from '../ui/Pagination';

const statusOptions: { value: InvoiceStatus; label: string }[] = [
  { value: 'Taslak', label: 'Taslak' },
  { value: 'Kesilmesi Bekleyen', label: 'Kesilmesi Bekleyen' },
  { value: 'Kesildi', label: 'Kesildi' },
  { value: 'Iptal', label: 'Iptal' },
];

const typeOptions: { value: InvoiceType; label: string }[] = [
  { value: 'Kiralama Bedeli', label: 'Kiralama Bedeli' },
  { value: 'HGS Yansitma', label: 'HGS Yansitma' },
  { value: 'Hasar Yansitma', label: 'Hasar Yansitma' },
  { value: 'Diger', label: 'Diger' },
];

function getStatusBadge(status: InvoiceStatus) {
  switch (status) {
    case 'Kesildi':
      return 'bg-green-100 text-green-700';
    case 'Kesilmesi Bekleyen':
      return 'bg-amber-100 text-amber-700';
    case 'Taslak':
      return 'bg-slate-100 text-slate-600';
    case 'Iptal':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function isOverdue(dueDate: string, status: InvoiceStatus): boolean {
  if (status === 'Kesildi' || status === 'Iptal') return false;
  return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0]);
}

interface InvoiceWithCustomer extends Invoice {
  customers?: { company_title: string } | null;
}

export default function InvoicesTab() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_number: '',
    amount: 0,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date().toISOString().split('T')[0],
    status: 'Taslak' as InvoiceStatus,
    invoice_type: 'Kiralama Bedeli' as InvoiceType,
    description: '',
  });

  const pagination = usePagination(20);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;
    setLoading(true);

    const [{ data: invoiceData }, { data: customerData }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, customers(company_title)')
        .eq('company_id', companyId)
        .order('issue_date', { ascending: false })
        .limit(500),
      supabase
        .from('customers')
        .select('id, company_title')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('company_title'),
    ]);

    setInvoices(invoiceData || []);
    setCustomers(customerData || []);
    setLoading(false);
  }

  const filtered = invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterType && inv.invoice_type !== filterType) return false;
    if (dateFrom && inv.issue_date < dateFrom) return false;
    if (dateTo && inv.issue_date > dateTo) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const customerName = inv.customers?.company_title?.toLowerCase() || '';
      const invoiceNum = inv.invoice_number?.toLowerCase() || '';
      const desc = inv.description?.toLowerCase() || '';
      if (!customerName.includes(s) && !invoiceNum.includes(s) && !desc.includes(s)) return false;
    }
    return true;
  });

  useEffect(() => {
    pagination.setTotalCount(filtered.length);
  }, [filtered.length]);

  const paginated = filtered.slice(pagination.offset, pagination.offset + pagination.pageSize);

  async function handleSave() {
    if (!companyId || !formData.customer_id || formData.amount <= 0) {
      alert('Musteri ve tutar alanlari zorunludur.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('invoices').insert({
      company_id: companyId,
      customer_id: formData.customer_id,
      invoice_number: formData.invoice_number || null,
      amount: formData.amount,
      issue_date: formData.issue_date,
      due_date: formData.due_date,
      status: formData.status,
      invoice_type: formData.invoice_type,
      description: formData.description || null,
    });

    if (error) {
      console.error('Invoice save error:', error.message);
      alert('Fatura kaydedilirken bir hata olustu. Lutfen tekrar deneyin.');
    } else {
      await logActivity({
        action: 'CREATE',
        entity: 'Transaction',
        details: `Fatura olusturuldu: ${formData.invoice_type} - ${formatCurrency(formData.amount)} TL`,
        userEmail: user?.email || undefined,
        companyId,
      });
      setShowForm(false);
      resetForm();
      loadData();
    }

    setSaving(false);
  }

  async function handleStatusChange(invoiceId: string, newStatus: InvoiceStatus) {
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (error) {
      console.error('Invoice status update error:', error.message);
      alert('Durum guncellenirken bir hata olustu.');
    } else {
      loadData();
    }
  }

  function resetForm() {
    setFormData({
      customer_id: '',
      invoice_number: '',
      amount: 0,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      status: 'Taslak',
      invoice_type: 'Kiralama Bedeli',
      description: '',
    });
  }

  const overdueCount = invoices.filter(i => isOverdue(i.due_date, i.status)).length;
  const pendingCount = invoices.filter(i => i.status === 'Kesilmesi Bekleyen').length;

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Fatura</p>
          <p className="text-xl font-bold text-slate-900">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Kesilmesi Bekleyen</p>
          <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Vadesi Gecmis</p>
          <p className="text-xl font-bold text-red-600">{overdueCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Tutar</p>
          <p className="text-xl font-bold text-teal-600">
            {formatCurrency(invoices.filter(i => i.status !== 'Iptal').reduce((sum, i) => sum + Number(i.amount), 0))} TL
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Musteri, fatura no veya aciklama ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Manuel Fatura Girisi
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-4 w-4 text-slate-400" />
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: '', label: 'Tum Durumlar' },
                  ...statusOptions,
                ]}
              />
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: '', label: 'Tum Turler' },
                  ...typeOptions,
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
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">Henuz fatura kaydi yok</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Musteri</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Fatura No</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Tur</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Tutar</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Kesim Tarihi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Vade Tarihi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Durum</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 uppercase">Islem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((inv) => {
                    const overdue = isOverdue(inv.due_date, inv.status);
                    return (
                      <tr key={inv.id} className={`hover:bg-slate-50/50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">
                            {inv.customers?.company_title || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600">{inv.invoice_number || '-'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                            {inv.invoice_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(Number(inv.amount))} TL
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-600">{formatDate(inv.issue_date)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
                            {formatDate(inv.due_date)}
                            {overdue && <span className="ml-1 text-[10px]">(Gecmis)</span>}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusBadge(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            value={inv.status}
                            onChange={(e) => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                            className="text-xs px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            {statusOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
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

      {/* Add Invoice Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Manuel Fatura Girisi / Taslagi">
        <div className="space-y-4">
          <Select
            label="Musteri"
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            options={[
              { value: '', label: 'Musteri Secin' },
              ...customers.map(c => ({ value: c.id, label: c.company_title })),
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fatura No (Opsiyonel)"
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              placeholder="FTR-2026-001"
            />
            <CurrencyInput
              label="Tutar (TL)"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Fatura Turu"
              value={formData.invoice_type}
              onChange={(e) => setFormData({ ...formData, invoice_type: e.target.value as InvoiceType })}
              options={typeOptions}
            />
            <Select
              label="Durum"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as InvoiceStatus })}
              options={statusOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kesim Tarihi"
              type="date"
              value={formData.issue_date}
              onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
            />
            <Input
              label="Vade Tarihi"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <Input
            label="Aciklama (Opsiyonel)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Fatura ile ilgili notlar..."
          />

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
