import { useState, useEffect } from 'react';
import { Truck, Car, Users, MapPin, Calendar, Clock, Plus, X, Check, AlertCircle, ChevronRight, Bus, Package, Image as ImageIcon, ZoomIn, Phone, User, Shield, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TransferRequest {
  id: string;
  status: string;
  vehicle_type: string;
  passenger_count: number;
  pickup_location: string;
  pickup_datetime: string;
  dropoff_location: string;
  notes: string | null;
  admin_notes: string | null;
  offered_price: number | null;
  rejection_reason: string | null;
  proposal_photos: string[] | null;
  assigned_plate: string | null;
  assigned_driver_name: string | null;
  assigned_driver_phone: string | null;
  vehicle_color: string | null;
  meeting_point_note: string | null;
  passengers_submitted_at: string | null;
  created_at: string;
}

interface Passenger {
  id?: string;
  full_name: string;
  tc_identity_number: string;
  passport_number?: string;
  nationality?: string;
  is_foreign?: boolean;
}

interface Props {
  userId: string;
  companyId: string;
}

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedan', icon: Car, description: '1-4 yolcu', color: 'bg-blue-500' },
  { value: 'vip_vito', label: 'VIP Vito', icon: Car, description: '1-7 yolcu, VIP', color: 'bg-amber-500' },
  { value: 'minibus', label: 'Minibus', icon: Users, description: '8-15 yolcu', color: 'bg-teal-500' },
  { value: 'bus', label: 'Otobus', icon: Bus, description: '16+ yolcu', color: 'bg-green-500' },
  { value: 'truck', label: 'Lojistik / Kamyon', icon: Package, description: 'Yuk tasimaciligi', color: 'bg-slate-500' }
];

export default function TransferRequests({ userId, companyId }: Props) {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [passengersMap, setPassengersMap] = useState<Record<string, Passenger[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [passengerFormRequest, setPassengerFormRequest] = useState<TransferRequest | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [savingPassengers, setSavingPassengers] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_type: '',
    passenger_count: 1,
    pickup_location: '',
    pickup_date: '',
    pickup_time: '',
    dropoff_location: '',
    notes: ''
  });

  useEffect(() => {
    loadRequests();
  }, [userId, companyId]);

  async function loadRequests() {
    const { data } = await supabase
      .from('transfer_requests')
      .select('*')
      .eq('customer_id', userId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    const requestsList = data || [];
    setRequests(requestsList);

    const confirmedIds = requestsList
      .filter(r => r.status === 'confirmed' || r.status === 'completed')
      .map(r => r.id);

    if (confirmedIds.length > 0) {
      const { data: passengersData } = await supabase
        .from('transfer_passengers')
        .select('*')
        .in('transfer_request_id', confirmedIds);

      const grouped: Record<string, Passenger[]> = {};
      (passengersData || []).forEach(p => {
        if (!grouped[p.transfer_request_id]) {
          grouped[p.transfer_request_id] = [];
        }
        grouped[p.transfer_request_id].push(p);
      });
      setPassengersMap(grouped);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.vehicle_type || !formData.pickup_location || !formData.pickup_date || !formData.pickup_time || !formData.dropoff_location) {
      alert('Lutfen zorunlu alanlari doldurun');
      return;
    }

    setSaving(true);

    const pickupDatetime = new Date(`${formData.pickup_date}T${formData.pickup_time}`).toISOString();

    const { error } = await supabase.from('transfer_requests').insert({
      company_id: companyId,
      customer_id: userId,
      vehicle_type: formData.vehicle_type,
      passenger_count: formData.passenger_count,
      pickup_location: formData.pickup_location,
      pickup_datetime: pickupDatetime,
      dropoff_location: formData.dropoff_location,
      notes: formData.notes || null
    });

    setSaving(false);

    if (!error) {
      setShowForm(false);
      setFormData({
        vehicle_type: '',
        passenger_count: 1,
        pickup_location: '',
        pickup_date: '',
        pickup_time: '',
        dropoff_location: '',
        notes: ''
      });
      setSuccessMessage('Talebiniz basariyla alindi! En kisa surede sizinle iletisime gececegiz.');
      loadRequests();
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  }

  function startApprovalFlow(request: TransferRequest) {
    if (request.vehicle_type === 'truck') {
      handleApproveOffer(request);
      return;
    }

    const initialPassengers: Passenger[] = [];
    for (let i = 0; i < request.passenger_count; i++) {
      initialPassengers.push({
        full_name: '',
        tc_identity_number: '',
        passport_number: '',
        nationality: 'TR',
        is_foreign: false
      });
    }
    setPassengers(initialPassengers);
    setPassengerFormRequest(request);
    setShowPassengerModal(true);
  }

  function updatePassenger(index: number, field: keyof Passenger, value: string | boolean) {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function togglePassengerType(index: number) {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        is_foreign: !updated[index].is_foreign,
        tc_identity_number: '',
        passport_number: '',
        nationality: !updated[index].is_foreign ? 'US' : 'TR'
      };
      return updated;
    });
  }

  async function openEditPassengers(request: TransferRequest) {
    const { data: existingPassengers } = await supabase
      .from('transfer_passengers')
      .select('*')
      .eq('transfer_request_id', request.id);

    const initialPassengers: Passenger[] = [];

    if (existingPassengers && existingPassengers.length > 0) {
      existingPassengers.forEach(p => {
        initialPassengers.push({
          id: p.id,
          full_name: p.full_name || '',
          tc_identity_number: p.tc_identity_number || '',
          passport_number: p.passport_number || '',
          nationality: p.nationality || 'TR',
          is_foreign: !!p.passport_number
        });
      });
    }

    for (let i = initialPassengers.length; i < request.passenger_count; i++) {
      initialPassengers.push({
        full_name: '',
        tc_identity_number: '',
        passport_number: '',
        nationality: 'TR',
        is_foreign: false
      });
    }

    setPassengers(initialPassengers);
    setPassengerFormRequest(request);
    setShowPassengerModal(true);
  }

  function validatePassengers(): boolean {
    for (const p of passengers) {
      if (p.full_name.trim()) {
        if (p.is_foreign) {
          if (!p.passport_number?.trim()) {
            alert('Yabanci yolcular icin Pasaport Numarasi gereklidir.');
            return false;
          }
        } else {
          if (!p.tc_identity_number.trim() || p.tc_identity_number.length !== 11) {
            alert('TC vatandasi yolcular icin 11 haneli TC Kimlik numarasi gereklidir.');
            return false;
          }
        }
      }
    }
    return true;
  }

  async function handleSubmitPassengers(skipPassengers: boolean = false) {
    if (!passengerFormRequest) return;

    if (!skipPassengers && !validatePassengers()) return;

    setSavingPassengers(true);

    if (!skipPassengers) {
      await supabase
        .from('transfer_passengers')
        .delete()
        .eq('transfer_request_id', passengerFormRequest.id);

      const passengersWithData = passengers.filter(p => p.full_name.trim());

      if (passengersWithData.length > 0) {
        const passengerInserts = passengersWithData.map(p => ({
          transfer_request_id: passengerFormRequest.id,
          full_name: p.full_name,
          tc_identity_number: p.is_foreign ? null : p.tc_identity_number,
          passport_number: p.is_foreign ? p.passport_number : null,
          nationality: p.is_foreign ? p.nationality : 'TR'
        }));

        const { error: passError } = await supabase
          .from('transfer_passengers')
          .insert(passengerInserts);

        if (passError) {
          alert('Yolcu bilgileri kaydedilirken hata olustu.');
          setSavingPassengers(false);
          return;
        }
      }
    }

    const { error: updateError } = await supabase
      .from('transfer_requests')
      .update({
        status: 'confirmed',
        passengers_submitted_at: skipPassengers ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', passengerFormRequest.id);

    setSavingPassengers(false);

    if (!updateError) {
      setShowPassengerModal(false);
      setPassengerFormRequest(null);
      setPassengers([]);
      setSuccessMessage(skipPassengers ? 'Teklif onaylandi! Yolcu bilgilerini daha sonra ekleyebilirsiniz.' : 'Teklif onaylandi ve yolcu bilgileri kaydedildi!');
      loadRequests();
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      alert('Islem sirasinda bir hata olustu.');
    }
  }

  async function handleApproveOffer(request: TransferRequest) {
    setProcessing(true);

    const { error } = await supabase
      .from('transfer_requests')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (!error) {
      setSuccessMessage('Teklif onaylandi! Transfer rezervasyonunuz kesinlesti.');
      loadRequests();
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  function openRejectModal(request: TransferRequest) {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectModal(true);
  }

  async function handleRejectOffer() {
    if (!selectedRequest) return;

    setProcessing(true);

    const { error } = await supabase
      .from('transfer_requests')
      .update({
        status: 'cancelled',
        rejection_reason: rejectionReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedRequest.id);

    if (!error) {
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      setSuccessMessage('Teklif reddedildi.');
      loadRequests();
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Beklemede</span>;
      case 'offered':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Teklif Verildi</span>;
      case 'confirmed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Onaylandi</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Iptal</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Tamamlandi</span>;
      default:
        return null;
    }
  }

  function getVehicleLabel(type: string) {
    return VEHICLE_TYPES.find(v => v.value === type)?.label || type;
  }

  function openLightbox(photos: string[], index: number) {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxImage(photos[index]);
    setShowLightbox(true);
  }

  function navigateLightbox(direction: 'prev' | 'next') {
    const newIndex = direction === 'next'
      ? (lightboxIndex + 1) % lightboxPhotos.length
      : (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    setLightboxIndex(newIndex);
    setLightboxImage(lightboxPhotos[newIndex]);
  }

  function isReadyForTrip(request: TransferRequest): boolean {
    return request.status === 'confirmed' && !!request.assigned_plate && !!request.assigned_driver_name;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 rounded-xl">
                <Truck className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Transfer & Lojistik</h2>
                <p className="text-sm text-slate-500">Arac ve tasima talepleriniz</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Yeni Talep
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Henuz talep yok</p>
            <p className="text-sm text-slate-400 mt-1">Transfer veya lojistik talebi olusturun</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(request.status)}
                    <span className="text-sm font-medium text-slate-700">
                      {getVehicleLabel(request.vehicle_type)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(request.created_at).toLocaleDateString('tr-TR')}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span>{request.pickup_location}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                    <MapPin className="h-4 w-4 text-red-500" />
                    <span>{request.dropoff_location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(request.pickup_datetime).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {request.passenger_count > 1 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <Users className="h-4 w-4" />
                        <span>{request.passenger_count} kisi</span>
                      </>
                    )}
                  </div>
                </div>

                {request.status === 'offered' && request.offered_price && (
                  <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">Teklif Aldiniz!</span>
                    </div>

                    {request.proposal_photos && request.proposal_photos.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ImageIcon className="h-4 w-4 text-slate-500" />
                          <span className="text-xs font-medium text-slate-600">Arac Fotograflari</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {request.proposal_photos.map((photo, index) => (
                            <button
                              key={index}
                              onClick={() => openLightbox(request.proposal_photos!, index)}
                              className="relative group flex-shrink-0"
                            >
                              <img
                                src={photo}
                                alt={`Arac ${index + 1}`}
                                className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  console.error('Image load failed:', photo);
                                }}
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                <ZoomIn className="h-5 w-5 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-bold text-teal-700">
                        {request.offered_price.toLocaleString('tr-TR')} TL
                      </span>
                    </div>
                    {request.admin_notes && (
                      <p className="text-sm text-slate-600 mb-3 italic">"{request.admin_notes}"</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => startApprovalFlow(request)}
                        disabled={processing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Onayla
                      </button>
                      <button
                        onClick={() => openRejectModal(request)}
                        disabled={processing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        Reddet
                      </button>
                    </div>
                  </div>
                )}

                {isReadyForTrip(request) && (
                  <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-300 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 bg-emerald-500 rounded-lg">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-bold text-emerald-800 text-lg">Yolculuk Kartiniz Hazir!</span>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                      <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Arac Plakasi</p>
                      <p className="text-3xl font-black text-slate-900 tracking-wider">
                        {request.assigned_plate}
                      </p>
                      {request.vehicle_color && (
                        <p className="text-sm text-slate-500 mt-1">{request.vehicle_color} {getVehicleLabel(request.vehicle_type)}</p>
                      )}
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Sofor Bilgileri</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{request.assigned_driver_name}</p>
                            <p className="text-sm text-slate-500">{request.assigned_driver_phone}</p>
                          </div>
                        </div>
                        {request.assigned_driver_phone && (
                          <a
                            href={`tel:${request.assigned_driver_phone}`}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                            Ara
                          </a>
                        )}
                      </div>
                    </div>

                    {request.meeting_point_note && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                        <p className="text-xs text-amber-700 font-medium mb-1">Bulusma Noktasi</p>
                        <p className="text-sm text-amber-800">{request.meeting_point_note}</p>
                      </div>
                    )}

                    {request.proposal_photos && request.proposal_photos.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Arac Fotograflari</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {request.proposal_photos.map((photo, index) => (
                            <button
                              key={index}
                              onClick={() => openLightbox(request.proposal_photos!, index)}
                              className="relative group flex-shrink-0"
                            >
                              <img
                                src={photo}
                                alt={`Arac ${index + 1}`}
                                className="w-16 h-16 object-cover rounded-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  console.error('Image load failed:', photo);
                                }}
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                <ZoomIn className="h-4 w-4 text-white" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {passengersMap[request.id] && passengersMap[request.id].length > 0 ? (
                      <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
                        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Yolcu Listesi</p>
                        <div className="space-y-2 mb-3">
                          {passengersMap[request.id].map((p, i) => (
                            <div key={p.id || i} className="flex items-center gap-2 text-sm">
                              <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center text-xs font-bold text-teal-700">
                                {i + 1}
                              </div>
                              <span className="font-medium text-slate-800">{p.full_name}</span>
                              <span className="text-slate-400">
                                {p.tc_identity_number ? `TC: ***${p.tc_identity_number.slice(-4)}` : p.passport_number ? `Pass: ${p.passport_number}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => openEditPassengers(request)}
                          className="w-full p-2 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center justify-center gap-2 text-teal-700 text-sm font-medium"
                        >
                          <User className="h-4 w-4" />
                          Yolcu Bilgilerini Duzenle
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openEditPassengers(request)}
                        className="w-full mb-3 p-3 bg-white border-2 border-teal-200 rounded-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-2 text-teal-700 font-medium"
                      >
                        <User className="h-5 w-5" />
                        Yolcu Bilgilerini Ekle
                      </button>
                    )}

                    <div className="mt-4 pt-3 border-t border-emerald-200 flex items-center justify-between">
                      <span className="text-sm text-emerald-700">Toplam Ucret</span>
                      <span className="text-xl font-bold text-emerald-800">
                        {request.offered_price?.toLocaleString('tr-TR')} TL
                      </span>
                    </div>
                  </div>
                )}

                {request.status === 'confirmed' && !isReadyForTrip(request) && request.offered_price && (
                  <div className="mt-3 space-y-2">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="font-medium text-green-800">Onaylandi - Operasyon Hazirlaniyor</span>
                        <span className="text-green-700 font-bold ml-auto">
                          {request.offered_price.toLocaleString('tr-TR')} TL
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-1 ml-7">
                        Sofor ve arac atamaniz yapilinca bilgilendirileceksiniz.
                      </p>
                    </div>
                    <button
                      onClick={() => openEditPassengers(request)}
                      className="w-full p-3 bg-white border-2 border-teal-200 rounded-xl hover:bg-teal-50 transition-colors flex items-center justify-center gap-2 text-teal-700 font-medium"
                    >
                      <User className="h-5 w-5" />
                      Yolcu Bilgilerini Duzenle
                    </button>
                  </div>
                )}

                {request.status === 'cancelled' && request.rejection_reason && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Red sebebi:</span> {request.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-teal-700">
              <h3 className="text-lg font-semibold text-white">Yeni Transfer Talebi</h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arac Tipi *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VEHICLE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, vehicle_type: type.value })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        formData.vehicle_type === type.value
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1.5 ${type.color} rounded-lg`}>
                          <type.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-medium text-sm text-slate-800">{type.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 pl-8">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {formData.vehicle_type !== 'truck' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Yolcu Sayisi
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.passenger_count}
                    onChange={(e) => setFormData({ ...formData, passenger_count: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Alis Noktasi *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                  <input
                    type="text"
                    value={formData.pickup_location}
                    onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                    placeholder="Nereden alinacak?"
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Varis Noktasi *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                  <input
                    type="text"
                    value={formData.dropoff_location}
                    onChange={(e) => setFormData({ ...formData, dropoff_location: e.target.value })}
                    placeholder="Nereye birakilacak?"
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Tarih *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="date"
                      value={formData.pickup_date}
                      onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Saat *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="time"
                      value={formData.pickup_time}
                      onChange={(e) => setFormData({ ...formData, pickup_time: e.target.value })}
                      className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notlar (Opsiyonel)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Ek bilgi veya ozel istekleriniz..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </form>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                >
                  Iptal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Talep Olustur
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPassengerModal && passengerFormRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-teal-700">
              <div>
                <h3 className="text-lg font-semibold text-white">Yolcu Bilgileri</h3>
                <p className="text-sm text-teal-100">{passengerFormRequest.passenger_count} yolcu icin bilgi girin</p>
              </div>
              <button
                onClick={() => {
                  setShowPassengerModal(false);
                  setPassengerFormRequest(null);
                  setPassengers([]);
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Esnek Bilgi Girisi</p>
                  <p className="text-xs text-blue-600">Yolcu bilgilerini su an girebilir veya daha sonra tamamlayabilirsiniz.</p>
                </div>
              </div>

              {passengers.map((passenger, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium text-slate-700">Yolcu {index + 1}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => togglePassengerType(index)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          !passenger.is_foreign
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        TC Vatandasi
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePassengerType(index)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          passenger.is_foreign
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        Yabanci
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Ad Soyad
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={passenger.full_name}
                          onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                          placeholder={passenger.is_foreign ? "e.g. John Smith" : "Ornek: Ahmet Yilmaz"}
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                    {!passenger.is_foreign ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          TC Kimlik Numarasi
                        </label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={passenger.tc_identity_number}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                              updatePassenger(index, 'tc_identity_number', val);
                            }}
                            placeholder="11 haneli TC Kimlik"
                            maxLength={11}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        {passenger.tc_identity_number && passenger.tc_identity_number.length !== 11 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {11 - passenger.tc_identity_number.length} hane daha gerekiyor
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Passport Number
                        </label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <input
                            type="text"
                            value={passenger.passport_number || ''}
                            onChange={(e) => updatePassenger(index, 'passport_number', e.target.value)}
                            placeholder="e.g. P1234567"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmitPassengers(true)}
                  disabled={savingPassengers}
                  className="flex-1 px-3 py-2.5 border border-amber-400 text-amber-700 bg-amber-50 rounded-xl font-medium hover:bg-amber-100 transition-colors disabled:opacity-50 text-sm"
                >
                  Simdilik Atla
                </button>
                <button
                  onClick={() => handleSubmitPassengers(false)}
                  disabled={savingPassengers}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {savingPassengers ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Kaydet
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPassengerModal(false);
                  setPassengerFormRequest(null);
                  setPassengers([]);
                }}
                className="w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Iptal
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-red-600 to-red-700">
              <h3 className="text-lg font-semibold text-white">Teklifi Reddet</h3>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">{selectedRequest.pickup_location}</span>
                  <ChevronRight className="h-4 w-4 inline mx-1 text-slate-400" />
                  <span className="font-medium">{selectedRequest.dropoff_location}</span>
                </p>
                {selectedRequest.offered_price && (
                  <p className="text-lg font-bold text-teal-700 mt-1">
                    {selectedRequest.offered_price.toLocaleString('tr-TR')} TL
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Red Sebebi (Opsiyonel)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Neden bu teklifi reddettiginizi yazabilirsiniz..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                >
                  Vazgec
                </button>
                <button
                  onClick={handleRejectOffer}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {processing ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <X className="h-5 w-5" />
                      Reddet
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLightbox && lightboxPhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setShowLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
            onClick={() => setShowLightbox(false)}
          >
            <X className="h-8 w-8" />
          </button>

          {lightboxPhotos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
              >
                <ChevronRight className="h-6 w-6 rotate-180" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <img
            src={lightboxImage}
            alt="Arac fotografı"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxPhotos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {lightboxPhotos.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(index);
                    setLightboxImage(lightboxPhotos[index]);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === lightboxIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
