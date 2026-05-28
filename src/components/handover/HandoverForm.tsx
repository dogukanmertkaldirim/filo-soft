import { useState } from 'react';
import { X, Fuel, Gauge, Camera, FileText, CheckCircle, ChevronRight, ChevronLeft, Upload, Trash2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  rentalId: string;
  vehicleId: string;
  companyId: string;
  staffId: string;
  customerId?: string;
  type: 'delivery' | 'return';
  currentVehicleKm?: number;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'fuel_km' | 'photos' | 'notes' | 'confirm';

const STEPS: { id: Step; title: string; icon: React.ReactNode }[] = [
  { id: 'fuel_km', title: 'KM & Yakit', icon: <Gauge className="h-4 w-4" /> },
  { id: 'photos', title: 'Fotograflar', icon: <Camera className="h-4 w-4" /> },
  { id: 'notes', title: 'Notlar', icon: <FileText className="h-4 w-4" /> },
  { id: 'confirm', title: 'Onay', icon: <CheckCircle className="h-4 w-4" /> },
];

export default function HandoverForm({
  rentalId,
  vehicleId,
  companyId,
  staffId,
  customerId,
  type,
  currentVehicleKm,
  onClose,
  onSuccess
}: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('fuel_km');
  const [saving, setSaving] = useState(false);

  const [fuelLevel, setFuelLevel] = useState(100);
  const [currentKm, setCurrentKm] = useState(currentVehicleKm?.toString() || '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notes, setNotes] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  function goNext() {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }

  function goPrev() {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vehicleId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          setPhotos(prev => [...prev, urlData.publicUrl]);
        }
      }
    }

    setUploadingPhoto(false);
    e.target.value = '';
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!isConfirmed) return;

    setSaving(true);

    const { error } = await supabase.from('vehicle_handovers').insert({
      company_id: companyId,
      rental_id: rentalId,
      vehicle_id: vehicleId,
      type,
      fuel_level: fuelLevel,
      current_km: parseInt(currentKm) || 0,
      exterior_photos: photos,
      general_notes: notes || null,
      staff_id: staffId,
      customer_id: customerId || null,
      is_confirmed: true,
      confirmed_at: new Date().toISOString(),
      handover_date: new Date().toISOString()
    });

    if (!error) {
      if (currentKm) {
        await supabase
          .from('vehicles')
          .update({ current_km: parseInt(currentKm) })
          .eq('id', vehicleId);
      }
      onSuccess();
    }

    setSaving(false);
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 'fuel_km':
        return currentKm !== '' && parseInt(currentKm) >= 0;
      case 'photos':
        return true;
      case 'notes':
        return true;
      case 'confirm':
        return isConfirmed;
      default:
        return false;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              {type === 'delivery' ? 'Arac Teslim Tutanagi' : 'Arac Iade Tutanagi'}
            </h3>
            <p className="text-sm text-slate-500">Adim {currentStepIndex + 1} / {STEPS.length}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <div className="flex items-center gap-1">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex-1 flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                    idx < currentStepIndex
                      ? 'bg-teal-600 text-white'
                      : idx === currentStepIndex
                      ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 ${
                      idx < currentStepIndex ? 'bg-teal-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-slate-700 mt-3">
            {STEPS[currentStepIndex].title}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {currentStep === 'fuel_km' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-slate-500" />
                    Mevcut Kilometre
                  </div>
                </label>
                <input
                  type="number"
                  value={currentKm}
                  onChange={(e) => setCurrentKm(e.target.value)}
                  placeholder="Ornek: 45000"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {currentVehicleKm && (
                  <p className="text-xs text-slate-500 mt-1">
                    Son kayitli KM: {currentVehicleKm.toLocaleString('tr-TR')} km
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-slate-500" />
                    Yakit Seviyesi: %{fuelLevel}
                  </div>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(parseInt(e.target.value))}
                  className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-teal-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Bos</span>
                  <span>1/4</span>
                  <span>1/2</span>
                  <span>3/4</span>
                  <span>Dolu</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'photos' && (
            <div className="space-y-4">
              <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                  disabled={uploadingPhoto}
                />
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  {uploadingPhoto ? (
                    <div className="h-10 w-10 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
                  ) : (
                    <div className="p-3 bg-teal-100 rounded-full mb-2">
                      <Upload className="h-6 w-6 text-teal-600" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-slate-700">
                    {uploadingPhoto ? 'Yukleniyor...' : 'Fotograf Yukle'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Arac dis gorunumu icin birden fazla fotograf yukleyebilirsiniz
                  </p>
                </label>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={photo}
                        alt={`Fotograf ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length === 0 && (
                <p className="text-center text-sm text-slate-400">
                  Henuz fotograf yuklenmedi
                </p>
              )}
            </div>
          )}

          {currentStep === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    Hasar / Cizik / Notlar
                  </div>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mevcut hasarlar, cizikler veya dikkat edilmesi gereken noktalar..."
                  rows={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Arac uzerindeki mevcut hasarlari ve dikkat edilmesi gereken noktalari not edin
                </p>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && (
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h4 className="font-medium text-slate-900">Tutanak Ozeti</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-slate-500 text-xs">Kilometre</p>
                    <p className="font-semibold text-slate-900">
                      {parseInt(currentKm).toLocaleString('tr-TR')} km
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-slate-500 text-xs">Yakit</p>
                    <p className="font-semibold text-slate-900">%{fuelLevel}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-slate-500 text-xs">Fotograflar</p>
                    <p className="font-semibold text-slate-900">{photos.length} adet</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-slate-500 text-xs">Notlar</p>
                    <p className="font-semibold text-slate-900">
                      {notes ? 'Eklendi' : 'Yok'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-amber-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-amber-800">
                    Musteri, arac basindaki kontrolleri yapmis ve araci bu sekilde{' '}
                    {type === 'delivery' ? 'teslim almistir' : 'iade etmistir'}.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-3">
          {currentStepIndex > 0 && (
            <button
              onClick={goPrev}
              className="flex items-center justify-center gap-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Geri
            </button>
          )}

          {currentStep === 'confirm' ? (
            <button
              onClick={handleSubmit}
              disabled={!isConfirmed || saving}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white py-2.5 px-4 rounded-xl font-medium hover:from-teal-700 hover:to-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Teslimat Tamamla
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 flex items-center justify-center gap-1 bg-gradient-to-r from-teal-600 to-teal-700 text-white py-2.5 px-4 rounded-xl font-medium hover:from-teal-700 hover:to-teal-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Devam Et
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
