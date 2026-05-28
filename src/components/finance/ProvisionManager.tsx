import { useState, useEffect } from 'react';
import { Plus, Shield, CheckCircle, XCircle, AlertTriangle, CreditCard, Banknote, Building2, Unlock, Lock, ArrowDownToLine, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Provision, ProvisionStatus, ProvisionPaymentMethod, Rental, Customer } from '../../types/database';
import { logActivity } from '../../utils/auditLog';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import CurrencyInput from '../ui/CurrencyInput';
import { formatCurrency, formatDate } from '../../utils/format';

interface ProvisionManagerProps {
  rental: Rental;
  customer: Customer;
  companyId: string;
  userEmail?: string | null;
  onUpdate?: () => void;
}

const PAYMENT_METHODS: { value: ProvisionPaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { value: 'credit_card', label: 'Kredi Karti', icon: CreditCard },
  { value: 'cash', label: 'Nakit', icon: Banknote },
  { value: 'transfer', label: 'Havale/EFT', icon: Building2 },
];

export default function ProvisionManager({ rental, customer, companyId, userEmail, onUpdate }: ProvisionManagerProps) {
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [selectedProvision, setSelectedProvision] = useState<Provision | null>(null);
  const [saving, setSaving] = useState(false);

  const [newProvision, setNewProvision] = useState({
    amount: rental.deposit_amount || 0,
    payment_method: 'credit_card' as ProvisionPaymentMethod,
    provider_ref: '',
    notes: '',
  });

  const [captureData, setCaptureData] = useState({
    capture_amount: 0,
    capture_reason: '',
    full_capture: false,
  });

  useEffect(() => {
    loadProvisions();
  }, [rental.id]);

  async function loadProvisions() {
    setLoading(true);
    const { data } = await supabase
      .from('provisions')
      .select('*')
      .eq('rental_id', rental.id)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setProvisions(data || []);
    setLoading(false);
  }

  async function handleAddProvision() {
    if (newProvision.amount <= 0) {
      alert('Gecerli bir tutar girin');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('provisions').insert({
      rental_id: rental.id,
      customer_id: rental.customer_id,
      company_id: companyId,
      amount: newProvision.amount,
      payment_method: newProvision.payment_method,
      provider_ref: newProvision.provider_ref || null,
      notes: newProvision.notes || null,
      status: 'active',
      created_by: userEmail,
    });

    if (error) {
      console.error('Provision create error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    } else {
      await logActivity({
        action: 'CREATE',
        entity: 'Provision',
        entityId: rental.id,
        details: `Provizyon eklendi: ${formatCurrency(newProvision.amount)} TL`,
        userEmail,
        companyId,
      });
      setShowAddModal(false);
      setNewProvision({
        amount: rental.deposit_amount || 0,
        payment_method: 'credit_card',
        provider_ref: '',
        notes: '',
      });
      loadProvisions();
      onUpdate?.();
    }
    setSaving(false);
  }

  async function handleRelease(provision: Provision) {
    if (!confirm('Bu provizyonu iade etmek istediginize emin misiniz?')) return;

    setSaving(true);

    const { error } = await supabase
      .from('provisions')
      .update({
        status: 'released',
        release_amount: provision.amount,
        released_at: new Date().toISOString(),
      })
      .eq('id', provision.id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Provision refund error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    } else {
      await logActivity({
        action: 'UPDATE',
        entity: 'Provision',
        entityId: provision.id,
        details: `Provizyon iade edildi: ${formatCurrency(provision.amount)} TL`,
        userEmail,
        companyId,
      });
      loadProvisions();
      onUpdate?.();
    }
    setSaving(false);
  }

  function openCaptureModal(provision: Provision) {
    setSelectedProvision(provision);
    setCaptureData({
      capture_amount: provision.amount,
      capture_reason: '',
      full_capture: true,
    });
    setShowCaptureModal(true);
  }

  async function handleCapture() {
    if (!selectedProvision) return;

    if (captureData.capture_amount <= 0 || captureData.capture_amount > selectedProvision.amount) {
      alert('Gecerli bir kesinti tutari girin');
      return;
    }

    if (!captureData.capture_reason.trim()) {
      alert('Kesinti sebebi girin');
      return;
    }

    setSaving(true);

    const isPartial = captureData.capture_amount < selectedProvision.amount;
    const releaseAmount = isPartial ? selectedProvision.amount - captureData.capture_amount : 0;

    const { error } = await supabase
      .from('provisions')
      .update({
        status: isPartial ? 'partial_captured' : 'captured',
        capture_amount: captureData.capture_amount,
        release_amount: releaseAmount,
        capture_reason: captureData.capture_reason,
        captured_at: new Date().toISOString(),
        released_at: isPartial ? new Date().toISOString() : null,
      })
      .eq('id', selectedProvision.id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Provision deduction error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    } else {
      await logActivity({
        action: 'UPDATE',
        entity: 'Provision',
        entityId: selectedProvision.id,
        details: `Provizyondan kesinti yapildi: ${formatCurrency(captureData.capture_amount)} TL - ${captureData.capture_reason}`,
        userEmail,
        companyId,
      });
      setShowCaptureModal(false);
      setSelectedProvision(null);
      loadProvisions();
      onUpdate?.();
    }
    setSaving(false);
  }

  const activeProvisions = provisions.filter(p => p.status === 'active');
  const completedProvisions = provisions.filter(p => p.status !== 'active');
  const totalActiveAmount = activeProvisions.reduce((sum, p) => sum + p.amount, 0);

  const getStatusBadge = (status: ProvisionStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            <Lock className="h-3 w-3" />
            Blokede
          </span>
        );
      case 'released':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <Unlock className="h-3 w-3" />
            Iade Edildi
          </span>
        );
      case 'captured':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <ArrowDownToLine className="h-3 w-3" />
            Kesinti Yapildi
          </span>
        );
      case 'partial_captured':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            <ArrowDownToLine className="h-3 w-3" />
            Kismi Kesinti
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentMethodIcon = (method: ProvisionPaymentMethod) => {
    switch (method) {
      case 'credit_card':
        return <CreditCard className="h-4 w-4" />;
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'transfer':
        return <Building2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Depozito & Provizyon</h3>
              <p className="text-sm text-slate-500">Guvenlik teminati yonetimi</p>
            </div>
          </div>
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Provizyon Ekle
          </Button>
        </div>

        {totalActiveAmount > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Aktif Bloke Tutar</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalActiveAmount)} TL</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-blue-500 mt-2">
              Bu tutar emanet olarak saklanmaktadir ve gelir olarak sayilmamaktadir.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : provisions.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">Henuz provizyon kaydi yok</p>
            <Button onClick={() => setShowAddModal(true)} variant="secondary" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Ilk Provizyonu Ekle
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeProvisions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-500" />
                  Aktif Provizyonlar
                </h4>
                <div className="space-y-3">
                  {activeProvisions.map((provision) => (
                    <div
                      key={provision.id}
                      className="p-4 bg-blue-50 rounded-xl border border-blue-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {getPaymentMethodIcon(provision.payment_method)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {formatCurrency(provision.amount)} TL
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(provision.created_at)}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(provision.status)}
                      </div>

                      {provision.provider_ref && (
                        <p className="text-xs text-slate-500 mb-2">
                          Ref: {provision.provider_ref}
                        </p>
                      )}

                      {provision.notes && (
                        <p className="text-sm text-slate-600 mb-3 bg-white/50 p-2 rounded">
                          {provision.notes}
                        </p>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleRelease(provision)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Iade Et
                        </button>
                        <button
                          onClick={() => openCaptureModal(provision)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          Kesinti Yap
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedProvisions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-400" />
                  Gecmis Provizyonlar
                </h4>
                <div className="space-y-2">
                  {completedProvisions.map((provision) => (
                    <div
                      key={provision.id}
                      className={`p-3 rounded-lg border ${
                        provision.status === 'released' ? 'bg-green-50 border-green-200' :
                        'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(provision.payment_method)}
                          <span className="font-medium text-slate-900">
                            {formatCurrency(provision.amount)} TL
                          </span>
                        </div>
                        {getStatusBadge(provision.status)}
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <p>Olusturulma: {formatDate(provision.created_at)}</p>
                        {provision.status === 'released' && provision.released_at && (
                          <p className="text-green-600">
                            Iade: {formatDate(provision.released_at)} - {formatCurrency(provision.release_amount)} TL
                          </p>
                        )}
                        {(provision.status === 'captured' || provision.status === 'partial_captured') && (
                          <>
                            <p className="text-amber-600">
                              Kesinti: {formatCurrency(provision.capture_amount)} TL
                            </p>
                            {provision.release_amount > 0 && (
                              <p className="text-green-600">
                                Iade: {formatCurrency(provision.release_amount)} TL
                              </p>
                            )}
                            {provision.capture_reason && (
                              <p className="text-slate-600">Sebep: {provision.capture_reason}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Provizyon Ekle"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Depozito Bilgisi</p>
                <p className="text-xs text-blue-600 mt-1">
                  Bu tutar musteri emaneti olarak saklanacak ve gelir olarak kaydedilmeyecektir.
                  Kiralama bitiminde iade edilebilir veya hasar/ceza durumunda kesilebilir.
                </p>
              </div>
            </div>
          </div>

          <CurrencyInput
            label="Bloke Tutari *"
            value={newProvision.amount}
            onChange={(value) => setNewProvision({ ...newProvision, amount: value })}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Odeme Yontemi *</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setNewProvision({ ...newProvision, payment_method: method.value })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all ${
                      newProvision.payment_method === method.value
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Referans / Onay Kodu"
            value={newProvision.provider_ref}
            onChange={(e) => setNewProvision({ ...newProvision, provider_ref: e.target.value })}
            placeholder="POS onay kodu veya dekont numarasi"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
            <textarea
              value={newProvision.notes}
              onChange={(e) => setNewProvision({ ...newProvision, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ornegin: HGS icin 1000 TL bloke edildi"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Iptal
            </Button>
            <Button onClick={handleAddProvision} loading={saving}>
              Provizyon Ekle
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        title="Kesinti Yap"
        size="md"
      >
        {selectedProvision && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Kesinti Uyarisi</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Bu islem geri alinamaz. Kesinti yapilan tutar gelir olarak kaydedilecektir.
                    Kalan tutar musteriye iade edilecektir.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Toplam Provizyon</span>
                <span className="font-semibold text-slate-900">{formatCurrency(selectedProvision.amount)} TL</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="full_capture"
                checked={captureData.full_capture}
                onChange={(e) => {
                  setCaptureData({
                    ...captureData,
                    full_capture: e.target.checked,
                    capture_amount: e.target.checked ? selectedProvision.amount : 0,
                  });
                }}
                className="h-4 w-4 text-amber-600 rounded focus:ring-amber-500"
              />
              <label htmlFor="full_capture" className="text-sm text-slate-700">
                Tamamini kes
              </label>
            </div>

            {!captureData.full_capture && (
              <CurrencyInput
                label="Kesinti Tutari *"
                value={captureData.capture_amount}
                onChange={(value) => setCaptureData({ ...captureData, capture_amount: value })}
              />
            )}

            {captureData.capture_amount > 0 && captureData.capture_amount < selectedProvision.amount && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  <span className="font-medium">Iade Edilecek:</span>{' '}
                  {formatCurrency(selectedProvision.amount - captureData.capture_amount)} TL
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kesinti Sebebi *</label>
              <textarea
                value={captureData.capture_reason}
                onChange={(e) => setCaptureData({ ...captureData, capture_reason: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="ornegin: Arac hasar bedeli, Trafik cezasi..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setShowCaptureModal(false)}>
                Iptal
              </Button>
              <Button
                onClick={handleCapture}
                loading={saving}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Kesinti Yap
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
