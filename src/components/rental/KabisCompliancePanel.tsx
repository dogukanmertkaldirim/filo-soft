import { useState } from 'react';
import { Copy, CheckCircle, AlertTriangle, Shield, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../utils/auditLog';
import { formatDate } from '../../utils/format';
import type { Rental, Vehicle, Customer } from '../../types/database';
import Button from '../ui/Button';

interface KabisCompliancePanelProps {
  rental: Rental;
  vehicle: Vehicle;
  customer: Customer;
  companyId: string;
  userEmail?: string | null;
  onUpdate?: () => void;
}

interface CopyField {
  label: string;
  value: string;
}

function CopyRow({ label, value }: CopyField) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-500 block">{label}</span>
        <span className="text-sm font-mono font-medium text-slate-900 truncate block">{value || '-'}</span>
      </div>
      <button
        onClick={handleCopy}
        disabled={!value}
        className={`flex-shrink-0 ml-3 p-2 rounded-lg transition-all ${
          copied
            ? 'bg-green-100 text-green-600'
            : 'bg-white border border-slate-200 text-slate-500 hover:text-teal-600 hover:border-teal-300 opacity-0 group-hover:opacity-100'
        } disabled:opacity-30 disabled:cursor-not-allowed`}
        title={copied ? 'Kopyalandi!' : 'Kopyala'}
      >
        {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      {copied && (
        <span className="absolute right-12 text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
          Kopyalandi
        </span>
      )}
    </div>
  );
}

export default function KabisCompliancePanel({
  rental,
  vehicle,
  customer,
  companyId,
  userEmail,
  onUpdate,
}: KabisCompliancePanelProps) {
  const [marking, setMarking] = useState(false);
  const isReported = rental.kabis_notification_status === true;

  const startTime = rental.start_datetime
    ? new Date(rental.start_datetime).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : formatDate(rental.start_date);

  const endTime = rental.end_datetime
    ? new Date(rental.end_datetime).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : formatDate(rental.end_date);

  const isForeign = customer.is_foreign === true;

  const citizenFields: CopyField[] = [
    { label: 'TC Kimlik No', value: customer.tc_kimlik_no || '' },
    { label: 'Ad', value: customer.first_name || '' },
    { label: 'Soyad', value: customer.last_name || '' },
    { label: 'Baba Adi', value: customer.father_name || '' },
    { label: 'Dogum Yeri', value: customer.birth_place || '' },
    { label: 'Dogum Tarihi', value: customer.birth_date ? formatDate(customer.birth_date) : '' },
  ];

  const foreignFields: CopyField[] = [
    { label: 'Pasaport No', value: customer.passport_no || '' },
    { label: 'Uyruk', value: customer.nationality || '' },
    { label: 'Ad', value: customer.first_name || '' },
    { label: 'Soyad', value: customer.last_name || '' },
  ];

  const rentalFields: CopyField[] = [
    { label: 'Plaka', value: vehicle.plate || '' },
    { label: 'Sozlesme Baslangic', value: startTime },
    { label: 'Sozlesme Bitis', value: endTime },
  ];

  const personFields = isForeign ? foreignFields : citizenFields;
  const missingFields = personFields.filter(f => !f.value);
  const hasMissing = missingFields.length > 0;

  async function handleMarkReported() {
    setMarking(true);

    const { error } = await supabase
      .from('rentals')
      .update({
        kabis_notification_status: true,
        kabis_reported_by: userEmail || 'system',
        kabis_reported_at: new Date().toISOString(),
      } as any)
      .eq('id', rental.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'Rental',
        entityId: rental.id,
        details: `KABIS bildirimi yapildi olarak isaretlendi: ${vehicle.plate} - ${customer.company_title}`,
        userEmail: userEmail || undefined,
        companyId,
      });
      onUpdate?.();
    }

    setMarking(false);
  }

  async function handleUnmarkReported() {
    setMarking(true);

    const { error } = await supabase
      .from('rentals')
      .update({
        kabis_notification_status: false,
        kabis_reported_by: null,
        kabis_reported_at: null,
      } as any)
      .eq('id', rental.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'Rental',
        entityId: rental.id,
        details: `KABIS bildirimi geri alindi: ${vehicle.plate} - ${customer.company_title}`,
        userEmail: userEmail || undefined,
        companyId,
      });
      onUpdate?.();
    }

    setMarking(false);
  }

  return (
    <div className="space-y-5">
      {/* Status Badge */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        isReported
          ? 'bg-green-50 border-green-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className={`p-2 rounded-lg ${isReported ? 'bg-green-100' : 'bg-amber-100'}`}>
          {isReported
            ? <Shield className="h-5 w-5 text-green-700" />
            : <AlertTriangle className="h-5 w-5 text-amber-700" />
          }
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isReported ? 'text-green-800' : 'text-amber-800'}`}>
            KABIS Bildirim Durumu: {isReported ? 'Bildirildi' : 'Bildirilmedi'}
          </p>
          {isReported && rental.kabis_reported_at && (
            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(rental.kabis_reported_at).toLocaleString('tr-TR')} - {rental.kabis_reported_by}
            </p>
          )}
          {!isReported && (
            <p className="text-xs text-amber-600 mt-0.5">
              Bu kiralama henuz Emniyet KABIS sistemine bildirilmedi
            </p>
          )}
        </div>
      </div>

      {/* Missing fields warning */}
      {hasMissing && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs font-medium text-red-700 mb-1">Eksik KABIS Alanlari:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map(f => (
              <span key={f.label} className="px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 rounded-full">
                {f.label}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-red-500 mt-2">
            Lutfen musteri bilgilerini guncelleyerek eksik alanlari tamamlayin.
          </p>
        </div>
      )}

      {/* Quick Copy - Person Info */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          {isForeign ? 'Yabanci Uyruklu Bilgileri' : 'TC Vatandasi Bilgileri'}
        </h4>
        <div className="space-y-1.5 relative">
          {personFields.map(f => (
            <CopyRow key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      </div>

      {/* Quick Copy - Rental Info */}
      <div>
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Kiralama / Arac Bilgileri
        </h4>
        <div className="space-y-1.5 relative">
          {rentalFields.map(f => (
            <CopyRow key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      </div>

      {/* Mark as reported toggle */}
      <div className="pt-3 border-t border-slate-200">
        {isReported ? (
          <Button
            variant="secondary"
            onClick={handleUnmarkReported}
            disabled={marking}
            className="w-full"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {marking ? 'Isleniyor...' : 'Bildirimi Geri Al'}
          </Button>
        ) : (
          <Button
            onClick={handleMarkReported}
            disabled={marking}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Shield className="h-4 w-4 mr-2" />
            {marking ? 'Isleniyor...' : 'Emniyet KABIS Sistemine Bildirildi Olarak Isaretle'}
          </Button>
        )}
      </div>
    </div>
  );
}
