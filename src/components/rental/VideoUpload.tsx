import { useState, useRef } from 'react';
import { Video, X, AlertTriangle, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MAX_VIDEO_SIZE = 25 * 1024 * 1024;

interface VideoUploadProps {
  label?: string;
  videoUrl: string | null;
  onVideoChange: (url: string | null) => void;
  storagePath: string;
}

export default function VideoUpload({ label, videoUrl, onVideoChange, storagePath }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    if (file.size > MAX_VIDEO_SIZE) {
      setError('Video boyutu çok büyük! Lütfen en fazla 15 saniyelik (Maks 25MB) bir kanıt videosu yükleyin.');
      e.target.value = '';
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop() || 'mp4';
      const fileName = `${storagePath}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('rental-videos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('rental-videos')
        .getPublicUrl(fileName);

      onVideoChange(publicUrl);
    } catch (err: any) {
      console.error('Video upload error:', err.message);
      setError('Video yuklenirken bir hata olustu. Lutfen tekrar deneyin.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    if (!videoUrl) return;

    const path = videoUrl.split('/rental-videos/')[1];
    if (path) {
      await supabase.storage.from('rental-videos').remove([path]);
    }
    onVideoChange(null);
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          <Video className="h-4 w-4 inline mr-1" />
          {label}
        </label>
      )}
      <p className="text-xs text-slate-500 mb-3">
        Maksimum 15 saniye / 25 MB boyutunda video yükleyebilirsiniz.
      </p>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {videoUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-black">
          <video
            src={videoUrl}
            controls
            className="w-full max-h-48 object-contain"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 transition-colors">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/x-m4v,video/*"
            onChange={handleFileChange}
            className="hidden"
            id={`video-upload-${storagePath.replace(/[^a-z0-9]/gi, '-')}`}
          />
          <label
            htmlFor={`video-upload-${storagePath.replace(/[^a-z0-9]/gi, '-')}`}
            className="flex flex-col items-center justify-center cursor-pointer py-6"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-2" />
                <p className="text-sm text-slate-600">Video yükleniyor...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">Teslimat Videosu Ekle (Opsiyonel)</p>
                <p className="text-xs text-slate-400 mt-1">MP4, MOV, WebM</p>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
