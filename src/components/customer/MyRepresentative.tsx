import { useState, useEffect } from 'react';
import { User, Phone, MessageCircle, Headphones, Clock, Mail, Globe } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Representative {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  title: string | null;
}

interface CompanyInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  working_hours: string | null;
}

interface Props {
  assignedRepId: string | null;
  companyId: string;
  defaultPhone?: string;
}

export default function MyRepresentative({ assignedRepId, companyId, defaultPhone = '+90 555 123 4567' }: Props) {
  const [rep, setRep] = useState<Representative | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [assignedRepId, companyId]);

  async function loadData() {
    const [repResult, settingsResult] = await Promise.all([
      assignedRepId
        ? supabase
            .from('app_users')
            .select('id, full_name, email, phone, avatar_url, title')
            .eq('id', assignedRepId)
            .eq('company_id', companyId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('company_settings')
        .select('company_name, company_email, company_phone, company_website, working_hours')
        .maybeSingle()
    ]);

    setRep(repResult.data);
    if (settingsResult.data) {
      setCompanyInfo({
        name: settingsResult.data.company_name,
        email: settingsResult.data.company_email,
        phone: settingsResult.data.company_phone,
        website: settingsResult.data.company_website,
        working_hours: settingsResult.data.working_hours
      });
    }
    setLoading(false);
  }

  function getWhatsAppLink(phone: string, message?: string) {
    const cleanPhone = phone.replace(/\s/g, '').replace(/^\+/, '');
    const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${cleanPhone}${encodedMessage}`;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="animate-pulse flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-200 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-32"></div>
            <div className="h-3 bg-slate-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  const workingHours = companyInfo?.working_hours || 'Pzt-Cmt: 09:00 - 18:00';
  const mainPhone = rep?.phone || companyInfo?.phone || defaultPhone;

  if (!rep) {
    return (
      <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-white/10 rounded-full backdrop-blur-sm">
            <Headphones className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Musteri Hizmetleri</h3>
            <p className="text-sm text-slate-300">Size yardimci olmaktan mutluluk duyariz</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg mb-4 text-sm">
          <Clock className="h-4 w-4 text-slate-400" />
          <span className="text-slate-300">Calisma Saatleri:</span>
          <span className="text-white font-medium">{workingHours}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <a
            href={`tel:${mainPhone.replace(/\s/g, '')}`}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
          >
            <Phone className="h-5 w-5" />
            <span className="text-sm font-medium">Simdi Ara</span>
          </a>
          <a
            href={getWhatsAppLink(mainPhone, 'Merhaba, yardima ihtiyacim var.')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 rounded-xl transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">WhatsApp</span>
          </a>
        </div>

        {(companyInfo?.email || companyInfo?.website) && (
          <div className="pt-3 border-t border-white/10 space-y-2">
            {companyInfo.email && (
              <a
                href={`mailto:${companyInfo.email}`}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
              >
                <Mail className="h-4 w-4" />
                {companyInfo.email}
              </a>
            )}
            {companyInfo.website && (
              <a
                href={companyInfo.website.startsWith('http') ? companyInfo.website : `https://${companyInfo.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
              >
                <Globe className="h-4 w-4" />
                {companyInfo.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-4 sm:p-6 shadow-lg text-white">
      <div className="flex items-center gap-4 mb-3">
        {rep.avatar_url ? (
          <img
            src={rep.avatar_url}
            alt={rep.full_name}
            className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
            <User className="h-7 w-7" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs text-teal-200 uppercase tracking-wide mb-0.5">Musteri Temsilciniz</p>
          <h3 className="text-lg font-semibold">{rep.full_name}</h3>
          {rep.title && <p className="text-sm text-teal-100">{rep.title}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg mb-4 text-sm">
        <Clock className="h-4 w-4 text-teal-200" />
        <span className="text-teal-100">Calisma Saatleri:</span>
        <span className="text-white font-medium">{workingHours}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <a
          href={`tel:${mainPhone.replace(/\s/g, '')}`}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
        >
          <Phone className="h-5 w-5" />
          <span className="text-sm font-medium">Simdi Ara</span>
        </a>
        <a
          href={getWhatsAppLink(mainPhone, `Merhaba ${rep.full_name}, yardima ihtiyacim var.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 rounded-xl transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">WhatsApp</span>
        </a>
      </div>

      {rep.email && (
        <div className="pt-3 border-t border-white/10">
          <a
            href={`mailto:${rep.email}`}
            className="flex items-center gap-2 text-sm text-teal-100 hover:text-white transition-colors"
          >
            <Mail className="h-4 w-4" />
            {rep.email}
          </a>
        </div>
      )}
    </div>
  );
}
