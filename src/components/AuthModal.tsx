import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  Shield,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { sound } from '../utils/sound';

export interface UserAccountData {
  username: string;
  avatar: string;
  records: {
    'geometry-dash': number;
    'hexa-conquest': number;
    'cyber-tanks': number;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserAccountData) => void;
}

const AVATARS = ['🎮', '🚀', '⚡', '👑', '👾', '🐉', '🦊', '🤖', '🛡️', '💀', '🔥', '🌟'];

// Local storage accounts helper for offline-first reliability
function getLocalAccounts(): Record<string, { username: string; password: string; avatar: string }> {
  try {
    return JSON.parse(localStorage.getItem('gamehub_local_accounts') || '{}');
  } catch {
    return {};
  }
}

function saveLocalAccount(username: string, password: string, avatar: string) {
  try {
    const accs = getLocalAccounts();
    accs[username.toLowerCase()] = { username, password, avatar };
    localStorage.setItem('gamehub_local_accounts', JSON.stringify(accs));
  } catch {}
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [tab, setTab] = useState<'REGISTER' | 'LOGIN'>('REGISTER');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('🎮');
  const [error, setError] = useState<string | null>(null);
  const [userAlreadyExists, setUserAlreadyExists] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent, forceOverwrite = false) => {
    e.preventDefault();
    setError(null);
    setUserAlreadyExists(false);
    setUserNotFound(false);

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Parola en az 4 karakter olmalıdır.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = tab === 'LOGIN' ? '/api/auth/login' : '/api/auth/register';
      const body =
        tab === 'LOGIN'
          ? { username: cleanUsername, password }
          : { username: cleanUsername, password, avatar: selectedAvatar, overwrite: forceOverwrite };

      let apiSuccess = false;
      let userData: UserAccountData | null = null;

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          apiSuccess = true;
          userData = data.user;
        } else if (data?.exists) {
          setUserAlreadyExists(true);
          setError('Bu kullanıcı adı zaten kayıtlı! Eğer şifrenizi biliyorsanız giriş yapabilir veya şifrenizi güncelleyebilirsiniz.');
          setLoading(false);
          sound.playCrash();
          return;
        } else if (data?.notFound) {
          setUserNotFound(true);
          setError('Bu kullanıcı adına ait hesap bulunamadı! Yeni bir hesap oluşturmak için "Kayıt Ol" sekmesine geçin.');
          setLoading(false);
          sound.playCrash();
          return;
        } else if (data?.error) {
          setError(data.error);
          setLoading(false);
          sound.playCrash();
          return;
        }
      } catch {
        // Server fetch failed, proceed to local storage fallback
      }

      // If server responded successfully
      if (apiSuccess && userData) {
        saveLocalAccount(cleanUsername, password, userData.avatar || selectedAvatar);
        localStorage.setItem('gamehub_auth_user', JSON.stringify(userData));
        sound.playVictory();
        onLoginSuccess(userData);
        onClose();
        return;
      }

      // Offline-First / Local fallback
      const localAccs = getLocalAccounts();
      const lowerKey = cleanUsername.toLowerCase();
      const existing = localAccs[lowerKey];

      if (tab === 'REGISTER') {
        const fallbackUser: UserAccountData = {
          username: cleanUsername,
          avatar: selectedAvatar,
          records: {
            'geometry-dash': 0,
            'hexa-conquest': 0,
            'cyber-tanks': 0,
          },
        };
        saveLocalAccount(cleanUsername, password, selectedAvatar);
        localStorage.setItem('gamehub_auth_user', JSON.stringify(fallbackUser));
        sound.playVictory();
        onLoginSuccess(fallbackUser);
        onClose();
      } else {
        // Login fallback
        if (existing && existing.password === password) {
          const fallbackUser: UserAccountData = {
            username: existing.username,
            avatar: existing.avatar,
            records: {
              'geometry-dash': 0,
              'hexa-conquest': 0,
              'cyber-tanks': 0,
            },
          };
          localStorage.setItem('gamehub_auth_user', JSON.stringify(fallbackUser));
          sound.playVictory();
          onLoginSuccess(fallbackUser);
          onClose();
        } else if (existing) {
          setError('Girilen parola hatalı!');
          sound.playCrash();
        } else {
          // Auto create account if trying to login and account doesn't exist
          const newUser: UserAccountData = {
            username: cleanUsername,
            avatar: selectedAvatar,
            records: {
              'geometry-dash': 0,
              'hexa-conquest': 0,
              'cyber-tanks': 0,
            },
          };
          saveLocalAccount(cleanUsername, password, selectedAvatar);
          localStorage.setItem('gamehub_auth_user', JSON.stringify(newUser));
          sound.playVictory();
          onLoginSuccess(newUser);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Bir hata oluştu, lütfen tekrar deneyin.');
      sound.playCrash();
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    const guestUser: UserAccountData = {
      username: 'Misafir_' + Math.floor(100 + Math.random() * 900),
      avatar: '🎮',
      records: {
        'geometry-dash': 0,
        'hexa-conquest': 0,
        'cyber-tanks': 0,
      },
    };
    localStorage.setItem('gamehub_auth_user', JSON.stringify(guestUser));
    onLoginSuccess(guestUser);
    sound.playPop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#111827] border border-blue-500/40 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 text-slate-100 flex flex-col gap-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/50 text-blue-400 shadow-lg shadow-blue-600/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-white tracking-wide">
              {tab === 'REGISTER' ? 'Oyuncu Hesabı Oluştur' : 'Oyuncu Girişi'}
            </h2>
            <p className="text-xs text-slate-400">
              {tab === 'REGISTER'
                ? 'Kullanıcı adı ve parolanızı belirleyin, online düellolarda yerinizi alın!'
                : 'Kayıtlı hesabınıza giriş yaparak rekorlarınızı ve rozetlerinizi koruyun.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab('REGISTER');
              setError(null);
              setUserAlreadyExists(false);
              setUserNotFound(false);
              sound.playPop();
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'REGISTER' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Kayıt Ol (Yeni Hesap)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('LOGIN');
              setError(null);
              setUserAlreadyExists(false);
              setUserNotFound(false);
              sound.playPop();
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'LOGIN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Giriş Yap</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-300 text-xs font-medium flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>

            {/* Quick action buttons if already exists or not found */}
            {userAlreadyExists && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setTab('LOGIN');
                    setError(null);
                    setUserAlreadyExists(false);
                    sound.playPop();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Bu Hesapla Giriş Yap</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Şifremi Sıfırla & Giriş</span>
                </button>
              </div>
            )}

            {userNotFound && (
              <div className="pt-2 border-t border-rose-500/30">
                <button
                  type="button"
                  onClick={() => {
                    setTab('REGISTER');
                    setError(null);
                    setUserNotFound(false);
                    sound.playPop();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Hemen Bu İsimle Kayıt Ol</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Kullanıcı Adı <span className="text-slate-500">(En az 3 harf)</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="Örn: EfsaneOyuncu"
              maxLength={16}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Parola <span className="text-slate-500">(En az 4 karakter)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Parolanızı girin"
                className="w-full px-3.5 py-2.5 pr-10 bg-slate-900 border border-white/15 rounded-xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                title={showPassword ? 'Parolayı Gizle' : 'Parolayı Göster'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Avatar selector (Only in REGISTER tab) */}
          {tab === 'REGISTER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Avatarını Seç
              </label>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((av) => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => {
                      setSelectedAvatar(av);
                      sound.playPop();
                    }}
                    className={`h-10 text-xl rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      selectedAvatar === av
                        ? 'bg-blue-600/40 border-blue-400 scale-105 shadow-md shadow-blue-500/30 ring-1 ring-blue-400'
                        : 'bg-slate-900 border-white/10 hover:border-white/30 hover:scale-102'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 mt-1"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : tab === 'REGISTER' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Hesabı Oluştur ve Başla</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Oyuna Giriş Yap</span>
              </>
            )}
          </button>
        </form>

        {/* Guest Continue Option */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400">Hesap açmadan denemek ister misin?</span>
          <button
            type="button"
            onClick={handleGuest}
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline underline-offset-2 transition-colors"
          >
            Misafir Olarak Oyna →
          </button>
        </div>
      </div>
    </div>
  );
};
