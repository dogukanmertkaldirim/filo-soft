interface CarSchematicViewProps {
  plate: string;
  className?: string;
}

export default function CarSchematicView({ plate, className = '' }: CarSchematicViewProps) {
  return (
    <div className={`car-schematic ${className}`}>
      <svg viewBox="0 0 600 400" className="w-full h-auto" style={{ maxHeight: '300px' }}>
        <rect x="150" y="50" width="300" height="300" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" rx="8" />

        <g id="top-view" transform="translate(200, 60)">
          <text x="100" y="10" textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">ÜST GÖRÜNÜM</text>

          <path
            d="M50 30 L150 30 Q170 30 175 50 L180 80 L180 160 L175 190 Q170 210 150 210 L50 210 Q30 210 25 190 L20 160 L20 80 L25 50 Q30 30 50 30 Z"
            fill="#f1f5f9"
            stroke="#475569"
            strokeWidth="2"
          />

          <rect x="45" y="40" width="110" height="35" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
          <line x1="100" y1="40" x2="100" y2="75" stroke="#94a3b8" strokeWidth="1" />

          <rect x="45" y="165" width="110" height="35" rx="5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />

          <rect x="35" y="85" width="130" height="70" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

          <rect x="10" y="55" width="15" height="30" rx="3" fill="#64748b" />
          <rect x="175" y="55" width="15" height="30" rx="3" fill="#64748b" />
          <rect x="10" y="155" width="15" height="30" rx="3" fill="#64748b" />
          <rect x="175" y="155" width="15" height="30" rx="3" fill="#64748b" />

          <circle cx="25" cy="45" r="4" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="175" cy="45" r="4" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="25" cy="195" r="4" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
          <circle cx="175" cy="195" r="4" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />

          <text x="100" y="125" textAnchor="middle" fontSize="9" fill="#475569" fontWeight="bold">
            {plate}
          </text>
        </g>

        <g id="front-view" transform="translate(30, 280)">
          <text x="50" y="10" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">ÖN</text>
          <path
            d="M20 25 L80 25 Q90 25 92 35 L95 55 L95 70 L5 70 L5 55 L8 35 Q10 25 20 25 Z"
            fill="#f1f5f9"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <rect x="15" y="30" width="70" height="20" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
          <rect x="30" y="55" width="40" height="10" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
          <circle cx="18" cy="60" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
          <circle cx="82" cy="60" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
        </g>

        <g id="back-view" transform="translate(470, 280)">
          <text x="50" y="10" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">ARKA</text>
          <path
            d="M20 25 L80 25 Q90 25 92 35 L95 55 L95 70 L5 70 L5 55 L8 35 Q10 25 20 25 Z"
            fill="#f1f5f9"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <rect x="15" y="30" width="70" height="20" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
          <rect x="20" y="55" width="25" height="8" rx="2" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
          <rect x="55" y="55" width="25" height="8" rx="2" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
          <rect x="38" y="57" width="24" height="8" rx="1" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
        </g>

        <g id="left-view" transform="translate(145, 280)">
          <text x="75" y="10" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">SOL</text>
          <path
            d="M10 70 L140 70 L140 55 L130 35 L115 25 L35 25 L20 35 L10 55 Z"
            fill="#f1f5f9"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <path
            d="M25 45 L55 30 L95 30 L125 45 L125 55 L25 55 Z"
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <line x1="75" y1="30" x2="75" y2="55" stroke="#94a3b8" strokeWidth="1" />
          <ellipse cx="30" cy="70" rx="12" ry="6" fill="#475569" />
          <ellipse cx="120" cy="70" rx="12" ry="6" fill="#475569" />
          <rect x="45" y="60" width="60" height="8" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
        </g>

        <g id="right-view" transform="translate(295, 280)">
          <text x="75" y="10" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">SAĞ</text>
          <path
            d="M10 70 L140 70 L140 55 L130 35 L115 25 L35 25 L20 35 L10 55 Z"
            fill="#f1f5f9"
            stroke="#475569"
            strokeWidth="1.5"
          />
          <path
            d="M25 45 L55 30 L95 30 L125 45 L125 55 L25 55 Z"
            fill="#e2e8f0"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          <line x1="75" y1="30" x2="75" y2="55" stroke="#94a3b8" strokeWidth="1" />
          <ellipse cx="30" cy="70" rx="12" ry="6" fill="#475569" />
          <ellipse cx="120" cy="70" rx="12" ry="6" fill="#475569" />
          <rect x="45" y="60" width="60" height="8" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
        </g>

        <g id="legend" transform="translate(20, 60)">
          <text x="0" y="0" fontSize="9" fill="#475569" fontWeight="600">HASAR İŞARETİ:</text>
          <rect x="0" y="10" width="12" height="12" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" rx="2" />
          <text x="18" y="20" fontSize="8" fill="#64748b">Boyalı</text>
          <rect x="0" y="28" width="12" height="12" fill="#fee2e2" stroke="#ef4444" strokeWidth="1" rx="2" />
          <text x="18" y="38" fontSize="8" fill="#64748b">Değişen</text>
          <rect x="0" y="46" width="12" height="12" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="2" />
          <text x="18" y="56" fontSize="8" fill="#64748b">Çizik</text>
          <rect x="0" y="64" width="12" height="12" fill="#dcfce7" stroke="#22c55e" strokeWidth="1" rx="2" />
          <text x="18" y="74" fontSize="8" fill="#64748b">Ezik</text>
        </g>
      </svg>

      <div className="mt-3 text-center">
        <p className="text-xs text-slate-500">
          Tespit edilen hasarları yukarıdaki şema üzerinde işaretleyiniz.
        </p>
      </div>
    </div>
  );
}
