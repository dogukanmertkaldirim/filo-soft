import { useState, useEffect } from 'react';
import { FileText, Download, ExternalLink, Car, Shield, FileCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  license_document_url: string | null;
  traffic_insurance_policy_url: string | null;
  kasko_policy_url: string | null;
  traffic_insurance_expiry: string | null;
  kasko_expiry: string | null;
}

interface Rental {
  id: string;
  contract_document_url: string | null;
  handover_document_url: string | null;
  start_date: string;
}

interface Props {
  vehicleIds: string[];
  companyId: string;
}

interface Document {
  id: string;
  name: string;
  type: 'license' | 'insurance' | 'kasko' | 'contract' | 'handover';
  url: string;
  expiry?: string | null;
  vehiclePlate: string;
}

export default function DigitalGlovebox({ vehicleIds, companyId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [vehicleIds, companyId]);

  async function loadDocuments() {
    if (vehicleIds.length === 0) {
      setLoading(false);
      return;
    }

    const docs: Document[] = [];

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, plate, brand, model, license_document_url, traffic_insurance_policy_url, kasko_policy_url, traffic_insurance_expiry, kasko_expiry')
      .in('id', vehicleIds)
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (vehicles) {
      vehicles.forEach((v: Vehicle) => {
        if (v.license_document_url) {
          docs.push({
            id: `license-${v.id}`,
            name: `Ruhsat - ${v.plate}`,
            type: 'license',
            url: v.license_document_url,
            vehiclePlate: v.plate,
          });
        }
        if (v.traffic_insurance_policy_url) {
          docs.push({
            id: `insurance-${v.id}`,
            name: `Trafik Sigortasi - ${v.plate}`,
            type: 'insurance',
            url: v.traffic_insurance_policy_url,
            expiry: v.traffic_insurance_expiry,
            vehiclePlate: v.plate,
          });
        }
        if (v.kasko_policy_url) {
          docs.push({
            id: `kasko-${v.id}`,
            name: `Kasko - ${v.plate}`,
            type: 'kasko',
            url: v.kasko_policy_url,
            expiry: v.kasko_expiry,
            vehiclePlate: v.plate,
          });
        }
      });
    }

    const { data: rentals } = await supabase
      .from('rentals')
      .select('id, vehicle_id, contract_document_url, handover_document_url, start_date')
      .in('vehicle_id', vehicleIds)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });

    if (rentals && vehicles) {
      rentals.forEach((r: Rental & { vehicle_id: string }) => {
        const vehicle = vehicles.find((v: Vehicle) => v.id === r.vehicle_id);
        const plate = vehicle?.plate || 'Arac';

        if (r.contract_document_url) {
          docs.push({
            id: `contract-${r.id}`,
            name: `Sozlesme - ${plate}`,
            type: 'contract',
            url: r.contract_document_url,
            vehiclePlate: plate,
          });
        }
        if (r.handover_document_url) {
          docs.push({
            id: `handover-${r.id}`,
            name: `Teslim Tutanagi - ${plate}`,
            type: 'handover',
            url: r.handover_document_url,
            vehiclePlate: plate,
          });
        }
      });
    }

    setDocuments(docs);
    setLoading(false);
  }

  function getIcon(type: string) {
    switch (type) {
      case 'license':
        return <Car className="h-5 w-5" />;
      case 'insurance':
      case 'kasko':
        return <Shield className="h-5 w-5" />;
      case 'contract':
      case 'handover':
        return <FileCheck className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'license':
        return 'bg-teal-100 text-teal-600';
      case 'insurance':
        return 'bg-blue-100 text-blue-600';
      case 'kasko':
        return 'bg-sky-100 text-sky-600';
      case 'contract':
        return 'bg-emerald-100 text-emerald-600';
      case 'handover':
        return 'bg-amber-100 text-amber-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  function isExpiringSoon(expiry: string | null | undefined) {
    if (!expiry) return false;
    const expiryDate = new Date(expiry);
    const today = new Date();
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  }

  function isExpired(expiry: string | null | undefined) {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-teal-100 rounded-xl">
            <FileText className="h-6 w-6 text-teal-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Dijital Torpido</h2>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-teal-100 rounded-xl">
          <FileText className="h-6 w-6 text-teal-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dijital Torpido</h2>
          <p className="text-sm text-slate-500">{documents.length} belge</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Belge bulunmuyor</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className={`p-2.5 rounded-xl ${getTypeColor(doc.type)}`}>
                {getIcon(doc.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                {doc.expiry && (
                  <p className={`text-xs ${
                    isExpired(doc.expiry)
                      ? 'text-red-600'
                      : isExpiringSoon(doc.expiry)
                        ? 'text-amber-600'
                        : 'text-slate-500'
                  }`}>
                    {isExpired(doc.expiry)
                      ? 'Suresi dolmus'
                      : `Gecerlilik: ${new Date(doc.expiry).toLocaleDateString('tr-TR')}`
                    }
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  title="Goruntule"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
                <a
                  href={doc.url}
                  download
                  className="p-2.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  title="Indir"
                >
                  <Download className="h-5 w-5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
