import * as XLSX from 'xlsx';

const TEMPLATE_HEADERS = [
  'Plaka',
  'Marka',
  'Model',
  'Yıl',
  'Şasi Numarası',
  'Renk',
  'Ruhsat Sahibi',
  'Alış Tarihi',
  'Alış Fiyatı',
  'Mevcut Hasar Durumu',
  'Trafik Sigortası Bitiş Tarihi',
  'Acente',
  'Acente Yetkilisi',
  'Acente Yetkili Tel',
  'Sigorta Poliçe Tutarı',
  'Kasko Bitiş Tarihi',
  'Acente (Kasko)',
  'Acente Yetkilisi (Kasko)',
  'Acente Yetkili Tel (Kasko)',
  'Kasko Poliçe Tutarı',
  'Muayene Bitiş Tarihi',
  'Araç Üzerindeki Lastik Tipi',
  'Lastik Ebatı',
  'Yedek Lastik Konumu',
  'Gps Sağlayıcı Firma',
  'Gps Cihaz ID / IMEI',
];

const HEADER_TO_FIELD: Record<string, string> = {
  'Plaka': 'plate',
  'Marka': 'brand',
  'Model': 'model',
  'Yıl': 'year',
  'Şasi Numarası': 'chassis_number',
  'Renk': 'color',
  'Ruhsat Sahibi': 'license_owner',
  'Alış Tarihi': 'purchase_date',
  'Alış Fiyatı': 'purchase_price',
  'Mevcut Hasar Durumu': 'initial_damage_status',
  'Trafik Sigortası Bitiş Tarihi': 'traffic_insurance_expiry',
  'Acente': 'traffic_insurance_agency',
  'Acente Yetkilisi': 'traffic_insurance_agent_name',
  'Acente Yetkili Tel': 'traffic_insurance_agent_phone',
  'Sigorta Poliçe Tutarı': 'traffic_insurance_amount',
  'Kasko Bitiş Tarihi': 'kasko_expiry',
  'Acente (Kasko)': 'kasko_agency',
  'Acente Yetkilisi (Kasko)': 'kasko_agent_name',
  'Acente Yetkili Tel (Kasko)': 'kasko_agent_phone',
  'Kasko Poliçe Tutarı': 'kasko_amount',
  'Muayene Bitiş Tarihi': 'inspection_expiry',
  'Araç Üzerindeki Lastik Tipi': 'tire_type',
  'Lastik Ebatı': 'tire_size',
  'Yedek Lastik Konumu': 'spare_tire_location',
  'Gps Sağlayıcı Firma': 'gps_provider',
  'Gps Cihaz ID / IMEI': 'gps_device_id',
};

const TIRE_TYPE_MAP: Record<string, string> = {
  'yaz': 'summer',
  'yazlık': 'summer',
  'yazlik': 'summer',
  'summer': 'summer',
  'kış': 'winter',
  'kis': 'winter',
  'kışlık': 'winter',
  'kislik': 'winter',
  'winter': 'winter',
  '4 mevsim': 'all_season',
  'dört mevsim': 'all_season',
  'dort mevsim': 'all_season',
  'all season': 'all_season',
  'all_season': 'all_season',
};

export interface VehicleImportRow {
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  chassis_number: string | null;
  color: string | null;
  license_owner: string | null;
  purchase_date: string | null;
  purchase_price: number;
  initial_damage_status: string | null;
  traffic_insurance_expiry: string | null;
  traffic_insurance_agency: string | null;
  traffic_insurance_agent_name: string | null;
  traffic_insurance_agent_phone: string | null;
  traffic_insurance_amount: number | null;
  kasko_expiry: string | null;
  kasko_agency: string | null;
  kasko_agent_name: string | null;
  kasko_agent_phone: string | null;
  kasko_amount: number | null;
  inspection_expiry: string | null;
  tire_type: 'summer' | 'winter' | 'all_season' | null;
  tire_size: string | null;
  spare_tire_location: string | null;
  gps_provider: string | null;
  gps_device_id: string | null;
  has_tracker: boolean;
  status: 'idle';
  company_id: string;
}

export function downloadVehicleTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
  ws['!cols'] = TEMPLATE_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Araçlar');
  XLSX.writeFile(wb, 'Arac_Import_Sablonu.xlsx');
}

export function parseVehicleExcel(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          reject(new Error('Excel dosyasında sayfa bulunamadı.'));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
          raw: false,
          dateNF: 'yyyy-mm-dd',
        });
        resolve(rows);
      } catch {
        reject(new Error('Excel dosyası okunamadı. Lütfen geçerli bir dosya yükleyin.'));
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsArrayBuffer(file);
  });
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  return String(val).trim();
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = String(val).replace(/[^\d.,-]/g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function toDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parts = str.split(/[./]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d.length <= 2 && m.length <= 2 && y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseTireType(val: unknown): 'summer' | 'winter' | 'all_season' | null {
  if (val === null || val === undefined || val === '') return null;
  const key = String(val).trim().toLowerCase();
  return (TIRE_TYPE_MAP[key] as 'summer' | 'winter' | 'all_season') ?? null;
}

export function mapRowsToVehicles(
  rows: Record<string, unknown>[],
  companyId: string
): { vehicles: VehicleImportRow[]; errors: string[] } {
  const vehicles: VehicleImportRow[] = [];
  const errors: string[] = [];

  const seenPlates = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const mapped: Record<string, unknown> = {};

    for (const [header, field] of Object.entries(HEADER_TO_FIELD)) {
      mapped[field] = row[header] ?? null;
    }

    const plate = String(mapped.plate || '').trim().toUpperCase();
    const brand = String(mapped.brand || '').trim();
    const model = String(mapped.model || '').trim();

    if (!plate) {
      errors.push(`Satır ${rowNum}: Plaka boş bırakılamaz.`);
      return;
    }

    if (seenPlates.has(plate)) {
      errors.push(`Satır ${rowNum}: "${plate}" plakası dosyada birden fazla kez tekrarlanıyor.`);
      return;
    }
    seenPlates.add(plate);
    if (!brand) {
      errors.push(`Satır ${rowNum}: Marka boş bırakılamaz.`);
      return;
    }
    if (!model) {
      errors.push(`Satır ${rowNum}: Model boş bırakılamaz.`);
      return;
    }

    const yearVal = mapped.year ? Number(mapped.year) : null;
    if (yearVal !== null && (isNaN(yearVal) || yearVal < 1900 || yearVal > new Date().getFullYear() + 2)) {
      errors.push(`Satır ${rowNum}: Geçersiz yıl değeri (${mapped.year}).`);
      return;
    }

    const purchasePrice = toNum(mapped.purchase_price) ?? 0;
    const tireType = parseTireType(mapped.tire_type);
    const hasGps = !!(toStr(mapped.gps_provider) || toStr(mapped.gps_device_id));

    vehicles.push({
      plate,
      brand,
      model,
      year: yearVal,
      chassis_number: toStr(mapped.chassis_number),
      color: toStr(mapped.color),
      license_owner: toStr(mapped.license_owner),
      purchase_date: toDate(mapped.purchase_date),
      purchase_price: purchasePrice,
      initial_damage_status: toStr(mapped.initial_damage_status),
      traffic_insurance_expiry: toDate(mapped.traffic_insurance_expiry),
      traffic_insurance_agency: toStr(mapped.traffic_insurance_agency),
      traffic_insurance_agent_name: toStr(mapped.traffic_insurance_agent_name),
      traffic_insurance_agent_phone: toStr(mapped.traffic_insurance_agent_phone),
      traffic_insurance_amount: toNum(mapped.traffic_insurance_amount),
      kasko_expiry: toDate(mapped.kasko_expiry),
      kasko_agency: toStr(mapped.kasko_agency),
      kasko_agent_name: toStr(mapped.kasko_agent_name),
      kasko_agent_phone: toStr(mapped.kasko_agent_phone),
      kasko_amount: toNum(mapped.kasko_amount),
      inspection_expiry: toDate(mapped.inspection_expiry),
      tire_type: tireType,
      tire_size: toStr(mapped.tire_size),
      spare_tire_location: toStr(mapped.spare_tire_location),
      gps_provider: toStr(mapped.gps_provider),
      gps_device_id: toStr(mapped.gps_device_id),
      has_tracker: hasGps,
      status: 'idle',
      company_id: companyId,
    });
  });

  return { vehicles, errors };
}
