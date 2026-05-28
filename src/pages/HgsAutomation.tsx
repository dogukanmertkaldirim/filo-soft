import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, FileText, CreditCard, Truck, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/auditLog';
import { formatCurrency } from '../utils/format';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface ParsedRow {
  plate: string;
  amount: number;
  date?: string;
  description?: string;
}

interface MatchedRow extends ParsedRow {
  customerId: string | null;
  customerName: string | null;
  rentalId: string | null;
  vehicleId: string | null;
  matched: boolean;
}

interface GroupedInvoice {
  customerId: string;
  customerName: string;
  plates: { plate: string; amount: number }[];
  totalAmount: number;
}

export default function HgsAutomation() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [parsedRows, setParsedRows] = useState<MatchedRow[]>([]);
  const [groupedInvoices, setGroupedInvoices] = useState<GroupedInvoice[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [creatingInvoices, setCreatingInvoices] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [companyId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  async function processFile(file: File) {
    setUploading(true);
    setFileName(file.name);
    setCompleted(false);
    setParsedRows([]);
    setGroupedInvoices([]);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let rows: ParsedRow[] = [];

      if (extension === 'xlsx' || extension === 'xls') {
        rows = await parseExcel(file);
      } else if (extension === 'csv') {
        rows = await parseCsv(file);
      } else {
        alert('PDF formati desteklenmemektedir. Lutfen Is Bankasi panelinden HGS dokumunuzu "Excel" veya "CSV" formatinda indirip yukleyiniz.');
        setUploading(false);
        setFileName('');
        return;
      }

      if (rows.length === 0) {
        alert('Dosyada gecerli HGS kaydi bulunamadi. Lutfen "Plaka" ve "Tutar" sutunlarinin mevcut oldugunu kontrol edin.');
        setUploading(false);
        setFileName('');
        return;
      }

      setUploading(false);
      setProcessing(true);
      const matched = await matchWithContracts(rows);
      setParsedRows(matched);
      groupByCustomer(matched);
      setProcessing(false);
    } catch {
      alert('Dosya okuma hatasi. Yalnizca .xlsx, .xls veya .csv formatlarini yukleyebilirsiniz.');
      setUploading(false);
      setProcessing(false);
      setFileName('');
    }
  }

  async function parseExcel(file: File): Promise<ParsedRow[]> {
    const { read, utils } = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 });

    const rows: ParsedRow[] = [];
    let plateCol = -1;
    let amountCol = -1;
    let dateCol = -1;
    let descCol = -1;

    for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
      const row = jsonData[i] as unknown[];
      if (!row) continue;
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase();
        if (cell.includes('plaka') || cell.includes('plate')) plateCol = j;
        if (cell.includes('tutar') || cell.includes('amount') || cell.includes('ucret') || cell.includes('toplam')) amountCol = j;
        if (cell.includes('tarih') || cell.includes('date')) dateCol = j;
        if (cell.includes('aciklama') || cell.includes('guzergah') || cell.includes('gecis')) descCol = j;
      }
      if (plateCol >= 0 && amountCol >= 0) break;
    }

    if (plateCol < 0 || amountCol < 0) {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[];
        if (!row) continue;
        for (let j = 0; j < row.length; j++) {
          const val = String(row[j] || '').replace(/\s/g, '').toUpperCase();
          if (/^\d{2}[A-Z]{1,3}\d{2,4}$/.test(val)) {
            plateCol = j;
            for (let k = j + 1; k < row.length; k++) {
              const numVal = parseFloat(String(row[k] || '').replace(',', '.'));
              if (!isNaN(numVal) && numVal > 0) {
                amountCol = k;
                break;
              }
            }
            break;
          }
        }
        if (plateCol >= 0 && amountCol >= 0) break;
      }
    }

    if (plateCol < 0 || amountCol < 0) return [];

    const headerRowIdx = (jsonData as unknown[][]).findIndex((row) => {
      if (!row) return false;
      const cell = String(row[plateCol] || '').toLowerCase();
      return cell.includes('plaka') || cell.includes('plate');
    });
    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;

    for (let i = startRow; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];
      if (!row || !row[plateCol]) continue;

      const plate = normalizePlate(String(row[plateCol]));
      const amountStr = String(row[amountCol] || '0').replace(/[^\d.,]/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);

      if (plate && !isNaN(amount) && amount > 0) {
        rows.push({
          plate,
          amount,
          date: dateCol >= 0 ? String(row[dateCol] || '') : undefined,
          description: descCol >= 0 ? String(row[descCol] || '') : undefined,
        });
      }
    }

    return rows;
  }

  async function parseCsv(file: File): Promise<ParsedRow[]> {
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.toLowerCase().trim());

    const plateIdx = headers.findIndex(h => h.includes('plaka') || h.includes('plate'));
    const amountIdx = headers.findIndex(h => h.includes('tutar') || h.includes('amount') || h.includes('ucret'));
    const dateIdx = headers.findIndex(h => h.includes('tarih') || h.includes('date'));

    if (plateIdx < 0 || amountIdx < 0) return [];

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator);
      const plate = normalizePlate(cols[plateIdx] || '');
      const amount = parseFloat((cols[amountIdx] || '0').replace(',', '.'));
      if (plate && !isNaN(amount) && amount > 0) {
        rows.push({
          plate,
          amount,
          date: dateIdx >= 0 ? cols[dateIdx] : undefined,
        });
      }
    }
    return rows;
  }

  function normalizePlate(raw: string): string {
    return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  async function matchWithContracts(rows: ParsedRow[]): Promise<MatchedRow[]> {
    if (!companyId) return rows.map(r => ({ ...r, customerId: null, customerName: null, rentalId: null, vehicleId: null, matched: false }));

    const uniquePlates = [...new Set(rows.map(r => r.plate))];

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, plate')
      .eq('company_id', companyId)
      .is('deleted_at', null);

    const vehicleByPlate: Record<string, string> = {};
    (vehicles || []).forEach(v => {
      const normalized = v.plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      vehicleByPlate[normalized] = v.id;
    });

    const matchedVehicleIds = uniquePlates
      .map(p => vehicleByPlate[p])
      .filter(Boolean);

    let rentalsByVehicle: Record<string, { id: string; customer_id: string }> = {};
    if (matchedVehicleIds.length > 0) {
      const { data: rentals } = await supabase
        .from('rentals')
        .select('id, vehicle_id, customer_id')
        .eq('company_id', companyId)
        .in('vehicle_id', matchedVehicleIds)
        .eq('status', 'active');

      (rentals || []).forEach(r => {
        rentalsByVehicle[r.vehicle_id] = { id: r.id, customer_id: r.customer_id };
      });
    }

    const customerIds = [...new Set(Object.values(rentalsByVehicle).map(r => r.customer_id).filter(Boolean))];
    let customerNames: Record<string, string> = {};
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, company_title')
        .in('id', customerIds);
      (customers || []).forEach(c => {
        customerNames[c.id] = c.company_title || '-';
      });
    }

    return rows.map(row => {
      const vehicleId = vehicleByPlate[row.plate] || null;
      const rental = vehicleId ? rentalsByVehicle[vehicleId] : null;
      return {
        ...row,
        vehicleId,
        rentalId: rental?.id || null,
        customerId: rental?.customer_id || null,
        customerName: rental ? customerNames[rental.customer_id] || '-' : null,
        matched: !!rental,
      };
    });
  }

  function groupByCustomer(matched: MatchedRow[]) {
    const grouped: Record<string, GroupedInvoice> = {};

    matched.filter(r => r.matched && r.customerId).forEach(row => {
      if (!grouped[row.customerId!]) {
        grouped[row.customerId!] = {
          customerId: row.customerId!,
          customerName: row.customerName || '-',
          plates: [],
          totalAmount: 0,
        };
      }
      const existing = grouped[row.customerId!].plates.find(p => p.plate === row.plate);
      if (existing) {
        existing.amount += row.amount;
      } else {
        grouped[row.customerId!].plates.push({ plate: row.plate, amount: row.amount });
      }
      grouped[row.customerId!].totalAmount += row.amount;
    });

    setGroupedInvoices(Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount));
  }

  async function createInvoices() {
    if (!companyId) return;
    setCreatingInvoices(true);

    const today = new Date().toISOString().split('T')[0];

    for (const invoice of groupedInvoices) {
      const description = invoice.plates
        .map(p => `${p.plate}: ${formatCurrency(p.amount)} TL`)
        .join(', ');

      await supabase.from('transactions').insert({
        type: 'income',
        category: 'HGS Yansitma Bedeli',
        description: `HGS Yansitma - ${invoice.customerName} (${description})`,
        amount: invoice.totalAmount,
        transaction_date: today,
        company_id: companyId,
        reference_type: 'hgs_reflection',
      });
    }

    await logActivity({
      action: 'CREATE',
      entity: 'Transaction',
      details: `HGS Yansitma faturalari olusturuldu: ${groupedInvoices.length} musteri, toplam ${formatCurrency(groupedInvoices.reduce((s, g) => s + g.totalAmount, 0))} TL`,
      companyId,
    });

    setCreatingInvoices(false);
    setShowConfirm(false);
    setCompleted(true);
  }

  function reset() {
    setParsedRows([]);
    setGroupedInvoices([]);
    setFileName('');
    setCompleted(false);
  }

  const unmatchedRows = parsedRows.filter(r => !r.matched);
  const totalParsed = parsedRows.length;
  const totalMatched = parsedRows.filter(r => r.matched).length;
  const totalAmount = groupedInvoices.reduce((s, g) => s + g.totalAmount, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">HGS Otomasyonu</h1>
            <p className="text-sm text-slate-500">Otomatik gecis ucreti yansitma sistemi</p>
          </div>
        </div>
        {parsedRows.length > 0 && (
          <Button variant="secondary" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yeni Dosya Yukle
          </Button>
        )}
      </div>

      {/* Upload Zone */}
      {parsedRows.length === 0 && !uploading && !processing && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
        >
          <label className="cursor-pointer block">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-blue-100 rounded-full mb-4">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Is Bankasi HGS Dokum Dosyasini Yukleyin
              </h3>
              <p className="text-sm text-slate-500 mb-4 max-w-md">
                Is Bankasi panelinden indirdiginiz HGS gecis dokumunu (.xlsx, .xls, .csv) surukleyip birakin
                veya tiklayin. Sistem "Plaka" ve "Tutar" sutunlarini otomatik algilayacaktir.
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx</span>
                <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> .xls</span>
                <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> .csv</span>
              </div>
              <p className="text-xs text-red-400 mt-3">PDF formati desteklenmez - Excel veya CSV olarak indirin.</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      )}

      {/* Loading States */}
      {(uploading || processing) && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm font-medium text-slate-700">
            {uploading ? 'Dosya okunuyor...' : 'Sozlesmeler eslestiriliyor...'}
          </p>
          {fileName && <p className="text-xs text-slate-400 mt-1">{fileName}</p>}
        </div>
      )}

      {/* Results */}
      {parsedRows.length > 0 && !processing && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Toplam Kayit</p>
              <p className="text-2xl font-bold text-slate-900">{totalParsed}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Eslesen</p>
              <p className="text-2xl font-bold text-green-600">{totalMatched}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Eslesmeyen</p>
              <p className="text-2xl font-bold text-red-500">{unmatchedRows.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Toplam Tutar</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)} TL</p>
            </div>
          </div>

          {/* Completed State */}
          {completed && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">Faturalar Basariyla Olusturuldu</h3>
                <p className="text-sm text-green-700 mt-0.5">
                  {groupedInvoices.length} musteri icin toplam {formatCurrency(totalAmount)} TL tutarinda HGS yansitma faturasi taslagi olusturuldu.
                </p>
              </div>
            </div>
          )}

          {/* Grouped Invoice Preview */}
          {groupedInvoices.length > 0 && !completed && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <h2 className="font-semibold text-slate-900">HGS Yansitma Ozeti</h2>
                </div>
                <Button onClick={() => setShowConfirm(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  HGS Yansitma Faturasi Taslagi Olustur
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Musteri Firmasi</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Arac Plakalari</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600 text-xs uppercase tracking-wider">Toplam Gecis Tutari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedInvoices.map((invoice) => (
                      <tr key={invoice.customerId} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-slate-900">{invoice.customerName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {invoice.plates.map((p) => (
                              <span key={p.plate} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-medium">
                                {p.plate} ({formatCurrency(p.amount)} TL)
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-bold text-slate-900">{formatCurrency(invoice.totalAmount)} TL</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="py-3 px-4 text-right font-semibold text-slate-700 text-sm">Genel Toplam:</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-700 text-sm">{formatCurrency(totalAmount)} TL</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Unmatched Rows */}
          {unmatchedRows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200">
              <div className="p-4 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <h2 className="font-semibold text-slate-900">Eslesmeyen Kayitlar</h2>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{unmatchedRows.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-2 px-4 font-medium text-slate-600 text-xs">Plaka</th>
                      <th className="text-right py-2 px-4 font-medium text-slate-600 text-xs">Tutar</th>
                      <th className="text-center py-2 px-4 font-medium text-slate-600 text-xs">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 px-4 text-sm font-medium text-slate-900">{row.plate}</td>
                        <td className="py-2 px-4 text-sm text-right text-slate-700">{formatCurrency(row.amount)} TL</td>
                        <td className="py-2 px-4 text-center">
                          <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                            Sozlesme Bulunamadi
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="HGS Yansitma Onayi"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{groupedInvoices.length}</span> musteri icin toplam{' '}
              <span className="font-semibold">{formatCurrency(totalAmount)} TL</span> tutarinda
              HGS yansitma gelir kaydı olusturulacak.
            </p>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {groupedInvoices.map((inv) => (
              <div key={inv.customerId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-700">{inv.customerName}</span>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(inv.totalAmount)} TL</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>Iptal</Button>
            <Button onClick={createInvoices} disabled={creatingInvoices}>
              {creatingInvoices ? 'Olusturuluyor...' : 'Onayla ve Olustur'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
