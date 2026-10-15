import React, { useState } from 'react';
import { LogIn, UserPlus, Shield, X, Sparkles, Check, AlertCircle } from 'lucide-react';
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

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🎮');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const body = tab === 'LOGIN' ? { username: cleanUsername, password } : { username: cleanUsername, password, avatar: selectedAvatar };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'İşlem başarısız oldu.');
      }

      sound.playVictory();
      localStorage.setItem('gamehub_auth_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Bağlantı hatası oluştu.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
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
          <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-500/50 text-blue-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white tracking-wide">
              {tab === 'LOGIN' ? 'Giriş Yap' : 'Hesap Oluştur'}
            </h2>
            <p className="text-xs text-slate-400">
              {tab === 'LOGIN' ? 'Hesabınıza girerek rekorlarınızı ve çevrim içi unvanınızı kaydedin.' : 'Yeni bir oyuncu profili oluşturun ve anında oynamaya başlayın.'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setTab('LOGIN');
              setError(null);
              sound.playPop();
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'LOGIN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Giriş Yap</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('REGISTER');
              setError(null);
              sound.playPop();
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'REGISTER' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Kayıt Ol</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Örn: EfsaneOyuncu"
              maxLength={16}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Parola
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 4 karakter"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-sm font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
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
                        ? 'bg-blue-600/40 border-blue-400 scale-105 shadow-md shadow-blue-500/20'
                        : 'bg-slate-900 border-white/10 hover:border-white/30'
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
            ) : tab === 'LOGIN' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Oyuna Giriş Yap</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Hesabı Oluştur ve Başla</span>
              </>
            )}
          </button>
        </form>

        {/* Guest Continue Option */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-400">Kayıt olmadan denemek ister misin?</span>
          <button
            type="button"
            onClick={handleGuest}
            className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline underline-offset-2"
          >
            Misafir Olarak Oyna →
          </button>
        </div>
      </div>
    </div>
  );
};
