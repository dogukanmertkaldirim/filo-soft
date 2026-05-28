import { DAMAGE_STATUS_OPTIONS } from '../vehicle/CarDamageSchema';

interface CarPart {
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

interface DamageSchemaStaticProps {
  damageData: Record<string, string> | null;
}

export default function DamageSchemaStatic({ damageData }: DamageSchemaStaticProps) {
  const data = damageData || {};
  const nonOriginalParts = CAR_PARTS.filter((p) => data[p.id] && data[p.id] !== 'orijinal');

  return (
    <div className="damage-schema-static">
      <div className="schema-container">
        <svg viewBox="80 0 240 340" className="schema-svg">
          <g>
            {CAR_PARTS.map((part) => {
              const status = data[part.id];
              return (
                <path
                  key={part.id}
                  d={part.path}
                  fill={getPartFill(part.id, status)}
                  stroke={getPartStroke(part.id, status)}
                  strokeWidth={1}
                  strokeLinejoin="round"
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
            <circle cx="140" cy="16" r="5" fill="#f5c542" stroke="#d4a830" strokeWidth="1" opacity="0.9" />
            <circle cx="260" cy="16" r="5" fill="#f5c542" stroke="#d4a830" strokeWidth="1" opacity="0.9" />
            <circle cx="145" cy="316" r="4" fill="#e04040" stroke="#c03030" strokeWidth="1" opacity="0.9" />
            <circle cx="255" cy="316" r="4" fill="#e04040" stroke="#c03030" strokeWidth="1" opacity="0.9" />
          </g>
        </svg>

        <div className="legend-section">
          <div className="legend-title">RENK KODLARI:</div>
          <div className="legend-items">
            {DAMAGE_STATUS_OPTIONS.map((opt) => (
              <div key={opt.value} className="legend-item">
                <span className="legend-color" style={{ backgroundColor: opt.bg }} />
                <span className="legend-label">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="damage-list">
        {nonOriginalParts.length === 0 ? (
          <div className="no-damage">
            <p className="no-damage-text">Tum parcalar orijinaldir. Degisen veya boyali parca bulunmamaktadir.</p>
          </div>
        ) : (
          <div className="damage-items">
            <div className="damage-title">TESPIT EDILEN HASARLAR:</div>
            {nonOriginalParts.map((part) => {
              const status = data[part.id];
              const opt = DAMAGE_STATUS_OPTIONS.find((o) => o.value === status);
              return (
                <div key={part.id} className="damage-item">
                  <span className="damage-color" style={{ backgroundColor: opt?.bg || '#ccc' }} />
                  <span className="damage-part">{part.label}</span>
                  <span className="damage-status" style={{ color: opt?.color || '#666' }}>
                    {opt?.label || '-'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .damage-schema-static {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .schema-container {
          flex-shrink: 0;
        }

        .schema-svg {
          width: 180px;
          height: auto;
        }

        .legend-section {
          margin-top: 8px;
        }

        .legend-title {
          font-size: 8px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }

        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .legend-color {
          width: 10px;
          height: 8px;
          border-radius: 2px;
        }

        .legend-label {
          font-size: 7px;
          color: #64748b;
        }

        .damage-list {
          flex: 1;
        }

        .no-damage {
          padding: 12px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
        }

        .no-damage-text {
          font-size: 10px;
          color: #166534;
          margin: 0;
        }

        .damage-items {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .damage-title {
          font-size: 9px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }

        .damage-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 9px;
        }

        .damage-color {
          width: 10px;
          height: 8px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .damage-part {
          color: #334155;
          font-weight: 500;
        }

        .damage-status {
          font-weight: 600;
        }

        @media print {
          .schema-svg {
            width: 160px;
          }

          .legend-title {
            font-size: 7px;
          }

          .legend-label {
            font-size: 6px;
          }

          .damage-title {
            font-size: 8px;
          }

          .damage-item {
            font-size: 8px;
          }

          .no-damage-text {
            font-size: 9px;
          }
        }
      `}</style>
    </div>
  );
}
