import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Copy,
  Check,
  RotateCcw,
  Shield,
  Zap,
  Crosshair,
  Bot,
  Play,
  Volume2,
  Trophy,
  Swords,
  Users,
  PlusCircle,
  Link,
  Radio,
  Gamepad2,
} from 'lucide-react';
import { sound } from '../utils/sound';

const ARENA_W = 800;
const ARENA_H = 520;
const TANK_RADIUS = 18;

interface TankState {
  x: number;
  y: number;
  angle: number; // Tank body & turret angle for intuitive arcade steering
  speed: number;
  lives: number;
  score: number;
  recoil: number;
}

interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  owner: 'P1' | 'P2';
  color: string;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'WALL' | 'PILLAR' | 'BOX';
}

const OBSTACLES: Obstacle[] = [
  { x: 240, y: 120, w: 90, h: 80, type: 'WALL' },
  { x: 470, y: 120, w: 90, h: 80, type: 'WALL' },
  { x: 240, y: 320, w: 90, h: 80, type: 'WALL' },
  { x: 470, y: 320, w: 90, h: 80, type: 'WALL' },
  { x: 370, y: 230, w: 60, h: 60, type: 'PILLAR' },
];

export const CyberTanksOnlineGame: React.FC<{
  onScoreUpdate: (id: string, s: number) => void;
  playerName?: string;
}> = ({ onScoreUpdate, playerName }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game Mode: SOLO (vs AI), LOCAL_2P (Same keyboard), or ONLINE
  const [playMode, setPlayMode] = useState<'SOLO' | 'LOCAL_2P' | 'ONLINE'>('SOLO');
  const [currentRoomCode, setCurrentRoomCode] = useState('TANK1');
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [roundWinner, setRoundWinner] = useState<'P1' | 'P2' | null>(null);
  const [p1Lives, setP1Lives] = useState(3);
  const [p2Lives, setP2Lives] = useState(3);

  // Local game engine ref for SOLO and LOCAL_2P
  const gameRef = useRef({
    p1: {
      x: 100,
      y: 260,
      angle: 0,
      speed: 3.5,
      lives: 3,
      score: 0,
      recoil: 0,
    } as TankState,
    p2: {
      x: 700,
      y: 260,
      angle: Math.PI,
      speed: 3.5,
      lives: 3,
      score: 0,
      recoil: 0,
    } as TankState,
    bullets: [] as Bullet[],
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
      up: false,
      down: false,
      left: false,
      right: false,
      enter: false,
    },
    lastShotP1: 0,
    lastShotP2: 0,
  });

  const handleModeChange = (mode: 'SOLO' | 'LOCAL_2P' | 'ONLINE') => {
    setPlayMode(mode);
    sound.playScore();
    resetLocalGame();
  };

  const resetLocalGame = () => {
    gameRef.current.p1 = {
      x: 100,
      y: 260,
      angle: 0,
      speed: 3.5,
      lives: 3,
      score: scores.p1,
      recoil: 0,
    };
    gameRef.current.p2 = {
      x: 700,
      y: 260,
      angle: Math.PI,
      speed: 3.5,
      lives: 3,
      score: scores.p2,
      recoil: 0,
    };
    gameRef.current.bullets = [];
    setP1Lives(3);
    setP2Lives(3);
    setRoundWinner(null);
  };

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = gameRef.current.keys;
      if (e.key === 'w' || e.key === 'W') k.w = true;
      if (e.key === 'a' || e.key === 'A') k.a = true;
      if (e.key === 's' || e.key === 'S') k.s = true;
      if (e.key === 'd' || e.key === 'D') k.d = true;
      if (e.key === ' ') {
        k.space = true;
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        k.up = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowDown') {
        k.down = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') k.left = true;
      if (e.key === 'ArrowRight') k.right = true;
      if (e.key === 'Enter') {
        k.enter = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = gameRef.current.keys;
      if (e.key === 'w' || e.key === 'W') k.w = false;
      if (e.key === 'a' || e.key === 'A') k.a = false;
      if (e.key === 's' || e.key === 'S') k.s = false;
      if (e.key === 'd' || e.key === 'D') k.d = false;
      if (e.key === ' ') k.space = false;

      if (e.key === 'ArrowUp') k.up = false;
      if (e.key === 'ArrowDown') k.down = false;
      if (e.key === 'ArrowLeft') k.left = false;
      if (e.key === 'ArrowRight') k.right = false;
      if (e.key === 'Enter') k.enter = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Collision Helper for Tanks against Arena & Obstacles
  const checkCollision = (nx: number, ny: number) => {
    // Arena bounds
    if (nx - TANK_RADIUS < 10 || nx + TANK_RADIUS > ARENA_W - 10 || ny - TANK_RADIUS < 10 || ny + TANK_RADIUS > ARENA_H - 10) {
      return true;
    }
    // Obstacles
    for (const obs of OBSTACLES) {
      if (
        nx + TANK_RADIUS > obs.x &&
        nx - TANK_RADIUS < obs.x + obs.w &&
        ny + TANK_RADIUS > obs.y &&
        ny - TANK_RADIUS < obs.y + obs.h
      ) {
        return true;
      }
    }
    return false;
  };

  // Main Game Loop for SOLO & LOCAL_2P
  useEffect(() => {
    if (playMode === 'ONLINE') return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const game = gameRef.current;

    const updateGame = () => {
      const now = Date.now();
      const p1 = game.p1;
      const p2 = game.p2;
      const k = game.keys;

      if (!roundWinner) {
        // --- P1 Control (WASD: A/D rotate, W/S forward/backward) ---
        if (k.a) p1.angle -= 0.06;
        if (k.d) p1.angle += 0.06;

        let p1Move = 0;
        if (k.w) p1Move += p1.speed;
        if (k.s) p1Move -= p1.speed * 0.6;

        if (p1Move !== 0) {
          const nx = p1.x + Math.cos(p1.angle) * p1Move;
          const ny = p1.y + Math.sin(p1.angle) * p1Move;
          if (!checkCollision(nx, p1.y)) p1.x = nx;
          if (!checkCollision(p1.x, ny)) p1.y = ny;
        }

        // P1 Shoot (Space)
        if (k.space && now - game.lastShotP1 > 350) {
          game.lastShotP1 = now;
          p1.recoil = 8;
          sound.playLaser();
          const spawnX = p1.x + Math.cos(p1.angle) * 26;
          const spawnY = p1.y + Math.sin(p1.angle) * 26;
          game.bullets.push({
            id: 'B_' + Math.random(),
            x: spawnX,
            y: spawnY,
            vx: Math.cos(p1.angle) * 7.5,
            vy: Math.sin(p1.angle) * 7.5,
            bounces: 0,
            owner: 'P1',
            color: '#3B82F6',
          });
        }

        // --- P2 Control ---
        if (playMode === 'LOCAL_2P') {
          if (k.left) p2.angle -= 0.06;
          if (k.right) p2.angle += 0.06;

          let p2Move = 0;
          if (k.up) p2Move += p2.speed;
          if (k.down) p2Move -= p2.speed * 0.6;

          if (p2Move !== 0) {
            const nx = p2.x + Math.cos(p2.angle) * p2Move;
            const ny = p2.y + Math.sin(p2.angle) * p2Move;
            if (!checkCollision(nx, p2.y)) p2.x = nx;
            if (!checkCollision(p2.x, ny)) p2.y = ny;
          }

          if (k.enter && now - game.lastShotP2 > 350) {
            game.lastShotP2 = now;
            p2.recoil = 8;
            sound.playLaser();
            const spawnX = p2.x + Math.cos(p2.angle) * 26;
            const spawnY = p2.y + Math.sin(p2.angle) * 26;
            game.bullets.push({
              id: 'B_' + Math.random(),
              x: spawnX,
              y: spawnY,
              vx: Math.cos(p2.angle) * 7.5,
              vy: Math.sin(p2.angle) * 7.5,
              bounces: 0,
              owner: 'P2',
              color: '#F43F5E',
            });
          }
        } else {
          // --- SOLO AI Bot Tank Logic ---
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const targetAngle = Math.atan2(dy, dx);
          
          // Smoothly rotate towards P1
          const angleDiff = Math.atan2(Math.sin(targetAngle - p2.angle), Math.cos(targetAngle - p2.angle));
          p2.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.04);

          const distToP1 = Math.hypot(dx, dy);
          let botMove = 0;
          if (distToP1 > 180) botMove = p2.speed * 0.8;
          else if (distToP1 < 110) botMove = -p2.speed * 0.6;

          if (botMove !== 0) {
            const nx = p2.x + Math.cos(p2.angle) * botMove;
            const ny = p2.y + Math.sin(p2.angle) * botMove;
            if (!checkCollision(nx, p2.y)) p2.x = nx;
            if (!checkCollision(p2.x, ny)) p2.y = ny;
          }

          // Bot shoot
          if (now - game.lastShotP2 > 900 && distToP1 < 480 && Math.abs(angleDiff) < 0.5) {
            game.lastShotP2 = now;
            p2.recoil = 8;
            sound.playLaser();
            const spawnX = p2.x + Math.cos(p2.angle) * 26;
            const spawnY = p2.y + Math.sin(p2.angle) * 26;
            game.bullets.push({
              id: 'B_' + Math.random(),
              x: spawnX,
              y: spawnY,
              vx: Math.cos(p2.angle) * 7.0,
              vy: Math.sin(p2.angle) * 7.0,
              bounces: 0,
              owner: 'P2',
              color: '#F43F5E',
            });
          }
        }
      }

      if (p1.recoil > 0) p1.recoil *= 0.85;
      if (p2.recoil > 0) p2.recoil *= 0.85;

      // Update Bullets & Bounces
      for (let i = game.bullets.length - 1; i >= 0; i--) {
        const b = game.bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Wall bounces
        if (b.x <= 10 || b.x >= ARENA_W - 10) {
          b.vx *= -1;
          b.bounces++;
          sound.playPop();
        }
        if (b.y <= 10 || b.y >= ARENA_H - 10) {
          b.vy *= -1;
          b.bounces++;
          sound.playPop();
        }

        // Obstacle bounces
        let hitObs = false;
        for (const obs of OBSTACLES) {
          if (b.x >= obs.x && b.x <= obs.x + obs.w && b.y >= obs.y && b.y <= obs.y + obs.h) {
            // Determine bounce axis
            const prevX = b.x - b.vx;
            const prevY = b.y - b.vy;
            if (prevX < obs.x || prevX > obs.x + obs.w) b.vx *= -1;
            else b.vy *= -1;
            b.bounces++;
            sound.playPop();
            hitObs = true;
            break;
          }
        }

        if (b.bounces > 5 || hitObs && b.bounces > 5) {
          game.bullets.splice(i, 1);
          continue;
        }

        // Hit P1
        if (b.owner === 'P2' && Math.hypot(b.x - p1.x, b.y - p1.y) < TANK_RADIUS + 2) {
          p1.lives--;
          setP1Lives(p1.lives);
          game.bullets.splice(i, 1);
          sound.playCrash();
          if (p1.lives <= 0) {
            setRoundWinner('P2');
            setScores((prev) => {
              const ns = { ...prev, p2: prev.p2 + 1 };
              onScoreUpdate('cyber-tanks', ns.p2 * 100);
              return ns;
            });
            sound.playVictory();
          }
          continue;
        }

        // Hit P2
        if (b.owner === 'P1' && Math.hypot(b.x - p2.x, b.y - p2.y) < TANK_RADIUS + 2) {
          p2.lives--;
          setP2Lives(p2.lives);
          game.bullets.splice(i, 1);
          sound.playCrash();
          if (p2.lives <= 0) {
            setRoundWinner('P1');
            setScores((prev) => {
              const ns = { ...prev, p1: prev.p1 + 1 };
              onScoreUpdate('cyber-tanks', ns.p1 * 100);
              return ns;
            });
            sound.playVictory();
          }
          continue;
        }
      }

      // --- Render Graphics ---
      ctx.fillStyle = '#0B0F17';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Grid Lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < ARENA_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARENA_H);
        ctx.stroke();
      }
      for (let y = 0; y < ARENA_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_W, y);
        ctx.stroke();
      }

      // Arena Outer Border
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, ARENA_W - 16, ARENA_H - 16);

      // Draw Obstacles
      for (const obs of OBSTACLES) {
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        // Cyber corner accents
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(obs.x, obs.y, 4, 4);
        ctx.fillRect(obs.x + obs.w - 4, obs.y, 4, 4);
        ctx.fillRect(obs.x, obs.y + obs.h - 4, 4, 4);
        ctx.fillRect(obs.x + obs.w - 4, obs.y + obs.h - 4, 4, 4);
      }

      // Draw Bullets with Glow
      for (const b of game.bullets) {
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Tank Function
      const drawTank = (tank: TankState, color: string) => {
        ctx.save();
        ctx.translate(tank.x, tank.y);
        ctx.rotate(tank.angle);

        // Tracks
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1;
        ctx.fillRect(-20, -18, 40, 6);
        ctx.strokeRect(-20, -18, 40, 6);
        ctx.fillRect(-20, 12, 40, 6);
        ctx.strokeRect(-20, 12, 40, 6);

        // Hull Body
        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.fillRect(-18, -12, 36, 24);
        ctx.strokeRect(-18, -12, 36, 24);

        // Cannon Turret Barrel
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(0 - tank.recoil, -5, 28, 10);
        ctx.strokeRect(0 - tank.recoil, -5, 28, 10);

        // Hatch Center Dome
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();

        ctx.restore();
      };

      drawTank(p1, '#3B82F6');
      drawTank(p2, '#F43F5E');

      animId = requestAnimationFrame(updateGame);
    };

    animId = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(animId);
  }, [playMode, roundWinner, scores, onScoreUpdate]);

  return (
    <div className="flex flex-col gap-4 select-none max-w-4xl mx-auto w-full">
      {/* Mode Selector Tabs */}
      <div className="flex bg-[#131B2E] border border-white/10 rounded-2xl p-1.5 gap-2">
        <button
          onClick={() => handleModeChange('SOLO')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
            playMode === 'SOLO'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-400" />
          <span>Tek Kişilik (Yapay Zeka Bot)</span>
        </button>

        <button
          onClick={() => handleModeChange('LOCAL_2P')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
            playMode === 'LOCAL_2P'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Yerel 2 Kişilik (Aynı Klavye)</span>
        </button>

        <button
          onClick={() => handleModeChange('ONLINE')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
            playMode === 'ONLINE'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Wifi className="w-4 h-4 text-sky-400" />
          <span>Canlı Online Oda</span>
        </button>
      </div>

      {playMode === 'ONLINE' && (
        <div className="bg-[#131B2E] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-lg text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-rose-400" /> SİBER TANKLAR ONLINE ARENA
            </span>
            <span className="px-2.5 py-0.5 rounded bg-slate-900 font-mono text-blue-400 font-bold">Oda: {currentRoomCode}</span>
          </div>
        </div>
      )}

      {/* Score / Lives Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 items-center text-xs">
        <div className="p-2.5 rounded-lg border bg-blue-950/40 border-blue-500/50 flex items-center justify-between">
          <div>
            <p className="font-bold text-white">1. Oyuncu (Mavi Tank)</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Can: {'❤️'.repeat(Math.max(0, p1Lives))} | Skor: <span className="text-blue-400 font-bold">{scores.p1}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">Sür sür: W/S | Dön: A/D | Ateş: Boşluk</p>
          </div>
        </div>

        <div className="text-center">
          {roundWinner ? (
            <div>
              <p className="font-extrabold text-emerald-400 text-sm animate-pulse">
                {roundWinner === 'P1' ? '🎉 MAVİ TANK KAZANDI!' : '🔥 KIRMIZI TANK KAZANDI!'}
              </p>
              <button
                onClick={resetLocalGame}
                className="mt-2 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow cursor-pointer text-xs"
              >
                Yeni Tur Başlat
              </button>
            </div>
          ) : (
            <div>
              <p className="font-extrabold text-white text-sm tracking-wide">LASER ARENA</p>
              <p className="text-[11px] text-slate-400">Duvarlardan seken lazer tüfekleri!</p>
            </div>
          )}
        </div>

        <div className="p-2.5 rounded-lg border bg-rose-950/40 border-rose-500/50 flex items-center justify-between">
          <div>
            <p className="font-bold text-white">{playMode === 'SOLO' ? '🤖 Cyber AI Bot' : '2. Oyuncu (Kırmızı)'}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Can: {'❤️'.repeat(Math.max(0, p2Lives))} | Skor: <span className="text-rose-400 font-bold">{scores.p2}</span>
            </p>
            {playMode === 'LOCAL_2P' && <p className="text-[10px] text-slate-400 mt-1 font-mono">Sür: Oklar | Ateş: Enter</p>}
          </div>
        </div>
      </div>

      {/* Canvas Arena */}
      <div className="bg-[#090D16] border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center shadow-2xl relative">
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          className="max-w-full w-full h-auto rounded-xl border border-white/15 shadow-2xl bg-[#0B0F17]"
        />

        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10 w-full justify-between text-xs">
          <span className="text-slate-400 font-medium">
            Mod: {playMode === 'SOLO' ? 'Tek Kişilik (Yapay Zeka)' : playMode === 'LOCAL_2P' ? 'Yerel 2 Kişilik' : 'Online Oda'}
          </span>
          <button
            onClick={resetLocalGame}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-white/10 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Oyunu Sıfırla
          </button>
        </div>
      </div>
    </div>
  );
};
