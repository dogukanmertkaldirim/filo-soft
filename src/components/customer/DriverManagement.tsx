import { useState, useEffect } from 'react';
import { User, Phone, Plus, CreditCard as Edit2, Trash2, X, Check, Users, Car, UserPlus, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Driver {
  id: string;
  driver_name: string;
  driver_phone: string | null;
  driver_license_no: string | null;
  notes: string | null;
  is_active: boolean;
}

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  photo_url: string | null;
}

interface Assignment {
  id: string;
  vehicle_id: string;
  driver_id: string;
  driver?: Driver;
}

interface Props {
  userId: string;
  companyId: string;
  vehicles: Vehicle[];
  onAssignmentChange?: () => void;
}

export default function DriverManagement({ userId, companyId, vehicles, onAssignmentChange }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [driverForm, setDriverForm] = useState({
    driver_name: '',
    driver_phone: '',
    driver_license_no: '',
    driver_license_expiry: '',
    notes: '',
    create_login: false,
    email: '',
    password: ''
  });

  useEffect(() => {
    loadData();
  }, [userId, companyId]);

  async function loadData() {
    const [driversRes, assignmentsRes] = await Promise.all([
      supabase
        .from('customer_drivers')
        .select('*')
        .eq('customer_id', userId)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('driver_name'),
      supabase
        .from('vehicle_driver_assignments')
        .select('*, driver:driver_id(*)')
        .eq('company_id', companyId)
        .eq('assigned_by', userId)
    ]);

    setDrivers(driversRes.data || []);
    setAssignments(assignmentsRes.data || []);
    setLoading(false);
  }

  async function handleSaveDriver(e: React.FormEvent) {
    e.preventDefault();

    if (!driverForm.driver_name.trim()) {
      alert('Surucu adi zorunludur');
      return;
    }

    if (driverForm.create_login) {
      if (!driverForm.email) {
        alert('Giris hesabi icin e-posta zorunludur');
        return;
      }
      if (!driverForm.password || driverForm.password.length < 6) {
        alert('Sifre en az 6 karakter olmalidir');
        return;
      }
    }

    setSaving(true);

    let appUserId: string | null = null;

    if (driverForm.create_login && !editingDriver) {
      const { data: userResult, error: userError } = await supabase.rpc('admin_create_user', {
        p_username: driverForm.email.split('@')[0] + '_driver',
        p_password: driverForm.password,
        p_full_name: driverForm.driver_name,
        p_email: driverForm.email,
        p_phone: driverForm.driver_phone || null,
        p_role: 'driver',
        p_company_id: companyId,
        p_driver_license_no: driverForm.driver_license_no || null,
        p_driver_license_expiry: driverForm.driver_license_expiry || null,
      });

      if (userError || (userResult && !userResult.success)) {
        console.error('Driver user creation error:', userResult?.error || userError?.message);
        alert('Surucu hesabi olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
        setSaving(false);
        return;
      }

      appUserId = userResult?.user_id || null;
    }

    if (editingDriver) {
      await supabase
        .from('customer_drivers')
        .update({
          driver_name: driverForm.driver_name,
          driver_phone: driverForm.driver_phone || null,
          driver_license_no: driverForm.driver_license_no || null,
          driver_license_expiry: driverForm.driver_license_expiry || null,
          notes: driverForm.notes || null
        })
        .eq('id', editingDriver.id);
    } else {
      await supabase.from('customer_drivers').insert({
        company_id: companyId,
        customer_id: userId,
        driver_name: driverForm.driver_name,
        driver_phone: driverForm.driver_phone || null,
        driver_license_no: driverForm.driver_license_no || null,
        driver_license_expiry: driverForm.driver_license_expiry || null,
        notes: driverForm.notes || null,
        app_user_id: appUserId
      });
    }

    setSaving(false);
    setShowDriverForm(false);
    setEditingDriver(null);
    setDriverForm({ driver_name: '', driver_phone: '', driver_license_no: '', driver_license_expiry: '', notes: '', create_login: false, email: '', password: '' });
    loadData();
  }

  async function handleDeleteDriver(driverId: string) {
    if (!confirm('Bu surucuyu silmek istediginize emin misiniz?')) return;

    await supabase
      .from('customer_drivers')
      .update({ is_active: false })
      .eq('id', driverId);

    await supabase
      .from('vehicle_driver_assignments')
      .delete()
      .eq('driver_id', driverId);

    loadData();
    onAssignmentChange?.();
  }

  function openEditDriver(driver: Driver) {
    setEditingDriver(driver);
    setDriverForm({
      driver_name: driver.driver_name,
      driver_phone: driver.driver_phone || '',
      driver_license_no: driver.driver_license_no || '',
      driver_license_expiry: '',
      notes: driver.notes || '',
      create_login: false,
      email: '',
      password: ''
    });
    setShowDriverForm(true);
  }

  function openAssignModal(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setShowAssignModal(true);
  }

  async function handleAssignDriver(driverId: string) {
    if (!selectedVehicle) return;

    setSaving(true);

    await supabase
      .from('vehicle_driver_assignments')
      .delete()
      .eq('vehicle_id', selectedVehicle.id)
      .eq('assigned_by', userId);

    if (driverId) {
      await supabase.from('vehicle_driver_assignments').insert({
        company_id: companyId,
        vehicle_id: selectedVehicle.id,
        driver_id: driverId,
        assigned_by: userId
      });
    }

    setSaving(false);
    setShowAssignModal(false);
    setSelectedVehicle(null);
    loadData();
    onAssignmentChange?.();
  }

  function getAssignedDriver(vehicleId: string): Driver | null {
    const assignment = assignments.find(a => a.vehicle_id === vehicleId);
    return assignment?.driver || null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-xl">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Surucu Yonetimi</h2>
                <p className="text-sm text-slate-500">{drivers.length} surucu kayitli</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingDriver(null);
                setDriverForm({ driver_name: '', driver_phone: '', driver_license_no: '', driver_license_expiry: '', notes: '', create_login: false, email: '', password: '' });
                setShowDriverForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Surucu Ekle
            </button>
          </div>
        </div>

        {drivers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Henuz surucu eklenmedi</p>
            <p className="text-sm text-slate-400 mt-1">Araclara atamak icin surucu ekleyin</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {drivers.map((driver) => (
              <div key={driver.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{driver.driver_name}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {driver.driver_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {driver.driver_phone}
                        </span>
                      )}
                      {driver.driver_license_no && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {driver.driver_license_no}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditDriver(driver)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleDeleteDriver(driver.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {vehicles.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-xl">
                <Car className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Arac - Surucu Eslestirme</h2>
                <p className="text-sm text-slate-500">Her araca bir surucu atayin</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {vehicles.map((vehicle) => {
              const assignedDriver = getAssignedDriver(vehicle.id);
              return (
                <div key={vehicle.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {vehicle.photo_url ? (
                      <img
                        src={vehicle.photo_url}
                        alt={vehicle.plate}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Car className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">{vehicle.plate}</p>
                      <p className="text-sm text-slate-500">{vehicle.brand} {vehicle.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {assignedDriver ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                        <User className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">{assignedDriver.driver_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Atanmadi</span>
                    )}
                    <button
                      onClick={() => openAssignModal(vehicle)}
                      className="px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                    >
                      {assignedDriver ? 'Degistir' : 'Surucu Ata'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showDriverForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <h3 className="text-lg font-semibold text-white">
                {editingDriver ? 'Surucu Duzenle' : 'Yeni Surucu Ekle'}
              </h3>
              <button
                onClick={() => {
                  setShowDriverForm(false);
                  setEditingDriver(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Surucu Adi *
                </label>
                <input
                  type="text"
                  value={driverForm.driver_name}
                  onChange={(e) => setDriverForm({ ...driverForm, driver_name: e.target.value })}
                  placeholder="Ad Soyad"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={driverForm.driver_phone}
                  onChange={(e) => setDriverForm({ ...driverForm, driver_phone: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ehliyet No
                </label>
                <input
                  type="text"
                  value={driverForm.driver_license_no}
                  onChange={(e) => setDriverForm({ ...driverForm, driver_license_no: e.target.value })}
                  placeholder="Ehliyet numarasi"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ehliyet Gecerlilik Tarihi
                </label>
                <input
                  type="date"
                  value={driverForm.driver_license_expiry}
                  onChange={(e) => setDriverForm({ ...driverForm, driver_license_expiry: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notlar
                </label>
                <textarea
                  value={driverForm.notes}
                  onChange={(e) => setDriverForm({ ...driverForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Ek bilgiler..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {!editingDriver && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={driverForm.create_login}
                      onChange={(e) => setDriverForm({ ...driverForm, create_login: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Surucu icin giris hesabi olustur
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1 ml-7">
                    Surucu kendi hesabiyla sisteme giris yapabilir
                  </p>

                  {driverForm.create_login && (
                    <div className="mt-3 space-y-3 p-3 bg-blue-50 rounded-xl">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          E-posta *
                        </label>
                        <input
                          type="email"
                          value={driverForm.email}
                          onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                          placeholder="surucu@email.com"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Sifre *
                        </label>
                        <input
                          type="password"
                          value={driverForm.password}
                          onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                          placeholder="En az 6 karakter"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDriverForm(false);
                    setEditingDriver(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                >
                  Iptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Kaydet
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-teal-700">
              <div>
                <h3 className="text-lg font-semibold text-white">Surucu Ata</h3>
                <p className="text-sm text-teal-100">{selectedVehicle.plate}</p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedVehicle(null);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              <button
                onClick={() => handleAssignDriver('')}
                disabled={saving}
                className="w-full p-3 text-left rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <X className="h-5 w-5 text-slate-400" />
                  </div>
                  <span className="text-sm text-slate-500">Atamayi Kaldir</span>
                </div>
              </button>

              {drivers.map((driver) => {
                const isAssigned = getAssignedDriver(selectedVehicle.id)?.id === driver.id;
                return (
                  <button
                    key={driver.id}
                    onClick={() => handleAssignDriver(driver.id)}
                    disabled={saving}
                    className={`w-full p-3 text-left rounded-xl border-2 transition-colors ${
                      isAssigned
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isAssigned ? 'bg-teal-100' : 'bg-slate-100'
                      }`}>
                        <User className={`h-5 w-5 ${isAssigned ? 'text-teal-600' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <p className={`font-medium ${isAssigned ? 'text-teal-700' : 'text-slate-900'}`}>
                          {driver.driver_name}
                        </p>
                        {driver.driver_phone && (
                          <p className="text-xs text-slate-500">{driver.driver_phone}</p>
                        )}
                      </div>
                      {isAssigned && (
                        <Check className="h-5 w-5 text-teal-600 ml-auto" />
                      )}
                    </div>
                  </button>
                );
              })}

              {drivers.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500">Surucu listesi bos</p>
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedVehicle(null);
                      setShowDriverForm(true);
                    }}
                    className="mt-2 text-sm text-teal-600 font-medium"
                  >
                    Yeni Surucu Ekle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
