import { useState, useEffect } from 'react';
import { Calendar, MapPin, Phone, User, UserPlus, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';

interface Appointment {
  id: string;
  type: string;
  appointment_date: string;
  location_name: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  vehicle_id: string;
  assigned_driver_id: string | null;
  driver_assigned_at: string | null;
  vehicles?: { plate: string; brand: string; model: string } | null;
  customer_drivers?: { driver_name: string } | null;
}

interface TenantDriver {
  id: string;
  driver_name: string;
  driver_phone: string;
  assigned_vehicle_id: string | null;
}

interface Props {
  userId: string;
  companyId: string;
  vehicleIds: string[];
}

export default function TenantServiceAppointments({ userId, companyId, vehicleIds }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [drivers, setDrivers] = useState<TenantDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId, companyId, vehicleIds]);

  async function loadData() {
    if (!vehicleIds.length) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [apptRes, driverRes] = await Promise.all([
      supabase
        .from('service_appointments')
        .select('*, vehicles(plate, brand, model), customer_drivers:assigned_driver_id(driver_name)')
        .eq('company_id', companyId)
        .in('vehicle_id', vehicleIds)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', new Date().toISOString())
        .order('appointment_date', { ascending: true }),
      supabase
        .from('customer_drivers')
        .select('id, driver_name, driver_phone, assigned_vehicle_id')
        .eq('customer_id', userId)
        .eq('company_id', companyId)
        .eq('status', 'active'),
    ]);

    setAppointments(apptRes.data || []);
    setDrivers(driverRes.data || []);
    setLoading(false);
  }

  async function handleAssignDriver(appointmentId: string) {
    if (!selectedDriverId) return;
    setSaving(true);

    await supabase
      .from('service_appointments')
      .update({
        assigned_driver_id: selectedDriverId,
        driver_assigned_at: new Date().toISOString(),
        driver_assigned_by: userId,
      } as any)
      .eq('id', appointmentId);

    setAssigningId(null);
    setSelectedDriverId('');
    setSaving(false);
    await loadData();
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'maintenance': return 'Periyodik Bakim';
      case 'tire_change': return 'Lastik Degisimi';
      case 'repair': return 'Onarim';
      default: return type;
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
        <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-sm text-slate-600 font-medium">Yaklaşan randevu yok</p>
        <p className="text-xs text-slate-400 mt-1">DMK Filo tarafindan olusturulan randevular burada gorunecektir</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map(appt => (
        <div key={appt.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900">{getTypeLabel(appt.type)}</p>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                    appt.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {appt.status === 'confirmed' ? 'Onaylandi' : 'Beklemede'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  {appt.vehicles?.plate} - {appt.vehicles?.brand} {appt.vehicles?.model}
                </p>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {new Date(appt.appointment_date).toLocaleDateString('tr-TR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {appt.location_name && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{appt.location_name}</span>
                    </div>
                  )}
                  {appt.contact_person && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{appt.contact_person}{appt.contact_phone ? ` - ${appt.contact_phone}` : ''}</span>
                    </div>
                  )}
                  {appt.notes && (
                    <p className="text-slate-500 italic mt-1">{appt.notes}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Driver Assignment */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              {appt.assigned_driver_id ? (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-green-800">
                    Surucu Atandi: {appt.customer_drivers?.driver_name || 'Atanmis'}
                  </span>
                </div>
              ) : assigningId === appt.id ? (
                <div className="space-y-2">
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Surucu Secin...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.driver_name} {d.driver_phone ? `(${d.driver_phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAssignDriver(appt.id)}
                      loading={saving}
                      disabled={!selectedDriverId}
                      className="flex-1 !text-xs"
                    >
                      Ata
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setAssigningId(null); setSelectedDriverId(''); }}
                      className="!text-xs"
                    >
                      Iptal
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAssigningId(appt.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors w-full justify-center"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Surucu Ata
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
