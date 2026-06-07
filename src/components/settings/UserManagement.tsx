import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Key, User, Shield, ShieldCheck, Car, UserCheck,
  UserCog, Truck, Search, CircleDot, CircleOff, Building2,
  Crown, Briefcase, HardHat, Users as UsersIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AppUser, UserRole } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/auditLog';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';

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
  driver_license_no: string;
  driver_license_expiry: string;
  is_active: boolean;
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
  driver_license_no: '',
  driver_license_expiry: '',
  is_active: true,
};

const systemRoleOptions: { value: SystemRoleBranch; label: string; description: string; icon: React.ElementType; color: string }[] = [
  { value: 'super_admin', label: 'Super Admin / Firma Sahibi', description: 'Tum sisteme tam erisim', icon: Crown, color: 'bg-rose-100 text-rose-700' },
  { value: 'beyaz_yaka', label: 'Beyaz Yaka (Ofis Calisani)', description: 'Filo, finans, onay ve zamanlama erisimi', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { value: 'mavi_yaka', label: 'DMK Saha Personeli (Mavi Yaka)', description: 'Mobil operasyonel gorev paneline erisim', icon: HardHat, color: 'bg-amber-100 text-amber-700' },
  { value: 'kiraci_yetkili', label: 'Kiraci Firma Yetkilisi', description: 'Musteri portali yonetici erisimi', icon: Building2, color: 'bg-green-100 text-green-700' },
  { value: 'kiraci_sofor', label: 'Kiraci Soforu', description: 'KM kaydi, fiş yükleme ve dijital canta', icon: Car, color: 'bg-cyan-100 text-cyan-700' },
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
  if (user.role === 'super_admin' || (user.role === 'admin' && user.title === 'Super Admin')) return 'super_admin';
  if (user.role === 'admin') return 'super_admin';
  if (user.role === 'staff') return 'beyaz_yaka';
  if (user.role === 'driver' && user.driver_type === 'employee') return 'mavi_yaka';
  if (user.role === 'driver' && user.driver_type === 'tenant') return 'kiraci_sofor';
  if (user.role === 'customer') return 'kiraci_yetkili';
  return 'beyaz_yaka';
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Yonetici',
  staff: 'Personel',
  user: 'Kullanici',
  customer: 'Musteri',
  driver: 'Surucu',
};

export default function UserManagement() {
  const { user: currentUser, effectiveCompanyId: companyId, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<UserFormData>(emptyForm);
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

    const branch = mapDbRoleToBranch(u);
    return matchesSearch && branch === roleFilter;
  });

  const branchCounts = users.reduce((acc, u) => {
    const branch = mapDbRoleToBranch(u);
    acc[branch] = (acc[branch] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function openAddForm() {
    setFormData(emptyForm);
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
      return;
    }

    if (formData.password.length < 6) {
      setError('Sifre en az 6 karakter olmalidir');
      return;
    }

    if ((formData.system_role === 'kiraci_yetkili' || formData.system_role === 'kiraci_sofor') && !formData.linked_customer_id) {
      setError('Kiraci rolleri icin "Bagli Oldugu Musteri Firma" secimi zorunludur');
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

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('app_users')
          .update(updatePayload)
          .eq('id', result.user_id);
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
    await supabase
      .from('app_users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    loadData();
  }

  async function handleDelete(user: AppUser) {
    if (user.id === currentUser?.id) {
      alert('Kendinizi silemezsiniz!');
      return;
    }
    if (!confirm(`"${user.full_name}" kullanicisini silmek istediginize emin misiniz?`)) return;

    await logActivity({
      action: 'DELETE',
      entity: 'User',
      entityId: user.id,
      details: `Kullanici silindi: ${user.full_name} (${user.username})`,
      userEmail: currentUser?.email,
      companyId: companyId,
    });

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
    if (newPassword.length < 6) {
      alert('Sifre en az 6 karakter olmalidir');
      return;
    }
    setSavingPassword(true);

    const { error } = await supabase
      .from('app_users')
      .update({ password: newPassword })
      .eq('id', passwordUser.id);

    if (error) {
      alert('Sifre guncellenirken bir hata olustu');
    } else {
      setShowPasswordModal(false);
      setPasswordUser(null);
      setNewPassword('');
    }
    setSavingPassword(false);
  }

  function getLinkedCustomerName(customerId: string | null) {
    if (!customerId) return null;
    const c = customers.find(cust => cust.id === customerId);
    return c?.company_title || null;
  }

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
            <button
              onClick={() => setRoleFilter('all')}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Filtreyi Temizle
            </button>
          )}
          <span className="text-xs text-slate-400">
            {filteredUsers.length} / {users.length} kullanici
          </span>
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
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs ${
                            branch === 'super_admin' ? 'bg-gradient-to-br from-rose-500 to-rose-600' :
                            branch === 'beyaz_yaka' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                            branch === 'mavi_yaka' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                            branch === 'kiraci_yetkili' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                            'bg-gradient-to-br from-cyan-500 to-cyan-600'
                          }`}>
                            {u.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {u.full_name}
                              {u.id === currentUser?.id && (
                                <span className="ml-1.5 text-xs text-teal-600 font-normal">(Siz)</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {u.email && !u.email.endsWith('@internal.fleet.local') && (
                            <p className="text-xs text-slate-600">{u.email}</p>
                          )}
                          {u.phone && (
                            <p className="text-xs text-slate-500">{u.phone}</p>
                          )}
                          {!u.email && !u.phone && (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openEditRoleModal(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${getBranchColor(branch)}`}
                          title="Rolu degistirmek icin tiklayin"
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
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleActive(u)}
                          className="group"
                          title={u.is_active !== false ? 'Deaktif etmek icin tikla' : 'Aktif etmek icin tikla'}
                        >
                          {u.is_active !== false ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 group-hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors">
                              <CircleDot className="h-3 w-3" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors">
                              <CircleOff className="h-3 w-3" />
                              Pasif
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openPasswordModal(u)}
                            className="p-1.5 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Sifre Sifirla"
                          >
                            <Key className="h-4 w-4 text-amber-600" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="Sil"
                            >
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

      {/* Create User Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Yeni Kullanici Tanimla"
        size="lg"
      >
        <div className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* System Role Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Sistem Rolu / Kullanici Turu *
            </label>
            <div className="grid grid-cols-1 gap-2">
              {systemRoleOptions.map(opt => {
                if (opt.value === 'super_admin' && !isSuperAdmin) return null;
                const Icon = opt.icon;
                const selected = formData.system_role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, system_role: opt.value, linked_customer_id: '' })}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-200'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${opt.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${selected ? 'text-teal-900' : 'text-slate-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-500">{opt.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selected ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                    }`}>
                      {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked Customer (conditional) */}
          {(formData.system_role === 'kiraci_yetkili' || formData.system_role === 'kiraci_sofor') && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-700" />
                <span className="text-sm font-semibold text-green-800">Bagli Oldugu Musteri Firma *</span>
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
              <p className="text-xs text-green-600">
                {formData.system_role === 'kiraci_yetkili'
                  ? 'Bu kullanici secilen firmanin portali uzerinden islem yapabilecektir.'
                  : 'Bu sofor secilen firmaya bagli olarak KM, yakıt ve fiş bildirimi yapabilecektir.'}
              </p>
            </div>
          )}

          {/* Name & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ad Soyad *"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ahmet Yilmaz"
            />
            <Input
              label="Telefon"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="05XX XXX XX XX"
            />
          </div>

          <Input
            label="E-posta"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="ornek@email.com"
          />

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

          {/* Driver License (for mavi_yaka and kiraci_sofor) */}
          {(formData.system_role === 'mavi_yaka' || formData.system_role === 'kiraci_sofor') && (
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Ehliyet Bilgileri</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Ehliyet Numarasi"
                  value={formData.driver_license_no}
                  onChange={(e) => setFormData({ ...formData, driver_license_no: e.target.value })}
                  placeholder="Surucu ehliyet no"
                />
                <Input
                  label="Ehliyet Gecerlilik Tarihi"
                  type="date"
                  value={formData.driver_license_expiry}
                  onChange={(e) => setFormData({ ...formData, driver_license_expiry: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`relative w-10 h-5 rounded-full transition-colors ${formData.is_active ? 'bg-teal-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${formData.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-slate-700">
              Hesap {formData.is_active ? 'aktif' : 'pasif'} olarak olusturulacak
            </span>
          </div>

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

      {/* Change Role Modal */}
      <Modal
        isOpen={showEditRoleModal}
        onClose={() => setShowEditRoleModal(false)}
        title="Rol Degistir"
      >
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
                  <span className={`text-sm font-medium ${selected ? 'text-teal-900' : 'text-slate-700'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowEditRoleModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSaveRole} loading={savingRole} className="flex-1">
              Rolu Guncelle
            </Button>
          </div>
        </div>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={`Sifre Sifirla: ${passwordUser?.full_name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-medium">@{passwordUser?.username}</span> kullanicisinin sifresini degistirmek uzeresiniz.
          </p>
          <Input
            label="Yeni Sifre"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="En az 6 karakter"
          />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handlePasswordReset} loading={savingPassword} className="flex-1">
              Sifreyi Guncelle
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
