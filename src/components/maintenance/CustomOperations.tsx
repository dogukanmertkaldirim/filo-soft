import { Plus, Trash2 } from 'lucide-react';
import type { CustomOperation } from '../../types/database';

interface CustomOperationsProps {
  operations: CustomOperation[];
  onChange: (operations: CustomOperation[]) => void;
  readOnly?: boolean;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function CustomOperations({ operations, onChange, readOnly }: CustomOperationsProps) {
  function addOperation() {
    onChange([...operations, { id: generateId(), name: '', notes: '' }]);
  }

  function removeOperation(id: string) {
    onChange(operations.filter((op) => op.id !== id));
  }

  function updateOperation(id: string, field: 'name' | 'notes', value: string) {
    onChange(operations.map((op) => (op.id === id ? { ...op, [field]: value } : op)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Ekstra Islemler / Notlar</h3>
        {operations.length > 0 && !readOnly && (
          <span className="text-xs text-slate-400">{operations.length} islem</span>
        )}
      </div>

      {operations.length > 0 && (
        <div className="space-y-2">
          {operations.map((op, idx) => (
            <div
              key={op.id}
              className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-white group"
            >
              <span className="text-xs font-medium text-slate-400 mt-2 w-5 flex-shrink-0">
                {idx + 1}.
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                {readOnly ? (
                  <>
                    <p className="text-sm font-medium text-slate-800">{op.name}</p>
                    {op.notes && <p className="text-xs text-slate-500">{op.notes}</p>}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={op.name}
                      onChange={(e) => updateOperation(op.id, 'name', e.target.value)}
                      placeholder="Islem adi (orn: Sag ayna degisimi)"
                      className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                    />
                    <input
                      type="text"
                      value={op.notes}
                      onChange={(e) => updateOperation(op.id, 'notes', e.target.value)}
                      placeholder="Not / Aciklama (opsiyonel)"
                      className="w-full text-xs px-3 py-1.5 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-500"
                    />
                  </>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeOperation(op.id)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 mt-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={addOperation}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg border border-dashed border-teal-300 hover:border-teal-400 transition-all w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Ekstra Islem / Not Ekle
        </button>
      )}
    </div>
  );
}
