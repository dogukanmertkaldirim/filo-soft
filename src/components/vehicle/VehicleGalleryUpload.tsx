import { useState, useRef, useCallback } from 'react';
import { Camera, X, Star, Upload, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface VehicleGalleryUploadProps {
  galleryUrls: string[];
  coverUrl: string | null;
  plateNumber: string;
  onGalleryChange: (urls: string[]) => void;
  onCoverChange: (url: string | null) => void;
}

export default function VehicleGalleryUpload({
  galleryUrls,
  coverUrl,
  plateNumber,
  onGalleryChange,
  onCoverChange,
}: VehicleGalleryUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newUrls: string[] = [...galleryUrls];
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (!file.type.startsWith('image/')) continue;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const plate = plateNumber?.replace(/\s/g, '_') || 'unknown';
      const filePath = `${plate}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vehicle-photos')
        .upload(filePath, file);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('vehicle-photos')
          .getPublicUrl(filePath);
        newUrls.push(publicUrl);
      }
    }

    onGalleryChange(newUrls);

    if (!coverUrl && newUrls.length > 0) {
      onCoverChange(newUrls[0]);
    }

    setUploading(false);
  }, [galleryUrls, coverUrl, plateNumber, onGalleryChange, onCoverChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) uploadFiles(files);
    e.target.value = '';
  }, [uploadFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files) uploadFiles(files);
  }, [uploadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  function handleRemove(url: string) {
    const updated = galleryUrls.filter(u => u !== url);
    onGalleryChange(updated);
    if (coverUrl === url) {
      onCoverChange(updated.length > 0 ? updated[0] : null);
    }
  }

  function handleSetCover(url: string) {
    onCoverChange(url);
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        <Camera className="h-4 w-4 inline mr-1.5" />
        Arac Fotograflari
        {galleryUrls.length > 0 && (
          <span className="text-slate-400 font-normal ml-1">({galleryUrls.length} foto)</span>
        )}
      </label>

      {galleryUrls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
          {galleryUrls.map((url, idx) => {
            const isCover = url === coverUrl;
            return (
              <div
                key={idx}
                className={`relative group aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                  isCover
                    ? 'border-emerald-500 ring-2 ring-emerald-200 shadow-md'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {isCover && (
                  <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded shadow">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    Kapak
                  </div>
                )}

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1.5">
                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => handleSetCover(url)}
                        className="flex items-center gap-1 bg-white/90 backdrop-blur text-slate-800 text-xs font-medium px-2 py-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-700 transition-colors shadow"
                      >
                        <Star className="h-3 w-3" />
                        Kapak Yap
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(url)}
                      className="flex items-center justify-center bg-red-500/90 backdrop-blur text-white p-1.5 rounded-md hover:bg-red-600 transition-colors shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center w-full rounded-lg border-2 border-dashed cursor-pointer transition-all py-6 ${
          dragOver
            ? 'border-teal-500 bg-teal-50'
            : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 text-teal-600 animate-spin mb-2" />
            <p className="text-sm text-slate-600">Yukleniyor...</p>
          </>
        ) : galleryUrls.length === 0 ? (
          <>
            <div className="flex items-center justify-center w-12 h-12 bg-slate-100 rounded-full mb-2">
              <ImageIcon className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">Fotograf eklemek icin tiklayin veya surukleyin</p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP - Birden fazla fotograf secebilirsiniz</p>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-slate-400 mb-1" />
            <p className="text-sm text-slate-600">Daha fazla fotograf ekle</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {galleryUrls.length > 0 && !coverUrl && (
        <p className="text-xs text-amber-600 mt-2">
          Bir kapak fotografi secin (fotograf uzerine gelip "Kapak Yap" tiklayin).
        </p>
      )}
    </div>
  );
}
