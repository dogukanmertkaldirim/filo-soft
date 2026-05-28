import { useState, useEffect } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Download } from 'lucide-react';

interface FileUploadProps {
  label?: string;
  accept?: string;
  value?: string | null;
  onChange: (base64: string | null) => void;
  error?: string;
  downloadFilename?: string;
}

export default function FileUpload({ label, accept = 'image/*,.pdf', value, onChange, error, downloadFilename = 'document' }: FileUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onChange(base64);
    };
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    setPreview(null);
    setFileName('');
    onChange(null);
  }

  const isImage = preview?.startsWith('data:image');
  const isPdf = preview?.startsWith('data:application/pdf');

  const getDownloadFilename = () => {
    if (isImage) {
      const match = preview?.match(/data:image\/(\w+)/);
      const ext = match ? match[1] : 'png';
      return `${downloadFilename}.${ext}`;
    }
    if (isPdf) return `${downloadFilename}.pdf`;
    return downloadFilename;
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      {!preview ? (
        <label className={`flex items-center justify-center w-full h-24 border-2 border-dashed
          border-slate-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors
          ${error ? 'border-red-500' : ''}`}>
          <div className="flex flex-col items-center text-slate-500">
            <Upload className="h-6 w-6 mb-1" />
            <span className="text-xs">Yuklemek icin tiklayin</span>
          </div>
          <input type="file" accept={accept} className="hidden" onChange={handleChange} />
        </label>
      ) : (
        <div className="relative border border-slate-200 rounded-lg p-2">
          <div className="flex items-center gap-2">
            {isImage ? (
              <img src={preview} alt="Preview" className="h-16 w-20 object-cover rounded flex-shrink-0" />
            ) : isPdf ? (
              <div className="h-16 w-20 bg-red-50 rounded flex items-center justify-center flex-shrink-0">
                <FileText className="h-8 w-8 text-red-500" />
              </div>
            ) : (
              <div className="h-16 w-20 bg-slate-50 rounded flex items-center justify-center flex-shrink-0">
                <ImageIcon className="h-8 w-8 text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm text-slate-600 truncate block">{fileName || (isPdf ? 'PDF Belge' : 'Dosya')}</span>
              <a
                href={preview}
                download={getDownloadFilename()}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-1"
              >
                <Download className="h-3 w-3" />
                Indir
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
