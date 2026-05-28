import { useState, useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Customer, Vehicle, Rental, CompanyProfile } from '../../types/database';
import { formatCurrency, formatDate } from '../../utils/format';
import Button from '../ui/Button';

interface ContractGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  rentalId: string;
}

interface ContractData {
  rental: Rental;
  customer: Customer;
  vehicle: Vehicle;
  company: CompanyProfile;
}

const fuelLevelLabels: Record<string, string> = {
  'empty': 'Boş',
  '1/4': '1/4',
  '1/2': '1/2',
  '3/4': '3/4',
  'full': 'Dolu',
};

const cleanlinessLabels: Record<string, string> = {
  'clean': 'Temiz (İç/Dış)',
  'normal': 'Orta',
  'dirty': 'Kirli',
};

export default function ContractGenerator({ isOpen, onClose, rentalId }: ContractGeneratorProps) {
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && rentalId) {
      fetchContractData();
    }
  }, [isOpen, rentalId]);

  async function fetchContractData() {
    setLoading(true);
    setError(null);

    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('*')
      .eq('id', rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      setError('Kiralama bilgisi bulunamadı');
      setLoading(false);
      return;
    }

    const [customerRes, vehicleRes, companyRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', rental.customer_id).maybeSingle(),
      supabase.from('vehicles').select('*').eq('id', rental.vehicle_id).maybeSingle(),
      rental.company_profile_id
        ? supabase.from('company_profiles').select('*').eq('id', rental.company_profile_id).maybeSingle()
        : supabase.from('company_profiles').select('*').eq('is_default', true).maybeSingle(),
    ]);

    if (!customerRes.data || !vehicleRes.data) {
      setError('Müşteri veya araç bilgisi bulunamadı');
      setLoading(false);
      return;
    }

    if (!companyRes.data) {
      const fallback = await supabase.from('company_profiles').select('*').limit(1).maybeSingle();
      if (!fallback.data) {
        setError('Şirket profili bulunamadı. Lütfen önce şirket profili ekleyin.');
        setLoading(false);
        return;
      }
      setData({
        rental,
        customer: customerRes.data,
        vehicle: vehicleRes.data,
        company: fallback.data,
      });
    } else {
      setData({
        rental,
        customer: customerRes.data,
        vehicle: vehicleRes.data,
        company: companyRes.data,
      });
    }

    setLoading(false);
  }

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Sözleşme yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50">
        <div className="bg-white rounded-xl p-8 max-w-md">
          <p className="text-red-600 mb-4">{error || 'Bir hata oluştu'}</p>
          <Button onClick={onClose}>Kapat</Button>
        </div>
      </div>
    );
  }

  const { rental, customer, vehicle, company } = data;
  const contractDate = new Date().toLocaleDateString('tr-TR');
  const startDate = new Date(rental.start_date);
  const endDate = new Date(rental.end_date);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-gray-900/50">
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="w-4 h-4 mr-2" />
          Yazdır
        </Button>
        <Button onClick={onClose} variant="secondary">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div ref={printRef} className="print-container bg-white min-h-screen" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        <div className="max-w-[210mm] mx-auto p-6 text-sm">
          <div className="flex justify-between items-start mb-6 border-b-2 border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              {company.logo_url && (
                <img src={company.logo_url} alt="Logo" className="h-14 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{company.title}</h1>
                <p className="text-xs text-gray-600">{company.legal_name}</p>
              </div>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p>{company.address}</p>
              <p>Tel: {company.phone}</p>
              {company.tax_office && <p>V.D: {company.tax_office}</p>}
              {company.tax_no && <p>VKN: {company.tax_no}</p>}
              {company.mersis_no && <p>MERSIS: {company.mersis_no}</p>}
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 tracking-wider">ARAÇ KİRALAMA SÖZLEŞMESİ</h2>
            <p className="text-xs text-gray-500 mt-1">
              Sözleşme No: KS-{rental.id.slice(0, 8).toUpperCase()} | Tarih: {contractDate}
            </p>
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">A. TARAFLAR</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">KİRAYA VEREN</h4>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="py-0.5 text-gray-500 w-24">Ünvan:</td><td className="font-medium">{company.legal_name}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Adres:</td><td>{company.address || '-'}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">VKN:</td><td>{company.tax_no || '-'}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">MERSIS:</td><td>{company.mersis_no || '-'}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Telefon:</td><td>{company.phone || '-'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">KİRACI</h4>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="py-0.5 text-gray-500 w-24">Ünvan:</td><td className="font-medium">{customer.company_title}</td></tr>
                    {customer.authorized_person && (
                      <tr><td className="py-0.5 text-gray-500">Yetkili:</td><td>{customer.authorized_person}</td></tr>
                    )}
                    <tr><td className="py-0.5 text-gray-500">Adres:</td><td>{customer.address || '-'}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">VKN/TCKN:</td><td>{customer.tax_id || '-'}</td></tr>
                    {customer.email && (
                      <tr><td className="py-0.5 text-gray-500">E-posta:</td><td>{customer.email}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">B. ARAÇ BİLGİLERİ VE KİRALAMA SÜRESİ</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">ARAÇ BİLGİLERİ</h4>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="py-0.5 text-gray-500 w-24">Plaka:</td><td className="font-medium">{vehicle.plate}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Marka/Model:</td><td>{vehicle.brand} {vehicle.model}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Model Yılı:</td><td>{vehicle.year || '-'}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Renk:</td><td>{vehicle.color || '-'}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Şasi No:</td><td>{vehicle.chassis_number || '-'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="border rounded-lg p-3">
                <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">KİRALAMA SÜRESİ</h4>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="py-0.5 text-gray-500 w-24">Başlangıç:</td><td className="font-medium">{formatDate(rental.start_date)}{rental.start_datetime ? ` - ${new Date(rental.start_datetime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Bitiş:</td><td className="font-medium">{formatDate(rental.end_date)}{rental.end_datetime ? ` - ${new Date(rental.end_datetime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}</td></tr>
                    <tr><td className="py-0.5 text-gray-500">Toplam:</td><td className="font-semibold">{totalDays} Gün</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">C. ARAÇ TESLİM DURUMU</h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 divide-x bg-gray-50 border-b">
                <div className="p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Kilometre</p>
                  <p className="text-sm font-bold text-gray-900">{rental.starting_km?.toLocaleString('tr-TR') || '0'} km</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Yakıt Seviyesi</p>
                  <p className="text-sm font-bold text-gray-900">{rental.fuel_status ? fuelLevelLabels[rental.fuel_status] : '-'}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Temizlik</p>
                  <p className="text-sm font-bold text-gray-900">{rental.start_cleanliness_status ? cleanlinessLabels[rental.start_cleanliness_status] : '-'}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Depozito</p>
                  <p className="text-sm font-bold text-gray-900">{rental.deposit_amount > 0 ? formatCurrency(rental.deposit_amount) : '-'}</p>
                </div>
              </div>
              {rental.initial_damage_notes && (
                <div className="p-3 border-t">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Teslim Hasar Notları</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{rental.initial_damage_notes}</p>
                </div>
              )}
              {!rental.initial_damage_notes && (
                <div className="p-3 border-t">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Teslim Hasar Notları</p>
                  <p className="text-xs text-gray-500 italic">Hasar notu bulunmamaktadır.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">D. MALİ ŞARTLAR</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 text-gray-600 bg-gray-50 w-1/2">Günlük Kiralama Ücreti</td>
                    <td className="py-2 px-3 font-medium">{formatCurrency(rental.daily_rate)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 text-gray-600 bg-gray-50">Toplam Gün</td>
                    <td className="py-2 px-3 font-medium">{totalDays} Gün</td>
                  </tr>
                  <tr className="border-b bg-blue-50">
                    <td className="py-2 px-3 font-semibold text-gray-800">TOPLAM KİRALAMA BEDELİ</td>
                    <td className="py-2 px-3 font-bold text-blue-700">{formatCurrency(rental.total_amount)}</td>
                  </tr>
                  {rental.deposit_amount > 0 && (
                    <tr className="border-b">
                      <td className="py-2 px-3 text-gray-600 bg-gray-50">Depozito</td>
                      <td className="py-2 px-3 font-medium">{formatCurrency(rental.deposit_amount)}</td>
                    </tr>
                  )}
                  <tr className="border-b">
                    <td className="py-2 px-3 text-gray-600 bg-gray-50">Günlük KM Limiti</td>
                    <td className="py-2 px-3 font-medium">
                      {rental.daily_km_limit ? `${rental.daily_km_limit.toLocaleString('tr-TR')} km/gün` : 'Limitsiz'}
                    </td>
                  </tr>
                  {rental.per_km_overage_fee && rental.per_km_overage_fee > 0 && (
                    <tr className="border-b bg-red-50">
                      <td className="py-2 px-3 text-red-700 font-medium">KM Aşım Bedeli</td>
                      <td className="py-2 px-3 font-bold text-red-700">{formatCurrency(rental.per_km_overage_fee)} / km</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-5 no-break">
            <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">E. GENEL KİRALAMA VE KULLANIM ŞARTLARI</h3>
            <div className="border rounded-lg p-3">
              <div className="text-[9px] text-gray-600 leading-relaxed text-justify space-y-2">
                <p><strong>1. KULLANIM:</strong> Araç, sadece sözleşmede belirtilen sürücüler tarafından kullanılabilir. Alkol, uyuşturucu etkisi altında veya ehliyetsiz kullanım yasaktır. Alt kiralama yapılamaz.</p>
                <p><strong>2. SÜRE VE İADE:</strong> Kiracı, aracı sözleşme bitiş tarihinde, aldığı yakıt seviyesinde ve temizlikte iade etmekle yükümlüdür. Gecikmelerde günlük kira bedeli üzerinden ek ücret tahsil edilir.</p>
                <p><strong>3. HASAR VE KAZA:</strong> Kaza durumunda araç yerinden oynatılmadan Polis/Jandarma raporu tutulmalıdır. Tutanaksız hasarlarda sigorta geçersizdir, tüm masraf kiracıya aittir.</p>
                <p><strong>4. TRAFİK CEZALARI:</strong> Kiralama süresince oluşan tüm trafik cezaları (HGS/OGS dahil) kiracıya aittir. Plakaya gelen cezalar, hizmet bedeli eklenerek kiracıdan tahsil edilir.</p>
                <p><strong>5. BAKIM (UZUN DÖNEM):</strong> Uzun dönem kiralamalarda; yağ, su, lastik hava kontrolü kiracının sorumluluğundadır. Gösterge panelindeki ikaz ışıklarını kiraya verene bildirmemekten doğacak motor arızaları kiracıya rücu edilir.</p>
                <p><strong>6. KM SINIRI:</strong> Belirtilen KM sınırı aşımında, sözleşmede yazan birim fiyat üzerinden ek bedel tahsil edilir.</p>
                <p><strong>7. SORUMLULUK:</strong> Kiracı, aracı özenle kullanmakla, kilitli ve güvenli tutmakla yükümlüdür.</p>
              </div>
              <div className="mt-3 pt-2 border-t border-gray-200">
                <p className="text-[8px] text-gray-500 italic">İşbu sözleşme Türk Hukuku'na tabidir. Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.</p>
              </div>
            </div>
          </div>

          {rental.notes && (
            <div className="mb-5">
              <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">F. EK NOTLAR</h3>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{rental.notes}</p>
              </div>
            </div>
          )}

          <div className="mb-6 no-break signature-section">
            <h3 className="text-sm font-bold text-white bg-gray-800 px-3 py-1.5 mb-3">G. İMZALAR</h3>
            <p className="text-xs text-gray-600 mb-4 italic">
              İşbu sözleşme, taraflarca okunmuş ve kabul edilmiştir. Araç teslim alınmış olup, belirtilen şartlar çerçevesinde kullanılacaktır.
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center border rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">TESLİM EDEN (KİRAYA VEREN)</p>
                <div className="h-16 border-b border-dashed border-gray-300 mb-2"></div>
                <p className="font-medium text-sm">{company.title}</p>
                <p className="text-xs text-gray-500">Tarih: ....../....../......</p>
              </div>
              <div className="text-center border rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">TESLİM ALAN (KİRACI)</p>
                <div className="h-16 border-b border-dashed border-gray-300 mb-2"></div>
                <p className="font-medium text-sm">{customer.company_title}</p>
                <p className="text-xs text-gray-500">Tarih: ....../....../......</p>
              </div>
            </div>
          </div>

          {company.iban_details && (
            <div className="border-t-2 border-gray-300 pt-4 mt-6">
              <h4 className="font-semibold text-gray-700 mb-2 text-xs">BANKA HESAP BİLGİLERİ</h4>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{company.iban_details}</p>
            </div>
          )}

          <div className="text-center text-[9px] text-gray-400 mt-6 pt-4 border-t">
            <p>Bu belge {company.title} tarafından elektronik ortamda oluşturulmuştur.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
