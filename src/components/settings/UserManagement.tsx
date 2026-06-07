import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Key, User, Shield, ShieldCheck, Car, UserCheck,
  UserCog, Truck, Search, CircleDot, CircleOff, Building2,
  Crown, Briefcase, HardHat, Users as UsersIcon, Upload,
  FileText, ExternalLink, X, Loader2, Camera, Heart,
  Phone, MapPin, AlertTriangle, FolderOpen,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AppUser, UserRole } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/auditLog';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

const PERSONNEL_BUCKET = 'personnel-docs';

interface CustomerOption {
  id: string;
  company_title: string;
  authorized_person: string | null;
}

type SystemRoleBranch =
  | 'super_admin'
  | 'beyaz_yaka'
  | 'mavi_yaka'
  | 'kiraci_yetkili'
  | 'kiraci_sofor';

interface UserFormData {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone: string;
  title: string;
  system_role: SystemRoleBranch;
  linked_customer_id: string;
  is_active: boolean;
  avatar_url: string;
  identity_doc_url: string;
  ehliyet_doc_url: string;
  ehliyet_class: string;
  ehliyet_expiry_date: string;
  src_document_no: string;
  psikoteknik_status: string;
  sgk_doc_url: string;
  sabika_kaydi_url: string;
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  home_address: string;
  isg_training_date: string;
  driver_license_no: string;
  driver_license_expiry: string;
  nufus_kayit_url: string;
  ikametgah_url: string;
  isg_documents_url: string;
}

const emptyForm: UserFormData = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  title: '',
  system_role: 'beyaz_yaka',
  linked_customer_id: '',
  is_active: true,
  avatar_url: '',
  identity_doc_url: '',
  ehliyet_doc_url: '',
  ehliyet_class: '',
  ehliyet_expiry_date: '',
  src_document_no: '',
  psikoteknik_status: '',
  sgk_doc_url: '',
  sabika_kaydi_url: '',
  blood_type: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  home_address: '',
  isg_training_date: '',
  driver_license_no: '',
  driver_license_expiry: '',
  nufus_kayit_url: '',
  ikametgah_url: '',
  isg_documents_url: '',
};

const systemRoleOptions: { value: SystemRoleBranch; label: string; description: string; icon: React.ElementType; color: string }[] = [
  { value: 'super_admin', label: 'Super Admin / Firma Sahibi', description: 'Tum sisteme tam erisim', icon: Crown, color: 'bg-rose-100 text-rose-700' },
  { value: 'beyaz_yaka', label: 'Beyaz Yaka (Ofis Calisani)', description: 'Filo, finans, onay ve zamanlama erisimi', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { value: 'mavi_yaka', label: 'DMK Saha Personeli (Mavi Yaka)', description: 'Mobil operasyonel gorev paneline erisim', icon: HardHat, color: 'bg-amber-100 text-amber-700' },
  { value: 'kiraci_yetkili', label: 'Kiraci Firma Yetkilisi', description: 'Musteri portali yonetici erisimi', icon: Building2, color: 'bg-green-100 text-green-700' },
  { value: 'kiraci_sofor', label: 'Kiraci Soforu', description: 'KM kaydi, fis yukleme ve dijital canta', icon: Car, color: 'bg-cyan-100 text-cyan-700' },
];

const bloodTypeOptions = [
  { value: '', label: 'Kan grubu secin...' },
  { value: 'A Rh+', label: 'A Rh+' },
  { value: 'A Rh-', label: 'A Rh-' },
  { value: 'B Rh+', label: 'B Rh+' },
  { value: 'B Rh-', label: 'B Rh-' },
  { value: 'AB Rh+', label: 'AB Rh+' },
  { value: 'AB Rh-', label: 'AB Rh-' },
  { value: '0 Rh+', label: '0 Rh+' },
  { value: '0 Rh-', label: '0 Rh-' },
];

const ehliyetClassOptions = [
  { value: '', label: 'Sinif secin...' },
  { value: 'B', label: 'B' },
  { value: 'B1', label: 'B1' },
  { value: 'BE', label: 'BE' },
  { value: 'C', label: 'C' },
  { value: 'C1', label: 'C1' },
  { value: 'CE', label: 'CE' },
  { value: 'D', label: 'D' },
  { value: 'D1', label: 'D1' },
  { value: 'DE', label: 'DE' },
  { value: 'E', label: 'E' },
];

function mapBranchToDbRole(branch: SystemRoleBranch): { role: UserRole; driver_type: string | null } {
  switch (branch) {
    case 'super_admin': return { role: 'admin', driver_type: null };
    case 'beyaz_yaka': return { role: 'staff', driver_type: null };
    case 'mavi_yaka': return { role: 'driver', driver_type: 'employee' };
    case 'kiraci_yetkili': return { role: 'customer', driver_type: null };
    case 'kiraci_sofor': return { role: 'driver', driver_type: 'tenant' };
  }
}

function mapDbRoleToBranch(user: AppUser): SystemRoleBranch {
  if (user.role === 'super_admin' || (user.role === 'admin')) return 'super_admin';
  if (user.role === 'staff') return 'beyaz_yaka';
  if (user.role === 'driver' && user.driver_type === 'employee') return 'mavi_yaka';
  if (user.role === 'driver' && user.driver_type === 'tenant') return 'kiraci_sofor';
  if (user.role === 'customer') return 'kiraci_yetkili';
  return 'beyaz_yaka';
}

async function uploadFile(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const { error } = await supabase.storage.from(PERSONNEL_BUCKET).upload(fileName, file);
  if (error) return null;
  const { data: { publicUrl } } = supabase.storage.from(PERSONNEL_BUCKET).getPublicUrl(fileName);
  return publicUrl;
}

type FormTab = 'general' | 'documents' | 'driver' | 'health';

function FileDropzone({ label, value, onUpload, accept = 'image/*,application/pdf' }: {
  label: string;
  value: string;
  onUpload: (url: string) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file, 'docs');
    if (url) onUpload(url);
    setUploading(false);
    e.target.value = '';
  }, [onUpload]);

  if (value) {
    const isImage = value.match(/\.(jpg|jpeg|png|webp|heic)/i);
    return (
      <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50">
        <p className="text-xs font-medium text-slate-600 mb-2">{label}</p>
        <div className="flex items-center gap-3">
          {isImage ? (
            <img src={value} alt={label} className="h-12 w-16 object-cover rounded-lg" />
          ) : (
            <div className="h-12 w-16 bg-red-50 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-red-500" />
            </div>
          )}
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            <ExternalLink className="h-3 w-3" />
            Goruntule
          </a>
        </div>
        <button
          type="button"
          onClick={() => onUpload('')}
          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-600 mb-1.5">{label}</p>
      <div
        onClick={() => inputRef.current?.click()}
        className={`flex items-center justify-center w-full h-16 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          uploading ? 'border-teal-400 bg-teal-50 pointer-events-none' : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/50'
        }`}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 text-teal-500 animate-spin" />
        ) : (
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500">Dosya yukle (PDF/Gorsel)</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
    </div>
  );
}

function AvatarUpload({ url, onUpload }: { url: string; onUpload: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const uploadedUrl = await uploadFile(file, 'avatars');
    if (uploadedUrl) onUpload(uploadedUrl);
    setUploading(false);
    e.target.value = '';
  }, [onUpload]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative w-20 h-20 rounded-full border-2 border-dashed cursor-pointer overflow-hidden transition-all ${
          uploading ? 'border-teal-400 bg-teal-50' : url ? 'border-teal-500 border-solid' : 'border-slate-300 hover:border-teal-400'
        }`}
      >
        {url ? (
          <img src={url} alt="Avatar" className="w-full h-full object-cover" />
        ) : uploading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-teal-500 animate-spin" />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Camera className="h-5 w-5 text-slate-400" />
          </div>
        )}
        {url && !uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
        )}
      </div>
      {url && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onUpload(''); }}
          className="text-xs text-red-500 hover:text-red-600"
        >
          Kaldir
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function UserManagement() {
  const { user: currentUser, effectiveCompanyId: companyId, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
  const [formTab, setFormTab] = useState<FormTab>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editBranch, setEditBranch] = useState<SystemRoleBranch>('beyaz_yaka');
  const [savingRole, setSavingRole] = useState(false);

  const [showDossier, setShowDossier] = useState(false);
  const [dossierUser, setDossierUser] = useState<AppUser | null>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function loadData() {
    if (!companyId) {
      setUsers([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [usersRes, customersRes] = await Promise.all([
      supabase
        .from('app_users')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      supabase
        .from('customers')
        .select('id, company_title, authorized_person')
        .eq('company_id', companyId)
        .order('company_title'),
    ]);
    setUsers(usersRes.data || []);
    setCustomers(customersRes.data || []);
    setLoading(false);
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === '' ||
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (roleFilter === 'all') return matchesSearch;
    return matchesSearch && mapDbRoleToBranch(u) === roleFilter;
  });

  const branchCounts = users.reduce((acc, u) => {
    const branch = mapDbRoleToBranch(u);
    acc[branch] = (acc[branch] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function openAddForm() {
    setFormData(emptyForm);
    setFormTab('general');
    setError('');
    setShowForm(true);
  }

  function getBranchLabel(branch: SystemRoleBranch): string {
    return systemRoleOptions.find(o => o.value === branch)?.label || branch;
  }

  function getBranchColor(branch: SystemRoleBranch): string {
    return systemRoleOptions.find(o => o.value === branch)?.color || 'bg-slate-100 text-slate-700';
  }

  function getBranchIcon(branch: SystemRoleBranch) {
    const opt = systemRoleOptions.find(o => o.value === branch);
    if (!opt) return <User className="h-3 w-3" />;
    const Icon = opt.icon;
    return <Icon className="h-3 w-3" />;
  }

  async function handleSave() {
    if (!formData.full_name || !formData.username || !formData.password) {
      setError('Ad Soyad, Kullanici Adi ve Sifre zorunludur');
      setFormTab('general');
      return;
    }
    if (formData.password.length < 6) {
      setError('Sifre en az 6 karakter olmalidir');
      setFormTab('general');
      return;
    }
    if ((formData.system_role === 'kiraci_yetkili' || formData.system_role === 'kiraci_sofor') && !formData.linked_customer_id) {
      setError('Kiraci rolleri icin "Bagli Oldugu Musteri Firma" secimi zorunludur');
      setFormTab('general');
      return;
    }

    setSaving(true);
    setError('');

    const { role, driver_type } = mapBranchToDbRole(formData.system_role);

    const { data: result, error: rpcError } = await supabase.rpc('admin_create_user', {
      p_username: formData.username,
      p_password: formData.password,
      p_full_name: formData.full_name,
      p_email: formData.email || null,
      p_phone: formData.phone || null,
      p_title: formData.title || null,
      p_role: role,
      p_company_id: companyId,
      p_assigned_rep_id: null,
      p_driver_license_no: formData.driver_license_no || null,
      p_driver_license_expiry: formData.driver_license_expiry || null,
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

    if (result?.user_id) {
      const updatePayload: Record<string, unknown> = {};
      if (driver_type) updatePayload.driver_type = driver_type;
      if (formData.linked_customer_id) updatePayload.linked_customer_id = formData.linked_customer_id;
      if (!formData.is_active) updatePayload.is_active = false;
      if (formData.avatar_url) updatePayload.avatar_url = formData.avatar_url;
      if (formData.identity_doc_url) updatePayload.identity_doc_url = formData.identity_doc_url;
      if (formData.ehliyet_doc_url) updatePayload.ehliyet_doc_url = formData.ehliyet_doc_url;
      if (formData.ehliyet_class) updatePayload.ehliyet_class = formData.ehliyet_class;
      if (formData.ehliyet_expiry_date) updatePayload.ehliyet_expiry_date = formData.ehliyet_expiry_date;
      if (formData.src_document_no) updatePayload.src_document_no = formData.src_document_no;
      if (formData.psikoteknik_status) updatePayload.psikoteknik_status = formData.psikoteknik_status;
      if (formData.sgk_doc_url) updatePayload.sgk_doc_url = formData.sgk_doc_url;
      if (formData.sabika_kaydi_url) updatePayload.sabika_kaydi_url = formData.sabika_kaydi_url;
      if (formData.blood_type) updatePayload.blood_type = formData.blood_type;
      if (formData.emergency_contact_name) updatePayload.emergency_contact_name = formData.emergency_contact_name;
      if (formData.emergency_contact_phone) updatePayload.emergency_contact_phone = formData.emergency_contact_phone;
      if (formData.home_address) updatePayload.home_address = formData.home_address;
      if (formData.isg_training_date) updatePayload.isg_training_date = formData.isg_training_date;
      if (formData.nufus_kayit_url) updatePayload.nufus_kayit_url = formData.nufus_kayit_url;
      if (formData.ikametgah_url) updatePayload.ikametgah_url = formData.ikametgah_url;
      if (formData.isg_documents_url) updatePayload.isg_documents_url = formData.isg_documents_url;

      if (Object.keys(updatePayload).length > 0) {
        await supabase.from('app_users').update(updatePayload).eq('id', result.user_id);
      }
    }

    await logActivity({
      action: 'CREATE',
      entity: 'User',
      entityId: result?.user_id || null,
      details: `Yeni kullanici olusturuldu: ${formData.full_name} (${formData.username}) - Tur: ${getBranchLabel(formData.system_role)}`,
      userEmail: currentUser?.email,
      companyId: companyId,
    });

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  function openEditRoleModal(user: AppUser) {
    setEditingUser(user);
    setEditBranch(mapDbRoleToBranch(user));
    setShowEditRoleModal(true);
  }

  async function handleSaveRole() {
    if (!editingUser) return;
    setSavingRole(true);
    const { role, driver_type } = mapBranchToDbRole(editBranch);
    const { error } = await supabase
      .from('app_users')
      .update({ role, driver_type: driver_type || null })
      .eq('id', editingUser.id);
    if (error) {
      alert('Rol guncellenirken bir hata olustu');
    } else {
      await logActivity({
        action: 'UPDATE',
        entity: 'User',
        entityId: editingUser.id,
        details: `Kullanici rolu degistirildi: ${editingUser.full_name} -> ${getBranchLabel(editBranch)}`,
        userEmail: currentUser?.email,
        companyId: companyId,
      });
      setShowEditRoleModal(false);
      setEditingUser(null);
      loadData();
    }
    setSavingRole(false);
  }

  async function toggleActive(user: AppUser) {
    await supabase.from('app_users').update({ is_active: !user.is_active }).eq('id', user.id);
    loadData();
  }

  async function handleDelete(user: AppUser) {
    if (user.id === currentUser?.id) { alert('Kendinizi silemezsiniz!'); return; }
    if (!confirm(`"${user.full_name}" kullanicisini silmek istediginize emin misiniz?`)) return;
    await logActivity({ action: 'DELETE', entity: 'User', entityId: user.id, details: `Kullanici silindi: ${user.full_name}`, userEmail: currentUser?.email, companyId });
    await supabase.from('app_users').delete().eq('id', user.id).eq('company_id', companyId);
    loadData();
  }

  function openPasswordModal(user: AppUser) {
    setPasswordUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  }

  async function handlePasswordReset() {
    if (!passwordUser) return;
    if (newPassword.length < 6) { alert('Sifre en az 6 karakter olmalidir'); return; }
    setSavingPassword(true);
    const { error } = await supabase.from('app_users').update({ password: newPassword }).eq('id', passwordUser.id);
    if (error) { alert('Sifre guncellenirken hata'); }
    else { setShowPasswordModal(false); setPasswordUser(null); setNewPassword(''); }
    setSavingPassword(false);
  }

  function openDossier(user: AppUser) {
    setDossierUser(user);
    setShowDossier(true);
  }

  function getLinkedCustomerName(customerId: string | null) {
    if (!customerId) return null;
    return customers.find(c => c.id === customerId)?.company_title || null;
  }

  const isDriverRole = formData.system_role === 'mavi_yaka' || formData.system_role === 'kiraci_sofor';

  const formTabs: { id: FormTab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'Genel Bilgiler', icon: User },
    { id: 'documents', label: 'Evrak Arsivi', icon: FolderOpen },
    { id: 'driver', label: 'Soforluk & Ehliyet', icon: Car },
    { id: 'health', label: 'Saglik & Acil Durum', icon: Heart },
  ];

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserCog className="h-5 w-5 text-teal-600" />
              Kullanici ve Rol Yonetim Merkezi
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Tum sistem kullanicilarini tek noktadan yonetin
            </p>
          </div>
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kullanici Tanimla
          </Button>
        </div>

        {/* Role Branch Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {systemRoleOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setRoleFilter(roleFilter === opt.value ? 'all' : opt.value)}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                  roleFilter === opt.value
                    ? 'border-teal-300 bg-teal-50 ring-1 ring-teal-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${opt.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-900">{branchCounts[opt.value] || 0}</p>
                  <p className="text-[10px] text-slate-500 truncate leading-tight">{opt.label.split('(')[0].trim()}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ad, kullanici adi veya e-posta ara..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50"
            />
          </div>
          {roleFilter !== 'all' && (
            <button onClick={() => setRoleFilter('all')} className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
              Filtreyi Temizle
            </button>
          )}
          <span className="text-xs text-slate-400">{filteredUsers.length} / {users.length} kullanici</span>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Kullanici</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Iletisim</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Sistem Rolu</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Bagli Firma</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Durum</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const branch = mapDbRoleToBranch(u);
                  const linkedName = getLinkedCustomerName(u.linked_customer_id);
                  return (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {(u as any).avatar_url ? (
                            <img src={(u as any).avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs ${
                              branch === 'super_admin' ? 'bg-gradient-to-br from-rose-500 to-rose-600' :
                              branch === 'beyaz_yaka' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                              branch === 'mavi_yaka' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                              branch === 'kiraci_yetkili' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                              'bg-gradient-to-br from-cyan-500 to-cyan-600'
                            }`}>
                              {u.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {u.full_name}
                              {u.id === currentUser?.id && <span className="ml-1.5 text-xs text-teal-600 font-normal">(Siz)</span>}
                            </p>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {u.email && !u.email.endsWith('@internal.fleet.local') && <p className="text-xs text-slate-600">{u.email}</p>}
                          {u.phone && <p className="text-xs text-slate-500">{u.phone}</p>}
                          {!u.email && !u.phone && <span className="text-xs text-slate-300">-</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openEditRoleModal(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${getBranchColor(branch)}`}
                        >
                          {getBranchIcon(branch)}
                          <span className="max-w-[120px] truncate">{getBranchLabel(branch).split('(')[0].trim()}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {linkedName ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {linkedName}
                          </span>
                        ) : <span className="text-xs text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => toggleActive(u)} className="group">
                          {u.is_active !== false ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 group-hover:bg-emerald-50 px-2 py-1 rounded-lg">
                              <CircleDot className="h-3 w-3" /> Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:bg-slate-100 px-2 py-1 rounded-lg">
                              <CircleOff className="h-3 w-3" /> Pasif
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openDossier(u)} className="p-1.5 hover:bg-teal-50 rounded-lg transition-colors" title="Ozluk Dosyasi">
                            <FolderOpen className="h-4 w-4 text-teal-600" />
                          </button>
                          <button onClick={() => openPasswordModal(u)} className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors" title="Sifre Sifirla">
                            <Key className="h-4 w-4 text-amber-600" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button onClick={() => handleDelete(u)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 bg-slate-50">
                <UsersIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {searchTerm || roleFilter !== 'all' ? 'Aramaniza uygun kullanici bulunamadi' : 'Henuz kullanici yok'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === CREATE USER MODAL (TABBED) === */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Yeni Kullanici Tanimla" size="lg">
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-200 -mx-1 overflow-x-auto">
            {formTabs.map(tab => {
              const Icon = tab.icon;
              const active = formTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFormTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active ? 'border-teal-500 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: General */}
          {formTab === 'general' && (
            <div className="space-y-4">
              <div className="flex items-start gap-5">
                <AvatarUpload
                  url={formData.avatar_url}
                  onUpload={(url) => setFormData({ ...formData, avatar_url: url })}
                />
                <div className="flex-1 space-y-4">
                  <Input
                    label="Ad Soyad *"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ahmet Yilmaz"
                  />
                  <Input
                    label="E-posta"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ornek@email.com"
                  />
                </div>
              </div>

              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="05XX XXX XX XX"
              />

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Sistem Rolu *</label>
                <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {systemRoleOptions.map(opt => {
                    if (opt.value === 'super_admin' && !isSuperAdmin) return null;
                    const Icon = opt.icon;
                    const selected = formData.system_role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, system_role: opt.value, linked_customer_id: '' })}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                          selected ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${opt.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800">{opt.label}</p>
                          <p className="text-[10px] text-slate-500">{opt.description}</p>
                        </div>
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                        }`}>
                          {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Linked Customer */}
              {(formData.system_role === 'kiraci_yetkili' || formData.system_role === 'kiraci_sofor') && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-green-700" />
                    <span className="text-xs font-semibold text-green-800">Bagli Oldugu Musteri Firma *</span>
                  </div>
                  <Select
                    value={formData.linked_customer_id}
                    onChange={(e) => setFormData({ ...formData, linked_customer_id: e.target.value })}
                  >
                    <option value="">Firma secin...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_title}{c.authorized_person ? ` - ${c.authorized_person}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Credentials */}
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Giris Bilgileri</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Kullanici Adi *"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
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

              {/* Active Toggle */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${formData.is_active ? 'bg-teal-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${formData.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-slate-700">Hesap {formData.is_active ? 'aktif' : 'pasif'} olarak olusturulacak</span>
              </div>
            </div>
          )}

          {/* Tab 2: Documents */}
          {formTab === 'documents' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-xs text-blue-700">Hukuki belgeleri buraya yukleyerek dijital ozluk dosyasini olusturun. Belgeler guvenli Supabase Storage'a kaydedilir.</p>
              </div>
              <FileDropzone
                label="Kimlik Gorseli / PDF"
                value={formData.identity_doc_url}
                onUpload={(url) => setFormData({ ...formData, identity_doc_url: url })}
              />
              <FileDropzone
                label="SGK Ise Giris Bildirgesi"
                value={formData.sgk_doc_url}
                onUpload={(url) => setFormData({ ...formData, sgk_doc_url: url })}
              />
              <FileDropzone
                label="Adli Sicil Kaydi (Sabika)"
                value={formData.sabika_kaydi_url}
                onUpload={(url) => setFormData({ ...formData, sabika_kaydi_url: url })}
              />
              <FileDropzone
                label="Nufus Kayit Ornegi Yukle"
                value={formData.nufus_kayit_url}
                onUpload={(url) => setFormData({ ...formData, nufus_kayit_url: url })}
              />
              <FileDropzone
                label="Ikametgah Belgesi Yukle"
                value={formData.ikametgah_url}
                onUpload={(url) => setFormData({ ...formData, ikametgah_url: url })}
              />
              <FileDropzone
                label="ISG (Is Sagligi ve Guvenligi) Belgesi Yukle"
                value={formData.isg_documents_url}
                onUpload={(url) => setFormData({ ...formData, isg_documents_url: url })}
              />
            </div>
          )}

          {/* Tab 3: Driver & License */}
          {formTab === 'driver' && (
            <div className="space-y-4">
              {!isDriverRole && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs text-amber-700">Bu bolum sofor veya saha personeli rolleri icin daha onemlidir ancak tum kullanicilar icin doldurulabilir.</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Ehliyet Sinifi"
                  value={formData.ehliyet_class}
                  onChange={(e) => setFormData({ ...formData, ehliyet_class: e.target.value })}
                  options={ehliyetClassOptions}
                />
                <Input
                  label="Ehliyet Son Gecerlilik Tarihi"
                  type="date"
                  value={formData.ehliyet_expiry_date}
                  onChange={(e) => setFormData({ ...formData, ehliyet_expiry_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="SRC Belge No"
                  value={formData.src_document_no}
                  onChange={(e) => setFormData({ ...formData, src_document_no: e.target.value })}
                  placeholder="SRC numarasi"
                />
                <Select
                  label="Psikoteknik Durumu"
                  value={formData.psikoteknik_status}
                  onChange={(e) => setFormData({ ...formData, psikoteknik_status: e.target.value })}
                  options={[
                    { value: '', label: 'Secin...' },
                    { value: 'gecerli', label: 'Gecerli' },
                    { value: 'suresi_dolmus', label: 'Suresi Dolmus' },
                    { value: 'yok', label: 'Belgesi Yok' },
                  ]}
                />
              </div>
              <FileDropzone
                label="Ehliyet On/Arka Yuzu Gorseli"
                value={formData.ehliyet_doc_url}
                onUpload={(url) => setFormData({ ...formData, ehliyet_doc_url: url })}
              />
              <Input
                label="ISG Egitim Tarihi"
                type="date"
                value={formData.isg_training_date}
                onChange={(e) => setFormData({ ...formData, isg_training_date: e.target.value })}
              />
            </div>
          )}

          {/* Tab 4: Health & Emergency */}
          {formTab === 'health' && (
            <div className="space-y-4">
              <Select
                label="Kan Grubu"
                value={formData.blood_type}
                onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })}
                options={bloodTypeOptions}
              />
              <Input
                label="Ev Adresi"
                value={formData.home_address}
                onChange={(e) => setFormData({ ...formData, home_address: e.target.value })}
                placeholder="Tam ev adresi"
              />
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Acil Durum Iletisim</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Yakininin Adi Soyadi"
                    value={formData.emergency_contact_name}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                    placeholder="Yakin kisi adi"
                  />
                  <Input
                    label="Yakininin Telefonu"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                    placeholder="05XX XXX XX XX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              Kullanici Olustur
            </Button>
          </div>
        </div>
      </Modal>

      {/* === PERSONNEL DOSSIER MODAL === */}
      <Modal isOpen={showDossier} onClose={() => setShowDossier(false)} title="Ozluk Dosyasi" size="lg">
        {dossierUser && <DossierView user={dossierUser} getLinkedCustomerName={getLinkedCustomerName} getBranchLabel={getBranchLabel} getBranchColor={getBranchColor} getBranchIcon={getBranchIcon} />}
      </Modal>

      {/* === CHANGE ROLE MODAL === */}
      <Modal isOpen={showEditRoleModal} onClose={() => setShowEditRoleModal(false)} title="Rol Degistir">
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-white font-semibold text-sm">
                {editingUser?.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{editingUser?.full_name}</p>
                <p className="text-sm text-slate-500">@{editingUser?.username}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {systemRoleOptions.map(opt => {
              if (opt.value === 'super_admin' && !isSuperAdmin) return null;
              const Icon = opt.icon;
              const selected = editBranch === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditBranch(opt.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selected ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${opt.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className={`text-sm font-medium ${selected ? 'text-teal-900' : 'text-slate-700'}`}>{opt.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowEditRoleModal(false)} className="flex-1">Iptal</Button>
            <Button onClick={handleSaveRole} loading={savingRole} className="flex-1">Rolu Guncelle</Button>
          </div>
        </div>
      </Modal>

      {/* === PASSWORD MODAL === */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title={`Sifre Sifirla: ${passwordUser?.full_name}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-medium">@{passwordUser?.username}</span> kullanicisinin sifresini degistirmek uzeresiniz.
          </p>
          <Input label="Yeni Sifre" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 6 karakter" />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)} className="flex-1">Iptal</Button>
            <Button onClick={handlePasswordReset} loading={savingPassword} className="flex-1">Sifreyi Guncelle</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function DossierView({ user, getLinkedCustomerName, getBranchLabel, getBranchColor, getBranchIcon }: {
  user: AppUser;
  getLinkedCustomerName: (id: string | null) => string | null;
  getBranchLabel: (b: SystemRoleBranch) => string;
  getBranchColor: (b: SystemRoleBranch) => string;
  getBranchIcon: (b: SystemRoleBranch) => React.ReactNode;
}) {
  const u = user as any;
  const branch = mapDbRoleToBranch(user);
  const linkedName = getLinkedCustomerName(user.linked_customer_id);

  function DocLink({ label, url }: { label: string; url: string | null }) {
    if (!url) return (
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-xs text-slate-400 italic">Belge Bulunmamaktadir</span>
      </div>
    );
    return (
      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-teal-300 transition-colors">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Goruntule
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
        {u.avatar_url ? (
          <img src={u.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-sm" />
        ) : (
          <div className={`h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-lg ${
            branch === 'super_admin' ? 'bg-gradient-to-br from-rose-500 to-rose-600' :
            branch === 'beyaz_yaka' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
            branch === 'mavi_yaka' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
            branch === 'kiraci_yetkili' ? 'bg-gradient-to-br from-green-500 to-green-600' :
            'bg-gradient-to-br from-cyan-500 to-cyan-600'
          }`}>
            {user.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">{user.full_name}</h3>
          <p className="text-sm text-slate-500">@{user.username}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getBranchColor(branch)}`}>
              {getBranchIcon(branch)}
              {getBranchLabel(branch).split('(')[0].trim()}
            </span>
            {linkedName && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                <Building2 className="h-3 w-3" /> {linkedName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {user.email && !user.email.endsWith('@internal.fleet.local') && (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <FileText className="h-4 w-4 text-slate-400" /> {user.email}
          </div>
        )}
        {user.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Phone className="h-4 w-4 text-slate-400" /> {user.phone}
          </div>
        )}
        {u.home_address && (
          <div className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" /> {u.home_address}
          </div>
        )}
      </div>

      {/* Health & Emergency */}
      {(u.blood_type || u.emergency_contact_name) && (
        <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Saglik & Acil Durum
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {u.blood_type && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Kan Grubu</p>
                <p className="text-sm font-semibold text-red-700">{u.blood_type}</p>
              </div>
            )}
            {u.emergency_contact_name && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Acil Iletisim</p>
                <p className="text-sm font-medium text-slate-800">{u.emergency_contact_name}</p>
              </div>
            )}
            {u.emergency_contact_phone && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Acil Telefon</p>
                <p className="text-sm font-medium text-slate-800">{u.emergency_contact_phone}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver Info */}
      {(u.ehliyet_class || u.ehliyet_expiry_date || u.src_document_no || u.isg_training_date) && (
        <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5" /> Soforluk Bilgileri
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {u.ehliyet_class && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Ehliyet Sinifi</p>
                <p className="text-sm font-semibold text-slate-800">{u.ehliyet_class}</p>
              </div>
            )}
            {u.ehliyet_expiry_date && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Ehliyet Bitis</p>
                <p className="text-sm font-medium text-slate-800">{u.ehliyet_expiry_date}</p>
              </div>
            )}
            {u.src_document_no && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">SRC No</p>
                <p className="text-sm font-medium text-slate-800">{u.src_document_no}</p>
              </div>
            )}
            {u.psikoteknik_status && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Psikoteknik</p>
                <p className="text-sm font-medium text-slate-800 capitalize">{u.psikoteknik_status.replace('_', ' ')}</p>
              </div>
            )}
            {u.isg_training_date && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase">ISG Egitim</p>
                <p className="text-sm font-medium text-slate-800">{u.isg_training_date}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Belge Arsivi</p>
        <DocLink label="Kimlik Belgesi" url={u.identity_doc_url} />
        <DocLink label="Ehliyet Gorseli" url={u.ehliyet_doc_url} />
        <DocLink label="SGK Ise Giris Bildirgesi" url={u.sgk_doc_url} />
        <DocLink label="Adli Sicil Kaydi" url={u.sabika_kaydi_url} />
        <DocLink label="Nufus Kayit Ornegi" url={u.nufus_kayit_url} />
        <DocLink label="Ikametgah Belgesi" url={u.ikametgah_url} />
        <DocLink label="ISG Evraki" url={u.isg_documents_url} />
      </div>
    </div>
  );
}
