import { useState, useEffect, useRef } from 'react';
import { X, Printer, FileText, Car, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Rental, Vehicle, Customer, CompanyProfile } from '../../types/database';
import Button from '../ui/Button';

interface DeliveryReturnReportProps {
  isOpen: boolean;
  onClose: () => void;
  rentalId: string;
  companyId?: string;
}

interface ReportData {
  rental: Rental | null;
  vehicle: Vehicle | null;
  customer: Customer | null;
  companyProfile: CompanyProfile | null;
}

const FUEL_LEVELS: Record<string, number> = {
  'empty': 0,
  '1/4': 25,
  '1/2': 50,
  '3/4': 75,
  'full': 100,
};

export default function DeliveryReturnReport({ isOpen, onClose, rentalId, companyId }: DeliveryReturnReportProps) {
  const [data, setData] = useState<ReportData>({ rental: null, vehicle: null, customer: null, companyProfile: null });
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && rentalId) {
      loadData();
    }
  }, [isOpen, rentalId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: rentalData } = await supabase
        .from('rentals')
        .select('*')
        .eq('id', rentalId)
        .maybeSingle();

      if (!rentalData) {
        setLoading(false);
        return;
      }

      const [vehicleRes, customerRes, profileRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', rentalData.vehicle_id).maybeSingle(),
        supabase.from('customers').select('*').eq('id', rentalData.customer_id).maybeSingle(),
        rentalData.company_profile_id
          ? supabase.from('company_profiles').select('*').eq('id', rentalData.company_profile_id).maybeSingle()
          : companyId
            ? supabase.from('company_profiles').select('*').eq('company_id', companyId).eq('is_default', true).maybeSingle()
            : Promise.resolve({ data: null }),
      ]);

      setData({
        rental: rentalData,
        vehicle: vehicleRes.data,
        customer: customerRes.data,
        companyProfile: profileRes.data,
      });
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function getRentalModelLabel(model: string | null | undefined): string {
    switch (model) {
      case 'rent_a_car': return 'Rent a Car (Gunluk)';
      case 'operational_leasing': return 'Operasyonel Kiralama';
      case 'financial_leasing': return 'Finansal Kiralama';
      default: return 'Rent a Car';
    }
  }

  function getKmLimitText(): string {
    const { rental } = data;
    if (!rental) return '-';

    if (rental.rental_model === 'rent_a_car' && rental.daily_km_limit) {
      return `${rental.daily_km_limit} km/gun`;
    }
    if ((rental.rental_model === 'operational_leasing' || rental.rental_model === 'financial_leasing') && rental.monthly_km_limit) {
      return `${rental.monthly_km_limit} km/ay`;
    }
    return 'Sinirsiz';
  }

  function calculateKmAnalysis() {
    const { rental } = data;
    if (!rental) return null;

    const startKm = rental.starting_km || 0;
    const endKm = rental.end_km || rental.return_km || 0;
    const drivenKm = Math.max(0, endKm - startKm);

    const startDate = new Date(rental.start_datetime || rental.start_date);
    const endDate = rental.actual_return_date
      ? new Date(rental.actual_return_date)
      : rental.return_datetime
        ? new Date(rental.return_datetime)
        : new Date(rental.end_date);
    const daysUsed = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    let allowedKm = 0;
    if (rental.rental_model === 'rent_a_car' && rental.daily_km_limit) {
      allowedKm = rental.daily_km_limit * daysUsed;
    } else if (rental.monthly_km_limit) {
      allowedKm = Math.round((rental.monthly_km_limit / 30) * daysUsed);
    }

    const overLimit = allowedKm > 0 ? Math.max(0, drivenKm - allowedKm) : 0;

    return { startKm, endKm, drivenKm, daysUsed, allowedKm, overLimit };
  }

  if (!isOpen) return null;

  const { rental, vehicle, customer, companyProfile } = data;
  const kmAnalysis = calculateKmAnalysis();
  const isReturned = rental?.status === 'completed' || !!rental?.return_datetime || !!rental?.actual_return_date;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Teslim / Iade Tutanagi</h2>
              <p className="text-sm text-slate-300">{vehicle?.plate} - {vehicle?.brand} {vehicle?.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="bg-white/10 hover:bg-white/20 text-white">
              <Printer className="h-4 w-4 mr-2" />
              Yazdir
            </Button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div ref={printRef} className="p-6 overflow-y-auto max-h-[calc(95vh-80px)] print:p-8 print:max-h-none print:overflow-visible">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
            </div>
          ) : !rental ? (
            <div className="text-center py-12 text-slate-500">Kiralama bilgisi bulunamadi</div>
          ) : (
            <div className="space-y-6 print:space-y-0">
              <style>{`
                @media print {
                  /* ===== PAGE SETUP (A4 Standard) ===== */
                  @page {
                    size: A4 portrait;
                    margin: 12mm 15mm 15mm 15mm;
                  }

                  /* ===== GLOBAL RESET ===== */
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    background: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                  }

                  /* ===== HIDE EVERYTHING EXCEPT REPORT ===== */
                  body > *:not(.print-root),
                  nav, aside, header, footer,
                  button, .no-print,
                  [class*="modal"], [class*="Modal"],
                  [class*="sidebar"], [class*="Sidebar"],
                  [class*="toast"], [class*="Toast"] {
                    display: none !important;
                    visibility: hidden !important;
                  }

                  /* ===== LAYOUT RESET (Fixing Overlap) ===== */
                  .print-root,
                  .print-root > *,
                  #print-report,
                  #print-report > * {
                    display: block !important;
                    position: static !important;
                    float: none !important;
                    visibility: visible !important;
                    overflow: visible !important;
                    transform: none !important;
                    opacity: 1 !important;
                  }

                  .print-root {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    background: white !important;
                    z-index: 999999 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }

                  #print-report {
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }

                  /* ===== FONT & TYPOGRAPHY ===== */
                  #print-report,
                  #print-report * {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                    line-height: 1.4 !important;
                  }

                  #print-report h1 { font-size: 14pt !important; }
                  #print-report h2 { font-size: 13pt !important; }
                  #print-report h3 { font-size: 11pt !important; }
                  #print-report p, #print-report span, #print-report div { font-size: 9pt !important; }
                  #print-report .text-xs { font-size: 8pt !important; }
                  #print-report .text-sm { font-size: 9pt !important; }
                  #print-report .text-lg { font-size: 11pt !important; }
                  #print-report .text-xl { font-size: 12pt !important; }

                  /* ===== COLORS & BORDERS (Print-Friendly) ===== */
                  #print-report [class*="bg-slate"],
                  #print-report [class*="bg-blue"],
                  #print-report [class*="bg-green"],
                  #print-report [class*="bg-amber"],
                  #print-report [class*="bg-red"] {
                    background-color: #f8fafc !important;
                    -webkit-print-color-adjust: exact !important;
                  }

                  #print-report [class*="border"] {
                    border-color: #334155 !important;
                  }

                  #print-report [class*="rounded"] {
                    border-radius: 4px !important;
                  }

                  /* ===== SPACING REDUCTION ===== */
                  #print-report .space-y-6 > * + * { margin-top: 12px !important; }
                  #print-report .space-y-4 > * + * { margin-top: 8px !important; }
                  #print-report .space-y-3 > * + * { margin-top: 6px !important; }
                  #print-report .space-y-2 > * + * { margin-top: 4px !important; }
                  #print-report .mb-6 { margin-bottom: 12px !important; }
                  #print-report .mb-4 { margin-bottom: 8px !important; }
                  #print-report .mb-3 { margin-bottom: 6px !important; }
                  #print-report .p-4 { padding: 8px !important; }
                  #print-report .p-3 { padding: 6px !important; }
                  #print-report .p-2 { padding: 4px !important; }
                  #print-report .gap-6 { gap: 12px !important; }
                  #print-report .gap-4 { gap: 8px !important; }
                  #print-report .gap-3 { gap: 6px !important; }

                  /* ===== GRID TO BLOCK CONVERSION ===== */
                  #print-report .grid {
                    display: block !important;
                  }

                  #print-report .grid.grid-cols-2 {
                    display: flex !important;
                    flex-wrap: wrap !important;
                  }

                  #print-report .grid.grid-cols-2 > * {
                    width: 48% !important;
                    flex: 0 0 48% !important;
                    margin-right: 2% !important;
                    margin-bottom: 8px !important;
                  }

                  #print-report .grid.grid-cols-4 {
                    display: flex !important;
                    flex-wrap: wrap !important;
                  }

                  #print-report .grid.grid-cols-4 > * {
                    width: 23% !important;
                    flex: 0 0 23% !important;
                    margin-right: 2% !important;
                  }

                  #print-report .grid.grid-cols-5 {
                    display: flex !important;
                    flex-wrap: wrap !important;
                  }

                  #print-report .grid.grid-cols-5 > * {
                    width: 18% !important;
                    flex: 0 0 18% !important;
                    margin-right: 2% !important;
                  }

                  /* ===== PAGE BREAK LOGIC ===== */
                  #print-report h1,
                  #print-report h2,
                  #print-report h3 {
                    page-break-after: avoid !important;
                    break-after: avoid !important;
                  }

                  /* Signature Section - NEVER split */
                  #print-report .signature-section {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    margin-top: 20px !important;
                  }

                  /* Vehicle Condition Section */
                  #print-report .condition-section {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }

                  /* Fee Sections */
                  #print-report .fees-section {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }

                  /* Info Boxes */
                  #print-report [class*="bg-blue-50"],
                  #print-report [class*="bg-green-50"],
                  #print-report [class*="bg-amber-50"] {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                  }

                  /* Force break before damage section if needed */
                  #print-report .damage-section {
                    page-break-before: auto !important;
                    page-break-inside: avoid !important;
                  }

                  /* ===== FUEL GAUGE PRINT ===== */
                  #print-report .fuel-gauge {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }

                  /* ===== HEADER STATIC POSITIONING ===== */
                  #print-report .report-header {
                    position: static !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: flex-start !important;
                    margin-bottom: 12px !important;
                    padding-bottom: 8px !important;
                    border-bottom: 2px solid #334155 !important;
                  }

                  /* ===== IMAGES ===== */
                  #print-report img {
                    max-width: 100% !important;
                    page-break-inside: avoid !important;
                  }

                  #print-report img.company-logo {
                    max-height: 50px !important;
                    width: auto !important;
                  }

                  /* ===== FOOTER ===== */
                  #print-report .report-footer {
                    margin-top: 16px !important;
                    padding-top: 8px !important;
                    border-top: 1px solid #e2e8f0 !important;
                    text-align: center !important;
                    font-size: 8pt !important;
                    color: #94a3b8 !important;
                  }

                  /* ===== HIDE PHOTO GALLERY FOR PRINT ===== */
                  #print-report .no-print,
                  #print-report .photo-gallery {
                    display: none !important;
                  }
                }
              `}</style>

              <div id="print-report" className="print-root">
                {companyProfile && (
                  <div className="report-header flex items-start justify-between pb-4 border-b-2 border-slate-300 mb-4">
                    <div className="flex items-center gap-4">
                      {companyProfile.logo_url && (
                        <img src={companyProfile.logo_url} alt={companyProfile.title} className="company-logo h-14 w-14 object-contain" />
                      )}
                      <div>
                        <h1 className="text-lg font-bold text-slate-900">{companyProfile.legal_name || companyProfile.title}</h1>
                        {companyProfile.address && (
                          <p className="text-xs text-slate-600 max-w-sm">{companyProfile.address}</p>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-slate-500">
                          {companyProfile.tax_office && <span>V.D.: {companyProfile.tax_office}</span>}
                          {companyProfile.tax_no && <span>VKN: {companyProfile.tax_no}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {companyProfile.phone && <p>Tel: {companyProfile.phone}</p>}
                      {companyProfile.email && <p>{companyProfile.email}</p>}
                      <p className="mt-2 font-medium text-slate-700">Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
                    ARAC TESLIM / IADE TUTANAGI
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Ekspertiz Raporu</p>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      ARAC BILGILERI
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Plaka:</span>
                        <span className="font-bold text-slate-900">{vehicle?.plate || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Marka/Model:</span>
                        <span className="font-medium text-slate-900">{vehicle?.brand} {vehicle?.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Yil:</span>
                        <span className="font-medium text-slate-900">{vehicle?.year || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Renk:</span>
                        <span className="font-medium text-slate-900">{vehicle?.color || '-'}</span>
                      </div>
                      {vehicle?.chassis_number && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sasi No:</span>
                          <span className="font-medium text-slate-900 text-xs">{vehicle.chassis_number}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-200">
                      MUSTERI BILGILERI
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ad Soyad / Unvan:</span>
                        <span className="font-bold text-slate-900">{customer?.company_title || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Yetkili:</span>
                        <span className="font-medium text-slate-900">{customer?.contact_name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Telefon:</span>
                        <span className="font-medium text-slate-900">{customer?.phone || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">TC/VKN:</span>
                        <span className="font-medium text-slate-900">{customer?.tax_number || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-200">
                    KIRALAMA BILGILERI
                  </h3>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block">Kiralama Modeli:</span>
                      <span className="font-medium text-slate-900">{getRentalModelLabel(rental.rental_model)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Baslangic Tarihi:</span>
                      <span className="font-medium text-slate-900">
                        {rental.start_datetime
                          ? new Date(rental.start_datetime).toLocaleString('tr-TR')
                          : formatDate(rental.start_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Bitis Tarihi:</span>
                      <span className="font-medium text-slate-900">
                        {rental.end_datetime
                          ? new Date(rental.end_datetime).toLocaleString('tr-TR')
                          : formatDate(rental.end_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">KM Limiti:</span>
                      <span className="font-medium text-slate-900">{getKmLimitText()}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="condition-section bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                    <h3 className="text-sm font-bold text-blue-900 mb-3 pb-2 border-b border-blue-200 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">A</span>
                      CIKIS (Teslim Edildi)
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700">Tarih/Saat:</span>
                        <span className="font-medium text-blue-900">
                          {rental.start_datetime
                            ? new Date(rental.start_datetime).toLocaleString('tr-TR')
                            : formatDate(rental.start_date)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700">Cikis KM:</span>
                        <span className="font-bold text-blue-900 text-lg">{rental.starting_km || '________'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700">Yakit Durumu:</span>
                        <div className="flex items-center gap-2">
                          <div className="fuel-gauge w-24 h-4 bg-blue-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${(rental as any).start_fuel_percentage || FUEL_LEVELS[rental.fuel_status || ''] || 0}%` }}
                            />
                          </div>
                          <span className="font-medium text-blue-900">
                            {(rental as any).start_fuel_percentage ? `${(rental as any).start_fuel_percentage}%` : rental.fuel_status || '____'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-blue-700">Temizlik:</span>
                        <span className="font-medium text-blue-900">
                          {rental.start_cleanliness_status === 'clean' ? 'Temiz' :
                           rental.start_cleanliness_status === 'normal' ? 'Normal' :
                           rental.start_cleanliness_status === 'dirty' ? 'Kirli' : '________'}
                        </span>
                      </div>
                      {rental.initial_damage_notes && (
                        <div className="pt-2 border-t border-blue-200">
                          <span className="text-blue-700 block mb-1 text-xs">Mevcut Hasar/Notlar:</span>
                          <p className="text-blue-900 bg-blue-100 p-2 rounded text-xs">{rental.initial_damage_notes}</p>
                        </div>
                      )}
                      {!rental.initial_damage_notes && (
                        <div className="pt-2 border-t border-blue-200">
                          <span className="text-blue-700 block mb-1 text-xs">Mevcut Hasar/Notlar:</span>
                          <div className="h-12 border border-blue-300 rounded bg-white"></div>
                        </div>
                      )}
                      {(rental as any).start_photos && (rental as any).start_photos.length > 0 && (
                        <div className="pt-2 border-t border-blue-200">
                          <span className="text-blue-700 block mb-1 text-xs">Yuklenen Fotograflar: {(rental as any).start_photos.length} adet</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`condition-section rounded-lg p-4 border-2 ${isReturned ? 'bg-green-50 border-green-300' : 'bg-slate-100 border-slate-300'}`}>
                    <h3 className={`text-sm font-bold mb-3 pb-2 border-b flex items-center gap-2 ${isReturned ? 'text-green-900 border-green-200' : 'text-slate-700 border-slate-200'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isReturned ? 'bg-green-600 text-white' : 'bg-slate-400 text-white'}`}>B</span>
                      DONUS (Teslim Alindi)
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className={isReturned ? 'text-green-700' : 'text-slate-500'}>Tarih/Saat:</span>
                        <span className={`font-medium ${isReturned ? 'text-green-900' : 'text-slate-600'}`}>
                          {rental.actual_return_date
                            ? new Date(rental.actual_return_date).toLocaleDateString('tr-TR')
                            : rental.return_datetime
                              ? new Date(rental.return_datetime).toLocaleString('tr-TR')
                              : '__ / __ / ____  __:__'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={isReturned ? 'text-green-700' : 'text-slate-500'}>Donus KM:</span>
                        <span className={`font-bold text-lg ${isReturned ? 'text-green-900' : 'text-slate-600'}`}>
                          {rental.end_km || rental.return_km || '________'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={isReturned ? 'text-green-700' : 'text-slate-500'}>Yakit Durumu:</span>
                        <div className="flex items-center gap-2">
                          {isReturned && rental.return_fuel_level ? (
                            <>
                              <div className="fuel-gauge w-24 h-4 bg-green-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-600 rounded-full"
                                  style={{ width: `${FUEL_LEVELS[rental.return_fuel_level] || 0}%` }}
                                />
                              </div>
                              <span className="font-medium text-green-900">{rental.return_fuel_level}</span>
                            </>
                          ) : (
                            <span className="text-slate-500">____</span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={isReturned ? 'text-green-700' : 'text-slate-500'}>Temizlik:</span>
                        <span className={`font-medium ${isReturned ? 'text-green-900' : 'text-slate-600'}`}>
                          {rental.return_cleanliness_status === 'clean' ? 'Temiz' :
                           rental.return_cleanliness_status === 'normal' ? 'Normal' :
                           rental.return_cleanliness_status === 'dirty' ? 'Kirli' : '________'}
                        </span>
                      </div>
                      <div className={`pt-2 border-t ${isReturned ? 'border-green-200' : 'border-slate-200'}`}>
                        <span className={`block mb-1 text-xs ${isReturned ? 'text-green-700' : 'text-slate-500'}`}>Donus Hasar/Notlar:</span>
                        {rental.return_notes || rental.return_damage_notes ? (
                          <p className={`p-2 rounded text-xs ${isReturned ? 'text-green-900 bg-green-100' : 'text-slate-600 bg-slate-200'}`}>
                            {rental.return_notes || rental.return_damage_notes}
                          </p>
                        ) : (
                          <div className="h-12 border border-slate-300 rounded bg-white"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {(rental as any).start_photos && (rental as any).start_photos.length > 0 && (
                  <div className="photo-gallery bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6 no-print">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      TESLIM FOTOGRAFLARI ({(rental as any).start_photos.length} adet)
                    </h3>
                    <div className="grid grid-cols-6 gap-2">
                      {((rental as any).start_photos as string[]).map((photo: string, idx: number) => (
                        <div key={idx} className="aspect-square">
                          <img
                            src={photo}
                            alt={`Fotograf ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg border border-slate-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isReturned && kmAnalysis && (
                  <div className={`rounded-lg p-4 border mb-6 ${kmAnalysis.overLimit > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">
                      KM ANALIZI
                    </h3>
                    <div className="grid grid-cols-5 gap-3 text-center">
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Cikis KM</p>
                        <p className="text-lg font-bold text-slate-900">{kmAnalysis.startKm}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Donus KM</p>
                        <p className="text-lg font-bold text-slate-900">{kmAnalysis.endKm}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Kullanilan</p>
                        <p className="text-lg font-bold text-teal-600">{kmAnalysis.drivenKm} km</p>
                      </div>
                      {kmAnalysis.allowedKm > 0 && (
                        <>
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">Izin Verilen</p>
                            <p className="text-lg font-bold text-slate-900">{kmAnalysis.allowedKm} km</p>
                          </div>
                          <div className={`rounded-lg p-3 border ${kmAnalysis.overLimit > 0 ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'}`}>
                            <p className="text-xs text-slate-500 mb-1">Durum</p>
                            {kmAnalysis.overLimit > 0 ? (
                              <p className="text-lg font-bold text-red-600">+{kmAnalysis.overLimit} ASIM</p>
                            ) : (
                              <p className="text-lg font-bold text-green-600">OK</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {isReturned && (rental.extra_km_fee || rental.fuel_fee || rental.cleaning_fee || rental.damage_fee || rental.other_fee || rental.total_extra_charges) && (
                  <div className="fees-section bg-amber-50 rounded-lg p-4 border border-amber-200 mb-6">
                    <h3 className="text-sm font-bold text-amber-900 mb-3 pb-2 border-b border-amber-200">
                      EK UCRETLER
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {rental.extra_km_fee && rental.extra_km_fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">KM Asim Ucreti:</span>
                          <span className="font-bold text-amber-900">{formatCurrency(rental.extra_km_fee)} TL</span>
                        </div>
                      )}
                      {rental.fuel_fee && rental.fuel_fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Yakit Farki:</span>
                          <span className="font-bold text-amber-900">{formatCurrency(rental.fuel_fee)} TL</span>
                        </div>
                      )}
                      {rental.cleaning_fee && rental.cleaning_fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Yikama Ucreti:</span>
                          <span className="font-bold text-amber-900">{formatCurrency(rental.cleaning_fee)} TL</span>
                        </div>
                      )}
                      {rental.damage_fee && rental.damage_fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Hasar Bedeli:</span>
                          <span className="font-bold text-red-600">{formatCurrency(rental.damage_fee)} TL</span>
                        </div>
                      )}
                      {rental.other_fee && rental.other_fee > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Diger:</span>
                          <span className="font-bold text-amber-900">{formatCurrency(rental.other_fee)} TL</span>
                        </div>
                      )}
                    </div>
                    {rental.total_extra_charges && rental.total_extra_charges > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between">
                        <span className="font-semibold text-amber-900">TOPLAM EK UCRET:</span>
                        <span className="text-xl font-bold text-amber-900">{formatCurrency(rental.total_extra_charges)} TL</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="damage-section border-2 border-slate-300 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                    <span className="w-6 h-6 bg-slate-700 text-white rounded-full flex items-center justify-center text-xs font-bold">C</span>
                    ARAC HASAR DURUMU (Ekspertiz)
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="border border-slate-200 rounded-lg p-4 bg-white">
                      <p className="text-xs text-slate-500 mb-2 text-center">On Gorunum</p>
                      <div className="h-32 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
                        <div className="text-center text-slate-400">
                          <Car className="h-12 w-12 mx-auto mb-1 opacity-50" />
                          <p className="text-xs">Hasar isaretleme alani</p>
                        </div>
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-4 bg-white">
                      <p className="text-xs text-slate-500 mb-2 text-center">Arka Gorunum</p>
                      <div className="h-32 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
                        <div className="text-center text-slate-400">
                          <Car className="h-12 w-12 mx-auto mb-1 opacity-50 rotate-180" />
                          <p className="text-xs">Hasar isaretleme alani</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2">Hasar Aciklamasi:</p>
                    <div className="h-16 border border-slate-300 rounded bg-white p-2">
                      {rental.return_damage_notes || rental.initial_damage_notes ? (
                        <p className="text-xs text-slate-700">{rental.return_damage_notes || rental.initial_damage_notes}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="signature-section grid grid-cols-2 gap-8 mt-8 pt-4 border-t-2 border-slate-300">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700 mb-1">TESLIM EDEN</p>
                    <p className="text-xs text-slate-500 mb-8">(Kiraya Veren / Personel)</p>
                    <div className="border-b-2 border-slate-400 mb-2"></div>
                    <p className="text-xs text-slate-500">Ad Soyad / Imza / Tarih</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700 mb-1">TESLIM ALAN</p>
                    <p className="text-xs text-slate-500 mb-8">(Kiralayan / Musteri)</p>
                    <div className="border-b-2 border-slate-400 mb-2"></div>
                    <p className="text-xs text-slate-500">Ad Soyad / Imza / Tarih</p>
                  </div>
                </div>

                <div className="report-footer mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
                  <p>Bu belge {companyProfile?.legal_name || 'Sirket'} tarafindan olusturulmustur.</p>
                  <p>Olusturma Tarihi: {new Date().toLocaleString('tr-TR')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
