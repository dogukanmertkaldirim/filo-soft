import { useState, useEffect } from 'react';
import { AlertTriangle, MessageCircle, Calendar, Car } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface VehicleInspection {
  id: string;
  plate: string;
  brand: string;
  model: string;
  inspection_due_date: string | null;
  daysUntil: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

interface Props {
  vehicleIds: string[];
  companyId: string;
  supportPhone?: string;
}

function calculateDaysUntil(dueDateStr: string): number {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDate = new Date(todayStr + 'T00:00:00Z');
  const dueDate = new Date(dueDateStr + 'T00:00:00Z');
  const diffMs = dueDate.getTime() - todayDate.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function InspectionAlert({ vehicleIds, companyId, supportPhone = '+90 555 123 4567' }: Props) {
  const [alerts, setAlerts] = useState<VehicleInspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (vehicleIds.length > 0 && companyId) {
      loadInspectionStatus();
    } else {
      setLoading(false);
    }
  }, [vehicleIds, companyId]);

  async function loadInspectionStatus() {
    setLoading(true);

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('id, plate, brand, model, inspection_due_date, inspection_expiry')
      .in('id', vehicleIds)
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (error) {
      console.error('InspectionAlert: Error fetching vehicles:', error);
      setLoading(false);
      return;
    }

    if (vehicles && vehicles.length > 0) {
      const vehiclesWithAlerts: VehicleInspection[] = [];

      for (const v of vehicles) {
        const inspectionDate = v.inspection_due_date || v.inspection_expiry;
        if (!inspectionDate) {
          continue;
        }

        const daysUntil = calculateDaysUntil(inspectionDate);
        const isOverdue = daysUntil < 0;
        const isDueSoon = daysUntil >= 0 && daysUntil <= 30;

        if (isOverdue || isDueSoon) {
          vehiclesWithAlerts.push({
            id: v.id,
            plate: v.plate,
            brand: v.brand,
            model: v.model,
            inspection_due_date: inspectionDate,
            daysUntil,
            isOverdue,
            isDueSoon,
          });
        }
      }

      setAlerts(vehiclesWithAlerts);
    } else {
      setAlerts([]);
    }

    setLoading(false);
  }

  function getWhatsAppLink(phone: string, message: string) {
    const cleanPhone = phone.replace(/\s/g, '').replace(/^\+/, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  if (loading) {
    return null;
  }

  if (alerts.length === 0) {
    return null;
  }

  const hasOverdue = alerts.some(a => a.isOverdue);

  return (
    <div className={`rounded-2xl p-4 sm:p-5 shadow-lg ${
      hasOverdue
        ? 'bg-gradient-to-br from-red-500 to-red-600'
        : 'bg-gradient-to-br from-amber-500 to-amber-600'
    } text-white`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {hasOverdue ? 'MUAYENE SURESI GECMIS!' : 'Muayene Uyarisi'}
          </h3>
          <p className="text-sm opacity-90">
            {hasOverdue
              ? 'Aracinizin muayene suresi gecmistir. Lutfen en kisa surede islem yapiniz.'
              : 'Aracinizin muayenesi yaklasiyors. Randevu alin.'}
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm"
          >
            <Car className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{alert.plate}</p>
              <p className="text-xs opacity-75">{alert.brand} {alert.model}</p>
            </div>
            <div className="text-right">
              {alert.isOverdue ? (
                <span className="px-2 py-1 text-xs font-bold bg-red-900/50 rounded-full">
                  SURESI GECMIS ({Math.abs(alert.daysUntil)} gun)
                </span>
              ) : alert.daysUntil === 0 ? (
                <span className="px-2 py-1 text-xs font-bold bg-red-900/50 rounded-full">
                  BUGUN SON GUN!
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-white/20 rounded-full">
                  {alert.daysUntil} gun kaldi
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <a
          href="https://reservation.tuvturk.com.tr/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Calendar className="h-4 w-4" />
          <span className="text-sm">TUVTURK Randevu Al</span>
        </a>
        <a
          href={getWhatsAppLink(supportPhone, `Merhaba, ${alerts.map(a => a.plate).join(', ')} plakali aracim icin muayene destegi istiyorum.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">Bize Ulasin</span>
        </a>
      </div>
    </div>
  );
}
