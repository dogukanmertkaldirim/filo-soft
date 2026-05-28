import { useState, useEffect } from 'react';
import { Search, Phone, Mail, MapPin, AlertTriangle, Truck, Wrench, Shield, Clock, Star, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from './ui/Modal';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}

interface Contact {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface PartnerMatch {
  id: string;
  name: string;
  city: string | null;
  service_type: string | null;
  phone: string | null;
  email: string | null;
  discount_spare_parts: number | null;
  discount_labor: number | null;
  payment_maturity: string | null;
  contacts: Contact[];
  priority: number;
}

const turkishCities = [
  'Adana', 'Adiyaman', 'Afyon', 'Agri', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
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

const serviceTypeLabels: Record<string, string> = {
  yetkili_servis: 'Yetkili Servis',
  ozel_servis: 'Ozel Servis',
  lastikci: 'Lastikci',
  cekici: 'Cekici',
  yol_yardim: 'Yol Yardim',
  transfer: 'Transfer',
  logistics: 'Lojistik',
  car_rental: 'Arac Kiralama',
  maintenance: 'Bakim & Servis',
  cleaning: 'Temizlik',
  other: 'Diger',
};

const paymentLabels: Record<string, string> = {
  pesin: 'Pesin',
  '15_gun': '15 Gun',
  '30_gun': '30 Gun',
  '45_gun': '45 Gun',
  '60_gun': '60 Gun',
  '90_gun': '90 Gun',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmergencyAssistanceModal({ isOpen, onClose }: Props) {
  const { effectiveCompanyId: companyId } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchPlate, setSearchPlate] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [partners, setPartners] = useState<PartnerMatch[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  useEffect(() => {
    if (isOpen && companyId) {
      loadVehicles();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    if (selectedVehicle && selectedCity) {
      findPartners();
    } else {
      setPartners([]);
    }
  }, [selectedVehicle, selectedCity]);

  async function loadVehicles() {
    if (!companyId) return;
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('plate');
    setVehicles(data || []);
  }

  async function findPartners() {
    if (!companyId || !selectedCity || !selectedVehicle) return;
    setLoadingPartners(true);

    const { data: suppliersData } = await supabase
      .from('suppliers')
      .select('id, name, city, service_type, phone, email, discount_spare_parts, discount_labor, payment_maturity')
      .eq('company_id', companyId)
      .eq('city', selectedCity)
      .is('deleted_at', null);

    if (!suppliersData || suppliersData.length === 0) {
      setPartners([]);
      setLoadingPartners(false);
      return;
    }

    const supplierIds = suppliersData.map(s => s.id);
    const { data: contactsData } = await supabase
      .from('supplier_contacts')
      .select('id, supplier_id, full_name, phone, email, notes')
      .in('supplier_id', supplierIds);

    const contactsBySupplier: Record<string, Contact[]> = {};
    (contactsData || []).forEach(c => {
      if (!contactsBySupplier[c.supplier_id]) contactsBySupplier[c.supplier_id] = [];
      contactsBySupplier[c.supplier_id].push(c);
    });

    const matched: PartnerMatch[] = suppliersData.map(s => {
      let priority = 99;
      if (s.service_type === 'yetkili_servis') priority = 1;
      else if (s.service_type === 'yol_yardim') priority = 2;
      else if (s.service_type === 'cekici') priority = 3;
      else if (s.service_type === 'lastikci') priority = 4;
      else if (s.service_type === 'ozel_servis') priority = 5;
      else if (s.service_type === 'maintenance') priority = 6;
      else priority = 10;

      return {
        ...s,
        contacts: contactsBySupplier[s.id] || [],
        priority,
      };
    });

    matched.sort((a, b) => a.priority - b.priority);
    setPartners(matched);
    setLoadingPartners(false);
  }

  function selectVehicle(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setSearchPlate(vehicle.plate);
    setShowVehicleDropdown(false);
  }

  function reset() {
    setSelectedVehicle(null);
    setSearchPlate('');
    setSelectedCity('');
    setPartners([]);
  }

  const filteredVehicles = vehicles.filter(v =>
    v.plate.toLowerCase().includes(searchPlate.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchPlate.toLowerCase())
  );

  function getPriorityBadge(priority: number) {
    if (priority === 1) return { label: 'Yetkili Servis', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (priority === 2) return { label: 'Yol Yardim', color: 'bg-red-100 text-red-800 border-red-200' };
    if (priority === 3) return { label: 'Cekici', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (priority === 4) return { label: 'Lastikci', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (priority === 5) return { label: 'Ozel Servis', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: 'Servis', color: 'bg-slate-100 text-slate-700 border-slate-200' };
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Acil Yol Yardim - Akilli Eslestirme" size="xl">
      <div className="space-y-5">
        {/* Emergency Header */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-900">Acil Durum Eslestirme Sistemi</h3>
              <p className="text-xs text-red-700 mt-0.5">
                Arizali araci secin, konum belirleyin - en uygun partneri aninda bulun.
              </p>
            </div>
          </div>
        </div>

        {/* Vehicle Selection & City */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vehicle Plate Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Arizali Arac Plakasi</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => {
                  setSearchPlate(e.target.value);
                  setShowVehicleDropdown(true);
                  if (!e.target.value) setSelectedVehicle(null);
                }}
                onFocus={() => setShowVehicleDropdown(true)}
                placeholder="Plaka veya marka ile ara..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            {showVehicleDropdown && searchPlate && filteredVehicles.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredVehicles.slice(0, 10).map(v => (
                  <button
                    key={v.id}
                    onClick={() => selectVehicle(v)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-900">{v.plate}</span>
                    <span className="text-xs text-slate-500 ml-2">{v.brand} {v.model}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedVehicle && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Shield className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-800">
                  {selectedVehicle.plate} - {selectedVehicle.brand} {selectedVehicle.model}
                </span>
              </div>
            )}
          </div>

          {/* City Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ariza Konumu (Sehir)</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Sehir seciniz...</option>
              {turkishCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            {selectedCity && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">Konum: {selectedCity}</span>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {selectedVehicle && selectedCity && (
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Eslesen Partnerler ({partners.length})
              </h4>
              {partners.length > 0 && (
                <span className="text-xs text-slate-500">Oncelik sirasina gore</span>
              )}
            </div>

            {loadingPartners ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                <span className="ml-2 text-sm text-slate-500">Partnerler araniyor...</span>
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                <Truck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Bu sehirde eslesen partner bulunamadi.</p>
                <p className="text-xs text-slate-400 mt-1">Farkli bir sehir deneyin veya yeni partner ekleyin.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {partners.map((partner) => {
                  const badge = getPriorityBadge(partner.priority);
                  return (
                    <div
                      key={partner.id}
                      className="border border-slate-200 rounded-xl p-4 hover:border-teal-300 hover:shadow-sm transition-all bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="text-sm font-bold text-slate-900">{partner.name}</h5>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                          {/* Discount & Payment Summary */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {(partner.discount_spare_parts || partner.discount_labor) ? (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                                YP: %{partner.discount_spare_parts || 0} | IS: %{partner.discount_labor || 0}
                              </span>
                            ) : null}
                            {partner.payment_maturity && (
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {paymentLabels[partner.payment_maturity] || partner.payment_maturity}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Direct call button for main phone */}
                        {partner.phone && (
                          <a
                            href={`tel:${partner.phone}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0 shadow-sm"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Ara
                          </a>
                        )}
                      </div>

                      {/* Contact Persons */}
                      {partner.contacts.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Temsilciler</p>
                          <div className="flex flex-wrap gap-2">
                            {partner.contacts.map(contact => (
                              <div key={contact.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                                <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-bold text-teal-700">
                                    {contact.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">{contact.full_name}</p>
                                  {contact.notes && <p className="text-[10px] text-slate-400">{contact.notes}</p>}
                                </div>
                                {contact.phone && (
                                  <a
                                    href={`tel:${contact.phone}`}
                                    className="ml-1 p-1.5 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors"
                                    title={contact.phone}
                                  >
                                    <Phone className="h-3 w-3 text-emerald-700" />
                                  </a>
                                )}
                                {contact.email && (
                                  <a
                                    href={`mailto:${contact.email}`}
                                    className="p-1.5 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors"
                                    title={contact.email}
                                  >
                                    <Mail className="h-3 w-3 text-blue-700" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If no contacts but has phone/email */}
                      {partner.contacts.length === 0 && (partner.phone || partner.email) && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
                          {partner.phone && (
                            <a href={`tel:${partner.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-teal-600">
                              <Phone className="h-3.5 w-3.5" />
                              {partner.phone}
                            </a>
                          )}
                          {partner.email && (
                            <a href={`mailto:${partner.email}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-teal-600">
                              <Mail className="h-3.5 w-3.5" />
                              {partner.email}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reset button */}
        {selectedVehicle && (
          <div className="flex justify-end pt-2">
            <button
              onClick={reset}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Sifirla ve yeni arama yap
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
