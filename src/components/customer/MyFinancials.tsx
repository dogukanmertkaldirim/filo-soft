import { useState, useEffect } from 'react';
import { Wallet, Check, Clock, Upload, X, Receipt, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';

interface FinancialItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'rental' | 'expense';
  status: 'paid' | 'unpaid';
  rentalId?: string;
  expenseId?: string;
  receiptUrl?: string;
}

interface Props {
  userId: string;
  vehicleIds: string[];
  companyId: string;
}

export default function MyFinancials({ userId, vehicleIds, companyId }: Props) {
  const [items, setItems] = useState<FinancialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinancialItem | null>(null);

  useEffect(() => {
    loadFinancials();
  }, [vehicleIds, companyId]);

  async function loadFinancials() {
    if (vehicleIds.length === 0) {
      setLoading(false);
      return;
    }

    const financialItems: FinancialItem[] = [];

    const { data: rentals } = await supabase
      .from('rentals')
      .select('id, start_date, end_date, total_amount, status')
      .in('vehicle_id', vehicleIds)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });

    if (rentals) {
      for (const rental of rentals) {
        const { data: payments } = await supabase
          .from('transactions')
          .select('amount')
          .eq('rental_id', rental.id)
          .eq('type', 'income')
          .eq('company_id', companyId);

        const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const isPaid = totalPaid >= rental.total_amount;

        const { data: receipt } = await supabase
          .from('customer_receipts')
          .select('receipt_url')
          .eq('rental_id', rental.id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        financialItems.push({
          id: `rental-${rental.id}`,
          date: rental.start_date,
          description: `Kiralama Ucreti (${new Date(rental.start_date).toLocaleDateString('tr-TR')} - ${new Date(rental.end_date).toLocaleDateString('tr-TR')})`,
          amount: rental.total_amount,
          type: 'rental',
          status: isPaid ? 'paid' : 'unpaid',
          rentalId: rental.id,
          receiptUrl: receipt?.receipt_url,
        });
      }
    }

    const rentalIds = rentals?.map(r => r.id) || [];
    if (rentalIds.length > 0) {
      const { data: expenses } = await supabase
        .from('rental_expenses')
        .select('id, rental_id, expense_type, amount, expense_date, billable_to_customer')
        .in('rental_id', rentalIds)
        .eq('company_id', companyId)
        .eq('billable_to_customer', true)
        .order('expense_date', { ascending: false });

      if (expenses) {
        for (const expense of expenses) {
          const { data: receipt } = await supabase
            .from('customer_receipts')
            .select('receipt_url')
            .eq('rental_expense_id', expense.id)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          financialItems.push({
            id: `expense-${expense.id}`,
            date: expense.expense_date,
            description: getExpenseLabel(expense.expense_type),
            amount: expense.amount,
            type: 'expense',
            status: 'unpaid',
            rentalId: expense.rental_id,
            expenseId: expense.id,
            receiptUrl: receipt?.receipt_url,
          });
        }
      }
    }

    financialItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(financialItems);
    setLoading(false);
  }

  function getExpenseLabel(type: string) {
    switch (type) {
      case 'hgs':
        return 'HGS Gecis Ucreti';
      case 'traffic_fine':
        return 'Trafik Cezasi';
      case 'bridge_toll':
        return 'Kopru/Otoyol Ucreti';
      case 'damage_repair':
        return 'Hasar Onarimi';
      default:
        return 'Diger Masraf';
    }
  }

  async function handleReceiptUpload(file: File) {
    if (!selectedItem) return;

    setUploadingId(selectedItem.id);

    const fileExt = file.name.split('.').pop();
    const fileName = `receipt-${Date.now()}.${fileExt}`;
    const filePath = `customer-receipts/${companyId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      setUploadingId(null);
      return;
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

    await supabase.from('customer_receipts').insert({
      company_id: companyId,
      user_id: userId,
      rental_id: selectedItem.rentalId || null,
      rental_expense_id: selectedItem.expenseId || null,
      receipt_url: urlData.publicUrl,
      description: `Dekont - ${selectedItem.description}`,
    });

    setShowUploadModal(false);
    setSelectedItem(null);
    setUploadingId(null);
    loadFinancials();
  }

  const totalUnpaid = items.filter(i => i.status === 'unpaid').reduce((sum, i) => sum + i.amount, 0);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3"></div>
          <div className="h-24 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Finanslarim</h2>
              <p className="text-sm text-slate-500">{items.length} islem</p>
            </div>
          </div>

          {totalUnpaid > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700">Toplam Odenmemis</p>
                  <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalUnpaid)}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-400" />
              </div>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Finansal islem bulunmuyor</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    item.type === 'rental' ? 'bg-teal-100 text-teal-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {item.type === 'rental' ? <FileText className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.description}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.amount)}</p>
                    {item.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Check className="h-3 w-3" /> Odendi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <Clock className="h-3 w-3" /> Odenmedi
                      </span>
                    )}
                  </div>
                </div>

                {item.status === 'unpaid' && (
                  <div className="mt-3 flex items-center gap-2">
                    {item.receiptUrl ? (
                      <a
                        href={item.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg"
                      >
                        <Check className="h-4 w-4" />
                        Dekont Yuklendi
                      </a>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedItem(item);
                          setShowUploadModal(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-100 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Dekont Yukle
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showUploadModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Dekont Yukle</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedItem(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">
                {selectedItem.description} icin odeme dekontunuzu yukleyin.
              </p>
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 transition-colors">
                <Upload className="h-10 w-10 text-slate-400 mb-3" />
                <span className="text-sm text-slate-600 font-medium">
                  {uploadingId === selectedItem.id ? 'Yukleniyor...' : 'Dekont Sec'}
                </span>
                <span className="text-xs text-slate-500 mt-1">PNG, JPG veya PDF</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReceiptUpload(file);
                  }}
                  className="hidden"
                  disabled={uploadingId === selectedItem.id}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
