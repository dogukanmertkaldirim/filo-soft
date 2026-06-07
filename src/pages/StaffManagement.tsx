import { useState, useEffect } from 'react';
import { Plus, Users, Phone, Mail, Shield, Trash2, Search, UserCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface StaffUser {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  driver_type: string | null;
  is_active: boolean;
  created_at: string;
}

export default function StaffManagement() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    if (companyId) loadStaff();
  }, [companyId]);

  async function loadStaff() {
    setLoading(true);
    const { data } = await supabase
      .from('app_users')
      .select('id, username, full_name, email, phone, driver_type, is_active, created_at')
      .eq('company_id', companyId)
      .eq('role', 'driver')
      .eq('driver_type', 'employee')
      .order('created_at', { ascending: false });
    setStaff(data || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!formData.full_name || !formData.username || !formData.password) {
      setError('Ad Soyad, Kullanici Adi ve Sifre zorunludur');
      return;
    }
    if (formData.password.length < 6) {
      setError('Sifre en az 6 karakter olmalidir');
      return;
    }

    setSaving(true);
    setError('');

    const { data: result, error: rpcError } = await supabase.rpc('admin_create_user', {
      p_username: formData.username,
      p_password: formData.password,
      p_full_name: formData.full_name,
      p_email: formData.email || null,
      p_phone: formData.phone || null,
      p_title: 'Saha Personeli',
      p_role: 'driver',
      p_company_id: companyId,
      p_assigned_rep_id: null,
      p_driver_license_no: null,
      p_driver_license_expiry: null,
    });

    if (rpcError) {
      setError('Kullanici olusturulurken hata: ' + rpcError.message);
      setSaving(false);
      return;
    }

    if (result && !result.success) {
      setError(result.error || 'Kullanici olusturulamadi');
      setSaving(false);
      return;
    }

    // Set driver_type to 'employee' for this user
    if (result?.user_id) {
      await supabase
        .from('app_users')
        .update({ driver_type: 'employee' })
        .eq('id', result.user_id);
    }

    setShowForm(false);
    setFormData({ full_name: '', phone: '', email: '', username: '', password: '' });
    setSaving(false);
    loadStaff();
  }

  async function toggleActive(user: StaffUser) {
    await supabase
      .from('app_users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    loadStaff();
  }

  const filtered = staff.filter(s =>
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Calisan Yonetimi</h1>
          <p className="text-sm text-slate-500">Saha personeli ve calisan sofor hesaplari</p>
        </div>
        <Button onClick={() => { setShowForm(true); setError(''); }}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Calisan Ekle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Calisan</p>
          <p className="text-2xl font-bold text-slate-900">{staff.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Aktif</p>
          <p className="text-2xl font-bold text-green-600">{staff.filter(s => s.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Pasif</p>
          <p className="text-2xl font-bold text-slate-400">{staff.filter(s => !s.is_active).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Isim veya kullanici adi ile ara..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Staff List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">Henuz calisan eklenmemis</h3>
          <p className="text-sm text-slate-500 mb-4">
            Saha soforlerinizi ekleyerek gorev atama islemlerine baslayabilirsiniz.
          </p>
          <Button onClick={() => { setShowForm(true); setError(''); }}>
            <Plus className="h-4 w-4 mr-2" />
            Ilk Calisani Ekle
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-600 px-5 py-3">Calisan</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-5 py-3">Kullanici Adi</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-5 py-3">Iletisim</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-5 py-3">Durum</th>
                  <th className="text-right text-xs font-semibold text-slate-600 px-5 py-3">Islem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-teal-100 rounded-full flex items-center justify-center">
                          <Shield className="h-4 w-4 text-teal-700" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                          <p className="text-xs text-slate-500">Saha Personeli</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-700 font-mono">{s.username}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        {s.phone && (
                          <p className="text-xs text-slate-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {s.phone}
                          </p>
                        )}
                        {s.email && (
                          <p className="text-xs text-slate-600 flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {s.email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${s.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        {s.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggleActive(s)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                          s.is_active
                            ? 'border-red-200 text-red-700 hover:bg-red-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {s.is_active ? 'Deaktif Et' : 'Aktif Et'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Yeni Calisan Ekle">
        <div className="space-y-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-teal-700">
              <UserCheck className="h-4 w-4" />
              <span className="font-medium">Bu hesap "Saha Personeli / Calisan Sofor" olarak olusturulacaktir.</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Input
            label="Ad Soyad *"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Ahmet Yilmaz"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Telefon"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="05XX XXX XX XX"
            />
            <Input
              label="E-posta"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ornek@email.com"
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Giris Bilgileri</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Kullanici Adi *"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="ahmet.yilmaz"
              />
              <Input
                label="Sifre *"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="En az 6 karakter"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              Calisani Kaydet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
