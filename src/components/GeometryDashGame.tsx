import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Pause,
  CheckCircle2,
  Shield,
  Eye,
  Swords,
  ChevronLeft,
  ChevronRight,
  Heart,
  User,
  Users,
  Flame,
  Infinity,
  Zap,
  Gauge,
  Trophy,
  Sparkles,
  Palette,
  Globe,
  Home,
  Crown,
  Volume2,
  VolumeX,
  HelpCircle,
  Star,
  Award,
  X,
} from 'lucide-react';
import { sound } from '../utils/sound';
import { GD_LEVELS, LevelConfig, Obstacle } from '../utils/levels';
import {
  PlayerCosmetics,
  loadSavedCosmetics,
  saveCosmetics,
  drawCubeSkin,
  drawShipSkin,
  drawWaveSkin,
} from '../utils/cosmetics';
import { GDGarageModal } from './GDGarageModal';
import { GDOnlineLobby, OnlineOpponent } from './GDOnlineLobby';

type ActiveView = 'MAIN_MENU' | 'SOLO' | 'LOCAL_DUAL' | 'ONLINE_LOBBY' | 'ONLINE_GAME' | 'GARAGE';
type GameState = 'TITLE_MENU' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'ROUND_SUMMARY';
type VehicleMode = 'CUBE' | 'SHIP' | 'WAVE';
type SpeedSetting = 1 | 2 | 3;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  type?: string;
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 480;

// Dual mode geometry (2 equal tracks: [0, 240] and [240, 480])
const DUAL_TRACK_HEIGHT = 240;
const DUAL_CEILING_Y = 24;
const DUAL_GROUND_Y = 196;
const DUAL_PLAYER_SIZE = 28;

// Solo mode geometry ([0, 480])
const SOLO_CEILING_Y = 55;
const SOLO_GROUND_Y = 380;
const SOLO_PLAYER_SIZE = 36;

const FIXED_PLAYER_SCREEN_X = 160;
const INITIAL_LIVES = 5;

// Balanced speeds for 1X, 2X, 3X
const BASE_SPEEDS: Record<SpeedSetting, number> = {
  1: 6.5,
  2: 9.2,
  3: 12.0,
};

interface PlayerRuntime {
  playerY: number;
  vy: number;
  rotation: number;
  isGrounded: boolean;
  holdingJump: boolean;
  jumpBufferTimer: number;
  mode: VehicleMode;
  lives: number;
  respawnInvulnerable: number;
  trail: Array<{ x: number; y: number; rot: number; color: string; tick: number }>;
}

export const GeometryDashGame: React.FC<{
  onScoreUpdate: (id: string, s: number) => void;
  playerName?: string;
}> = ({ onScoreUpdate, playerName: initialPlayerName }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // App / View Navigation
  const [activeView, setActiveView] = useState<ActiveView>('MAIN_MENU');
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');

  // Cosmetics & Player Profile
  const [cosmetics, setCosmetics] = useState<PlayerCosmetics>(loadSavedCosmetics);
  const [playerName, setPlayerName] = useState<string>(() => {
    return initialPlayerName || localStorage.getItem('gd_player_name_v1') || 'Koşucu ' + Math.floor(100 + Math.random() * 900);
  });

  useEffect(() => {
    if (initialPlayerName) {
      setPlayerName(initialPlayerName);
    }
  }, [initialPlayerName]);

  // Game configuration
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [levelIdx, setLevelIdx] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [endlessDistance, setEndlessDistance] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedSetting>(1);
  const [allowDynamicSpeed, setAllowDynamicSpeed] = useState<boolean>(true);
  const [speedToast, setSpeedToast] = useState<string | null>(null);
  const [showHitboxes, setShowHitboxes] = useState<boolean>(false);
  const [practiceMode, setPracticeMode] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(1);
  const [p1Lives, setP1Lives] = useState<number>(INITIAL_LIVES);
  const [p2Lives, setP2Lives] = useState<number>(INITIAL_LIVES);
  const [winner, setWinner] = useState<'P1' | 'P2' | 'DRAW' | null>(null);

  // Online Multiplayer State
  const [onlineRoomCode, setOnlineRoomCode] = useState<string>('');
  const [myOnlineSlot, setMyOnlineSlot] = useState<'P1' | 'P2'>('P1');
  const [onlineOpponent, setOnlineOpponent] = useState<OnlineOpponent | null>(null);
  const onlineWsRef = useRef<WebSocket | null>(null);

  // Modals
  const [showLevelModal, setShowLevelModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  const levels = GD_LEVELS;
  const currentLevel = levels[levelIdx] || levels[0];

  // Engine ref holding 60 FPS state
  const engineRef = useRef({
    worldX: 0,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    beatTimer: 0,
    screenShakeP1: 0,
    screenShakeP2: 0,
    checkpointX: 0,
    checkpointY: 0,
    checkpointMode: 'CUBE' as VehicleMode,
    currentSpeedMult: 1 as SpeedSetting,
    // Solo Player
    solo: {
      playerY: SOLO_GROUND_Y - SOLO_PLAYER_SIZE,
      vy: 0,
      rotation: 0,
      isGrounded: true,
      holdingJump: false,
      jumpBufferTimer: 0,
      mode: 'CUBE' as VehicleMode,
      lives: 1,
      respawnInvulnerable: 0,
      trail: [],
    } as PlayerRuntime,
    // Dual / Online Players
    p1: {
      playerY: DUAL_GROUND_Y - DUAL_PLAYER_SIZE,
      vy: 0,
      rotation: 0,
      isGrounded: true,
      holdingJump: false,
      jumpBufferTimer: 0,
      mode: 'CUBE' as VehicleMode,
      lives: INITIAL_LIVES,
      respawnInvulnerable: 0,
      trail: [],
    } as PlayerRuntime,
    p2: {
      playerY: DUAL_GROUND_Y - DUAL_PLAYER_SIZE,
      vy: 0,
      rotation: 0,
      isGrounded: true,
      holdingJump: false,
      jumpBufferTimer: 0,
      mode: 'CUBE' as VehicleMode,
      lives: INITIAL_LIVES,
      respawnInvulnerable: 0,
      trail: [],
    } as PlayerRuntime,
  });

  // Endless pattern generator for Dual & Online
  const generateEndlessSegment = useCallback((startX: number): Obstacle[] => {
    const obs: Obstacle[] = [];
    let x = startX;
    const GY = DUAL_GROUND_Y;
    const CY = DUAL_CEILING_Y;
    const playH = GY - CY;

    const modes: VehicleMode[] = ['CUBE', 'SHIP', 'WAVE'];

    for (let seg = 0; seg < 3; seg++) {
      const mode = modes[Math.floor(Math.random() * modes.length)];

      const speedChance = Math.random();
      if (speedChance > 0.55) {
        const nextSpeed: SpeedSetting = speedChance > 0.8 ? 3 : 2;
        const spType = nextSpeed === 3 ? 'SPEED_3X' : 'SPEED_2X';
        obs.push({ x, y: CY, w: 32, h: playH, type: spType });
        x += 260;
      } else if (speedChance < 0.2) {
        obs.push({ x, y: CY, w: 32, h: playH, type: 'SPEED_1X' });
        x += 260;
      }

      if (mode === 'SHIP') {
        obs.push({ x, y: CY, w: 36, h: playH, type: 'PORTAL_ROCKET' });
        x += 350;

        obs.push({ x: x + 100, y: CY, w: 70, h: 50, type: 'BLOCK' });
        obs.push({ x: x + 380, y: GY - 55, w: 75, h: 55, type: 'BLOCK' });
        obs.push({ x: x + 680, y: CY, w: 70, h: 50, type: 'BLOCK' });
        obs.push({ x: x + 960, y: GY - 55, w: 75, h: 55, type: 'BLOCK' });
        x += 1250;
      } else if (mode === 'WAVE') {
        obs.push({ x, y: CY, w: 36, h: playH, type: 'PORTAL_WAVE' });
        x += 350;

        obs.push({ x: x + 120, y: CY, w: 75, h: 48, type: 'BLOCK' });
        obs.push({ x: x + 380, y: GY - 52, w: 75, h: 52, type: 'BLOCK' });
        obs.push({ x: x + 640, y: CY, w: 75, h: 48, type: 'BLOCK' });
        obs.push({ x: x + 900, y: GY - 52, w: 75, h: 52, type: 'BLOCK' });
        x += 1200;
      } else {
        obs.push({ x, y: CY, w: 36, h: playH, type: 'PORTAL_CUBE' });
        x += 300;

        obs.push({ x: x + 100, y: GY - 28, w: 28, h: 28, type: 'SPIKE' });
        obs.push({ x: x + 340, y: GY - 12, w: 38, h: 12, type: 'PAD' });
        obs.push({ x: x + 480, y: GY - 62, w: 28, h: 28, type: 'ORB' });
        obs.push({ x: x + 530, y: GY - 28, w: 56, h: 28, type: 'DOUBLE_SPIKE' });
        obs.push({ x: x + 780, y: GY - 38, w: 75, h: 38, type: 'BLOCK' });
        obs.push({ x: x + 980, y: GY - 28, w: 56, h: 28, type: 'DOUBLE_SPIKE' });
        obs.push({ x: x + 1220, y: GY - 12, w: 38, h: 12, type: 'PAD' });
        x += 1350;
      }
    }

    return obs;
  }, []);

  const initGame = useCallback(
    (fromCheckpoint = false) => {
      const eng = engineRef.current;
      const lvl = levels[levelIdx] || levels[0];

      eng.particles = [];
      eng.beatTimer = 0;
      eng.screenShakeP1 = 0;
      eng.screenShakeP2 = 0;
      eng.currentSpeedMult = speedMultiplier;

      if (activeView === 'SOLO') {
        if (fromCheckpoint && practiceMode && eng.checkpointX > 0) {
          eng.worldX = eng.checkpointX;
          eng.solo.playerY = eng.checkpointY;
          eng.solo.mode = eng.checkpointMode;
        } else {
          eng.worldX = 0;
          eng.solo.playerY = SOLO_GROUND_Y - SOLO_PLAYER_SIZE;
          eng.solo.mode = 'CUBE';
          eng.checkpointX = 0;
          eng.checkpointY = SOLO_GROUND_Y - SOLO_PLAYER_SIZE;
        }
        eng.solo.vy = 0;
        eng.solo.rotation = 0;
        eng.solo.isGrounded = true;
        eng.solo.holdingJump = false;
        eng.solo.jumpBufferTimer = 0;
        eng.solo.trail = [];
        eng.obstacles = lvl.obstacles.map((o) => ({ ...o, triggered: false }));
        setProgressPct(Math.min(100, Math.floor((eng.worldX / lvl.length) * 100)));
      } else {
        // LOCAL_DUAL or ONLINE_GAME
        eng.worldX = 0;
        eng.obstacles = generateEndlessSegment(550);

        eng.p1 = {
          playerY: DUAL_GROUND_Y - DUAL_PLAYER_SIZE,
          vy: 0,
          rotation: 0,
          isGrounded: true,
          holdingJump: false,
          jumpBufferTimer: 0,
          mode: 'CUBE',
          lives: INITIAL_LIVES,
          respawnInvulnerable: 0,
          trail: [],
        };

        eng.p2 = {
          playerY: DUAL_GROUND_Y - DUAL_PLAYER_SIZE,
          vy: 0,
          rotation: 0,
          isGrounded: true,
          holdingJump: false,
          jumpBufferTimer: 0,
          mode: 'CUBE',
          lives: INITIAL_LIVES,
          respawnInvulnerable: 0,
          trail: [],
        };

        setP1Lives(INITIAL_LIVES);
        setP2Lives(INITIAL_LIVES);
        setWinner(null);
        setEndlessDistance(0);
      }
    },
    [activeView, levelIdx, levels, practiceMode, speedMultiplier, generateEndlessSegment]
  );

  const startPlay = () => {
    initGame(false);
    if (activeView === 'LOCAL_DUAL' || activeView === 'ONLINE_GAME') {
      setGameState('COUNTDOWN');
      setCountdownNum(3);
      sound.playBeat(1);
      setTimeout(() => {
        setCountdownNum(2);
        sound.playBeat(2);
      }, 700);
      setTimeout(() => {
        setCountdownNum(1);
        sound.playBeat(3);
      }, 1400);
      setTimeout(() => {
        sound.playPad();
        setGameState('PLAYING');
      }, 2100);
    } else {
      setGameState('PLAYING');
    }
  };

  const restartPlay = useCallback(() => {
    setAttempts((a) => a + 1);
    initGame(practiceMode && engineRef.current.checkpointX > 0);
    if (activeView === 'LOCAL_DUAL') {
      setGameState('COUNTDOWN');
      setCountdownNum(3);
      sound.playBeat(1);
      setTimeout(() => {
        setCountdownNum(2);
        sound.playBeat(2);
      }, 700);
      setTimeout(() => {
        setCountdownNum(1);
        sound.playBeat(3);
      }, 1400);
      setTimeout(() => {
        sound.playPad();
        setGameState('PLAYING');
      }, 2100);
    } else {
      setGameState('PLAYING');
    }
  }, [initGame, practiceMode, activeView]);

  // Jump controls
  const triggerSoloJump = useCallback(() => {
    const s = engineRef.current.solo;
    s.holdingJump = true;
    s.jumpBufferTimer = 8;
  }, []);
  const releaseSoloJump = useCallback(() => {
    engineRef.current.solo.holdingJump = false;
  }, []);

  const triggerP1Jump = useCallback(() => {
    const p1 = engineRef.current.p1;
    p1.holdingJump = true;
    p1.jumpBufferTimer = 8;
  }, []);
  const releaseP1Jump = useCallback(() => {
    engineRef.current.p1.holdingJump = false;
  }, []);

  const triggerP2Jump = useCallback(() => {
    const p2 = engineRef.current.p2;
    p2.holdingJump = true;
    p2.jumpBufferTimer = 8;
  }, []);
  const releaseP2Jump = useCallback(() => {
    engineRef.current.p2.holdingJump = false;
  }, []);

  // Online Match Start Hook from Lobby
  const handleStartOnlineMatch = (
    ws: WebSocket,
    roomCode: string,
    mySlot: 'P1' | 'P2',
    opponent: OnlineOpponent | null,
    seed: number
  ) => {
    onlineWsRef.current = ws;
    setOnlineRoomCode(roomCode);
    setMyOnlineSlot(mySlot);
    setOnlineOpponent(opponent);
    setActiveView('ONLINE_GAME');
    initGame(false);
    setGameState('PLAYING');
    sound.playPad();

    // Listen to live opponent position packets
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'GD_OPPONENT_POS') {
          const oppKey = mySlot === 'P1' ? 'p2' : 'p1';
          const oppState = engineRef.current[oppKey];
          oppState.playerY = msg.playerY;
          oppState.vy = msg.vy;
          oppState.rotation = msg.rotation;
          oppState.mode = msg.mode;
          oppState.lives = msg.lives;
          oppState.respawnInvulnerable = msg.isInvulnerable ? 60 : 0;
          if (mySlot === 'P1') setP2Lives(msg.lives);
          else setP1Lives(msg.lives);
        } else if (msg.type === 'GD_ROOM_UPDATE') {
          if (msg.status === 'FINISHED' && msg.winner) {
            setWinner(msg.winner);
            setGameState('GAME_OVER');
            sound.playVictory();
          } else if (msg.status === 'COUNTDOWN') {
            initGame(false);
            setGameState('COUNTDOWN');
            setCountdownNum(msg.countdown || 3);
          } else if (msg.status === 'RACING') {
            setGameState('PLAYING');
          }
        }
      } catch {
        // ignore
      }
    };
  };

  // Keyboard events
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeView === 'SOLO') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          if (gameState === 'PLAYING') triggerSoloJump();
          else if (gameState === 'GAME_OVER' || gameState === 'ROUND_SUMMARY') restartPlay();
        } else if (e.code === 'KeyZ' && gameState === 'PLAYING' && practiceMode) {
          engineRef.current.checkpointX = engineRef.current.worldX;
          engineRef.current.checkpointY = engineRef.current.solo.playerY;
          engineRef.current.checkpointMode = engineRef.current.solo.mode;
          sound.playScore();
        }
      } else if (activeView === 'LOCAL_DUAL') {
        // P1: W, Space, E, A
        if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'KeyE' || e.code === 'KeyA') {
          e.preventDefault();
          if (gameState === 'PLAYING') triggerP1Jump();
          else if (gameState === 'GAME_OVER') restartPlay();
        }
        // P2: ArrowUp, ArrowDown, Enter, KeyL, KeyP, Numpad0
        if (
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'KeyL' ||
          e.code === 'KeyP' ||
          e.code === 'Enter' ||
          e.code === 'Numpad0'
        ) {
          e.preventDefault();
          if (gameState === 'PLAYING') triggerP2Jump();
          else if (gameState === 'GAME_OVER') restartPlay();
        }
      } else if (activeView === 'ONLINE_GAME') {
        // Online: Press space or W or Up to jump
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          if (gameState === 'PLAYING') {
            if (myOnlineSlot === 'P1') triggerP1Jump();
            else triggerP2Jump();
          }
        }
      }

      if (e.code === 'Escape' && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        setGameState((s) => (s === 'PLAYING' ? 'PAUSED' : 'PLAYING'));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (activeView === 'SOLO') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') releaseSoloJump();
      } else if (activeView === 'LOCAL_DUAL') {
        if (e.code === 'KeyW' || e.code === 'Space' || e.code === 'KeyE' || e.code === 'KeyA') releaseP1Jump();
        if (
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'KeyL' ||
          e.code === 'KeyP' ||
          e.code === 'Enter' ||
          e.code === 'Numpad0'
        ) {
          releaseP2Jump();
        }
      } else if (activeView === 'ONLINE_GAME') {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          if (myOnlineSlot === 'P1') releaseP1Jump();
          else releaseP2Jump();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeView,
    gameState,
    practiceMode,
    myOnlineSlot,
    restartPlay,
    triggerSoloJump,
    releaseSoloJump,
    triggerP1Jump,
    releaseP1Jump,
    triggerP2Jump,
    releaseP2Jump,
  ]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeView === 'MAIN_MENU' || activeView === 'ONLINE_LOBBY' || activeView === 'GARAGE') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const spawnExplosion = (x: number, y: number, color: string, effectType?: string) => {
      const type = effectType || cosmetics.deathEffect || 'death-classic';
      const count = type === 'death-nova' ? 28 : type === 'death-hearts' ? 16 : 22;

      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const spd = type === 'death-nova' ? 4.5 : 2.0 + Math.random() * 4.5;
        engineRef.current.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: type === 'death-pixel' ? 3 : 4 + Math.random() * 3,
          color,
          alpha: 1,
          type,
        });
      }
    };

    const loop = () => {
      const eng = engineRef.current;
      const lvl = levels[levelIdx] || levels[0];

      const currentSpeed =
        activeView === 'SOLO'
          ? lvl.speed
          : BASE_SPEEDS[eng.currentSpeedMult] || BASE_SPEEDS[1];

      if (gameState === 'PLAYING') {
        eng.worldX += currentSpeed;
        eng.beatTimer++;
        if (eng.beatTimer % 22 === 0) {
          sound.playBeat(Math.floor(eng.worldX / 160));
        }

        if (eng.screenShakeP1 > 0) eng.screenShakeP1 = Math.max(0, eng.screenShakeP1 * 0.88 - 0.2);
        if (eng.screenShakeP2 > 0) eng.screenShakeP2 = Math.max(0, eng.screenShakeP2 * 0.88 - 0.2);

        // Endless dynamic chunk generation
        if (activeView === 'LOCAL_DUAL' || activeView === 'ONLINE_GAME') {
          const dist = Math.floor(eng.worldX / 10);
          setEndlessDistance(dist);

          const lastObs = eng.obstacles[eng.obstacles.length - 1];
          if (lastObs && lastObs.x - eng.worldX < CANVAS_WIDTH + 800) {
            const nextSegment = generateEndlessSegment(lastObs.x + 300);
            eng.obstacles.push(...nextSegment);
          }
          if (eng.obstacles.length > 50 && eng.obstacles[0].x - eng.worldX < -500) {
            eng.obstacles.shift();
          }

          // Online WebSocket Sync broadcast (~30 times/sec)
          if (activeView === 'ONLINE_GAME' && onlineWsRef.current?.readyState === WebSocket.OPEN && eng.beatTimer % 2 === 0) {
            const myRun = myOnlineSlot === 'P1' ? eng.p1 : eng.p2;
            onlineWsRef.current.send(
              JSON.stringify({
                type: 'GD_SYNC_POS',
                worldX: eng.worldX,
                playerY: myRun.playerY,
                vy: myRun.vy,
                rotation: myRun.rotation,
                mode: myRun.mode,
                lives: myRun.lives,
                isInvulnerable: myRun.respawnInvulnerable > 0,
              })
            );
          }
        } else {
          const pct = Math.min(100, Math.floor((eng.worldX / lvl.length) * 100));
          setProgressPct(pct);
        }

        // =====================================================================
        // PHYSICS RUNTIME (LOCAL TRACK COORDINATES)
        // =====================================================================
        const activeTracks: Array<{
          p: PlayerRuntime;
          trackIndex: number;
          trackYOffset: number;
          groundY: number;
          ceilingY: number;
          pSize: number;
          name: 'SOLO' | 'P1' | 'P2';
          color: string;
        }> =
          activeView === 'SOLO'
            ? [
                {
                  p: eng.solo,
                  trackIndex: 0,
                  trackYOffset: 0,
                  groundY: SOLO_GROUND_Y,
                  ceilingY: SOLO_CEILING_Y,
                  pSize: SOLO_PLAYER_SIZE,
                  name: 'SOLO',
                  color: cosmetics.primaryColor,
                },
              ]
            : [
                {
                  p: eng.p1,
                  trackIndex: 0,
                  trackYOffset: 0,
                  groundY: DUAL_GROUND_Y,
                  ceilingY: DUAL_CEILING_Y,
                  pSize: DUAL_PLAYER_SIZE,
                  name: 'P1',
                  color:
                    activeView === 'ONLINE_GAME' && myOnlineSlot === 'P2' && onlineOpponent
                      ? onlineOpponent.cosmetics?.primaryColor || '#3B82F6'
                      : cosmetics.primaryColor,
                },
                {
                  p: eng.p2,
                  trackIndex: 1,
                  trackYOffset: DUAL_TRACK_HEIGHT,
                  groundY: DUAL_GROUND_Y,
                  ceilingY: DUAL_CEILING_Y,
                  pSize: DUAL_PLAYER_SIZE,
                  name: 'P2',
                  color:
                    activeView === 'ONLINE_GAME' && myOnlineSlot === 'P1' && onlineOpponent
                      ? onlineOpponent.cosmetics?.primaryColor || '#EF4444'
                      : activeView === 'ONLINE_GAME'
                      ? cosmetics.primaryColor
                      : '#EF4444',
                },
              ];

        for (const { p, trackYOffset, groundY, ceilingY, pSize, name, color } of activeTracks) {
          // If Online, only calculate local physics for your own slot!
          if (activeView === 'ONLINE_GAME') {
            const isMe = (myOnlineSlot === 'P1' && name === 'P1') || (myOnlineSlot === 'P2' && name === 'P2');
            if (!isMe) continue;
          }

          if (p.jumpBufferTimer > 0) p.jumpBufferTimer--;
          if (p.respawnInvulnerable > 0) p.respawnInvulnerable--;

          // --- VEHICLE MODES ---
          if (p.mode === 'CUBE') {
            if ((p.holdingJump || p.jumpBufferTimer > 0) && p.isGrounded) {
              p.vy = activeView === 'SOLO' ? -12.4 : -11.6;
              p.isGrounded = false;
              p.jumpBufferTimer = 0;
              sound.playJump();
            }
            p.vy += 0.72;
            p.playerY += p.vy;

            if (!p.isGrounded) p.rotation += 7.2;
            else p.rotation = Math.round(p.rotation / 90) * 90;

            if (p.playerY + pSize >= groundY) {
              p.playerY = groundY - pSize;
              p.vy = 0;
              p.isGrounded = true;
            } else if (p.vy > 1) {
              p.isGrounded = false;
            }
          } else if (p.mode === 'SHIP') {
            if (p.holdingJump) p.vy -= 0.68;
            else p.vy += 0.48;

            p.vy = Math.max(-5.5, Math.min(5.5, p.vy));
            p.playerY += p.vy;
            p.rotation = p.vy * 4.5;

            if (p.playerY < ceilingY) {
              p.playerY = ceilingY;
              p.vy = 0;
            }
            if (p.playerY + pSize >= groundY) {
              p.playerY = groundY - pSize;
              p.vy = 0;
            }
          } else if (p.mode === 'WAVE') {
            const waveSpeed = 4.8;
            if (p.holdingJump) {
              p.vy = -waveSpeed;
              p.rotation = -45;
            } else {
              p.vy = waveSpeed;
              p.rotation = 45;
            }
            p.playerY += p.vy;

            if (p.playerY < ceilingY) {
              p.playerY = ceilingY;
              p.vy = 0;
            }
            if (p.playerY + pSize >= groundY) {
              p.playerY = groundY - pSize;
              p.vy = 0;
            }
          }

          // Trail
          if (eng.beatTimer % 2 === 0) {
            p.trail.push({
              x: FIXED_PLAYER_SCREEN_X,
              y: p.playerY,
              rot: p.rotation,
              color,
              tick: eng.beatTimer,
            });
            if (p.trail.length > 8) p.trail.shift();
          }

          // Collisions - in local track space
          const px = FIXED_PLAYER_SCREEN_X;
          const py = p.playerY;
          const pLeft = px + 6;
          const pRight = px + pSize - 6;
          const pTop = py + 5;
          const pBottom = py + pSize;

          for (const obs of eng.obstacles) {
            const sx = obs.x - eng.worldX;
            if (sx + obs.w < px - 70 || sx > px + 90) continue;

            const obsLocalY = obs.y;

            // Spikes with fair triangular sub-spike collision
            if (obs.type === 'SPIKE' || obs.type === 'DOUBLE_SPIKE' || obs.type === 'TRIPLE_SPIKE') {
              if (p.respawnInvulnerable <= 0) {
                const subCount = obs.type === 'TRIPLE_SPIKE' ? 3 : obs.type === 'DOUBLE_SPIKE' ? 2 : 1;
                const singleSpikeW = obs.w / subCount;
                let hit = false;
                for (let sIdx = 0; sIdx < subCount; sIdx++) {
                  const sLeft = sx + sIdx * singleSpikeW;
                  const sCenter = sLeft + singleSpikeW / 2;
                  if (pBottom > obsLocalY + 5 && pTop < obsLocalY + obs.h - 1) {
                    const depthFrac = Math.max(0.18, Math.min(1, (pBottom - obsLocalY) / obs.h));
                    const effectiveHalfW = (singleSpikeW * 0.42) * depthFrac;
                    if (pRight > sCenter - effectiveHalfW && pLeft < sCenter + effectiveHalfW) {
                      hit = true;
                      break;
                    }
                  }
                }

                if (hit) {
                  sound.playCrash();
                  if (name === 'P1') eng.screenShakeP1 = 12;
                  else eng.screenShakeP2 = 12;

                  spawnExplosion(px + pSize / 2, py + trackYOffset + pSize / 2, color, cosmetics.deathEffect);

                  if (activeView === 'SOLO') {
                    setGameState('GAME_OVER');
                    break;
                  } else {
                    p.lives -= 1;
                    p.respawnInvulnerable = 90;
                    p.playerY = p.mode === 'CUBE' ? groundY - pSize : (groundY + ceilingY) / 2;
                    p.vy = 0;

                    if (name === 'P1') setP1Lives(p.lives);
                    if (name === 'P2') setP2Lives(p.lives);

                    if (activeView === 'ONLINE_GAME' && onlineWsRef.current?.readyState === WebSocket.OPEN) {
                      onlineWsRef.current.send(JSON.stringify({ type: 'GD_CRASH', lives: p.lives }));
                    }

                    if (p.lives <= 0) {
                      const finalWinner = name === 'P1' ? 'P2' : 'P1';
                      setWinner(finalWinner);
                      sound.playVictory();
                      onScoreUpdate('geometry-dash', 100);
                      setGameState('GAME_OVER');
                      break;
                    }
                  }
                }
              }
            }
            // Blocks
            else if (obs.type === 'BLOCK') {
              const bLeft = sx;
              const bRight = sx + obs.w;
              const bTop = obsLocalY;
              const bBottom = obsLocalY + obs.h;

              const isFalling = p.vy >= 0;
              const previousBottom = pBottom - p.vy;
              const canLandOnTop = isFalling && previousBottom <= bTop + 14 && p.mode === 'CUBE';

              if (pRight > bLeft && pLeft < bRight && pBottom >= bTop && pTop < bBottom) {
                if (canLandOnTop) {
                  p.playerY = bTop - pSize;
                  p.vy = 0;
                  p.isGrounded = true;
                } else if (p.respawnInvulnerable <= 0) {
                  sound.playCrash();
                  if (name === 'P1') eng.screenShakeP1 = 12;
                  else eng.screenShakeP2 = 12;

                  spawnExplosion(px + pSize / 2, py + trackYOffset + pSize / 2, color, cosmetics.deathEffect);

                  if (activeView === 'SOLO') {
                    setGameState('GAME_OVER');
                    break;
                  } else {
                    p.lives -= 1;
                    p.respawnInvulnerable = 90;
                    p.playerY = p.mode === 'CUBE' ? groundY - pSize : (groundY + ceilingY) / 2;
                    p.vy = 0;

                    if (name === 'P1') setP1Lives(p.lives);
                    if (name === 'P2') setP2Lives(p.lives);

                    if (activeView === 'ONLINE_GAME' && onlineWsRef.current?.readyState === WebSocket.OPEN) {
                      onlineWsRef.current.send(JSON.stringify({ type: 'GD_CRASH', lives: p.lives }));
                    }

                    if (p.lives <= 0) {
                      const finalWinner = name === 'P1' ? 'P2' : 'P1';
                      setWinner(finalWinner);
                      sound.playVictory();
                      onScoreUpdate('geometry-dash', 100);
                      setGameState('GAME_OVER');
                      break;
                    }
                  }
                }
              }
            }
            // Jump Pad
            else if (obs.type === 'PAD') {
              if (pRight > sx && pLeft < sx + obs.w && pBottom >= obsLocalY && pTop <= obsLocalY + obs.h && !obs.triggered) {
                obs.triggered = true;
                p.vy = -16.0;
                p.isGrounded = false;
                sound.playPad();
                spawnExplosion(sx + obs.w / 2, obsLocalY + trackYOffset, '#FACC15');
              }
            }
            // Air Orb
            else if (obs.type === 'ORB') {
              const orbCenterX = sx + obs.w / 2;
              const orbCenterY = obsLocalY + obs.h / 2;
              const dist = Math.hypot(px + pSize / 2 - orbCenterX, py + pSize / 2 - orbCenterY);
              const isClicking = p.jumpBufferTimer > 0 || p.holdingJump;

              if (dist < 52 && isClicking && !obs.triggered) {
                obs.triggered = true;
                p.vy = activeView === 'SOLO' ? -10.8 : -10.2;
                p.jumpBufferTimer = 0;
                p.isGrounded = false;
                sound.playOrb();
                spawnExplosion(orbCenterX, orbCenterY + trackYOffset, color);
              }
            }
            // Portals
            else if (obs.type === 'PORTAL_ROCKET') {
              if (pRight > sx && pLeft < sx + obs.w && p.mode !== 'SHIP') {
                p.mode = 'SHIP';
                sound.playPortal();
              }
            } else if (obs.type === 'PORTAL_WAVE') {
              if (pRight > sx && pLeft < sx + obs.w && p.mode !== 'WAVE') {
                p.mode = 'WAVE';
                sound.playPortal();
              }
            } else if (obs.type === 'PORTAL_CUBE') {
              if (pRight > sx && pLeft < sx + obs.w && p.mode !== 'CUBE') {
                p.mode = 'CUBE';
                sound.playPortal();
              }
            }
            // Speed Portals
            else if (
              (obs.type === 'SPEED_1X' || obs.type === 'SPEED_2X' || obs.type === 'SPEED_3X') &&
              allowDynamicSpeed
            ) {
              const targetSpeed: SpeedSetting =
                obs.type === 'SPEED_3X' ? 3 : obs.type === 'SPEED_2X' ? 2 : 1;

              if (pRight > sx && pLeft < sx + obs.w && eng.currentSpeedMult !== targetSpeed) {
                eng.currentSpeedMult = targetSpeed;
                setSpeedMultiplier(targetSpeed);
                sound.playSpeedPortal(targetSpeed);
                setSpeedToast(`${targetSpeed}X HIZ!`);
                setTimeout(() => setSpeedToast(null), 1400);
              }
            }
            // Finish line (Solo)
            else if (obs.type === 'FINISH' && activeView === 'SOLO') {
              if (pRight > sx) {
                sound.playVictory();
                onScoreUpdate('geometry-dash', 100);
                setGameState('ROUND_SUMMARY');
                break;
              }
            }
          }
        }
      }

      // =====================================================================
      // RENDERING CANVAS
      // =====================================================================
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (activeView === 'SOLO') {
        // --- SOLO FULL-SCREEN TRACK ---
        ctx.save();
        const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bgGrad.addColorStop(0, '#060911');
        bgGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        ctx.lineWidth = 1;
        const gridShift = -(eng.worldX * 0.45) % 44;
        for (let gx = gridShift; gx < canvas.width; gx += 44) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, SOLO_GROUND_Y);
          ctx.stroke();
        }

        // Ceiling bar
        if (eng.solo.mode !== 'CUBE') {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(0, 0, canvas.width, SOLO_CEILING_Y);
          ctx.strokeStyle = '#EC4899';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, SOLO_CEILING_Y);
          ctx.lineTo(canvas.width, SOLO_CEILING_Y);
          ctx.stroke();
        }

        // Floor
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, SOLO_GROUND_Y, canvas.width, canvas.height - SOLO_GROUND_Y);
        ctx.strokeStyle = cosmetics.primaryColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, SOLO_GROUND_Y);
        ctx.lineTo(canvas.width, SOLO_GROUND_Y);
        ctx.stroke();

        // Floor chevrons
        const floorShift = -(eng.worldX % 50);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 2;
        for (let fx = floorShift; fx < canvas.width; fx += 50) {
          ctx.beginPath();
          ctx.moveTo(fx, SOLO_GROUND_Y + 10);
          ctx.lineTo(fx + 22, SOLO_GROUND_Y + 32);
          ctx.stroke();
        }

        // Obstacles
        for (const obs of eng.obstacles) {
          const sx = obs.x - eng.worldX;
          if (sx + obs.w < -60 || sx > canvas.width + 60) continue;

          if (obs.type === 'SPIKE') {
            ctx.fillStyle = '#F43F5E';
            ctx.strokeStyle = '#FFE4E6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, obs.y + obs.h);
            ctx.lineTo(sx + obs.w / 2, obs.y);
            ctx.lineTo(sx + obs.w, obs.y + obs.h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (obs.type === 'DOUBLE_SPIKE' || obs.type === 'TRIPLE_SPIKE') {
            const count = obs.type === 'DOUBLE_SPIKE' ? 2 : 3;
            const pieceW = obs.w / count;
            for (let k = 0; k < count; k++) {
              const ox = sx + k * pieceW;
              ctx.fillStyle = '#F43F5E';
              ctx.strokeStyle = '#FFE4E6';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(ox, obs.y + obs.h);
              ctx.lineTo(ox + pieceW / 2, obs.y);
              ctx.lineTo(ox + pieceW, obs.y + obs.h);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          } else if (obs.type === 'BLOCK') {
            ctx.fillStyle = '#1E293B';
            ctx.strokeStyle = cosmetics.primaryColor;
            ctx.lineWidth = 2;
            ctx.fillRect(sx, obs.y, obs.w, obs.h);
            ctx.strokeRect(sx, obs.y, obs.w, obs.h);
          } else if (obs.type === 'PAD') {
            ctx.fillStyle = '#FACC15';
            ctx.beginPath();
            ctx.arc(sx + obs.w / 2, obs.y + obs.h, obs.w / 2, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#FEF08A';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (obs.type === 'ORB') {
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(sx + obs.w / 2, obs.y + obs.h, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
            ctx.fill();
          } else if (obs.type === 'PORTAL_ROCKET' || obs.type === 'PORTAL_CUBE' || obs.type === 'PORTAL_WAVE') {
            const pCol =
              obs.type === 'PORTAL_ROCKET' ? '#EC4899' : obs.type === 'PORTAL_WAVE' ? '#F59E0B' : '#06B6D4';
            ctx.strokeStyle = pCol;
            ctx.lineWidth = 4;
            ctx.strokeRect(sx, obs.y, obs.w, obs.h);
            ctx.fillStyle = `${pCol}33`;
            ctx.fillRect(sx, obs.y, obs.w, obs.h);
          } else if (obs.type === 'FINISH') {
            const fGrad = ctx.createLinearGradient(sx, obs.y, sx + obs.w, obs.y + obs.h);
            fGrad.addColorStop(0, '#10B981');
            fGrad.addColorStop(1, '#3B82F6');
            ctx.fillStyle = fGrad;
            ctx.fillRect(sx, obs.y, obs.w, obs.h);
          }
        }

        // Draw Player with Equipped Cosmetics
        if (gameState !== 'GAME_OVER') {
          const px = FIXED_PLAYER_SCREEN_X;
          const py = eng.solo.playerY;

          // Trail Rendering
          for (let i = 0; i < eng.solo.trail.length; i++) {
            const tr = eng.solo.trail[i];
            const trAlpha = ((i + 1) / (eng.solo.trail.length + 1)) * 0.35;
            ctx.save();
            ctx.globalAlpha = trAlpha;
            ctx.translate(tr.x + 18, tr.y + 18);
            ctx.rotate((tr.rot * Math.PI) / 180);
            ctx.fillStyle =
              cosmetics.trailEffect === 'trail-rainbow'
                ? `hsl(${(tr.tick * 10) % 360}, 90%, 60%)`
                : cosmetics.primaryColor;
            ctx.fillRect(-18, -18, 36, 36);
            ctx.restore();
          }

          ctx.save();
          ctx.translate(px + 18, py + 18);
          ctx.rotate((eng.solo.rotation * Math.PI) / 180);

          if (eng.solo.mode === 'CUBE') {
            drawCubeSkin(ctx, cosmetics.cubeSkin, cosmetics.primaryColor, cosmetics.secondaryColor, 36);
          } else if (eng.solo.mode === 'SHIP') {
            drawShipSkin(ctx, cosmetics.shipSkin, cosmetics.primaryColor, cosmetics.secondaryColor, eng.solo.holdingJump);
          } else {
            drawWaveSkin(ctx, cosmetics.waveSkin, cosmetics.primaryColor, cosmetics.secondaryColor);
          }
          ctx.restore();
        }

        ctx.restore();
      } else {
        // =====================================================================
        // --- LOCAL DUAL & ONLINE ARENA (2 SPLIT TRACKS) ---
        // =====================================================================
        const tracks = [
          {
            trackIndex: 0,
            yOffset: 0,
            label:
              activeView === 'ONLINE_GAME'
                ? myOnlineSlot === 'P1'
                  ? `SEN (${playerName}) · [W / BOŞLUK]`
                  : `RAKİP (${onlineOpponent?.name || 'Oyuncu 1'})`
                : '1. OYUNCU (MAVİ) · [W / BOŞLUK]',
            color:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P2' && onlineOpponent
                ? onlineOpponent.cosmetics?.primaryColor || '#3B82F6'
                : cosmetics.primaryColor,
            secColor:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P2' && onlineOpponent
                ? onlineOpponent.cosmetics?.secondaryColor || '#FFFFFF'
                : cosmetics.secondaryColor,
            skin:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P2' && onlineOpponent
                ? onlineOpponent.cosmetics?.cubeSkin || 'cube-classic'
                : cosmetics.cubeSkin,
            shipSkin:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P2' && onlineOpponent
                ? onlineOpponent.cosmetics?.shipSkin || 'ship-classic'
                : cosmetics.shipSkin,
            waveSkin:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P2' && onlineOpponent
                ? onlineOpponent.cosmetics?.waveSkin || 'wave-classic'
                : cosmetics.waveSkin,
            p: eng.p1,
            shake: eng.screenShakeP1,
          },
          {
            trackIndex: 1,
            yOffset: DUAL_TRACK_HEIGHT,
            label:
              activeView === 'ONLINE_GAME'
                ? myOnlineSlot === 'P2'
                  ? `SEN (${playerName}) · [W / BOŞLUK]`
                  : `RAKİP (${onlineOpponent?.name || 'Oyuncu 2'})`
                : '2. OYUNCU (KIRMIZI) · [YUKARI OK / ENTER / L]',
            color:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P1' && onlineOpponent
                ? onlineOpponent.cosmetics?.primaryColor || '#EF4444'
                : activeView === 'ONLINE_GAME'
                ? cosmetics.primaryColor
                : '#EF4444',
            secColor:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P1' && onlineOpponent
                ? onlineOpponent.cosmetics?.secondaryColor || '#FFFFFF'
                : activeView === 'ONLINE_GAME'
                ? cosmetics.secondaryColor
                : '#FEF08A',
            skin:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P1' && onlineOpponent
                ? onlineOpponent.cosmetics?.cubeSkin || 'cube-classic'
                : activeView === 'ONLINE_GAME'
                ? cosmetics.cubeSkin
                : 'cube-ninja',
            shipSkin:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P1' && onlineOpponent
                ? onlineOpponent.cosmetics?.shipSkin || 'ship-classic'
                : activeView === 'ONLINE_GAME'
                ? cosmetics.shipSkin
                : 'ship-stealth',
            waveSkin:
              activeView === 'ONLINE_GAME' && myOnlineSlot === 'P1' && onlineOpponent
                ? onlineOpponent.cosmetics?.waveSkin || 'wave-classic'
                : activeView === 'ONLINE_GAME'
                ? cosmetics.waveSkin
                : 'wave-shuriken',
            p: eng.p2,
            shake: eng.screenShakeP2,
          },
        ];

        tracks.forEach(({ yOffset, label, color, secColor, skin, shipSkin, waveSkin, p, shake }) => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, yOffset, canvas.width, DUAL_TRACK_HEIGHT);
          ctx.clip();

          if (shake > 0) {
            const sx = (Math.random() - 0.5) * shake;
            const sy = (Math.random() - 0.5) * shake;
            ctx.translate(sx, sy);
          }

          // Background
          const bgGrad = ctx.createLinearGradient(0, yOffset, 0, yOffset + DUAL_TRACK_HEIGHT);
          bgGrad.addColorStop(0, '#060911');
          bgGrad.addColorStop(1, '#0F172A');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, yOffset, canvas.width, DUAL_TRACK_HEIGHT);

          // Grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.lineWidth = 1;
          const gridShift = -(eng.worldX * 0.45) % 40;
          for (let gx = gridShift; gx < canvas.width; gx += 40) {
            ctx.beginPath();
            ctx.moveTo(gx, yOffset);
            ctx.lineTo(gx, yOffset + DUAL_GROUND_Y);
            ctx.stroke();
          }

          // Ceiling bar
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fillRect(0, yOffset, canvas.width, DUAL_CEILING_Y);
          ctx.strokeStyle = p.mode === 'WAVE' ? '#06B6D4' : p.mode === 'SHIP' ? '#EC4899' : '#334155';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, yOffset + DUAL_CEILING_Y);
          ctx.lineTo(canvas.width, yOffset + DUAL_CEILING_Y);
          ctx.stroke();

          // Floor
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(0, yOffset + DUAL_GROUND_Y, canvas.width, DUAL_TRACK_HEIGHT - DUAL_GROUND_Y);
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, yOffset + DUAL_GROUND_Y);
          ctx.lineTo(canvas.width, yOffset + DUAL_GROUND_Y);
          ctx.stroke();

          // Chevrons
          const floorShift = -(eng.worldX % 44);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 2;
          for (let fx = floorShift; fx < canvas.width; fx += 44) {
            ctx.beginPath();
            ctx.moveTo(fx, yOffset + DUAL_GROUND_Y + 8);
            ctx.lineTo(fx + 18, yOffset + DUAL_GROUND_Y + 28);
            ctx.stroke();
          }

          // Track HUD
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(10, yOffset + 5, 330, 22);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(10, yOffset + 5, 330, 22);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`${label} · [${p.mode}]`, 16, yOffset + 20);

          // Speed Badge
          const curSpd = eng.currentSpeedMult;
          const spColor = curSpd === 3 ? '#F43F5E' : curSpd === 2 ? '#F59E0B' : '#06B6D4';
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.fillRect(canvas.width - 105, yOffset + 5, 95, 22);
          ctx.strokeStyle = spColor;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(canvas.width - 105, yOffset + 5, 95, 22);
          ctx.fillStyle = spColor;
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`⚡ ${curSpd}X HIZ`, canvas.width - 92, yOffset + 20);

          // Shield status
          if (p.respawnInvulnerable > 0) {
            const pct = Math.ceil((p.respawnInvulnerable / 90) * 100);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
            ctx.fillRect(canvas.width - 220, yOffset + 5, 105, 22);
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(canvas.width - 220, yOffset + 5, 105, 22);
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(`🛡️ KORUMA %${pct}`, canvas.width - 212, yOffset + 20);
          }

          // Draw Obstacles
          for (const obs of eng.obstacles) {
            const sx = obs.x - eng.worldX;
            if (sx + obs.w < -60 || sx > canvas.width + 60) continue;

            const drawY = obs.y + yOffset;

            if (obs.type === 'SPIKE') {
              ctx.fillStyle = '#F43F5E';
              ctx.strokeStyle = '#FFE4E6';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(sx, drawY + obs.h);
              ctx.lineTo(sx + obs.w / 2, drawY);
              ctx.lineTo(sx + obs.w, drawY + obs.h);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } else if (obs.type === 'DOUBLE_SPIKE' || obs.type === 'TRIPLE_SPIKE') {
              const count = obs.type === 'DOUBLE_SPIKE' ? 2 : 3;
              const pieceW = obs.w / count;
              for (let k = 0; k < count; k++) {
                const ox = sx + k * pieceW;
                ctx.fillStyle = '#F43F5E';
                ctx.strokeStyle = '#FFE4E6';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ox, drawY + obs.h);
                ctx.lineTo(ox + pieceW / 2, drawY);
                ctx.lineTo(ox + pieceW, drawY + obs.h);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }
            } else if (obs.type === 'BLOCK') {
              ctx.fillStyle = '#1E293B';
              ctx.strokeStyle = color;
              ctx.lineWidth = 2;
              ctx.fillRect(sx, drawY, obs.w, obs.h);
              ctx.strokeRect(sx, drawY, obs.w, obs.h);
            } else if (obs.type === 'PAD') {
              ctx.fillStyle = '#FACC15';
              ctx.beginPath();
              ctx.arc(sx + obs.w / 2, drawY + obs.h, obs.w / 2, Math.PI, 0);
              ctx.fill();
              ctx.strokeStyle = '#FEF08A';
              ctx.lineWidth = 2;
              ctx.stroke();
            } else if (obs.type === 'ORB') {
              ctx.strokeStyle = '#FACC15';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(sx + obs.w / 2, drawY + obs.h / 2, 14, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
              ctx.fill();
            } else if (obs.type === 'PORTAL_ROCKET' || obs.type === 'PORTAL_CUBE' || obs.type === 'PORTAL_WAVE') {
              const pCol =
                obs.type === 'PORTAL_ROCKET'
                  ? '#EC4899'
                  : obs.type === 'PORTAL_WAVE'
                  ? '#F59E0B'
                  : '#06B6D4';
              const pLabel =
                obs.type === 'PORTAL_ROCKET' ? 'SHIP' : obs.type === 'PORTAL_WAVE' ? 'WAVE' : 'CUBE';

              ctx.strokeStyle = pCol;
              ctx.lineWidth = 3.5;
              ctx.strokeRect(sx, drawY, obs.w, obs.h);
              ctx.fillStyle = `${pCol}28`;
              ctx.fillRect(sx, drawY, obs.w, obs.h);

              ctx.fillStyle = pCol;
              ctx.font = 'bold 9px sans-serif';
              ctx.fillText(pLabel, sx + 5, drawY + obs.h / 2);
            } else if (obs.type === 'SPEED_1X' || obs.type === 'SPEED_2X' || obs.type === 'SPEED_3X') {
              const spdNum = obs.type === 'SPEED_3X' ? '3X' : obs.type === 'SPEED_2X' ? '2X' : '1X';
              const spdColor =
                obs.type === 'SPEED_3X' ? '#F43F5E' : obs.type === 'SPEED_2X' ? '#F59E0B' : '#06B6D4';
              const arrows = obs.type === 'SPEED_3X' ? '>>>' : obs.type === 'SPEED_2X' ? '>>' : '>';

              ctx.strokeStyle = spdColor;
              ctx.lineWidth = 3.5;
              ctx.strokeRect(sx, drawY, obs.w, obs.h);
              ctx.fillStyle = `${spdColor}30`;
              ctx.fillRect(sx, drawY, obs.w, obs.h);

              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 11px sans-serif';
              ctx.fillText(arrows, sx + 5, drawY + obs.h / 2 - 6);
              ctx.fillStyle = spdColor;
              ctx.font = 'bold 9px sans-serif';
              ctx.fillText(spdNum, sx + 7, drawY + obs.h / 2 + 10);
            }
          }

          // Player Trails
          for (let i = 0; i < p.trail.length; i++) {
            const tr = p.trail[i];
            const trAlpha = ((i + 1) / (p.trail.length + 1)) * 0.35;
            ctx.save();
            ctx.globalAlpha = trAlpha;
            ctx.translate(tr.x + 14, tr.y + yOffset + 14);
            ctx.rotate((tr.rot * Math.PI) / 180);
            ctx.fillStyle = color;
            ctx.fillRect(-14, -14, 28, 28);
            ctx.restore();
          }

          // Player Avatar with Cosmetics
          if (gameState !== 'GAME_OVER' || winner) {
            const px = FIXED_PLAYER_SCREEN_X;
            const py = p.playerY + yOffset;

            // Shield Bubble while invulnerable
            if (p.respawnInvulnerable > 0) {
              ctx.save();
              ctx.strokeStyle = '#10B981';
              ctx.lineWidth = 2.5;
              ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
              ctx.beginPath();
              ctx.arc(px + 14, py + 14, 22 + Math.sin(eng.beatTimer * 0.3) * 3, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            }

            ctx.save();
            ctx.translate(px + 14, py + 14);
            ctx.rotate((p.rotation * Math.PI) / 180);

            if (p.respawnInvulnerable > 0 && Math.floor(eng.beatTimer / 3) % 2 === 0) {
              ctx.globalAlpha = 0.55;
            }

            if (p.mode === 'CUBE') {
              drawCubeSkin(ctx, skin, color, secColor, 28);
            } else if (p.mode === 'SHIP') {
              drawShipSkin(ctx, shipSkin, color, secColor, p.holdingJump);
            } else if (p.mode === 'WAVE') {
              drawWaveSkin(ctx, waveSkin, color, secColor);
            }

            ctx.restore();
          }

          ctx.restore();
        });

        // Center Split Divider
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, DUAL_TRACK_HEIGHT - 3, canvas.width, 6);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, DUAL_TRACK_HEIGHT);
        ctx.lineTo(canvas.width, DUAL_TRACK_HEIGHT);
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.fillRect(canvas.width / 2 - 80, DUAL_TRACK_HEIGHT - 13, 160, 26);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - 80, DUAL_TRACK_HEIGHT - 13, 160, 26);
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(activeView === 'ONLINE_GAME' ? 'CANLI ONLİNE DÜELLO' : 'SONSUZ DÜELLO · 5 CAN', canvas.width / 2, DUAL_TRACK_HEIGHT + 4);
        ctx.textAlign = 'left';
      }

      // Draw Particles
      for (let i = eng.particles.length - 1; i >= 0; i--) {
        const pt = eng.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.025;
        if (pt.alpha <= 0) {
          eng.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    activeView,
    gameState,
    levelIdx,
    levels,
    cosmetics,
    showHitboxes,
    winner,
    speedMultiplier,
    allowDynamicSpeed,
    generateEndlessSegment,
    onScoreUpdate,
    playerName,
    myOnlineSlot,
    onlineOpponent,
  ]);

  // =========================================================================
  // RENDER MAIN MENU VIEW
  // =========================================================================
  if (activeView === 'MAIN_MENU') {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#090D18] p-6 sm:p-8 flex flex-col items-center justify-between min-h-[580px] shadow-2xl text-center select-none">
        {/* Animated Cyber Grid & Glowing Stars Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.18),transparent_65%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Ambient Floating Shapes */}
        <div className="absolute top-12 left-10 w-12 h-12 rounded-lg border-2 border-blue-500/20 rotate-12 animate-pulse pointer-events-none" />
        <div className="absolute top-24 right-12 w-10 h-10 rounded-lg border-2 border-amber-500/20 -rotate-12 animate-pulse pointer-events-none" />
        <div className="absolute bottom-16 left-16 w-8 h-8 rounded-lg border-2 border-emerald-500/20 rotate-45 pointer-events-none" />
        <div className="absolute bottom-20 right-20 w-14 h-14 rounded-lg border-2 border-purple-500/20 -rotate-6 pointer-events-none" />

        {/* Header Bar */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm animate-ping" />
            <span className="font-extrabold text-white tracking-widest uppercase text-[11px] sm:text-xs">
              GEOMETRY DASH ARENA
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              v2.5 ONLINE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Kontroller</span>
            </button>
            <button
              onClick={() => setActiveView('GARAGE')}
              className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 rounded-full border border-white/10 cursor-pointer transition-colors"
            >
              <div
                className="w-4 h-4 rounded-sm border border-white/40 shadow-sm"
                style={{ backgroundColor: cosmetics.primaryColor }}
              />
              <span className="font-bold text-white text-xs">{playerName}</span>
            </button>
          </div>
        </div>

        {/* Central Logo & Rhythm Pulse */}
        <div className="my-6 flex flex-col items-center gap-3 z-10">
          <div className="relative group cursor-pointer" onClick={() => sound.playBeat(1)}>
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 tracking-tight drop-shadow-[0_8px_24px_rgba(59,130,246,0.4)]">
              GEOMETRY DASH
            </h1>
            <span className="absolute -bottom-3 right-0 sm:right-2 text-[11px] font-black tracking-widest text-amber-400 uppercase bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/40 shadow-sm">
              RİTMİK ARENA
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mt-2 leading-relaxed">
            10 seviyeli Solo Macera, aynı ekranda 2 Kişilik Sonsuz Düello ve arkadaşınla canlı çok oyunculu yarış!
          </p>
        </div>

        {/* 4 Big Main Menu Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl z-10">
          {/* 1. Solo Play */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-600/30 to-blue-950/60 border border-blue-500/40 hover:border-blue-400 hover:scale-[1.02] transition-all cursor-pointer flex flex-col items-center justify-between text-center group shadow-xl">
            <div
              className="w-full flex flex-col items-center"
              onClick={() => {
                setActiveView('SOLO');
                setGameState('TITLE_MENU');
                sound.playPop();
              }}
            >
              <div className="p-3.5 rounded-2xl bg-blue-600 text-white shadow-lg mb-3 group-hover:bg-blue-500 transition-colors group-hover:rotate-6">
                <Play className="w-7 h-7 fill-current" />
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Solo Macera</h3>
              <p className="text-xs text-slate-300 mb-3">10 seviye, pratik modu ve ritim engelleri</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLevelModal(true);
                sound.playPop();
              }}
              className="w-full mt-2 py-1.5 px-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
              Bölüm Seç ({levelIdx + 1}/10)
            </button>
          </div>

          {/* 2. Local 2-Player Versus */}
          <div
            onClick={() => {
              setActiveView('LOCAL_DUAL');
              setGameState('TITLE_MENU');
              sound.playPop();
            }}
            className="p-5 rounded-2xl bg-gradient-to-b from-purple-600/30 to-indigo-950/60 border border-purple-500/40 hover:border-purple-400 hover:scale-[1.02] transition-all cursor-pointer flex flex-col items-center justify-between text-center group shadow-xl"
          >
            <div className="w-full flex flex-col items-center">
              <div className="p-3.5 rounded-2xl bg-purple-600 text-white shadow-lg mb-3 group-hover:bg-purple-500 transition-colors group-hover:-rotate-6">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">2 Kişilik Düello</h3>
              <p className="text-xs text-slate-300 mb-3">Yatay bölünmüş ekran, 5 can ve 1x/2x/3x hız</p>
            </div>
            <div className="w-full mt-2 py-1.5 px-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[11px] font-bold">
              ⚔️ İlk 5 Canı Biten Kaybeder!
            </div>
          </div>

          {/* 3. Online Multiplayer */}
          <div
            onClick={() => {
              setActiveView('ONLINE_LOBBY');
              sound.playPop();
            }}
            className="p-5 rounded-2xl bg-gradient-to-b from-emerald-600/30 to-teal-950/60 border border-emerald-500/40 hover:border-emerald-400 hover:scale-[1.02] transition-all cursor-pointer flex flex-col items-center justify-between text-center group shadow-xl"
          >
            <div className="w-full flex flex-col items-center">
              <div className="p-3.5 rounded-2xl bg-emerald-600 text-white shadow-lg mb-3 group-hover:bg-emerald-500 transition-colors group-hover:scale-110">
                <Globe className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Online Düello</h3>
              <p className="text-xs text-slate-300 mb-3">Oda kodu veya hızlı eşleşmeyle canlı çok oyunculu</p>
            </div>
            <div className="w-full mt-2 py-1.5 px-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Canlı Çok Oyunculu
            </div>
          </div>

          {/* 4. Garage / Icon Kit */}
          <div
            onClick={() => {
              setActiveView('GARAGE');
              sound.playPop();
            }}
            className="p-5 rounded-2xl bg-gradient-to-b from-amber-600/30 to-orange-950/60 border border-amber-500/40 hover:border-amber-400 hover:scale-[1.02] transition-all cursor-pointer flex flex-col items-center justify-between text-center group shadow-xl"
          >
            <div className="w-full flex flex-col items-center">
              <div className="p-3.5 rounded-2xl bg-amber-500 text-slate-950 shadow-lg mb-3 group-hover:bg-amber-400 transition-colors group-hover:rotate-12">
                <Palette className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-base text-white mb-1">Garaj & Kostüm</h3>
              <p className="text-xs text-slate-300 mb-3">20 küp, 10 roket, 10 wave, renk ve efekt atölyesi</p>
            </div>
            <div className="w-full mt-2 py-1.5 px-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
              🎨 40+ Görünüm & Efekt
            </div>
          </div>
        </div>

        {/* Quick Footer Stats */}
        <div className="w-full pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-400 z-10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <Trophy className="w-4 h-4 text-amber-400" /> En Yüksek İlerleme: %{progressPct}
            </span>
            <span className="text-slate-600">·</span>
            <span>Deneme Sayısı: {attempts}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400">Aktif Kostüm:</span>
            <span
              className="px-2.5 py-0.5 rounded-md font-bold text-white border border-white/20 text-[11px] shadow-sm"
              style={{ backgroundColor: cosmetics.primaryColor }}
            >
              {cosmetics.cubeSkin}
            </span>
          </div>
        </div>

        {/* LEVEL SELECTOR MODAL */}
        {showLevelModal && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="bg-[#101726] border border-white/10 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col gap-4 text-left max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <h3 className="text-lg font-black text-white">Seviye Seçimi (10 Seviye)</h3>
                </div>
                <button
                  onClick={() => setShowLevelModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 max-h-[60vh]">
                {levels.map((lvl, idx) => (
                  <div
                    key={lvl.id}
                    onClick={() => {
                      setLevelIdx(idx);
                      setShowLevelModal(false);
                      setActiveView('SOLO');
                      setGameState('TITLE_MENU');
                      sound.playPop();
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      levelIdx === idx
                        ? 'bg-blue-900/40 border-blue-400 ring-2 ring-blue-500/30'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/20 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-slate-400">
                          #{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-white">{lvl.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{lvl.desc}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border"
                        style={{
                          color: lvl.accent,
                          borderColor: `${lvl.accent}40`,
                          backgroundColor: `${lvl.accent}15`,
                        }}
                      >
                        {lvl.difficulty}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">Hız: {lvl.speed}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HOW TO PLAY / CONTROLS MODAL */}
        {showHelpModal && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center p-4 sm:p-6">
            <div className="bg-[#101726] border border-white/10 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-black text-white">Oyun Kontrolleri & Rehber</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 text-xs text-slate-300 max-h-[65vh] overflow-y-auto pr-1">
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20">
                  <h4 className="font-bold text-blue-400 mb-1">🎮 Solo & 1. Oyuncu Kontrolleri</h4>
                  <p className="leading-relaxed">
                    <strong>Boşluk</strong>, <strong>Yukarı Ok</strong>, <strong>W</strong> veya ekrana sol tık ile zıpla.
                    Pratik modunda <strong>Z</strong> tuşu kontrol noktası bırakır.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20">
                  <h4 className="font-bold text-rose-400 mb-1">⚔️ 2. Oyuncu Kontrolleri (Yerel Düello)</h4>
                  <p className="leading-relaxed">
                    <strong>Aşağı Ok</strong>, <strong>Enter</strong>, <strong>L</strong> veya alt ekrana tıkla.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                  <h4 className="font-bold text-amber-400 mb-1">🚀 Araç Modları</h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li><strong>Küp:</strong> Zıpla ve blokların üzerine in.</li>
                    <li><strong>Roket (Ship):</strong> Tuşa basılı tutarak yüksel, bırakınca alçal.</li>
                    <li><strong>Wave (Dalga):</strong> Basılı tutunca 45° yukarı, bırakınca 45° aşağı fırla!</li>
                    <li><strong>Orblar:</strong> Havadayken halkaya girince tıkla, ek sıçrama kazan!</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER GARAGE MODAL / VIEW
  // =========================================================================
  if (activeView === 'GARAGE') {
    return (
      <GDGarageModal
        cosmetics={cosmetics}
        playerName={playerName}
        onUpdate={(newCos, newName) => {
          setCosmetics(newCos);
          setPlayerName(newName);
        }}
        onClose={() => setActiveView('MAIN_MENU')}
      />
    );
  }

  // =========================================================================
  // RENDER ONLINE MULTIPLAYER LOBBY
  // =========================================================================
  if (activeView === 'ONLINE_LOBBY') {
    return (
      <GDOnlineLobby
        playerName={playerName}
        myCosmetics={cosmetics}
        onStartMatch={handleStartOnlineMatch}
        onBackToMenu={() => setActiveView('MAIN_MENU')}
      />
    );
  }

  // =========================================================================
  // RENDER IN-GAME ARENA (SOLO, LOCAL DUAL, ONLINE GAME)
  // =========================================================================
  return (
    <div className="flex flex-col gap-4">
      {/* Top Navigation & Mode Selector */}
      <div className="bg-[#131B2E] border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          {/* Back to Main Menu Button */}
          <button
            onClick={() => {
              if (activeView === 'ONLINE_GAME' && onlineWsRef.current) {
                onlineWsRef.current.close();
              }
              setActiveView('MAIN_MENU');
              setGameState('TITLE_MENU');
              sound.playPop();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> Ana Menü
          </button>

          {/* Mode Switchers */}
          <button
            onClick={() => {
              setActiveView('SOLO');
              setGameState('TITLE_MENU');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'SOLO'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" /> Solo (10 Seviye)
          </button>
          <button
            onClick={() => {
              setActiveView('LOCAL_DUAL');
              setGameState('TITLE_MENU');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'LOCAL_DUAL'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> 2 Kişilik Yerel
          </button>
          <button
            onClick={() => {
              setActiveView('ONLINE_LOBBY');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'ONLINE_GAME'
                ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Online Düello
          </button>
        </div>

        {/* Right Action: Garage Quick Link & Hitbox */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveView('GARAGE')}
            className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer flex items-center gap-1"
          >
            <Palette className="w-3.5 h-3.5" /> Garaj / Kostümler
          </button>
          {activeView === 'SOLO' && (
            <button
              onClick={() => setPracticeMode((p) => !p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                practiceMode
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              Pratik (Z): {practiceMode ? 'AÇIK' : 'KAPALI'}
            </button>
          )}
          <button
            onClick={() => setShowHitboxes((h) => !h)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer flex items-center gap-1 ${
              showHitboxes
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Hitbox: {showHitboxes ? 'AÇIK' : 'KAPALI'}
          </button>
        </div>
      </div>

      {/* Mode Sub-Bar (Level Selector or Dual Lives HUD) */}
      {activeView === 'SOLO' ? (
        <div className="bg-[#131B2E] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (levelIdx > 0) {
                  setLevelIdx((i) => i - 1);
                  setGameState('TITLE_MENU');
                }
              }}
              disabled={levelIdx === 0}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-300 font-medium">
              Bölüm {levelIdx + 1}/10: {currentLevel.name} ({currentLevel.difficulty})
            </span>
            <button
              onClick={() => {
                if (levelIdx < levels.length - 1) {
                  setLevelIdx((i) => i + 1);
                  setGameState('TITLE_MENU');
                }
              }}
              disabled={levelIdx === levels.length - 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            <span className="text-slate-400 mr-2">İlerleme:</span>
            <span className="font-mono-num font-bold text-blue-400">%{progressPct}</span>
          </div>
        </div>
      ) : (
        <div className="bg-[#131B2E] border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          {/* Player 1 Lives */}
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm" />
            <span className="text-xs font-bold text-white">
              {activeView === 'ONLINE_GAME'
                ? myOnlineSlot === 'P1'
                  ? `Sen (${playerName})`
                  : onlineOpponent?.name || '1. Oyuncu'
                : '1. Oyuncu (Mavi)'}
              :
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: INITIAL_LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-transform ${
                    i < p1Lives ? 'text-blue-500 fill-blue-500' : 'text-slate-700'
                  }`}
                />
              ))}
              <span className="text-xs font-mono-num font-bold text-blue-400 ml-1">
                {p1Lives}/{INITIAL_LIVES}
              </span>
            </div>
          </div>

          {/* Speed Presets & Distance */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/10 rounded-lg p-1">
              <span className="text-[11px] font-semibold text-slate-400 px-1 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-blue-400" /> Hız:
              </span>
              {([1, 2, 3] as SpeedSetting[]).map((spd) => (
                <button
                  key={spd}
                  onClick={() => {
                    setSpeedMultiplier(spd);
                    engineRef.current.currentSpeedMult = spd;
                    sound.playSpeedPortal(spd);
                  }}
                  className={`px-2.5 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    speedMultiplier === spd
                      ? spd === 3
                        ? 'bg-rose-600 text-white shadow'
                        : spd === 2
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {spd}X
                </button>
              ))}
              <button
                onClick={() => setAllowDynamicSpeed((d) => !d)}
                className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  allowDynamicSpeed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                Portallar: {allowDynamicSpeed ? 'AÇIK' : 'SABİT'}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <Infinity className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400">Mesafe:</span>
              <span className="font-mono-num font-bold text-white text-sm">{endlessDistance}m</span>
            </div>
          </div>

          {/* Player 2 Lives */}
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm" />
            <span className="text-xs font-bold text-white">
              {activeView === 'ONLINE_GAME'
                ? myOnlineSlot === 'P2'
                  ? `Sen (${playerName})`
                  : onlineOpponent?.name || '2. Oyuncu'
                : '2. Oyuncu (Kırmızı)'}
              :
            </span>
            <div className="flex items-center gap-1">
              {Array.from({ length: INITIAL_LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-transform ${
                    i < p2Lives ? 'text-rose-500 fill-rose-500' : 'text-slate-700'
                  }`}
                />
              ))}
              <span className="text-xs font-mono-num font-bold text-rose-400 ml-1">
                {p2Lives}/{INITIAL_LIVES}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Screen */}
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 bg-[#060911] select-none shadow-2xl"
        onMouseDown={(e) => {
          if (gameState === 'PLAYING') {
            if (activeView === 'SOLO') {
              triggerSoloJump();
            } else if (activeView === 'LOCAL_DUAL') {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (rect) {
                const clickY = e.clientY - rect.top;
                if (clickY < rect.height / 2) triggerP1Jump();
                else triggerP2Jump();
              }
            } else if (activeView === 'ONLINE_GAME') {
              if (myOnlineSlot === 'P1') triggerP1Jump();
              else triggerP2Jump();
            }
          }
        }}
        onMouseUp={() => {
          if (activeView === 'SOLO') releaseSoloJump();
          else if (activeView === 'LOCAL_DUAL') {
            releaseP1Jump();
            releaseP2Jump();
          } else if (activeView === 'ONLINE_GAME') {
            if (myOnlineSlot === 'P1') releaseP1Jump();
            else releaseP2Jump();
          }
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-[450px] sm:h-[480px] block cursor-pointer"
        />

        {/* Speed Toast Banner */}
        {speedToast && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
            <div className="px-5 py-2.5 rounded-xl bg-slate-950/90 border-2 border-amber-400 shadow-2xl text-amber-300 font-black text-lg tracking-wider animate-bounce flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
              {speedToast}
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none z-30">
            <span className="text-xs font-bold text-blue-400 tracking-widest uppercase mb-2">
              DÜELLO BAŞLIYOR
            </span>
            <span className="text-7xl sm:text-8xl font-black text-white font-mono-num animate-ping">
              {countdownNum}
            </span>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setGameState('PAUSED');
            }}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer z-10"
          >
            <Pause className="w-3.5 h-3.5" /> Duraklat
          </button>
        )}

        {/* TITLE MENU MODAL */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            {activeView === 'SOLO' ? (
              <>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{currentLevel.name}</h2>
                <p className="text-sm text-slate-300 max-w-md mb-6">{currentLevel.desc}</p>
                <div className="flex gap-3">
                  <button
                    onClick={startPlay}
                    className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" /> Seviyeyi Başlat (Boşluk / Sol Tık)
                  </button>
                  <button
                    onClick={() => setActiveView('MAIN_MENU')}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Ana Menü
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Swords className="w-7 h-7 text-blue-400" />
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">2 Kişilik Sonsuz Düello</h2>
                </div>
                <p className="text-sm text-slate-300 max-w-lg mb-6">
                  Ekran yatay olarak ikiye ayrıldı! Her oyuncunun <strong>5 canı</strong> var. Çarptığınızda <strong>1.5 saniye koruma kalkanı</strong> devreye girer. Cube, Ship ve Wave modlarında adil yarış!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-lg w-full text-left text-xs">
                  <div className="p-3.5 bg-blue-950/40 border border-blue-500/40 rounded-xl">
                    <p className="font-bold text-blue-400 mb-1">1. Oyuncu (Üst Ekran)</p>
                    <p className="text-slate-300">
                      Kontrol: <strong>W</strong>, <strong>Boşluk</strong> veya üst ekrana tıkla/dokun
                    </p>
                  </div>
                  <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl">
                    <p className="font-bold text-rose-400 mb-1">2. Oyuncu (Alt Ekran)</p>
                    <p className="text-slate-300">
                      Kontrol: <strong>Yukarı/Aşağı Ok</strong>, <strong>Enter</strong>, <strong>L</strong> veya alt ekrana tıkla
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={startPlay}
                    className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" /> Düelloyu Başlat (3-2-1 Başlangıç)
                  </button>
                  <button
                    onClick={() => setActiveView('MAIN_MENU')}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Ana Menü
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* PAUSED */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
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
              <button
                onClick={() => {
                  setActiveView('MAIN_MENU');
                  setGameState('TITLE_MENU');
                }}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Home className="w-4 h-4" /> Ana Menü
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER (Winner or Crash) */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            {activeView === 'SOLO' ? (
              <>
                <h3 className="text-2xl font-bold text-rose-400 mb-1">Engele Çarptın!</h3>
                <p className="text-sm text-slate-300 mb-5">
                  Ulaşılan İlerleme: <span className="font-mono-num font-semibold text-white">%{progressPct}</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={restartPlay}
                    className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" /> Tekrar Oyna (Boşluk)
                  </button>
                  <button
                    onClick={() => setActiveView('MAIN_MENU')}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Ana Menü
                  </button>
                </div>
              </>
            ) : (
              <>
                {winner === 'P1' && (
                  <>
                    <Trophy className="w-14 h-14 text-blue-400 mb-2 animate-bounce" />
                    <h3 className="text-2xl sm:text-3xl font-bold text-blue-400 mb-1">
                      {activeView === 'ONLINE_GAME'
                        ? myOnlineSlot === 'P1'
                          ? 'TEBRİKLER, SEN KAZANDIN!'
                          : `${onlineOpponent?.name || '1. Oyuncu'} KAZANDI!`
                        : '1. OYUNCU (MAVİ) KAZANDI!'}
                    </h3>
                    <p className="text-sm text-slate-300 mb-6">
                      2. Oyuncunun 5 canı tükendi! Kat edilen rekor mesafe: <strong>{endlessDistance}m</strong>
                    </p>
                  </>
                )}
                {winner === 'P2' && (
                  <>
                    <Trophy className="w-14 h-14 text-rose-400 mb-2 animate-bounce" />
                    <h3 className="text-2xl sm:text-3xl font-bold text-rose-400 mb-1">
                      {activeView === 'ONLINE_GAME'
                        ? myOnlineSlot === 'P2'
                          ? 'TEBRİKLER, SEN KAZANDIN!'
                          : `${onlineOpponent?.name || '2. Oyuncu'} KAZANDI!`
                        : '2. OYUNCU (KIRMIZI) KAZANDI!'}
                    </h3>
                    <p className="text-sm text-slate-300 mb-6">
                      1. Oyuncunun 5 canı tükendi! Kat edilen rekor mesafe: <strong>{endlessDistance}m</strong>
                    </p>
                  </>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (activeView === 'ONLINE_GAME' && onlineWsRef.current?.readyState === WebSocket.OPEN) {
                        onlineWsRef.current.send(JSON.stringify({ type: 'GD_REMATCH' }));
                      } else {
                        restartPlay();
                      }
                    }}
                    className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" /> Yeniden Başla (Rövanş · 5 Can)
                  </button>
                  <button
                    onClick={() => {
                      if (activeView === 'ONLINE_GAME' && onlineWsRef.current) {
                        onlineWsRef.current.close();
                      }
                      setActiveView('MAIN_MENU');
                    }}
                    className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
                  >
                    Ana Menü
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ROUND SUMMARY (SOLO FINISH) */}
        {gameState === 'ROUND_SUMMARY' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
            <h3 className="text-2xl font-bold text-white mb-1">Bölüm Tamamlandı!</h3>
            <p className="text-sm text-slate-300 mb-5">{currentLevel.name} etabını başarıyla bitirdin!</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (levelIdx < levels.length - 1) setLevelIdx((i) => i + 1);
                  startPlay();
                }}
                className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
              >
                <Play className="w-4 h-4 fill-current" /> Sonraki Bölüme Geç
              </button>
              <button
                onClick={() => setActiveView('MAIN_MENU')}
                className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer transition-colors"
              >
                Ana Menü
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 shadow-md">
        <div className="flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">1.5 Saniyelik Koruma Kalkanı</p>
            <p className="text-slate-400">
              Engellere çarptığınızda koruma kalkanı açılarak peş peşe can kaybetmenizi engeller.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">1X, 2X ve 3X Hız Modları</p>
            <p className="text-slate-400">
              Yoldaki portallardan veya üstteki hız butonlarından dilediğiniz tempoyu seçebilirsiniz.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Canlı Online & Kostümler</p>
            <p className="text-slate-400">
              Arkadaşınla oda kodu paylaşarak internet üzerinden canlı düello yapabilir, garajdaki kostümlerinle yarışabilirsin!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
