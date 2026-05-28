import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { AppUser, Company, ModuleType } from '../types/database';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AppUser | null;
  company: Company | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginCustomer: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginDriver: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  unifiedLogin: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updatePassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  isDriver: boolean;
  companyId: string | null;
  effectiveCompanyId: string | null;
  activeModules: ModuleType[];
  isModuleActive: (module: ModuleType) => boolean;
  updateModules: (modules: ModuleType[]) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedAuth = localStorage.getItem('fleet_auth');
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        const sessionAge = Date.now() - (parsed.timestamp || 0);
        const MAX_SESSION_MS = 24 * 60 * 60 * 1000;
        if (sessionAge > MAX_SESSION_MS) {
          localStorage.removeItem('fleet_auth');
          setLoading(false);
          return;
        }
        if (parsed.user && parsed.user.id) {
          verifySession(parsed.user.id);
        } else {
          setLoading(false);
        }
      } catch {
        localStorage.removeItem('fleet_auth');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  async function verifySession(userId: string) {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data || data.is_active === false) {
      localStorage.removeItem('fleet_auth');
      setIsAuthenticated(false);
      setUser(null);
      setCompany(null);
    } else {
      const userData = data as AppUser;
      setIsAuthenticated(true);
      setUser(userData);

      if (userData.company_id) {
        await loadCompany(userData.company_id);
      }
    }
    setLoading(false);
  }

  async function loadCompany(companyId: string) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (data) {
      setCompany(data as Company);
    }
  }

  async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      return { success: false, error: 'Bir hata oluştu. Lütfen tekrar deneyin.' };
    }

    if (!data) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    if (data.password !== password) {
      return { success: false, error: 'Yanlış şifre.' };
    }

    const userData = data as AppUser;
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('fleet_auth', JSON.stringify({ user: { id: userData.id, full_name: userData.full_name, username: userData.username, email: userData.email, company_id: userData.company_id }, timestamp: Date.now() }));

    if (userData.company_id) {
      await loadCompany(userData.company_id);
    }

    return { success: true };
  }

  async function loginCustomer(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('role', 'customer')
      .maybeSingle();

    if (error) {
      return { success: false, error: 'Bir hata oluştu. Lütfen tekrar deneyin.' };
    }

    if (!data) {
      return { success: false, error: 'Bu e-posta adresi ile kayıtlı müşteri bulunamadı.' };
    }

    if (data.password !== password) {
      return { success: false, error: 'Yanlış şifre.' };
    }

    const userData = data as AppUser;
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('fleet_auth', JSON.stringify({ user: { id: userData.id, full_name: userData.full_name, username: userData.username, email: userData.email, company_id: userData.company_id }, timestamp: Date.now() }));

    if (userData.company_id) {
      await loadCompany(userData.company_id);
    }

    return { success: true };
  }

  async function loginDriver(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('role', 'driver')
      .maybeSingle();

    if (error) {
      return { success: false, error: 'Bir hata oluştu. Lütfen tekrar deneyin.' };
    }

    if (!data) {
      return { success: false, error: 'Bu e-posta adresi ile kayıtlı sürücü bulunamadı.' };
    }

    if (data.password !== password) {
      return { success: false, error: 'Yanlış şifre.' };
    }

    if (data.is_active === false) {
      return { success: false, error: 'Hesabınız askıya alınmış. Lütfen yöneticinizle iletişime geçin.' };
    }

    const userData = data as AppUser;
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('fleet_auth', JSON.stringify({ user: { id: userData.id, full_name: userData.full_name, username: userData.username, email: userData.email, company_id: userData.company_id }, timestamp: Date.now() }));

    if (userData.company_id) {
      await loadCompany(userData.company_id);
    }

    return { success: true };
  }

  async function unifiedLogin(identifier: string, password: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');

    let query = supabase.from('app_users').select('*');

    if (isEmail) {
      query = query.eq('email', trimmed.toLowerCase());
    } else {
      query = query.eq('username', trimmed);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return { success: false, error: 'Bir hata oluştu. Lütfen tekrar deneyin.' };
    }

    if (!data) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    if (data.password !== password) {
      return { success: false, error: 'Yanlış şifre.' };
    }

    if (data.is_active === false) {
      return { success: false, error: 'Hesabınız askıya alınmış. Lütfen yöneticinizle iletişime geçin.' };
    }

    const userData = data as AppUser;
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem('fleet_auth', JSON.stringify({ user: { id: userData.id, full_name: userData.full_name, username: userData.username, email: userData.email, company_id: userData.company_id }, timestamp: Date.now() }));

    if (userData.company_id) {
      await loadCompany(userData.company_id);
    }

    return { success: true };
  }

  function logout() {
    setIsAuthenticated(false);
    setUser(null);
    setCompany(null);
    localStorage.removeItem('fleet_auth');
  }

  async function updatePassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('app_users')
      .update({ password: newPassword })
      .eq('id', userId);

    if (error) {
      return { success: false, error: 'Şifre güncellenirken bir hata oluştu.' };
    }

    return { success: true };
  }

  async function updateModules(modules: ModuleType[]): Promise<{ success: boolean; error?: string }> {
    if (!company?.id) {
      return { success: false, error: 'Şirket bulunamadı.' };
    }

    const { error } = await supabase
      .from('companies')
      .update({ active_modules: modules })
      .eq('id', company.id);

    if (error) {
      return { success: false, error: 'Modüller güncellenirken bir hata oluştu.' };
    }

    setCompany({ ...company, active_modules: modules });
    return { success: true };
  }

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isStaff = user?.role === 'staff';
  const isCustomer = user?.role === 'customer';
  const isDriver = user?.role === 'driver';
  const companyId = user?.company_id || null;
  const effectiveCompanyId = companyId;

  const defaultModules: ModuleType[] = ['rent_a_car', 'finance', 'maintenance', 'crm'];
  const activeModules: ModuleType[] = company?.active_modules || defaultModules;

  function isModuleActive(module: ModuleType): boolean {
    return activeModules.includes(module);
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      company,
      loading,
      login,
      loginCustomer,
      loginDriver,
      unifiedLogin,
      logout,
      updatePassword,
      isAdmin,
      isSuperAdmin,
      isCustomer,
      isStaff,
      isDriver,
      companyId,
      effectiveCompanyId,
      activeModules,
      isModuleActive,
      updateModules,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
