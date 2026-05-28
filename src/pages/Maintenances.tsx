import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, Wrench, Calendar, Car, Building2, Eye, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Maintenance, Vehicle, Supplier, ChecklistItem, CustomOperation, ServiceDetails } from '../types/database';
import { formatCurrency, formatDate } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';
import MaintenanceChecklist from '../components/maintenance/MaintenanceChecklist';
import CustomOperations from '../components/maintenance/CustomOperations';
import MaintenanceDetailsView from '../components/maintenance/MaintenanceDetailsView';

const STANDARD_CHECKLIST_ITEMS: { id: string; label: string }[] = [
  { id: 'motor_yagi', label: 'Motor Yagi' },
  { id: 'yag_filtresi', label: 'Yag Filtresi' },
  { id: 'hava_filtresi', label: 'Hava Filtresi' },
  { id: 'polen_filtresi', label: 'Polen Filtresi' },
  { id: 'yakit_filtresi', label: 'Yakit Filtresi' },
  { id: 'fren_balatalari', label: 'Fren Balatalari' },
  { id: 'fren_diskleri', label: 'Fren Diskleri' },
  { id: 'triger_kayisi', label: 'Triger Kayisi' },
  { id: 'aku', label: 'Aku' },
  { id: 'silecekler', label: 'Silecekler' },
];

function createDefaultChecklist(): ChecklistItem[] {
  return STANDARD_CHECKLIST_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    status: 'na' as const,
  }));
}

function parseServiceDetails(raw: unknown): ServiceDetails {
  if (raw && typeof raw === 'object' && 'checklist' in raw && 'custom_operations' in raw) {
    const sd = raw as ServiceDetails;
    const mergedChecklist = STANDARD_CHECKLIST_ITEMS.map((std) => {
      const existing = sd.checklist.find((c) => c.id === std.id);
      return existing || { id: std.id, label: std.label, status: 'na' as const };
    });
    return { checklist: mergedChecklist, custom_operations: sd.custom_operations || [] };
  }
  return { checklist: createDefaultChecklist(), custom_operations: [] };
}

interface MaintenanceWithRelations extends Maintenance {
  vehicle?: Vehicle;
  supplier?: Supplier;
}

interface MaintenanceFormData {
  vehicle_id: string;
  supplier_id: string;
  entry_date: string;
  return_date: string;
  current_km: number | null;
  cost: number;
  description: string;
  next_maintenance_km: number | null;
  checklist: ChecklistItem[];
  custom_operations: CustomOperation[];
}

const emptyForm: MaintenanceFormData = {
  vehicle_id: '',
  supplier_id: '',
  entry_date: '',
  return_date: '',
  current_km: null,
  cost: 0,
  description: '',
  next_maintenance_km: null,
  checklist: createDefaultChecklist(),
  custom_operations: [],
};

export default function Maintenances() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [maintenances, setMaintenances] = useState<MaintenanceWithRelations[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [formData, setFormData] = useState<MaintenanceFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [detailMaintenance, setDetailMaintenance] = useState<MaintenanceWithRelations | null>(null);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);
    const [maintenancesRes, vehiclesRes, suppliersRes] = await Promise.all([
      supabase
        .from('maintenances')
        .select('*, vehicle:vehicles(*), supplier:suppliers(*)')
        .eq('company_id', companyId)
        .order('entry_date', { ascending: false }),
      supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .neq('status', 'sold')
        .order('plate'),
      supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', companyId)
        .order('name'),
    ]);

    setMaintenances(maintenancesRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setSuppliers(suppliersRes.data || []);
    setLoading(false);
  }

  function openForm(maintenance?: Maintenance) {
    if (maintenance) {
      setEditingMaintenance(maintenance);
      const sd = parseServiceDetails(maintenance.service_details);
      setFormData({
        vehicle_id: maintenance.vehicle_id,
        supplier_id: maintenance.supplier_id || '',
        entry_date: maintenance.entry_date,
        return_date: maintenance.return_date || '',
        current_km: maintenance.current_km,
        cost: maintenance.cost,
        description: maintenance.description || '',
        next_maintenance_km: maintenance.next_maintenance_km,
        checklist: sd.checklist,
        custom_operations: sd.custom_operations,
      });
    } else {
      setEditingMaintenance(null);
      setFormData({ ...emptyForm, checklist: createDefaultChecklist(), custom_operations: [] });
    }
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      alert('Sirket bilgisi bulunamadi');
      return;
    }
    if (!formData.vehicle_id || !formData.entry_date) {
      alert('Lutfen arac ve giris tarihini secin');
      return;
    }

    setSaving(true);
    const serviceDetails: ServiceDetails = {
      checklist: formData.checklist,
      custom_operations: formData.custom_operations.filter((op) => op.name.trim()),
    };

    const data = {
      vehicle_id: formData.vehicle_id,
      supplier_id: formData.supplier_id || null,
      entry_date: formData.entry_date,
      return_date: formData.return_date || null,
      current_km: formData.current_km || null,
      cost: formData.cost,
      description: formData.description || null,
      next_maintenance_km: formData.next_maintenance_km || null,
      company_id: companyId,
      service_details: serviceDetails,
    };

    const vehicle = vehicles.find((v) => v.id === formData.vehicle_id);
    const vehicleInfo = vehicle ? `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}` : '';

    if (editingMaintenance) {
      const { error } = await supabase
        .from('maintenances')
        .update(data)
        .eq('id', editingMaintenance.id)
        .eq('company_id', companyId);

      if (error) {
        console.error('Maintenance error:', error.message);
        alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      } else {
        await logActivity({
          action: 'UPDATE',
          entity: 'Bakim',
          entityId: editingMaintenance.id,
          details: `Bakim guncellendi: ${vehicleInfo} - ${formatDate(formData.entry_date)}`,
          userEmail: user?.email,
          companyId: companyId,
        });
        setShowForm(false);
        loadData();
      }
    } else {
      const { data: newMaintenance, error } = await supabase
        .from('maintenances')
        .insert([data])
        .select()
        .single();

      if (error) {
        console.error('Maintenance error:', error.message);
        alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      } else {
        if (formData.cost > 0) {
          await supabase.from('transactions').insert([
            {
              type: 'expense',
              category: 'Bakim ve Onarim',
              amount: formData.cost,
              vehicle_id: formData.vehicle_id,
              transaction_date: formData.entry_date,
              description: `Otomatik Kayit: ${formData.description || 'Bakim/Servis'}`,
              company_id: companyId,
            },
          ]);
        }

        await logActivity({
          action: 'CREATE',
          entity: 'Bakim',
          entityId: newMaintenance.id,
          details: `Yeni bakim eklendi: ${vehicleInfo} - ${formatDate(formData.entry_date)} - ${formatCurrency(formData.cost)} TL`,
          userEmail: user?.email,
          companyId: companyId,
        });
        setShowForm(false);
        loadData();
      }
    }
    setSaving(false);
  }

  async function handleDelete(maintenance: MaintenanceWithRelations) {
    if (!companyId) return;
    if (!confirm('Bu bakim kaydini silmek istediginize emin misiniz?')) return;

    const vehicleInfo = maintenance.vehicle
      ? `${maintenance.vehicle.plate} - ${maintenance.vehicle.brand} ${maintenance.vehicle.model}`
      : '';

    const { error } = await supabase
      .from('maintenances')
      .delete()
      .eq('id', maintenance.id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Maintenance error:', error.message);
        alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    } else {
      await logActivity({
        action: 'DELETE',
        entity: 'Bakim',
        entityId: maintenance.id,
        details: `Bakim silindi: ${vehicleInfo} - ${formatDate(maintenance.entry_date)}`,
        userEmail: user?.email,
        companyId: companyId,
      });
      loadData();
    }
  }

  function getServiceSummary(m: MaintenanceWithRelations): { replaced: number; checked: number; custom: number } {
    const sd = m.service_details as ServiceDetails | null;
    if (!sd) return { replaced: 0, checked: 0, custom: 0 };
    return {
      replaced: sd.checklist?.filter((i) => i.status === 'replaced').length || 0,
      checked: sd.checklist?.filter((i) => i.status === 'checked').length || 0,
      custom: sd.custom_operations?.filter((op) => op.name?.trim()).length || 0,
    };
  }

  const filteredMaintenances = maintenances.filter((m) => {
    const term = searchTerm.toLowerCase();
    const vehiclePlate = m.vehicle?.plate?.toLowerCase() || '';
    const vehicleBrand = m.vehicle?.brand?.toLowerCase() || '';
    const vehicleModel = m.vehicle?.model?.toLowerCase() || '';
    const supplierName = m.supplier?.name?.toLowerCase() || '';
    const description = m.description?.toLowerCase() || '';
    return (
      vehiclePlate.includes(term) ||
      vehicleBrand.includes(term) ||
      vehicleModel.includes(term) ||
      supplierName.includes(term) ||
      description.includes(term)
    );
  });

  const totalCost = filteredMaintenances.reduce((sum, m) => sum + (m.cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bakim & Servis</h1>
          <p className="text-sm text-slate-500 mt-1">Arac bakim ve servis kayitlari</p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Bakim Ekle
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Wrench className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Toplam Kayit</p>
              <p className="text-xl font-bold text-slate-900">{maintenances.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Bu Ay</p>
              <p className="text-xl font-bold text-slate-900">
                {
                  maintenances.filter((m) => {
                    const entryDate = new Date(m.entry_date);
                    const now = new Date();
                    return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear();
                  }).length
                }
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Building2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Toplam Maliyet</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(totalCost)} TL</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Ara... (plaka, marka, model, servis saglayici)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Yukleniyor...</div>
        ) : filteredMaintenances.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm ? 'Arama kriterlerine uygun kayit bulunamadi' : 'Henuz bakim kaydi yok'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Arac</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Servis Saglayici</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Giris Tarihi</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Cikis Tarihi</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Maliyet</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600">Islemler Ozeti</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Sonraki KM</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenances.map((maintenance) => {
                  const summary = getServiceSummary(maintenance);
                  const hasDetails = summary.replaced > 0 || summary.checked > 0 || summary.custom > 0;
                  return (
                    <tr key={maintenance.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Car className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{maintenance.vehicle?.plate || '-'}</p>
                            <p className="text-xs text-slate-500">
                              {maintenance.vehicle ? `${maintenance.vehicle.brand} ${maintenance.vehicle.model}` : '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {maintenance.supplier?.name || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{formatDate(maintenance.entry_date)}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {maintenance.return_date ? (
                          formatDate(maintenance.return_date)
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            Serviste
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                        {formatCurrency(maintenance.cost)} TL
                      </td>
                      <td className="py-3 px-4">
                        {hasDetails ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {summary.replaced > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {summary.replaced} degisti
                              </span>
                            )}
                            {summary.checked > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {summary.checked} kontrol
                              </span>
                            )}
                            {summary.custom > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                +{summary.custom}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 block text-center">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">
                        {maintenance.next_maintenance_km ? `${maintenance.next_maintenance_km.toLocaleString()} km` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDetailMaintenance(maintenance)}
                            className="p-1.5 hover:bg-teal-50 rounded-lg text-slate-400 hover:text-teal-600 transition-colors"
                            title="Detay"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openForm(maintenance)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                            title="Duzenle"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(maintenance)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingMaintenance ? 'Bakim Duzenle' : 'Yeni Bakim Ekle'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Arac *"
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              options={[
                { value: '', label: 'Arac Secin' },
                ...vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.plate} - ${v.brand} ${v.model}`,
                })),
              ]}
            />
            <Select
              label="Servis Saglayici"
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              options={[
                { value: '', label: 'Secin (Opsiyonel)' },
                ...suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Giris Tarihi *"
              type="date"
              value={formData.entry_date}
              onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
            />
            <Input
              label="Cikis Tarihi"
              type="date"
              value={formData.return_date}
              onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Mevcut KM"
              type="number"
              value={formData.current_km || ''}
              onChange={(e) => setFormData({ ...formData, current_km: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Ornegin: 45000"
            />
            <CurrencyInput label="Maliyet (TL)" value={formData.cost} onChange={(v) => setFormData({ ...formData, cost: v })} />
            <Input
              label="Sonraki Bakim KM"
              type="number"
              value={formData.next_maintenance_km || ''}
              onChange={(e) =>
                setFormData({ ...formData, next_maintenance_km: e.target.value ? parseInt(e.target.value) : null })
              }
              placeholder="Ornegin: 55000"
            />
          </div>

          <Input
            label="Genel Aciklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Genel notlar, yapilan islemler hakkinda ozet vb."
          />

          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-teal-600" />
              <h3 className="text-base font-semibold text-slate-900">Servis Detaylari</h3>
            </div>

            <div className="space-y-5">
              <MaintenanceChecklist
                items={formData.checklist}
                onChange={(checklist) => setFormData({ ...formData, checklist })}
              />

              <div className="border-t border-slate-100 pt-4">
                <CustomOperations
                  operations={formData.custom_operations}
                  onChange={(custom_operations) => setFormData({ ...formData, custom_operations })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button type="submit" loading={saving}>
              {editingMaintenance ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!detailMaintenance}
        onClose={() => setDetailMaintenance(null)}
        title="Bakim Detayi"
        size="lg"
      >
        {detailMaintenance && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Arac</span>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-900">
                    {detailMaintenance.vehicle?.plate || '-'}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {detailMaintenance.vehicle ? `${detailMaintenance.vehicle.brand} ${detailMaintenance.vehicle.model}` : ''}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Servis Saglayici</span>
                <p className="text-sm font-medium text-slate-900">
                  {detailMaintenance.supplier?.name || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Giris / Cikis</span>
                <p className="text-sm text-slate-700">
                  {formatDate(detailMaintenance.entry_date)}
                  {detailMaintenance.return_date ? ` - ${formatDate(detailMaintenance.return_date)}` : ' (Serviste)'}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Maliyet</span>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(detailMaintenance.cost)} TL</p>
              </div>
              {detailMaintenance.current_km && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Mevcut KM</span>
                  <p className="text-sm text-slate-700">{detailMaintenance.current_km.toLocaleString()} km</p>
                </div>
              )}
              {detailMaintenance.next_maintenance_km && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Sonraki Bakim KM</span>
                  <p className="text-sm text-slate-700">{detailMaintenance.next_maintenance_km.toLocaleString()} km</p>
                </div>
              )}
            </div>

            {detailMaintenance.description && (
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Aciklama</span>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{detailMaintenance.description}</p>
              </div>
            )}

            <div className="border-t border-slate-200 pt-4">
              <MaintenanceDetailsView serviceDetails={detailMaintenance.service_details as ServiceDetails | null} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
