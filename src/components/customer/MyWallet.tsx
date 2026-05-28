import { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Star, Shield, Wallet, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PaymentCard, Customer } from '../../types/database';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

interface MyWalletProps {
  customer: Customer;
  companyId: string;
}

const CARD_BRAND_COLORS: Record<string, { bg: string; text: string }> = {
  visa: { bg: 'bg-blue-600', text: 'text-white' },
  mastercard: { bg: 'bg-gradient-to-r from-red-500 to-orange-500', text: 'text-white' },
  amex: { bg: 'bg-blue-800', text: 'text-white' },
  troy: { bg: 'bg-teal-600', text: 'text-white' },
  default: { bg: 'bg-slate-700', text: 'text-white' },
};

const PAYMENT_PROVIDERS = [
  { value: 'paytr', label: 'PayTR' },
  { value: 'iyzico', label: 'iyzico' },
  { value: 'paycell', label: 'Paycell' },
];

export default function MyWallet({ customer, companyId }: MyWalletProps) {
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCard, setNewCard] = useState({
    card_alias: '',
    provider: 'paytr',
  });

  useEffect(() => {
    loadCards();
  }, [customer.id]);

  async function loadCards() {
    setLoading(true);
    const { data } = await supabase
      .from('payment_cards')
      .select('*')
      .eq('customer_id', customer.id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false });
    setCards(data || []);
    setLoading(false);
  }

  async function handleSetDefault(cardId: string) {
    await supabase
      .from('payment_cards')
      .update({ is_default: false })
      .eq('customer_id', customer.id);

    await supabase
      .from('payment_cards')
      .update({ is_default: true })
      .eq('id', cardId);

    loadCards();
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm('Bu karti silmek istediginize emin misiniz?')) return;

    await supabase
      .from('payment_cards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cardId);

    loadCards();
  }

  async function handleAddCard() {
    setSaving(true);

    const mockToken = `TOKEN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockLastFour = Math.floor(1000 + Math.random() * 9000).toString();
    const brands = ['visa', 'mastercard', 'troy'];
    const mockBrand = brands[Math.floor(Math.random() * brands.length)];

    const { error } = await supabase.from('payment_cards').insert({
      company_id: companyId,
      customer_id: customer.id,
      provider: newCard.provider,
      card_token: mockToken,
      card_alias: newCard.card_alias || `Kartim ${cards.length + 1}`,
      last_four_digits: mockLastFour,
      card_brand: mockBrand,
      is_default: cards.length === 0,
    });

    if (error) {
      alert('Kart eklenemedi');
    } else {
      setShowAddCard(false);
      setNewCard({ card_alias: '', provider: 'paytr' });
      loadCards();
    }
    setSaving(false);
  }

  const getCardColors = (brand: string | null) => {
    return CARD_BRAND_COLORS[brand || 'default'] || CARD_BRAND_COLORS.default;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cuzdanim</h2>
              <p className="text-sm text-slate-500">Kayitli kartlariniz</p>
            </div>
          </div>
          <Button onClick={() => setShowAddCard(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Kart Ekle
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Kayitli Kart Yok</h3>
            <p className="text-sm text-slate-500 mb-4">
              Hizli odeme yapmak icin kart ekleyin
            </p>
            <Button onClick={() => setShowAddCard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ilk Kartinizi Ekleyin
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {cards.map((card) => {
              const colors = getCardColors(card.card_brand);
              return (
                <div
                  key={card.id}
                  className={`relative overflow-hidden rounded-xl ${colors.bg} p-5 ${colors.text}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-10">
                    <CreditCard className="w-full h-full" />
                  </div>

                  <div className="flex items-start justify-between mb-6">
                    <div>
                      {card.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded text-xs font-medium mb-2">
                          <Star className="h-3 w-3" />
                          Varsayilan
                        </span>
                      )}
                      <p className="text-sm opacity-80">{card.card_alias || 'Kartim'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium opacity-80">
                        {card.provider.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-2xl font-mono tracking-wider">
                      **** **** **** {card.last_four_digits}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <p className="opacity-60 text-xs">Kart Markasi</p>
                      <p className="font-medium uppercase">{card.card_brand || 'Kart'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!card.is_default && (
                        <button
                          onClick={() => handleSetDefault(card.id)}
                          className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                          title="Varsayilan Yap"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-2 bg-white/20 rounded-lg hover:bg-red-500/50 transition-colors"
                        title="Karti Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-teal-600" />
            <div>
              <p className="text-sm font-medium text-slate-900">Guvenli Odeme</p>
              <p className="text-xs text-slate-500">
                Kart bilgileriniz PCI-DSS uyumlu altyapida guvenle saklanir.
                Sadece tokenize edilmis veriler kullanilir.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showAddCard}
        onClose={() => setShowAddCard(false)}
        title="Yeni Kart Ekle"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Demo Mod:</strong> Gercek bir odeme entegrasyonu yapilmadigi icin
              simdilik demo kart olusturulmaktadir. Gercek entegrasyon icin PayTR, iyzico
              veya Paycell API baglantisi gereklidir.
            </p>
          </div>

          <Input
            label="Kart Takma Adi"
            value={newCard.card_alias}
            onChange={(e) => setNewCard({ ...newCard, card_alias: e.target.value })}
            placeholder="ornegin: Is Kartim, Kisisel Kart"
          />

          <Select
            label="Odeme Saglayici"
            value={newCard.provider}
            onChange={(e) => setNewCard({ ...newCard, provider: e.target.value })}
            options={PAYMENT_PROVIDERS}
          />

          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-3">
              Gercek entegrasyonda bu noktada odeme saglayicisinin guvenli
              kart kayit sayfasina yonlendirilirsiniz.
            </p>
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">
                3D Secure dogrulama yapilir
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">
                Kart tokeni guvenle kaydedilir
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowAddCard(false)}>
              Iptal
            </Button>
            <Button onClick={handleAddCard} loading={saving}>
              Demo Kart Ekle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
