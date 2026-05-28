import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, Factory, Phone, Mail, MapPin, FileText, Users, ChevronDown, ChevronUp, Percent, Clock, Upload, X, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/auditLog';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

interface SupplierContact {
  id?: string;
  supplier_id?: string;
  full_name: string;
  phone: string;
  email: string;
  notes: string;
}

interface SupplierFormData {
  name: string;
  city: string;
  address: string;
  service_type: string;
  phone: string;
  email: string;
  contact_person: string;
  service_types: string[];
  discount_spare_parts: string;
  discount_labor: string;
  payment_maturity: string;
  contract_file_url: string;
}

interface SupplierRow {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  service_type: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  service_types: string[] | null;
  discount_spare_parts: number | null;
  discount_labor: number | null;
  payment_maturity: string | null;
  contract_file_url: string | null;
  company_id: string | null;
  created_at: string | null;
  deleted_at: string | null;
}

const emptyForm: SupplierFormData = {
  name: '',
  city: '',
  address: '',
  service_type: '',
  phone: '',
  email: '',
  contact_person: '',
  service_types: [],
  discount_spare_parts: '',
  discount_labor: '',
  payment_maturity: '',
  contract_file_url: '',
};

const emptyContact: SupplierContact = {
  full_name: '',
  phone: '',
  email: '',
  notes: '',
};

const serviceTypeOptions = [
  { value: '', label: 'Tumu' },
  { value: 'yetkili_servis', label: 'Yetkili Servis' },
  { value: 'ozel_servis', label: 'Ozel Servis' },
  { value: 'lastikci', label: 'Lastikci' },
  { value: 'cekici', label: 'Cekici' },
  { value: 'yol_yardim', label: 'Yol Yardim' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'logistics', label: 'Lojistik' },
  { value: 'car_rental', label: 'Arac Kiralama' },
  { value: 'maintenance', label: 'Bakim & Servis' },
  { value: 'cleaning', label: 'Temizlik' },
  { value: 'other', label: 'Diger' },
];

const serviceTypeLabels: Record<string, string> = Object.fromEntries(
  serviceTypeOptions.filter(o => o.value).map(o => [o.value, o.label])
);

const paymentOptions = [
  { value: '', label: 'Seciniz' },
  { value: 'pesin', label: 'Pesin' },
  { value: '15_gun', label: '15 Gun' },
  { value: '30_gun', label: '30 Gun' },
  { value: '45_gun', label: '45 Gun' },
  { value: '60_gun', label: '60 Gun' },
  { value: '90_gun', label: '90 Gun' },
];

const paymentLabels: Record<string, string> = Object.fromEntries(
  paymentOptions.filter(o => o.value).map(o => [o.value, o.label])
);

const turkishCities = [
  '', 'Adana', 'Adiyaman', 'Afyon', 'Agri', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
  'Ardahan', 'Artvin', 'Aydin', 'Balikesir', 'Bartin', 'Batman', 'Bayburt', 'Bilecik',
  'Bingol', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Canakkale', 'Cankiri', 'Corum',
  'Denizli', 'Diyarbakir', 'Duzce', 'Edirne', 'Elazig', 'Erzincan', 'Erzurum',
  'Eskisehir', 'Gaziantep', 'Giresun', 'Gumushane', 'Hakkari', 'Hatay', 'Igdir',
  'Isparta', 'Istanbul', 'Izmir', 'Kahramanmaras', 'Karabuk', 'Karaman', 'Kars',
  'Kastamonu', 'Kayseri', 'Kilis', 'Kirikkale', 'Kirklareli', 'Kirsehir', 'Kocaeli',
  'Konya', 'Kutahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Mugla', 'Mus',
  'Nevsehir', 'Nigde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Sanliurfa',
  'Siirt', 'Sinop', 'Sivas', 'Sirnak', 'Tekirdag', 'Tokat', 'Trabzon', 'Tunceli',
  'Usak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak',
];

export default function Suppliers() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(emptyForm);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);
  const [supplierContacts, setSupplierContacts] = useState<Record<string, SupplierContact[]>>({});
  const [uploadingContract, setUploadingContract] = useState(false);

  useEffect(() => {
    if (companyId) loadSuppliers();
  }, [companyId]);

  async function loadSuppliers() {
    if (!companyId) return;
    setLoading(true);

    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name');

    setSuppliers((data as SupplierRow[]) || []);
    setLoading(false);
  }

  async function loadContacts(supplierId: string) {
    const { data } = await supabase
      .from('supplier_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('full_name');

    setSupplierContacts(prev => ({ ...prev, [supplierId]: data || [] }));
  }

  function toggleExpand(supplierId: string) {
    if (expandedSupplier === supplierId) {
      setExpandedSupplier(null);
    } else {
      setExpandedSupplier(supplierId);
      if (!supplierContacts[supplierId]) {
        loadContacts(supplierId);
      }
    }
  }

  function openAddForm() {
    setEditingSupplier(null);
    setFormData(emptyForm);
    setContacts([{ ...emptyContact }]);
    setShowForm(true);
  }

  function openEditForm(supplier: SupplierRow) {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      city: supplier.city || '',
      address: supplier.address || '',
      service_type: supplier.service_type || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      contact_person: supplier.contact_person || '',
      service_types: supplier.service_types || [],
      discount_spare_parts: supplier.discount_spare_parts?.toString() || '',
      discount_labor: supplier.discount_labor?.toString() || '',
      payment_maturity: supplier.payment_maturity || '',
      contract_file_url: supplier.contract_file_url || '',
    });
    loadContactsForForm(supplier.id);
    setShowForm(true);
  }

  async function loadContactsForForm(supplierId: string) {
    const { data } = await supabase
      .from('supplier_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('full_name');

    setContacts(data && data.length > 0 ? data : [{ ...emptyContact }]);
  }

  async function handleContractUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    setUploadingContract(true);
    const ext = file.name.split('.').pop();
    const path = `${companyId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('supplier-contracts')
      .upload(path, file);

    if (!error) {
      const { data: urlData } = supabase.storage.from('supplier-contracts').getPublicUrl(path);
      setFormData(prev => ({ ...prev, contract_file_url: urlData.publicUrl }));
    }
    setUploadingContract(false);
  }

  async function handleSave() {
    if (!companyId || !formData.name.trim()) return;
    setSaving(true);

    const record = {
      company_id: companyId,
      name: formData.name.trim(),
      city: formData.city || null,
      address: formData.address.trim() || null,
      service_type: formData.service_type || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      contact_person: formData.contact_person.trim() || null,
      service_types: formData.service_types,
      discount_spare_parts: formData.discount_spare_parts ? parseFloat(formData.discount_spare_parts) : 0,
      discount_labor: formData.discount_labor ? parseFloat(formData.discount_labor) : 0,
      payment_maturity: formData.payment_maturity || null,
      contract_file_url: formData.contract_file_url || null,
    };

    let supplierId: string;

    if (editingSupplier) {
      await supabase.from('suppliers').update(record).eq('id', editingSupplier.id);
      supplierId = editingSupplier.id;
      await logActivity({
        action: 'UPDATE',
        entity: 'Supplier',
        entityId: editingSupplier.id,
        details: `Tedarikci guncellendi: ${record.name}`,
        companyId,
      });
    } else {
      const { data } = await supabase.from('suppliers').insert(record).select('id').single();
      supplierId = data?.id;
      await logActivity({
        action: 'CREATE',
        entity: 'Supplier',
        details: `Yeni tedarikci eklendi: ${record.name}`,
        companyId,
      });
    }

    if (supplierId) {
      if (editingSupplier) {
        await supabase.from('supplier_contacts').delete().eq('supplier_id', supplierId);
      }
      const validContacts = contacts.filter(c => c.full_name.trim());
      if (validContacts.length > 0) {
        await supabase.from('supplier_contacts').insert(
          validContacts.map(c => ({
            supplier_id: supplierId,
            full_name: c.full_name.trim(),
            phone: c.phone.trim() || null,
            email: c.email.trim() || null,
            notes: c.notes.trim() || null,
            company_id: companyId,
          }))
        );
      }
    }

    setSaving(false);
    setShowForm(false);
    loadSuppliers();
    if (supplierId && expandedSupplier === supplierId) {
      loadContacts(supplierId);
    }
  }

  async function handleDelete(supplier: SupplierRow) {
    if (!companyId || !confirm(`"${supplier.name}" adli tedarikciyi silmek istediginize emin misiniz?`)) return;

    await supabase.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', supplier.id);
    await logActivity({
      action: 'DELETE',
      entity: 'Supplier',
      entityId: supplier.id,
      details: `Tedarikci silindi: ${supplier.name}`,
      companyId,
    });
    loadSuppliers();
  }

  function addContact() {
    setContacts(prev => [...prev, { ...emptyContact }]);
  }

  function removeContact(index: number) {
    setContacts(prev => prev.filter((_, i) => i !== index));
  }

  function updateContact(index: number, field: keyof SupplierContact, value: string) {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  const filteredSuppliers = suppliers.filter(s => {
    if (filterCity && s.city !== filterCity) return false;
    if (filterServiceType && s.service_type !== filterServiceType) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.contact_person || '').toLowerCase().includes(term) ||
      (s.city || '').toLowerCase().includes(term) ||
      (s.phone || '').toLowerCase().includes(term)
    );
  });

  const uniqueCities = [...new Set(suppliers.map(s => s.city).filter(Boolean))] as string[];
  const contractedCount = suppliers.filter(s => s.contract_file_url).length;
  const avgDiscount = suppliers.length > 0
    ? Math.round(suppliers.reduce((sum, s) => sum + (s.discount_spare_parts || 0), 0) / suppliers.length)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl shadow-sm">
            <Factory className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Partner Ag Yonetimi</h1>
            <p className="text-sm text-slate-500">Tedarikci, servis ve sozlesme yonetimi</p>
          </div>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Tedarikci Ekle
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Toplam Partner</p>
          <p className="text-2xl font-bold text-slate-900">{suppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Sozlesmeli</p>
          <p className="text-2xl font-bold text-teal-600">{contractedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Ort. Iskonto</p>
          <p className="text-2xl font-bold text-blue-600">%{avgDiscount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Sehir Sayisi</p>
          <p className="text-2xl font-bold text-slate-600">{uniqueCities.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Firma adi, yetkili, sehir, telefon ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[140px]"
          >
            <option value="">Tum Sehirler</option>
            {uniqueCities.sort().map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <select
            value={filterServiceType}
            onChange={(e) => setFilterServiceType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[160px]"
          >
            {serviceTypeOptions.map(o => (
              <option key={o.value} value={o.value}>{o.value ? o.label : 'Tum Hizmetler'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Factory className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500 mb-2">Henuz tedarikci kaydi yok</p>
            <Button variant="secondary" size="sm" onClick={openAddForm}>
              <Plus className="h-4 w-4 mr-1" /> Ilk Tedarikciyi Ekle
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Firma Adi</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Sehir</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Hizmet Turu</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Iskontolar</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Vade</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Sozlesme</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <SupplierTableRow
                    key={supplier.id}
                    supplier={supplier}
                    isExpanded={expandedSupplier === supplier.id}
                    contacts={supplierContacts[supplier.id]}
                    onToggleExpand={() => toggleExpand(supplier.id)}
                    onEdit={() => openEditForm(supplier)}
                    onDelete={() => handleDelete(supplier)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-slate-500">
        Toplam {filteredSuppliers.length} tedarikci
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingSupplier ? 'Tedarikciyi Duzenle' : 'Yeni Tedarikci Ekle'}
        size="xl"
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          {/* Section: Company Info */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Factory className="h-4 w-4 text-teal-600" />
              Firma Bilgileri
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Firma Adi *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Firma / sirket adi"
              />
              <Select
                label="Sehir"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              >
                <option value="">Sehir seciniz</option>
                {turkishCities.filter(c => c).map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Select
                label="Hizmet Turu"
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
              >
                <option value="">Hizmet turu seciniz</option>
                {serviceTypeOptions.filter(o => o.value).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <Input
                label="Adres"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Firma adresi"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0500 000 00 00"
              />
              <Input
                label="E-posta"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="firma@ornek.com"
              />
            </div>
          </div>

          {/* Section: Contract Details */}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Percent className="h-4 w-4 text-blue-600" />
              Sozlesme & Iskonto Detaylari
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Yedek Parca Iskontosu (%)"
                type="number"
                value={formData.discount_spare_parts}
                onChange={(e) => setFormData({ ...formData, discount_spare_parts: e.target.value })}
                placeholder="0"
              />
              <Input
                label="Iscilik Iskontosu (%)"
                type="number"
                value={formData.discount_labor}
                onChange={(e) => setFormData({ ...formData, discount_labor: e.target.value })}
                placeholder="0"
              />
              <Select
                label="Odeme Vadesi"
                value={formData.payment_maturity}
                onChange={(e) => setFormData({ ...formData, payment_maturity: e.target.value })}
              >
                {paymentOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>

            {/* Contract file upload */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Sozlesme PDF / Gorsel Yukle</label>
              {formData.contract_file_url ? (
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <FileText className="h-5 w-5 text-teal-600 flex-shrink-0" />
                  <a
                    href={formData.contract_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:text-teal-700 underline truncate flex-1"
                  >
                    Sozlesme Dosyasi
                  </a>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contract_file_url: '' })}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center justify-center w-full h-20 border-2 border-dashed
                  border-slate-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors
                  ${uploadingContract ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex flex-col items-center text-slate-500">
                    <Upload className="h-5 w-5 mb-1" />
                    <span className="text-xs">{uploadingContract ? 'Yukleniyor...' : 'PDF veya gorsel yuklemek icin tiklayin'}</span>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={handleContractUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Section: Contact Persons */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-600" />
                Musteri Temsilcileri
              </h3>
              <button
                type="button"
                onClick={addContact}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Temsilci Ekle
              </button>
            </div>
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 relative">
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(index)}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      label="Ad Soyad"
                      value={contact.full_name}
                      onChange={(e) => updateContact(index, 'full_name', e.target.value)}
                      placeholder="Temsilci adi"
                    />
                    <Input
                      label="Telefon"
                      value={contact.phone}
                      onChange={(e) => updateContact(index, 'phone', e.target.value)}
                      placeholder="0500 000 00 00"
                    />
                    <Input
                      label="E-posta"
                      type="email"
                      value={contact.email}
                      onChange={(e) => updateContact(index, 'email', e.target.value)}
                      placeholder="kisi@firma.com"
                    />
                  </div>
                  <div className="mt-2">
                    <Input
                      label="Not"
                      value={contact.notes}
                      onChange={(e) => updateContact(index, 'notes', e.target.value)}
                      placeholder="Departman, gorev vs."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save / Cancel */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 sticky bottom-0 bg-white pb-1">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Iptal</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving ? 'Kaydediliyor...' : editingSupplier ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SupplierTableRow({
  supplier,
  isExpanded,
  contacts,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  supplier: SupplierRow;
  isExpanded: boolean;
  contacts?: SupplierContact[];
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
        <td className="py-3 px-4">
          <button onClick={onToggleExpand} className="flex items-center gap-2 text-left group">
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-600" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-600" />
            )}
            <span className="text-sm font-medium text-slate-900 group-hover:text-teal-700">{supplier.name}</span>
          </button>
        </td>
        <td className="py-3 px-4">
          {supplier.city ? (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-sm text-slate-700">{supplier.city}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-400">-</span>
          )}
        </td>
        <td className="py-3 px-4">
          {supplier.service_type ? (
            <span className="text-xs px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-medium">
              {serviceTypeLabels[supplier.service_type] || supplier.service_type}
            </span>
          ) : (
            <span className="text-sm text-slate-400">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          <div className="flex flex-col items-center gap-0.5">
            {(supplier.discount_spare_parts || supplier.discount_labor) ? (
              <>
                <span className="text-xs text-slate-600">
                  YP: <span className="font-semibold text-blue-700">%{supplier.discount_spare_parts || 0}</span>
                </span>
                <span className="text-xs text-slate-600">
                  IS: <span className="font-semibold text-blue-700">%{supplier.discount_labor || 0}</span>
                </span>
              </>
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
          </div>
        </td>
        <td className="py-3 px-4 text-center">
          {supplier.payment_maturity ? (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              {paymentLabels[supplier.payment_maturity] || supplier.payment_maturity}
            </span>
          ) : (
            <span className="text-sm text-slate-400">-</span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {supplier.contract_file_url ? (
            <a
              href={supplier.contract_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              <FileText className="h-3.5 w-3.5" />
              Goruntule
            </a>
          ) : (
            <span className="text-xs text-slate-400">Yok</span>
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center justify-center gap-1">
            <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Duzenle">
              <Edit2 className="h-4 w-4 text-slate-500" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded transition-colors" title="Sil">
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50/50">
          <td colSpan={7} className="px-4 py-4">
            <div className="ml-6 space-y-3">
              {/* Contact info */}
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                {supplier.phone && (
                  <a href={`tel:${supplier.phone}`} className="flex items-center gap-1.5 hover:text-teal-600">
                    <Phone className="h-3.5 w-3.5" />
                    {supplier.phone}
                  </a>
                )}
                {supplier.email && (
                  <a href={`mailto:${supplier.email}`} className="flex items-center gap-1.5 hover:text-teal-600">
                    <Mail className="h-3.5 w-3.5" />
                    {supplier.email}
                  </a>
                )}
                {supplier.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {supplier.address}
                  </span>
                )}
              </div>

              {/* Contact Persons */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Musteri Temsilcileri</h4>
                {!contacts ? (
                  <div className="text-xs text-slate-400">Yukleniyor...</div>
                ) : contacts.length === 0 ? (
                  <div className="text-xs text-slate-400">Kayitli temsilci yok</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {contacts.map((contact, idx) => (
                      <div key={contact.id || idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-teal-700">
                            {contact.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{contact.full_name}</p>
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </a>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-xs text-slate-500 hover:text-teal-600 flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </a>
                          )}
                          {contact.notes && (
                            <p className="text-xs text-slate-400 mt-1">{contact.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
