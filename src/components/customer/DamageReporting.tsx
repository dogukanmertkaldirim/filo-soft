import { useState } from 'react';
import { AlertOctagon, Camera, X, Send, Check, Car, Wrench, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}

interface Props {
  userId: string;
  vehicles: Vehicle[];
  companyId: string;
  onClose?: () => void;
}

export default function DamageReporting({ userId, vehicles, companyId, onClose }: Props) {
  const [incidentType, setIncidentType] = useState<'accident' | 'breakdown' | 'damage' | ''>('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    const uploadedUrls: string[] = [];
    let failedCount = 0;

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `damage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `damage-reports/${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        failedCount++;
      } else {
        const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
    }

    if (failedCount > 0) {
      setError(`${failedCount} fotograf yuklenemedi. Lutfen tekrar deneyin.`);
    }

    setPhotos([...photos, ...uploadedUrls]);
    setUploading(false);
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!incidentType || !selectedVehicle || !description) return;

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('damage_reports').insert({
      company_id: companyId,
      customer_id: userId,
      vehicle_id: selectedVehicle,
      incident_type: incidentType,
      description,
      photo_urls: photos,
      urgency,
    });

    if (insertError) {
      console.error('Submit error:', insertError);
      setError('Bildirim gonderilemedi. Lutfen tekrar deneyin.');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 2000);
    setSubmitting(false);
  }

  function getIncidentIcon(type: string) {
    switch (type) {
      case 'accident':
        return <Car className="h-5 w-5" />;
      case 'breakdown':
        return <Wrench className="h-5 w-5" />;
      case 'damage':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <AlertOctagon className="h-5 w-5" />;
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Bildirim Alindi!</h3>
        <p className="text-slate-600">En kisa surede sizinle iletisime gececegiz.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertOctagon className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hasar / Ariza Bildirimi</h2>
            <p className="text-sm text-slate-500">Sorun yasadiginizda bize bildirin</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Olay Turu</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'accident', label: 'Kaza', icon: Car, color: 'red' },
              { value: 'breakdown', label: 'Ariza', icon: Wrench, color: 'amber' },
              { value: 'damage', label: 'Hasar', icon: AlertTriangle, color: 'orange' },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setIncidentType(type.value as typeof incidentType)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  incidentType === type.value
                    ? type.color === 'red'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : type.color === 'amber'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <type.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Arac</label>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
          <label className="block text-sm font-medium text-slate-700 mb-2">Aciliyet</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: 'low', label: 'Dusuk', color: 'slate' },
              { value: 'medium', label: 'Orta', color: 'blue' },
              { value: 'high', label: 'Yuksek', color: 'amber' },
              { value: 'critical', label: 'Kritik', color: 'red' },
            ].map((u) => (
              <button
                key={u.value}
                type="button"
                onClick={() => setUrgency(u.value as typeof urgency)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                  urgency === u.value
                    ? u.color === 'slate'
                      ? 'border-slate-500 bg-slate-100 text-slate-700'
                      : u.color === 'blue'
                        ? 'border-blue-500 bg-blue-100 text-blue-700'
                        : u.color === 'amber'
                          ? 'border-amber-500 bg-amber-100 text-amber-700'
                          : 'border-red-500 bg-red-100 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Aciklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Olayi detayli sekilde aciklayin..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Fotograflar</label>

          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {photos.map((url, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={url}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-red-500 transition-colors">
            <Camera className="h-6 w-6 text-slate-400 mb-1" />
            <span className="text-xs text-slate-500">
              {uploading ? 'Yukleniyor...' : 'Fotograf Ekle'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !incidentType || !selectedVehicle || !description}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Gonderiliyor...' : 'Bildirimi Gonder'}
        </button>
      </form>
    </div>
  );
}
