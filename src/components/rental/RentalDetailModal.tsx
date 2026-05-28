import { useState, useEffect } from 'react';
import { Car, Calendar, MapPin, Fuel, FileText, CreditCard, Shield, CheckCircle, Briefcase, Printer } from 'lucide-react';
import type { Rental, Vehicle, Customer } from '../../types/database';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ProvisionManager from '../finance/ProvisionManager';
import KabisCompliancePanel from './KabisCompliancePanel';
import DeliveryReport from './DeliveryReport';
import { formatCurrency, formatDate } from '../../utils/format';
import { getServiceLabel } from '../../utils/paymentSchedule';

interface RentalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  rental: Rental | null;
  vehicle: Vehicle | null;
  customer: Customer | null;
  companyId: string;
  userEmail?: string | null;
  onUpdate?: () => void;
}

type TabType = 'details' | 'provisions' | 'kabis';

export default function RentalDetailModal({
  isOpen,
  onClose,
  rental,
  vehicle,
  customer,
  companyId,
  userEmail,
  onUpdate,
}: RentalDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [showDeliveryReport, setShowDeliveryReport] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
    }
  }, [isOpen]);

  if (!rental || !vehicle || !customer) return null;

  const getFuelLabel = (status: string | null) => {
    switch (status) {
      case 'full': return 'Dolu';
      case '3/4': return '3/4';
      case '1/2': return '1/2';
      case '1/4': return '1/4';
      case 'empty': return 'Bos';
      default: return '-';
    }
  };

  const getPaymentMethodLabel = (method: string | undefined) => {
    switch (method) {
      case 'transfer': return 'Havale/EFT';
      case 'credit_card': return 'Kredi Karti';
      case 'cash': return 'Nakit';
      case 'check': return 'Cek';
      case 'promissory_note': return 'Senet';
      default: return '-';
    }
  };

  const tabs = [
    { key: 'details' as const, label: 'Detaylar', icon: FileText },
    { key: 'provisions' as const, label: 'Depozito', icon: CreditCard },
    { key: 'kabis' as const, label: 'KABIS', icon: Shield },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kiralama Detayi"
      size="xl"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200">
          <div className="flex-shrink-0">
            {vehicle.photo_url ? (
              <img
                src={vehicle.photo_url}
                alt={vehicle.plate}
                className="w-20 h-16 object-cover rounded-lg"
              />
            ) : (
              <div className="w-20 h-16 bg-teal-100 rounded-lg flex items-center justify-center">
                <Car className="h-8 w-8 text-teal-600" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-slate-900">{vehicle.plate}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                rental.status === 'active' ? 'bg-blue-100 text-blue-700' :
                rental.status === 'completed' ? 'bg-green-100 text-green-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {rental.status === 'active' ? 'Aktif' :
                 rental.status === 'completed' ? 'Tamamlandi' : 'Iptal'}
              </span>
              {rental.rental_type === 'operational_leasing' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-lg">
                  <Briefcase className="h-3 w-3" />
                  OPERASYONEL KİRALAMA
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Musteri</p>
            <p className="font-medium text-slate-900">{customer.company_title}</p>
          </div>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Baslangic</span>
                </div>
                <p className="font-medium text-slate-900">{formatDate(rental.start_date)}</p>
                {rental.start_datetime && (
                  <p className="text-xs text-slate-500">{rental.start_datetime.slice(11, 16)}</p>
                )}
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Bitis</span>
                </div>
                <p className="font-medium text-slate-900">{formatDate(rental.end_date)}</p>
                {rental.end_datetime && (
                  <p className="text-xs text-slate-500">{rental.end_datetime.slice(11, 16)}</p>
                )}
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs">Baslangic KM</span>
                </div>
                <p className="font-medium text-slate-900">
                  {rental.starting_km?.toLocaleString('tr-TR') || '-'} km
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Fuel className="h-4 w-4" />
                  <span className="text-xs">Yakit Durumu</span>
                </div>
                <p className="font-medium text-slate-900">{getFuelLabel(rental.fuel_status)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <h4 className="text-sm font-medium text-emerald-700 mb-3">Finansal Bilgiler</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">
                      {rental.rental_type === 'operational_leasing' ? 'Aylik Kira' : 'Gunluk Ucret'}
                    </span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(rental.daily_rate)} TL
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Toplam Tutar</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(rental.total_amount)} TL
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Depozito</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(rental.deposit_amount)} TL
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-emerald-200">
                    <span className="text-slate-600">Odeme Yontemi</span>
                    <span className="font-medium text-slate-900">
                      {getPaymentMethodLabel(rental.agreed_payment_method)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="text-sm font-medium text-blue-700 mb-3">Sozlesme Detaylari</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Kiralama Tipi</span>
                    <span className="font-medium text-slate-900">
                      {rental.rental_type === 'operational_leasing' ? 'Operasyonel Leasing' : 'Kisa Donem'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Faturalama</span>
                    <span className="font-medium text-slate-900">
                      {rental.billing_type === 'monthly' ? 'Aylik' : 'Pesin'}
                    </span>
                  </div>
                  {rental.daily_km_limit && rental.daily_km_limit > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Gunluk KM Limiti</span>
                      <span className="font-medium text-slate-900">
                        {rental.daily_km_limit?.toLocaleString('tr-TR')} km
                      </span>
                    </div>
                  )}
                  {rental.per_km_overage_fee && rental.per_km_overage_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">KM Asim Ucreti</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(rental.per_km_overage_fee)} TL/km
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {vehicle.ownership_type === 'kiralik' && vehicle.supplier_cost_price && vehicle.supplier_cost_price > 0 && (
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                <h4 className="text-sm font-semibold text-orange-900 mb-3">Alt Kiralama Karlilik Analizi</h4>
                {(() => {
                  const revenue = rental.total_amount || 0;
                  const costPrice = vehicle.supplier_cost_price || 0;
                  const costPeriod = vehicle.supplier_cost_period || 'monthly';
                  const startDate = new Date(rental.start_date);
                  const endDate = new Date(rental.end_date);
                  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                  const totalCost = costPeriod === 'daily' ? costPrice * days : costPrice * (days / 30);
                  const netProfit = revenue - totalCost;
                  const margin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Musteri Geliri</span>
                        <span className="font-medium text-green-700">{formatCurrency(revenue)} TL</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Tedarikci Gideri ({days} gun)</span>
                        <span className="font-medium text-red-600">-{formatCurrency(totalCost)} TL</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-orange-200">
                        <span className="text-slate-700 font-semibold">Net Kar</span>
                        <span className={`font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatCurrency(netProfit)} TL
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Brut Kar Marji</span>
                        <span className={`font-semibold ${margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          %{margin.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {rental.rental_type === 'operational_leasing' && rental.services_included && Array.isArray(rental.services_included) && rental.services_included.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <h4 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Dahil Edilen Hizmetler
                </h4>
                <p className="text-xs text-purple-600 mb-3">
                  Bu araç için aşağıdaki hizmetler ücretsiz olarak dahildir:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(rental.services_included as string[]).map((serviceKey) => (
                    <div key={serviceKey} className="flex items-center gap-2 text-sm bg-white/60 px-3 py-2 rounded-lg">
                      <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                      <span className="font-medium text-slate-900">{getServiceLabel(serviceKey)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rental.rental_type === 'operational_leasing' && rental.contract_months && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <h4 className="text-sm font-medium text-amber-800 mb-2">Sözleşme Bilgileri</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Sözleşme Süresi:</span>
                    <span className="font-semibold text-slate-900 ml-2">{rental.contract_months} Ay</span>
                  </div>
                  {rental.payment_timing && (
                    <div>
                      <span className="text-slate-600">Ödeme Zamanı:</span>
                      <span className="font-semibold text-slate-900 ml-2">
                        {rental.payment_timing === 'beginning_of_period' ? 'Dönem Başı' : 'Dönem Sonu'}
                      </span>
                    </div>
                  )}
                  {rental.early_termination_fee && rental.early_termination_fee > 0 && (
                    <div className="col-span-2">
                      <span className="text-slate-600">Erken Fesih Ücreti:</span>
                      <span className="font-semibold text-red-600 ml-2">
                        {formatCurrency(rental.early_termination_fee)} TL
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {rental.notes && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Notlar</h4>
                <p className="text-sm text-slate-600">{rental.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'provisions' && (
          <ProvisionManager
            rental={rental}
            customer={customer}
            companyId={companyId}
            userEmail={userEmail}
            onUpdate={onUpdate}
          />
        )}

        {activeTab === 'kabis' && (
          <KabisCompliancePanel
            rental={rental}
            vehicle={vehicle}
            customer={customer}
            companyId={companyId}
            userEmail={userEmail}
            onUpdate={onUpdate}
          />
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <Button
            variant="primary"
            onClick={() => setShowDeliveryReport(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Printer className="h-4 w-4 mr-2" />
            Teslim Tutanağı Yazdır
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>

      <DeliveryReport
        isOpen={showDeliveryReport}
        onClose={() => setShowDeliveryReport(false)}
        rental={rental}
        vehicle={vehicle}
        customer={customer}
        companyId={companyId}
      />
    </Modal>
  );
}
