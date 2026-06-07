import { useState, useEffect, useRef } from 'react';
import { Plus, CheckCircle, Clock, AlertTriangle, FileText, Upload, Car, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/format';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import CurrencyInput from '../ui/CurrencyInput';

interface TrafficFine {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  fine_number: string | null;
  amount: number;
  fine_date: string;
  fine_document_url: string | null;
  payment_receipt_url: string | null;
  status: string;
  description: string | null;
  vehicles?: { plate: string; brand: string; model: string };
  driver_name?: string;
}

interface DriverOption {
  id: string;
  full_name: string;
}

interface Props {
  vehicleIds: string[];
  companyId: string;
}

export default function TrafficFines({ vehicleIds, companyId }: Props) {
  const { user } = useAuth();
  const [fines, setFines] = useState<TrafficFine[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; brand: string; model: string }[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formVehicleId, setFormVehicleId] = useState('');
  const [formDriverId, setFormDriverId] = useState('');
  const [formAmount, setFormAmount] = useState(0);
  const [formFineDate, setFormFineDate] = useState(new Date().toISOString().split('T')[0]);
  const [formFineNumber, setFormFineNumber] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fineDocFile, setFineDocFile] = useState<File | null>(null);
  const [fineDocPreview, setFineDocPreview] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const fineDocRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);

    const [finesRes, vehiclesRes, driversRes] = await Promise.all([
      supabase
        .from('traffic_fines')
        .select('*, vehicles(plate, brand, model)')
        .eq('company_id', companyId)
        .eq('tenant_id', user?.id)
        .order('fine_date', { ascending: false }),
      supabase
        .from('vehicles')
        .select('id, plate, brand, model')
        .eq('company_id', companyId)
        .in('id', vehicleIds.length > 0 ? vehicleIds : ['none']),
      supabase
        .from('customer_drivers')
        .select('id, full_name')
        .eq('customer_id', user?.id)
        .eq('status', 'active'),
    ]);

    setFines(finesRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setDrivers(driversRes.data || []);
    setLoading(false);
  }

  async function uploadFile(file: File, folder: string): Promise<string | null> {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${companyId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type });
    if (error) return null;
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!formVehicleId || !formAmount || !formFineDate) {
      alert('Arac, tutar ve tarih zorunludur');
      return;
    }
    setSaving(true);

    let fineDocUrl: string | null = null;
    let receiptUrl: string | null = null;

    if (fineDocFile) {
      fineDocUrl = await uploadFile(fineDocFile, 'traffic-fines');
    }
    if (receiptFile) {
      receiptUrl = await uploadFile(receiptFile, 'traffic-fine-receipts');
    }

    const { error } = await supabase.from('traffic_fines').insert({
      company_id: companyId,
      vehicle_id: formVehicleId,
      tenant_id: user?.id,
      driver_id: formDriverId || null,
      fine_number: formFineNumber || null,
      amount: formAmount,
      fine_date: formFineDate,
      fine_document_url: fineDocUrl,
      payment_receipt_url: receiptUrl,
      status: receiptUrl ? 'paid' : 'pending',
      description: formDescription || null,
    });

    if (error) {
      alert('Kayit olusturulurken hata: ' + error.message);
    } else {
      resetForm();
      setShowForm(false);
      loadData();
    }
    setSaving(false);
  }

  function resetForm() {
    setFormVehicleId('');
    setFormDriverId('');
    setFormAmount(0);
    setFormFineDate(new Date().toISOString().split('T')[0]);
    setFormFineNumber('');
    setFormDescription('');
    setFineDocFile(null);
    setFineDocPreview(null);
    setReceiptFile(null);
    setReceiptPreview(null);
  }

  async function handleMarkPaid(id: string) {
    await supabase.from('traffic_fines').update({
      status: 'paid',
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadData();
  }

  function handleFileSelect(file: File | null, type: 'fine' | 'receipt') {
    if (!file) return;
    if (type === 'fine') {
      setFineDocFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setFineDocPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setFineDocPreview(file.name);
      }
    } else {
      setReceiptFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setReceiptPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setReceiptPreview(file.name);
      }
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" /> Odendi
          </span>
        );
      case 'contested':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <AlertTriangle className="h-3 w-3" /> Itiraz
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Odenecek
          </span>
        );
    }
  };

  const totalPending = fines.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
  const totalPaid = fines.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-xs font-medium text-amber-700">Bekleyen</p>
          </div>
          <p className="text-lg font-bold text-amber-800">{formatCurrency(totalPending)} TL</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            <p className="text-xs font-medium text-green-700">Odenen</p>
          </div>
          <p className="text-lg font-bold text-green-800">{formatCurrency(totalPaid)} TL</p>
        </div>
      </div>

      {/* Add Button */}
      <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
        <Plus className="h-4 w-4 mr-1.5" /> Yeni Ceza Kaydi
      </Button>

      {/* Fines List */}
      {fines.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Henuz trafik cezasi kaydi yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fines.map(fine => (
            <div key={fine.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Car className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-900">
                      {fine.vehicles?.plate || '-'}
                    </span>
                    {statusBadge(fine.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-1">
                    <span>{formatDate(fine.fine_date)}</span>
                    {fine.fine_number && <span>No: {fine.fine_number}</span>}
                  </div>
                  {fine.description && (
                    <p className="text-xs text-slate-600 mt-1">{fine.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-700">{formatCurrency(fine.amount)} TL</p>
                  <div className="flex items-center gap-2 mt-2">
                    {fine.fine_document_url && (
                      <a
                        href={fine.fine_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <FileText className="h-3 w-3" /> Makbuz
                      </a>
                    )}
                    {fine.payment_receipt_url && (
                      <a
                        href={fine.payment_receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline flex items-center gap-0.5"
                      >
                        <FileText className="h-3 w-3" /> Dekont
                      </a>
                    )}
                  </div>
                  {fine.status === 'pending' && (
                    <button
                      onClick={() => handleMarkPaid(fine.id)}
                      className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 hover:bg-green-100"
                    >
                      Odendi Isaretle
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Fine Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Yeni Trafik Cezasi Kaydi">
        <div className="space-y-4">
          <Select
            label="Arac Secimi *"
            value={formVehicleId}
            onChange={(e) => setFormVehicleId(e.target.value)}
            options={[
              { value: '', label: 'Arac secin...' },
              ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))
            ]}
          />

          <Select
            label="Ilgili Surucu"
            value={formDriverId}
            onChange={(e) => setFormDriverId(e.target.value)}
            options={[
              { value: '', label: 'Surucu secin (opsiyonel)' },
              ...drivers.map(d => ({ value: d.id, label: d.full_name }))
            ]}
          />

          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              label="Ceza Tutari (TL) *"
              value={formAmount}
              onChange={(val) => setFormAmount(val)}
            />
            <Input
              label="Ceza Tarihi *"
              type="date"
              value={formFineDate}
              onChange={(e) => setFormFineDate(e.target.value)}
            />
          </div>

          <Input
            label="Ceza Numarasi"
            value={formFineNumber}
            onChange={(e) => setFormFineNumber(e.target.value)}
            placeholder="Makbuz uzerindeki numara"
          />

          <Input
            label="Aciklama"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Hiz ihlali, park cezasi vb."
          />

          {/* Fine Document Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ceza Makbuzu Yukle</label>
            <input
              ref={fineDocRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'fine')}
              className="hidden"
            />
            {fineDocPreview ? (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-slate-700 truncate flex-1">
                  {typeof fineDocPreview === 'string' && fineDocPreview.startsWith('data:') ? 'Gorsel secildi' : fineDocPreview}
                </span>
                <button onClick={() => { setFineDocFile(null); setFineDocPreview(null); }} className="text-xs text-red-500">Kaldir</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fineDocRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all"
              >
                <Upload className="h-5 w-5 text-slate-400" />
                <span className="text-sm text-slate-600">Dosya Sec</span>
              </button>
            )}
          </div>

          {/* Payment Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Odeme Dekontu Yukle (opsiyonel)</label>
            <input
              ref={receiptRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'receipt')}
              className="hidden"
            />
            {receiptPreview ? (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-xs text-slate-700 truncate flex-1">
                  {typeof receiptPreview === 'string' && receiptPreview.startsWith('data:') ? 'Gorsel secildi' : receiptPreview}
                </span>
                <button onClick={() => { setReceiptFile(null); setReceiptPreview(null); }} className="text-xs text-red-500">Kaldir</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => receiptRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-green-400 hover:bg-green-50/50 transition-all"
              >
                <Upload className="h-5 w-5 text-slate-400" />
                <span className="text-sm text-slate-600">Dekont Yukle</span>
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
