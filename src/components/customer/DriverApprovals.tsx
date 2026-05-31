import { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, Fuel, Gauge, AlertTriangle, Wrench,
  Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/format';
import Button from '../ui/Button';

interface DriverSubmission {
  id: string;
  submission_type: string;
  data: Record<string, any>;
  status: string;
  created_at: string;
  driver_id: string;
  vehicle_id: string;
  customer_drivers?: { driver_name: string; driver_phone: string } | null;
  vehicles?: { plate: string; brand: string; model: string } | null;
}

interface Props {
  userId: string;
  companyId: string;
}

export default function DriverApprovals({ userId, companyId }: Props) {
  const [submissions, setSubmissions] = useState<DriverSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, [userId, companyId, viewMode]);

  async function loadSubmissions() {
    setLoading(true);

    let query = supabase
      .from('driver_submissions')
      .select('*, customer_drivers(driver_name, driver_phone), vehicles(plate, brand, model)')
      .eq('tenant_customer_id', userId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (viewMode === 'pending') {
      query = query.eq('status', 'pending_tenant');
    } else {
      query = query.in('status', ['approved_pending_lessor', 'approved', 'rejected']);
    }

    const { data } = await query;
    setSubmissions(data || []);
    setLoading(false);
  }

  async function handleApprove(id: string) {
    setProcessing(id);
    await supabase
      .from('driver_submissions')
      .update({
        status: 'approved_pending_lessor',
        tenant_reviewed_at: new Date().toISOString(),
        tenant_reviewed_by: userId,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    await loadSubmissions();
    setProcessing(null);
  }

  async function handleReject(id: string) {
    const reason = prompt('Ret sebebi (istege bagli):');
    setProcessing(id);
    await supabase
      .from('driver_submissions')
      .update({
        status: 'rejected',
        tenant_reviewed_at: new Date().toISOString(),
        tenant_reviewed_by: userId,
        rejection_reason: reason || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    await loadSubmissions();
    setProcessing(null);
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'km_update': return <Gauge className="h-4 w-4 text-teal-600" />;
      case 'damage': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'malfunction': return <Wrench className="h-4 w-4 text-orange-600" />;
      case 'expense_receipt': return <Fuel className="h-4 w-4 text-amber-600" />;
      default: return <Clock className="h-4 w-4 text-slate-500" />;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'km_update': return 'KM Bildirimi';
      case 'damage': return 'Hasar Raporu';
      case 'malfunction': return 'Ariza Bildirimi';
      case 'expense_receipt': return 'Masraf Fisi';
      default: return type;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending_tenant':
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">Onay Bekliyor</span>;
      case 'approved_pending_lessor':
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">DMK'ya Gonderildi</span>;
      case 'approved':
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700">Onaylandi</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">Reddedildi</span>;
      default:
        return null;
    }
  }

  function renderSubmissionDetails(sub: DriverSubmission) {
    const data = sub.data || {};
    switch (sub.submission_type) {
      case 'km_update':
        return (
          <div className="space-y-1 text-xs text-slate-600">
            <p><span className="font-medium">Onceki KM:</span> {data.previous_km?.toLocaleString() || '-'}</p>
            <p><span className="font-medium">Yeni KM:</span> {data.km_value?.toLocaleString()}</p>
            <p><span className="font-medium">Tarih:</span> {data.date}</p>
          </div>
        );
      case 'damage':
        return (
          <div className="space-y-1 text-xs text-slate-600">
            <p><span className="font-medium">Konum:</span> {data.location}</p>
            <p><span className="font-medium">Aciklama:</span> {data.description}</p>
          </div>
        );
      case 'malfunction':
        return (
          <div className="space-y-1 text-xs text-slate-600">
            <p><span className="font-medium">Aciklama:</span> {data.description}</p>
          </div>
        );
      case 'expense_receipt':
        return (
          <div className="space-y-1 text-xs text-slate-600">
            <p><span className="font-medium">Tur:</span> {data.expense_type === 'fuel' ? 'Yakit' : data.expense_type}</p>
            <p><span className="font-medium">Tutar:</span> {formatCurrency(data.amount)} TL</p>
            {data.liters && <p><span className="font-medium">Miktar:</span> {data.liters} Lt</p>}
            <p><span className="font-medium">Tarih:</span> {data.date}</p>
          </div>
        );
      default:
        return <pre className="text-xs text-slate-500">{JSON.stringify(data, null, 2)}</pre>;
    }
  }

  const pendingCount = submissions.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setViewMode('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'pending'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Bekleyen ({viewMode === 'pending' ? pendingCount : '...'})
        </button>
        <button
          onClick={() => setViewMode('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'history'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Gecmis
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-600 font-medium">
            {viewMode === 'pending' ? 'Bekleyen talep yok' : 'Gecmis kayit bulunamadi'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <div
              key={sub.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {getTypeIcon(sub.submission_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{getTypeLabel(sub.submission_type)}</p>
                      {getStatusBadge(sub.status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sub.customer_drivers?.driver_name || 'Surucu'} - {sub.vehicles?.plate || ''}
                      {' '}&middot;{' '}
                      {new Date(sub.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  {expandedId === sub.id ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {expandedId === sub.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                  <div className="mb-3">
                    {renderSubmissionDetails(sub)}
                  </div>

                  {sub.status === 'pending_tenant' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleApprove(sub.id)}
                        loading={processing === sub.id}
                        className="flex-1 !bg-green-600 hover:!bg-green-700 !text-xs"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Onayla ve DMK'ya Gonder
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleReject(sub.id)}
                        loading={processing === sub.id}
                        className="flex-1 !text-xs !border-red-200 !text-red-600 hover:!bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reddet
                      </Button>
                    </div>
                  )}

                  {sub.status === 'rejected' && sub.data?.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-700">
                        <span className="font-medium">Ret sebebi:</span> {(sub as any).rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
