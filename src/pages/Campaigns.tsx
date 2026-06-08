import { useState, useEffect } from 'react';
import {
  Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink,
  Bell, AlertTriangle, Info, Tag, Users, X, Shield, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

interface Campaign {
  id: string;
  title: string;
  sponsor_name: string;
  discount_rate: string | null;
  image_url: string | null;
  promo_code: string | null;
  external_link: string | null;
  target_audience: string;
  status: boolean;
  created_at: string;
}

interface Announcement {
  id: string;
  type: string;
  title: string;
  content: string;
  target_audience: string;
  specific_tenant_id: string | null;
  tenant_id: string | null;
  created_by: string | null;
  action_link: string | null;
  is_active: boolean;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
}

export default function Campaigns() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [tab, setTab] = useState<'campaigns' | 'announcements'>(isSuperAdmin ? 'campaigns' : 'announcements');

  // Campaign state (Super Admin only)
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    title: '', sponsor_name: '', discount_rate: '', image_url: '',
    promo_code: '', external_link: '', status: true, target_audience: 'Public_Login',
  });

  // Announcement state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    type: 'Info', title: '', content: '', target_audience: isSuperAdmin ? 'Fleet_Admins' : 'Tenants',
    specific_tenant_id: '', action_link: '', is_active: true,
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) loadCampaigns();
    loadAnnouncements();
    loadCustomers();
  }, [companyId]);

  async function loadCampaigns() {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    setCampaigns(data || []);
  }

  async function loadAnnouncements() {
    let query = supabase.from('announcements').select('*');
    if (!isSuperAdmin) {
      query = query.eq('tenant_id', companyId);
    }
    const { data } = await query.order('created_at', { ascending: false });
    setAnnouncements(data || []);
  }

  async function loadCustomers() {
    if (!companyId) return;
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name');
    setCustomers(data || []);
  }

  // Campaign CRUD (Super Admin only)
  function openNewCampaign() {
    setEditCampaign(null);
    setCampaignForm({
      title: '', sponsor_name: '', discount_rate: '', image_url: '',
      promo_code: '', external_link: '', status: true, target_audience: 'Public_Login',
    });
    setShowCampaignModal(true);
  }

  function openEditCampaign(c: Campaign) {
    setEditCampaign(c);
    setCampaignForm({
      title: c.title,
      sponsor_name: c.sponsor_name,
      discount_rate: c.discount_rate || '',
      image_url: c.image_url || '',
      promo_code: c.promo_code || '',
      external_link: c.external_link || '',
      status: c.status,
      target_audience: c.target_audience || 'Public_Login',
    });
    setShowCampaignModal(true);
  }

  async function saveCampaign() {
    if (!campaignForm.title || !campaignForm.sponsor_name) return;
    setSaving(true);
    const payload = {
      title: campaignForm.title,
      sponsor_name: campaignForm.sponsor_name,
      discount_rate: campaignForm.discount_rate || null,
      image_url: campaignForm.image_url || null,
      promo_code: campaignForm.promo_code || null,
      external_link: campaignForm.external_link || null,
      status: campaignForm.status,
      target_audience: campaignForm.target_audience,
      company_id: companyId,
    };

    if (editCampaign) {
      await supabase.from('campaigns').update(payload).eq('id', editCampaign.id);
    } else {
      await supabase.from('campaigns').insert(payload);
    }
    setSaving(false);
    setShowCampaignModal(false);
    loadCampaigns();
  }

  async function toggleCampaignStatus(c: Campaign) {
    await supabase.from('campaigns').update({ status: !c.status }).eq('id', c.id);
    loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Bu kampanyayi silmek istediginize emin misiniz?')) return;
    await supabase.from('campaigns').delete().eq('id', id);
    loadCampaigns();
  }

  // Announcement CRUD
  function openNewAnnouncement() {
    setEditAnnouncement(null);
    setAnnouncementForm({
      type: 'Info', title: '', content: '',
      target_audience: isSuperAdmin ? 'Fleet_Admins' : 'Tenants',
      specific_tenant_id: '', action_link: '', is_active: true,
    });
    setShowAnnouncementModal(true);
  }

  function openEditAnnouncement(a: Announcement) {
    setEditAnnouncement(a);
    setAnnouncementForm({
      type: a.type,
      title: a.title,
      content: a.content,
      target_audience: a.target_audience,
      specific_tenant_id: a.specific_tenant_id || '',
      action_link: a.action_link || '',
      is_active: a.is_active,
    });
    setShowAnnouncementModal(true);
  }

  async function saveAnnouncement() {
    if (!announcementForm.title || !announcementForm.content) return;
    setSaving(true);
    const payload = {
      type: announcementForm.type,
      title: announcementForm.title,
      content: announcementForm.content,
      target_audience: announcementForm.target_audience,
      specific_tenant_id: announcementForm.specific_tenant_id || null,
      action_link: announcementForm.action_link || null,
      is_active: announcementForm.is_active,
      company_id: companyId,
      tenant_id: isSuperAdmin ? null : companyId,
      created_by: user?.id || null,
    };

    if (editAnnouncement) {
      await supabase.from('announcements').update(payload).eq('id', editAnnouncement.id);
    } else {
      await supabase.from('announcements').insert(payload);
    }
    setSaving(false);
    setShowAnnouncementModal(false);
    loadAnnouncements();
  }

  async function toggleAnnouncementStatus(a: Announcement) {
    await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id);
    loadAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm('Bu bildirimi silmek istediginize emin misiniz?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    loadAnnouncements();
  }

  const typeColors: Record<string, string> = {
    Info: 'bg-blue-100 text-blue-700 border-blue-200',
    Legal: 'bg-slate-100 text-slate-700 border-slate-200',
    Payment_Warning: 'bg-red-100 text-red-700 border-red-200',
  };

  const typeLabels: Record<string, string> = {
    Info: 'Bilgilendirme',
    Legal: 'Yasal Uyari',
    Payment_Warning: 'Odeme Uyarisi',
  };

  const audienceLabels: Record<string, string> = {
    All: 'Herkes',
    Tenants: 'Musteriler (Kiracılar)',
    Drivers: 'Suruculer',
    Specific_Tenant: 'Belirli Musteri',
    Fleet_Admins: 'Filo Yoneticileri',
  };

  const campaignAudienceLabels: Record<string, string> = {
    Public_Login: 'Giris Ekrani (Herkese Acik)',
    Fleet_Admins_Only: 'Sadece Filo Yoneticileri',
    All_Logged_In_Users: 'Tum Giris Yapmis Kullanicilar',
  };

  // Available target audiences based on role
  const availableAnnouncementAudiences = isSuperAdmin
    ? ['Fleet_Admins', 'All', 'Tenants', 'Drivers', 'Specific_Tenant']
    : ['Tenants', 'Drivers', 'Specific_Tenant'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isSuperAdmin ? 'Kampanya & Bildirimler' : 'Musteri Bildirimleri'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Global sponsor kampanyalari ve hedefli bildirimleri yonetin'
              : 'Musterilerinize ve suruculere ozel bildirimler gonderın'}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <Shield className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-700">Platform Yoneticisi</span>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white rounded-xl border border-slate-200 p-1 max-w-md">
        {isSuperAdmin && (
          <button
            onClick={() => setTab('campaigns')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              tab === 'campaigns' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="h-4 w-4" />
            Global Kampanyalar
          </button>
        )}
        <button
          onClick={() => setTab('announcements')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            tab === 'announcements' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bell className="h-4 w-4" />
          {isSuperAdmin ? 'Bildirimler' : 'Bildirimlerim'}
        </button>
      </div>

      {/* Campaigns Tab - Super Admin Only */}
      {tab === 'campaigns' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Giris ekraninda ve dashboardlarda gorunen sponsor kampanyalari</p>
            <Button onClick={openNewCampaign}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Kampanya
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Megaphone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Henuz kampanya eklenmemis</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map(c => (
                <div key={c.id} className={`bg-white border rounded-xl p-5 transition-all ${c.status ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 text-sm">{c.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{c.sponsor_name}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.status ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      {campaignAudienceLabels[c.target_audience] || c.target_audience}
                    </span>
                  </div>

                  {c.discount_rate && (
                    <div className="mb-3 px-3 py-2 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-lg">
                      <p className="text-sm font-bold text-teal-700">{c.discount_rate}</p>
                    </div>
                  )}

                  {c.promo_code && (
                    <p className="text-xs text-slate-500 mb-2">
                      Kod: <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{c.promo_code}</span>
                    </p>
                  )}

                  <div className="flex items-center gap-1 pt-2 border-t border-slate-100">
                    <button onClick={() => openEditCampaign(c)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                    <button onClick={() => toggleCampaignStatus(c)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      {c.status ? <EyeOff className="h-3.5 w-3.5 text-slate-500" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                    </button>
                    {c.external_link && (
                      <a href={c.external_link} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      </a>
                    )}
                    <button onClick={() => deleteCampaign(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors ml-auto">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Announcements Tab */}
      {tab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {isSuperAdmin
                ? 'Filo yoneticilerine ve tum kullanicilara hedefli bildirimler'
                : 'Kiracılariniza ve suruculere gonderilen bildirimler'}
            </p>
            <Button onClick={openNewAnnouncement}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Bildirim
            </Button>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Henuz bildirim eklenmemis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-all ${a.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                  <div className={`p-2 rounded-lg border ${typeColors[a.type]}`}>
                    {a.type === 'Payment_Warning' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-slate-900 text-sm">{a.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${typeColors[a.type]}`}>
                        {typeLabels[a.type]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{a.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {audienceLabels[a.target_audience]}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {a.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditAnnouncement(a)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                    <button onClick={() => toggleAnnouncementStatus(a)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      {a.is_active ? <EyeOff className="h-3.5 w-3.5 text-slate-500" /> : <Eye className="h-3.5 w-3.5 text-slate-500" />}
                    </button>
                    <button onClick={() => deleteAnnouncement(a.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Campaign Modal - Super Admin Only */}
      {isSuperAdmin && (
        <Modal
          isOpen={showCampaignModal}
          onClose={() => setShowCampaignModal(false)}
          title={editCampaign ? 'Kampanya Duzenle' : 'Yeni Global Kampanya'}
        >
          <div className="space-y-4">
            <Input
              label="Kampanya Basligi *"
              value={campaignForm.title}
              onChange={(e) => setCampaignForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ornek: Arvento'da %25 Indirim"
            />
            <Input
              label="Sponsor Adi *"
              value={campaignForm.sponsor_name}
              onChange={(e) => setCampaignForm(f => ({ ...f, sponsor_name: e.target.value }))}
              placeholder="Ornek: Arvento Telematics"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Kitle *</label>
              <select
                value={campaignForm.target_audience}
                onChange={(e) => setCampaignForm(f => ({ ...f, target_audience: e.target.value }))}
                className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500"
              >
                <option value="Public_Login">Giris Ekrani (Herkese Acik)</option>
                <option value="Fleet_Admins_Only">Sadece Filo Yoneticileri</option>
                <option value="All_Logged_In_Users">Tum Giris Yapmis Kullanicilar</option>
              </select>
            </div>
            <Input
              label="Indirim Orani"
              value={campaignForm.discount_rate}
              onChange={(e) => setCampaignForm(f => ({ ...f, discount_rate: e.target.value }))}
              placeholder="Ornek: %25 Indirim"
            />
            <Input
              label="Logo / Gorsel URL"
              value={campaignForm.image_url}
              onChange={(e) => setCampaignForm(f => ({ ...f, image_url: e.target.value }))}
              placeholder="https://..."
            />
            <Input
              label="Promosyon Kodu"
              value={campaignForm.promo_code}
              onChange={(e) => setCampaignForm(f => ({ ...f, promo_code: e.target.value }))}
              placeholder="FILOSOFT25"
            />
            <Input
              label="Harici Baglanti"
              value={campaignForm.external_link}
              onChange={(e) => setCampaignForm(f => ({ ...f, external_link: e.target.value }))}
              placeholder="https://partner.com/kampanya"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={campaignForm.status}
                onChange={(e) => setCampaignForm(f => ({ ...f, status: e.target.checked }))}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-slate-700">Aktif</span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowCampaignModal(false)}>Iptal</Button>
              <Button onClick={saveCampaign} disabled={saving || !campaignForm.title || !campaignForm.sponsor_name}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title={editAnnouncement ? 'Bildirim Duzenle' : 'Yeni Bildirim Olustur'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bildirim Tipi *</label>
            <select
              value={announcementForm.type}
              onChange={(e) => setAnnouncementForm(f => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500"
            >
              <option value="Info">Bilgilendirme</option>
              <option value="Legal">Yasal Uyari</option>
              <option value="Payment_Warning">Odeme Uyarisi</option>
            </select>
          </div>

          <Input
            label="Baslik *"
            value={announcementForm.title}
            onChange={(e) => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Bildirim basligi"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Icerik *</label>
            <textarea
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm(f => ({ ...f, content: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500"
              placeholder="Bildirim metni..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Kitle *</label>
            <select
              value={announcementForm.target_audience}
              onChange={(e) => setAnnouncementForm(f => ({ ...f, target_audience: e.target.value }))}
              className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500"
            >
              {availableAnnouncementAudiences.map(a => (
                <option key={a} value={a}>{audienceLabels[a]}</option>
              ))}
            </select>
          </div>

          {announcementForm.target_audience === 'Specific_Tenant' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Musteri Sec *</label>
              <select
                value={announcementForm.specific_tenant_id}
                onChange={(e) => setAnnouncementForm(f => ({ ...f, specific_tenant_id: e.target.value }))}
                className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-500 focus:ring-teal-500"
              >
                <option value="">Secin...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label={announcementForm.type === 'Payment_Warning' ? 'Odeme Linki / Banka Bilgileri *' : 'Aksiyon Linki (opsiyonel)'}
            value={announcementForm.action_link}
            onChange={(e) => setAnnouncementForm(f => ({ ...f, action_link: e.target.value }))}
            placeholder={announcementForm.type === 'Payment_Warning' ? 'https://odeme.link/...' : 'https://...'}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={announcementForm.is_active}
              onChange={(e) => setAnnouncementForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">Aktif</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAnnouncementModal(false)}>Iptal</Button>
            <Button onClick={saveAnnouncement} disabled={saving || !announcementForm.title || !announcementForm.content}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
