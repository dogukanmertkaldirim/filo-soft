import { useState, useEffect } from 'react';
import {
  Car, AlertTriangle, Fuel, Phone, MapPin, Calendar, FileText,
  Upload, Camera, LogOut, User, Clock, CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Vehicle, CustomerDriver } from '../types/database';
import { formatDate } from '../utils/format';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface AssignedVehicle extends Vehicle {
  customer_name?: string;
}

export default function DriverPortal() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignedVehicle, setAssignedVehicle] = useState<AssignedVehicle | null>(null);
  const [driverInfo, setDriverInfo] = useState<CustomerDriver | null>(null);

  const [showAccidentModal, setShowAccidentModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  const [accidentDescription, setAccidentDescription] = useState('');
  const [accidentLocation, setAccidentLocation] = useState('');
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadDriverData();
  }, [user]);

  async function loadDriverData() {
    if (!user?.id) return;
    setLoading(true);

    const { data: driverData } = await supabase
      .from('customer_drivers')
      .select(`
        *,
        customers (company_title),
        vehicles (*)
      `)
      .eq('app_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (driverData) {
      setDriverInfo(driverData);
      if (driverData.assigned_vehicle_id && driverData.vehicles) {
        setAssignedVehicle({
          ...driverData.vehicles,
          customer_name: driverData.customers?.company_title
        });
      }
    }

    setLoading(false);
  }

  async function handleReportAccident() {
    if (!accidentDescription || !accidentLocation) {
      alert('Lutfen tum alanlari doldurun');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('accidents').insert({
      vehicle_id: assignedVehicle?.id,
      accident_date: new Date().toISOString().split('T')[0],
      description: accidentDescription,
      location: accidentLocation,
      reported_by: user?.full_name,
      company_id: user?.company_id,
    });

    if (error) {
      alert('Kaza bildirimi gonderilirken bir hata olustu');
    } else {
      setSuccessMessage('Kaza bildirimi basariyla gonderildi. Yetkililer en kisa surede sizinle iletisime gececektir.');
      setAccidentDescription('');
      setAccidentLocation('');
      setShowAccidentModal(false);
    }

    setSubmitting(false);
  }

  async function handleSubmitFuel() {
    if (!fuelAmount || !fuelCost) {
      alert('Lutfen tum alanlari doldurun');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('expenses').insert({
      vehicle_id: assignedVehicle?.id,
      expense_type: 'fuel',
      amount: parseFloat(fuelCost),
      description: `Yakit alimi - ${fuelAmount} Lt`,
      expense_date: new Date().toISOString().split('T')[0],
      company_id: user?.company_id,
    });

    if (error) {
      alert('Yakit fisi gonderilirken bir hata olustu');
    } else {
      setSuccessMessage('Yakit fisi basariyla kaydedildi.');
      setFuelAmount('');
      setFuelCost('');
      setShowFuelModal(false);
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold">{user?.full_name}</h1>
              <p className="text-xs text-blue-100">Surucu Paneli</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-green-800">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-xs text-green-600 underline mt-1"
              >
                Kapat
              </button>
            </div>
          </div>
        )}

        {assignedVehicle ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-white/10 rounded-xl flex items-center justify-center">
                  <Car className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{assignedVehicle.plate}</h2>
                  <p className="text-sm text-slate-300">
                    {assignedVehicle.brand} {assignedVehicle.model}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Yil</p>
                  <p className="font-medium">{assignedVehicle.year}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Kilometre</p>
                  <p className="font-medium">{assignedVehicle.current_km?.toLocaleString()} km</p>
                </div>
              </div>

              {assignedVehicle.customer_name && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-600 mb-1">Bagli Firma</p>
                  <p className="font-medium text-blue-800">{assignedVehicle.customer_name}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Atanmis Arac Yok</h2>
            <p className="text-sm text-slate-500">
              Henuz size atanmis bir arac bulunmuyor. Lutfen yoneticinizle iletisime gecin.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold text-slate-800 px-1">Hizli Islemler</h3>

          <button
            onClick={() => setShowAccidentModal(true)}
            disabled={!assignedVehicle}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-slate-800">Kaza Bildir</h4>
              <p className="text-sm text-slate-500">Kaza veya hasar durumunu raporlayin</p>
            </div>
          </button>

          <button
            onClick={() => setShowFuelModal(true)}
            disabled={!assignedVehicle}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Fuel className="h-6 w-6 text-amber-600" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-slate-800">Yakit Fisi Gonder</h4>
              <p className="text-sm text-slate-500">Yakit alimlarini kaydedin</p>
            </div>
          </button>

          <button
            onClick={() => setShowEmergencyModal(true)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
          >
            <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Phone className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-slate-800">Acil Yardim</h4>
              <p className="text-sm text-slate-500">7/24 destek hattina ulasin</p>
            </div>
          </button>
        </div>

        {driverInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Surucu Bilgileri</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ehliyet No</span>
                <span className="font-medium">{driverInfo.driver_license_no || '-'}</span>
              </div>
              {driverInfo.driver_license_expiry && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Ehliyet Gecerlilik</span>
                  <span className="font-medium">{formatDate(driverInfo.driver_license_expiry)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Telefon</span>
                <span className="font-medium">{driverInfo.driver_phone || user?.phone || '-'}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <Modal
        isOpen={showAccidentModal}
        onClose={() => setShowAccidentModal(false)}
        title="Kaza Bildir"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              Oncelikle can guvenligi! Yaralanma varsa 112'yi arayin.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Konum / Adres *
            </label>
            <input
              type="text"
              value={accidentLocation}
              onChange={(e) => setAccidentLocation(e.target.value)}
              placeholder="Kaza yeri..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Aciklama *
            </label>
            <textarea
              value={accidentDescription}
              onChange={(e) => setAccidentDescription(e.target.value)}
              rows={4}
              placeholder="Ne oldu? Detayli aciklama..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAccidentModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleReportAccident} loading={submitting} className="flex-1 !bg-red-600 hover:!bg-red-700">
              Bildir
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showFuelModal}
        onClose={() => setShowFuelModal(false)}
        title="Yakit Fisi Gonder"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Miktar (Lt) *
              </label>
              <input
                type="number"
                value={fuelAmount}
                onChange={(e) => setFuelAmount(e.target.value)}
                placeholder="50"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tutar (TL) *
              </label>
              <input
                type="number"
                value={fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
                placeholder="2500"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowFuelModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSubmitFuel} loading={submitting} className="flex-1">
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        title="Acil Yardim"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-xl text-center">
            <p className="text-sm text-red-700 font-medium mb-3">Acil Durum</p>
            <a
              href="tel:112"
              className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-xl font-medium"
            >
              <Phone className="h-5 w-5" />
              112'yi Ara
            </a>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl text-center">
            <p className="text-sm text-blue-700 font-medium mb-3">Filo Destek Hatti</p>
            <a
              href="tel:+905001234567"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium"
            >
              <Phone className="h-5 w-5" />
              Destek Ara
            </a>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl text-center">
            <p className="text-sm text-amber-700 font-medium mb-3">Yol Yardim</p>
            <a
              href="tel:+902121234567"
              className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-xl font-medium"
            >
              <Phone className="h-5 w-5" />
              Yol Yardim
            </a>
          </div>
        </div>
      </Modal>
    </div>
  );
}
