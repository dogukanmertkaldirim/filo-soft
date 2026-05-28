import { useState, useEffect } from 'react';
import { CreditCard, Banknote, Building2, FileText, Receipt, Plus, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Customer, BankAccount, PaymentCard, PaymentMethod } from '../../types/database';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import CurrencyInput from '../ui/CurrencyInput';
import { formatCurrency, formatCustomerLabel } from '../../utils/format';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: string;
  preselectedCustomerId?: string;
  preselectedRentalId?: string;
  preselectedAmount?: number;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { value: 'transfer', label: 'Havale/EFT', icon: Building2 },
  { value: 'credit_card_online', label: 'Online Kredi Karti', icon: CreditCard },
  { value: 'credit_card_physical', label: 'Fiziksel Kredi Karti', icon: CreditCard },
  { value: 'cash', label: 'Nakit', icon: Banknote },
  { value: 'check', label: 'Cek', icon: FileText },
  { value: 'promissory_note', label: 'Senet', icon: Receipt },
];

export default function AddPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  preselectedCustomerId,
  preselectedRentalId,
  preselectedAmount,
}: AddPaymentModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [customerCards, setCustomerCards] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: preselectedCustomerId || '',
    rental_id: preselectedRentalId || '',
    amount: preselectedAmount || 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'transfer' as PaymentMethod,
    transaction_reference: '',
    bank_account_id: '',
    check_number: '',
    check_due_date: '',
    check_bank_name: '',
    selected_card_id: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && companyId) {
      loadData();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (formData.customer_id && formData.payment_method === 'credit_card_online') {
      loadCustomerCards(formData.customer_id);
    }
  }, [formData.customer_id, formData.payment_method]);

  useEffect(() => {
    if (preselectedCustomerId) {
      setFormData(prev => ({ ...prev, customer_id: preselectedCustomerId }));
    }
    if (preselectedRentalId) {
      setFormData(prev => ({ ...prev, rental_id: preselectedRentalId }));
    }
    if (preselectedAmount) {
      setFormData(prev => ({ ...prev, amount: preselectedAmount }));
    }
  }, [preselectedCustomerId, preselectedRentalId, preselectedAmount]);

  async function loadData() {
    setLoading(true);
    const [customersRes, bankAccountsRes] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', companyId).order('company_title'),
      supabase.from('bank_accounts').select('*').eq('company_id', companyId).eq('is_active', true).is('deleted_at', null).order('bank_name'),
    ]);
    setCustomers(customersRes.data || []);
    setBankAccounts(bankAccountsRes.data || []);
    setLoading(false);
  }

  async function loadCustomerCards(customerId: string) {
    const { data } = await supabase
      .from('payment_cards')
      .select('*')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false });
    setCustomerCards(data || []);
  }

  async function handleSave() {
    if (!formData.customer_id || !formData.amount || !formData.payment_date) {
      alert('Lutfen zorunlu alanlari doldurun');
      return;
    }

    if (formData.payment_method === 'check' || formData.payment_method === 'promissory_note') {
      if (!formData.check_number || !formData.check_due_date) {
        alert('Cek/Senet bilgilerini doldurun');
        return;
      }
    }

    if (formData.payment_method === 'transfer' && !formData.bank_account_id) {
      alert('Hedef banka hesabini secin');
      return;
    }

    setSaving(true);

    const paymentData = {
      company_id: companyId,
      customer_id: formData.customer_id,
      rental_id: formData.rental_id || null,
      amount: formData.amount,
      payment_date: formData.payment_date,
      payment_method: formData.payment_method,
      transaction_reference: formData.transaction_reference || null,
      bank_account_id: formData.bank_account_id || null,
      check_number: formData.payment_method === 'check' || formData.payment_method === 'promissory_note'
        ? formData.check_number : null,
      check_due_date: formData.payment_method === 'check' || formData.payment_method === 'promissory_note'
        ? formData.check_due_date : null,
      check_bank_name: formData.payment_method === 'check' || formData.payment_method === 'promissory_note'
        ? formData.check_bank_name : null,
      check_status: formData.payment_method === 'check' || formData.payment_method === 'promissory_note'
        ? 'pending' : null,
      notes: formData.notes || null,
    };

    const { error } = await supabase.from('payments').insert(paymentData);

    if (error) {
      console.error('Payment save error:', error.message);
      alert('Odeme kaydedilirken bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    if (formData.payment_method === 'credit_card_online' && formData.selected_card_id) {
      await supabase.from('payment_transactions').insert({
        company_id: companyId,
        customer_id: formData.customer_id,
        payment_card_id: formData.selected_card_id,
        amount: formData.amount,
        status: 'success',
        provider: customerCards.find(c => c.id === formData.selected_card_id)?.provider || 'paytr',
        provider_transaction_id: `MOCK_${Date.now()}`,
      });
    }

    setSaving(false);
    resetForm();
    onSuccess();
    onClose();
  }

  function resetForm() {
    setFormData({
      customer_id: '',
      rental_id: '',
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'transfer',
      transaction_reference: '',
      bank_account_id: '',
      check_number: '',
      check_due_date: '',
      check_bank_name: '',
      selected_card_id: '',
      notes: '',
    });
    setCustomerCards([]);
  }

  const isCheckOrNote = formData.payment_method === 'check' || formData.payment_method === 'promissory_note';
  const isOnlineCard = formData.payment_method === 'credit_card_online';
  const isTransfer = formData.payment_method === 'transfer';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Odeme Ekle" size="lg">
      <div className="space-y-5">
        <Select
          label="Musteri *"
          value={formData.customer_id}
          onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
          options={[
            { value: '', label: 'Musteri secin...' },
            ...customers.map(c => ({ value: c.id, label: formatCustomerLabel(c) })),
          ]}
        />

        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput
            label="Tutar *"
            value={formData.amount}
            onChange={(value) => setFormData({ ...formData, amount: value })}
          />
          <Input
            label="Odeme Tarihi *"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Odeme Yontemi *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_method: option.value })}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all ${
                    formData.payment_method === option.value
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {isTransfer && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">Banka Hesabi</span>
            </div>
            <Select
              label="Hedef Banka Hesabi *"
              value={formData.bank_account_id}
              onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
              options={[
                { value: '', label: 'Hesap secin...' },
                ...bankAccounts.map(b => ({
                  value: b.id,
                  label: `${b.bank_name} - ${b.account_name} (${b.iban.slice(-4)})`,
                })),
              ]}
            />
            <Input
              label="Aciklama / Referans"
              value={formData.transaction_reference}
              onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
              placeholder="Transfer aciklamasi veya dekont no"
              className="mt-3"
            />
          </div>
        )}

        {isCheckOrNote && (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-900">
                {formData.payment_method === 'check' ? 'Cek Bilgileri' : 'Senet Bilgileri'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={formData.payment_method === 'check' ? 'Cek No *' : 'Senet No *'}
                value={formData.check_number}
                onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
              />
              <Input
                label="Vade Tarihi *"
                type="date"
                value={formData.check_due_date}
                onChange={(e) => setFormData({ ...formData, check_due_date: e.target.value })}
              />
            </div>
            <Input
              label="Banka Adi"
              value={formData.check_bank_name}
              onChange={(e) => setFormData({ ...formData, check_bank_name: e.target.value })}
              placeholder="Cek/Senet kesildigini banka"
              className="mt-3"
            />
          </div>
        )}

        {isOnlineCard && (
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-900">Kayitli Kartlar</span>
            </div>
            {!formData.customer_id ? (
              <p className="text-sm text-purple-600">Once musteri secin</p>
            ) : customerCards.length === 0 ? (
              <div className="text-center py-4">
                <Wallet className="h-8 w-8 text-purple-300 mx-auto mb-2" />
                <p className="text-sm text-purple-600 mb-2">Bu musterinin kayitli karti yok</p>
                <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                  <Plus className="h-4 w-4" />
                  Kart Ekle (Simdilik Devre Disi)
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {customerCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, selected_card_id: card.id })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                      formData.selected_card_id === card.id
                        ? 'bg-purple-100 border-purple-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-7 rounded flex items-center justify-center ${
                      card.card_brand === 'visa' ? 'bg-blue-600' :
                      card.card_brand === 'mastercard' ? 'bg-red-500' : 'bg-slate-600'
                    }`}>
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-slate-900">
                        {card.card_alias || `**** ${card.last_four_digits}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        **** **** **** {card.last_four_digits} - {card.provider.toUpperCase()}
                      </p>
                    </div>
                    {card.is_default && (
                      <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded">Varsayilan</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {formData.payment_method === 'credit_card_physical' && (
          <Input
            label="Onay Kodu / Referans"
            value={formData.transaction_reference}
            onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
            placeholder="POS onay kodu"
          />
        )}

        {formData.payment_method === 'cash' && (
          <Input
            label="Makbuz No (Opsiyonel)"
            value={formData.transaction_reference}
            onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
            placeholder="Nakit tahsilat makbuz numarasi"
          />
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Odeme hakkinda notlar..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={onClose}>
            Iptal
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Odemeyi Kaydet
          </Button>
        </div>
      </div>
    </Modal>
  );
}
