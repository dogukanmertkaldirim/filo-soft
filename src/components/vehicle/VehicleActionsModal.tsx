import { Key, FileText, ScrollText, History, Banknote, Car, Handshake, CornerDownLeft, FileSearch, Printer, ShieldAlert, RefreshCw, UserCheck, CreditCard as Edit2, Trash2, Shield, Gauge } from 'lucide-react';
import type { Vehicle, Rental, Customer, CompanyProfile, AppUser } from '../../types/database';
import Modal from '../ui/Modal';

interface ActionCardProps {
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  badgeColor?: string;
}

function ActionCard({
  icon,
  iconColor,
  bgColor,
  borderColor,
  title,
  description,
  onClick,
  disabled,
  badge,
  badgeColor,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
          : `${borderColor} ${bgColor} hover:ring-2 hover:ring-opacity-50`
      }`}
      style={{ minHeight: '140px' }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`${iconColor}`}>{icon}</div>
        {badge && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-slate-900 text-sm mt-3">{title}</h3>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
    </button>
  );
}

interface VehicleActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  rental?: Rental;
  customers: Customer[];
  companyProfiles: CompanyProfile[];
  customerUsers: AppUser[];
  onRent: (v: Vehicle) => void;
  onPrepareProposal: (v: Vehicle) => void;
  onPrintContract: (rentalId: string) => void;
  onEditRental: (rental: Rental) => void;
  onReturnVehicle: (v: Vehicle) => void;
  onRentalHistory: (v: Vehicle) => void;
  onFinanceHistory: (v: Vehicle) => void;
  onAssignCustomer: (v: Vehicle) => void;
  onEdit: (v: Vehicle) => void;
  onDelete: (v: Vehicle) => void;
  onToggleKabis: (rental: Rental) => void;
  onViewRentalDetail: (v: Vehicle) => void;
  onSell: (v: Vehicle) => void;
  onUpdateKm: (v: Vehicle) => void;
  hasLinkedCustomer: boolean;
  hasCustomerUsers: boolean;
}

export default function VehicleActionsModal({
  isOpen,
  onClose,
  vehicle,
  rental,
  onRent,
  onPrepareProposal,
  onPrintContract,
  onEditRental,
  onReturnVehicle,
  onRentalHistory,
  onFinanceHistory,
  onAssignCustomer,
  onEdit,
  onDelete,
  onToggleKabis,
  onViewRentalDetail,
  onSell,
  onUpdateKm,
  hasLinkedCustomer,
  hasCustomerUsers,
}: VehicleActionsModalProps) {
  const isIdle = vehicle.status === 'idle';
  const isRented = vehicle.status === 'rented';
  const isMaintenance = vehicle.status === 'maintenance';
  const isSold = vehicle.status === 'sold';

  function act(action: () => void) {
    onClose();
    action();
  }

  function showComingSoon(feature: string) {
    alert(`${feature} - Bu ozellik yakinda aktif olacak.`);
  }

  const statusLabel = isIdle
    ? 'Bos'
    : isRented
    ? 'Kirada'
    : isMaintenance
    ? 'Serviste'
    : isSold
    ? 'Satildi'
    : 'Bilinmiyor';

  const statusColor = isIdle
    ? 'bg-green-100 text-green-700'
    : isRented
    ? 'bg-blue-100 text-blue-700'
    : isMaintenance
    ? 'bg-amber-100 text-amber-700'
    : isSold
    ? 'bg-slate-100 text-slate-700'
    : 'bg-slate-100 text-slate-600';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Arac Islemleri: ${vehicle.plate}`}
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
          <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
            {vehicle.photo_url ? (
              <img
                src={vehicle.photo_url}
                alt={vehicle.plate}
                className="w-full h-full object-cover"
              />
            ) : (
              <Car className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{vehicle.plate}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {vehicle.brand} {vehicle.model} ({vehicle.year})
            </p>
            {vehicle.color && (
              <p className="text-xs text-slate-400 mt-0.5">{vehicle.color}</p>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
            vehicle.ownership_type === 'kiralik' ? 'bg-orange-100 text-orange-700' : 'bg-sky-100 text-sky-700'
          }`}>
            {vehicle.ownership_type === 'kiralik' ? 'Kiralik' : 'Oz Mal'}
          </span>
        </div>

        {vehicle.ownership_type === 'kiralik' && (
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-orange-800">Alt Kiralama Bilgileri</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {vehicle.supplier_cost_price && (
                <div>
                  <span className="text-slate-500">Maliyet:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {vehicle.supplier_cost_price.toLocaleString('tr-TR')} TL/{vehicle.supplier_cost_period === 'daily' ? 'gun' : 'ay'}
                  </span>
                </div>
              )}
              {vehicle.supplier_end_date && (
                <div>
                  <span className="text-slate-500">Sozlesme Bitis:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {new Date(vehicle.supplier_end_date).toLocaleDateString('tr-TR')}
                  </span>
                </div>
              )}
            </div>
            {vehicle.supplier_contract_url && (
              <a
                href={vehicle.supplier_contract_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-white border border-orange-200 rounded-lg text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Tedarik Sozlesmesini Goruntule
              </a>
            )}
          </div>
        )}

        {/* UTTS Info Badge */}
        {(vehicle as any).utts_installed && (
          <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-800">UTTS / Tasitmatik Bilgileri</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {(vehicle as any).utts_installation_no && (
                <div>
                  <span className="text-slate-500">Montaj No:</span>{' '}
                  <span className="font-medium text-slate-900">{(vehicle as any).utts_installation_no}</span>
                </div>
              )}
              {(vehicle as any).utts_installation_code && (
                <div>
                  <span className="text-slate-500">Montaj Kodu:</span>{' '}
                  <span className="font-medium text-slate-900">{(vehicle as any).utts_installation_code}</span>
                </div>
              )}
            </div>
            {(vehicle as any).utts_receipt_url && (
              <a
                href={(vehicle as any).utts_receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Odeme Dekontunu Goruntule
              </a>
            )}
          </div>
        )}

        {isIdle && (
          <>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Kiralama Islemleri</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<Key className="h-7 w-7" />}
                  iconColor="text-teal-600"
                  bgColor="bg-white hover:bg-teal-50"
                  borderColor="border-slate-200 hover:border-teal-400"
                  title="Kiraya Ver"
                  description="Yeni bir kiralama baslat."
                  onClick={() => act(() => onRent(vehicle))}
                />
                <ActionCard
                  icon={<FileText className="h-7 w-7" />}
                  iconColor="text-blue-600"
                  bgColor="bg-white hover:bg-blue-50"
                  borderColor="border-slate-200 hover:border-blue-400"
                  title="Teklif Hazirla"
                  description="Musteriye fiyat teklifi olustur."
                  onClick={() => act(() => onPrepareProposal(vehicle))}
                />
                <ActionCard
                  icon={<ScrollText className="h-7 w-7" />}
                  iconColor="text-purple-600"
                  bgColor="bg-white hover:bg-purple-50"
                  borderColor="border-slate-200 hover:border-purple-400"
                  title="Sozlesme Hazirla"
                  description="Kiralama sozlesmesi taslagi olustur."
                  onClick={() => showComingSoon('Sozlesme Hazirla')}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Gecmis ve Bilgiler</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<History className="h-7 w-7" />}
                  iconColor="text-slate-600"
                  bgColor="bg-white hover:bg-slate-50"
                  borderColor="border-slate-200 hover:border-slate-400"
                  title="Arac Gecmisi"
                  description="Tum kiralama ve servis kayitlari."
                  onClick={() => act(() => onRentalHistory(vehicle))}
                />
                <ActionCard
                  icon={<Banknote className="h-7 w-7" />}
                  iconColor="text-emerald-600"
                  bgColor="bg-white hover:bg-emerald-50"
                  borderColor="border-slate-200 hover:border-emerald-400"
                  title="Finansal Gecmis"
                  description="Gelir, gider ve borc durumu."
                  onClick={() => act(() => onFinanceHistory(vehicle))}
                />
                <ActionCard
                  icon={<Car className="h-7 w-7" />}
                  iconColor="text-indigo-600"
                  bgColor="bg-white hover:bg-indigo-50"
                  borderColor="border-slate-200 hover:border-indigo-400"
                  title="Arac Bilgileri"
                  description="Ruhsat, sigorta ve donanim detaylari."
                  onClick={() => act(() => onEdit(vehicle))}
                />
                <ActionCard
                  icon={<Gauge className="h-7 w-7" />}
                  iconColor="text-cyan-600"
                  bgColor="bg-white hover:bg-cyan-50"
                  borderColor="border-slate-200 hover:border-cyan-400"
                  title="KM Guncelle"
                  description="Guncel kilometre bilgisini gir."
                  onClick={() => act(() => onUpdateKm(vehicle))}
                  badge={vehicle.current_km ? `${vehicle.current_km.toLocaleString('tr-TR')} km` : undefined}
                  badgeColor="bg-cyan-100 text-cyan-700"
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Diger Islemler</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<Handshake className="h-7 w-7" />}
                  iconColor="text-amber-600"
                  bgColor="bg-white hover:bg-amber-50"
                  borderColor="border-slate-200 hover:border-amber-400"
                  title="Araci Sat"
                  description="Aracin satis islemini baslat."
                  onClick={() => act(() => onSell(vehicle))}
                />
                {hasCustomerUsers && (
                  <ActionCard
                    icon={<UserCheck className="h-7 w-7" />}
                    iconColor={hasLinkedCustomer ? 'text-green-600' : 'text-slate-500'}
                    bgColor="bg-white hover:bg-green-50"
                    borderColor="border-slate-200 hover:border-green-400"
                    title="Musteriye Ata"
                    description="Araci bir musteriye bagla."
                    onClick={() => act(() => onAssignCustomer(vehicle))}
                    badge={hasLinkedCustomer ? 'Atandi' : undefined}
                    badgeColor="bg-green-100 text-green-700"
                  />
                )}
                <ActionCard
                  icon={<Trash2 className="h-7 w-7" />}
                  iconColor="text-red-500"
                  bgColor="bg-white hover:bg-red-50"
                  borderColor="border-slate-200 hover:border-red-300"
                  title="Araci Sil"
                  description="Araci sistemden kaldir."
                  onClick={() => act(() => onDelete(vehicle))}
                />
              </div>
            </div>
          </>
        )}

        {isRented && rental && (
          <>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Aktif Kiralama Islemleri</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<CornerDownLeft className="h-7 w-7" />}
                  iconColor="text-teal-600"
                  bgColor="bg-white hover:bg-teal-50"
                  borderColor="border-slate-200 hover:border-teal-400"
                  title="Teslim Al"
                  description="Kiralama surecini sonlandir ve araci teslim al."
                  onClick={() => act(() => onReturnVehicle(vehicle))}
                />
                <ActionCard
                  icon={<FileSearch className="h-7 w-7" />}
                  iconColor="text-blue-600"
                  bgColor="bg-white hover:bg-blue-50"
                  borderColor="border-slate-200 hover:border-blue-400"
                  title="Detaylari Gor"
                  description="Aktif kiralama detaylarini incele."
                  onClick={() => act(() => onViewRentalDetail(vehicle))}
                />
                <ActionCard
                  icon={<RefreshCw className="h-7 w-7" />}
                  iconColor="text-purple-600"
                  bgColor="bg-white hover:bg-purple-50"
                  borderColor="border-slate-200 hover:border-purple-400"
                  title="Kiralama Guncelle"
                  description="Sure uzat veya sartlari degistir."
                  onClick={() => act(() => onEditRental(rental))}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Dokuman Islemleri</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<Printer className="h-7 w-7" />}
                  iconColor="text-slate-600"
                  bgColor="bg-white hover:bg-slate-50"
                  borderColor="border-slate-200 hover:border-slate-400"
                  title="Sozlesme Yazdir"
                  description="Sozlesmenin ciktisini al."
                  onClick={() => act(() => onPrintContract(rental.id))}
                />
                <ActionCard
                  icon={<ShieldAlert className="h-7 w-7" />}
                  iconColor={rental.kabis_notification_status ? 'text-green-600' : 'text-amber-600'}
                  bgColor="bg-white hover:bg-amber-50"
                  borderColor="border-slate-200 hover:border-amber-400"
                  title="KABIS Bildirimi"
                  description="Emniyet KABIS sistemine bildir."
                  onClick={() => act(() => onToggleKabis(rental))}
                  badge={rental.kabis_notification_status ? 'Bildirildi' : 'Bekliyor'}
                  badgeColor={rental.kabis_notification_status ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}
                />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Gecmis ve Bilgiler</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<History className="h-7 w-7" />}
                  iconColor="text-slate-600"
                  bgColor="bg-white hover:bg-slate-50"
                  borderColor="border-slate-200 hover:border-slate-400"
                  title="Arac Gecmisi"
                  description="Tum kiralama ve servis kayitlari."
                  onClick={() => act(() => onRentalHistory(vehicle))}
                />
                <ActionCard
                  icon={<Banknote className="h-7 w-7" />}
                  iconColor="text-emerald-600"
                  bgColor="bg-white hover:bg-emerald-50"
                  borderColor="border-slate-200 hover:border-emerald-400"
                  title="Finansal Gecmis"
                  description="Gelir, gider ve borc durumu."
                  onClick={() => act(() => onFinanceHistory(vehicle))}
                />
                <ActionCard
                  icon={<Car className="h-7 w-7" />}
                  iconColor="text-indigo-600"
                  bgColor="bg-white hover:bg-indigo-50"
                  borderColor="border-slate-200 hover:border-indigo-400"
                  title="Arac Bilgileri"
                  description="Ruhsat, sigorta ve donanim detaylari."
                  onClick={() => act(() => onEdit(vehicle))}
                />
                <ActionCard
                  icon={<Gauge className="h-7 w-7" />}
                  iconColor="text-cyan-600"
                  bgColor="bg-white hover:bg-cyan-50"
                  borderColor="border-slate-200 hover:border-cyan-400"
                  title="KM Guncelle"
                  description="Guncel kilometre bilgisini gir."
                  onClick={() => act(() => onUpdateKm(vehicle))}
                  badge={vehicle.current_km ? `${vehicle.current_km.toLocaleString('tr-TR')} km` : undefined}
                  badgeColor="bg-cyan-100 text-cyan-700"
                />
              </div>
            </div>

            {hasCustomerUsers && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Musteri Atama</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <ActionCard
                    icon={<UserCheck className="h-7 w-7" />}
                    iconColor={hasLinkedCustomer ? 'text-green-600' : 'text-slate-500'}
                    bgColor="bg-white hover:bg-green-50"
                    borderColor="border-slate-200 hover:border-green-400"
                    title="Musteriye Ata"
                    description="Araci baska bir ilgiliye ata."
                    onClick={() => act(() => onAssignCustomer(vehicle))}
                    badge={hasLinkedCustomer ? 'Atandi' : undefined}
                    badgeColor="bg-green-100 text-green-700"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {isMaintenance && (
          <>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800 font-medium">Bu arac su anda serviste.</p>
              <p className="text-xs text-amber-600 mt-1">Servis tamamlaninca araci aktife alabilirsiniz.</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Gecmis ve Bilgiler</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<History className="h-7 w-7" />}
                  iconColor="text-slate-600"
                  bgColor="bg-white hover:bg-slate-50"
                  borderColor="border-slate-200 hover:border-slate-400"
                  title="Arac Gecmisi"
                  description="Tum kiralama ve servis kayitlari."
                  onClick={() => act(() => onRentalHistory(vehicle))}
                />
                <ActionCard
                  icon={<Banknote className="h-7 w-7" />}
                  iconColor="text-emerald-600"
                  bgColor="bg-white hover:bg-emerald-50"
                  borderColor="border-slate-200 hover:border-emerald-400"
                  title="Finansal Gecmis"
                  description="Gelir, gider ve borc durumu."
                  onClick={() => act(() => onFinanceHistory(vehicle))}
                />
                <ActionCard
                  icon={<Car className="h-7 w-7" />}
                  iconColor="text-indigo-600"
                  bgColor="bg-white hover:bg-indigo-50"
                  borderColor="border-slate-200 hover:border-indigo-400"
                  title="Arac Bilgileri"
                  description="Ruhsat, sigorta ve donanim detaylari."
                  onClick={() => act(() => onEdit(vehicle))}
                />
              </div>
            </div>
          </>
        )}

        {isSold && (
          <>
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl">
              <p className="text-sm text-slate-700 font-medium">Bu arac satilmis.</p>
              <p className="text-xs text-slate-500 mt-1">Sadece gecmis kayitlarini goruntuleyebilirsiniz.</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Gecmis</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ActionCard
                  icon={<History className="h-7 w-7" />}
                  iconColor="text-slate-600"
                  bgColor="bg-white hover:bg-slate-50"
                  borderColor="border-slate-200 hover:border-slate-400"
                  title="Arac Gecmisi"
                  description="Tum kiralama ve servis kayitlari."
                  onClick={() => act(() => onRentalHistory(vehicle))}
                />
                <ActionCard
                  icon={<Banknote className="h-7 w-7" />}
                  iconColor="text-emerald-600"
                  bgColor="bg-white hover:bg-emerald-50"
                  borderColor="border-slate-200 hover:border-emerald-400"
                  title="Finansal Gecmis"
                  description="Gelir, gider ve borc durumu."
                  onClick={() => act(() => onFinanceHistory(vehicle))}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
