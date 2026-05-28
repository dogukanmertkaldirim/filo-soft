import { useState } from 'react';
import { User, Building2, UserCog, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileSettings from '../components/settings/ProfileSettings';
import BillingProfiles from '../components/settings/BillingProfiles';
import UserManagement from '../components/settings/UserManagement';

type SettingsTab = 'profile' | 'billing' | 'users';

export default function Settings() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const tabs: { id: SettingsTab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'billing', label: 'Kesim Adresleri', icon: Building2 },
    { id: 'users', label: 'Kullanici Yonetimi', icon: UserCog },
  ];

  const visibleTabs = tabs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ayarlar</h1>
        <p className="text-slate-600">Profil, fatura profilleri ve sistem ayarlari</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                  isActive
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.id === 'users' && (
                  <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-semibold ${
                    isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Lock className="h-2.5 w-2.5 inline -mt-0.5" />
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'profile' && <ProfileSettings />}
      {activeTab === 'billing' && <BillingProfiles />}
      {activeTab === 'users' && <UserManagement />}
    </div>
  );
}
