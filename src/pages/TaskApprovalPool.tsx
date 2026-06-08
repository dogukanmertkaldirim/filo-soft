import { useState, useEffect } from 'react';
import {
  ClipboardCheck, Car, User, Clock, CheckCircle, AlertTriangle,
  ArrowRightLeft, FileText, Image as ImageIcon, Fuel, Gauge, Droplets,
  Wrench, Truck, Search, Filter, Timer, MapPin, Play, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

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
  approved_by: string | null;
  approved_at: string | null;
  submitted_data: Record<string, unknown> | null;
  handover_data: Record<string, unknown> | null;
  file_urls: string[];
  signature_url: string | null;
  assigned_driver_id: string;
  vehicles?: { id: string; plate: string; brand: string; model: string; year: number; current_km: number | null; inspection_expiry: string | null; tire_type: string | null; tire_brand: string | null; tire_size: string | null; damage_schema: Record<string, string> | null } | null;
  driver?: { id: string; full_name: string } | null;
}

interface DriverOption {
  id: string;
  full_name: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  teslim_alma: 'Teslim Alma',
  teslim_et: 'Araci Teslim Et',
  lastik_degisimi: 'Lastik Degisimi',
  muayene: 'Muayeneye Gotur',
  lastik_teslimat: 'Lastikten Musteriye Teslimat',
  yeni_lastik: 'Yeni Lastik Alimi',
  tuvturk: 'TUVTURK Randevusu',
  diger: 'Diger',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  en_route: 'Yolda',
  in_progress: 'Islem Yapiliyor',
  pending_sync: 'Onay Bekliyor',
  completed: 'Tamamlandi',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  en_route: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  pending_sync: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
};

type TabKey = 'pending_approval' | 'active_field' | 'history';

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '-';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  if (diffMs < 0) return '-';

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} Dakika`;
  if (minutes === 0) return `${hours} Saat`;
  return `${hours} Saat ${minutes} Dakika`;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '-';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = now - start;
  if (diffMs < 0) return '-';

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} dk`;
  return `${hours} sa ${minutes} dk`;
}

export default function TaskApprovalPool() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<TabKey>('pending_approval');
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (companyId) {
      loadTasks();
      loadDrivers();
    }
  }, [companyId]);

  async function loadTasks() {
    setLoading(true);
    const { data } = await supabase
      .from('operational_tasks')
      .select('*, vehicles(id, plate, brand, model, year, current_km, inspection_expiry, tire_type, tire_brand, tire_size, damage_schema), driver:app_users!operational_tasks_assigned_driver_id_fkey(id, full_name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setTasks((data || []) as OperationalTask[]);
    setLoading(false);
  }

  async function loadDrivers() {
    const { data } = await supabase
      .from('app_users')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('role', 'DMK_Employee')
      .order('full_name');
    setDrivers(data || []);
  }

  function getFilteredTasks(statusFilter: (status: string) => boolean) {
    return tasks.filter(t => {
      if (!statusFilter(t.status)) return false;
      if (driverFilter && t.assigned_driver_id !== driverFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchPlate = t.vehicles?.plate?.toLowerCase().includes(q);
        const matchDriver = t.driver?.full_name?.toLowerCase().includes(q);
        const matchType = (TASK_TYPE_LABELS[t.task_type] || t.task_type).toLowerCase().includes(q);
        if (!matchPlate && !matchDriver && !matchType) return false;
      }
      return true;
    });
  }

  const pendingApprovalTasks = getFilteredTasks(s => s === 'pending_sync');
  const activeFieldTasks = getFilteredTasks(s => s === 'pending' || s === 'en_route' || s === 'in_progress');
  const historyTasks = getFilteredTasks(s => s === 'completed');

  const tabCounts = {
    pending_approval: pendingApprovalTasks.length,
    active_field: activeFieldTasks.length,
    history: historyTasks.length,
  };

  async function handleSync(task: OperationalTask) {
    if (!task.vehicle_id) return;
    setSyncing(true);

    const submitted = task.submitted_data || task.handover_data || {};
    const vehicleUpdate: Record<string, unknown> = {};

    if (task.task_type === 'teslim_alma') {
      if ((submitted as any).km) vehicleUpdate.current_km = (submitted as any).km;
      if ((submitted as any).damage_schema && Object.keys((submitted as any).damage_schema).length > 0) {
        vehicleUpdate.damage_schema = (submitted as any).damage_schema;
      }
    }

    if (task.task_type === 'teslim_et') {
      if ((submitted as any).km) vehicleUpdate.current_km = (submitted as any).km;
      if ((submitted as any).damage_schema && Object.keys((submitted as any).damage_schema).length > 0) {
        vehicleUpdate.damage_schema = (submitted as any).damage_schema;
      }
      vehicleUpdate.status = 'rented';
      await supabase
        .from('rentals')
        .update({ status: 'active', start_date: new Date().toISOString().split('T')[0] })
        .eq('vehicle_id', task.vehicle_id)
        .eq('status', 'pending');
    }

    if (task.task_type === 'tuvturk' || task.task_type === 'muayene') {
      if ((submitted as any).inspection_date) {
        vehicleUpdate.inspection_expiry = (submitted as any).inspection_date;
      }
    }

    if (task.task_type === 'lastik_degisimi' || task.task_type === 'yeni_lastik') {
      const tire = (submitted as any).tire_info;
      if (tire) {
        if (tire.brand) vehicleUpdate.tire_brand = tire.brand;
        if (tire.size) vehicleUpdate.tire_size = tire.size;
        if (tire.type) vehicleUpdate.tire_type = tire.type;
      }
    }

    if (Object.keys(vehicleUpdate).length > 0) {
      await supabase.from('vehicles').update(vehicleUpdate).eq('id', task.vehicle_id);
    }

    await supabase.from('operational_tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', task.id);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Saha Operasyon Takip Paneli</h1>
          <p className="text-sm text-slate-500">Saha gorevlerini takip edin, onaylayin ve performans analizi yapin</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-xs font-medium text-red-600">Onay Bekleyen</p>
          </div>
          <p className="text-2xl font-bold text-red-700">{pendingApprovalTasks.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Play className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-medium text-blue-600">Sahada Aktif</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{activeFieldTasks.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <p className="text-xs font-medium text-green-600">Tamamlanan</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{historyTasks.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-slate-500" />
            <p className="text-xs font-medium text-slate-600">Toplam Personel</p>
          </div>
          <p className="text-2xl font-bold text-slate-700">{drivers.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Plaka, personel adi veya gorev turu ara..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
        </div>
        <div className="relative sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            value={driverFilter}
            onChange={e => setDriverFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white appearance-none"
          >
            <option value="">Tum Personel</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-slate-200 p-1">
        <button
          onClick={() => setTab('pending_approval')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            tab === 'pending_approval' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Onay Bekleyenler</span>
          <span className="sm:hidden">Onay</span>
          {tabCounts.pending_approval > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'pending_approval' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
            }`}>
              {tabCounts.pending_approval}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('active_field')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            tab === 'active_field' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sahada Devam Edenler</span>
          <span className="sm:hidden">Aktif</span>
          {tabCounts.active_field > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'active_field' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
            }`}>
              {tabCounts.active_field}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            tab === 'history' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Gecmis & Tamamlananlar</span>
          <span className="sm:hidden">Gecmis</span>
          {tabCounts.history > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {tabCounts.history}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'pending_approval' && (
        <PendingApprovalTab tasks={pendingApprovalTasks} onSelect={setSelectedTask} />
      )}
      {tab === 'active_field' && (
        <ActiveFieldTab tasks={activeFieldTasks} />
      )}
      {tab === 'history' && (
        <HistoryTab tasks={historyTasks} />
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
// TAB 1: PENDING APPROVAL
// ==========================================

function PendingApprovalTab({ tasks, onSelect }: { tasks: OperationalTask[]; onSelect: (t: OperationalTask) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Tum gorevler onaylandi</h3>
        <p className="text-sm text-slate-500">Onay bekleyen veri aktarimi bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <div
          key={task.id}
          className="bg-white rounded-xl border border-red-200 p-5 hover:border-red-400 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => onSelect(task)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-colors">
                <ClipboardCheck className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium border border-red-200">
                    Onay Bekliyor
                  </span>
                  {task.priority === 'urgent' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Acil</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {task.vehicles && (
                    <span className="flex items-center gap-1">
                      <Car className="h-3 w-3" />
                      {task.vehicles.plate}
                    </span>
                  )}
                  {task.driver && (
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <User className="h-3 w-3" />
                      {task.driver.full_name}
                    </span>
                  )}
                  <span>{formatDate(task.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.file_urls && task.file_urls.length > 0 && (
                <span className="text-xs text-blue-600 flex items-center gap-0.5">
                  <FileText className="h-3 w-3" />
                  {task.file_urls.length}
                </span>
              )}
              <ArrowRightLeft className="h-5 w-5 text-red-400 group-hover:text-red-600 transition-colors" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==========================================
// TAB 2: ACTIVE IN FIELD
// ==========================================

function ActiveFieldTab({ tasks }: { tasks: OperationalTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Sahada aktif gorev yok</h3>
        <p className="text-sm text-slate-500">Su an sahada devam eden islem bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => {
        const elapsed = task.started_at ? formatElapsed(task.started_at) : null;
        return (
          <div
            key={task.id}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {task.status === 'en_route' ? (
                    <Truck className="h-5 w-5 text-blue-700" />
                  ) : task.status === 'in_progress' ? (
                    <Wrench className="h-5 w-5 text-amber-700" />
                  ) : (
                    <Clock className="h-5 w-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                    {task.priority === 'urgent' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Acil</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {task.vehicles && (
                      <span className="flex items-center gap-1">
                        <Car className="h-3 w-3" />
                        {task.vehicles.plate}
                      </span>
                    )}
                    {task.driver && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <User className="h-3 w-3" />
                        {task.driver.full_name}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-1">{task.description}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-400 mb-0.5">Atanma</p>
                <p className="text-xs font-medium text-slate-600">{formatDate(task.created_at)}</p>
                {elapsed && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <Timer className="h-3 w-3" />
                    {elapsed}
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-1 mt-4">
              {(['pending', 'en_route', 'in_progress', 'pending_sync'] as const).map((s, i) => {
                const statusIdx = ['pending', 'en_route', 'in_progress', 'pending_sync'].indexOf(task.status);
                return (
                  <div key={s} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-all ${
                      statusIdx >= i ? 'bg-blue-500' : 'bg-slate-200'
                    }`} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// TAB 3: HISTORY & COMPLETED
// ==========================================

function HistoryTab({ tasks }: { tasks: OperationalTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Henuz tamamlanan gorev yok</h3>
        <p className="text-sm text-slate-500">Tamamlanan gorevler burada listelenecektir</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => {
        const duration = formatDuration(task.started_at, task.completed_at);
        return (
          <div
            key={task.id}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium border border-green-200">
                      Tamamlandi
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
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <User className="h-3 w-3" />
                        {task.driver.full_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 space-y-1">
                {task.completed_at && (
                  <p className="text-xs text-slate-500">{formatDate(task.completed_at)}</p>
                )}
                {duration !== '-' && (
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg">
                    <Timer className="h-3 w-3" />
                    {duration}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline detail */}
            <div className="mt-3 pl-[52px] flex items-center gap-4 text-xs text-slate-400">
              {task.created_at && (
                <span>Atandi: {new Date(task.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {task.started_at && (
                <span>Basladi: {new Date(task.started_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {task.completed_at && (
                <span>Bitti: {new Date(task.completed_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// COMPARISON MODAL WITH RED HIGHLIGHTING
// ==========================================

interface ComparisonModalProps {
  task: OperationalTask;
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
            {task.driver && (
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400">Gonderen</p>
                <p className="text-sm font-medium">{task.driver.full_name}</p>
              </div>
            )}
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

            {task.signature_url && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-medium text-slate-700 mb-2">Teslim Eden Imzasi</p>
                <img src={task.signature_url} alt="Imza" className="h-20 border border-slate-300 rounded-lg bg-white" />
              </div>
            )}
          </div>
        )}

        {/* Teslim Et (Delivery) comparison */}
        {task.task_type === 'teslim_et' && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Arac Teslim Verileri</h4>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Onaylandiginda arac "Kiralanmis" olarak isaretlenecek ve kiralama baslatilacaktir.
              </p>
            </div>
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
            <DiffRow
              label="Arac Durumu"
              icon={<Car className="h-3.5 w-3.5 text-slate-500" />}
              current="Bosta"
              incoming="Kiralanmis"
            />

            {(submitted as any).damage_schema && Object.keys((submitted as any).damage_schema).length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Teslim Oncesi Hasar Kayitlari
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries((submitted as any).damage_schema as Record<string, string>).map(([part, note]) => (
                    <div key={part} className="text-xs bg-amber-100 px-2 py-1 rounded">
                      <span className="font-medium text-amber-800">{part}:</span>{' '}
                      <span className="text-amber-700">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {task.signature_url && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-medium text-slate-700 mb-2">Musteri Teslim Alma Imzasi</p>
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
