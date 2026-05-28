import { useState, useEffect } from 'react';
import { CalendarPlus, Gauge, X, Check, Clock, Camera, Send, ChevronRight, Receipt, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  current_km: number | null;
}

interface Rental {
  id: string;
  vehicle_id: string;
  end_date: string;
  status: string;
}

interface Request {
  id: string;
  request_type: string;
  status: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface Props {
  userId: string;
  vehicleIds: string[];
  companyId: string;
}

export default function RequestCenter({ userId, vehicleIds, companyId }: Props) {
  const [activeTab, setActiveTab] = useState<'extend' | 'km' | 'receipt' | 'maintenance' | 'history'>('extend');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [extendNote, setExtendNote] = useState('');

  const [kmVehicle, setKmVehicle] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [kmPhotoUrl, setKmPhotoUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [receiptVehicle, setReceiptVehicle] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [receiptPhotoUrl, setReceiptPhotoUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [maintenanceVehicle, setMaintenanceVehicle] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceUrgency, setMaintenanceUrgency] = useState<'low' | 'medium' | 'high'>('medium');

  useEffect(() => {
    loadData();
  }, [vehicleIds, companyId]);

  async function loadData() {
    if (vehicleIds.length === 0) {
      setLoading(false);
      return;
    }

    const [vehiclesRes, rentalsRes, requestsRes] = await Promise.all([
      supabase
        .from('vehicles')
        .select('id, plate, brand, model, current_km')
        .in('id', vehicleIds)
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('rentals')
        .select('id, vehicle_id, end_date, status')
        .in('vehicle_id', vehicleIds)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .is('deleted_at', null),
      supabase
        .from('customer_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    setVehicles(vehiclesRes.data || []);
    setRentals(rentalsRes.data || []);
    setRequests(requestsRes.data || []);
    setLoading(false);
  }

  async function handleExtendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicle || !newEndDate) return;

    setSubmitting(true);
    const rental = rentals.find(r => r.vehicle_id === selectedVehicle);

    const { error } = await supabase.from('customer_requests').insert({
      company_id: companyId,
      user_id: userId,
      vehicle_id: selectedVehicle,
      rental_id: rental?.id || null,
      request_type: 'extend_rental',
      data: {
        requested_end_date: newEndDate,
        current_end_date: rental?.end_date,
        note: extendNote,
      },
    });

    if (!error) {
      setSuccess('Uzatma talebiniz iletildi!');
      setSelectedVehicle('');
      setNewEndDate('');
      setExtendNote('');
      loadData();
    }
    setSubmitting(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `km-${Date.now()}.${fileExt}`;
    const filePath = `customer-uploads/${companyId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (!uploadError) {
      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      setKmPhotoUrl(data.publicUrl);
    }
    setUploadingPhoto(false);
  }

  async function handleKmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kmVehicle || !currentKm) return;

    setSubmitting(true);
    const vehicle = vehicles.find(v => v.id === kmVehicle);

    const { error } = await supabase.from('customer_requests').insert({
      company_id: companyId,
      user_id: userId,
      vehicle_id: kmVehicle,
      request_type: 'km_report',
      data: {
        reported_km: parseInt(currentKm),
        previous_km: vehicle?.current_km,
        photo_url: kmPhotoUrl,
      },
    });

    if (!error) {
      await supabase
        .from('vehicles')
        .update({ current_km: parseInt(currentKm) })
        .eq('id', kmVehicle);

      setSuccess('KM bildiriminiz kaydedildi!');
      setKmVehicle('');
      setCurrentKm('');
      setKmPhotoUrl('');
      loadData();
    }
    setSubmitting(false);
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `receipt-${Date.now()}.${fileExt}`;
    const filePath = `customer-uploads/${companyId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (!uploadError) {
      const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
      setReceiptPhotoUrl(data.publicUrl);
    }
    setUploadingReceipt(false);
  }

  async function handleReceiptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receiptVehicle || !receiptAmount || !receiptPhotoUrl) return;

    setSubmitting(true);
    const rental = rentals.find(r => r.vehicle_id === receiptVehicle);

    const { error } = await supabase.from('customer_requests').insert({
      company_id: companyId,
      user_id: userId,
      vehicle_id: receiptVehicle,
      rental_id: rental?.id || null,
      request_type: 'payment_receipt',
      data: {
        amount: parseFloat(receiptAmount),
        description: receiptDescription,
        receipt_url: receiptPhotoUrl,
      },
    });

    if (!error) {
      setSuccess('Odeme belgesi gonderildi!');
      setReceiptVehicle('');
      setReceiptAmount('');
      setReceiptDescription('');
      setReceiptPhotoUrl('');
      loadData();
    }
    setSubmitting(false);
  }

  async function handleMaintenanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!maintenanceVehicle || !maintenanceType || !maintenanceDescription) return;

    setSubmitting(true);

    const { error } = await supabase.from('customer_requests').insert({
      company_id: companyId,
      user_id: userId,
      vehicle_id: maintenanceVehicle,
      request_type: 'maintenance_request',
      data: {
        maintenance_type: maintenanceType,
        description: maintenanceDescription,
        urgency: maintenanceUrgency,
      },
    });

    if (!error) {
      setSuccess('Bakim talebi iletildi!');
      setMaintenanceVehicle('');
      setMaintenanceType('');
      setMaintenanceDescription('');
      setMaintenanceUrgency('medium');
      loadData();
    }
    setSubmitting(false);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Bekliyor
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <Check className="h-3 w-3" /> Onaylandi
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <X className="h-3 w-3" /> Reddedildi
          </span>
        );
      default:
        return null;
    }
  }

  function getRequestTypeLabel(type: string) {
    switch (type) {
      case 'extend_rental':
        return 'Sure Uzatma';
      case 'km_report':
        return 'KM Bildirimi';
      case 'accident_report':
        return 'Kaza Bildirimi';
      case 'payment_receipt':
        return 'Odeme Belgesi';
      case 'maintenance_request':
        return 'Bakim Talebi';
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3"></div>
          <div className="h-32 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('extend')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'extend'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CalendarPlus className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">Sure Uzat</span>
        </button>
        <button
          onClick={() => setActiveTab('km')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'km'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Gauge className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">KM Bildir</span>
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'receipt'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Receipt className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">Odeme</span>
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'maintenance'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Wrench className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">Bakim</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="hidden sm:inline">Gecmis</span>
        </button>
      </div>

      <div className="p-4 sm:p-6">
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
            <Check className="h-5 w-5" />
            <span className="text-sm">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === 'extend' && (
          <form onSubmit={handleExtendSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Arac Secin</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Arac secin...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </div>

            {selectedVehicle && rentals.find(r => r.vehicle_id === selectedVehicle) && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm">
                <p className="text-slate-600">
                  Mevcut bitis:{' '}
                  <span className="font-medium text-slate-900">
                    {new Date(rentals.find(r => r.vehicle_id === selectedVehicle)!.end_date).toLocaleDateString('tr-TR')}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Yeni Bitis Tarihi</label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Not (Opsiyonel)</label>
              <textarea
                value={extendNote}
                onChange={(e) => setExtendNote(e.target.value)}
                placeholder="Uzatma talebiniz ile ilgili not ekleyin..."
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedVehicle || !newEndDate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Gonderiliyor...' : 'Talep Gonder'}
            </button>
          </form>
        )}

        {activeTab === 'km' && (
          <form onSubmit={handleKmSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Arac Secin</label>
              <select
                value={kmVehicle}
                onChange={(e) => setKmVehicle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Arac secin...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </div>

            {kmVehicle && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm">
                <p className="text-slate-600">
                  Son KM:{' '}
                  <span className="font-medium text-slate-900">
                    {vehicles.find(v => v.id === kmVehicle)?.current_km?.toLocaleString('tr-TR') || 'Bilinmiyor'} km
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Guncel KM</label>
              <input
                type="number"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                placeholder="Ornegin: 45000"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Gosterge Paneli Fotografi</label>
              {kmPhotoUrl ? (
                <div className="relative">
                  <img src={kmPhotoUrl} alt="KM" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setKmPhotoUrl('')}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 transition-colors">
                  <Camera className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">
                    {uploadingPhoto ? 'Yukleniyor...' : 'Fotograf Yukle'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !kmVehicle || !currentKm}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Kaydediliyor...' : 'KM Bildir'}
            </button>
          </form>
        )}

        {activeTab === 'receipt' && (
          <form onSubmit={handleReceiptSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Arac Secin</label>
              <select
                value={receiptVehicle}
                onChange={(e) => setReceiptVehicle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Arac secin...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Odeme Tutari (TL)</label>
              <input
                type="number"
                step="0.01"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                placeholder="Ornegin: 5000"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Aciklama</label>
              <textarea
                value={receiptDescription}
                onChange={(e) => setReceiptDescription(e.target.value)}
                placeholder="Odeme ile ilgili aciklama..."
                rows={2}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Dekont / Makbuz Fotografi *</label>
              {receiptPhotoUrl ? (
                <div className="relative">
                  <img src={receiptPhotoUrl} alt="Dekont" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setReceiptPhotoUrl('')}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 transition-colors">
                  <Receipt className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">
                    {uploadingReceipt ? 'Yukleniyor...' : 'Dekont Yukle'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleReceiptUpload}
                    className="hidden"
                    disabled={uploadingReceipt}
                  />
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !receiptVehicle || !receiptAmount || !receiptPhotoUrl}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Gonderiliyor...' : 'Odeme Belgesi Gonder'}
            </button>
          </form>
        )}

        {activeTab === 'maintenance' && (
          <form onSubmit={handleMaintenanceSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Arac Secin</label>
              <select
                value={maintenanceVehicle}
                onChange={(e) => setMaintenanceVehicle(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Arac secin...</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} - {v.brand} {v.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Bakim Turu</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Tur secin...</option>
                <option value="oil_change">Yag Degisimi</option>
                <option value="tire">Lastik</option>
                <option value="brake">Fren</option>
                <option value="ac">Klima</option>
                <option value="electrical">Elektrik</option>
                <option value="engine">Motor</option>
                <option value="other">Diger</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Acillik Durumu</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceUrgency('low')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    maintenanceUrgency === 'low'
                      ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Dusuk
                </button>
                <button
                  type="button"
                  onClick={() => setMaintenanceUrgency('medium')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    maintenanceUrgency === 'medium'
                      ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Orta
                </button>
                <button
                  type="button"
                  onClick={() => setMaintenanceUrgency('high')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    maintenanceUrgency === 'high'
                      ? 'bg-red-100 text-red-700 ring-2 ring-red-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Yuksek
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Aciklama</label>
              <textarea
                value={maintenanceDescription}
                onChange={(e) => setMaintenanceDescription(e.target.value)}
                placeholder="Sorunu veya bakim ihtiyacini detayli aciklayiniz..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !maintenanceVehicle || !maintenanceType || !maintenanceDescription}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Gonderiliyor...' : 'Bakim Talebi Gonder'}
            </button>
          </form>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Henuz talep yok</p>
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{getRequestTypeLabel(req.request_type)}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(req.created_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {getStatusBadge(req.status)}
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
