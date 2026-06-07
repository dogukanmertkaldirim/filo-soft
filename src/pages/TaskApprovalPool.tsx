import { useState, useEffect } from 'react';
import { ClipboardCheck, Car, User, Clock, CheckCircle, AlertTriangle, ArrowRightLeft, FileText, Image as ImageIcon, Fuel, Gauge, Droplets, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface PendingTask {
  id: string;
  vehicle_id: string | null;
  task_type: string;
  description: string | null;
  status: string;
  created_at: string;
  submitted_data: Record<string, unknown> | null;
  handover_data: Record<string, unknown> | null;
  file_urls: string[];
  signature_url: string | null;
  assigned_driver_id: string;
  vehicles?: { id: string; plate: string; brand: string; model: string; year: number; current_km: number | null; inspection_expiry: string | null; tire_type: string | null; tire_brand: string | null; tire_size: string | null; damage_schema: Record<string, string> | null } | null;
  driver?: { full_name: string } | null;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  teslim_alma: 'Teslim Alma',
  lastik_degisimi: 'Lastik Degisimi',
  muayene: 'Muayeneye Gotur',
  lastik_teslimat: 'Lastikten Musteriye Teslimat',
  yeni_lastik: 'Yeni Lastik Alimi',
  tuvturk: 'TUVTURK Randevusu',
  diger: 'Diger',
};

export default function TaskApprovalPool() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<PendingTask | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (companyId) loadTasks();
  }, [companyId]);

  async function loadTasks() {
    setLoading(true);
    const { data } = await supabase
      .from('operational_tasks')
      .select('*, vehicles(id, plate, brand, model, year, current_km, inspection_expiry, tire_type, tire_brand, tire_size, damage_schema), driver:app_users!operational_tasks_assigned_driver_id_fkey(full_name)')
      .eq('company_id', companyId)
      .eq('status', 'pending_sync')
      .order('created_at', { ascending: false });
    setTasks((data || []) as PendingTask[]);
    setLoading(false);
  }

  async function handleSync(task: PendingTask) {
    if (!task.vehicle_id) return;
    setSyncing(true);

    const submitted = task.submitted_data || task.handover_data || {};
    const vehicleUpdate: Record<string, unknown> = {};

    // Teslim Alma: KM + damage
    if (task.task_type === 'teslim_alma') {
      if ((submitted as any).km) vehicleUpdate.current_km = (submitted as any).km;
      if ((submitted as any).damage_schema && Object.keys((submitted as any).damage_schema).length > 0) {
        vehicleUpdate.damage_schema = (submitted as any).damage_schema;
      }
    }

    // TUVTURK / Muayene: inspection date
    if (task.task_type === 'tuvturk' || task.task_type === 'muayene') {
      if ((submitted as any).inspection_date) {
        vehicleUpdate.inspection_expiry = (submitted as any).inspection_date;
      }
    }

    // Lastik: tire specs
    if (task.task_type === 'lastik_degisimi' || task.task_type === 'yeni_lastik') {
      const tire = (submitted as any).tire_info;
      if (tire) {
        if (tire.brand) vehicleUpdate.tire_brand = tire.brand;
        if (tire.size) vehicleUpdate.tire_size = tire.size;
        if (tire.type) vehicleUpdate.tire_type = tire.type;
      }
    }

    // Apply vehicle updates
    if (Object.keys(vehicleUpdate).length > 0) {
      await supabase.from('vehicles').update(vehicleUpdate).eq('id', task.vehicle_id);
    }

    // Mark task completed
    await supabase.from('operational_tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', task.id);

    // Activity log
    await supabase.from('activity_logs').insert({
      company_id: companyId,
      action: 'task_sync_approved',
      details: `${user?.full_name}, "${TASK_TYPE_LABELS[task.task_type]}" gorevini onayladi ve verileri ${task.vehicles?.plate} aracina aktardi.`,
    });

    setSelectedTask(null);
    setSyncing(false);
    loadTasks();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Saha Gorev Onay Havuzu</h1>
        <p className="text-sm text-slate-500">Saha personelinden gelen verileri inceleyin ve sisteme aktarin</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-medium text-amber-700">Onay Bekleyen</p>
          </div>
          <p className="text-2xl font-bold text-amber-800">{tasks.length}</p>
        </div>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">Tum gorevler onaylandi</h3>
          <p className="text-sm text-slate-500">Bekleyen veri aktarimi bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-300 transition-colors cursor-pointer"
              onClick={() => setSelectedTask(task)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900">
                        {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Onay Bekliyor
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {task.vehicles && (
                        <span className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          {task.vehicles.plate}
                        </span>
                      )}
                      {task.driver && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.driver.full_name}
                        </span>
                      )}
                      <span>{formatDate(task.created_at)}</span>
                    </div>
                  </div>
                </div>
                <ArrowRightLeft className="h-5 w-5 text-slate-400" />
              </div>
              {task.file_urls && task.file_urls.length > 0 && (
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {task.file_urls.length} dosya eklendi
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comparison Modal */}
      {selectedTask && (
        <ComparisonModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onSync={() => handleSync(selectedTask)}
          syncing={syncing}
        />
      )}
    </div>
  );
}

// ==========================================
// COMPARISON MODAL WITH RED HIGHLIGHTING
// ==========================================

interface ComparisonModalProps {
  task: PendingTask;
  isOpen: boolean;
  onClose: () => void;
  onSync: () => void;
  syncing: boolean;
}

function ComparisonModal({ task, isOpen, onClose, onSync, syncing }: ComparisonModalProps) {
  const submitted = task.submitted_data || task.handover_data || {};
  const vehicle = task.vehicles;

  function DiffRow({ label, icon, current, incoming }: { label: string; icon: React.ReactNode; current: string; incoming: string }) {
    const isDifferent = current !== incoming && incoming !== '' && incoming !== '-';
    return (
      <div className={`grid grid-cols-[1fr,1fr,1fr] gap-3 p-3 rounded-xl transition-all ${isDifferent ? 'bg-red-50 border border-red-300' : 'bg-slate-50 border border-slate-200'}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-slate-700">{label}</span>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-0.5">Mevcut</p>
          <p className="text-sm font-medium text-slate-700">{current || '-'}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-0.5">Yeni</p>
          <p className={`text-sm font-bold ${isDifferent ? 'text-red-700' : 'text-slate-700'}`}>{incoming || '-'}</p>
          {isDifferent && (
            <span className="inline-block mt-0.5 text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">DEGISIKLIK</span>
          )}
        </div>
      </div>
    );
  }

  const fuelLabels: Record<string, string> = { empty: 'Bos', '1/4': '1/4', '1/2': '1/2', '3/4': '3/4', full: 'Dolu' };
  const cleanLabels: Record<string, string> = { clean: 'Temiz', dirty: 'Kirli', needs_detail: 'Detayli Temizlik' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Veri Karsilastirma & Onay" size="xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Vehicle Header */}
        {vehicle && (
          <div className="flex items-center gap-3 p-3 bg-slate-800 text-white rounded-xl">
            <Car className="h-5 w-5" />
            <div>
              <p className="text-sm font-bold">{vehicle.plate}</p>
              <p className="text-xs text-slate-300">{vehicle.brand} {vehicle.model} ({vehicle.year})</p>
            </div>
          </div>
        )}

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Kirmizi ile isaretlenen alanlar soforun gonderdigi guncel verilerdir. "Verileri Aktar" butonuna basarak sistemi guncelleyebilirsiniz.
          </p>
        </div>

        {/* Teslim Alma comparison */}
        {task.task_type === 'teslim_alma' && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Teslim Alma Verileri</h4>
            <DiffRow
              label="Kilometre"
              icon={<Gauge className="h-3.5 w-3.5 text-slate-500" />}
              current={vehicle?.current_km?.toLocaleString() || '-'}
              incoming={(submitted as any).km?.toLocaleString() || '-'}
            />
            <DiffRow
              label="Yakit Durumu"
              icon={<Fuel className="h-3.5 w-3.5 text-slate-500" />}
              current="-"
              incoming={fuelLabels[(submitted as any).fuel_level] || (submitted as any).fuel_level || '-'}
            />
            <DiffRow
              label="Temizlik"
              icon={<Droplets className="h-3.5 w-3.5 text-slate-500" />}
              current="-"
              incoming={cleanLabels[(submitted as any).cleanliness] || (submitted as any).cleanliness || '-'}
            />

            {/* Damage comparison */}
            {(submitted as any).damage_schema && Object.keys((submitted as any).damage_schema).length > 0 && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-xl">
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Yeni Hasar Kayitlari
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries((submitted as any).damage_schema as Record<string, string>).map(([part, note]) => (
                    <div key={part} className="text-xs bg-red-100 px-2 py-1 rounded">
                      <span className="font-medium text-red-800">{part}:</span>{' '}
                      <span className="text-red-700">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature */}
            {task.signature_url && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-medium text-slate-700 mb-2">Teslim Eden Imzasi</p>
                <img src={task.signature_url} alt="Imza" className="h-20 border border-slate-300 rounded-lg bg-white" />
              </div>
            )}
          </div>
        )}

        {/* TUVTURK comparison */}
        {(task.task_type === 'tuvturk' || task.task_type === 'muayene') && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Muayene Verileri</h4>
            <DiffRow
              label="Muayene Tarihi"
              icon={<ClipboardCheck className="h-3.5 w-3.5 text-slate-500" />}
              current={vehicle?.inspection_expiry ? formatDate(vehicle.inspection_expiry) : '-'}
              incoming={(submitted as any).inspection_date ? formatDate((submitted as any).inspection_date) : '-'}
            />
          </div>
        )}

        {/* Lastik comparison */}
        {(task.task_type === 'lastik_degisimi' || task.task_type === 'yeni_lastik') && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Lastik Verileri</h4>
            <DiffRow
              label="Lastik Marka"
              icon={<Wrench className="h-3.5 w-3.5 text-slate-500" />}
              current={vehicle?.tire_brand || '-'}
              incoming={(submitted as any).tire_info?.brand || '-'}
            />
            <DiffRow
              label="Lastik Ebat"
              icon={<Wrench className="h-3.5 w-3.5 text-slate-500" />}
              current={vehicle?.tire_size || '-'}
              incoming={(submitted as any).tire_info?.size || '-'}
            />
            <DiffRow
              label="Lastik Tipi"
              icon={<Wrench className="h-3.5 w-3.5 text-slate-500" />}
              current={vehicle?.tire_type || '-'}
              incoming={(submitted as any).tire_info?.type || '-'}
            />
          </div>
        )}

        {/* Uploaded files */}
        {task.file_urls && task.file_urls.length > 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-semibold text-slate-700 mb-2">Yuklenen Dosyalar ({task.file_urls.length})</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {task.file_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="aspect-square rounded-lg border border-slate-200 overflow-hidden bg-white flex items-center justify-center hover:border-teal-400 transition-colors">
                    {url.match(/\.(jpg|jpeg|png|webp|heic)/i) ? (
                      <img src={url} className="w-full h-full object-cover" />
                    ) : url.match(/\.(mp4|mov|webm)/i) ? (
                      <video src={url} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {(submitted as any).notes && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-medium text-slate-700 mb-1">Sofor Notu</p>
            <p className="text-sm text-slate-600">{(submitted as any).notes}</p>
          </div>
        )}

        {/* Action */}
        <div className="flex gap-3 pt-3 border-t border-slate-200 sticky bottom-0 bg-white pb-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Kapat
          </Button>
          <Button onClick={onSync} loading={syncing} className="flex-1 !bg-green-600 hover:!bg-green-700">
            <ArrowRightLeft className="h-4 w-4 mr-1.5" />
            Verileri Aktar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
