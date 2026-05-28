import { useState, useEffect } from 'react';
import { Calendar, MapPin, User, Phone, Wrench, CircleDot, Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Appointment {
  id: string;
  vehicle_id: string;
  type: 'maintenance' | 'tire_change';
  appointment_date: string;
  location_name: string;
  contact_person: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  vehicle?: {
    plate: string;
    brand: string;
    model: string;
  };
}

interface Props {
  userId: string;
  vehicleIds: string[];
  companyId: string;
}

export default function UpcomingAppointments({ userId, vehicleIds, companyId }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  }, [userId, vehicleIds, companyId]);

  async function loadAppointments() {
    if (vehicleIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('service_appointments')
      .select(`
        *,
        vehicle:vehicles(plate, brand, model)
      `)
      .eq('company_id', companyId)
      .or(`customer_id.eq.${userId},vehicle_id.in.(${vehicleIds.join(',')})`)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', new Date().toISOString())
      .order('appointment_date', { ascending: true })
      .limit(10);

    setAppointments(data || []);
    setLoading(false);
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'maintenance':
        return <Wrench className="h-5 w-5" />;
      case 'tire_change':
        return <CircleDot className="h-5 w-5" />;
      default:
        return <Calendar className="h-5 w-5" />;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'maintenance':
        return 'Bakim';
      case 'tire_change':
        return 'Lastik Degisimi';
      default:
        return type;
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'maintenance':
        return 'bg-blue-100 text-blue-600';
      case 'tire_change':
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Bekliyor
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" /> Onaylandi
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
            <CheckCircle className="h-3 w-3" /> Tamamlandi
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <XCircle className="h-3 w-3" /> Iptal
          </span>
        );
      default:
        return null;
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getDaysUntil(dateString: string) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Bugun';
    if (diff === 1) return 'Yarin';
    return `${diff} gun sonra`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-slate-100 rounded w-1/3"></div>
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Randevularim</h2>
            <p className="text-sm text-slate-500">
              {appointments.length > 0 ? `${appointments.length} yaklasan randevu` : 'Randevu yok'}
            </p>
          </div>
        </div>
      </div>

      {appointments.length === 0 ? (
        <div className="p-8 text-center">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Yaklasan randevunuz bulunmuyor</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {appointments.map((apt) => (
            <div key={apt.id} className="p-4">
              <button
                onClick={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${getTypeColor(apt.type)}`}>
                    {getTypeIcon(apt.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900">{getTypeLabel(apt.type)}</span>
                      {getStatusBadge(apt.status)}
                    </div>
                    <p className="text-xs text-slate-600">
                      {apt.vehicle?.plate} - {apt.vehicle?.brand} {apt.vehicle?.model}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-medium text-teal-600">{getDaysUntil(apt.appointment_date)}</span>
                      <span className="text-xs text-slate-500">{formatDate(apt.appointment_date)} - {formatTime(apt.appointment_date)}</span>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${expandedId === apt.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {expandedId === apt.id && (
                <div className="mt-4 ml-12 space-y-3 bg-slate-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{apt.location_name}</p>
                      <p className="text-xs text-slate-500">Konum</p>
                    </div>
                  </div>

                  {apt.contact_person && (
                    <div className="flex items-start gap-3">
                      <User className="h-4 w-4 text-slate-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{apt.contact_person}</p>
                        <p className="text-xs text-slate-500">Irtibat Kisisi</p>
                      </div>
                    </div>
                  )}

                  {apt.contact_phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-slate-500 mt-0.5" />
                      <div>
                        <a
                          href={`tel:${apt.contact_phone.replace(/\s/g, '')}`}
                          className="text-sm font-medium text-teal-600 hover:underline"
                        >
                          {apt.contact_phone}
                        </a>
                        <p className="text-xs text-slate-500">Telefon</p>
                      </div>
                    </div>
                  )}

                  {apt.notes && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Notlar</p>
                      <p className="text-sm text-slate-700">{apt.notes}</p>
                    </div>
                  )}

                  {apt.contact_phone && (
                    <a
                      href={`tel:${apt.contact_phone.replace(/\s/g, '')}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Servisi Ara
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
