import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Palette,
  Rocket,
  Shield,
  Zap,
  Check,
  Flame,
  User,
  Heart,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  PlayerCosmetics,
  CUBE_SKINS,
  SHIP_SKINS,
  WAVE_SKINS,
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  TRAIL_EFFECTS,
  DEATH_EFFECTS,
  DEFAULT_COSMETICS,
  drawCubeSkin,
  drawShipSkin,
  drawWaveSkin,
  saveCosmetics,
} from '../utils/cosmetics';
import { sound } from '../utils/sound';

interface Props {
  cosmetics: PlayerCosmetics;
  playerName: string;
  onUpdate: (newCosmetics: PlayerCosmetics, newName: string) => void;
  onClose: () => void;
}

type TabType = 'CUBE' | 'SHIP' | 'WAVE' | 'COLORS' | 'TRAILS' | 'DEATH';

export const GDGarageModal: React.FC<Props> = ({
  cosmetics,
  playerName,
  onUpdate,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('CUBE');
  const [currentCosmetics, setCurrentCosmetics] = useState<PlayerCosmetics>(cosmetics);
  const [nameInput, setNameInput] = useState<string>(playerName || 'Koşucu');
  const [previewMode, setPreviewMode] = useState<'CUBE' | 'SHIP' | 'WAVE'>('CUBE');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Canvas Animated Preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Cyber background grid
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0B1120');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const shift = (tick * 0.8) % 30;
      for (let x = -shift; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Center Platform
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = currentCosmetics.primaryColor;
      ctx.lineWidth = 2;
      const platY = canvas.height * 0.72;
      ctx.beginPath();
      ctx.roundRect(canvas.width / 2 - 70, platY, 140, 16, 6);
      ctx.fill();
      ctx.stroke();

      // Platform Glow
      ctx.fillStyle = `${currentCosmetics.primaryColor}22`;
      ctx.fillRect(canvas.width / 2 - 70, platY + 16, 140, 20);

      const centerX = canvas.width / 2;
      const centerY = platY - 26;

      ctx.save();
      ctx.translate(centerX, centerY + Math.sin(tick * 0.06) * 4);

      if (previewMode === 'CUBE') {
        const rot = Math.sin(tick * 0.04) * 8;
        ctx.rotate((rot * Math.PI) / 180);
        drawCubeSkin(
          ctx,
          currentCosmetics.cubeSkin,
          currentCosmetics.primaryColor,
          currentCosmetics.secondaryColor,
          36
        );
      } else if (previewMode === 'SHIP') {
        const tilt = Math.sin(tick * 0.08) * 12;
        ctx.rotate((tilt * Math.PI) / 180);
        drawShipSkin(
          ctx,
          currentCosmetics.shipSkin,
          currentCosmetics.primaryColor,
          currentCosmetics.secondaryColor,
          true
        );
      } else if (previewMode === 'WAVE') {
        const waveAngle = Math.sin(tick * 0.1) > 0 ? -35 : 35;
        ctx.rotate((waveAngle * Math.PI) / 180);
        drawWaveSkin(
          ctx,
          currentCosmetics.waveSkin,
          currentCosmetics.primaryColor,
          currentCosmetics.secondaryColor
        );
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentCosmetics, previewMode]);

  const selectItem = (key: keyof PlayerCosmetics, val: string) => {
    const updated = { ...currentCosmetics, [key]: val };
    setCurrentCosmetics(updated);
    saveCosmetics(updated);
    onUpdate(updated, nameInput);
    sound.playPop();
  };

  const handleNameChange = (val: string) => {
    const clean = val.slice(0, 12);
    setNameInput(clean);
    onUpdate(currentCosmetics, clean);
    try {
      localStorage.setItem('gd_player_name_v1', clean);
    } catch {
      // ignore
    }
  };

  const resetDefaults = () => {
    setCurrentCosmetics(DEFAULT_COSMETICS);
    saveCosmetics(DEFAULT_COSMETICS);
    onUpdate(DEFAULT_COSMETICS, nameInput);
    sound.playScore();
  };

  return (
    <div className="bg-[#0D1322] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-5 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-wide">GARAJ & KOSTÜMLER (ICON KIT)</h2>
            <p className="text-xs text-slate-400">
              Karakterinizi özelleştirin; tüm kostümler Solo, 2 Kişilik ve Online maçlarda görünür!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetDefaults}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Sıfırla
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold cursor-pointer transition-colors"
          >
            Tamamla & Çık
          </button>
        </div>
      </div>

      {/* Top Section: Live Character Preview & Nickname */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#131B2E] border border-white/10 rounded-xl p-4 items-center">
        {/* Preview Canvas */}
        <div className="md:col-span-2 flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={380}
            height={130}
            className="rounded-xl border border-white/10 shadow-inner w-full max-w-[420px]"
          />
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Önizleme:</span>
            {(['CUBE', 'SHIP', 'WAVE'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPreviewMode(m)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  previewMode === m
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {m === 'CUBE' ? 'Küp' : m === 'SHIP' ? 'Roket' : 'Wave'}
              </button>
            ))}
          </div>
        </div>

        {/* Player Tag / Nickname Input */}
        <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-xl border border-white/5">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-400" />
            Çevrim İçi Oyuncu Adınız:
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="İsim girin..."
            className="px-3 py-2 rounded-lg bg-[#0B0F17] border border-white/15 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
            maxLength={12}
          />
          <p className="text-[10px] text-slate-500">
            Online düellolarda ve liderlik tablolarında bu isim görünecektir.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('CUBE')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'CUBE'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" /> Küp Kostümleri ({CUBE_SKINS.length})
        </button>
        <button
          onClick={() => setActiveTab('SHIP')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'SHIP'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" /> Roket Gemileri ({SHIP_SKINS.length})
        </button>
        <button
          onClick={() => setActiveTab('WAVE')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'WAVE'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" /> Wave / Dalga ({WAVE_SKINS.length})
        </button>
        <button
          onClick={() => setActiveTab('COLORS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'COLORS'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Palette className="w-3.5 h-3.5" /> Renk Paleti
        </button>
        <button
          onClick={() => setActiveTab('TRAILS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'TRAILS'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5" /> İz Efektleri ({TRAIL_EFFECTS.length})
        </button>
        <button
          onClick={() => setActiveTab('DEATH')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'DEATH'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Heart className="w-3.5 h-3.5" /> Patlama Efektleri ({DEATH_EFFECTS.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="max-h-[320px] overflow-y-auto pr-1">
        {/* 1. CUBE SKINS */}
        {activeTab === 'CUBE' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {CUBE_SKINS.map((skin) => {
              const isSelected = currentCosmetics.cubeSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  onClick={() => {
                    selectItem('cubeSkin', skin.id);
                    setPreviewMode('CUBE');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate">{skin.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{skin.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. SHIP SKINS */}
        {activeTab === 'SHIP' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SHIP_SKINS.map((skin) => {
              const isSelected = currentCosmetics.shipSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  onClick={() => {
                    selectItem('shipSkin', skin.id);
                    setPreviewMode('SHIP');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate">{skin.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{skin.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. WAVE SKINS */}
        {activeTab === 'WAVE' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {WAVE_SKINS.map((skin) => {
              const isSelected = currentCosmetics.waveSkin === skin.id;
              return (
                <button
                  key={skin.id}
                  onClick={() => {
                    selectItem('waveSkin', skin.id);
                    setPreviewMode('WAVE');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate">{skin.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{skin.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* 4. COLORS */}
        {activeTab === 'COLORS' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-2.5">
                Ana Gövde Rengi (Primary Color):
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {PRIMARY_COLORS.map((col) => {
                  const isSelected = currentCosmetics.primaryColor === col.hex;
                  return (
                    <button
                      key={col.hex}
                      onClick={() => selectItem('primaryColor', col.hex)}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-white bg-slate-800 shadow-md ring-2 ring-blue-500'
                          : 'border-white/10 bg-slate-900/60 hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shadow-inner shrink-0 border border-white/20"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="text-xs font-medium text-white truncate">{col.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-300 mb-2.5">
                Göz & Vurgu Rengi (Secondary Accent Color):
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SECONDARY_COLORS.map((col) => {
                  const isSelected = currentCosmetics.secondaryColor === col.hex;
                  return (
                    <button
                      key={col.hex}
                      onClick={() => selectItem('secondaryColor', col.hex)}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-white bg-slate-800 shadow-md ring-2 ring-blue-500'
                          : 'border-white/10 bg-slate-900/60 hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full shadow-inner shrink-0 border border-white/20"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span className="text-xs font-medium text-white truncate">{col.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. TRAIL EFFECTS */}
        {activeTab === 'TRAILS' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRAIL_EFFECTS.map((trail) => {
              const isSelected = currentCosmetics.trailEffect === trail.id;
              return (
                <button
                  key={trail.id}
                  onClick={() => selectItem('trailEffect', trail.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate">{trail.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{trail.desc}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* 6. DEATH EFFECTS */}
        {activeTab === 'DEATH' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {DEATH_EFFECTS.map((death) => {
              const isSelected = currentCosmetics.deathEffect === death.id;
              return (
                <button
                  key={death.id}
                  onClick={() => selectItem('deathEffect', death.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white truncate">{death.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{death.desc}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
