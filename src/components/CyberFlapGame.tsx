import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Pause, Sparkles, Wind } from 'lucide-react';
import { sound } from '../utils/sound';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

const PIPE_GAP = 125;
const PIPE_WIDTH = 58;

export const CyberFlapGame: React.FC<{ onScoreUpdate: (id: string, s: number) => void }> = ({ onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('flappy_best') || 0);
    } catch {
      return 0;
    }
  });

  const stateRef = useRef({
    birdY: 200,
    birdVy: 0,
    birdRotation: 0,
    pipes: [] as Pipe[],
    spawnTimer: 0,
    score: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; color: string; alpha: number }[],
  });

  const saveBest = useCallback((val: number) => {
    setBestScore((prev) => {
      const next = Math.max(prev, val);
      try {
        localStorage.setItem('flappy_best', String(next));
      } catch {}
      onScoreUpdate('cyber-flap', next);
      return next;
    });
  }, [onScoreUpdate]);

  const flap = useCallback(() => {
    stateRef.current.birdVy = -8.2;
    sound.playJump();
  }, []);

  const startPlay = useCallback(() => {
    const st = stateRef.current;
    st.birdY = 200;
    st.birdVy = -3;
    st.birdRotation = 0;
    st.pipes = [
      { x: 500, topHeight: 120, bottomHeight: 420 - 120 - PIPE_GAP, passed: false },
      { x: 740, topHeight: 180, bottomHeight: 420 - 180 - PIPE_GAP, passed: false },
    ];
    st.spawnTimer = 0;
    st.score = 0;
    st.particles = [];

    setScore(0);
    setGameState('PLAYING');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState === 'PLAYING') {
          flap();
        } else if (gameState === 'GAME_OVER') {
          startPlay();
        }
      } else if (e.code === 'Escape' && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        setGameState((s) => (s === 'PLAYING' ? 'PAUSED' : 'PLAYING'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, flap, startPlay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const loop = () => {
      const st = stateRef.current;

      if (gameState === 'PLAYING') {
        // Physics
        st.birdVy += 0.44;
        st.birdY += st.birdVy;
        st.birdRotation = Math.max(-0.5, Math.min(1.2, st.birdVy * 0.08));

        // Pipes
        st.spawnTimer++;
        if (st.spawnTimer >= 100) {
          st.spawnTimer = 0;
          const minTop = 50;
          const maxTop = canvas.height - PIPE_GAP - 60;
          const topH = Math.floor(minTop + Math.random() * (maxTop - minTop));
          st.pipes.push({
            x: canvas.width + 20,
            topHeight: topH,
            bottomHeight: canvas.height - topH - PIPE_GAP,
            passed: false,
          });
        }

        const birdBox = {
          left: 140 - 15,
          right: 140 + 15,
          top: st.birdY - 14,
          bottom: st.birdY + 14,
        };

        // Floor / Ceiling
        if (st.birdY + 15 >= canvas.height || st.birdY - 15 <= 0) {
          sound.playCrash();
          saveBest(st.score);
          setGameState('GAME_OVER');
        }

        // Pipe collision
        for (let i = st.pipes.length - 1; i >= 0; i--) {
          const p = st.pipes[i];
          p.x -= 3.2;

          // Score check
          if (!p.passed && p.x + PIPE_WIDTH < 140) {
            p.passed = true;
            st.score++;
            setScore(st.score);
            sound.playScore();
          }

          // Collision check with fair padding
          if (birdBox.right > p.x + 4 && birdBox.left < p.x + PIPE_WIDTH - 4) {
            if (birdBox.top < p.topHeight || birdBox.bottom > canvas.height - p.bottomHeight) {
              sound.playCrash();
              saveBest(st.score);
              setGameState('GAME_OVER');
              break;
            }
          }

          if (p.x + PIPE_WIDTH < -30) {
            st.pipes.splice(i, 1);
          }
        }
      }

      // --- RENDER ---
      ctx.fillStyle = '#080C14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cyber grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Pipes
      for (const p of st.pipes) {
        ctx.fillStyle = '#10B981';
        // Top pipe
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.topHeight);
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, 0, PIPE_WIDTH, p.topHeight);
        // Bottom pipe
        const botY = canvas.height - p.bottomHeight;
        ctx.fillRect(p.x, botY, PIPE_WIDTH, p.bottomHeight);
        ctx.strokeRect(p.x, botY, PIPE_WIDTH, p.bottomHeight);
      }

      // Draw Drone Bird
      ctx.save();
      ctx.translate(140, st.birdY);
      ctx.rotate(st.birdRotation);

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wing
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.ellipse(-4, 2, 8, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(6, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Beak
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.moveTo(14, -2);
      ctx.lineTo(22, 2);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

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
        </div>

        <div className="text-xs text-slate-400">
          Kontrol: <span className="text-slate-200 font-medium">Boşluk / Tıklama</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 bg-[#080C14] select-none"
        onMouseDown={() => {
          if (gameState === 'PLAYING') flap();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          if (gameState === 'PLAYING') flap();
        }}
      >
        <canvas ref={canvasRef} width={920} height={420} className="w-full h-[400px] sm:h-[420px] block cursor-pointer" />

        {gameState === 'PLAYING' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setGameState('PAUSED');
            }}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" /> Duraklat
          </button>
        )}

        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Siber Kanat</h2>
            <p className="text-sm text-slate-300 max-w-md mb-6">
              Boşluk tuşu veya ekrana tıklayarak drone kuşu havada tutun, lazer kapılarından güvenle geçin!
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
            <h3 className="text-2xl font-bold text-rose-400 mb-1">Düştün!</h3>
            <p className="text-sm text-slate-300 mb-6">
              Skorun: <span className="font-mono-num font-semibold text-white">{score}</span> · Rekor:{' '}
              <span className="font-mono-num font-semibold text-blue-400">{bestScore}</span>
            </p>
            <button
              onClick={startPlay}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer transition-colors shadow-lg"
            >
              <RotateCcw className="w-4 h-4" /> Tekrar Oyna (Boşluk)
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 flex items-center justify-between">
        <span>Kolay, akıcı ve bağımlılık yaratan refleks oyunu.</span>
        <span className="text-emerald-400 font-medium">İpucu: Küçük ve ritmik dokunuşlar dengeli kalmayı sağlar!</span>
      </div>
    </div>
  );
};
