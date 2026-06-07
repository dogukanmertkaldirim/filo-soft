import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Car,
  Users,
  Wallet,
  Truck,
  BarChart3,
  ShoppingCart,
  Menu,
  X,
  Building2,
  Search,
  LogOut,
  Factory,
  Landmark,
  Shield,
  Settings,
  ChevronDown,
  User,
  Wrench,
  Calendar,
  StickyNote,
  CalendarClock,
  MessageSquareMore,
  Bell,
  Plug,
  Puzzle,
  Briefcase,
  PieChart,
  FolderCog,
  Crown,
  CircleUser,
  UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { ModuleType } from '../types/database';

interface LayoutProps {
  children: React.ReactNode;
}

interface SearchResult {
  type: 'vehicle' | 'customer' | 'supplier' | 'loan';
  id: string;
  title: string;
  subtitle: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  requiredModule?: ModuleType | ModuleType[];
  adminOnly?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const standaloneItems: NavItem[] = [
  { path: '/', label: 'Kontrol Paneli', icon: LayoutDashboard },
];

const navGroups: NavGroup[] = [
  {
    id: 'fleet',
    label: 'Filo Operasyonları',
    icon: Car,
    items: [
      { path: '/vehicles', label: 'Araçlar', icon: Car, requiredModule: 'rent_a_car' },
      { path: '/kabis', label: 'KABİS Bildirimleri', icon: Shield, requiredModule: 'rent_a_car' },
      { path: '/vip-transfers', label: 'VIP Transfer', icon: Crown },
      { path: '/drivers', label: 'Soforler', icon: CircleUser },
      { path: '/external-services', label: 'Dis Hizmetler & Lojistik', icon: Truck, requiredModule: ['transfer', 'logistics'] },
      { path: '/maintenances', label: 'Bakım & Servis', icon: Wrench, requiredModule: 'maintenance' },
      { path: '/service-appointments', label: 'Servis Randevuları', icon: CalendarClock, requiredModule: 'maintenance' },
      { path: '/vehicle-sales', label: 'Araç Satışları', icon: ShoppingCart, requiredModule: 'rent_a_car' },
    ],
  },
  {
    id: 'crm',
    label: 'Müşteri Yönetimi',
    icon: Briefcase,
    items: [
      { path: '/customers', label: 'Müşteriler', icon: Users, requiredModule: 'crm' },
      { path: '/customer-requests', label: 'Müşteri Talepleri', icon: MessageSquareMore, requiredModule: 'crm' },
      { path: '/suppliers', label: 'Tedarikciler', icon: Factory },
    ],
  },
  {
    id: 'finance',
    label: 'Finans Yönetimi',
    icon: Wallet,
    items: [
      { path: '/finance', label: 'Finans', icon: Wallet, requiredModule: 'finance' },
      { path: '/hgs-automation', label: 'HGS Otomasyonu', icon: Truck, requiredModule: 'finance' },
      { path: '/loans', label: 'Krediler', icon: Landmark, requiredModule: 'loans' },
    ],
  },
  {
    id: 'reports',
    label: 'Rapor & Analiz',
    icon: PieChart,
    items: [
      { path: '/reports', label: 'Raporlar', icon: BarChart3 },
      { path: '/audit-logs', label: 'İşlem Geçmişi', icon: Shield },
    ],
  },
  {
    id: 'office',
    label: 'Ofis & Sistem',
    icon: FolderCog,
    items: [
      { path: '/calendar', label: 'Takvim', icon: Calendar },
      { path: '/notes', label: 'Notlar', icon: StickyNote },
      { path: '/integrations', label: 'Entegrasyonlar', icon: Plug },
      { path: '/staff', label: 'Calisan Yonetimi', icon: UserPlus },
      { path: '/settings', label: 'Ayarlar', icon: Settings },
    ],
  },
];

const adminOnlyItems: NavItem[] = [
  { path: '/modules', label: 'Modüller', icon: Puzzle, adminOnly: true },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isSuperAdmin, company, effectiveCompanyId, isModuleActive } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  function findGroupForPath(path: string): string | null {
    for (const group of navGroups) {
      if (group.items.some(item => item.path === path)) {
        return group.id;
      }
    }
    return null;
  }

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const activeGroup = findGroupForPath(location.pathname);
    return activeGroup ? new Set([activeGroup]) : new Set<string>();
  });

  useEffect(() => {
    const activeGroup = findGroupForPath(location.pathname);
    if (activeGroup && !expandedGroups.has(activeGroup)) {
      setExpandedGroups(prev => new Set([...prev, activeGroup]));
    }
  }, [location.pathname]);

  function isItemVisible(item: NavItem): boolean {
    if (item.adminOnly && !isSuperAdmin) return false;
    if (!item.requiredModule) return true;
    if (Array.isArray(item.requiredModule)) {
      return item.requiredModule.some(mod => isModuleActive(mod));
    }
    return isModuleActive(item.requiredModule);
  }

  function toggleGroup(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && !sidebarOpen) {
        setSidebarOpen(true);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  useEffect(() => {
    loadLogo();

    function handleLogoChange(e: CustomEvent<{ logo_url: string | null }>) {
      setLogoUrl(e.detail.logo_url);
    }

    window.addEventListener('company-logo-changed', handleLogoChange as EventListener);
    return () => window.removeEventListener('company-logo-changed', handleLogoChange as EventListener);
  }, [effectiveCompanyId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.length >= 2) {
        performSearch(searchTerm);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    if (!effectiveCompanyId) return;

    async function loadPendingCount() {
      const [requestsRes, damagesRes] = await Promise.all([
        supabase
          .from('customer_requests')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', effectiveCompanyId)
          .eq('status', 'pending'),
        supabase
          .from('damage_reports')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', effectiveCompanyId)
          .in('status', ['pending', 'in_progress']),
      ]);
      const total = (requestsRes.count || 0) + (damagesRes.count || 0);
      setPendingCount(total);
    }

    loadPendingCount();
    const interval = setInterval(loadPendingCount, 60000);
    return () => clearInterval(interval);
  }, [effectiveCompanyId]);

  async function loadLogo() {
    if (!effectiveCompanyId) return;

    const { data } = await supabase
      .from('company_profiles')
      .select('logo_url')
      .eq('company_id', effectiveCompanyId)
      .eq('is_default', true)
      .maybeSingle();

    if (data?.logo_url) {
      setLogoUrl(data.logo_url);
    } else {
      const { data: anyProfile } = await supabase
        .from('company_profiles')
        .select('logo_url')
        .eq('company_id', effectiveCompanyId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (anyProfile?.logo_url) {
        setLogoUrl(anyProfile.logo_url);
      } else {
        setLogoUrl(null);
      }
    }
  }

  async function performSearch(term: string) {
    setSearching(true);
    const results: SearchResult[] = [];

    const [vehiclesRes, customersRes, suppliersRes, loansRes] = await Promise.all([
      supabase.from('vehicles').select('id, plate, brand, model').ilike('plate', `%${term}%`).limit(5),
      supabase.from('customers').select('id, company_title, authorized_person').or(`company_title.ilike.%${term}%,authorized_person.ilike.%${term}%`).limit(5),
      supabase.from('suppliers').select('id, name, contact_person').ilike('name', `%${term}%`).limit(5),
      supabase.from('loans').select('id, bank, title').or(`bank.ilike.%${term}%,title.ilike.%${term}%`).limit(5),
    ]);

    if (vehiclesRes.data) {
      vehiclesRes.data.forEach(v => {
        results.push({ type: 'vehicle', id: v.id, title: v.plate, subtitle: `${v.brand} ${v.model}` });
      });
    }
    if (customersRes.data) {
      customersRes.data.forEach(c => {
        results.push({ type: 'customer', id: c.id, title: c.company_title, subtitle: c.authorized_person || 'Müşteri' });
      });
    }
    if (suppliersRes.data) {
      suppliersRes.data.forEach(s => {
        results.push({ type: 'supplier', id: s.id, title: s.name, subtitle: s.contact_person || 'Tedarikçi' });
      });
    }
    if (loansRes.data) {
      loansRes.data.forEach(l => {
        results.push({ type: 'loan', id: l.id, title: l.bank, subtitle: l.title || 'Kredi' });
      });
    }

    setSearchResults(results);
    setShowResults(true);
    setSearching(false);
  }

  function handleResultClick(result: SearchResult) {
    setShowResults(false);
    setSearchTerm('');

    const searchParam = encodeURIComponent(result.id);

    switch (result.type) {
      case 'vehicle':
        navigate(`/vehicles?highlight=${searchParam}`);
        break;
      case 'customer':
        navigate(`/customers?highlight=${searchParam}`);
        break;
      case 'supplier':
        navigate(`/finance?highlight=${searchParam}&tab=suppliers`);
        break;
      case 'loan':
        navigate(`/loans?highlight=${searchParam}`);
        break;
    }

    window.dispatchEvent(new CustomEvent('global-search-select', { detail: result }));
  }

  function handleLogout() {
    setUserMenuOpen(false);
    logout();
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'vehicle': return <Car className="h-4 w-4" />;
      case 'customer': return <Users className="h-4 w-4" />;
      case 'supplier': return <Factory className="h-4 w-4" />;
      case 'loan': return <Landmark className="h-4 w-4" />;
      default: return null;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'vehicle': return 'Araç';
      case 'customer': return 'Müşteri';
      case 'supplier': return 'Tedarikçi';
      case 'loan': return 'Kredi';
      default: return '';
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

  function getRoleLabel() {
    if (user?.role === 'super_admin') return 'Super Admin';
    if (user?.role === 'admin') return 'Yönetici';
    return 'Kullanıcı';
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 z-40 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-[#0f172a] w-64 top-0 h-screen`}
      >
        <div className="flex flex-col h-full">
          <div className="h-[72px] flex items-center gap-3 border-b border-white/[0.06] px-5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="max-h-10 max-w-[160px] object-contain"
              />
            ) : (
              <>
                <div className="h-9 w-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div className="leading-none">
                  <span className="text-white font-semibold text-[15px] tracking-tight block">FiloSoft</span>
                  <span className="text-slate-500 text-[10px] tracking-wide uppercase">Filo Yönetimi</span>
                </div>
              </>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 sidebar-scroll">
            {standaloneItems.filter(isItemVisible).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-white/[0.08] text-white'
                      : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-emerald-400' : ''}`} />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 pb-1 px-3">
              <div className="h-px bg-white/[0.06]" />
            </div>

            {navGroups.map((group) => {
              const visibleItems = group.items.filter(isItemVisible);
              if (visibleItems.length === 0) return null;

              const isExpanded = expandedGroups.has(group.id);
              const hasActiveChild = visibleItems.some(item => location.pathname === item.path);
              const GroupIcon = group.icon;

              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                      hasActiveChild && !isExpanded
                        ? 'bg-white/[0.06] text-white'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    <GroupIcon className={`h-[18px] w-[18px] flex-shrink-0 ${hasActiveChild ? 'text-emerald-400' : ''}`} />
                    <span className="text-[13px] font-medium flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      } ${hasActiveChild ? 'text-emerald-400/60' : 'text-slate-600 group-hover:text-slate-400'}`}
                    />
                  </button>

                  <div
                    className="overflow-hidden transition-all duration-200 ease-in-out"
                    style={{
                      maxHeight: isExpanded ? `${visibleItems.length * 40}px` : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div className="ml-3 pl-3 border-l border-white/[0.06] py-0.5 space-y-0.5">
                      {visibleItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => isMobile && setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                            }`}
                          >
                            <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-emerald-400' : ''}`} />
                            <span className="text-[13px] font-medium">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {isSuperAdmin && (
              <>
                <div className="pt-2 pb-1 px-3">
                  <div className="h-px bg-white/[0.06]" />
                </div>
                <div className="px-3 pt-1 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Yönetim</span>
                </div>
                {adminOnlyItems.filter(isItemVisible).map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => isMobile && setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                        isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-emerald-400' : ''}`} />
                      <span className="text-[13px] font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          <div className="px-5 py-3.5 border-t border-white/[0.06]">
            <p className="text-[11px] text-slate-600 text-center font-medium">
              FiloSoft v2.0 &middot; &copy; 2025
            </p>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${sidebarOpen && !isMobile ? 'ml-64' : 'ml-0'}`}>
        <header className="sticky z-30 bg-white border-b border-slate-200 px-4 py-3 top-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div ref={searchRef} className="relative flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={isMobile ? "Ara..." : "Araç, müşteri, tedarikçi, kredi ara..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  className="w-full pl-10 pr-4 py-2 sm:py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 transition-all"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-slate-300 border-t-teal-600 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                  <div className="max-h-80 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                      >
                        <div className={`p-2 rounded-lg ${
                          result.type === 'vehicle' ? 'bg-teal-100 text-teal-600' :
                          result.type === 'customer' ? 'bg-blue-100 text-blue-600' :
                          result.type === 'supplier' ? 'bg-orange-100 text-orange-600' :
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                          {getTypeIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{result.title}</p>
                          <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          result.type === 'vehicle' ? 'bg-teal-100 text-teal-700' :
                          result.type === 'customer' ? 'bg-blue-100 text-blue-700' :
                          result.type === 'supplier' ? 'bg-orange-100 text-orange-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {getTypeLabel(result.type)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showResults && searchTerm.length >= 2 && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-50">
                  <p className="text-sm text-slate-500 text-center">Sonuç bulunamadı</p>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/customer-requests')}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              title="Bekleyen Talepler"
            >
              <Bell className="h-5 w-5 text-slate-600" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 min-w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>

            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="h-9 w-9 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                  {getUserInitials()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900 truncate max-w-[140px]">{user?.full_name}</p>
                  <p className="text-xs text-slate-500">{company?.name || getRoleLabel()}</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
                    <p className="text-xs text-slate-500">@{user?.username} - {getRoleLabel()}</p>
                    {company?.name && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {company.name}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Profilim
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Ayarlar
                  </Link>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Çıkış Yap
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
