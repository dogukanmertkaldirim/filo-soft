import { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, LogOut, Clock, MapPin, CheckCircle, Truck, Wrench,
  ClipboardCheck, ArrowRight, Fuel, Droplets, AlertTriangle,
  PenTool, ChevronRight, Car, Gauge
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import CarDamageSchema from '../components/vehicle/CarDamageSchema';

interface OperationalTask {
  id: string;
  vehicle_id: string | null;
  task_type: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  vehicles?: { id: string; plate: string; brand: string; model: string; year: number; current_km: number | null } | null;
}

const TASK_TYPE_META: Record<string, { label: string; color: string; icon: typeof Truck }> = {
  'teslim_alma': { label: 'Teslim Alma', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: ClipboardCheck },
  'lastik_degisimi': { label: 'Lastik Degisimi', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Wrench },
  'muayene': { label: 'Muayeneye Gotur', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: ClipboardCheck },
  'lastik_teslimat': { label: 'Lastikten Musteriye Teslimat', color: 'bg-teal-100 text-teal-700 border-teal-200', icon: Truck },
  'yeni_lastik': { label: 'Yeni Lastik Alimi', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Wrench },
  'tuvturk': { label: 'TUVTURK Randevusu', color: 'bg-sky-100 text-sky-700 border-sky-200', icon: ClipboardCheck },
  'diger': { label: 'Diger', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Truck },
};

const STATUS_FLOW = ['pending', 'en_route', 'in_progress', 'completed'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  en_route: 'Yolda',
  in_progress: 'Islem Yapiliyor',
  completed: 'Tamamlandi',
};

export default function EmployeeDriverPortal() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showHandover, setShowHandover] = useState(false);
  const [activeTask, setActiveTask] = useState<OperationalTask | null>(null);
  const [tab, setTab] = useState<'active' | 'completed'>('active');

  useEffect(() => {
    loadTasks();
  }, [user]);

  async function loadTasks() {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('operational_tasks')
      .select('*, vehicles(id, plate, brand, model, year, current_km)')
      .eq('assigned_driver_id', user.id)
      .order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  }

  async function advanceStatus(task: OperationalTask) {
    const idx = STATUS_FLOW.indexOf(task.status as any);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[idx + 1];

    if (nextStatus === 'completed' && task.task_type === 'teslim_alma') {
      setActiveTask(task);
      setShowHandover(true);
      return;
    }

    setUpdating(task.id);
    const updateData: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === 'en_route') updateData.started_at = new Date().toISOString();
    if (nextStatus === 'completed') updateData.completed_at = new Date().toISOString();

    await supabase.from('operational_tasks').update(updateData).eq('id', task.id);

    if (nextStatus === 'completed') {
      await supabase.from('activity_logs').insert({
        company_id: user?.company_id,
        action: 'task_completed',
        details: `${user?.full_name}, ${task.vehicles?.plate} plakali arac icin "${getTaskLabel(task.task_type)}" gorevini tamamladi.`,
      });
    }

    await loadTasks();
    setUpdating(null);
  }

  function getTaskLabel(type: string) {
    return TASK_TYPE_META[type]?.label || type;
  }

  function getNextActionLabel(status: string) {
    switch (status) {
      case 'pending': return 'Yola Ciktim';
      case 'en_route': return 'Isleme Basladim';
      case 'in_progress': return 'Gorevi Tamamla';
      default: return '';
    }
  }

  function getNextActionColor(status: string) {
    switch (status) {
      case 'pending': return 'bg-blue-600 hover:bg-blue-700';
      case 'en_route': return 'bg-amber-600 hover:bg-amber-700';
      case 'in_progress': return 'bg-green-600 hover:bg-green-700';
      default: return 'bg-slate-600';
    }
  }

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold">{user?.full_name}</h1>
              <p className="text-xs text-slate-300">Saha Operasyon Paneli</p>
            </div>
          </div>
          <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Tab Toggle */}
        <div className="flex bg-white rounded-xl border border-slate-200 p-1">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'active' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aktif Gorevlerim ({activeTasks.length})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'completed' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tamamlanan ({completedTasks.length})
          </button>
        </div>

        {tab === 'active' && (
          <>
            {activeTasks.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <h3 className="font-semibold text-slate-800 mb-1">Tum gorevler tamamlandi</h3>
                <p className="text-sm text-slate-500">Aktif gorev bulunmuyor</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeTasks.map(task => {
                  const meta = TASK_TYPE_META[task.task_type] || TASK_TYPE_META['diger'];
                  const Icon = meta.icon;
                  return (
                    <div key={task.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${meta.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                                {meta.label}
                              </span>
                              {task.priority === 'urgent' && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Acil</span>
                              )}
                            </div>
                            {task.vehicles && (
                              <p className="text-sm font-bold text-slate-900 mt-1">
                                {task.vehicles.plate} - {task.vehicles.brand} {task.vehicles.model}
                              </p>
                            )}
                            {task.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Status Steps */}
                        <div className="flex items-center gap-1 mt-4 mb-3">
                          {STATUS_FLOW.map((s, i) => (
                            <div key={s} className="flex items-center flex-1">
                              <div className={`h-1.5 flex-1 rounded-full transition-all ${
                                STATUS_FLOW.indexOf(task.status as any) >= i
                                  ? 'bg-teal-500'
                                  : 'bg-slate-200'
                              }`} />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          Durum: <span className="font-medium text-slate-700">{STATUS_LABELS[task.status] || task.status}</span>
                        </p>

                        {task.status !== 'completed' && (
                          <button
                            onClick={() => advanceStatus(task)}
                            disabled={updating === task.id}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-medium text-sm transition-all ${getNextActionColor(task.status)} disabled:opacity-50`}
                          >
                            {updating === task.id ? (
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <ArrowRight className="h-4 w-4" />
                                {getNextActionLabel(task.status)}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'completed' && (
          <div className="space-y-3">
            {completedTasks.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Henuz tamamlanan gorev yok</p>
              </div>
            ) : (
              completedTasks.map(task => {
                const meta = TASK_TYPE_META[task.task_type] || TASK_TYPE_META['diger'];
                return (
                  <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4 opacity-80">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{meta.label}</p>
                        <p className="text-xs text-slate-500">
                          {task.vehicles?.plate} {task.completed_at && `- ${new Date(task.completed_at).toLocaleDateString('tr-TR')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Handover Wizard */}
      {activeTask && (
        <HandoverWizard
          isOpen={showHandover}
          task={activeTask}
          onClose={() => { setShowHandover(false); setActiveTask(null); }}
          onComplete={async () => {
            setShowHandover(false);
            setActiveTask(null);
            await loadTasks();
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// HANDOVER WIZARD COMPONENT
// ==========================================

interface HandoverWizardProps {
  isOpen: boolean;
  task: OperationalTask;
  onClose: () => void;
  onComplete: () => void;
}

function HandoverWizard({ isOpen, task, onClose, onComplete }: HandoverWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form data
  const [km, setKm] = useState('');
  const [fuelLevel, setFuelLevel] = useState<string>('');
  const [cleanliness, setCleanliness] = useState<string>('');
  const [damageSchema, setDamageSchema] = useState<Record<string, string>>({});
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const steps = ['KM & Yakit', 'Temizlik & Hasar', 'Dijital Imza'];

  function canNext(): boolean {
    switch (step) {
      case 0: return !!km && !!fuelLevel;
      case 1: return !!cleanliness;
      case 2: return !!signatureDataUrl;
      default: return false;
    }
  }

  async function handleSubmit() {
    if (!signatureDataUrl) return;
    setSaving(true);

    // Upload signature
    let sigUrl: string | null = null;
    try {
      const blob = await (await fetch(signatureDataUrl)).blob();
      const path = `signatures/${user?.company_id}/${task.id}_${Date.now()}.png`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'image/png' });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        sigUrl = urlData.publicUrl;
      }
    } catch {
      // Signature upload failed, continue with data URL reference
    }

    const handoverData = {
      km: parseInt(km),
      fuel_level: fuelLevel,
      cleanliness,
      damage_schema: damageSchema,
      submitted_at: new Date().toISOString(),
      submitted_by: user?.full_name,
    };

    // Update task
    await supabase.from('operational_tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      handover_data: handoverData,
      signature_url: sigUrl,
    }).eq('id', task.id);

    // Update vehicle with fresh data
    if (task.vehicle_id) {
      const vehicleUpdate: Record<string, unknown> = {
        current_km: parseInt(km),
      };
      if (Object.keys(damageSchema).length > 0) {
        vehicleUpdate.damage_schema = damageSchema;
      }
      await supabase.from('vehicles').update(vehicleUpdate).eq('id', task.vehicle_id);
    }

    // Activity log
    await supabase.from('activity_logs').insert({
      company_id: user?.company_id,
      action: 'vehicle_handover',
      details: `${user?.full_name}, ${task.vehicles?.plate} plakali araci kiracidan teslim aldi. KM: ${km}, Yakit: ${fuelLevel}`,
    });

    setSaving(false);
    onComplete();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Arac Teslim Alma Tutanagi" size="lg">
      <div className="space-y-4">
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-all ${
                i === step ? 'bg-teal-600 text-white' : i < step ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-teal-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center font-medium">{steps[step]}</p>

        {/* Vehicle Info */}
        {task.vehicles && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <Car className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-bold text-slate-900">{task.vehicles.plate}</p>
              <p className="text-xs text-slate-500">{task.vehicles.brand} {task.vehicles.model} ({task.vehicles.year})</p>
            </div>
          </div>
        )}

        {/* Step 0: KM & Fuel */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Gauge className="inline h-4 w-4 mr-1" />
                Kilometre Bilgisi *
              </label>
              {task.vehicles?.current_km && (
                <p className="text-xs text-slate-500 mb-2">Sistemdeki son KM: {task.vehicles.current_km.toLocaleString()}</p>
              )}
              <input
                type="number"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="Guncel km degerini girin"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Fuel className="inline h-4 w-4 mr-1" />
                Yakit Durumu *
              </label>
              <div className="grid grid-cols-5 gap-2">
                {['empty', '1/4', '1/2', '3/4', 'full'].map(level => {
                  const labels: Record<string, string> = { empty: 'Bos', '1/4': '1/4', '1/2': '1/2', '3/4': '3/4', full: 'Dolu' };
                  const fillPercent: Record<string, number> = { empty: 5, '1/4': 25, '1/2': 50, '3/4': 75, full: 100 };
                  const isSelected = fuelLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFuelLevel(level)}
                      className={`relative flex flex-col items-center p-2.5 rounded-xl border-2 text-xs font-medium transition-all overflow-hidden ${
                        isSelected ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-6 h-10 border border-slate-300 rounded-sm relative mb-1 overflow-hidden">
                        <div
                          className={`absolute bottom-0 left-0 right-0 transition-all ${isSelected ? 'bg-teal-400' : 'bg-slate-200'}`}
                          style={{ height: `${fillPercent[level]}%` }}
                        />
                      </div>
                      {labels[level]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Cleanliness & Damage */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Droplets className="inline h-4 w-4 mr-1" />
                Temizlik Durumu *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'clean', label: 'Temiz', color: 'border-green-500 bg-green-50 text-green-700' },
                  { value: 'dirty', label: 'Kirli', color: 'border-amber-500 bg-amber-50 text-amber-700' },
                  { value: 'needs_detail', label: 'Detayli Temizlik Gerekli', color: 'border-red-500 bg-red-50 text-red-700' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCleanliness(opt.value)}
                    className={`p-3 rounded-xl border-2 text-xs font-medium text-center transition-all ${
                      cleanliness === opt.value ? opt.color : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                Hasar Durumu
              </label>
              <p className="text-xs text-slate-500 mb-3">Araci inceleyin ve varsa hasar noktalarina dokunun</p>
              <CarDamageSchema value={damageSchema} onChange={setDamageSchema} />
            </div>
          </div>
        )}

        {/* Step 2: Signature */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs text-blue-700">
                <PenTool className="inline h-3.5 w-3.5 mr-1" />
                Teslim eden yetkilinin parmagi ile asagidaki alana imza atmasini saglayiniz.
              </p>
            </div>
            <SignaturePad
              onSignature={(dataUrl) => setSignatureDataUrl(dataUrl)}
              signatureDataUrl={signatureDataUrl}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
              Geri
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="flex-1"
            >
              Devam <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canNext() || saving}
              loading={saving}
              className="flex-1 !bg-green-600 hover:!bg-green-700"
            >
              Teslim Tutanagini Kaydet
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// SIGNATURE PAD COMPONENT
// ==========================================

interface SignaturePadProps {
  onSignature: (dataUrl: string | null) => void;
  signatureDataUrl: string | null;
}

function SignaturePad({ onSignature, signatureDataUrl }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCoords = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }, []);

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [getCoords]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [isDrawing, getCoords]);

  const endDraw = useCallback(() => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      onSignature(canvas.toDataURL('image/png'));
    }
  }, [hasDrawn, onSignature]);

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    onSignature(null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Teslim Eden Yetkili Imzasi *</label>
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={340}
          height={180}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-slate-400">Buraya imza atiniz</p>
          </div>
        )}
      </div>
      {hasDrawn && (
        <button
          type="button"
          onClick={clearSignature}
          className="text-xs text-red-600 hover:text-red-700 font-medium"
        >
          Imzayi Temizle
        </button>
      )}
    </div>
  );
}
