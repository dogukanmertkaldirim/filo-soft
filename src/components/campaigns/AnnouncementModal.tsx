import { useState, useEffect } from 'react';
import { AlertTriangle, Info, X, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

interface Announcement {
  id: string;
  type: string;
  title: string;
  content: string;
  target_audience: string;
  specific_tenant_id: string | null;
  tenant_id: string | null;
  action_link: string | null;
}

export default function AnnouncementModal() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadAnnouncements();
    }
  }, [user?.id]);

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('id, type, title, content, target_audience, specific_tenant_id, tenant_id, action_link')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) return;

    const userRole = user?.role;
    const userId = user?.id;

    const relevantAnnouncements = data.filter(a => {
      // Super Admin: only see announcements meant for testing/preview (none typically)
      if (userRole === 'super_admin') return false;

      // Fleet Admin (admin role): see announcements from Super Admin targeted at Fleet_Admins
      if (userRole === 'admin') {
        if (a.target_audience === 'Fleet_Admins' && !a.tenant_id) return true;
        if (a.target_audience === 'All' && !a.tenant_id) return true;
        return false;
      }

      // Customer (Tenant/Renter): see global "All" from Super Admin + local from their Fleet Admin
      if (userRole === 'customer') {
        // Global announcements from Super Admin
        if (a.target_audience === 'All' && !a.tenant_id) return true;
        // Local announcements from their Fleet Admin
        if (a.tenant_id === companyId) {
          if (a.target_audience === 'Tenants') return true;
          if (a.target_audience === 'Specific_Tenant' && a.specific_tenant_id === userId) return true;
          if (a.target_audience === 'All') return true;
        }
        return false;
      }

      // Driver: see global "All" + local from their Fleet Admin targeting drivers
      if (userRole === 'driver') {
        if (a.target_audience === 'All' && !a.tenant_id) return true;
        if (a.tenant_id === companyId) {
          if (a.target_audience === 'Drivers') return true;
          if (a.target_audience === 'All') return true;
        }
        return false;
      }

      // Staff: see all from their company
      if (userRole === 'staff') {
        if (a.target_audience === 'All' && !a.tenant_id) return true;
        if (a.tenant_id === companyId) return true;
        return false;
      }

      return false;
    });

    // Filter out already-seen non-critical announcements using localStorage
    const unseenAnnouncements = relevantAnnouncements.filter(a => {
      if (a.type === 'Payment_Warning') return true;
      const key = `hasSeenAnnouncement_${a.id}`;
      return !sessionStorage.getItem(key);
    });

    if (unseenAnnouncements.length > 0) {
      setAnnouncements(unseenAnnouncements);
      setCurrentIndex(0);
      setVisible(true);
    }
  }

  function handleClose() {
    const current = announcements[currentIndex];
    if (current && current.type !== 'Payment_Warning') {
      sessionStorage.setItem(`hasSeenAnnouncement_${current.id}`, 'true');
    }

    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setVisible(false);
    }
  }

  function handleRemindLater() {
    const current = announcements[currentIndex];
    if (current) {
      sessionStorage.setItem(`hasSeenAnnouncement_${current.id}`, 'true');
    }
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setVisible(false);
    }
  }

  if (!visible || announcements.length === 0) return null;

  const current = announcements[currentIndex];
  const isPaymentWarning = current.type === 'Payment_Warning';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-colors ${
          isPaymentWarning ? 'bg-red-900/50 backdrop-blur-sm' : 'bg-black/40 backdrop-blur-sm'
        }`}
        onClick={isPaymentWarning ? undefined : handleClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl transform transition-all ${
        isPaymentWarning ? 'bg-white border-2 border-red-300' : 'bg-white border border-slate-200'
      }`}>
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-start gap-3">
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${
            isPaymentWarning
              ? 'bg-red-100 text-red-600'
              : current.type === 'Legal'
              ? 'bg-slate-100 text-slate-600'
              : 'bg-blue-100 text-blue-600'
          }`}>
            {isPaymentWarning ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Info className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-lg font-bold ${isPaymentWarning ? 'text-red-900' : 'text-slate-900'}`}>
              {current.title}
            </h2>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              isPaymentWarning
                ? 'bg-red-100 text-red-700'
                : current.type === 'Legal'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {isPaymentWarning ? 'Odeme Uyarisi' : current.type === 'Legal' ? 'Yasal Bilgilendirme' : 'Bilgilendirme'}
            </span>
          </div>
          {!isPaymentWarning && (
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {isPaymentWarning && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
              <p className="text-sm text-red-800 font-medium leading-relaxed">
                Vadesi gecmis odemeniz bulunmaktadir. Hizmet kesintisi yasamamak icin lutfen odemenizi gerceklestirin.
              </p>
            </div>
          )}
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {current.content}
          </p>
        </div>

        {/* Actions */}
        <div className={`px-6 pb-5 flex gap-3 ${isPaymentWarning ? 'flex-col' : ''}`}>
          {isPaymentWarning ? (
            <>
              {current.action_link && (
                <a
                  href={current.action_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Odeme Yap / Detaylari Gor
                </a>
              )}
              <button
                onClick={handleRemindLater}
                className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors"
              >
                Daha Sonra Hatirlat
              </button>
            </>
          ) : (
            <div className="flex justify-end w-full">
              <Button onClick={handleClose}>
                Anladim / Kapat
              </Button>
            </div>
          )}
        </div>

        {/* Multi-announcement indicator */}
        {announcements.length > 1 && (
          <div className="px-6 pb-4 flex items-center justify-center gap-1.5">
            {announcements.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'w-4 bg-teal-600' : 'w-1.5 bg-slate-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
