import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, TrendingUp, TrendingDown, Wallet, FileSpreadsheet, CreditCard, FileText, Clock, CheckCircle, XCircle, AlertTriangle, Banknote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Transaction, Vehicle, Payment, PaymentTransaction, Customer } from '../types/database';
import { formatCurrency, formatDate, formatVehicleLabel } from '../utils/format';
import { exportToExcel } from '../utils/exportExcel';
import { logActivity, formatTransactionDetails } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';
import Pagination from '../components/ui/Pagination';
import AddPaymentModal from '../components/finance/AddPaymentModal';
import InvoicesTab from '../components/finance/InvoicesTab';
import CompanyExpenses from '../components/finance/CompanyExpenses';

interface TransactionFormData {
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  transaction_date: string;
  vehicle_id: string;
}

const incomeCategories = [
  { value: 'Rental Income', label: 'Kira Geliri' },
  { value: 'Capital Injection', label: 'Sermaye Girisi' },
  { value: 'Vehicle Sale', label: 'Arac Satisi' },
  { value: 'External Service', label: 'Dis Hizmet' },
  { value: 'Other Income', label: 'Diger Gelir' },
];

const expenseCategories = [
  { value: 'Vehicle Purchase', label: 'Arac Alimi' },
  { value: 'Fuel', label: 'Yakit' },
  { value: 'Maintenance', label: 'Bakim' },
  { value: 'Insurance', label: 'Sigorta' },
  { value: 'Loan Payment', label: 'Kredi Odemesi' },
  { value: 'Office Expense', label: 'Ofis Gideri' },
  { value: 'Salary', label: 'Maas' },
  { value: 'External Service Cost', label: 'Dis Hizmet Maliyeti' },
  { value: 'Other Expense', label: 'Diger Gider' },
];

interface PendingCheck extends Payment {
  customer?: Customer;
}

interface TransactionLog extends PaymentTransaction {
  customer?: Customer;
}

export default function Finance() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pendingChecks, setPendingChecks] = useState<PendingCheck[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'payments' | 'invoices' | 'expenses'>('transactions');

  const pagination = usePagination(20);

  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'income',
    category: '',
    description: '',
    amount: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadSupportingData();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, filterType, filterCategory, pagination.page, pagination.pageSize]);

  useEffect(() => {
    pagination.reset();
  }, [filterType, filterCategory]);

  async function loadSupportingData() {
    if (!companyId) return;

    const [vehiclesRes, allTransRes, customersRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', companyId).is('deleted_at', null),
      supabase.from('transactions').select('type, amount').eq('company_id', companyId),
      supabase.from('customers').select('*').eq('company_id', companyId).order('company_title'),
    ]);
    setVehicles(vehiclesRes.data || []);
    setAllTransactions(allTransRes.data || []);
    setCustomers(customersRes.data || []);

    loadPendingChecks();
    loadTransactionLogs();
  }

  async function loadPendingChecks() {
    if (!companyId) return;

    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('company_id', companyId)
      .in('payment_method', ['check', 'promissory_note'])
      .eq('check_status', 'pending')
      .is('deleted_at', null)
      .order('check_due_date', { ascending: true })
      .limit(10);

    if (data) {
      const checksWithCustomers = data.map(check => ({
        ...check,
        customer: customers.find(c => c.id === check.customer_id),
      }));
      setPendingChecks(checksWithCustomers);
    }
  }

  async function loadTransactionLogs() {
    if (!companyId) return;

    const { data } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      const logsWithCustomers = data.map(log => ({
        ...log,
        customer: customers.find(c => c.id === log.customer_id),
      }));
      setTransactionLogs(logsWithCustomers);
    }
  }

  async function handleCheckStatusChange(paymentId: string, newStatus: 'cleared' | 'bounced') {
    if (!companyId) return;

    await supabase
      .from('payments')
      .update({ check_status: newStatus })
      .eq('id', paymentId)
      .eq('company_id', companyId);

    await logActivity({
      action: 'UPDATE',
      entity: 'Payment',
      entityId: paymentId,
      details: `Cek/Senet durumu guncellendi: ${newStatus === 'cleared' ? 'Tahsil Edildi' : 'Karsilliksiz'}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    loadPendingChecks();
  }

  async function loadData() {
    if (!companyId) return;

    setLoading(true);

    let transQuery = supabase.from('transactions').select('*', { count: 'exact' }).eq('company_id', companyId);

    if (filterType !== 'all') {
      transQuery = transQuery.eq('type', filterType);
    }

    if (filterCategory) {
      transQuery = transQuery.eq('category', filterCategory);
    }

    transQuery = transQuery
      .order('transaction_date', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    const transRes = await transQuery;

    setTransactions(transRes.data || []);
    pagination.setTotalCount(transRes.count || 0);
    setLoading(false);
  }

  function openAddForm(type: 'income' | 'expense') {
    setEditingTransaction(null);
    setFormData({
      type,
      category: '',
      description: '',
      amount: 0,
      transaction_date: new Date().toISOString().split('T')[0],
      vehicle_id: '',
    });
    setShowForm(true);
  }

  function openEditForm(transaction: Transaction) {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description || '',
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      vehicle_id: transaction.vehicle_id || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.category || formData.amount <= 0 || !companyId) return;

    setSaving(true);
    const transactionData = {
      type: formData.type,
      category: formData.category,
      description: formData.description || null,
      amount: formData.amount,
      transaction_date: formData.transaction_date,
      vehicle_id: formData.vehicle_id || null,
      company_id: companyId,
    };

    const typeLabel = formData.type === 'income' ? 'Gelir' : 'Gider';

    if (editingTransaction) {
      await supabase.from('transactions').update(transactionData).eq('id', editingTransaction.id).eq('company_id', companyId);
      await logActivity({
        action: 'UPDATE',
        entity: 'Transaction',
        entityId: editingTransaction.id,
        details: `Islem guncellendi: ${typeLabel} - ${formData.amount.toLocaleString('tr-TR')} TL`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else {
      const { data } = await supabase.from('transactions').insert(transactionData).select().single();
      await logActivity({
        action: 'CREATE',
        entity: 'Transaction',
        entityId: data?.id,
        details: `Yeni islem eklendi: ${typeLabel} - ${formData.amount.toLocaleString('tr-TR')} TL`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(transaction: Transaction) {
    if (!confirm('Bu islemi silmek istediginize emin misiniz?') || !companyId) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Transaction',
      entityId: transaction.id,
      details: formatTransactionDetails(transaction),
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase.from('transactions').delete().eq('id', transaction.id).eq('company_id', companyId);
    loadData();
  }

  const filteredTransactions = transactions;

  const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = allTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const categories = formData.type === 'income' ? incomeCategories : expenseCategories;

  function getCategoryLabel(value: string): string {
    const income = incomeCategories.find(c => c.value === value);
    if (income) return income.label;
    const expense = expenseCategories.find(c => c.value === value);
    if (expense) return expense.label;
    return value;
  }

  function handleExportTransactions() {
    const exportData = filteredTransactions.map(t => ({
      ...t,
      type_label: t.type === 'income' ? 'Gelir' : 'Gider',
      category_label: getCategoryLabel(t.category),
      vehicle_plate: vehicles.find(v => v.id === t.vehicle_id)?.plate || '',
    }));

    const columns = [
      { key: 'transaction_date' as const, header: 'Tarih' },
      { key: 'type_label' as const, header: 'Tip' },
      { key: 'category_label' as const, header: 'Kategori' },
      { key: 'description' as const, header: 'Aciklama' },
      { key: 'amount' as const, header: 'Tutar' },
      { key: 'vehicle_plate' as const, header: 'Arac' },
    ];
    exportToExcel(exportData, columns, 'Finans_Islemleri');
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Nakit',
      credit_card_online: 'Online Kart',
      credit_card_physical: 'Fiziksel Kart',
      transfer: 'Havale/EFT',
      check: 'Cek',
      promissory_note: 'Senet',
    };
    return labels[method] || method;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Finans</h1>
        {activeTab === 'transactions' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleExportTransactions} className="flex-1 sm:flex-none">
              <FileSpreadsheet className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Excel'e Aktar</span>
            </Button>
            <Button onClick={() => setShowPaymentModal(true)} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700">
              <Banknote className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Tahsilat Ekle</span>
              <span className="sm:hidden">Tahsilat</span>
            </Button>
            <Button onClick={() => openAddForm('income')} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Gelir Ekle</span>
              <span className="sm:hidden">Gelir</span>
            </Button>
            <Button variant="secondary" onClick={() => openAddForm('expense')} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Gider Ekle</span>
              <span className="sm:hidden">Gider</span>
            </Button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Gelir / Gider
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'invoices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Faturalar
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'expenses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sirket Giderleri
        </button>
      </div>

      {activeTab === 'invoices' && <InvoicesTab />}

      {activeTab === 'expenses' && <CompanyExpenses />}

      {activeTab === 'transactions' && (<>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-slate-500">Toplam Gelir</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)} TL</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm text-slate-500">Toplam Gider</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)} TL</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Wallet className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-sm text-slate-500">Nakit Akisi (Bakiye)</span>
          </div>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
            {formatCurrency(balance)} TL
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            options={[
              { value: 'all', label: 'Tum Tipler' },
              { value: 'income', label: 'Gelir' },
              { value: 'expense', label: 'Gider' },
            ]}
          />
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={[
              { value: '', label: 'Tum Kategoriler' },
              ...incomeCategories,
              ...expenseCategories,
            ]}
          />
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
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tarih</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tip</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Kategori</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Aciklama</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Tutar</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => {
                  const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                  return (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">{formatDate(t.transaction_date)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            t.type === 'income'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {t.type === 'income' ? 'Gelir' : 'Gider'}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getCategoryLabel(t.category)}</td>
                      <td className="py-3 px-4">
                        {t.description || '-'}
                        {vehicle && <span className="text-xs text-slate-500 ml-1">({vehicle.plate})</span>}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)} TL
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditForm(t)}
                            className="p-1.5 hover:bg-slate-100 rounded"
                          >
                            <Edit2 className="h-4 w-4 text-slate-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="p-1.5 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredTransactions.length === 0 && !loading && (
              <p className="text-center py-8 text-slate-500">Islem bulunamadi</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900">Bekleyen Cekler / Senetler</h3>
              {pendingChecks.length > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  {pendingChecks.length}
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {pendingChecks.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Bekleyen cek/senet yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingChecks.map((check) => {
                  const dueDate = new Date(check.check_due_date || '');
                  const today = new Date();
                  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysUntilDue < 0;
                  const isUrgent = daysUntilDue >= 0 && daysUntilDue <= 7;

                  return (
                    <div
                      key={check.id}
                      className={`p-3 rounded-lg border ${
                        isOverdue ? 'bg-red-50 border-red-200' :
                        isUrgent ? 'bg-amber-50 border-amber-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            check.payment_method === 'check' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {check.payment_method === 'check' ? 'Cek' : 'Senet'}
                          </span>
                          <span className="text-sm font-medium text-slate-900">
                            {check.check_number}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(check.amount)} TL
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          {customers.find(c => c.id === check.customer_id)?.company_title || '-'}
                        </span>
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                          <span className={isOverdue ? 'text-red-600 font-medium' : isUrgent ? 'text-amber-600' : 'text-slate-500'}>
                            {formatDate(check.check_due_date || '')}
                            {isOverdue && ' (Gecmis!)'}
                            {isUrgent && !isOverdue && ` (${daysUntilDue} gun)`}
                          </span>
                        </div>
                      </div>
                      {check.check_bank_name && (
                        <p className="text-xs text-slate-400 mt-1">{check.check_bank_name}</p>
                      )}
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => handleCheckStatusChange(check.id, 'cleared')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Tahsil Edildi
                        </button>
                        <button
                          onClick={() => handleCheckStatusChange(check.id, 'bounced')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <XCircle className="h-3 w-3" />
                          Karsilliksiz
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-slate-900">Online Islemler</h3>
            </div>
          </div>
          <div className="p-4">
            {transactionLogs.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Henuz online islem yapilmadi</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactionLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.status === 'success' ? 'bg-green-50 border-green-200' :
                      log.status === 'failed' ? 'bg-red-50 border-red-200' :
                      'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {log.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                        {log.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                        {log.status === 'pending_3d' && <Clock className="h-4 w-4 text-amber-600" />}
                        <span className={`text-sm font-medium ${
                          log.status === 'success' ? 'text-green-700' :
                          log.status === 'failed' ? 'text-red-700' :
                          'text-amber-700'
                        }`}>
                          {log.status === 'success' ? 'Basarili' :
                           log.status === 'failed' ? 'Basarisiz' : '3D Bekliyor'}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(log.amount)} TL
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{customers.find(c => c.id === log.customer_id)?.company_title || '-'}</span>
                      <span>{log.provider?.toUpperCase()}</span>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                    {log.provider_transaction_id && (
                      <p className="text-xs text-slate-400 mt-1">Ref: {log.provider_transaction_id}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      </>)}

      <AddPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          loadSupportingData();
          loadData();
        }}
        companyId={companyId || ''}
      />

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingTransaction ? 'Islem Duzenle' : `${formData.type === 'income' ? 'Gelir' : 'Gider'} Ekle`}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Kategori *"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            options={[
              { value: '', label: 'Kategori secin...' },
              ...categories,
            ]}
          />
          <Input
            label="Aciklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <CurrencyInput
            label="Tutar *"
            value={formData.amount}
            onChange={(v) => setFormData({ ...formData, amount: v })}
          />
          <Input
            label="Tarih"
            type="date"
            value={formData.transaction_date}
            onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
          />
          <Select
            label="Ilgili Arac"
            value={formData.vehicle_id}
            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
            options={[
              { value: '', label: 'Yok' },
              ...vehicles.map(v => ({ value: v.id, label: formatVehicleLabel(v) })),
            ]}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingTransaction ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
