import { useState } from 'react';
import { Shield, User, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { unifiedLogin } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!identifier || !password) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    setLoading(true);
    const result = await unifiedLogin(identifier, password);

    if (!result.success) {
      setError(result.error || 'Geçersiz giriş bilgileri');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[55%] relative bg-[#0f172a] overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-sky-500/8 to-transparent rounded-full -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/6 to-transparent rounded-full translate-y-1/3 -translate-x-1/4" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-white/90 text-xl font-semibold tracking-tight">FiloSoft</span>
            </div>
          </div>

          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Filonuzu Akıllı<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
                Yönetin.
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-10">
              Araç takibi, kiralama yönetimi, finansal operasyonlar ve müşteri ilişkileri -
              tüm filo operasyonlarınız tek platformda.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Araç Yönetimi', desc: 'Tüm filonuzu takip edin' },
                { label: 'Kiralama', desc: 'Kısa ve uzun vadeli' },
                { label: 'Finansal Raporlar', desc: 'Gelir-gider analizi' },
                { label: 'Müşteri Portalı', desc: 'Self-servis erişim' },
              ].map((item) => (
                <div key={item.label} className="bg-white/[0.04] backdrop-blur-sm rounded-xl p-4 border border-white/[0.06]">
                  <p className="text-white/90 text-sm font-medium mb-0.5">{item.label}</p>
                  <p className="text-slate-500 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
            <span>256-bit SSL</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>KVKK Uyumlu</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>%99.9 Uptime</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 sm:px-12">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-[#0f172a] rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[#0f172a] text-xl font-semibold tracking-tight block leading-none">FiloSoft</span>
              <span className="text-slate-400 text-xs">Akıllı Filo Yönetim Sistemi</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#0f172a] mb-1">Hoş Geldiniz</h2>
            <p className="text-slate-500 text-sm">Devam etmek için hesabınıza giriş yapın</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl animate-in fade-in duration-200">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 text-xs font-bold">!</span>
                </div>
                <p className="text-sm text-red-700 leading-relaxed">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-posta veya Kullanıcı Adı
              </label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 transition-colors group-focus-within:text-[#0f172a]" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="örnek@email.com veya kullanıcıadı"
                  autoComplete="username"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/10 focus:border-[#0f172a]/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Şifre
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 transition-colors group-focus-within:text-[#0f172a]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/10 focus:border-[#0f172a]/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 bg-[#0f172a] text-white py-3.5 px-4 rounded-xl text-sm font-semibold hover:bg-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-[18px] w-[18px]" />
                  Giriş Yap
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-xs text-slate-400 leading-relaxed">
              Giriş yaparak, platformun kullanım şartlarını kabul etmiş olursunuz.
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              FiloSoft v2.0 &middot; Tüm hakları saklıdır
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
