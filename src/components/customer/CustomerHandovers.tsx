import { useState, useEffect } from 'react';
import { ClipboardCheck, Calendar, Fuel, Gauge, Camera, FileText, X, Car, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Props {
  vehicleIds: string[];
  companyId: string;
}

interface Handover {
  id: string;
  type: 'delivery' | 'return';
  fuel_level: number;
  current_km: number;
  exterior_photos: string[];
  general_notes: string | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
  handover_date: string;
  vehicle: {
    plate: string;
    brand: string;
    model: string;
  };
}

export default function CustomerHandovers({ vehicleIds, companyId }: Props) {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHandover, setSelectedHandover] = useState<Handover | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadHandovers();
  }, [vehicleIds, companyId]);

  async function loadHandovers() {
    if (vehicleIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('vehicle_handovers')
      .select(`
        id,
        type,
        fuel_level,
        current_km,
        exterior_photos,
        general_notes,
        is_confirmed,
        confirmed_at,
        handover_date,
        vehicle:vehicle_id(plate, brand, model)
      `)
      .eq('company_id', companyId)
      .in('vehicle_id', vehicleIds)
      .order('handover_date', { ascending: false });

    if (data) {
      const mapped = data.map(h => ({
        ...h,
        exterior_photos: h.exterior_photos || [],
        vehicle: h.vehicle as any
      }));
      setHandovers(mapped);
    }

    setLoading(false);
  }

  function getTypeLabel(type: string) {
    return type === 'delivery' ? 'Teslim' : 'Iade';
  }

  function getTypeColor(type: string) {
    return type === 'delivery'
      ? 'bg-green-100 text-green-700'
      : 'bg-blue-100 text-blue-700';
  }

  function getFuelLabel(level: number) {
    if (level >= 75) return 'Dolu';
    if (level >= 50) return '3/4';
    if (level >= 25) return '1/2';
    if (level > 0) return '1/4';
    return 'Bos';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-slate-100 rounded-xl">
          <ClipboardCheck className="h-6 w-6 text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Teslim Tutanaklari</h2>
          <p className="text-sm text-slate-500">Arac teslim ve iade kayitlari</p>
        </div>
      </div>

      {handovers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <ClipboardCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Henuz tutanak bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {handovers.map((handover) => (
            <button
              key={handover.id}
              onClick={() => setSelectedHandover(handover)}
              className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-teal-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Car className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{handover.vehicle?.plate}</p>
                    <p className="text-xs text-slate-500">
                      {handover.vehicle?.brand} {handover.vehicle?.model}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {handover.is_confirmed && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                      <CheckCircle className="h-3 w-3" />
                      Onaylandi
                    </span>
                  )}
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getTypeColor(handover.type)}`}>
                    {getTypeLabel(handover.type)}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(handover.handover_date), 'dd MMM yyyy', { locale: tr })}
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Gauge className="h-3.5 w-3.5" />
                  {handover.current_km.toLocaleString('tr-TR')} km
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Fuel className="h-3.5 w-3.5" />
                  {getFuelLabel(handover.fuel_level)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedHandover && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Tutanak Detayi</h3>
                <p className="text-sm text-slate-500">
                  {selectedHandover.vehicle?.plate} - {getTypeLabel(selectedHandover.type)}
                </p>
              </div>
              <button
                onClick={() => setSelectedHandover(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {selectedHandover.is_confirmed && (
                <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <CheckCircle className="h-5 w-5 text-teal-600" />
                  <div>
                    <p className="text-sm font-medium text-teal-800">Musteri Tarafindan Onaylandi</p>
                    {selectedHandover.confirmed_at && (
                      <p className="text-xs text-teal-600">
                        {format(new Date(selectedHandover.confirmed_at), 'dd MMMM yyyy HH:mm', { locale: tr })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Tarih
                  </div>
                  <p className="font-semibold text-slate-900">
                    {format(new Date(selectedHandover.handover_date), 'dd MMMM yyyy HH:mm', { locale: tr })}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <Gauge className="h-3.5 w-3.5" />
                    Kilometre
                  </div>
                  <p className="font-semibold text-slate-900">
                    {selectedHandover.current_km.toLocaleString('tr-TR')} km
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                  <Fuel className="h-3.5 w-3.5" />
                  Yakit Durumu
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all"
                      style={{ width: `${selectedHandover.fuel_level}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 w-12 text-right">
                    %{selectedHandover.fuel_level}
                  </span>
                </div>
              </div>

              {selectedHandover.general_notes && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    Notlar
                  </div>
                  <p className="text-sm text-slate-700">{selectedHandover.general_notes}</p>
                </div>
              )}

              {selectedHandover.exterior_photos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-2">
                    <Camera className="h-3.5 w-3.5" />
                    Fotograflar ({selectedHandover.exterior_photos.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedHandover.exterior_photos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPhoto(photo)}
                        className="aspect-square rounded-lg overflow-hidden bg-slate-100"
                      >
                        <img
                          src={photo}
                          alt={`Fotograf ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={selectedPhoto}
            alt="Buyutulmus fotograf"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
