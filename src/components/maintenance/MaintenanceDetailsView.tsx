import { RefreshCw, CheckCircle2, Wrench, FileText } from 'lucide-react';
import type { ServiceDetails } from '../../types/database';

interface MaintenanceDetailsViewProps {
  serviceDetails: ServiceDetails | null;
}

export default function MaintenanceDetailsView({ serviceDetails }: MaintenanceDetailsViewProps) {
  if (!serviceDetails) return null;

  const { checklist, custom_operations } = serviceDetails;

  const replacedItems = checklist.filter((i) => i.status === 'replaced');
  const checkedItems = checklist.filter((i) => i.status === 'checked');
  const filteredOps = custom_operations.filter((op) => op.name.trim());

  if (replacedItems.length === 0 && checkedItems.length === 0 && filteredOps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#0f1b2d] rounded-lg px-4 py-2.5">
        <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Yapilan Islemler</h4>
      </div>

      {replacedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center">
              <RefreshCw className="h-3 w-3 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-[#0f1b2d] uppercase tracking-wider">Degisen Parcalar</span>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {replacedItems.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-1">
            {replacedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80"
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-800">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkedItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-5 w-5 rounded-md bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-blue-600" />
            </div>
            <span className="text-xs font-bold text-[#0f1b2d] uppercase tracking-wider">Kontrol Edilen</span>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {checkedItems.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-1">
            {checkedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/70 border border-blue-200/80"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-blue-800">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredOps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center">
              <Wrench className="h-3 w-3 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-[#0f1b2d] uppercase tracking-wider">Ekstra Islemler ve Notlar</span>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {filteredOps.length}
            </span>
          </div>
          <div className="space-y-2 pl-1">
            {filteredOps.map((op, idx) => (
              <div
                key={op.id}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80"
              >
                <span className="text-[10px] font-bold text-amber-500 mt-0.5 w-4 flex-shrink-0">{idx + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-amber-900">{op.name}</p>
                  {op.notes && (
                    <div className="flex items-start gap-1 mt-1">
                      <FileText className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-amber-700 leading-relaxed">{op.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
