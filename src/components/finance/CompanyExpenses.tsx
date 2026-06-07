import { useState, useEffect } from 'react';
import { Plus, CheckCircle, Clock, Trash2, CreditCard as Edit2, RotateCcw, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import CurrencyInput from '../ui/CurrencyInput';

interface CompanyExpense {
  id: string;
  company_id: string;
  category: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  description: string | null;
  is_recurring: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'Dukkan Kirasi', label: 'Dukkan Kirasi' },
  { value: 'Personel Maasi', label: 'Personel Maasi' },
  { value: 'SGK Prim Odemesi', label: 'SGK Prim Odemesi' },
  { value: 'Yemek/Mutfak', label: 'Yemek/Mutfak' },
  { value: 'Vergi/Harc', label: 'Vergi/Harc' },
  { value: 'Ofis/Fatura', label: 'Ofis/Fatura' },
  { value: 'Diger Genel Giderler', label: 'Diger Genel Giderler' },
];

const emptyForm = {
  category: 'Dukkan Kirasi',
  amount: 0,
  due_date: new Date().toISOString().split('T')[0],
  payment_date: '',
  status: 'pending',
  description: '',
  is_recurring: false,
};

export default function CompanyExpenses() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [expenses, setExpenses] = useState<CompanyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (companyId) loadExpenses();
  }, [companyId, filterStatus, filterCategory, filterMonth]);

  async function loadExpenses() {
    setLoading(true);
    const [year, month] = filterMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

    let query = supabase
      .from('company_expenses')
      .select('*')
      .eq('company_id', companyId)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .order('due_date', { ascending: false });

    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterCategory !== 'all') query = query.eq('category', filterCategory);

    const { data } = await query;
    setExpenses(data || []);
    setLoading(false);
  }

  function openAddForm() {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(exp: CompanyExpense) {
    setEditingId(exp.id);
    setFormData({
      category: exp.category,
      amount: exp.amount,
      due_date: exp.due_date,
      payment_date: exp.payment_date || '',
      status: exp.status,
      description: exp.description || '',
      is_recurring: exp.is_recurring,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.amount || !formData.due_date) {
      alert('Tutar ve vade tarihi zorunludur');
      return;
    }
    setSaving(true);

    const payload = {
      company_id: companyId,
      category: formData.category,
      amount: formData.amount,
      due_date: formData.due_date,
      payment_date: formData.payment_date || null,
      status: formData.status,
      description: formData.description || null,
      is_recurring: formData.is_recurring,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from('company_expenses').update(payload).eq('id', editingId);
    } else {
      await supabase.from('company_expenses').insert(payload);
    }

    setSaving(false);
    setShowForm(false);
    loadExpenses();
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu gider kaydini silmek istediginize emin misiniz?')) return;
    await supabase.from('company_expenses').delete().eq('id', id);
    loadExpenses();
  }

  async function handleMarkPaid(id: string) {
    await supabase.from('company_expenses').update({
      status: 'paid',
      payment_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadExpenses();
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidAmount = expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 mb-1">Toplam Gider</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)} TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            <p className="text-xs font-medium text-green-700">Odenen</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(paidAmount)} TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs font-medium text-amber-700">Bekleyen</p>
          </div>
          <p className="text-2xl font-bold text-amber-700">{formatCurrency(pendingAmount)} TL</p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">Tum Durumlar</option>
          <option value="pending">Odenecek</option>
          <option value="paid">Odendi</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">Tum Kategoriler</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="ml-auto">
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4 mr-1" /> Yeni Gider
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Bu ay icin gider kaydi bulunamadi</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Kategori</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Aciklama</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Tutar</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vade</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Durum</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Tekrar</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{exp.description || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(exp.amount)} TL</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(exp.due_date)}</td>
                    <td className="px-4 py-3">
                      {exp.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3" /> Odendi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock className="h-3 w-3" /> Odenecek
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {exp.is_recurring && (
                        <RotateCcw className="h-4 w-4 text-blue-500 mx-auto" title="Aylik Tekrar" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {exp.status === 'pending' && (
                          <button
                            onClick={() => handleMarkPaid(exp.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Odendi Olarak Isaretle"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditForm(exp)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Duzenle"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Gider Duzenle' : 'Yeni Gider Girisi'}
      >
        <div className="space-y-4">
          <Select
            label="Kategori"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={CATEGORIES}
          />

          <CurrencyInput
            label="Tutar (TL)"
            value={formData.amount}
            onChange={(val) => setFormData({ ...formData, amount: val })}
          />

          <Input
            label="Vade Tarihi"
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
          />

          <Select
            label="Durum"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'pending', label: 'Odenecek' },
              { value: 'paid', label: 'Odendi' },
            ]}
          />

          {formData.status === 'paid' && (
            <Input
              label="Odeme Tarihi"
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            />
          )}

          <Input
            label="Aciklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Gider hakkinda not..."
          />

          <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_recurring}
              onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
              className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-blue-800">Her Ay Otomatik Tekrarla</p>
              <p className="text-xs text-blue-600">Bu gider her ay vade tarihinde otomatik olusturulur</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editingId ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
