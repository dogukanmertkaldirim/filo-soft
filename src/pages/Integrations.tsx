import { useState, useEffect } from 'react';
import {
  Plug,
  MapPin,
  Settings2,
  Check,
  X,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Satellite,
  Radio,
  Globe,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

interface IntegrationConfig {
  id?: string;
  company_id: string;
  provider: string;
  display_name: string;
  is_active: boolean;
  config: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'password' | 'url';
    placeholder: string;
    required: boolean;
  }[];
  status: 'available' | 'coming_soon';
}

const GPS_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'arvento',
    name: 'Arvento',
    description: 'Turkiye\'nin lider arac takip sistemi. Gercek zamanli konum, hiz ve rota takibi.',
    icon: Satellite,
    color: 'bg-blue-500',
    status: 'available',
    fields: [
      { key: 'username', label: 'Kullanici Adi', type: 'text', placeholder: 'Arvento kullanici adiniz', required: true },
      { key: 'pin', label: 'PIN Kodu', type: 'password', placeholder: '******', required: true },
      { key: 'api_url', label: 'API URL', type: 'url', placeholder: 'https://ws.arvento.com/v1', required: false },
    ],
  },
  {
    id: 'mobiliz',
    name: 'Mobiliz',
    description: 'Profesyonel filo yonetimi ve arac takip cozumu.',
    icon: Radio,
    color: 'bg-green-500',
    status: 'coming_soon',
    fields: [
      { key: 'api_key', label: 'API Anahtari', type: 'password', placeholder: 'API anahtariniz', required: true },
      { key: 'fleet_id', label: 'Filo ID', type: 'text', placeholder: 'Filo kimlik numarasi', required: true },
    ],
  },
  {
    id: 'trio',
    name: 'Trio Mobil',
    description: 'Akilli arac takip ve filo yonetim platformu.',
    icon: Globe,
    color: 'bg-orange-500',
    status: 'coming_soon',
    fields: [
      { key: 'username', label: 'Kullanici Adi', type: 'text', placeholder: 'Trio kullanici adi', required: true },
      { key: 'password', label: 'Sifre', type: 'password', placeholder: '******', required: true },
      { key: 'company_code', label: 'Firma Kodu', type: 'text', placeholder: 'Firma kodunuz', required: true },
    ],
  },
  {
    id: 'filoturk',
    name: 'FiloTurk',
    description: 'Yerli filo takip ve yonetim sistemi.',
    icon: MapPin,
    color: 'bg-red-500',
    status: 'coming_soon',
    fields: [
      { key: 'token', label: 'API Token', type: 'password', placeholder: 'API tokeniniz', required: true },
      { key: 'account_id', label: 'Hesap ID', type: 'text', placeholder: 'Hesap kimliginiz', required: true },
    ],
  },
];

export default function Integrations() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('arvento');
  const [configs, setConfigs] = useState<Record<string, IntegrationConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadConfigs();
    }
  }, [companyId]);

  async function loadConfigs() {
    if (!companyId) return;

    setLoading(true);
    const { data } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('company_id', companyId);

    const configMap: Record<string, IntegrationConfig> = {};
    const formDataMap: Record<string, Record<string, string>> = {};
    const activeMap: Record<string, boolean> = {};

    GPS_PROVIDERS.forEach(provider => {
      formDataMap[provider.id] = {};
      provider.fields.forEach(field => {
        formDataMap[provider.id][field.key] = '';
      });
      activeMap[provider.id] = false;
    });

    (data || []).forEach(config => {
      configMap[config.provider] = config;
      formDataMap[config.provider] = { ...formDataMap[config.provider], ...config.config };
      activeMap[config.provider] = config.is_active;
    });

    setConfigs(configMap);
    setFormData(formDataMap);
    setActiveStates(activeMap);
    setLoading(false);
  }

  function updateField(provider: string, key: string, value: string) {
    setFormData(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [key]: value,
      },
    }));
  }

  function togglePassword(fieldKey: string) {
    setShowPasswords(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  }

  async function handleSave(providerId: string) {
    if (!companyId) return;

    const provider = GPS_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    const requiredFields = provider.fields.filter(f => f.required);
    const providerFormData = formData[providerId] || {};

    for (const field of requiredFields) {
      if (!providerFormData[field.key]?.trim()) {
        alert(`${field.label} alani zorunludur.`);
        return;
      }
    }

    setSaving(true);

    const existingConfig = configs[providerId];
    const configData: IntegrationConfig = {
      company_id: companyId,
      provider: providerId,
      display_name: provider.name,
      is_active: activeStates[providerId] || false,
      config: providerFormData,
    };

    let error;
    if (existingConfig?.id) {
      const result = await supabase
        .from('integration_configs')
        .update({
          is_active: configData.is_active,
          config: configData.config,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConfig.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('integration_configs')
        .insert(configData);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      console.error('Integration save error:', error.message);
      alert('Kaydetme sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    } else {
      setSuccessMessage('Entegrasyon ayarlari kaydedildi!');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadConfigs();
    }
  }

  async function handleTestConnection(providerId: string) {
    setTestingConnection(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setTestingConnection(false);
    alert('Baglanti testi ozelligi yakin zamanda aktif olacaktir.');
  }

  function toggleActive(providerId: string) {
    setActiveStates(prev => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  }

  const activeProvider = GPS_PROVIDERS.find(p => p.id === activeTab);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-teal-100 rounded-xl">
            <Plug className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Entegrasyon Merkezi</h1>
            <p className="text-slate-500 text-sm">GPS takip sistemleri ve dis servis entegrasyonlari</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">{successMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex overflow-x-auto">
            {GPS_PROVIDERS.map(provider => {
              const isActive = activeStates[provider.id];
              const hasConfig = !!configs[provider.id];

              return (
                <button
                  key={provider.id}
                  onClick={() => setActiveTab(provider.id)}
                  className={`relative flex items-center gap-3 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === provider.id
                      ? 'border-teal-600 text-teal-700 bg-teal-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${provider.color}`}>
                    <provider.icon className="h-4 w-4 text-white" />
                  </div>
                  <span>{provider.name}</span>
                  {provider.status === 'coming_soon' && (
                    <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                      Yakinda
                    </span>
                  )}
                  {provider.status === 'available' && hasConfig && isActive && (
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeProvider && (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${activeProvider.color}`}>
                  <activeProvider.icon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{activeProvider.name}</h2>
                  <p className="text-slate-500 mt-1">{activeProvider.description}</p>
                </div>
              </div>
              {activeProvider.status === 'available' && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Aktif</span>
                  <button
                    onClick={() => toggleActive(activeProvider.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      activeStates[activeProvider.id] ? 'bg-teal-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        activeStates[activeProvider.id] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {activeProvider.status === 'coming_soon' ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Yakinda Geliyor</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                  {activeProvider.name} entegrasyonu uzerinde calisiyoruz. Yakin zamanda bu saglayiciyi da destekleyecegiz.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">API Kimlik Bilgileri</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Bu bilgiler {activeProvider.name} hesabinizdan alinabilir. Kimlik bilgileriniz guvenli sekilde saklanir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {activeProvider.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="relative">
                        <input
                          type={field.type === 'password' && !showPasswords[`${activeProvider.id}_${field.key}`] ? 'password' : 'text'}
                          value={formData[activeProvider.id]?.[field.key] || ''}
                          onChange={(e) => updateField(activeProvider.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                        {field.type === 'password' && (
                          <button
                            type="button"
                            onClick={() => togglePassword(`${activeProvider.id}_${field.key}`)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPasswords[`${activeProvider.id}_${field.key}`] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleTestConnection(activeProvider.id)}
                    disabled={testingConnection}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings2 className="h-4 w-4" />
                    )}
                    Baglanti Test Et
                  </button>
                  <Button
                    onClick={() => handleSave(activeProvider.id)}
                    disabled={saving}
                  >
                    {saving ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Kaydet
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <Plug className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Universal GPS Mimarisi</h3>
            <p className="text-slate-300 text-sm mb-4">
              Sistem, saglayicidan bagimsiz bir mimari ile tasarlandi. Yeni bir GPS saglayici eklemek icin sadece bir "Adapter" fonksiyonu yazmak yeterli - veritabani degisikligi gerektirmez.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {GPS_PROVIDERS.map(provider => (
                <div key={provider.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                  <div className={`p-1 rounded ${provider.color}`}>
                    <provider.icon className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs text-slate-300">{provider.name}</span>
                  {provider.status === 'available' ? (
                    <Check className="h-3 w-3 text-green-400 ml-auto" />
                  ) : (
                    <Clock className="h-3 w-3 text-slate-500 ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
