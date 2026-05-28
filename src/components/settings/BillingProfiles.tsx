import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Building2, Check, Star, Upload, ImageIcon, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { CompanyProfile } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface CompanyFormData {
  title: string;
  legal_name: string;
  tax_office: string;
  tax_no: string;
  mersis_no: string;
  address: string;
  phone: string;
  email: string;
  iban_details: string;
  logo_url: string | null;
  is_default: boolean;
}

const emptyForm: CompanyFormData = {
  title: '',
  legal_name: '',
  tax_office: '',
  tax_no: '',
  mersis_no: '',
  address: '',
  phone: '',
  email: '',
  iban_details: '',
  logo_url: null,
  is_default: false,
};

export default function BillingProfiles() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CompanyProfile | null>(null);
  const [formData, setFormData] = useState<CompanyFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [logoInputMode, setLogoInputMode] = useState<'file' | 'url'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (companyId) {
      loadProfiles();
    }
  }, [companyId]);

  async function loadProfiles() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    setCompanyProfiles(data || []);
    setLoading(false);
  }

  function openCreateForm() {
    setEditingProfile(null);
    setFormData({ ...emptyForm, is_default: companyProfiles.length === 0 });
    setShowForm(true);
  }

  function openEditForm(profile: CompanyProfile) {
    setEditingProfile(profile);
    setFormData({
      title: profile.title,
      legal_name: profile.legal_name,
      tax_office: profile.tax_office || '',
      tax_no: profile.tax_no || '',
      mersis_no: profile.mersis_no || '',
      address: profile.address || '',
      phone: profile.phone || '',
      email: profile.email || '',
      iban_details: profile.iban_details || '',
      logo_url: profile.logo_url,
      is_default: profile.is_default,
    });
    setShowForm(true);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Lutfen bir resim dosyasi secin');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Dosya boyutu 2MB\'dan kucuk olmalidir');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData({ ...formData, logo_url: base64 });
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!companyId) return;

    if (!formData.title.trim() || !formData.legal_name.trim()) {
      alert('Sirket Adi ve Ticari Unvan zorunludur');
      return;
    }

    setSaving(true);

    if (formData.is_default) {
      await supabase
        .from('company_profiles')
        .update({ is_default: false })
        .eq('company_id', companyId)
        .neq('id', editingProfile?.id || '');
    }

    if (editingProfile) {
      await supabase.from('company_profiles').update({
        title: formData.title,
        legal_name: formData.legal_name,
        tax_office: formData.tax_office || null,
        tax_no: formData.tax_no || null,
        mersis_no: formData.mersis_no || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        iban_details: formData.iban_details || null,
        logo_url: formData.logo_url,
        is_default: formData.is_default,
      }).eq('id', editingProfile.id).eq('company_id', companyId);
    } else {
      await supabase.from('company_profiles').insert({
        company_id: companyId,
        title: formData.title,
        legal_name: formData.legal_name,
        tax_office: formData.tax_office || null,
        tax_no: formData.tax_no || null,
        mersis_no: formData.mersis_no || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        iban_details: formData.iban_details || null,
        logo_url: formData.logo_url,
        is_default: formData.is_default,
      });
    }

    if (formData.is_default) {
      window.dispatchEvent(new CustomEvent('company-logo-changed', { detail: { logo_url: formData.logo_url } }));
    }

    setSaving(false);
    setShowForm(false);
    loadProfiles();
  }

  async function handleDelete(profile: CompanyProfile) {
    if (!companyId) return;
    if (!confirm(`"${profile.title}" fatura profilini silmek istediginizden emin misiniz?`)) return;
    await supabase.from('company_profiles').delete().eq('id', profile.id).eq('company_id', companyId);
    loadProfiles();
  }

  async function setAsDefault(profile: CompanyProfile) {
    if (!companyId) return;
    await supabase.from('company_profiles').update({ is_default: false }).eq('company_id', companyId).neq('id', profile.id);
    await supabase.from('company_profiles').update({ is_default: true }).eq('id', profile.id).eq('company_id', companyId);
    loadProfiles();
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-600" />
              Fatura Profilleri (Kesim Adresleri)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sozlesme ve faturalarda kullanilacak farkli kesim adreslerini yonetin. Birden fazla fatura profili ekleyebilirsiniz.
            </p>
          </div>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Fatura Profili Ekle
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : companyProfiles.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Henuz fatura profili yok</h3>
            <p className="text-sm text-slate-500 mb-4">
              Sozlesme ve faturalarda kullanilacak firma kesim bilgilerinizi ekleyin
            </p>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" />
              Ilk Fatura Profilini Ekle
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {companyProfiles.map((profile) => (
              <div
                key={profile.id}
                className={`p-4 border rounded-lg transition-colors ${
                  profile.is_default
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {profile.logo_url ? (
                      <img
                        src={profile.logo_url}
                        alt={profile.title}
                        className="h-16 w-16 object-contain rounded-lg border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{profile.title}</h3>
                      {profile.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                          <Star className="h-3 w-3" />
                          Varsayilan
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{profile.legal_name}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
                      {profile.tax_no && (
                        <div><span className="text-slate-400">VKN:</span> {profile.tax_no}</div>
                      )}
                      {profile.tax_office && (
                        <div><span className="text-slate-400">V.D.:</span> {profile.tax_office}</div>
                      )}
                      {profile.phone && (
                        <div><span className="text-slate-400">Tel:</span> {profile.phone}</div>
                      )}
                      {profile.email && (
                        <div><span className="text-slate-400">E-posta:</span> {profile.email}</div>
                      )}
                    </div>

                    {profile.address && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                        <span className="text-slate-400">Adres:</span> {profile.address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!profile.is_default && (
                      <button
                        onClick={() => setAsDefault(profile)}
                        className="p-2 hover:bg-teal-100 rounded-lg text-slate-500 hover:text-teal-600 transition-colors"
                        title="Varsayilan Yap"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(profile)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                      title="Duzenle"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(profile)}
                      className="p-2 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingProfile ? 'Fatura Profilini Duzenle' : 'Yeni Fatura Profili'}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-teal-600" />
              Logo
            </h3>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {formData.logo_url ? (
                  <div className="relative group">
                    <img
                      src={formData.logo_url}
                      alt="Logo onizleme"
                      className="h-24 w-24 object-contain rounded-xl border-2 border-slate-200 bg-white shadow-sm"
                    />
                    <button
                      onClick={() => setFormData({ ...formData, logo_url: null })}
                      className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <div className="h-24 w-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Building2 className="h-10 w-10 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setLogoInputMode('file')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                      logoInputMode === 'file'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Dosya Yukle
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoInputMode('url')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                      logoInputMode === 'url'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    URL Gir
                  </button>
                </div>
                {logoInputMode === 'file' ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-teal-400 hover:bg-teal-50 transition-colors"
                    >
                      Resim dosyasi secmek icin tiklayin
                    </button>
                    <p className="text-xs text-slate-400 mt-2">PNG, JPG veya SVG. Maks. 2MB.</p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={formData.logo_url || ''}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value || null })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-400 mt-2">Logo resminizin tam URL adresini girin</p>
                  </div>
                )}
              </div>
            </div>
            {formData.is_default && (
              <p className="text-xs text-teal-600 mt-4 bg-teal-50 rounded-lg px-3 py-2">
                Bu profil varsayilan olarak ayarlandiginda, logo yan menude gorunecektir.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sirket Adi (Kisa)"
              placeholder="Ornegin: Tek Karot"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <Input
              label="Ticari Unvan"
              placeholder="Ornegin: Tek Karot Arac Kiralama Ltd. Sti."
              value={formData.legal_name}
              onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Vergi Dairesi"
              placeholder="Ornegin: Kadikoy"
              value={formData.tax_office}
              onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
            />
            <Input
              label="Vergi No"
              placeholder="1234567890"
              value={formData.tax_no}
              onChange={(e) => setFormData({ ...formData, tax_no: e.target.value })}
            />
            <Input
              label="MERSIS No"
              placeholder="0123456789012345"
              value={formData.mersis_no}
              onChange={(e) => setFormData({ ...formData, mersis_no: e.target.value })}
            />
          </div>

          <Input
            label="Adres"
            placeholder="Tam adres..."
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Telefon"
              placeholder="+90 5XX XXX XX XX"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="E-posta"
              type="email"
              placeholder="info@sirket.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Banka Bilgileri (IBAN)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              placeholder="TR00 0000 0000 0000 0000 0000 00&#10;Banka Adi - Sube Adi&#10;Hesap Sahibi"
              value={formData.iban_details}
              onChange={(e) => setFormData({ ...formData, iban_details: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">
              Bu profili varsayilan olarak kullan (yeni kiralamalarda otomatik sec)
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingProfile ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
