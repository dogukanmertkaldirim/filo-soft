import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Users,
  Car,
  DollarSign,
  Star,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SubscriptionPlan, ModuleType } from '../../types/database';

const ALL_FEATURES: { key: string; label: string }[] = [
  { key: 'vehicles', label: 'Arac Yonetimi' },
  { key: 'customers', label: 'Musteri Yonetimi' },
  { key: 'rentals', label: 'Kiralama' },
  { key: 'reports', label: 'Raporlar' },
  { key: 'finance', label: 'Finans' },
  { key: 'maintenance', label: 'Bakim' },
  { key: 'calendar', label: 'Takvim' },
  { key: 'integrations', label: 'Entegrasyonlar' },
  { key: 'transfers', label: 'Transfer' },
  { key: 'loans', label: 'Krediler' },
  { key: 'external_services', label: 'Dis Hizmetler' },
  { key: 'api_access', label: 'API Erisimi' },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: 0,
    price_yearly: 0,
    max_vehicles: 10,
    max_users: 5,
    features: [] as string[],
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingPlan(null);
    setFormData({
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: 0,
      max_vehicles: 10,
      max_users: 5,
      features: [],
      is_active: true,
      sort_order: plans.length + 1,
    });
    setShowModal(true);
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_vehicles: plan.max_vehicles,
      max_users: plan.max_users,
      features: plan.features || [],
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update({
            name: formData.name,
            description: formData.description || null,
            price_monthly: formData.price_monthly,
            price_yearly: formData.price_yearly,
            max_vehicles: formData.max_vehicles,
            max_users: formData.max_users,
            features: formData.features,
            is_active: formData.is_active,
            sort_order: formData.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscription_plans').insert({
          name: formData.name,
          description: formData.description || null,
          price_monthly: formData.price_monthly,
          price_yearly: formData.price_yearly,
          max_vehicles: formData.max_vehicles,
          max_users: formData.max_users,
          features: formData.features,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
        });
        if (error) throw error;
      }
      await loadPlans();
      setShowModal(false);
    } catch (error) {
      console.error('Error saving plan:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: SubscriptionPlan) {
    if (!confirm(`"${plan.name}" paketini silmek istediginize emin misiniz?`)) return;
    try {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', plan.id);
      if (error) throw error;
      await loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
    }
  }

  function toggleFeature(feature: string) {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Paketler</h1>
          <p className="text-slate-400 mt-1">Abonelik paketlerini yonetin</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all"
        >
          <Plus className="h-5 w-5" />
          Yeni Paket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-slate-800 rounded-2xl border overflow-hidden transition-all hover:shadow-xl ${
              plan.is_active ? 'border-slate-700' : 'border-red-500/30 opacity-60'
            }`}
          >
            {!plan.is_active && (
              <div className="absolute top-4 right-4 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">
                Pasif
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-slate-400">{plan.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">
                  {formatCurrency(plan.price_monthly)}
                </span>
                <span className="text-slate-400">/ay</span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <Car className="h-4 w-4 text-amber-400" />
                  <span className="text-slate-300">
                    {plan.max_vehicles === -1 ? 'Sinirsiz' : plan.max_vehicles} Arac
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Users className="h-4 w-4 text-amber-400" />
                  <span className="text-slate-300">
                    {plan.max_users === -1 ? 'Sinirsiz' : plan.max_users} Kullanici
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="h-4 w-4 text-amber-400" />
                  <span className="text-slate-300">
                    Yillik: {formatCurrency(plan.price_yearly)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4 mb-4">
                <p className="text-xs text-slate-400 mb-2">Ozellikler:</p>
                <div className="flex flex-wrap gap-1">
                  {plan.features.slice(0, 4).map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded"
                    >
                      {ALL_FEATURES.find((f) => f.key === feature)?.label || feature}
                    </span>
                  ))}
                  {plan.features.length > 4 && (
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded">
                      +{plan.features.length - 4}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(plan)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Duzenle
                </button>
                <button
                  onClick={() => handleDelete(plan)}
                  className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800">
              <h2 className="text-lg font-semibold text-white">
                {editingPlan ? 'Paketi Duzenle' : 'Yeni Paket'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Paket Adi *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Pro"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Siralama</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Aciklama</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Paket aciklamasi..."
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Aylik Fiyat (TL)</label>
                  <input
                    type="number"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Yillik Fiyat (TL)</label>
                  <input
                    type="number"
                    value={formData.price_yearly}
                    onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Maks. Arac (-1 = Sinirsiz)</label>
                  <input
                    type="number"
                    value={formData.max_vehicles}
                    onChange={(e) => setFormData({ ...formData, max_vehicles: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Maks. Kullanici (-1 = Sinirsiz)</label>
                  <input
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Ozellikler</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ALL_FEATURES.map((feature) => (
                    <label
                      key={feature.key}
                      className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                        formData.features.includes(feature.key)
                          ? 'bg-amber-500/20 border-amber-500/50'
                          : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.features.includes(feature.key)}
                        onChange={() => toggleFeature(feature.key)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center ${
                          formData.features.includes(feature.key)
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-600'
                        }`}
                      >
                        {formData.features.includes(feature.key) && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm text-white">{feature.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only"
                  />
                  <div
                    className={`w-12 h-6 rounded-full transition-colors ${
                      formData.is_active ? 'bg-amber-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                        formData.is_active ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                  <span className="text-sm text-slate-300">Paket Aktif</span>
                </label>
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
