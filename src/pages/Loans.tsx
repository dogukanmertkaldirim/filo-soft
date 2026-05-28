import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CreditCard, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Loan, Partner, Vehicle, LoanPayment } from '../types/database';
import { formatCurrency, formatDate, getDaysUntil } from '../utils/format';
import { logActivity, formatLoanDetails } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';

interface LoanFormData {
  loan_type: 'vehicle' | 'capital';
  vehicle_id: string;
  owner_partner_id: string;
  bank: string;
  maturity_date: string;
  total_amount: number;
  installment_count: number;
  payment_day: number;
  installment_amount: number;
  total_payback_amount: number;
  capital_name: string;
}

const emptyForm: LoanFormData = {
  loan_type: 'vehicle',
  vehicle_id: '',
  owner_partner_id: '',
  bank: '',
  maturity_date: '',
  total_amount: 0,
  installment_count: 12,
  payment_day: 1,
  installment_amount: 0,
  total_payback_amount: 0,
  capital_name: '',
};

export default function Loans() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<Record<string, LoanPayment[]>>({});
  const [partners, setPartners] = useState<Partner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'active' | 'completed'>('active');

  const [showForm, setShowForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [formData, setFormData] = useState<LoanFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, viewMode, loanStatusFilter]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);

    let loansQuery = supabase.from('loans').select('*').eq('company_id', companyId);

    // Filter by soft delete status
    if (viewMode === 'active') {
      loansQuery = loansQuery.is('deleted_at', null);
    } else if (viewMode === 'trash') {
      loansQuery = loansQuery.filter('deleted_at', 'not.is', null);
    }

    // Filter by loan status
    loansQuery = loansQuery.eq('status', loanStatusFilter);

    const [loansRes, partnersRes, vehiclesRes, paymentsRes] = await Promise.all([
      loansQuery.order('maturity_date'),
      supabase.from('partners').select('*').eq('company_id', companyId).order('name'),
      supabase.from('vehicles').select('*').eq('company_id', companyId).neq('status', 'sold'),
      supabase.from('loan_payments').select('*').eq('company_id', companyId).order('payment_date'),
    ]);

    setLoans(loansRes.data || []);
    setPartners(partnersRes.data || []);
    setVehicles(vehiclesRes.data || []);

    // Group payments by loan_id
    const paymentsByLoan: Record<string, LoanPayment[]> = {};
    (paymentsRes.data || []).forEach(payment => {
      if (!paymentsByLoan[payment.loan_id]) {
        paymentsByLoan[payment.loan_id] = [];
      }
      paymentsByLoan[payment.loan_id].push(payment);
    });
    setLoanPayments(paymentsByLoan);

    setLoading(false);
  }

  function openAddForm() {
    setEditingLoan(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(loan: Loan) {
    setEditingLoan(loan);
    setFormData({
      loan_type: loan.loan_type,
      vehicle_id: loan.vehicle_id || '',
      owner_partner_id: loan.owner_partner_id || '',
      bank: loan.bank,
      maturity_date: loan.maturity_date,
      total_amount: loan.total_amount,
      installment_count: loan.installment_count,
      payment_day: loan.payment_day,
      installment_amount: loan.installment_amount,
      total_payback_amount: loan.total_payback_amount,
      capital_name: loan.capital_name || '',
    });
    setShowForm(true);
  }

  async function generateLoanPayments(loanId: string, startDate: string, installmentCount: number, paymentDay: number, installmentAmount: number) {
    if (!companyId) return;

    const payments = [];
    const start = new Date(startDate);

    for (let i = 0; i < installmentCount; i++) {
      const paymentDate = new Date(start.getFullYear(), start.getMonth() + i, paymentDay);

      // If payment day doesn't exist in month (e.g., 31st in February), use last day of month
      if (paymentDate.getDate() !== paymentDay) {
        paymentDate.setDate(0); // Set to last day of previous month
      }

      payments.push({
        loan_id: loanId,
        payment_date: paymentDate.toISOString().split('T')[0],
        amount: installmentAmount,
        is_paid: false,
        company_id: companyId,
      });
    }

    await supabase.from('loan_payments').insert(payments);
  }

  async function handleSave() {
    if (!formData.bank || formData.total_amount <= 0 || !companyId) return;

    setSaving(true);
    const loanData = {
      loan_type: formData.loan_type,
      vehicle_id: formData.loan_type === 'vehicle' && formData.vehicle_id ? formData.vehicle_id : null,
      owner_partner_id: formData.owner_partner_id || null,
      bank: formData.bank,
      maturity_date: formData.maturity_date,
      total_amount: formData.total_amount,
      installment_count: formData.installment_count,
      payment_day: formData.payment_day,
      installment_amount: formData.installment_amount,
      total_payback_amount: formData.total_payback_amount,
      remaining_debt: editingLoan ? editingLoan.remaining_debt : formData.total_payback_amount,
      capital_name: formData.loan_type === 'capital' ? formData.capital_name : null,
      status: 'active',
      company_id: companyId,
    };

    if (editingLoan) {
      await supabase.from('loans').update(loanData).eq('id', editingLoan.id).eq('company_id', companyId);
      await logActivity({
        action: 'UPDATE',
        entity: 'Loan',
        entityId: editingLoan.id,
        details: `Kredi guncellendi: ${formData.bank} - ${formData.total_amount.toLocaleString('tr-TR')} TL`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else {
      const { data } = await supabase.from('loans').insert(loanData).select().single();

      // Generate payment schedule for new loan
      if (data?.id) {
        const today = new Date().toISOString().split('T')[0];
        await generateLoanPayments(
          data.id,
          today,
          formData.installment_count,
          formData.payment_day,
          formData.installment_amount
        );
      }

      await logActivity({
        action: 'CREATE',
        entity: 'Loan',
        entityId: data?.id,
        details: `Yeni kredi eklendi: ${formData.bank} - ${formData.total_amount.toLocaleString('tr-TR')} TL`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(loan: Loan) {
    if (!confirm('Bu krediyi silmek istediginize emin misiniz?') || !companyId) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Loan',
      entityId: loan.id,
      details: `Deleted loan: ${loan.bank} - ${formatCurrency(loan.total_amount)}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase
      .from('loans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', loan.id)
      .eq('company_id', companyId);

    loadData();
  }

  async function handleRestoreLoan(loan: Loan) {
    if (!companyId || !confirm('Bu krediyi geri yuklemek istediginizden emin misiniz?')) return;

    await logActivity({
      action: 'UPDATE',
      entity: 'Loan',
      entityId: loan.id,
      details: `Restored loan: ${loan.bank} - ${formatCurrency(loan.total_amount)}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase
      .from('loans')
      .update({ deleted_at: null })
      .eq('id', loan.id)
      .eq('company_id', companyId);

    loadData();
  }

  async function handlePayment(loan: Loan) {
    if (!companyId) return;

    // Find the first unpaid payment for this loan
    const payments = loanPayments[loan.id] || [];
    const nextUnpaidPayment = payments.find(p => !p.is_paid);

    if (nextUnpaidPayment) {
      // Mark the payment as paid
      await supabase
        .from('loan_payments')
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq('id', nextUnpaidPayment.id)
        .eq('company_id', companyId);
    }

    // Update remaining debt
    const newDebt = Math.max(0, loan.remaining_debt - loan.installment_amount);
    await supabase.from('loans').update({ remaining_debt: newDebt }).eq('id', loan.id).eq('company_id', companyId);

    // Record transaction
    await supabase.from('transactions').insert({
      type: 'expense',
      category: 'Loan Payment',
      description: `Loan payment to ${loan.bank}`,
      amount: loan.installment_amount,
      transaction_date: new Date().toISOString().split('T')[0],
      loan_id: loan.id,
      vehicle_id: loan.vehicle_id,
      company_id: companyId,
    });

    // Check if all installments are paid
    const allPayments = loanPayments[loan.id] || [];
    const allPaid = allPayments.every(p => p.is_paid || p.id === nextUnpaidPayment?.id);

    if (allPaid) {
      await supabase
        .from('loans')
        .update({ status: 'completed' })
        .eq('id', loan.id)
        .eq('company_id', companyId);

      await logActivity({
        action: 'UPDATE',
        entity: 'Loan',
        entityId: loan.id,
        details: `Kredi tamamlandi (tum taksitler odendi): ${loan.bank}`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    loadData();
  }

  function getNextDueDate(loanId: string): string | null {
    const payments = loanPayments[loanId] || [];
    const nextUnpaidPayment = payments.find(p => !p.is_paid);
    return nextUnpaidPayment?.payment_date || null;
  }

  function getNextDueDateColor(dueDate: string | null): string {
    if (!dueDate) return 'text-slate-600';

    const days = getDaysUntil(dueDate);
    if (days < 0) return 'text-red-600 font-bold'; // Overdue
    if (days <= 5) return 'text-orange-600 font-semibold'; // Due soon
    return 'text-slate-600'; // Future
  }

  // Filter loans by both viewMode and loanStatusFilter
  const filteredLoans = loans.filter(loan => {
    // viewMode filter is already applied in loadData() via the query
    // This additional filter is not needed since we filter at query level
    return true;
  });

  const totalMonthlyPayments = filteredLoans.reduce((sum, l) => sum + l.installment_amount, 0);
  const totalLoans = filteredLoans.reduce((sum, l) => sum + l.total_amount, 0);
  const totalRemainingDebt = filteredLoans.reduce((sum, l) => sum + l.remaining_debt, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Krediler</h1>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Kredi Ekle
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-1">Aylik Odemeler</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalMonthlyPayments)} TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-1">Alinan Toplam Kredi</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalLoans)} TL</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-1">Kalan Toplam Borc</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalRemainingDebt)} TL</p>
        </div>
      </div>

      {/* Loan Status Filter - Primary filter */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setLoanStatusFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            loanStatusFilter === 'active'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Aktif Krediler
        </button>
        <button
          onClick={() => setLoanStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            loanStatusFilter === 'completed'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Kapanan Krediler
        </button>
      </div>

      {/* Soft Delete Filter - Secondary filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'active'
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Aktif
        </button>
        <button
          onClick={() => setViewMode('trash')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === 'trash'
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Silinenler
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tip</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Arac/Sermaye</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Sahip</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Banka</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Aylik Taksit</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Siradaki Vade</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Toplam Kredi</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Kalan</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.map((l) => {
                  const vehicle = vehicles.find(v => v.id === l.vehicle_id);
                  const partner = partners.find(p => p.id === l.owner_partner_id);
                  const nextDueDate = getNextDueDate(l.id);
                  const dueDateColor = getNextDueDateColor(nextDueDate);

                  return (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          l.loan_type === 'vehicle' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {l.loan_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {l.loan_type === 'vehicle' ? (vehicle?.plate || '-') : (l.capital_name || 'Capital')}
                      </td>
                      <td className="py-3 px-4">{partner?.name || '-'}</td>
                      <td className="py-3 px-4">{l.bank}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(l.installment_amount)} TL</td>
                      <td className={`py-3 px-4 ${dueDateColor}`}>
                        {nextDueDate ? formatDate(nextDueDate) : 'Bitti'}
                      </td>
                      <td className="py-3 px-4 text-right">{formatCurrency(l.total_amount)} TL</td>
                      <td className="py-3 px-4 text-right font-medium text-red-600">
                        {formatCurrency(l.remaining_debt)} TL
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {viewMode === 'active' ? (
                            <>
                              {l.remaining_debt > 0 && loanStatusFilter === 'active' && (
                                <Button size="sm" variant="ghost" onClick={() => handlePayment(l)}>
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Ode
                                </Button>
                              )}
                              <button
                                onClick={() => openEditForm(l)}
                                className="p-1.5 hover:bg-slate-100 rounded"
                              >
                                <Edit2 className="h-4 w-4 text-slate-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(l)}
                                className="p-1.5 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleRestoreLoan(l)}
                              className="p-1.5 hover:bg-teal-50 rounded flex items-center gap-1 text-teal-600"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Geri Yukle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredLoans.length === 0 && (
              <p className="text-center py-8 text-slate-500">Kredi bulunamadi</p>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingLoan ? 'Kredi Duzenle' : 'Kredi Ekle'}
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Kredi Tipi *"
            value={formData.loan_type}
            onChange={(e) => setFormData({ ...formData, loan_type: e.target.value as 'vehicle' | 'capital' })}
            options={[
              { value: 'vehicle', label: 'Arac Kredisi' },
              { value: 'capital', label: 'Sermaye/Isletme Kredisi' },
            ]}
          />

          {formData.loan_type === 'vehicle' ? (
            <Select
              label="Arac"
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              options={[
                { value: '', label: 'Arac secin...' },
                ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })),
              ]}
            />
          ) : (
            <Input
              label="Sermaye/Kredi Adi"
              value={formData.capital_name}
              onChange={(e) => setFormData({ ...formData, capital_name: e.target.value })}
              placeholder="Ornegin: Isletme Genisleme Kredisi"
            />
          )}

          <Select
            label="Sahip Ortak"
            value={formData.owner_partner_id}
            onChange={(e) => setFormData({ ...formData, owner_partner_id: e.target.value })}
            options={[
              { value: '', label: 'Yok' },
              ...partners.map(p => ({ value: p.id, label: p.name })),
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Banka *"
              value={formData.bank}
              onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
            />
            <Input
              label="Vade Tarihi"
              type="date"
              value={formData.maturity_date}
              onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              label="Toplam Kredi Tutari *"
              value={formData.total_amount}
              onChange={(v) => setFormData({ ...formData, total_amount: v })}
            />
            <Input
              label="Taksit Sayisi"
              type="number"
              value={formData.installment_count}
              onChange={(e) => setFormData({ ...formData, installment_count: parseInt(e.target.value) || 12 })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Odeme Gunu (1-31)"
              type="number"
              min={1}
              max={31}
              value={formData.payment_day}
              onChange={(e) => setFormData({ ...formData, payment_day: parseInt(e.target.value) || 1 })}
            />
            <CurrencyInput
              label="Aylik Taksit Tutari"
              value={formData.installment_amount}
              onChange={(v) => setFormData({ ...formData, installment_amount: v })}
            />
          </div>

          <CurrencyInput
            label="Toplam Geri Odeme Tutari"
            value={formData.total_payback_amount}
            onChange={(v) => setFormData({ ...formData, total_payback_amount: v })}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingLoan ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
