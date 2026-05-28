import { useState, useEffect } from 'react';
import { Plus, Trash2, Key, User, Shield, ShieldCheck, Car, UserCheck, UserCog, Truck, Search, CircleDot, CircleOff } from 'lucide-react';
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

interface UserFormData {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone: string;
  title: string;
  role: UserRole;
  assigned_rep_id: string;
  linked_customer_id: string;
  driver_license_no: string;
  driver_license_expiry: string;
}

const emptyForm: UserFormData = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  title: '',
  role: 'user',
  assigned_rep_id: '',
  linked_customer_id: '',
  driver_license_no: '',
  driver_license_expiry: '',
};

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Yonetici',
  staff: 'Personel',
  user: 'Kullanici',
  customer: 'Musteri',
  driver: 'Surucu',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-700',
  admin: 'bg-amber-100 text-amber-700',
  staff: 'bg-blue-100 text-blue-700',
  user: 'bg-slate-100 text-slate-700',
  customer: 'bg-green-100 text-green-700',
  driver: 'bg-cyan-100 text-cyan-700',
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
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [savingRole, setSavingRole] = useState(false);

  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [customerEditData, setCustomerEditData] = useState<{
    phone: string;
    title: string;
    assigned_rep_id: string;
    linked_customer_id: string;
  }>({ phone: '', title: '', assigned_rep_id: '', linked_customer_id: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const staffMembers = users.filter(u => u.role === 'admin' || u.role === 'staff');

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
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function openAddForm() {
    setFormData(emptyForm);
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.username || !formData.password || !formData.full_name) {
      setError('Ad Soyad, Kullanici Adi ve Gecici Sifre zorunludur');
      return;
    }

    if ((formData.role === 'customer' || formData.role === 'driver') && !formData.email) {
      setError('Musteri ve surucu hesaplari icin e-posta adresi gereklidir');
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
      p_title: formData.title || null,
      p_role: formData.role,
      p_company_id: companyId,
      p_assigned_rep_id: formData.assigned_rep_id || null,
      p_driver_license_no: formData.driver_license_no || null,
      p_driver_license_expiry: formData.driver_license_expiry || null,
    });

    if (rpcError) {
      console.error('User creation error:', rpcError.message);
      setError('Kullanici eklenirken bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    if (result && !result.success) {
      setError(result.error || 'Kullanici eklenirken bir hata olustu');
      setSaving(false);
      return;
    }

    if (formData.role === 'customer' && formData.linked_customer_id && result?.user_id) {
      await supabase
        .from('app_users')
        .update({ linked_customer_id: formData.linked_customer_id })
        .eq('id', result.user_id);
    }

    await logActivity({
      action: 'CREATE',
      entity: 'User',
      entityId: result?.user_id || null,
      details: `Yeni kullanici olusturuldu: ${formData.full_name} (${formData.username}) - Rol: ${roleLabels[formData.role]}`,
      userEmail: currentUser?.email,
      companyId: companyId,
    });

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  function openEditRoleModal(user: AppUser) {
    setEditingUser(user);
    setEditRole(user.role);
    setShowEditRoleModal(true);
  }

  async function handleSaveRole() {
    if (!editingUser) return;
    setSavingRole(true);

    const { error } = await supabase
      .from('app_users')
      .update({ role: editRole })
      .eq('id', editingUser.id);

    if (error) {
      alert('Rol guncellenirken bir hata olustu');
    } else {
      await logActivity({
        action: 'UPDATE',
        entity: 'User',
        entityId: editingUser.id,
        details: `Kullanici rolu degistirildi: ${editingUser.full_name} - ${roleLabels[editingUser.role]} -> ${roleLabels[editRole]}`,
        userEmail: currentUser?.email,
        companyId: companyId,
      });
      setShowEditRoleModal(false);
      setEditingUser(null);
      loadData();
    }
    setSavingRole(false);
  }

  function openEditCustomerModal(user: AppUser) {
    setEditingUser(user);
    setCustomerEditData({
      phone: user.phone || '',
      title: user.title || '',
      assigned_rep_id: user.assigned_rep_id || '',
      linked_customer_id: user.linked_customer_id || '',
    });
    setShowEditCustomerModal(true);
  }

  async function handleSaveCustomer() {
    if (!editingUser) return;
    setSavingCustomer(true);

    const { error } = await supabase
      .from('app_users')
      .update({
        phone: customerEditData.phone || null,
        title: customerEditData.title || null,
        assigned_rep_id: customerEditData.assigned_rep_id || null,
        linked_customer_id: customerEditData.linked_customer_id || null,
      })
      .eq('id', editingUser.id);

    if (error) {
      alert('Kullanici guncellenirken bir hata olustu');
    } else {
      const repName = staffMembers.find(s => s.id === customerEditData.assigned_rep_id)?.full_name || 'Atanmadi';
      await logActivity({
        action: 'UPDATE',
        entity: 'User',
        entityId: editingUser.id,
        details: `Musteri bilgileri guncellendi: ${editingUser.full_name} - Temsilci: ${repName}`,
        userEmail: currentUser?.email,
        companyId: companyId,
      });
      setShowEditCustomerModal(false);
      setEditingUser(null);
      loadData();
    }
    setSavingCustomer(false);
  }

  function getRepName(repId: string | null) {
    if (!repId) return null;
    const rep = users.find(u => u.id === repId);
    return rep?.full_name || null;
  }

  function getLinkedCustomerName(customerId: string | null) {
    if (!customerId) return null;
    const c = customers.find(cust => cust.id === customerId);
    return c?.company_title || null;
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
      details: `Kullanici silindi: ${user.full_name} (${user.username}) - ${user.role}`,
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

  function getRoleIcon(role: UserRole) {
    switch (role) {
      case 'super_admin': return <Shield className="h-3 w-3" />;
      case 'admin': return <ShieldCheck className="h-3 w-3" />;
      case 'staff': return <UserCheck className="h-3 w-3" />;
      case 'customer': return <Car className="h-3 w-3" />;
      case 'driver': return <Truck className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <UserCog className="h-5 w-5 text-teal-600" />
              Kullanici Yonetimi
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sisteme giris yapabilecek kullanicilari yonetin
            </p>
          </div>
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kullanici Ekle
          </Button>
        </div>

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
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                roleFilter === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tumu ({users.length})
            </button>
            {(['admin', 'staff', 'user', 'customer', 'driver'] as UserRole[]).map(role => (
              (roleCounts[role] || 0) > 0 && (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === role ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {roleLabels[role]} ({roleCounts[role]})
                </button>
              )
            ))}
          </div>
        </div>

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
                  <th className="text-left py-3 px-4 font-medium text-slate-600">E-posta</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Rol</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Durum</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs ${
                          u.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                          u.role === 'staff' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          u.role === 'customer' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                          u.role === 'driver' ? 'bg-gradient-to-br from-cyan-500 to-cyan-600' :
                          'bg-gradient-to-br from-slate-500 to-slate-600'
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
                    <td className="py-3 px-4 text-slate-600">
                      {u.email && !u.email.endsWith('@internal.fleet.local')
                        ? u.email
                        : <span className="text-xs text-slate-300">-</span>
                      }
                    </td>
                    <td className="py-3 px-4">
                      {u.role === 'super_admin' && !isSuperAdmin ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${roleColors[u.role]}`}>
                          {getRoleIcon(u.role)}
                          {roleLabels[u.role]}
                        </span>
                      ) : (
                        <button
                          onClick={() => openEditRoleModal(u)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${roleColors[u.role]}`}
                          title="Rolu degistirmek icin tiklayin"
                        >
                          {getRoleIcon(u.role)}
                          {roleLabels[u.role]}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active !== false ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CircleDot className="h-3 w-3" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                          <CircleOff className="h-3 w-3" />
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {u.role === 'super_admin' && !isSuperAdmin ? (
                          <span className="text-xs text-slate-400">--</span>
                        ) : (
                          <>
                            {u.role === 'customer' && (
                              <button
                                onClick={() => openEditCustomerModal(u)}
                                className="p-1.5 hover:bg-teal-50 rounded-lg transition-colors"
                                title="Musteri Detaylari"
                              >
                                <UserCog className="h-4 w-4 text-teal-600" />
                              </button>
                            )}
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 bg-slate-50">
                <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  {searchTerm || roleFilter !== 'all' ? 'Aramaniza uygun kullanici bulunamadi' : 'Henuz kullanici yok'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Yeni Kullanici Ekle"
        size="lg"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ad Soyad"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Ornek: Ahmet Yilmaz"
            />
            <Input
              label="E-posta"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ornek@email.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kullanici Adi"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              placeholder="ornek: ahmetyilmaz"
            />
            <Input
              label="Gecici Sifre"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="En az 6 karakter"
            />
          </div>

          <Select
            label="Rol"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
          >
            <option value="user">Kullanici</option>
            <option value="staff">Personel</option>
            <option value="admin">Yonetici (Admin)</option>
            <option value="customer">Musteri</option>
            <option value="driver">Surucu</option>
            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
          </Select>

          {formData.role === 'customer' && (
            <>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  Musteri hesabi olusturuyorsunuz. Bu kullanici Musteri Portalina giris yapabilecek ve kendisine atanan araclari gorebilecek.
                </p>
              </div>

              <Select
                label="Musteri Firmasi Sec"
                value={formData.linked_customer_id}
                onChange={(e) => setFormData({ ...formData, linked_customer_id: e.target.value })}
              >
                <option value="">Musteri firmasi secin (opsiyonel)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_title}{c.authorized_person ? ` - ${c.authorized_person}` : ''}
                  </option>
                ))}
              </Select>

              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 5XX XXX XX XX"
              />

              <Select
                label="Musteri Temsilcisi"
                value={formData.assigned_rep_id}
                onChange={(e) => setFormData({ ...formData, assigned_rep_id: e.target.value })}
              >
                <option value="">Temsilci Sec (Opsiyonel)</option>
                {staffMembers.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({roleLabels[s.role]})</option>
                ))}
              </Select>
            </>
          )}

          {formData.role === 'driver' && (
            <>
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                <p className="text-sm text-cyan-700">
                  Surucu hesabi olusturuyorsunuz. Suruculer sadece kendi atandiklari araci gorebilir ve kaza/yakit bildirimi yapabilir.
                </p>
              </div>

              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 5XX XXX XX XX"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Ehliyet Numarasi"
                  value={formData.driver_license_no}
                  onChange={(e) => setFormData({ ...formData, driver_license_no: e.target.value })}
                  placeholder="Surucu ehliyet numarasi"
                />
                <Input
                  label="Ehliyet Gecerlilik Tarihi"
                  type="date"
                  value={formData.driver_license_expiry}
                  onChange={(e) => setFormData({ ...formData, driver_license_expiry: e.target.value })}
                />
              </div>
            </>
          )}

          {(formData.role === 'staff' || formData.role === 'admin') && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+90 5XX XXX XX XX"
              />
              <Input
                label="Unvan"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ornek: Musteri Temsilcisi"
              />
            </div>
          )}

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

      <Modal
        isOpen={showEditRoleModal}
        onClose={() => setShowEditRoleModal(false)}
        title={`Rol Degistir: ${editingUser?.full_name}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                editingUser?.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-amber-600' :
                editingUser?.role === 'customer' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                'bg-gradient-to-br from-slate-500 to-slate-600'
              }`}>
                {editingUser?.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{editingUser?.full_name}</p>
                <p className="text-sm text-slate-500">@{editingUser?.username}</p>
              </div>
            </div>
          </div>

          <Select
            label="Yeni Rol"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as UserRole)}
          >
            <option value="user">Kullanici</option>
            <option value="staff">Personel</option>
            <option value="admin">Yonetici (Admin)</option>
            <option value="customer">Musteri</option>
            <option value="driver">Surucu</option>
            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
          </Select>

          {editRole === 'customer' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                Musteri hesabi olusturuluyor. Bu kullanici Musteri Portalina giris yapabilecek ve kendisine atanan araclari gorebilecek.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEditRoleModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSaveRole} loading={savingRole} className="flex-1">
              Rolu Guncelle
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditCustomerModal}
        onClose={() => setShowEditCustomerModal(false)}
        title={`Musteri Detaylari: ${editingUser?.full_name}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-sm">
                {editingUser?.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="font-medium text-slate-900">{editingUser?.full_name}</p>
                <p className="text-sm text-slate-500">{editingUser?.email || editingUser?.username}</p>
              </div>
            </div>
          </div>

          <Select
            label="Bagli Musteri Firmasi"
            value={customerEditData.linked_customer_id}
            onChange={(e) => setCustomerEditData({ ...customerEditData, linked_customer_id: e.target.value })}
          >
            <option value="">Musteri firmasi secin</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.company_title}{c.authorized_person ? ` - ${c.authorized_person}` : ''}
              </option>
            ))}
          </Select>

          <Input
            label="Telefon"
            value={customerEditData.phone}
            onChange={(e) => setCustomerEditData({ ...customerEditData, phone: e.target.value })}
            placeholder="+90 5XX XXX XX XX"
          />

          <Input
            label="Unvan / Sirket"
            value={customerEditData.title}
            onChange={(e) => setCustomerEditData({ ...customerEditData, title: e.target.value })}
            placeholder="Ornek: ABC Lojistik A.S."
          />

          <Select
            label="Musteri Temsilcisi"
            value={customerEditData.assigned_rep_id}
            onChange={(e) => setCustomerEditData({ ...customerEditData, assigned_rep_id: e.target.value })}
          >
            <option value="">Temsilci Sec</option>
            {staffMembers.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} ({roleLabels[s.role]})</option>
            ))}
          </Select>

          {customerEditData.assigned_rep_id && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
              <p className="text-sm text-teal-700">
                Secilen temsilci, musterinin Self-Servis Portalinda goruntulenecektir.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEditCustomerModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSaveCustomer} loading={savingCustomer} className="flex-1">
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
