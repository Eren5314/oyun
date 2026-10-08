import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Pause, Sparkles, RefreshCw } from 'lucide-react';
import { sound } from '../utils/sound';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  color: string;
  maxHp: number;
}

export const NeonBreakoutGame: React.FC<{ onScoreUpdate: (id: string, s: number) => void }> = ({ onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [combo, setCombo] = useState<number>(1);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('breakout_best') || 0);
    } catch {
      return 0;
    }
  });

  const stateRef = useRef({
    paddleX: 380,
    paddleW: 120,
    paddleH: 14,
    ballX: 440,
    ballY: 340,
    ballVx: 4.5,
    ballVy: -4.5,
    ballRadius: 7,
    bricks: [] as Brick[],
    particles: [] as { x: number; y: number; vx: number; vy: number; color: string; alpha: number }[],
    keys: { left: false, right: false },
    currentScore: 0,
    currentCombo: 1,
    currentLives: 3,
  });

  const saveBest = useCallback((val: number) => {
    setBestScore((prev) => {
      const next = Math.max(prev, val);
      try {
        localStorage.setItem('breakout_best', String(next));
      } catch {}
      onScoreUpdate('neon-breakout', next);
      return next;
    });
  }, [onScoreUpdate]);

  const initBricks = () => {
    const bricks: Brick[] = [];
    const rows = 5;
    const cols = 9;
    const bw = 82;
    const bh = 22;
    const offsetX = 64;
    const offsetY = 50;
    const colors = ['#F43F5E', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6'];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: offsetX + c * (bw + 12),
          y: offsetY + r * (bh + 10),
          w: bw,
          h: bh,
          hp: r === 0 ? 2 : 1,
          maxHp: r === 0 ? 2 : 1,
          color: colors[r],
        });
      }
    }
    return bricks;
  };

  const startPlay = useCallback(() => {
    const st = stateRef.current;
    st.paddleX = 380;
    st.ballX = 440;
    st.ballY = 340;
    st.ballVx = (Math.random() > 0.5 ? 1 : -1) * 4.5;
    st.ballVy = -4.8;
    st.bricks = initBricks();
    st.particles = [];
    st.currentScore = 0;
    st.currentCombo = 1;
    st.currentLives = 3;

    setScore(0);
    setCombo(1);
    setLives(3);
    setGameState('PLAYING');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.keys.right = true;
      if (e.code === 'Escape' && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        setGameState((s) => (s === 'PLAYING' ? 'PAUSED' : 'PLAYING'));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') stateRef.current.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') stateRef.current.keys.right = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const spawnBoom = (x: number, y: number, color: string) => {
      for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3.5;
        stateRef.current.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color,
          alpha: 1,
        });
      }
    };

    const loop = () => {
      const st = stateRef.current;

      if (gameState === 'PLAYING') {
        // Paddle move
        if (st.keys.left) st.paddleX -= 8;
        if (st.keys.right) st.paddleX += 8;
        st.paddleX = Math.max(10, Math.min(canvas.width - st.paddleW - 10, st.paddleX));

        // Ball move
        st.ballX += st.ballVx;
        st.ballY += st.ballVy;

        // Wall collisions
        if (st.ballX - st.ballRadius <= 0) {
          st.ballX = st.ballRadius;
          st.ballVx *= -1;
          sound.playPop();
        } else if (st.ballX + st.ballRadius >= canvas.width) {
          st.ballX = canvas.width - st.ballRadius;
          st.ballVx *= -1;
          sound.playPop();
        }

        if (st.ballY - st.ballRadius <= 0) {
          st.ballY = st.ballRadius;
          st.ballVy *= -1;
          sound.playPop();
        }

        // Paddle collision
        const paddleY = canvas.height - 35;
        if (
          st.ballY + st.ballRadius >= paddleY &&
          st.ballY - st.ballRadius <= paddleY + st.paddleH &&
          st.ballX >= st.paddleX &&
          st.ballX <= st.paddleX + st.paddleW
        ) {
          st.ballY = paddleY - st.ballRadius;
          const hitOffset = (st.ballX - (st.paddleX + st.paddleW / 2)) / (st.paddleW / 2);
          st.ballVx = hitOffset * 6.5;
          st.ballVy = -Math.abs(st.ballVy);
          sound.playJump();
        }

        // Brick collision
        for (let i = st.bricks.length - 1; i >= 0; i--) {
          const b = st.bricks[i];
          if (
            st.ballX + st.ballRadius >= b.x &&
            st.ballX - st.ballRadius <= b.x + b.w &&
            st.ballY + st.ballRadius >= b.y &&
            st.ballY - st.ballRadius <= b.y + b.h
          ) {
            b.hp -= 1;
            st.ballVy *= -1;
            spawnBoom(b.x + b.w / 2, b.y + b.h / 2, b.color);

            if (b.hp <= 0) {
              st.bricks.splice(i, 1);
              st.currentScore += 20 * st.currentCombo;
              st.currentCombo = Math.min(6, st.currentCombo + 1);
              sound.playScore();
            } else {
              sound.playPop();
            }

            setScore(st.currentScore);
            setCombo(st.currentCombo);

            // Win wave
            if (st.bricks.length === 0) {
              sound.playVictory();
              st.bricks = initBricks();
              st.ballY = 340;
              st.ballVy = -5.2;
            }
            break;
          }
        }

        // Fall out
        if (st.ballY > canvas.height + 20) {
          sound.playCrash();
          st.currentLives -= 1;
          st.currentCombo = 1;
          setLives(st.currentLives);
          setCombo(1);

          if (st.currentLives <= 0) {
            saveBest(st.currentScore);
            setGameState('GAME_OVER');
          } else {
            st.ballX = st.paddleX + st.paddleW / 2;
            st.ballY = 340;
            st.ballVy = -4.5;
            st.ballVx = (Math.random() > 0.5 ? 1 : -1) * 4;
          }
        }
      }

      // --- RENDER ---
      ctx.fillStyle = '#080C16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bricks
      for (const b of st.bricks) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }

      // Paddle
      const paddleY = canvas.height - 35;
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(st.paddleX, paddleY, st.paddleW, st.paddleH);
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeRect(st.paddleX, paddleY, st.paddleW, st.paddleH);

      // Ball
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(st.ballX, st.ballY, st.ballRadius, 0, Math.PI * 2);
      ctx.fill();

      // Particles
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) {
          st.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, saveBest]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131B2E] border border-white/10 rounded-xl p-3.5">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400 mr-2">Skor:</span>
            <span className="font-mono-num font-semibold text-white text-sm">{score}</span>
          </div>
          <div>
            <span className="text-slate-400 mr-2">Rekor:</span>
            <span className="font-mono-num font-semibold text-amber-400 text-sm">{bestScore}</span>
          </div>
          <div>
            <span className="text-slate-400 mr-2">Kombo:</span>
            <span className="font-mono-num font-semibold text-emerald-400 text-sm">x{combo}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Can:</span>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((heart) => (
              <span
                key={heart}
                className={`w-3.5 h-3.5 rounded-full ${heart <= lives ? 'bg-rose-500 shadow-sm' : 'bg-slate-700'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Arena */}
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 bg-[#080C16] select-none"
        onMouseMove={(e) => {
          if (!canvasRef.current || gameState !== 'PLAYING') return;
          const rect = canvasRef.current.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * canvasRef.current.width;
          stateRef.current.paddleX = Math.max(10, Math.min(canvasRef.current.width - stateRef.current.paddleW - 10, relX - stateRef.current.paddleW / 2));
        }}
      >
        <canvas ref={canvasRef} width={920} height={420} className="w-full h-[400px] sm:h-[420px] block cursor-none" />

        {gameState === 'PLAYING' && (
          <button
            onClick={() => setGameState('PAUSED')}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" /> Duraklat
          </button>
        )}

        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Neon Tuğla Kırıcı</h2>
            <p className="text-sm text-slate-300 max-w-md mb-6">
              Paleti farenizle veya A/D tuşlarıyla yönlendirin, topu düşürmeden neon tuğlaları kırarak kombo yapın!
            </p>
            <button
              onClick={startPlay}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" /> Oyunu Başlat
            </button>
          </div>
        )}

        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-2xl font-bold text-white mb-4">Oyun Duraklatıldı</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setGameState('PLAYING')}
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Play className="w-4 h-4 fill-current" /> Devam Et
              </button>
              <button
                onClick={startPlay}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Baştan Başla
              </button>
            </div>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <h3 className="text-2xl font-bold text-rose-400 mb-1">Oyun Bitti!</h3>
            <p className="text-sm text-slate-300 mb-6">
              Toplam Skor: <span className="font-mono-num font-semibold text-white">{score}</span>
            </p>
            <button
              onClick={startPlay}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
            >
              <RotateCcw className="w-4 h-4" /> Tekrar Oyna
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 flex items-center justify-between">
        <span>Kontrol: Farenizi sağa/sola kaydırarak veya Klavye A/D yön tuşlarıyla oynayabilirsiniz.</span>
        <span className="text-amber-400 font-medium">İpucu: Top paletin ucuna çarptıkça daha keskin açıyla seker!</span>
      </div>
    </div>
  );
};
