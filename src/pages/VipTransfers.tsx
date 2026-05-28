import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Crown, Search, MapPin, Clock, Car, User, Filter, Factory, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import type { Vehicle, Customer, Supplier, Driver, VipTransfer, OperationType } from '../types/database';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';

interface TransferFormData {
  customer_id: string;
  customer_name: string;
  vehicle_id: string;
  driver_id: string;
  pickup_location: string;
  dropoff_location: string;
  transfer_date: string;
  transfer_time: string;
  price: number;
  status: string;
  notes: string;
  operation_type: OperationType;
  supplier_id: string;
  transfer_cost: number;
}

const statusOptions = [
  { value: 'bekliyor', label: 'Bekliyor' },
  { value: 'yolda', label: 'Yolda' },
  { value: 'tamamlandi', label: 'Tamamlandi' },
  { value: 'iptal', label: 'Iptal' },
];

const emptyForm: TransferFormData = {
  customer_id: '',
  customer_name: '',
  vehicle_id: '',
  driver_id: '',
  pickup_location: '',
  dropoff_location: '',
  transfer_date: new Date().toISOString().split('T')[0],
  transfer_time: '09:00',
  price: 0,
  status: 'bekliyor',
  notes: '',
  operation_type: 'in_house',
  supplier_id: '',
  transfer_cost: 0,
};

export default function VipTransfers() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [transfers, setTransfers] = useState<VipTransfer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<VipTransfer | null>(null);
  const [formData, setFormData] = useState<TransferFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (companyId) {
      loadData();
      loadSupportingData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;
    setLoading(true);

    const { data } = await supabase
      .from('vip_transfers')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('transfer_date', { ascending: false })
      .order('transfer_time', { ascending: false });

    setTransfers(data || []);
    setLoading(false);
  }

  async function loadSupportingData() {
    if (!companyId) return;

    const [customersRes, vehiclesRes, driversRes, suppliersRes] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', companyId).is('deleted_at', null).order('company_title'),
      supabase.from('vehicles').select('*').eq('company_id', companyId).is('deleted_at', null).in('status', ['idle', 'rented']),
      supabase.from('drivers').select('*').eq('company_id', companyId).is('deleted_at', null).eq('status', 'active').order('name'),
      supabase.from('suppliers').select('*').eq('company_id', companyId).is('deleted_at', null).order('name'),
    ]);

    setCustomers(customersRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setDrivers(driversRes.data || []);
    setSuppliers(suppliersRes.data || []);
  }

  function openAddForm() {
    setEditingTransfer(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(transfer: VipTransfer) {
    setEditingTransfer(transfer);
    setFormData({
      customer_id: transfer.customer_id || '',
      customer_name: transfer.customer_name || '',
      vehicle_id: transfer.vehicle_id || '',
      driver_id: transfer.driver_id || '',
      pickup_location: transfer.pickup_location,
      dropoff_location: transfer.dropoff_location,
      transfer_date: transfer.transfer_date,
      transfer_time: transfer.transfer_time?.slice(0, 5) || '09:00',
      price: transfer.price,
      status: transfer.status,
      notes: transfer.notes || '',
      operation_type: transfer.operation_type || 'in_house',
      supplier_id: transfer.supplier_id || '',
      transfer_cost: transfer.transfer_cost || 0,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!companyId || !formData.pickup_location.trim() || !formData.dropoff_location.trim()) return;

    setSaving(true);

    const customerName = formData.customer_id
      ? customers.find(c => c.id === formData.customer_id)?.company_title || formData.customer_name
      : formData.customer_name;

    const record: Record<string, unknown> = {
      customer_id: formData.customer_id || null,
      customer_name: customerName.trim(),
      pickup_location: formData.pickup_location.trim(),
      dropoff_location: formData.dropoff_location.trim(),
      transfer_date: formData.transfer_date,
      transfer_time: formData.transfer_time,
      price: formData.price,
      status: formData.status,
      notes: formData.notes.trim() || null,
      company_id: companyId,
      operation_type: formData.operation_type,
    };

    if (formData.operation_type === 'in_house') {
      record.vehicle_id = formData.vehicle_id || null;
      record.driver_id = formData.driver_id || null;
      record.supplier_id = null;
      record.transfer_cost = 0;
    } else {
      record.supplier_id = formData.supplier_id || null;
      record.transfer_cost = formData.transfer_cost;
      record.vehicle_id = null;
      record.driver_id = null;
    }

    if (editingTransfer) {
      await supabase.from('vip_transfers').update(record).eq('id', editingTransfer.id);

      await logActivity({
        action: 'UPDATE',
        entity: 'TransferRequest',
        entityId: editingTransfer.id,
        details: `VIP Transfer guncellendi: ${record.pickup_location} -> ${record.dropoff_location} - ${customerName}`,
        companyId,
      });
    } else {
      await supabase.from('vip_transfers').insert(record);

      await logActivity({
        action: 'CREATE',
        entity: 'TransferRequest',
        details: `Yeni VIP Transfer eklendi: ${record.pickup_location} -> ${record.dropoff_location} - ${customerName} - ${formatCurrency(formData.price)} TL`,
        companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(transfer: VipTransfer) {
    if (!companyId || !confirm('Bu transferi silmek istediginize emin misiniz?')) return;

    await supabase.from('vip_transfers').update({ deleted_at: new Date().toISOString() }).eq('id', transfer.id);

    await logActivity({
      action: 'DELETE',
      entity: 'TransferRequest',
      entityId: transfer.id,
      details: `VIP Transfer silindi: ${transfer.pickup_location} -> ${transfer.dropoff_location} - ${transfer.customer_name}`,
      companyId,
    });

    loadData();
  }

  async function handleStatusChange(transfer: VipTransfer, newStatus: string) {
    if (!companyId) return;

    await supabase.from('vip_transfers').update({ status: newStatus }).eq('id', transfer.id);

    const statusLabel = statusOptions.find(s => s.value === newStatus)?.label || newStatus;
    await logActivity({
      action: 'UPDATE',
      entity: 'TransferRequest',
      entityId: transfer.id,
      details: `VIP Transfer durumu guncellendi: ${transfer.pickup_location} -> ${transfer.dropoff_location} - ${statusLabel}`,
      companyId,
    });

    loadData();
  }

  const filteredTransfers = transfers.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        t.customer_name.toLowerCase().includes(term) ||
        t.pickup_location.toLowerCase().includes(term) ||
        t.dropoff_location.toLowerCase().includes(term)
      );
    }
    return true;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'bekliyor': return 'bg-amber-100 text-amber-700';
      case 'yolda': return 'bg-blue-100 text-blue-700';
      case 'tamamlandi': return 'bg-green-100 text-green-700';
      case 'iptal': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  function getStatusLabel(status: string) {
    return statusOptions.find(s => s.value === status)?.label || status;
  }

  const todayCount = transfers.filter(t => t.transfer_date === new Date().toISOString().split('T')[0] && t.status !== 'iptal').length;
  const activeCount = transfers.filter(t => t.status === 'yolda').length;
  const completedTransfers = transfers.filter(t => t.status === 'tamamlandi');
  const completedCount = completedTransfers.length;
  const totalRevenue = completedTransfers.reduce((sum, t) => sum + t.price, 0);
  const totalCost = completedTransfers.reduce((sum, t) => sum + (t.transfer_cost || 0), 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">VIP Transfer</h1>
            <p className="text-sm text-slate-500">Ozel transfer operasyonlari</p>
          </div>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Transfer Ekle
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Bugunun Transferleri</p>
          <p className="text-2xl font-bold text-slate-900">{todayCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Yolda</p>
          <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Tamamlanan</p>
          <p className="text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Gelir</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalRevenue)} TL</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Net Kar</p>
          <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(totalProfit)} TL
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Musteri, konum ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <Filter className="h-4 w-4 text-slate-400" />
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
        ) : filteredTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Crown className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 mb-2">Henuz transfer kaydi yok</p>
            <Button variant="secondary" size="sm" onClick={openAddForm}>
              <Plus className="h-4 w-4 mr-1" /> Ilk Transferi Ekle
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Tarih / Saat</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Musteri</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Guzergah</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Operasyon</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-sm">Durum</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Ucret</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Maliyet</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600 text-sm">Kar</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 text-sm">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((transfer) => {
                  const vehicle = vehicles.find(v => v.id === transfer.vehicle_id);
                  const driver = drivers.find(d => d.id === transfer.driver_id);
                  const supplier = suppliers.find(s => s.id === transfer.supplier_id);
                  const profit = transfer.price - (transfer.transfer_cost || 0);
                  const isOutsourced = transfer.operation_type === 'outsourced';

                  return (
                    <tr key={transfer.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{formatDate(transfer.transfer_date)}</p>
                            <p className="text-xs text-slate-500">{transfer.transfer_time?.slice(0, 5)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-sm text-slate-900">{transfer.customer_name || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-green-500 flex-shrink-0" />
                            <span className="text-xs text-slate-700 truncate max-w-[120px]">{transfer.pickup_location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-red-500 flex-shrink-0" />
                            <span className="text-xs text-slate-700 truncate max-w-[120px]">{transfer.dropoff_location}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isOutsourced ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 mb-1">
                              <Factory className="h-3 w-3" />
                              Dis Hizmet
                            </span>
                            {supplier && (
                              <p className="text-xs text-slate-500 truncate max-w-[120px]">{supplier.name}</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 mb-1">
                              <Car className="h-3 w-3" />
                              Kendi Aracimiz
                            </span>
                            <div className="space-y-0.5">
                              {vehicle && (
                                <p className="text-xs text-slate-500">{vehicle.plate}</p>
                              )}
                              {driver && (
                                <p className="text-xs text-slate-500">{driver.name}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={transfer.status}
                          onChange={(e) => handleStatusChange(transfer, e.target.value)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${getStatusBadge(transfer.status)}`}
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(transfer.price)} TL</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isOutsourced && transfer.transfer_cost > 0 ? (
                          <span className="text-sm text-slate-600">{formatCurrency(transfer.transfer_cost)} TL</span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isOutsourced ? (
                          <span className={`text-sm font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(profit)} TL
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-emerald-600">{formatCurrency(transfer.price)} TL</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditForm(transfer)} className="p-1.5 hover:bg-slate-100 rounded transition-colors">
                            <Edit2 className="h-4 w-4 text-slate-500" />
                          </button>
                          <button onClick={() => handleDelete(transfer)} className="p-1.5 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="h-4 w-4 text-red-500" />
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

      <div className="mt-4 text-sm text-slate-500">
        Toplam {filteredTransfers.length} transfer
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingTransfer ? 'Transferi Duzenle' : 'Yeni VIP Transfer'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Operasyon Tipi</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, operation_type: 'in_house', supplier_id: '', transfer_cost: 0 })}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                  formData.operation_type === 'in_house'
                    ? 'border-sky-500 bg-sky-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.operation_type === 'in_house' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Car className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${formData.operation_type === 'in_house' ? 'text-sky-700' : 'text-slate-700'}`}>
                    Kendi Aracimiz
                  </p>
                  <p className="text-xs text-slate-500">Arac ve sofor secimi</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, operation_type: 'outsourced', vehicle_id: '', driver_id: '' })}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                  formData.operation_type === 'outsourced'
                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${formData.operation_type === 'outsourced' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Factory className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${formData.operation_type === 'outsourced' ? 'text-orange-700' : 'text-slate-700'}`}>
                    Dis Hizmet / Tedarikci
                  </p>
                  <p className="text-xs text-slate-500">Tedarikci ve maliyet</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Musteri (Kayitli)"
              value={formData.customer_id}
              onChange={(e) => {
                const cust = customers.find(c => c.id === e.target.value);
                setFormData({
                  ...formData,
                  customer_id: e.target.value,
                  customer_name: cust?.company_title || formData.customer_name,
                });
              }}
              options={[
                { value: '', label: 'Listeden secin veya ad yazin...' },
                ...customers.map(c => ({ value: c.id, label: c.company_title })),
              ]}
            />
            <Input
              label="Musteri Adi (Serbest)"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              placeholder="Misafir musteri adi..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nereden (Alis Noktasi)"
              value={formData.pickup_location}
              onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
              placeholder="Ornek: Istanbul Havalimani"
            />
            <Input
              label="Nereye (Birakilma Noktasi)"
              value={formData.dropoff_location}
              onChange={(e) => setFormData({ ...formData, dropoff_location: e.target.value })}
              placeholder="Ornek: Four Seasons Sultanahmet"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Tarih"
              type="date"
              value={formData.transfer_date}
              onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
            />
            <Input
              label="Saat"
              type="time"
              value={formData.transfer_time}
              onChange={(e) => setFormData({ ...formData, transfer_time: e.target.value })}
            />
            <CurrencyInput
              label="Ucret (TL)"
              value={formData.price}
              onChange={(val) => setFormData({ ...formData, price: val })}
            />
          </div>

          {formData.operation_type === 'in_house' ? (
            <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-medium text-sky-700">Arac & Sofor Secimi</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Arac"
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  options={[
                    { value: '', label: 'Arac secin...' },
                    ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })),
                  ]}
                />
                <Select
                  label="Sofor"
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  options={[
                    { value: '', label: 'Sofor secin...' },
                    ...drivers.map(d => ({ value: d.id, label: `${d.name}${d.phone ? ` (${d.phone})` : ''}` })),
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <Factory className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Tedarikci & Maliyet</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Tedarikci"
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  options={[
                    { value: '', label: 'Tedarikci secin...' },
                    ...suppliers.map(s => ({ value: s.id, label: `${s.name}${s.contact_person ? ` (${s.contact_person})` : ''}` })),
                  ]}
                />
                <CurrencyInput
                  label="Transfer Maliyeti (TL)"
                  value={formData.transfer_cost}
                  onChange={(val) => setFormData({ ...formData, transfer_cost: val })}
                />
              </div>
              {formData.price > 0 && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <TrendingUp className="h-4 w-4" />
                      <span>Tahmini Kar:</span>
                    </div>
                    <span className={`font-bold ${(formData.price - formData.transfer_cost) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(formData.price - formData.transfer_cost)} TL
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <Select
            label="Durum"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={statusOptions}
          />

          <Input
            label="Notlar"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Ek bilgi veya ozel talepler..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Iptal</Button>
            <Button onClick={handleSave} disabled={saving || !formData.pickup_location.trim() || !formData.dropoff_location.trim()}>
              {saving ? 'Kaydediliyor...' : editingTransfer ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
