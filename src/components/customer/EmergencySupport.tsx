import { useState } from 'react';
import { AlertTriangle, Phone, Camera, X, Send, Check, Car, Shield } from 'lucide-react';
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
  supportPhone?: string;
}

export default function EmergencySupport({ userId, vehicles, companyId, supportPhone = '+90 555 123 4567' }: Props) {
  const [showAccidentForm, setShowAccidentForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [accidentDescription, setAccidentDescription] = useState('');
  const [accidentPhotos, setAccidentPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `accident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `customer-uploads/${companyId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (!uploadError) {
        const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
    }

    setAccidentPhotos([...accidentPhotos, ...uploadedUrls]);
    setUploading(false);
  }

  function removePhoto(index: number) {
    setAccidentPhotos(accidentPhotos.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicle) return;

    setSubmitting(true);

    const { error } = await supabase.from('customer_requests').insert({
      company_id: companyId,
      user_id: userId,
      vehicle_id: selectedVehicle,
      request_type: 'accident_report',
      data: {
        description: accidentDescription,
        photos: accidentPhotos,
        reported_at: new Date().toISOString(),
      },
    });

    if (!error) {
      setSuccess(true);
      setTimeout(() => {
        setShowAccidentForm(false);
        setSelectedVehicle('');
        setAccidentDescription('');
        setAccidentPhotos([]);
        setSuccess(false);
      }, 2000);
    }
    setSubmitting(false);
  }

  return (
    <>
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4 sm:p-6 shadow-lg text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Acil Durum & Destek</h2>
            <p className="text-sm text-red-100">7/24 Yardim Hatti</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${supportPhone.replace(/\s/g, '')}`}
            className="flex flex-col items-center gap-2 p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
          >
            <div className="p-3 bg-white/20 rounded-full">
              <Phone className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">Destek Ara</span>
            <span className="text-xs text-red-100">{supportPhone}</span>
          </a>

          <button
            onClick={() => setShowAccidentForm(true)}
            className="flex flex-col items-center gap-2 p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
          >
            <div className="p-3 bg-white/20 rounded-full">
              <Car className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">Kaza Bildir</span>
            <span className="text-xs text-red-100">Fotograf Yukle</span>
          </button>
        </div>

        <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4" />
            <span>Kasko & Sigorta bilgileriniz Dijital Torpido'da</span>
          </div>
        </div>
      </div>

      {showAccidentForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Kaza Bildirimi</h3>
              </div>
              <button
                onClick={() => setShowAccidentForm(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {success ? (
              <div className="p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">Bildirim Alindi!</h4>
                <p className="text-slate-600">En kisa surede sizinle iletisime gececegiz.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800">
                      <strong>Onemli:</strong> Herhangi bir yaralanma varsa once 112'yi arayin!
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Arac Secin</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-2">Aciklama</label>
                    <textarea
                      value={accidentDescription}
                      onChange={(e) => setAccidentDescription(e.target.value)}
                      placeholder="Kazayi kisaca aciklayin..."
                      rows={3}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fotograflar</label>

                    {accidentPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {accidentPhotos.map((url, index) => (
                          <div key={index} className="relative aspect-square">
                            <img
                              src={url}
                              alt={`Kaza ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-red-500 transition-colors">
                      <Camera className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-sm text-slate-600">
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
                    <p className="text-xs text-slate-500 mt-2">
                      Hasarli bolgelerin, kaza yerinin ve karsi aracin fotograflarini cekmeniz onerilir.
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                  <button
                    type="submit"
                    disabled={submitting || !selectedVehicle}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Gonderiliyor...' : 'Kaza Bildir'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
