import { useState, useEffect } from 'react';
import { Search, Users, Phone, ClipboardList, MapPin, FileText, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Driver } from '../types/database';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const statusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Pasif' },
];

export default function Drivers() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [employeeDrivers, setEmployeeDrivers] = useState<{ id: string; full_name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; brand: string; model: string }[]>([]);
  const [dispatchForm, setDispatchForm] = useState({ driver_id: '', vehicle_id: '', task_type: '', description: '', priority: 'normal' });

  useEffect(() => {
    if (companyId) loadDrivers();
  }, [companyId]);

  async function loadDrivers() {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name');
    setDrivers(data || []);
    setLoading(false);
  }

  async function openDispatchModal() {
    setShowDispatch(true);
    const [driversRes, vehiclesRes] = await Promise.all([
      supabase.from('app_users').select('id, full_name').eq('company_id', companyId).eq('role', 'driver').eq('driver_type', 'employee').eq('is_active', true),
      supabase.from('vehicles').select('id, plate, brand, model').eq('company_id', companyId).is('deleted_at', null),
    ]);
    setEmployeeDrivers(driversRes.data || []);
    setVehicles(vehiclesRes.data || []);
  }

  async function handleDispatchSave() {
    if (!dispatchForm.driver_id || !dispatchForm.task_type) {
      alert('Sofor ve gorev turu zorunludur');
      return;
    }
    setDispatchSaving(true);
    await supabase.from('operational_tasks').insert({
      company_id: companyId,
      assigned_driver_id: dispatchForm.driver_id,
      vehicle_id: dispatchForm.vehicle_id || null,
      task_type: dispatchForm.task_type,
      description: dispatchForm.description || null,
      priority: dispatchForm.priority,
      status: 'pending',
    });
    setDispatchSaving(false);
    setShowDispatch(false);
    setDispatchForm({ driver_id: '', vehicle_id: '', task_type: '', description: '', priority: 'normal' });
  }

  const allRegions = [...new Set(drivers.map(d => d.operation_region).filter(Boolean))] as string[];

  const filteredDrivers = drivers.filter(d => {
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterRegion && d.operation_region !== filterRegion) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        d.name.toLowerCase().includes(term) ||
        (d.phone || '').toLowerCase().includes(term) ||
        (d.operation_region || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const activeCount = drivers.filter(d => d.status === 'active').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl shadow-sm">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Soforler</h1>
            <p className="text-sm text-slate-500">Surucu kadrosu listesi</p>
          </div>
        </div>
        <Button variant="secondary" onClick={openDispatchModal}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Gorev Ata
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Sofor</p>
          <p className="text-2xl font-bold text-slate-900">{drivers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Aktif</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Bolge Sayisi</p>
          <p className="text-2xl font-bold text-sky-600">{allRegions.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ad, telefon, bolge ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <Select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              options={[
                { value: '', label: 'Tum Bolgeler' },
                ...allRegions.map(r => ({ value: r, label: r })),
              ]}
            />
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: '', label: 'Tum Durumlar' },
                ...statusOptions,
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">Henuz sofor kaydi yok</p>
            <p className="text-xs text-slate-400 mt-1">Soforler Ayarlar &gt; Kullanici Yonetimi uzerinden eklenir</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Sofor</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Telefon</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Operasyon Bolgesi</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Ehliyet Belgesi</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Durum</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => {
                  const hasLicenseDoc = !!driver.license_document_url;
                  const isLicenseImage = driver.license_document_url?.match(/\.(jpg|jpeg|png|webp|heic)/i);

                  return (
                    <tr key={driver.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {driver.driver_photo_url ? (
                            <img
                              src={driver.driver_photo_url}
                              alt={driver.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-slate-400">
                                {driver.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-medium text-slate-900">{driver.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {driver.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-700">{driver.phone}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {driver.operation_region ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-sky-500" />
                            <span className="text-sm text-slate-700">{driver.operation_region}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {hasLicenseDoc ? (
                          <a
                            href={driver.license_document_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            {isLicenseImage ? (
                              <ImageIcon className="h-3.5 w-3.5" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            Goruntule
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Yuklenmemis</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          driver.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {driver.status === 'active' ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-slate-500">
        Toplam {filteredDrivers.length} sofor
      </div>

      {/* Dispatch Task Modal */}
      <Modal isOpen={showDispatch} onClose={() => setShowDispatch(false)} title="Saha Gorevi Ata">
        <div className="space-y-4">
          <Select
            label="Saha Soforu *"
            value={dispatchForm.driver_id}
            onChange={(e) => setDispatchForm({ ...dispatchForm, driver_id: e.target.value })}
            options={[
              { value: '', label: 'Sofor secin...' },
              ...employeeDrivers.map(d => ({ value: d.id, label: d.full_name }))
            ]}
          />
          <Select
            label="Gorev Turu *"
            value={dispatchForm.task_type}
            onChange={(e) => setDispatchForm({ ...dispatchForm, task_type: e.target.value })}
            options={[
              { value: '', label: 'Gorev secin...' },
              { value: 'teslim_alma', label: 'Teslim Alma' },
              { value: 'teslim_et', label: 'Araci Teslim Et' },
              { value: 'lastik_degisimi', label: 'Lastik Degisimi' },
              { value: 'muayene', label: 'Muayeneye Gotur' },
              { value: 'lastik_teslimat', label: 'Lastikten Musteriye Teslimat' },
              { value: 'yeni_lastik', label: 'Yeni Lastik Alimi' },
              { value: 'tuvturk', label: 'TUVTURK Randevusu' },
              { value: 'diger', label: 'Diger' },
            ]}
          />
          <Select
            label="Arac (Opsiyonel)"
            value={dispatchForm.vehicle_id}
            onChange={(e) => setDispatchForm({ ...dispatchForm, vehicle_id: e.target.value })}
            options={[
              { value: '', label: 'Arac secin...' },
              ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))
            ]}
          />
          <Select
            label="Oncelik"
            value={dispatchForm.priority}
            onChange={(e) => setDispatchForm({ ...dispatchForm, priority: e.target.value })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'urgent', label: 'Acil' },
            ]}
          />
          <Input
            label="Aciklama / Talimat"
            value={dispatchForm.description}
            onChange={(e) => setDispatchForm({ ...dispatchForm, description: e.target.value })}
            placeholder="Gorev detaylari..."
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowDispatch(false)}>Iptal</Button>
            <Button onClick={handleDispatchSave} loading={dispatchSaving}>Gorevi Gonder</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
