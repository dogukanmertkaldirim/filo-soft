import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export type DamageStatus = 'orijinal' | 'boyali' | 'lokal_boyali' | 'degisen' | 'cizik_gocuk';

export const DAMAGE_STATUS_OPTIONS: { value: DamageStatus; label: string; color: string; bg: string }[] = [
  { value: 'orijinal', label: 'Orijinal', color: '#9ca3af', bg: '#d4d4d4' },
  { value: 'lokal_boyali', label: 'Lokal Boyali', color: '#ea580c', bg: '#fb923c' },
  { value: 'boyali', label: 'Boyali', color: '#2563eb', bg: '#3b82f6' },
  { value: 'degisen', label: 'Degisen', color: '#dc2626', bg: '#ef4444' },
  { value: 'cizik_gocuk', label: 'Cizik / Gocuk', color: '#7c3aed', bg: '#a78bfa' },
];

export interface CarPart {
  id: string;
  label: string;
  path: string;
}

const CAR_PARTS: CarPart[] = [
  {
    id: 'front_bumper',
    label: 'On Tampon',
    path: 'M 152,18 C 152,18 170,14 200,14 L 200,14 C 230,14 248,18 248,18 L 255,28 C 255,28 235,22 200,22 C 165,22 145,28 145,28 Z',
  },
  {
    id: 'hood',
    label: 'Kaput',
    path: 'M 143,30 C 143,30 165,24 200,24 C 235,24 257,30 257,30 L 265,72 C 265,72 240,65 200,65 C 160,65 135,72 135,72 Z',
  },
  {
    id: 'front_left_fender',
    label: 'Sol On Camurluk',
    path: 'M 135,72 C 135,72 130,68 125,60 L 120,50 C 120,50 125,40 132,32 L 143,30 L 135,72 Z',
  },
  {
    id: 'front_right_fender',
    label: 'Sag On Camurluk',
    path: 'M 265,72 C 265,72 270,68 275,60 L 280,50 C 280,50 275,40 268,32 L 257,30 L 265,72 Z',
  },
  {
    id: 'windshield',
    label: 'On Cam',
    path: 'M 137,76 C 137,76 162,69 200,69 C 238,69 263,76 263,76 L 256,108 C 256,108 236,102 200,102 C 164,102 144,108 144,108 Z',
  },
  {
    id: 'roof',
    label: 'Tavan',
    path: 'M 144,112 C 144,112 164,106 200,106 C 236,106 256,112 256,112 L 256,220 C 256,220 236,214 200,214 C 164,214 144,220 144,220 Z',
  },
  {
    id: 'left_front_door',
    label: 'Sol On Kapi',
    path: 'M 120,75 L 135,72 L 137,76 L 144,108 L 144,112 L 144,170 L 118,170 L 115,110 Z',
  },
  {
    id: 'right_front_door',
    label: 'Sag On Kapi',
    path: 'M 280,75 L 265,72 L 263,76 L 256,108 L 256,112 L 256,170 L 282,170 L 285,110 Z',
  },
  {
    id: 'left_rear_door',
    label: 'Sol Arka Kapi',
    path: 'M 118,174 L 144,174 L 144,220 L 144,242 L 132,250 L 120,245 Z',
  },
  {
    id: 'right_rear_door',
    label: 'Sag Arka Kapi',
    path: 'M 282,174 L 256,174 L 256,220 L 256,242 L 268,250 L 280,245 Z',
  },
  {
    id: 'rear_left_fender',
    label: 'Sol Arka Camurluk',
    path: 'M 120,249 L 132,254 L 140,280 L 145,300 C 145,300 138,298 130,290 L 122,270 Z',
  },
  {
    id: 'rear_right_fender',
    label: 'Sag Arka Camurluk',
    path: 'M 280,249 L 268,254 L 260,280 L 255,300 C 255,300 262,298 270,290 L 278,270 Z',
  },
  {
    id: 'rear_window',
    label: 'Arka Cam',
    path: 'M 144,224 C 144,224 164,218 200,218 C 236,218 256,224 256,224 L 260,258 C 260,258 238,250 200,250 C 162,250 140,258 140,258 Z',
  },
  {
    id: 'trunk',
    label: 'Bagaj',
    path: 'M 140,262 C 140,262 162,254 200,254 C 238,254 260,262 260,262 L 256,298 C 256,298 238,290 200,290 C 162,290 144,298 144,298 Z',
  },
  {
    id: 'rear_bumper',
    label: 'Arka Tampon',
    path: 'M 144,300 C 144,300 162,294 200,294 C 238,294 256,300 256,300 L 252,316 C 252,316 235,320 200,320 C 165,320 148,316 148,316 Z',
  },
];

const DEFAULT_FILL = '#c8cdd3';
const DEFAULT_STROKE = '#9aa0a8';
const GLASS_FILL = '#a8b8c8';
const GLASS_STROKE = '#8898a8';

function getPartFill(partId: string, status?: string): string {
  if (!status) {
    if (partId === 'windshield' || partId === 'rear_window') return GLASS_FILL;
    return DEFAULT_FILL;
  }
  const opt = DAMAGE_STATUS_OPTIONS.find((o) => o.value === status);
  return opt ? opt.bg : DEFAULT_FILL;
}

function getPartStroke(partId: string, status?: string): string {
  if (!status) {
    if (partId === 'windshield' || partId === 'rear_window') return GLASS_STROKE;
    return DEFAULT_STROKE;
  }
  const opt = DAMAGE_STATUS_OPTIONS.find((o) => o.value === status);
  return opt ? opt.color : DEFAULT_STROKE;
}

interface CarDamageSchemaProps {
  value: Record<string, string>;
  onChange: (schema: Record<string, string>) => void;
  readOnly?: boolean;
}

export default function CarDamageSchema({ value, onChange, readOnly }: CarDamageSchemaProps) {
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        svgRef.current &&
        !svgRef.current.contains(e.target as Node)
      ) {
        setSelectedPart(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handlePartClick(partId: string, e: React.MouseEvent) {
    if (readOnly) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectedPart(partId);
    setPopoverPos({ x, y });
  }

  function handleStatusSelect(status: DamageStatus) {
    if (!selectedPart) return;
    const next = { ...value, [selectedPart]: status };
    onChange(next);
    setSelectedPart(null);
  }

  function handleClearPart() {
    if (!selectedPart) return;
    const next = { ...value };
    delete next[selectedPart];
    onChange(next);
    setSelectedPart(null);
  }

  const selectedPartData = CAR_PARTS.find((p) => p.id === selectedPart);
  const markedCount = Object.keys(value).length;
  const nonOriginalCount = Object.entries(value).filter(([, s]) => s !== 'orijinal').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-800">Boyali veya Degisen Parca</label>
        {markedCount > 0 && (
          <span className="text-xs text-slate-500">
            {markedCount} parca isaretli
            {nonOriginalCount > 0 && (
              <span className="text-amber-600 ml-1">({nonOriginalCount} hasarli)</span>
            )}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-2">
        {DAMAGE_STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-1.5">
            <span
              className="w-4 h-3 rounded-sm inline-block"
              style={{ backgroundColor: opt.bg }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: opt.value === 'lokal_boyali' ? '#ea580c' : opt.value === 'degisen' ? '#dc2626' : opt.value === 'boyali' ? '#2563eb' : '#6b7280' }}
            >
              {opt.label}
            </span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="relative bg-amber-50/60 border border-amber-200/60 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <div className="flex justify-center flex-shrink-0 mx-auto lg:mx-0">
            <svg
              ref={svgRef}
              viewBox="80 0 240 340"
              className="w-[280px] h-auto"
            >
              <defs>
                <filter id="carShadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
                </filter>
              </defs>

              <g filter="url(#carShadow)">
                {CAR_PARTS.map((part) => {
                  const status = value[part.id];
                  const isSelected = selectedPart === part.id;
                  return (
                    <path
                      key={part.id}
                      d={part.path}
                      fill={getPartFill(part.id, status)}
                      stroke={isSelected ? '#0d9488' : getPartStroke(part.id, status)}
                      strokeWidth={isSelected ? 2.5 : 1}
                      strokeLinejoin="round"
                      className={readOnly ? '' : 'cursor-pointer transition-all duration-150 hover:brightness-110 hover:stroke-[2]'}
                      onClick={(e) => handlePartClick(part.id, e)}
                    />
                  );
                })}

                <ellipse cx="108" cy="82" rx="12" ry="26" fill="#555" stroke="#444" strokeWidth="1.5" />
                <ellipse cx="108" cy="82" rx="8" ry="22" fill="#666" stroke="#555" strokeWidth="0.5" />
                <ellipse cx="292" cy="82" rx="12" ry="26" fill="#555" stroke="#444" strokeWidth="1.5" />
                <ellipse cx="292" cy="82" rx="8" ry="22" fill="#666" stroke="#555" strokeWidth="0.5" />

                <ellipse cx="108" cy="260" rx="12" ry="26" fill="#555" stroke="#444" strokeWidth="1.5" />
                <ellipse cx="108" cy="260" rx="8" ry="22" fill="#666" stroke="#555" strokeWidth="0.5" />
                <ellipse cx="292" cy="260" rx="12" ry="26" fill="#555" stroke="#444" strokeWidth="1.5" />
                <ellipse cx="292" cy="260" rx="8" ry="22" fill="#666" stroke="#555" strokeWidth="0.5" />

                <ellipse cx="100" cy="160" rx="12" ry="7" fill="#b0b8c0" stroke="#8090a0" strokeWidth="1" />
                <ellipse cx="300" cy="160" rx="12" ry="7" fill="#b0b8c0" stroke="#8090a0" strokeWidth="1" />

                <rect x="175" y="20" width="10" height="3" rx="1" fill="#888" opacity="0.5" />
                <rect x="215" y="20" width="10" height="3" rx="1" fill="#888" opacity="0.5" />

                <circle cx="140" cy="16" r="5" fill="#f5c542" stroke="#d4a830" strokeWidth="1" opacity="0.9" />
                <circle cx="260" cy="16" r="5" fill="#f5c542" stroke="#d4a830" strokeWidth="1" opacity="0.9" />
                <circle cx="145" cy="316" r="4" fill="#e04040" stroke="#c03030" strokeWidth="1" opacity="0.9" />
                <circle cx="255" cy="316" r="4" fill="#e04040" stroke="#c03030" strokeWidth="1" opacity="0.9" />
              </g>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            {nonOriginalCount === 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-3 rounded-sm bg-gray-300 inline-block" />
                  <span className="text-sm font-semibold text-slate-800">Orijinal</span>
                </div>
                <p className="text-sm text-slate-500 italic leading-relaxed">
                  Aracin tum parcalari orijinaldir. Degisen ve boyali parcasi bulunmamaktadir.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {CAR_PARTS.filter((p) => value[p.id] && value[p.id] !== 'orijinal').map((part) => {
                  const status = value[part.id];
                  const opt = DAMAGE_STATUS_OPTIONS.find((o) => o.value === status);
                  if (!opt) return null;
                  return (
                    <div key={part.id} className="flex items-center gap-2">
                      <span
                        className="w-4 h-3 rounded-sm flex-shrink-0 inline-block"
                        style={{ backgroundColor: opt.bg }}
                      />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">{part.label}</span>
                        <span className="text-slate-400 mx-1">-</span>
                        <span style={{ color: opt.color }}>{opt.label}</span>
                      </span>
                    </div>
                  );
                })}
                {nonOriginalCount === 0 && (
                  <p className="text-sm text-slate-500 italic">Degisen veya boyali parca yok.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedPart && popoverPos && selectedPartData && (
          <div
            ref={popoverRef}
            className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-3 min-w-[190px]"
            style={{
              left: Math.min(Math.max(popoverPos.x - 95, 8), (containerRef.current?.offsetWidth || 400) - 200),
              top: Math.min(popoverPos.y + 8, (containerRef.current?.offsetHeight || 500) - 220),
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900">{selectedPartData.label}</span>
              <button
                onClick={() => setSelectedPart(null)}
                className="p-0.5 hover:bg-slate-100 rounded"
              >
                <X className="h-3 w-3 text-slate-400" />
              </button>
            </div>
            <div className="space-y-1">
              {DAMAGE_STATUS_OPTIONS.map((opt) => {
                const isActive = value[selectedPart] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusSelect(opt.value)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2 ${
                      isActive
                        ? 'ring-2 ring-offset-1'
                        : 'hover:bg-slate-50'
                    }`}
                    style={{
                      backgroundColor: isActive ? opt.bg + '30' : undefined,
                      color: opt.color,
                      ringColor: isActive ? opt.color : undefined,
                    }}
                  >
                    <span
                      className="w-4 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: opt.bg }}
                    />
                    {opt.label}
                  </button>
                );
              })}
              {value[selectedPart] && (
                <button
                  onClick={handleClearPart}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-500 hover:bg-slate-100 mt-1 border-t border-slate-100 pt-2"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
