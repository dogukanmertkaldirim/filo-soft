import { useState, useEffect, useRef } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Customer, Vehicle, CompanyProfile } from '../../types/database';
import { formatCurrency, formatDate, formatCustomerLabel } from '../../utils/format';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import CurrencyInput from '../ui/CurrencyInput';

interface ProposalGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedVehicle?: Vehicle | null;
}

interface ProposalData {
  customerId: string;
  vehicleId: string;
  companyProfileId: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
  validDays: number;
  notes: string;
}

export default function ProposalGenerator({ isOpen, onClose, preselectedVehicle }: ProposalGeneratorProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [formData, setFormData] = useState<ProposalData>({
    customerId: '',
    vehicleId: preselectedVehicle?.id || '',
    companyProfileId: '',
    startDate: '',
    endDate: '',
    dailyRate: 0,
    validDays: 7,
    notes: '',
  });
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedVehicle) {
      setFormData(prev => ({ ...prev, vehicleId: preselectedVehicle.id }));
    }
  }, [preselectedVehicle]);

  async function fetchData() {
    setLoading(true);
    const [customersRes, vehiclesRes, profilesRes] = await Promise.all([
      supabase.from('customers').select('*').order('company_title'),
      supabase.from('vehicles').select('*').in('status', ['idle', 'rented']).order('plate'),
      supabase.from('company_profiles').select('*').order('is_default', { ascending: false }),
    ]);

    if (customersRes.data) setCustomers(customersRes.data);
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    if (profilesRes.data) {
      setCompanyProfiles(profilesRes.data);
      const defaultProfile = profilesRes.data.find(p => p.is_default);
      if (defaultProfile && !formData.companyProfileId) {
        setFormData(prev => ({ ...prev, companyProfileId: defaultProfile.id }));
      }
    }
    setLoading(false);
  }

  const selectedCustomer = customers.find(c => c.id === formData.customerId);
  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
  const selectedCompany = companyProfiles.find(p => p.id === formData.companyProfileId);

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const totalDays = calculateDays();
  const totalAmount = totalDays * formData.dailyRate;

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  if (showPreview && selectedCustomer && selectedVehicle && selectedCompany) {
    const proposalDate = new Date().toLocaleDateString('tr-TR');
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + formData.validDays);

    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-gray-900/50">
        <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4 mr-2" />
            Yazdir
          </Button>
          <Button onClick={() => setShowPreview(false)} variant="secondary">
            Duzenle
          </Button>
          <Button onClick={onClose} variant="secondary">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div ref={printRef} className="print-container bg-white min-h-screen">
          <div className="max-w-[210mm] mx-auto p-8">
            <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-6">
              <div className="flex items-center gap-4">
                {selectedCompany.logo_url && (
                  <img src={selectedCompany.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedCompany.title}</h1>
                  <p className="text-sm text-gray-600">{selectedCompany.legal_name}</p>
                </div>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p>{selectedCompany.address}</p>
                <p>Tel: {selectedCompany.phone}</p>
                <p>E-posta: {selectedCompany.email}</p>
                {selectedCompany.tax_office && (
                  <p>Vergi Dairesi: {selectedCompany.tax_office}</p>
                )}
                {selectedCompany.tax_no && (
                  <p>VKN: {selectedCompany.tax_no}</p>
                )}
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 tracking-wide">ARAC KIRALAMA FIYAT TEKLIFI</h2>
              <p className="text-sm text-gray-500 mt-1">Teklif No: TKL-{Date.now().toString().slice(-6)}</p>
              <p className="text-sm text-gray-500">Tarih: {proposalDate}</p>
            </div>

            <div className="mb-8 bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-3 text-lg">SAYIN,</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-900">{selectedCustomer.company_title}</p>
                  {selectedCustomer.authorized_person && (
                    <p className="text-gray-600">{selectedCustomer.authorized_person}</p>
                  )}
                </div>
                <div className="text-right">
                  {selectedCustomer.tax_id && (
                    <p className="text-gray-600">VKN/TCKN: {selectedCustomer.tax_id}</p>
                  )}
                  {selectedCustomer.address && (
                    <p className="text-gray-600">{selectedCustomer.address}</p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-gray-700 mb-6 leading-relaxed">
              Talebiniz uzerine, asagida belirtilen arac icin fiyat teklifimizi bilgilerinize sunariz:
            </p>

            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg border-b pb-2">ARAC BILGILERI</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600 w-1/3">Plaka</td>
                    <td className="py-2 font-medium">{selectedVehicle.plate}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600">Marka / Model</td>
                    <td className="py-2 font-medium">{selectedVehicle.brand} {selectedVehicle.model}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600">Model Yili</td>
                    <td className="py-2 font-medium">{selectedVehicle.year || '-'}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600">Renk</td>
                    <td className="py-2 font-medium">{selectedVehicle.color || '-'}</td>
                  </tr>
                  {selectedVehicle.chassis_number && (
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">Sasi No</td>
                      <td className="py-2 font-medium">{selectedVehicle.chassis_number}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg border-b pb-2">KIRALAMA DETAYLARI</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600 w-1/3">Baslangic Tarihi</td>
                    <td className="py-2 font-medium">{formatDate(formData.startDate)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600">Bitis Tarihi</td>
                    <td className="py-2 font-medium">{formatDate(formData.endDate)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 text-gray-600">Toplam Gun</td>
                    <td className="py-2 font-medium">{totalDays} Gun</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-8 bg-blue-50 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-4 text-lg">FIYATLANDIRMA</h3>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-blue-200">
                    <td className="py-3 text-gray-700">Gunluk Kiralama Ucreti</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(formData.dailyRate)}</td>
                  </tr>
                  <tr className="border-b border-blue-200">
                    <td className="py-3 text-gray-700">Toplam Gun</td>
                    <td className="py-3 text-right font-medium">{totalDays} Gun</td>
                  </tr>
                  <tr className="bg-blue-100">
                    <td className="py-4 text-lg font-semibold text-gray-900">TOPLAM TUTAR</td>
                    <td className="py-4 text-right text-xl font-bold text-blue-700">{formatCurrency(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-sm font-medium text-gray-700 mt-3 italic">* Fiyatlarımıza KDV dahil değildir.</p>
            </div>

            {formData.notes && (
              <div className="mb-8">
                <h3 className="font-semibold text-gray-800 mb-2">NOTLAR</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{formData.notes}</p>
              </div>
            )}

            <div className="mb-8 border-t-2 border-gray-200 pt-6">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Onemli:</strong> Bu teklif <strong>{validUntil.toLocaleDateString('tr-TR')}</strong> tarihine kadar gecerlidir.
                  Belirtilen tarihten sonra fiyatlar guncellenebilir.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-12">
              <div className="text-center">
                <div className="border-t-2 border-gray-400 pt-2 mt-16">
                  <p className="font-medium text-gray-700">TEKLIF VEREN</p>
                  <p className="text-sm text-gray-600">{selectedCompany.title}</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t-2 border-gray-400 pt-2 mt-16">
                  <p className="font-medium text-gray-700">MUSTERI</p>
                  <p className="text-sm text-gray-600">{selectedCustomer.company_title}</p>
                </div>
              </div>
            </div>

            {selectedCompany.iban_details && (
              <div className="mt-12 pt-6 border-t text-sm text-gray-600">
                <h4 className="font-semibold text-gray-700 mb-2">BANKA HESAP BILGILERI</h4>
                <p className="whitespace-pre-wrap">{selectedCompany.iban_details}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Fiyat Teklifi Olustur</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Yukleniyor...</p>
            </div>
          ) : (
            <>
              <Select
                label="Sirket Profili *"
                value={formData.companyProfileId}
                onChange={(e) => setFormData({ ...formData, companyProfileId: e.target.value })}
                options={[
                  { value: '', label: 'Sirket secin...' },
                  ...companyProfiles.map(p => ({ value: p.id, label: p.title })),
                ]}
              />

              <Select
                label="Musteri *"
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                options={[
                  { value: '', label: 'Musteri secin...' },
                  ...customers.map(c => ({ value: c.id, label: formatCustomerLabel(c) })),
                ]}
              />

              <Select
                label="Arac *"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                options={[
                  { value: '', label: 'Arac secin...' },
                  ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })),
                ]}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Başlangıç Tarihi *"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
                <Input
                  label="Bitiş Tarihi *"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CurrencyInput
                  label="Gunluk Ucret *"
                  value={formData.dailyRate}
                  onChange={(v) => setFormData({ ...formData, dailyRate: v })}
                />
                <Input
                  label="Teklif Gecerlilik (Gun)"
                  type="number"
                  value={formData.validDays}
                  onChange={(e) => setFormData({ ...formData, validDays: parseInt(e.target.value) || 7 })}
                />
              </div>

              {totalDays > 0 && formData.dailyRate > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Toplam ({totalDays} gun)</span>
                    <span className="text-xl font-bold text-blue-700">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Ek notlar..."
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Iptal
          </Button>
          <Button
            onClick={() => setShowPreview(true)}
            disabled={!formData.customerId || !formData.vehicleId || !formData.companyProfileId || !formData.startDate || !formData.endDate || formData.dailyRate <= 0}
          >
            <FileText className="w-4 h-4 mr-2" />
            Onizleme ve Yazdir
          </Button>
        </div>
      </div>
    </div>
  );
}
