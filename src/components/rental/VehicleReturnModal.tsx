import { useState, useEffect, useMemo } from 'react';
import { X, Car, Fuel, Droplets, AlertTriangle, Calculator, CreditCard, Banknote, BookOpen, ChevronRight, Check, Calendar, RotateCcw, ClipboardCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';
import Input from '../ui/Input';
import Button from '../ui/Button';
import CurrencyInput from '../ui/CurrencyInput';
import CarDamageSchema from '../vehicle/CarDamageSchema';
import VideoUpload from './VideoUpload';

interface Rental {
  id: string;
  vehicle_id: string;
  customer_id: string;
  rental_type: string;
  rental_model: string;
  start_date: string;
  end_date: string;
  starting_km: number | null;
  fuel_status: string | null;
  daily_km_limit: number | null;
  monthly_km_limit: number | null;
  per_km_overage_fee: number | null;
  deposit_amount: number | null;
  total_amount: number | null;
  daily_rate?: number | null;
  monthly_rate?: number | null;
  delivery_damage_condition?: Record<string, string> | null;
  vehicles?: { plate_number: string; brand: string; model: string };
  customers?: { company_title: string };
}

interface VehicleReturnModalProps {
  rental: Rental;
  onClose: () => void;
  onComplete: () => void;
}

const FUEL_LABELS: Record<string, number> = {
  'full': 100,
  '3/4': 75,
  '1/2': 50,
  '1/4': 25,
  'empty': 0,
};

export default function VehicleReturnModal({ rental, onClose, onComplete }: VehicleReturnModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const [actualReturnDate, setActualReturnDate] = useState<string>(today);

  const [endKm, setEndKm] = useState<number>(rental.starting_km || 0);
  const [extraKmFee, setExtraKmFee] = useState<number>(0);
  const [extraKmFeeOverride, setExtraKmFeeOverride] = useState(false);

  const [returnFuelLevel, setReturnFuelLevel] = useState<number>(FUEL_LABELS[rental.fuel_status || 'full'] || 100);
  const [fuelFee, setFuelFee] = useState<number>(0);

  const [isDirty, setIsDirty] = useState(false);
  const [cleaningFee, setCleaningFee] = useState<number>(0);
  const [damageFee, setDamageFee] = useState<number>(0);
  const [otherFee, setOtherFee] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [setVehicleToMaintenance, setSetVehicleToMaintenance] = useState(false);

  const [returnDamageCondition, setReturnDamageCondition] = useState<Record<string, string>>(
    rental.delivery_damage_condition || {}
  );
  const [returnVideoUrl, setReturnVideoUrl] = useState<string | null>(null);

  const startFuelLevel = FUEL_LABELS[rental.fuel_status || 'full'] || 100;
  const drivenKm = Math.max(0, endKm - (rental.starting_km || 0));

  const plannedEndDate = rental.end_date?.slice(0, 10);

  const earlyReturnInfo = useMemo(() => {
    if (!actualReturnDate || !plannedEndDate) return null;

    const returnDate = new Date(actualReturnDate);
    const endDate = new Date(plannedEndDate);
    const startDate = new Date(rental.start_date);

    returnDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - returnDate.getTime();
    const daysEarly = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (daysEarly <= 0) return null;

    const dailyRate = rental.daily_rate || (rental.monthly_rate ? rental.monthly_rate / 30 : 0);
    const refundAmount = daysEarly * dailyRate;

    return {
      daysEarly,
      refundAmount,
      dailyRate,
    };
  }, [actualReturnDate, plannedEndDate, rental.start_date, rental.daily_rate, rental.monthly_rate]);

  const actualRentalDays = useMemo(() => {
    const start = new Date(rental.start_date);
    const end = new Date(actualReturnDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [rental.start_date, actualReturnDate]);

  const revisedPriceCalculation = useMemo(() => {
    const dailyRate = rental.daily_rate || (rental.monthly_rate ? Math.round(rental.monthly_rate / 30) : 0);
    const originalTotal = rental.total_amount || 0;
    const proRataBaseFee = dailyRate * actualRentalDays;
    const isEarlyReturn = earlyReturnInfo && earlyReturnInfo.daysEarly > 0;

    return {
      dailyRate,
      originalTotal,
      proRataBaseFee,
      isEarlyReturn,
    };
  }, [rental.daily_rate, rental.monthly_rate, rental.total_amount, actualRentalDays, earlyReturnInfo]);

  const rentalDays = useMemo(() => {
    const start = new Date(rental.start_date);
    const end = new Date(rental.end_date);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [rental.start_date, rental.end_date]);

  const kmCalculation = useMemo(() => {
    let dailyKmAllowance = 0;
    let allowedKm = 0;
    let hasLimit = false;

    if (rental.rental_model === 'rent_a_car' && rental.daily_km_limit) {
      dailyKmAllowance = rental.daily_km_limit;
      allowedKm = dailyKmAllowance * actualRentalDays;
      hasLimit = true;
    } else if (rental.monthly_km_limit) {
      dailyKmAllowance = Math.round(rental.monthly_km_limit / 30);
      allowedKm = dailyKmAllowance * actualRentalDays;
      hasLimit = true;
    }

    const overLimit = hasLimit ? Math.max(0, drivenKm - allowedKm) : 0;

    return {
      dailyKmAllowance,
      allowedKm,
      overLimit,
      hasLimit,
    };
  }, [rental.rental_model, rental.daily_km_limit, rental.monthly_km_limit, actualRentalDays, drivenKm]);

  const kmLimit = kmCalculation.allowedKm;
  const kmOverage = kmCalculation.overLimit;

  useEffect(() => {
    if (!extraKmFeeOverride && kmOverage > 0 && rental.per_km_overage_fee) {
      setExtraKmFee(kmOverage * rental.per_km_overage_fee);
    } else if (!extraKmFeeOverride && kmOverage === 0) {
      setExtraKmFee(0);
    }
  }, [kmOverage, rental.per_km_overage_fee, extraKmFeeOverride]);

  const totalExtraCharges = extraKmFee + fuelFee + cleaningFee + damageFee + otherFee;

  const handleComplete = async () => {
    if (!paymentMethod && totalExtraCharges > 0) {
      setError('Lütfen ödeme yöntemini seçin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isEarlyReturn = revisedPriceCalculation.isEarlyReturn;
      const originalTotal = revisedPriceCalculation.originalTotal;
      const revisedBaseFee = revisedPriceCalculation.proRataBaseFee;
      const revisedTotal = revisedBaseFee + totalExtraCharges;

      const { error: rentalError } = await supabase
        .from('rentals')
        .update({
          status: 'completed',
          actual_return_date: actualReturnDate,
          end_km: endKm,
          return_fuel_level: returnFuelLevel,
          fuel_fee: fuelFee,
          cleaning_fee: cleaningFee,
          damage_fee: damageFee,
          extra_km_fee: extraKmFee,
          other_fee: otherFee,
          total_extra_charges: totalExtraCharges,
          return_notes: returnNotes || null,
          extra_charges_payment_method: totalExtraCharges > 0 ? paymentMethod : null,
          early_return_days: earlyReturnInfo?.daysEarly || null,
          early_return_refund: earlyReturnInfo?.refundAmount || null,
          original_total_amount: isEarlyReturn ? originalTotal : null,
          total_amount: isEarlyReturn ? revisedTotal : (originalTotal + totalExtraCharges),
          return_damage_condition: returnDamageCondition,
          return_video_url: returnVideoUrl || null,
        })
        .eq('id', rental.id);

      if (rentalError) throw rentalError;

      const newVehicleStatus = setVehicleToMaintenance ? 'maintenance' : 'idle';
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({
          status: newVehicleStatus,
          current_km: endKm,
          damage_schema: returnDamageCondition,
        })
        .eq('id', rental.vehicle_id);

      if (vehicleError) throw vehicleError;

      if (totalExtraCharges > 0 && paymentMethod === 'add_to_debt') {
        const { error: expenseError } = await supabase
          .from('expenses')
          .insert({
            vehicle_id: rental.vehicle_id,
            customer_id: rental.customer_id,
            expense_type: 'other',
            amount: totalExtraCharges,
            expense_date: new Date().toISOString().slice(0, 10),
            description: `Kiralama teslim ucreti - ${rental.vehicles?.plate_number || 'Araç'}`,
            notes: `KM: ${extraKmFee > 0 ? formatCurrency(extraKmFee) : '-'}, Yakıt: ${fuelFee > 0 ? formatCurrency(fuelFee) : '-'}, Yikama: ${cleaningFee > 0 ? formatCurrency(cleaningFee) : '-'}, Hasar: ${damageFee > 0 ? formatCurrency(damageFee) : '-'}, Diger: ${otherFee > 0 ? formatCurrency(otherFee) : '-'}`,
          });

        if (expenseError) console.error('Failed to create expense record:', expenseError);
      }

      onComplete();
    } catch (err) {
      console.error('Error completing rental:', err);
      setError('İşlem sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Car className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Araç Teslim Al</h2>
              <p className="text-sm text-slate-300">
                {rental.vehicles?.plate_number} - {rental.vehicles?.brand} {rental.vehicles?.model}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          {[
            { num: 1, label: 'KM & Kullanim' },
            { num: 2, label: 'Yakit' },
            { num: 3, label: 'Hasar Durumu' },
            { num: 4, label: 'Temizlik & Ucret' },
            { num: 5, label: 'Ozet' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                step === s.num
                  ? 'text-slate-900 bg-slate-50'
                  : step > s.num
                    ? 'text-green-600'
                    : 'text-slate-400'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                {step > s.num ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                    step === s.num ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {s.num}
                  </span>
                )}
                {s.label}
              </span>
              {step === s.num && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                <h3 className="font-medium text-teal-900 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal-600" />
                  Teslim Tarihi
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-teal-600 mb-1">Planlanan Bitiş</label>
                    <p className="text-lg font-semibold text-teal-900">
                      {plannedEndDate ? new Date(plannedEndDate).toLocaleDateString('tr-TR') : '-'}
                    </p>
                  </div>
                  <Input
                    label="Gerçek Teslim Tarihi *"
                    type="date"
                    value={actualReturnDate}
                    onChange={(e) => setActualReturnDate(e.target.value)}
                  />
                </div>
              </div>

              {earlyReturnInfo && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <RotateCcw className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-900">Erken Dönüş Tespit Edildi</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-amber-700">Erken Dönüş: </span>
                      <span className="font-bold text-amber-900">{earlyReturnInfo.daysEarly} Gün Once</span>
                    </div>
                    <div>
                      <span className="text-amber-700">Iade/Fark Tutari: </span>
                      <span className="font-bold text-amber-900">{formatCurrency(earlyReturnInfo.refundAmount)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    * Günluk {formatCurrency(earlyReturnInfo.dailyRate)} x {earlyReturnInfo.daysEarly} gun = {formatCurrency(earlyReturnInfo.refundAmount)} iade
                  </p>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-slate-600" />
                  Kilometre Bilgileri
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Çıkış KM</label>
                    <p className="text-lg font-semibold text-slate-900">
                      {(rental.starting_km || 0).toLocaleString('tr-TR')} km
                    </p>
                  </div>
                  <Input
                    label="Dönüş KM *"
                    type="number"
                    value={endKm || ''}
                    onChange={(e) => {
                      setEndKm(Number(e.target.value));
                      setExtraKmFeeOverride(false);
                    }}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Kullanilan Sure</p>
                    <p className="text-xl font-bold text-blue-900">{actualRentalDays} Gün</p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Bu Sure İçin KM Hakki</p>
                    <p className="text-xl font-bold text-blue-900">
                      {kmCalculation.hasLimit ? kmLimit.toLocaleString('tr-TR') : 'Limitsiz'}
                    </p>
                    {kmCalculation.hasLimit && kmCalculation.dailyKmAllowance > 0 && (
                      <p className="text-xs text-blue-500 mt-1">
                        ({kmCalculation.dailyKmAllowance.toLocaleString('tr-TR')} km/gun x {actualRentalDays} gun)
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">Yapılan KM</p>
                    <p className="text-xl font-bold text-blue-900">{drivenKm.toLocaleString('tr-TR')}</p>
                  </div>
                  <div className={`text-center p-3 rounded-lg ${kmOverage > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                    <p className={`text-xs mb-1 ${kmOverage > 0 ? 'text-red-600' : 'text-green-600'}`}>KM Aşımi</p>
                    <p className={`text-xl font-bold ${kmOverage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {kmOverage > 0 ? `+${kmOverage.toLocaleString('tr-TR')}` : '0'}
                    </p>
                    {kmOverage > 0 && rental.per_km_overage_fee && (
                      <p className="text-xs text-red-500 mt-1">
                        ({kmOverage.toLocaleString('tr-TR')} x {rental.per_km_overage_fee} TL)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {kmOverage > 0 && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">KM Aşım Ücreti</span>
                    </div>
                    <span className="text-xs text-red-600">
                      {rental.per_km_overage_fee ? `${rental.per_km_overage_fee} TL/km` : 'Birim fiyat yok'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <CurrencyInput
                        label=""
                        value={extraKmFee}
                        onChange={(val) => {
                          setExtraKmFee(val);
                          setExtraKmFeeOverride(true);
                        }}
                      />
                    </div>
                    {extraKmFeeOverride && (
                      <button
                        onClick={() => {
                          setExtraKmFeeOverride(false);
                          if (rental.per_km_overage_fee) {
                            setExtraKmFee(kmOverage * rental.per_km_overage_fee);
                          }
                        }}
                        className="text-xs text-red-600 hover:underline whitespace-nowrap"
                      >
                        Otomatik Hesapla
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <h3 className="font-medium text-amber-900 mb-4 flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-amber-600" />
                  Yakıt Durumu
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs text-amber-600 mb-2">Çıkış Yakıti</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-4 bg-amber-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${startFuelLevel}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-amber-900">%{startFuelLevel}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-amber-600 mb-2">Dönüş Yakıti</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={returnFuelLevel}
                        onChange={(e) => setReturnFuelLevel(Number(e.target.value))}
                        className="flex-1 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <span className="text-lg font-bold text-amber-900 w-12 text-right">%{returnFuelLevel}</span>
                    </div>
                  </div>
                </div>
              </div>

              {returnFuelLevel < startFuelLevel && (
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-orange-800">
                      Yakıt Farki: %{startFuelLevel - returnFuelLevel}
                    </span>
                  </div>
                  <CurrencyInput
                    label="Yakıt Fark Bedeli (TL)"
                    value={fuelFee}
                    onChange={setFuelFee}
                  />
                </div>
              )}

              {returnFuelLevel >= startFuelLevel && (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                  <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">Yakıt seviyesi uygun</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <h3 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-amber-600" />
                  Arac Hasar Kontrolu
                </h3>
                <p className="text-sm text-amber-700 mb-4">
                  Kiralama suresince olusan yeni hasarlari isaretleyin. Teslim alinan durum otomatik olarak yuklenmistir.
                </p>
                <CarDamageSchema
                  value={returnDamageCondition}
                  onChange={setReturnDamageCondition}
                />
              </div>

              <VideoUpload
                label="Video Kanıt (İade)"
                videoUrl={returnVideoUrl}
                onVideoChange={setReturnVideoUrl}
                storagePath={`returns/${rental.vehicles?.plate_number || rental.vehicle_id}`}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-slate-600" />
                  Temizlik Durumu
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDirty}
                    onChange={(e) => {
                      setIsDirty(e.target.checked);
                      if (!e.target.checked) setCleaningFee(0);
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                  />
                  <span className="text-slate-700">Arac kirli teslim edildi</span>
                </label>
                {isDirty && (
                  <div className="mt-4">
                    <CurrencyInput
                      label="Yikama Ucreti (TL)"
                      value={cleaningFee}
                      onChange={setCleaningFee}
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                <h3 className="font-medium text-red-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Hasar & Diger Ucretler
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <CurrencyInput
                    label="Hasar Bedeli (TL)"
                    value={damageFee}
                    onChange={setDamageFee}
                  />
                  <CurrencyInput
                    label="Diger Ucretler (TL)"
                    value={otherFee}
                    onChange={setOtherFee}
                  />
                </div>
                {damageFee > 0 && (
                  <label className="flex items-center gap-3 cursor-pointer mt-4 pt-4 border-t border-red-200">
                    <input
                      type="checkbox"
                      checked={setVehicleToMaintenance}
                      onChange={(e) => setSetVehicleToMaintenance(e.target.checked)}
                      className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-red-700">Araci bakima al (onarim gerekli)</span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Teslim Notlari</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  placeholder="Arac durumu, ozel notlar..."
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              {revisedPriceCalculation.isEarlyReturn && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <RotateCcw className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-900">Erken Dönüş Fiyat Revizesi</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-amber-700">Sozlesme Tutari:</span>
                      <span className="font-medium text-amber-900 line-through">{formatCurrency(revisedPriceCalculation.originalTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700">Kullanilan Sure:</span>
                      <span className="font-medium text-amber-900">{actualRentalDays} Gün</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700">Pro-Rata Kira Bedeli:</span>
                      <span className="font-medium text-amber-900">
                        {formatCurrency(revisedPriceCalculation.proRataBaseFee)}
                        <span className="text-xs text-amber-600 ml-1">
                          ({formatCurrency(revisedPriceCalculation.dailyRate)}/gun x {actualRentalDays})
                        </span>
                      </span>
                    </div>
                    {totalExtraCharges > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-700">Ek Ücretler:</span>
                        <span className="font-medium text-amber-900">+{formatCurrency(totalExtraCharges)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-amber-200">
                      <span className="text-amber-800 font-medium">Revize Edilmis Toplam:</span>
                      <span className="font-bold text-amber-900">{formatCurrency(revisedPriceCalculation.proRataBaseFee + totalExtraCharges)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-800 rounded-xl text-white">
                <h3 className="text-sm text-slate-400 mb-2">
                  {revisedPriceCalculation.isEarlyReturn ? 'Revize Edilmis Toplam Tutar' : 'Toplam Tutar'}
                </h3>
                <p className="text-3xl font-bold">
                  {formatCurrency(revisedPriceCalculation.isEarlyReturn
                    ? revisedPriceCalculation.proRataBaseFee + totalExtraCharges
                    : revisedPriceCalculation.originalTotal + totalExtraCharges
                  )}
                </p>
                {revisedPriceCalculation.isEarlyReturn && revisedPriceCalculation.originalTotal > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Orijinal: {formatCurrency(revisedPriceCalculation.originalTotal)} (Erken donus revizesi uygulandi)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {extraKmFee > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">KM Aşım Ücreti</span>
                    <span className="font-medium text-slate-900">{formatCurrency(extraKmFee)}</span>
                  </div>
                )}
                {fuelFee > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Yakıt Farki</span>
                    <span className="font-medium text-slate-900">{formatCurrency(fuelFee)}</span>
                  </div>
                )}
                {cleaningFee > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Yikama Ücreti</span>
                    <span className="font-medium text-slate-900">{formatCurrency(cleaningFee)}</span>
                  </div>
                )}
                {damageFee > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Hasar Bedeli</span>
                    <span className="font-medium text-slate-900">{formatCurrency(damageFee)}</span>
                  </div>
                )}
                {otherFee > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Diger Ücretler</span>
                    <span className="font-medium text-slate-900">{formatCurrency(otherFee)}</span>
                  </div>
                )}
                {totalExtraCharges === 0 && !earlyReturnInfo && (
                  <div className="text-center py-6 text-slate-500">
                    <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
                    <p>Ek ucret bulunmuyor</p>
                  </div>
                )}
              </div>

              {totalExtraCharges > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Ödeme Yontemi *</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('add_to_debt')}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        paymentMethod === 'add_to_debt'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <BookOpen className={`h-5 w-5 ${paymentMethod === 'add_to_debt' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div>
                        <p className={`font-medium ${paymentMethod === 'add_to_debt' ? 'text-blue-900' : 'text-slate-900'}`}>
                          Cariye Borc Olarak Ekle
                        </p>
                        <p className="text-xs text-slate-500">Müşteri hesabina borc olarak kaydedilir</p>
                      </div>
                    </button>

                    {(rental.deposit_amount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('deduct_deposit')}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                          paymentMethod === 'deduct_deposit'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <CreditCard className={`h-5 w-5 ${paymentMethod === 'deduct_deposit' ? 'text-amber-600' : 'text-slate-400'}`} />
                        <div>
                          <p className={`font-medium ${paymentMethod === 'deduct_deposit' ? 'text-amber-900' : 'text-slate-900'}`}>
                            Depozitodan Dus
                          </p>
                          <p className="text-xs text-slate-500">
                            Mevcut depozito: {formatCurrency(rental.deposit_amount || 0)}
                          </p>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paid_cash')}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        paymentMethod === 'paid_cash'
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Banknote className={`h-5 w-5 ${paymentMethod === 'paid_cash' ? 'text-green-600' : 'text-slate-400'}`} />
                      <div>
                        <p className={`font-medium ${paymentMethod === 'paid_cash' ? 'text-green-900' : 'text-slate-900'}`}>
                          Tahsil Edildi (Nakit)
                        </p>
                        <p className="text-xs text-slate-500">Nakit olarak teslimatta alindi</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paid_card')}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        paymentMethod === 'paid_card'
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <CreditCard className={`h-5 w-5 ${paymentMethod === 'paid_card' ? 'text-green-600' : 'text-slate-400'}`} />
                      <div>
                        <p className={`font-medium ${paymentMethod === 'paid_card' ? 'text-green-900' : 'text-slate-900'}`}>
                          Tahsil Edildi (Kart)
                        </p>
                        <p className="text-xs text-slate-500">Kredi/banka karti ile teslimatta alindi</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
          <div>
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Geri
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              Iptal
            </Button>
            {step < 5 ? (
              <Button onClick={() => setStep(step + 1)}>
                Devam
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={loading || (totalExtraCharges > 0 && !paymentMethod)}
              >
                {loading ? 'Isleniyor...' : 'Teslim Al ve Tamamla'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
