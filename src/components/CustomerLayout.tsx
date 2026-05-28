import { useState, useEffect } from 'react';
import { Car, LogOut, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

export default function CustomerLayout({ children }: CustomerLayoutProps) {
  const { user, logout, company, companyId } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadLogo();
  }, [companyId]);

  async function loadLogo() {
    if (!companyId) return;

    const { data } = await supabase
      .from('company_profiles')
      .select('logo_url')
      .eq('company_id', companyId)
      .eq('is_default', true)
      .maybeSingle();

    if (data?.logo_url) {
      setLogoUrl(data.logo_url);
    } else {
      const { data: anyProfile } = await supabase
        .from('company_profiles')
        .select('logo_url')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      setLogoUrl(anyProfile?.logo_url || null);
    }
  }

  function getUserInitials() {
    if (!user?.full_name) return 'U';
    const names = user.full_name.split(' ');
    if (names.length >= 2) {
      return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    }
    return user.full_name.charAt(0).toUpperCase();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 max-w-[120px] object-contain"
                />
              ) : (
                <div className="h-10 w-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                  <Car className="h-5 w-5 text-white" />
                </div>
              )}
              {company?.name && (
                <span className="hidden sm:block text-sm font-medium text-slate-700">
                  {company.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                  {getUserInitials()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
                  <p className="text-xs text-slate-500">Musteri Portali</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Cikis</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-xs text-slate-500 text-center">
            &copy; 2025 Dogukan Mert KALDIRIM
          </p>
        </div>
      </footer>
    </div>
  );
}
