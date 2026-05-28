import { useState, useEffect } from 'react';
import {
  Puzzle,
  Car,
  Wallet,
  Wrench,
  Users,
  Truck,
  Package,
  Landmark,
  Handshake,
  CheckCircle,
  Lock,
  Save,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ModuleType } from '../types/database';
import Button from '../components/ui/Button';

interface ModuleDefinition {
  id: ModuleType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  isCore: boolean;
}

const MODULES: ModuleDefinition[] = [
  {
    id: 'rent_a_car',
    name: 'Rent a Car',
    description: 'Temel arac kiralama islemleri, sozlesmeler ve arac yonetimi',
    icon: Car,
    color: 'bg-teal-500',
    isCore: true,
  },
  {
    id: 'finance',
    name: 'Finans & Muhasebe',
    description: 'Gelir-gider takibi, finansal raporlar ve nakit akisi yonetimi',
    icon: Wallet,
    color: 'bg-emerald-500',
    isCore: false,
  },
  {
    id: 'maintenance',
    name: 'Bakim & Servis',
    description: 'Arac bakimlari, servis randevulari ve teknik takip',
    icon: Wrench,
    color: 'bg-orange-500',
    isCore: false,
  },
  {
    id: 'crm',
    name: 'Musteri Yonetimi (CRM)',
    description: 'Musteri kayitlari, iletisim gecmisi ve musteri portali',
    icon: Users,
    color: 'bg-blue-500',
    isCore: false,
  },
  {
    id: 'transfer',
    name: 'VIP Transfer',
    description: 'VIP transfer hizmetleri, sofor atamalari ve yolcu yonetimi',
    icon: Truck,
    color: 'bg-amber-500',
    isCore: false,
  },
  {
    id: 'logistics',
    name: 'Lojistik',
    description: 'Kargo ve lojistik operasyonlari, teslimat takibi',
    icon: Package,
    color: 'bg-cyan-500',
    isCore: false,
  },
  {
    id: 'loans',
    name: 'Kredi Islemleri',
    description: 'Banka kredileri, taksit takibi ve odeme planlari',
    icon: Landmark,
    color: 'bg-rose-500',
    isCore: false,
  },
  {
    id: 'partners',
    name: 'Ortak Yonetimi',
    description: 'Is ortaklari, kar paylasimi ve ortak hesaplari',
    icon: Handshake,
    color: 'bg-slate-600',
    isCore: false,
  },
];

export default function Modules() {
  const { activeModules, updateModules, isAdmin } = useAuth();
  const [selectedModules, setSelectedModules] = useState<ModuleType[]>([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSelectedModules([...activeModules]);
  }, [activeModules]);

  useEffect(() => {
    const sortedSelected = [...selectedModules].sort();
    const sortedActive = [...activeModules].sort();
    setHasChanges(JSON.stringify(sortedSelected) !== JSON.stringify(sortedActive));
  }, [selectedModules, activeModules]);

  function toggleModule(moduleId: ModuleType) {
    const module = MODULES.find(m => m.id === moduleId);
    if (module?.isCore) return;

    setSelectedModules(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(m => m !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateModules(selectedModules);
    setSaving(false);

    if (result.success) {
      setSuccessMessage('Modul ayarlari kaydedildi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      console.error('Module save error:', result.error);
      alert('Kaydetme sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }
  }

  function handleReset() {
    setSelectedModules([...activeModules]);
  }

  const enabledCount = selectedModules.length;
  const totalCount = MODULES.length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-teal-100 rounded-xl">
            <Puzzle className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Modul Yonetimi</h1>
            <p className="text-slate-500 text-sm">Sirketiniz icin aktif ozellikleri yonetin</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">{successMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{enabledCount}</span> / {totalCount} modul aktif
            </div>
            <div className="h-2 w-32 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-300"
                style={{ width: `${(enabledCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              Kaydedilmemis degisiklikler var
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MODULES.map(module => {
              const isActive = selectedModules.includes(module.id);
              const Icon = module.icon;

              return (
                <div
                  key={module.id}
                  onClick={() => toggleModule(module.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-teal-500 bg-teal-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  } ${module.isCore ? 'cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${module.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{module.name}</h3>
                        {module.isCore && (
                          <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Temel
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{module.description}</p>
                    </div>
                    <div className="flex items-center">
                      <div
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isActive ? 'bg-teal-600' : 'bg-slate-300'
                        } ${module.isCore ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  {isActive && !module.isCore && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="h-5 w-5 text-teal-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Degisiklikleri Sifirla
          </button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Kaydet
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Puzzle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Modul Mimarisi Hakkinda</h3>
            <p className="text-slate-300 text-sm mb-4">
              Bu sistem, moduler bir mimari ile tasarlanmistir. Ihtiyaciniz olmayan ozellikleri devre disi birakarak arayuzu sadlestirebilir ve sadece kullandiginiz modullere odaklanabilirsiniz.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-teal-400">{enabledCount}</div>
                <div className="text-xs text-slate-400">Aktif Modul</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-2xl font-bold text-slate-300">{totalCount - enabledCount}</div>
                <div className="text-xs text-slate-400">Devre Disi</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
