import { useState, useEffect } from 'react';
import { Car, FileText, MessageSquare, Wallet, CreditCard, CheckCircle, AlertCircle, Calendar, AlertOctagon, Truck, Users, User, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';
import type { Customer } from '../types/database';
import DigitalGlovebox from '../components/customer/DigitalGlovebox';
import RequestCenter from '../components/customer/RequestCenter';
import MyFinancials from '../components/customer/MyFinancials';
import MyRepresentative from '../components/customer/MyRepresentative';
import UpcomingAppointments from '../components/customer/UpcomingAppointments';
import InspectionAlert from '../components/customer/InspectionAlert';
import DamageReporting from '../components/customer/DamageReporting';
import CustomerHandovers from '../components/customer/CustomerHandovers';
import EmergencySOS from '../components/customer/EmergencySOS';
import TransferRequests from '../components/customer/TransferRequests';
import DriverManagement from '../components/customer/DriverManagement';
import MyWallet from '../components/customer/MyWallet';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  photo_url: string | null;
  status: string;
}

interface DriverAssignment {
  vehicle_id: string;
  driver_name: string;
}

type TabType = 'home' | 'documents' | 'requests' | 'finance' | 'services' | 'damage' | 'handovers' | 'transfer' | 'drivers' | 'wallet';

export default function CustomerPortal() {
  const { user, companyId, company } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverAssignments, setDriverAssignments] = useState<DriverAssignment[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [totalDebt, setTotalDebt] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState(0);

  useEffect(() => {
    loadData();
  }, [user, companyId]);

  async function loadData() {
    if (!user || !companyId) {
      setLoading(false);
      return;
    }

    if (user.linked_customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', user.linked_customer_id)
        .maybeSingle();
      setCustomer(customerData);
    }

    const linkedVehicleIds = user.linked_vehicle_ids || [];

    if (linkedVehicleIds.length > 0) {
      const [vehicleRes, assignmentsRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, plate, brand, model, year, color, photo_url, status')
          .in('id', linkedVehicleIds)
          .eq('company_id', companyId)
          .is('deleted_at', null),
        supabase
          .from('vehicle_driver_assignments')
          .select('vehicle_id, driver:driver_id(driver_name)')
          .eq('company_id', companyId)
          .in('vehicle_id', linkedVehicleIds)
      ]);

      setVehicles(vehicleRes.data || []);

      const assignments = (assignmentsRes.data || []).map(a => ({
        vehicle_id: a.vehicle_id,
        driver_name: (a.driver as any)?.driver_name || ''
      }));
      setDriverAssignments(assignments);

      const { data: rentals } = await supabase
        .from('rentals')
        .select('id, total_amount')
        .in('vehicle_id', linkedVehicleIds)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (rentals && rentals.length > 0) {
        const activeTotalAmount = rentals.reduce((sum, r) => sum + (r.total_amount || 0), 0);
        const rentalIds = rentals.map(r => r.id);

        const { data: payments } = await supabase
          .from('transactions')
          .select('amount')
          .in('rental_id', rentalIds)
          .eq('type', 'income')
          .eq('company_id', companyId);

        const totalPaid = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        setTotalDebt(Math.max(0, activeTotalAmount - totalPaid));
      }

      const { count: requestCount } = await supabase
        .from('customer_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      setPendingRequests(requestCount || 0);

      const { count: appointmentCount } = await supabase
        .from('service_appointments')
        .select('*', { count: 'exact', head: true })
        .or(`customer_id.eq.${user.id},vehicle_id.in.(${linkedVehicleIds.join(',')})`)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', new Date().toISOString());

      setUpcomingAppointments(appointmentCount || 0);
    }

    setLoading(false);
  }

  function getDriverForVehicle(vehicleId: string): string | null {
    const assignment = driverAssignments.find(a => a.vehicle_id === vehicleId);
    return assignment?.driver_name || null;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'rented':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Kirada</span>;
      case 'idle':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Musait</span>;
      case 'maintenance':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Bakimda</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  }

  const vehicleIds = user?.linked_vehicle_ids || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Yukleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 sm:pb-6">
      {activeTab === 'home' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-5 text-white">
            <h1 className="text-xl sm:text-2xl font-bold">Hosgeldiniz, {user?.full_name}</h1>
            <p className="text-teal-100 mt-1 text-sm">Self-servis portaliniza hosgeldiniz</p>
          </div>

          {user && companyId && (
            <InspectionAlert vehicleIds={vehicleIds} companyId={companyId} />
          )}

          {user && companyId && (
            <MyRepresentative
              assignedRepId={user.assigned_rep_id || null}
              companyId={companyId}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab('documents')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors"
            >
              <div className="p-2.5 bg-teal-100 rounded-lg w-fit mb-3">
                <FileText className="h-5 w-5 text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Dijital Torpido</p>
              <p className="text-xs text-slate-500 mt-0.5">Belgeleriniz</p>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors relative"
            >
              <div className="p-2.5 bg-blue-100 rounded-lg w-fit mb-3">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Talepler</p>
              <p className="text-xs text-slate-500 mt-0.5">Sure uzat, KM bildir</p>
              {pendingRequests > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {pendingRequests}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors relative"
            >
              <div className="p-2.5 bg-blue-100 rounded-lg w-fit mb-3">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Randevularim</p>
              <p className="text-xs text-slate-500 mt-0.5">Bakim & Servis</p>
              {upcomingAppointments > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {upcomingAppointments}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors"
            >
              <div className="p-2.5 bg-emerald-100 rounded-lg w-fit mb-3">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Finanslarim</p>
              <p className="text-xs text-slate-500 mt-0.5">Odemeler, dekontlar</p>
            </button>

            <button
              onClick={() => setActiveTab('wallet')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors"
            >
              <div className="p-2.5 bg-purple-100 rounded-lg w-fit mb-3">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Cuzdanim</p>
              <p className="text-xs text-slate-500 mt-0.5">Kayitli Kartlar</p>
            </button>

            <button
              onClick={() => setActiveTab('handovers')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors"
            >
              <div className="p-2.5 bg-slate-100 rounded-lg w-fit mb-3">
                <ClipboardCheck className="h-5 w-5 text-slate-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Tutanaklar</p>
              <p className="text-xs text-slate-500 mt-0.5">Teslim kayitlari</p>
            </button>

            <button
              onClick={() => setActiveTab('transfer')}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 text-left hover:border-teal-300 transition-colors"
            >
              <div className="p-2.5 bg-amber-100 rounded-lg w-fit mb-3">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Transfer Talebi</p>
              <p className="text-xs text-slate-500 mt-0.5">Arac & Lojistik</p>
            </button>
          </div>

          {vehicles.length > 0 && (
            <button
              onClick={() => setActiveTab('drivers')}
              className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-sm text-left text-white"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Surucu Yonetimi</p>
                  <p className="text-xs text-blue-100 mt-0.5">Araclara surucu atayin</p>
                </div>
              </div>
            </button>
          )}

          <button
            onClick={() => setActiveTab('damage')}
            className="w-full p-4 bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-sm text-left text-white"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Hasar / Ariza Bildirimi</p>
                <p className="text-xs text-red-100 mt-0.5">Sorun yasadiginizda bize bildirin</p>
              </div>
            </div>
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-xl ${totalDebt > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                <CreditCard className={`h-5 w-5 ${totalDebt > 0 ? 'text-amber-600' : 'text-green-600'}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-600">Toplam Borc</p>
                <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(totalDebt)}
                </p>
              </div>
              {totalDebt > 0 ? (
                <AlertCircle className="h-6 w-6 text-amber-500" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-teal-100 rounded-xl">
                <Car className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Araclarim</p>
                <p className="text-xs text-slate-500">{vehicles.length} arac</p>
              </div>
            </div>

            {vehicles.length === 0 ? (
              <div className="text-center py-6">
                <Car className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Size atanmis arac yok</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vehicles.map((vehicle) => {
                  const assignedDriver = getDriverForVehicle(vehicle.id);
                  return (
                    <div key={vehicle.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      {vehicle.photo_url ? (
                        <img
                          src={vehicle.photo_url}
                          alt={vehicle.plate}
                          className="w-14 h-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-slate-200 rounded-lg flex items-center justify-center">
                          <Car className="h-7 w-7 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900">{vehicle.plate}</p>
                        <p className="text-xs text-slate-600 truncate">{vehicle.brand} {vehicle.model}</p>
                        {assignedDriver && (
                          <p className="text-xs text-teal-600 flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" />
                            {assignedDriver}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(vehicle.status)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'documents' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <DigitalGlovebox vehicleIds={vehicleIds} companyId={companyId} />
        </div>
      )}

      {activeTab === 'requests' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <RequestCenter userId={user.id} vehicleIds={vehicleIds} companyId={companyId} />
        </div>
      )}

      {activeTab === 'services' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <UpcomingAppointments userId={user.id} vehicleIds={vehicleIds} companyId={companyId} />
        </div>
      )}

      {activeTab === 'finance' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <MyFinancials userId={user.id} vehicleIds={vehicleIds} companyId={companyId} />
        </div>
      )}

      {activeTab === 'wallet' && customer && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <MyWallet customer={customer} companyId={companyId} />
        </div>
      )}

      {activeTab === 'wallet' && !customer && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Cuzdan Kullanilemiyor</h3>
            <p className="text-sm text-slate-500">
              Cuzdan ozelligini kullanabilmek icin hesabinizin bir musteri kaydina baglanmasi gerekiyor.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'damage' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <DamageReporting
            userId={user.id}
            vehicles={vehicles}
            companyId={companyId}
            onClose={() => setActiveTab('home')}
          />
        </div>
      )}

      {activeTab === 'handovers' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <CustomerHandovers vehicleIds={vehicleIds} companyId={companyId} />
        </div>
      )}

      {activeTab === 'transfer' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <TransferRequests userId={user.id} companyId={companyId} />
        </div>
      )}

      {activeTab === 'drivers' && user && companyId && (
        <div className="space-y-4">
          <button
            onClick={() => setActiveTab('home')}
            className="text-sm text-teal-600 font-medium flex items-center gap-1 mb-2"
          >
            ← Ana Sayfa
          </button>
          <DriverManagement
            userId={user.id}
            companyId={companyId}
            vehicles={vehicles}
            onAssignmentChange={loadData}
          />
        </div>
      )}

      {user && companyId && <EmergencySOS companyId={companyId} />}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 sm:hidden z-40">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center w-full h-full ${
              activeTab === 'home' ? 'text-teal-600' : 'text-slate-500'
            }`}
          >
            <Car className="h-5 w-5" />
            <span className="text-xs mt-1">Ana Sayfa</span>
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex flex-col items-center justify-center w-full h-full ${
              activeTab === 'documents' ? 'text-teal-600' : 'text-slate-500'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs mt-1">Belgeler</span>
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex flex-col items-center justify-center w-full h-full ${
              activeTab === 'transfer' ? 'text-teal-600' : 'text-slate-500'
            }`}
          >
            <Truck className="h-5 w-5" />
            <span className="text-xs mt-1">Transfer</span>
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`flex flex-col items-center justify-center w-full h-full ${
              activeTab === 'finance' ? 'text-teal-600' : 'text-slate-500'
            }`}
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs mt-1">Finans</span>
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex flex-col items-center justify-center w-full h-full ${
              activeTab === 'drivers' ? 'text-teal-600' : 'text-slate-500'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs mt-1">Suruculer</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
