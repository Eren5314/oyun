import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Gamepad2, Swords, Sparkles, Trophy, Maximize2, Minimize2 } from 'lucide-react';
import { GeometryDashGame } from './components/GeometryDashGame';
import { HexaConquestOnlineGame } from './components/HexaConquestOnlineGame';
import { CyberFlapGame } from './components/CyberFlapGame';
import { sound } from './utils/sound';

type GameId = 'geometry-dash' | 'hexa-conquest' | 'cyber-flap';

interface GameInfo {
  id: GameId;
  number: string;
  title: string;
  genre: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GAMES: GameInfo[] = [
  {
    id: 'geometry-dash',
    number: '01',
    title: 'Geometri Düellosu (Tek & 2 Kişilik)',
    genre: 'Bölünmüş Ekran · 5 Can · 1X/2X/3X Hız',
    desc: 'Tek kişilik 10 seviye ve 2 kişilik sonsuz düello! Cube, Ship, Wave modları, izole ekranlar ve 1x/2x/3x hiper hız seçenekleri.',
    icon: Gamepad2,
  },
  {
    id: 'hexa-conquest',
    number: '02',
    title: 'Hexa Fetih (Online Strateji)',
    genre: 'Sıra Tabanlı Strateji · Canlı Çok Oyunculu',
    desc: 'Arkadaşınla aynı oda kodunu girerek canlı oyna! Çoğalma ve atlama taktikleriyle tahtayı fethet.',
    icon: Swords,
  },
  {
    id: 'cyber-flap',
    number: '03',
    title: 'Siber Kanat',
    genre: 'Refleks & Uçuş · Sonsuz Akış',
    desc: 'Ritmik kanat çırparak siber lazer sütunlarının arasından süzülün.',
    icon: Sparkles,
  },
];

export default function App() {
  const [activeGame, setActiveGame] = useState<GameId>('geometry-dash');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [records, setRecords] = useState<Record<GameId, number>>(() => {
    try {
      const gd = JSON.parse(localStorage.getItem('gd_best_pro_v10') || '{}');
      const gdVals = Object.values(gd).map(Number).filter((n) => !isNaN(n));
      const gdMax = gdVals.length > 0 ? Math.max(...gdVals) : 0;
      const conquest = Number(localStorage.getItem('conquest_best') || 0);
      const flap = Number(localStorage.getItem('flappy_best') || 0);
      return {
        'geometry-dash': gdMax,
        'hexa-conquest': conquest,
        'cyber-flap': flap,
      };
    } catch {
      return {
        'geometry-dash': 0,
        'hexa-conquest': 0,
        'cyber-flap': 0,
      };
    }
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);

  const handleScoreUpdate = (id: string, s: number) => {
    setRecords((prev) => ({
      ...prev,
      [id as GameId]: Math.max(prev[id as GameId] || 0, s),
    }));
  };

  const toggleSound = () => {
    const m = sound.toggleMute();
    setIsMuted(m);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (gameContainerRef.current?.requestFullscreen) {
        gameContainerRef.current.requestFullscreen().catch(() => {
          // If browser/iframe restricts requestFullscreen, fall back to CSS fullscreen
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && !document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const activeGameObj = GAMES.find((g) => g.id === activeGame) || GAMES[0];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0B0F17]/95 sticky top-0 z-30">
        <div className="font-display text-lg font-bold tracking-tight text-white flex items-center gap-2">
          <span>GameHub Lite</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Oyunu Tam Ekran Yap"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span>Küçült</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span>Tam Ekran</span>
              </>
            )}
          </button>

          <button
            onClick={toggleSound}
            className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800/90 border border-white/10 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
            {isMuted ? 'Ses Kapalı' : 'Ses Açık'}
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout: Left Sidebar + Game Area + Right Ad Banner */}
      <div className="flex-1 max-w-[1680px] w-full mx-auto flex flex-col xl:flex-row gap-6 p-4 sm:p-6">
        {/* Left Sidebar Menu (Hidden in Fullscreen) */}
        {!isFullscreen && (
          <aside className="w-full xl:w-72 shrink-0 flex flex-col justify-between bg-[#111827] border border-white/10 rounded-xl p-5 shadow-lg">
            <div>
              <div className="mb-4 pb-3 border-b border-white/10">
                <h2 className="font-display text-base font-bold text-white">Oyun Seçimi</h2>
                <p className="text-xs text-slate-400 mt-0.5">Oyunlar arasında sol menüden hızlıca geçiş yapabilirsiniz.</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {GAMES.map((g) => {
                  const Icon = g.icon;
                  const isSelected = activeGame === g.id;
                  const rec = g.id === 'geometry-dash' ? `%${records['geometry-dash']}` : `${records[g.id]} Puan`;

                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveGame(g.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#1E293B] border-blue-500/80 shadow-md ring-1 ring-blue-500/30'
                          : 'bg-slate-900/50 border-white/5 hover:bg-slate-800/70 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className="font-semibold text-sm text-white truncate">
                          {g.number}. {g.title}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 mb-2">{g.desc}</p>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{g.genre}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num text-blue-400 font-medium">Rekor: {rec}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personal Best Box */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold text-slate-200">Kişisel Rekorlar</h3>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Geometri Koşusu</span>
                  <span className="font-mono-num font-semibold text-blue-400">%{records['geometry-dash']}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Hexa Fetih (Online)</span>
                  <span className="font-mono-num font-semibold text-sky-400">{records['hexa-conquest']} Puan</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Siber Kanat</span>
                  <span className="font-mono-num font-semibold text-emerald-400">{records['cyber-flap']} Puan</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* Center / Fullscreen Game Viewport */}
        <main
          ref={gameContainerRef}
          className={`transition-all ${
            isFullscreen
              ? 'fixed inset-0 z-50 bg-[#0B0F17] p-4 sm:p-6 overflow-y-auto flex flex-col justify-start'
              : 'flex-1 min-w-0 flex flex-col gap-4'
          }`}
        >
          {/* Active Game Header Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10 bg-[#0B0F17]/80 backdrop-blur-sm rounded-lg px-2">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white">{activeGameObj.title}</h1>
                {isFullscreen && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded">
                    TAM EKRAN
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeGameObj.genre} · {activeGameObj.desc}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleFullscreen}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran Yap'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? 'Normal Boyut' : 'Tam Ekran'}</span>
              </button>

              <div className="text-xs text-slate-400 hidden sm:block">
                {activeGame === 'hexa-conquest' ? (
                  <span className="text-emerald-400 font-medium">Canlı Çok Oyunculu</span>
                ) : (
                  <>Duraklat: <span className="font-mono-num text-slate-200">ESC</span></>
                )}
              </div>
            </div>
          </div>

          {/* Active Game Component */}
          <div className="flex-1">
            {activeGame === 'geometry-dash' && <GeometryDashGame onScoreUpdate={handleScoreUpdate} />}
            {activeGame === 'hexa-conquest' && <HexaConquestOnlineGame onScoreUpdate={handleScoreUpdate} />}
            {activeGame === 'cyber-flap' && <CyberFlapGame onScoreUpdate={handleScoreUpdate} />}
          </div>
        </main>

        {/* Right Sidebar: Reklam Panosu (Boş Bırakılmış - Kullanıcı Sonradan Ekleyecek) */}
        {!isFullscreen && (
          <aside className="w-full xl:w-72 shrink-0 flex flex-col bg-[#111827] border border-white/10 rounded-xl p-4 self-start shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Reklam Panosu</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">160x600 / 300x600</span>
            </div>

            {/* ========================================================================= */}
            {/* REKLAM KODU ALANI: KULLANICI BURAYA KENDİ REKLAM (ADSENSE / BANNER) KODUNU EKLEYEBİLİR */}
            {/* ========================================================================= */}
            <div
              id="ad-banner-slot"
              className="w-full min-h-[520px] xl:min-h-[620px] rounded-lg border-2 border-dashed border-white/10 bg-slate-900/40 flex flex-col items-center justify-center p-6 text-center text-slate-400"
            >
              {/* REKLAM KODU BURAYA GELECEK - İÇİ BOŞ BIRAKILDI */}
              <div className="p-3 rounded-full bg-slate-800/80 border border-white/10 mb-3 text-slate-400">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Reklam Alanı</p>
              <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
                Bu pano boş bırakılmıştır. Dilediğiniz zaman kendi reklam kodunuzu veya afişinizi buraya yerleştirebilirsiniz.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
