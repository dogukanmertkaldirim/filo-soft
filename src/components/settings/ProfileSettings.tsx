import { useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function ProfileSettings() {
  const { user, updatePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function handlePasswordChange() {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Lutfen tum alanlari doldurun');
      return;
    }

    if (currentPassword !== user?.password) {
      setPasswordError('Mevcut sifre yanlis');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Yeni sifre en az 6 karakter olmalidir');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Yeni sifreler eslesmiyor');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('Yeni sifre mevcut sifre ile ayni olamaz');
      return;
    }

    setSavingPassword(true);

    if (user) {
      const result = await updatePassword(user.id, newPassword);
      if (result.success) {
        setPasswordSuccess('Sifreniz basariyla guncellendi');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(result.error || 'Sifre guncellenirken bir hata olustu');
      }
    }

    setSavingPassword(false);
  }

  const roleLabel = user?.role === 'admin' ? 'Yonetici' : user?.role === 'staff' ? 'Personel' : 'Kullanici';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
          {user?.full_name?.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) || 'U'}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <User className="h-5 w-5 text-teal-600" />
            Profilim
          </h2>
          <p className="text-sm text-slate-500">
            {user?.full_name} (@{user?.username}) - {roleLabel}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-600" />
          Sifre Degistir
        </h3>

        {passwordError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{passwordError}</p>
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{passwordSuccess}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
          <div className="relative">
            <Input
              label="Mevcut Sifre"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Mevcut sifreniz"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label="Yeni Sifre"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="En az 6 karakter"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            label="Yeni Sifre (Tekrar)"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Yeni sifrenizi tekrar girin"
          />
        </div>
        <div className="mt-4">
          <Button onClick={handlePasswordChange} loading={savingPassword}>
            Sifreyi Guncelle
          </Button>
        </div>
      </div>
    </div>
  );
}
