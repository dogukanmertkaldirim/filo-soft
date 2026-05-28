import { RefreshCw, CheckCircle2, MinusCircle } from 'lucide-react';
import type { ChecklistItem, ChecklistItemStatus } from '../../types/database';

const STATUS_CONFIG: Record<ChecklistItemStatus, { label: string; icon: typeof RefreshCw; color: string; bg: string; border: string }> = {
  replaced: {
    label: 'Degisti',
    icon: RefreshCw,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    border: 'border-emerald-300 ring-emerald-200',
  },
  checked: {
    label: 'Kontrol Edildi',
    icon: CheckCircle2,
    color: 'text-blue-700',
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-300 ring-blue-200',
  },
  na: {
    label: 'Yapilmadi',
    icon: MinusCircle,
    color: 'text-slate-400',
    bg: 'bg-slate-50 hover:bg-slate-100',
    border: 'border-slate-200 ring-slate-100',
  },
};

const STATUSES: ChecklistItemStatus[] = ['replaced', 'checked', 'na'];

interface MaintenanceChecklistProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}

export default function MaintenanceChecklist({ items, onChange, readOnly }: MaintenanceChecklistProps) {
  function handleStatusChange(itemId: string, status: ChecklistItemStatus) {
    if (readOnly) return;
    onChange(items.map((item) => (item.id === itemId ? { ...item, status } : item)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-slate-800">Standart Bakim Kontrol Listesi</h3>
        <div className="flex items-center gap-3 ml-auto">
          {STATUSES.filter((s) => s !== 'na').map((s) => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <span key={s} className="flex items-center gap-1 text-[10px]">
                <Icon className={`h-3 w-3 ${cfg.color}`} />
                <span className={cfg.color}>{cfg.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const currentCfg = STATUS_CONFIG[item.status];
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                item.status === 'na'
                  ? 'border-slate-200 bg-white'
                  : item.status === 'replaced'
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-blue-200 bg-blue-50/50'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.status !== 'na' && (
                  <currentCfg.icon className={`h-4 w-4 flex-shrink-0 ${currentCfg.color}`} />
                )}
                <span className={`text-sm font-medium truncate ${item.status === 'na' ? 'text-slate-500' : 'text-slate-800'}`}>
                  {item.label}
                </span>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const Icon = cfg.icon;
                    const isActive = item.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStatusChange(item.id, s)}
                        title={cfg.label}
                        className={`p-1.5 rounded-md border transition-all ${
                          isActive
                            ? `${cfg.bg} ${cfg.border} ring-1`
                            : 'border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${isActive ? cfg.color : 'text-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              {readOnly && item.status !== 'na' && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentCfg.bg} ${currentCfg.color}`}>
                  {currentCfg.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
