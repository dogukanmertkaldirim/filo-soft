import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Phone, Upload, Loader2, X, FileText, ExternalLink, MapPin, ImageIcon, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/auditLog';
import type { Driver } from '../types/database';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

const STORAGE_BUCKET = 'driver-documents';

const regionOptions = [
  { value: '', label: 'Bolge secin...' },
  { value: 'Istanbul', label: 'Istanbul' },
  { value: 'Ankara', label: 'Ankara' },
  { value: 'Izmir', label: 'Izmir' },
  { value: 'Bursa', label: 'Bursa' },
  { value: 'Antalya', label: 'Antalya' },
  { value: 'custom', label: 'Diger (Elle girin)' },
];

const statusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Pasif' },
];

interface DriverFormData {
  name: string;
  phone: string;
  status: string;
  notes: string;
  driver_photo_url: string | null;
  license_document_url: string | null;
  operation_region: string;
  custom_region: string;
}

const emptyForm: DriverFormData = {
  name: '',
  phone: '',
  status: 'active',
  notes: '',
  driver_photo_url: null,
  license_document_url: null,
  operation_region: '',
  custom_region: '',
};

async function uploadToStorage(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file);
  if (error) return null;

  const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return publicUrl;
}

function DriverPhotoUpload({ url, onUpload, uploading, setUploading }: {
  url: string | null;
  onUpload: (url: string | null) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    const publicUrl = await uploadToStorage(file, 'photos');
    if (publicUrl) onUpload(publicUrl);
    setUploading(false);
    e.target.value = '';
  }, [onUpload, setUploading]);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <Camera className="h-3.5 w-3.5 inline mr-1" />
        Surucu Fotografi
      </label>
      {url ? (
        <div className="relative inline-block">
          <img src={url} alt="Surucu" className="w-28 h-28 rounded-xl object-cover border-2 border-slate-200 shadow-sm" />
          <button
            type="button"
            onClick={() => onUpload(null)}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={`w-28 h-28 flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            uploading ? 'border-teal-400 bg-teal-50 pointer-events-none' : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/50'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-teal-500 animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-slate-400 mb-1" />
              <span className="text-[10px] text-slate-500 text-center px-1">Foto yukle</span>
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} />
    </div>
  );
}

function LicenseDocUpload({ url, onUpload, uploading, setUploading }: {
  url: string | null;
  onUpload: (url: string | null) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const publicUrl = await uploadToStorage(file, 'licenses');
    if (publicUrl) onUpload(publicUrl);
    setUploading(false);
    e.target.value = '';
  }, [onUpload, setUploading]);

  const isImage = url?.match(/\.(jpg|jpeg|png|webp|heic)/i);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <FileText className="h-3.5 w-3.5 inline mr-1" />
        Ehliyet Belgesi (Onlu Arkali)
      </label>
      {url ? (
        <div className="relative border border-slate-200 rounded-xl p-3 bg-slate-50">
          <div className="flex items-center gap-3">
            {isImage ? (
              <img src={url} alt="Ehliyet" className="h-16 w-24 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="h-16 w-24 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="h-8 w-8 text-red-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">{isImage ? 'Ehliyet Fotografi' : 'Ehliyet PDF'}</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-1"
              >
                <ExternalLink className="h-3 w-3" />
                Goruntule / Indir
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpload(null)}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className={`flex items-center justify-center w-full h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            uploading ? 'border-teal-400 bg-teal-50 pointer-events-none' : 'border-slate-300 hover:border-teal-400 hover:bg-teal-50/50'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-teal-500 animate-spin" />
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-5 w-5 text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">Resim veya PDF yukleyin</span>
            </div>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleSelect} />
    </div>
  );
}

export default function Drivers() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<DriverFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [licenseUploading, setLicenseUploading] = useState(false);

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

  function openAddForm() {
    setEditingDriver(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(driver: Driver) {
    setEditingDriver(driver);
    const knownRegions = regionOptions.map(r => r.value).filter(v => v && v !== 'custom');
    const isCustom = driver.operation_region && !knownRegions.includes(driver.operation_region);

    setFormData({
      name: driver.name,
      phone: driver.phone || '',
      status: driver.status,
      notes: driver.notes || '',
      driver_photo_url: driver.driver_photo_url,
      license_document_url: driver.license_document_url,
      operation_region: isCustom ? 'custom' : (driver.operation_region || ''),
      custom_region: isCustom ? (driver.operation_region || '') : '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!companyId || !formData.name.trim()) return;
    setSaving(true);

    const region = formData.operation_region === 'custom'
      ? formData.custom_region.trim() || null
      : formData.operation_region || null;

    const record = {
      company_id: companyId,
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      status: formData.status,
      notes: formData.notes.trim() || null,
      driver_photo_url: formData.driver_photo_url,
      license_document_url: formData.license_document_url,
      operation_region: region,
    };

    if (editingDriver) {
      await supabase.from('drivers').update(record).eq('id', editingDriver.id);
      await logActivity({
        action: 'UPDATE',
        entity: 'Driver',
        entityId: editingDriver.id,
        details: `Surucu guncellendi: ${record.name}`,
        companyId,
      });
    } else {
      await supabase.from('drivers').insert(record);
      await logActivity({
        action: 'CREATE',
        entity: 'Driver',
        details: `Yeni surucu eklendi: ${record.name}`,
        companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadDrivers();
  }

  async function handleDelete(driver: Driver) {
    if (!companyId || !confirm(`"${driver.name}" adli surucuyu silmek istediginize emin misiniz?`)) return;
    await supabase.from('drivers').update({ deleted_at: new Date().toISOString() }).eq('id', driver.id);
    await logActivity({
      action: 'DELETE',
      entity: 'Driver',
      entityId: driver.id,
      details: `Surucu silindi: ${driver.name}`,
      companyId,
    });
    loadDrivers();
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
            <p className="text-sm text-slate-500">Surucu kadrosu yonetimi</p>
          </div>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Sofor
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
            <p className="text-slate-500 mb-2">Henuz sofor kaydi yok</p>
            <Button variant="secondary" size="sm" onClick={openAddForm}>
              <Plus className="h-4 w-4 mr-1" /> Ilk Soforu Ekle
            </Button>
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
                  <th className="text-center py-3 px-4 font-medium text-slate-600 text-sm">Islemler</th>
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
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditForm(driver)} className="p-1.5 hover:bg-slate-100 rounded transition-colors">
                            <Edit2 className="h-4 w-4 text-slate-500" />
                          </button>
                          <button onClick={() => handleDelete(driver)} className="p-1.5 hover:bg-red-50 rounded transition-colors">
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
        Toplam {filteredDrivers.length} sofor
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingDriver ? 'Soforu Duzenle' : 'Yeni Sofor'}
        size="lg"
      >
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <DriverPhotoUpload
              url={formData.driver_photo_url}
              onUpload={(url) => setFormData({ ...formData, driver_photo_url: url })}
              uploading={photoUploading}
              setUploading={setPhotoUploading}
            />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Ad Soyad *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Surucu adi"
              />
              <Input
                label="Telefon"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0500 000 00 00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Operasyon Bolgesi"
                value={formData.operation_region}
                onChange={(e) => setFormData({ ...formData, operation_region: e.target.value, custom_region: '' })}
                options={regionOptions}
              />
              {formData.operation_region === 'custom' && (
                <div className="mt-2">
                  <Input
                    placeholder="Bolge adini yazin..."
                    value={formData.custom_region}
                    onChange={(e) => setFormData({ ...formData, custom_region: e.target.value })}
                  />
                </div>
              )}
            </div>
            <Select
              label="Durum"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={statusOptions}
            />
          </div>

          <LicenseDocUpload
            url={formData.license_document_url}
            onUpload={(url) => setFormData({ ...formData, license_document_url: url })}
            uploading={licenseUploading}
            setUploading={setLicenseUploading}
          />

          <Input
            label="Notlar"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Ek bilgi..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Iptal</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name.trim() || photoUploading || licenseUploading}
            >
              {saving ? 'Kaydediliyor...' : editingDriver ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
