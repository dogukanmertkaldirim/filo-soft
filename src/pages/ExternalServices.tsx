import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ExternalService, Customer, Supplier } from '../types/database';
import { formatCurrency, formatDate, formatCustomerLabel } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';

interface ServiceFormData {
  service_type: 'transfer' | 'logistics' | 'car_rental';
  customer_id: string;
  supplier_id: string;
  service_date: string;
  description: string;
  cost: number;
  revenue: number;
}

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  service_types: string[];
}

export default function ExternalServices() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [services, setServices] = useState<ExternalService[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingService, setEditingService] = useState<ExternalService | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [serviceForm, setServiceForm] = useState<ServiceFormData>({
    service_type: 'transfer',
    customer_id: '',
    supplier_id: '',
    service_date: new Date().toISOString().split('T')[0],
    description: '',
    cost: 0,
    revenue: 0,
  });

  const [supplierForm, setSupplierForm] = useState<SupplierFormData>({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    service_types: [],
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);
    const [servicesRes, customersRes, suppliersRes] = await Promise.all([
      supabase.from('external_services').select('*').eq('company_id', companyId).order('service_date', { ascending: false }),
      supabase.from('customers').select('*').eq('company_id', companyId).order('company_title'),
      supabase.from('suppliers').select('*').eq('company_id', companyId).order('name'),
    ]);
    setServices(servicesRes.data || []);
    setCustomers(customersRes.data || []);
    setSuppliers(suppliersRes.data || []);
    setLoading(false);
  }

  function openAddService() {
    setEditingService(null);
    setServiceForm({
      service_type: 'transfer',
      customer_id: '',
      supplier_id: '',
      service_date: new Date().toISOString().split('T')[0],
      description: '',
      cost: 0,
      revenue: 0,
    });
    setShowServiceForm(true);
  }

  function openEditService(service: ExternalService) {
    setEditingService(service);
    setServiceForm({
      service_type: service.service_type,
      customer_id: service.customer_id || '',
      supplier_id: service.supplier_id || '',
      service_date: service.service_date,
      description: service.description || '',
      cost: service.cost,
      revenue: service.revenue,
    });
    setShowServiceForm(true);
  }

  async function handleSaveService() {
    if (!companyId) return;

    setSaving(true);
    const serviceData = {
      service_type: serviceForm.service_type,
      customer_id: serviceForm.customer_id || null,
      supplier_id: serviceForm.supplier_id || null,
      service_date: serviceForm.service_date,
      description: serviceForm.description || null,
      cost: serviceForm.cost,
      revenue: serviceForm.revenue,
      company_id: companyId,
    };

    let serviceId: string;
    const serviceTypeLabels: Record<string, string> = {
      transfer: 'Transfer',
      logistics: 'Lojistik',
      car_rental: 'Arac Kiralama',
    };

    if (editingService) {
      await supabase.from('external_services').update(serviceData).eq('id', editingService.id).eq('company_id', companyId);
      serviceId = editingService.id;

      await supabase.from('transactions').delete().eq('external_service_id', editingService.id).eq('company_id', companyId);

      await logActivity({
        action: 'UPDATE',
        entity: 'Supplier',
        entityId: serviceId,
        details: `Dis hizmet guncellendi: ${serviceTypeLabels[serviceForm.service_type]} - Gelir: ${serviceForm.revenue.toLocaleString('tr-TR')} TL`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else {
      const { data } = await supabase.from('external_services').insert(serviceData).select().single();
      serviceId = data!.id;

      await logActivity({
        action: 'CREATE',
        entity: 'Supplier',
        entityId: serviceId,
        details: `Yeni dis hizmet eklendi: ${serviceTypeLabels[serviceForm.service_type]} - Gelir: ${serviceForm.revenue.toLocaleString('tr-TR')} TL`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    if (serviceForm.revenue > 0) {
      await supabase.from('transactions').insert({
        type: 'income',
        category: 'External Service',
        description: `${serviceForm.service_type} service revenue`,
        amount: serviceForm.revenue,
        transaction_date: serviceForm.service_date,
        external_service_id: serviceId,
        company_id: companyId,
      });
    }

    if (serviceForm.cost > 0) {
      await supabase.from('transactions').insert({
        type: 'expense',
        category: 'External Service Cost',
        description: `${serviceForm.service_type} service cost`,
        amount: serviceForm.cost,
        transaction_date: serviceForm.service_date,
        external_service_id: serviceId,
        company_id: companyId,
      });
    }

    setSaving(false);
    setShowServiceForm(false);
    loadData();
  }

  async function handleDeleteService(service: ExternalService) {
    if (!companyId) return;
    if (!confirm('Delete this service?')) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Supplier',
      entityId: service.id,
      details: `Dis hizmet silindi: ${service.service_type}`,
      userEmail: user?.email,
      companyId: companyId,
    });
    await supabase.from('transactions').delete().eq('external_service_id', service.id).eq('company_id', companyId);
    await supabase.from('external_services').delete().eq('id', service.id).eq('company_id', companyId);
    loadData();
  }

  function openAddSupplier() {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      service_types: [],
    });
    setShowSupplierForm(true);
  }

  function openEditSupplier(supplier: Supplier) {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      service_types: supplier.service_types || [],
    });
    setShowSupplierForm(true);
  }

  async function handleSaveSupplier() {
    if (!companyId) return;
    if (!supplierForm.name.trim()) {
      alert('Please enter a supplier name');
      return;
    }

    setSaving(true);
    const supplierData = {
      name: supplierForm.name.trim(),
      contact_person: supplierForm.contact_person.trim() || null,
      phone: supplierForm.phone.trim() || null,
      email: supplierForm.email.trim() || null,
      address: supplierForm.address.trim() || null,
      service_types: supplierForm.service_types,
      company_id: companyId,
    };

    let error;
    if (editingSupplier?.id) {
      const result = await supabase.from('suppliers').update(supplierData).eq('id', editingSupplier.id).eq('company_id', companyId);
      error = result.error;
      if (!error) {
        await logActivity({
          action: 'UPDATE',
          entity: 'Supplier',
          entityId: editingSupplier.id,
          details: `Tedarikci guncellendi: ${supplierForm.name}`,
          userEmail: user?.email,
          companyId: companyId,
        });
      }
    } else {
      const result = await supabase.from('suppliers').insert(supplierData).select().single();
      error = result.error;
      if (!error && result.data) {
        await logActivity({
          action: 'CREATE',
          entity: 'Supplier',
          entityId: result.data.id,
          details: `Yeni tedarikci eklendi: ${supplierForm.name}`,
          userEmail: user?.email,
          companyId: companyId,
        });
      }
    }

    setSaving(false);

    if (error) {
      console.error('Supplier save error:', error.message);
      alert('Kayit sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      return;
    }

    setEditingSupplier(null);
    setShowSupplierForm(false);
    loadData();
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    if (!companyId) return;
    if (!confirm('Delete this supplier?')) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Supplier',
      entityId: supplier.id,
      details: `Tedarikci silindi: ${supplier.name}`,
      userEmail: user?.email,
      companyId: companyId,
    });
    await supabase.from('suppliers').delete().eq('id', supplier.id).eq('company_id', companyId);
    loadData();
  }

  const filteredServices = services.filter(s => {
    if (filterCustomer && s.customer_id !== filterCustomer) return false;
    if (filterSupplier && s.supplier_id !== filterSupplier) return false;
    if (filterType && s.service_type !== filterType) return false;
    if (filterDate && s.service_date !== filterDate) return false;
    return true;
  });

  const totalCost = filteredServices.reduce((sum, s) => sum + s.cost, 0);
  const totalRevenue = filteredServices.reduce((sum, s) => sum + s.revenue, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">VIP Transfer & Lojistik</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openAddSupplier}>
            <Building2 className="h-4 w-4 mr-2" />
            Tedarikcileri Yonet
          </Button>
          <Button onClick={openAddService}>
            <Plus className="h-4 w-4 mr-2" />
            Hizmet Ekle
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 items-end">
          <Select
            label="Musteri"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            options={[
              { value: '', label: 'Tum Musteriler' },
              ...customers.map(c => ({ value: c.id, label: formatCustomerLabel(c) })),
            ]}
          />
          <Select
            label="Tedarikci"
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            options={[
              { value: '', label: 'Tum Tedarikciler' },
              ...suppliers.map(s => ({ value: s.id, label: s.name })),
            ]}
          />
          <Select
            label="Hizmet Tipi"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { value: '', label: 'Tum Tipler' },
              { value: 'transfer', label: 'Transfer' },
              { value: 'logistics', label: 'Lojistik' },
              { value: 'car_rental', label: 'Arac Kiralama' },
            ]}
          />
          <Input
            label="Tarih"
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          {(filterCustomer || filterSupplier || filterType || filterDate) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilterCustomer('');
                setFilterSupplier('');
                setFilterType('');
                setFilterDate('');
              }}
            >
              Filtreleri Temizle
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Tarih</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Tip</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Musteri</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Tedarikci</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Aciklama</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Maliyet</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Gelir</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Kar</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((s) => {
                    const customer = customers.find(c => c.id === s.customer_id);
                    const supplier = suppliers.find(sp => sp.id === s.supplier_id);
                    return (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">{formatDate(s.service_date)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            s.service_type === 'transfer' ? 'bg-blue-100 text-blue-700' :
                            s.service_type === 'logistics' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {s.service_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">{customer?.company_title || '-'}</td>
                        <td className="py-3 px-4">{supplier?.name || '-'}</td>
                        <td className="py-3 px-4 max-w-xs truncate">{s.description || '-'}</td>
                        <td className="py-3 px-4 text-right text-red-600">{formatCurrency(s.cost)} TL</td>
                        <td className="py-3 px-4 text-right text-green-600">{formatCurrency(s.revenue)} TL</td>
                        <td className={`py-3 px-4 text-right font-medium ${s.profit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                          {formatCurrency(s.profit)} TL
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditService(s)}
                              className="p-1.5 hover:bg-slate-100 rounded"
                            >
                              <Edit2 className="h-4 w-4 text-slate-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteService(s)}
                              className="p-1.5 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-medium">
                    <td colSpan={5} className="py-3 px-4 text-right">Toplam:</td>
                    <td className="py-3 px-4 text-right text-red-600">{formatCurrency(totalCost)} TL</td>
                    <td className="py-3 px-4 text-right text-green-600">{formatCurrency(totalRevenue)} TL</td>
                    <td className={`py-3 px-4 text-right ${totalProfit >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                      {formatCurrency(totalProfit)} TL
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              {filteredServices.length === 0 && (
                <p className="text-center py-8 text-slate-500">Hizmet bulunamadi</p>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showServiceForm}
        onClose={() => setShowServiceForm(false)}
        title={editingService ? 'Hizmet Duzenle' : 'Hizmet Ekle'}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Hizmet Tipi"
            value={serviceForm.service_type}
            onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value as any })}
            options={[
              { value: 'transfer', label: 'Transfer' },
              { value: 'logistics', label: 'Lojistik' },
              { value: 'car_rental', label: 'Arac Kiralama' },
            ]}
          />
          <Select
            label="Musteri"
            value={serviceForm.customer_id}
            onChange={(e) => setServiceForm({ ...serviceForm, customer_id: e.target.value })}
            options={[
              { value: '', label: 'Musteri secin...' },
              ...customers.map(c => ({ value: c.id, label: formatCustomerLabel(c) })),
            ]}
          />
          <Select
            label="Tedarikci"
            value={serviceForm.supplier_id}
            onChange={(e) => setServiceForm({ ...serviceForm, supplier_id: e.target.value })}
            options={[
              { value: '', label: 'Tedarikci secin...' },
              ...suppliers.map(s => ({ value: s.id, label: s.name })),
            ]}
          />
          <Input
            label="Hizmet Tarihi"
            type="date"
            value={serviceForm.service_date}
            onChange={(e) => setServiceForm({ ...serviceForm, service_date: e.target.value })}
          />
          <Input
            label="Aciklama"
            value={serviceForm.description}
            onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              label="Maliyet"
              value={serviceForm.cost}
              onChange={(v) => setServiceForm({ ...serviceForm, cost: v })}
            />
            <CurrencyInput
              label="Gelir"
              value={serviceForm.revenue}
              onChange={(v) => setServiceForm({ ...serviceForm, revenue: v })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowServiceForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSaveService} loading={saving}>
              {editingService ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showSupplierForm}
        onClose={() => setShowSupplierForm(false)}
        title="Tedarikcileri Yonet"
        size="lg"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-slate-900">Tedarikci Listesi</h3>
            {!editingSupplier && (
              <Button size="sm" onClick={() => {
                setSupplierForm({
                  name: '',
                  contact_person: '',
                  phone: '',
                  email: '',
                  address: '',
                  service_types: [],
                });
                setEditingSupplier({} as Supplier);
              }}>
                <Plus className="h-4 w-4 mr-1" /> Yeni
              </Button>
            )}
          </div>

          {editingSupplier ? (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <Input
                label="Ad *"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Yetkili Kisi"
                  value={supplierForm.contact_person}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                />
                <Input
                  label="Telefon"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                />
              </div>
              <Input
                label="E-posta"
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
              />
              <Input
                label="Adres"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditingSupplier(null)}>
                  Iptal
                </Button>
                <Button size="sm" onClick={handleSaveSupplier} loading={saving}>
                  Kaydet
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {suppliers.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{s.name}</p>
                    <p className="text-sm text-slate-500">{s.contact_person} - {s.phone}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditSupplier(s)} className="p-1.5 hover:bg-white rounded">
                      <Edit2 className="h-4 w-4 text-slate-500" />
                    </button>
                    <button onClick={() => handleDeleteSupplier(s)} className="p-1.5 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
              {suppliers.length === 0 && (
                <p className="text-center py-4 text-slate-500">Henuz tedarikci yok</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
