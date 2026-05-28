import { useState, useEffect } from 'react';
import { AlertTriangle, Phone, X, Shield, Truck, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  companyId: string;
  defaultPhone?: string;
}

export default function EmergencySOS({ companyId, defaultPhone = '+90 555 123 4567' }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [supportPhone, setSupportPhone] = useState(defaultPhone);

  useEffect(() => {
    loadSupportPhone();
  }, [companyId]);

  async function loadSupportPhone() {
    const { data } = await supabase
      .from('company_settings')
      .select('company_phone')
      .maybeSingle();

    if (data?.company_phone) {
      setSupportPhone(data.company_phone);
    }
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="font-semibold text-sm">SOS</span>
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50"
        onClick={() => setIsExpanded(false)}
      />
      <div className="fixed bottom-20 right-4 left-4 sm:bottom-6 sm:right-6 sm:left-auto sm:w-80 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Acil Durum</h3>
                <p className="text-xs text-red-100">Yardim icin asagidaki secenekleri kullanin</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <a
            href="tel:112"
            className="flex items-center gap-4 p-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-xl transition-colors"
          >
            <div className="p-3 bg-red-600 rounded-xl">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-800 text-lg">112 Acil Yardim</p>
              <p className="text-sm text-red-600">Ambulans / Polis / Itfaiye</p>
            </div>
            <Phone className="h-5 w-5 text-red-400" />
          </a>

          <a
            href={`tel:${supportPhone.replace(/\s/g, '')}`}
            className="flex items-center gap-4 p-4 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-xl transition-colors"
          >
            <div className="p-3 bg-amber-600 rounded-xl">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-800">Yol Yardim</p>
              <p className="text-sm text-amber-600">Cekici / Lastik / Aku</p>
            </div>
            <Phone className="h-5 w-5 text-amber-400" />
          </a>

          <a
            href={`tel:${supportPhone.replace(/\s/g, '')}`}
            className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            <div className="p-3 bg-slate-600 rounded-xl">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-800">Sigorta Destek</p>
              <p className="text-sm text-slate-600">Kaza ve hasar bildirimi</p>
            </div>
            <Phone className="h-5 w-5 text-slate-400" />
          </a>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs text-center text-slate-400">
            Kaza durumunda once 112'yi arayin, ardindan bize bildirin.
          </p>
        </div>
      </div>
    </>
  );
}
