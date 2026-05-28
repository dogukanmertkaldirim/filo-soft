import { useState } from 'react';
import {
  Settings,
  Shield,
  Globe,
  Bell,
  Database,
  Key,
  Save,
  AlertTriangle,
} from 'lucide-react';

export default function SuperAdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    platformName: 'FleetOS',
    supportEmail: 'destek@fleetos.com',
    defaultLanguage: 'tr',
    defaultCurrency: 'TRY',
    maintenanceMode: false,
    allowNewRegistrations: true,
    requireEmailVerification: false,
    maxLoginAttempts: 5,
    sessionTimeout: 24,
    enableAuditLogs: true,
    logRetentionDays: 90,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const tabs = [
    { id: 'general', label: 'Genel', icon: Settings },
    { id: 'security', label: 'Guvenlik', icon: Shield },
    { id: 'notifications', label: 'Bildirimler', icon: Bell },
    { id: 'database', label: 'Veritabani', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Ayarlari</h1>
        <p className="text-slate-400 mt-1">Global sistem konfigurasyonu</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-64 flex-shrink-0">
          <nav className="bg-slate-800 rounded-2xl border border-slate-700 p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 bg-slate-800 rounded-2xl border border-slate-700 p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Genel Ayarlar</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Platform Adi</label>
                    <input
                      type="text"
                      value={settings.platformName}
                      onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Destek E-posta</label>
                    <input
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Varsayilan Dil</label>
                      <select
                        value={settings.defaultLanguage}
                        onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="tr">Turkce</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Varsayilan Para Birimi</label>
                      <select
                        value={settings.defaultCurrency}
                        onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="TRY">TRY - Turk Lirasi</option>
                        <option value="USD">USD - Amerikan Dolari</option>
                        <option value="EUR">EUR - Euro</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-700">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="text-white font-medium">Bakim Modu</p>
                        <p className="text-sm text-slate-400">Platform gecici olarak erisime kapatilir</p>
                      </div>
                      <div
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.maintenanceMode ? 'bg-red-500' : 'bg-slate-600'
                        }`}
                        onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                            settings.maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Guvenlik Ayarlari</h2>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer p-4 bg-slate-700/50 rounded-xl">
                    <div>
                      <p className="text-white font-medium">Yeni Kayitlara Izin Ver</p>
                      <p className="text-sm text-slate-400">Yeni firmalarin kaydolmasina izin ver</p>
                    </div>
                    <div
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.allowNewRegistrations ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                      onClick={() => setSettings({ ...settings, allowNewRegistrations: !settings.allowNewRegistrations })}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                          settings.allowNewRegistrations ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-4 bg-slate-700/50 rounded-xl">
                    <div>
                      <p className="text-white font-medium">E-posta Dogrulama Zorunlu</p>
                      <p className="text-sm text-slate-400">Kullanicilar giris yapmadan once e-postalarini dogrulamali</p>
                    </div>
                    <div
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.requireEmailVerification ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                      onClick={() => setSettings({ ...settings, requireEmailVerification: !settings.requireEmailVerification })}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                          settings.requireEmailVerification ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Maks. Giris Denemesi</label>
                      <input
                        type="number"
                        value={settings.maxLoginAttempts}
                        onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 5 })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Oturum Suresi (saat)</label>
                      <input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 24 })}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Bildirim Ayarlari</h2>
                <div className="p-6 bg-slate-700/30 rounded-xl text-center">
                  <Bell className="h-12 w-12 mx-auto text-slate-500 mb-3" />
                  <p className="text-slate-400">E-posta ve push bildirim ayarlari yakinda eklenecek.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Veritabani Ayarlari</h2>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer p-4 bg-slate-700/50 rounded-xl">
                    <div>
                      <p className="text-white font-medium">Denetim Loglari</p>
                      <p className="text-sm text-slate-400">Tum kullanici islemlerini logla</p>
                    </div>
                    <div
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.enableAuditLogs ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                      onClick={() => setSettings({ ...settings, enableAuditLogs: !settings.enableAuditLogs })}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                          settings.enableAuditLogs ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Log Saklama Suresi (gun)</label>
                    <input
                      type="number"
                      value={settings.logRetentionDays}
                      onChange={(e) => setSettings({ ...settings, logRetentionDays: parseInt(e.target.value) || 90 })}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white font-medium">Veritabani Bakimi</p>
                        <p className="text-sm text-slate-400 mt-1">
                          Veritabani optimizasyonu ve yedekleme islemleri Supabase panelinden yapilabilir.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6 border-t border-slate-700 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
