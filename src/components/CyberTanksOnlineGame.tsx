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
} from 'lucide-react';
import { sound } from '../utils/sound';

// =========================================================================
// TYPES & INTERFACES
// =========================================================================
export interface TankPlayerInfo {
  id: string;
  name: string;
  slot: 'P1' | 'P2';
  ready: boolean;
  score: number;
  lives: number;
}

export interface TankRoomData {
  code: string;
  status: 'LOBBY' | 'COUNTDOWN' | 'BATTLE' | 'ROUND_OVER' | 'MATCH_OVER';
  round: number;
  winner: 'P1' | 'P2' | null;
  roundWinner: 'P1' | 'P2' | null;
  mapSeed: number;
  players: TankPlayerInfo[];
  countdown?: number;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'WALL' | 'PILLAR' | 'BOX';
  health?: number;
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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'SHIELD' | 'SPEED' | 'TRIPLE';
  duration: number;
}

// Arena dimensions
const ARENA_W = 800;
const ARENA_H = 520;
const TANK_RADIUS = 18;

export const CyberTanksOnlineGame: React.FC<{
  onScoreUpdate: (id: string, s: number) => void;
}> = ({ onScoreUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Networking state
  const [roomCodeInput, setRoomCodeInput] = useState('TANK1');
  const [currentRoomCode, setCurrentRoomCode] = useState('TANK1');
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState<TankRoomData | null>(null);
  const [copied, setCopied] = useState(false);
  const [myPlayerId] = useState(() => 'TK_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [isBotEnabled, setIsBotEnabled] = useState(false);
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; id: number } | null>(null);

  // Local game state for rendering and animation loop
  const gameStateRef = useRef({
    status: 'LOBBY' as TankRoomData['status'],
    round: 1,
    countdownVal: 0,
    p1: {
      x: 120,
      y: 260,
      bodyAngle: 0,
      turretAngle: 0,
      vx: 0,
      vy: 0,
      speed: 3.2,
      lives: 3,
      hasShield: false,
      powerup: null as 'SPEED' | 'TRIPLE' | null,
      powerupTimer: 0,
      score: 0,
      recoil: 0,
    },
    p2: {
      x: 680,
      y: 260,
      bodyAngle: Math.PI,
      turretAngle: Math.PI,
      vx: 0,
      vy: 0,
      speed: 3.2,
      lives: 3,
      hasShield: false,
      powerup: null as 'SPEED' | 'TRIPLE' | null,
      powerupTimer: 0,
      score: 0,
      recoil: 0,
    },
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      up: false,
      left: false,
      down: false,
      right: false,
      space: false,
    },
    mousePos: { x: 400, y: 260 },
    obstacles: [] as Obstacle[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    powerups: [] as PowerUp[],
    powerupSpawnTimer: 300,
    lastFireTime: 0,
    fireCooldown: 280, // ms
    botLastFire: 0,
    botMoveTimer: 0,
    botTargetAngle: 0,
    botTargetX: 680,
    botTargetY: 260,
  });

  const wsRef = useRef<WebSocket | null>(null);

  // Current player slot: 'P1' (Blue/Cyan) or 'P2' (Red/Orange)
  const mySlot = roomData?.players.find((p) => p.id === myPlayerId)?.slot || 'P1';

  // Build arena map barriers
  const generateMap = useCallback((seed: number = 42) => {
    const obs: Obstacle[] = [
      // Outer border walls
      { x: 0, y: 0, w: ARENA_W, h: 12, type: 'WALL' },
      { x: 0, y: ARENA_H - 12, w: ARENA_W, h: 12, type: 'WALL' },
      { x: 0, y: 0, w: 12, h: ARENA_H, type: 'WALL' },
      { x: ARENA_W - 12, y: 0, w: 12, h: ARENA_H, type: 'WALL' },

      // Central tactical barriers
      { x: 385, y: 70, w: 30, h: 110, type: 'PILLAR' },
      { x: 385, y: ARENA_H - 180, w: 30, h: 110, type: 'PILLAR' },
      { x: 370, y: 245, w: 60, h: 30, type: 'PILLAR' },

      // Left Base Cover
      { x: 220, y: 150, w: 25, h: 90, type: 'WALL' },
      { x: 220, y: 280, w: 25, h: 90, type: 'WALL' },

      // Right Base Cover
      { x: 555, y: 150, w: 25, h: 90, type: 'WALL' },
      { x: 555, y: 280, w: 25, h: 90, type: 'WALL' },

      // Corner tactical boxes
      { x: 140, y: 60, w: 40, h: 40, type: 'BOX', health: 3 },
      { x: 140, y: ARENA_H - 100, w: 40, h: 40, type: 'BOX', health: 3 },
      { x: 620, y: 60, w: 40, h: 40, type: 'BOX', health: 3 },
      { x: 620, y: ARENA_H - 100, w: 40, h: 40, type: 'BOX', health: 3 },
    ];
    return obs;
  }, []);

  // Connect to WebSocket room
  const connectWs = useCallback(
    (code: string) => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'TANK_JOIN_ROOM',
            code,
            playerId: myPlayerId,
            name: 'Tankçı ' + myPlayerId.slice(3, 7),
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'TANK_ROOM_UPDATE') {
            setRoomData(msg);
            const st = gameStateRef.current;
            st.status = msg.status;
            st.round = msg.round;

            if (msg.countdown !== undefined) {
              st.countdownVal = msg.countdown;
              sound.playOrb();
            }

            if (msg.winner) {
              sound.playVictory();
              const myP = msg.players.find((p: TankPlayerInfo) => p.id === myPlayerId);
              if (myP) {
                onScoreUpdate('cyber-tanks', myP.score * 100);
              }
            }

            // Sync scores
            const p1Data = msg.players.find((p: TankPlayerInfo) => p.slot === 'P1');
            const p2Data = msg.players.find((p: TankPlayerInfo) => p.slot === 'P2');
            if (p1Data) st.p1.score = p1Data.score;
            if (p2Data) st.p2.score = p2Data.score;
          } else if (msg.type === 'TANK_OPPONENT_POS') {
            // Update opponent position
            const opp = mySlot === 'P1' ? gameStateRef.current.p2 : gameStateRef.current.p1;
            opp.x = msg.x;
            opp.y = msg.y;
            opp.bodyAngle = msg.bodyAngle;
            opp.turretAngle = msg.turretAngle;
            opp.speed = msg.speed;
            opp.lives = msg.lives;
            opp.hasShield = msg.hasShield;
            opp.powerup = msg.powerup;
          } else if (msg.type === 'TANK_OPPONENT_BULLET') {
            // Receive bullet from opponent
            const oppSlot = mySlot === 'P1' ? 'P2' : 'P1';
            gameStateRef.current.bullets.push({
              id: msg.id,
              x: msg.x,
              y: msg.y,
              vx: msg.vx,
              vy: msg.vy,
              bounces: msg.bounces,
              owner: oppSlot,
              color: oppSlot === 'P1' ? '#38BDF8' : '#F97316',
            });
            sound.playLaser();
          } else if (msg.type === 'TANK_EMOJI_RELAY') {
            setFloatingEmoji({ emoji: msg.emoji, id: Date.now() });
            setTimeout(() => setFloatingEmoji(null), 2000);
            sound.playPop();
          }
        } catch {}
      };

      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);
    },
    [myPlayerId, mySlot, onScoreUpdate]
  );

  useEffect(() => {
    connectWs(currentRoomCode);
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs, currentRoomCode]);

  // Reset arena state for new round
  const resetRoundArena = useCallback(() => {
    const st = gameStateRef.current;
    st.p1.x = 120;
    st.p1.y = 260;
    st.p1.bodyAngle = 0;
    st.p1.turretAngle = 0;
    st.p1.lives = 3;
    st.p1.hasShield = false;
    st.p1.powerup = null;

    st.p2.x = 680;
    st.p2.y = 260;
    st.p2.bodyAngle = Math.PI;
    st.p2.turretAngle = Math.PI;
    st.p2.lives = 3;
    st.p2.hasShield = false;
    st.p2.powerup = null;

    st.bullets = [];
    st.powerups = [];
    st.obstacles = generateMap(st.round);
  }, [generateMap]);

  // Send ready toggle
  const toggleReady = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'TANK_TOGGLE_READY' }));
      sound.playPop();
    }
  };

  // Send reaction emoji
  const sendEmoji = (emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'TANK_EMOJI', emoji }));
      setFloatingEmoji({ emoji, id: Date.now() });
      setTimeout(() => setFloatingEmoji(null), 2000);
      sound.playPop();
    }
  };

  // Keyboard and Mouse Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const keys = gameStateRef.current.keys;
      if (k === 'w') keys.w = true;
      if (k === 'a') keys.a = true;
      if (k === 's') keys.s = true;
      if (k === 'd') keys.d = true;
      if (e.key === 'ArrowUp') keys.up = true;
      if (e.key === 'ArrowLeft') keys.left = true;
      if (e.key === 'ArrowDown') keys.down = true;
      if (e.key === 'ArrowRight') keys.right = true;
      if (e.key === ' ' || k === 'space') {
        keys.space = true;
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const keys = gameStateRef.current.keys;
      if (k === 'w') keys.w = false;
      if (k === 'a') keys.a = false;
      if (k === 's') keys.s = false;
      if (k === 'd') keys.d = false;
      if (e.key === 'ArrowUp') keys.up = false;
      if (e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'ArrowDown') keys.down = false;
      if (e.key === 'ArrowRight') keys.right = false;
      if (e.key === ' ' || k === 'space') keys.space = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = ARENA_W / rect.width;
      const scaleY = ARENA_H / rect.height;
      gameStateRef.current.mousePos.x = (e.clientX - rect.left) * scaleX;
      gameStateRef.current.mousePos.y = (e.clientY - rect.top) * scaleY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        firePlayerBullet();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const cvs = canvasRef.current;
    if (cvs) {
      cvs.addEventListener('mousemove', handleMouseMove);
      cvs.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (cvs) {
        cvs.removeEventListener('mousemove', handleMouseMove);
        cvs.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, []);

  // Fire bullet for current player
  const firePlayerBullet = () => {
    const st = gameStateRef.current;
    if (st.status !== 'BATTLE') return;

    const now = Date.now();
    if (now - st.lastFireTime < st.fireCooldown) return;
    st.lastFireTime = now;

    const me = mySlot === 'P1' ? st.p1 : st.p2;
    me.recoil = 6;

    const speed = 7.5;
    const angles = me.powerup === 'TRIPLE' ? [me.turretAngle - 0.22, me.turretAngle, me.turretAngle + 0.22] : [me.turretAngle];

    angles.forEach((ang) => {
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed;
      const spawnX = me.x + Math.cos(ang) * (TANK_RADIUS + 8);
      const spawnY = me.y + Math.sin(ang) * (TANK_RADIUS + 8);
      const bId = mySlot + '_' + Math.random().toString(36).substring(2, 7);

      st.bullets.push({
        id: bId,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        bounces: 0,
        owner: mySlot,
        color: mySlot === 'P1' ? '#38BDF8' : '#F97316',
      });

      // Relay bullet to server
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'TANK_FIRE_BULLET',
            id: bId,
            x: spawnX,
            y: spawnY,
            vx,
            vy,
            bounces: 0,
            isSpecial: me.powerup === 'TRIPLE',
          })
        );
      }
    });

    sound.playLaser();
  };

  // Main 60 FPS Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    gameStateRef.current.obstacles = generateMap();

    let animId: number;
    let syncTimer = 0;
    let countdownTimer = 0;

    const updateGame = () => {
      const st = gameStateRef.current;

      // Handle countdown timer transition to BATTLE
      if (st.status === 'COUNTDOWN') {
        countdownTimer++;
        if (countdownTimer % 60 === 0) {
          if (st.countdownVal > 1) {
            st.countdownVal--;
            sound.playOrb();
          } else {
            st.status = 'BATTLE';
            resetRoundArena();
            sound.playSpeedPortal(2);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'TANK_START_BATTLE' }));
            }
          }
        }
      }

      // If BATTLE status, run physics
      if (st.status === 'BATTLE') {
        const me = mySlot === 'P1' ? st.p1 : st.p2;
        const keys = st.keys;

        // Calculate input velocity
        let moveX = 0;
        let moveY = 0;
        if (keys.w || keys.up) moveY -= 1;
        if (keys.s || keys.down) moveY += 1;
        if (keys.a || keys.left) moveX -= 1;
        if (keys.d || keys.right) moveX += 1;

        if (keys.space) {
          firePlayerBullet();
        }

        // Normalize movement
        const curSpeed = me.powerup === 'SPEED' ? 5.2 : 3.4;
        if (moveX !== 0 || moveY !== 0) {
          const len = Math.hypot(moveX, moveY);
          const nx = (moveX / len) * curSpeed;
          const ny = (moveY / len) * curSpeed;

          // Attempt movement with obstacle collision
          const nextX = me.x + nx;
          const nextY = me.y + ny;

          let collideX = false;
          let collideY = false;

          for (const obs of st.obstacles) {
            // Check bounding box + circle collision
            if (
              nextX + TANK_RADIUS > obs.x &&
              nextX - TANK_RADIUS < obs.x + obs.w &&
              me.y + TANK_RADIUS > obs.y &&
              me.y - TANK_RADIUS < obs.y + obs.h
            ) {
              collideX = true;
            }
            if (
              me.x + TANK_RADIUS > obs.x &&
              me.x - TANK_RADIUS < obs.x + obs.w &&
              nextY + TANK_RADIUS > obs.y &&
              nextY - TANK_RADIUS < obs.y + obs.h
            ) {
              collideY = true;
            }
          }

          if (!collideX) me.x = nextX;
          if (!collideY) me.y = nextY;

          // Update body angle smoothly
          const targetBodyAngle = Math.atan2(ny, nx);
          let diff = targetBodyAngle - me.bodyAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          me.bodyAngle += diff * 0.15;
        }

        // Aim Turret at mouse
        const aimDx = st.mousePos.x - me.x;
        const aimDy = st.mousePos.y - me.y;
        me.turretAngle = Math.atan2(aimDy, aimDx);

        if (me.recoil > 0) me.recoil *= 0.85;

        // Powerup timers
        if (me.powerupTimer > 0) {
          me.powerupTimer--;
          if (me.powerupTimer <= 0) me.powerup = null;
        }

        // AI Bot logic if active
        if (isBotEnabled) {
          const bot = mySlot === 'P1' ? st.p2 : st.p1;
          const playerTarget = me;

          st.botMoveTimer++;
          if (st.botMoveTimer % 45 === 0) {
            // Pick a strategic patrol position near player
            const randAng = Math.random() * Math.PI * 2;
            const randDist = 180 + Math.random() * 120;
            st.botTargetX = Math.max(80, Math.min(ARENA_W - 80, playerTarget.x + Math.cos(randAng) * randDist));
            st.botTargetY = Math.max(80, Math.min(ARENA_H - 80, playerTarget.y + Math.sin(randAng) * randDist));
          }

          const botDx = st.botTargetX - bot.x;
          const botDy = st.botTargetY - bot.y;
          const botDist = Math.hypot(botDx, botDy);
          if (botDist > 20) {
            const bvx = (botDx / botDist) * 2.8;
            const bvy = (botDy / botDist) * 2.8;
            bot.x += bvx;
            bot.y += bvy;
            bot.bodyAngle = Math.atan2(bvy, bvx);
          }

          // Bot aim & fire
          const targetDx = playerTarget.x - bot.x;
          const targetDy = playerTarget.y - bot.y;
          bot.turretAngle = Math.atan2(targetDy, targetDx);

          const nowTime = Date.now();
          if (nowTime - st.botLastFire > 1100 && Math.random() < 0.25) {
            st.botLastFire = nowTime;
            const bvx = Math.cos(bot.turretAngle) * 7.5;
            const bvy = Math.sin(bot.turretAngle) * 7.5;
            st.bullets.push({
              id: 'BOT_' + Math.random().toString(36).substring(2, 6),
              x: bot.x + Math.cos(bot.turretAngle) * (TANK_RADIUS + 8),
              y: bot.y + Math.sin(bot.turretAngle) * (TANK_RADIUS + 8),
              vx: bvx,
              vy: bvy,
              bounces: 0,
              owner: mySlot === 'P1' ? 'P2' : 'P1',
              color: mySlot === 'P1' ? '#F97316' : '#38BDF8',
            });
            sound.playLaser();
          }
        }

        // Bullets physics & bouncing
        for (let i = st.bullets.length - 1; i >= 0; i--) {
          const b = st.bullets[i];
          b.x += b.vx;
          b.y += b.vy;

          // Check collision with obstacles
          let bounced = false;
          for (const obs of st.obstacles) {
            if (b.x >= obs.x && b.x <= obs.x + obs.w && b.y >= obs.y && b.y <= obs.y + obs.h) {
              // Determine bounce surface (horizontal or vertical)
              const overlapLeft = Math.abs(b.x - obs.x);
              const overlapRight = Math.abs(b.x - (obs.x + obs.w));
              const overlapTop = Math.abs(b.y - obs.y);
              const overlapBottom = Math.abs(b.y - (obs.y + obs.h));

              const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
              if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                b.vx = -b.vx;
              } else {
                b.vy = -b.vy;
              }

              b.bounces++;
              bounced = true;

              // Spark particles
              for (let p = 0; p < 4; p++) {
                st.particles.push({
                  x: b.x,
                  y: b.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  color: b.color,
                  size: 2.5,
                  alpha: 1,
                  life: 15,
                });
              }
              sound.playBounce();
              break;
            }
          }

          // If reached max bounces (2 bounces max)
          if (b.bounces > 2) {
            st.bullets.splice(i, 1);
            continue;
          }

          // Bullet hits Tank Check (Only your own tank hit detection to avoid duplicate damage)
          const targetTank = me;
          const hitDist = Math.hypot(b.x - targetTank.x, b.y - targetTank.y);

          // Can only get hit if bullet is opponent's OR has bounced at least once (ricochet self-damage)
          const canHit = b.owner !== mySlot || b.bounces > 0;
          if (canHit && hitDist < TANK_RADIUS + 3) {
            st.bullets.splice(i, 1);

            if (targetTank.hasShield) {
              targetTank.hasShield = false;
              sound.playShield();
              // Shield sparks
              for (let p = 0; p < 12; p++) {
                st.particles.push({
                  x: targetTank.x,
                  y: targetTank.y,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  color: '#60A5FA',
                  size: 3,
                  alpha: 1,
                  life: 20,
                });
              }
            } else {
              targetTank.lives--;
              sound.playExplosion();

              // Explosion particles
              for (let p = 0; p < 25; p++) {
                st.particles.push({
                  x: targetTank.x,
                  y: targetTank.y,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  color: '#F43F5E',
                  size: 4,
                  alpha: 1,
                  life: 25,
                });
              }

              // Send hit report to server
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'TANK_HIT',
                    lives: targetTank.lives,
                  })
                );
              }
            }
            continue;
          }
        }

        // Powerups spawn and pickup
        st.powerupSpawnTimer--;
        if (st.powerupSpawnTimer <= 0) {
          st.powerupSpawnTimer = 450 + Math.floor(Math.random() * 300);
          if (st.powerups.length < 2) {
            const types: Array<'SHIELD' | 'SPEED' | 'TRIPLE'> = ['SHIELD', 'SPEED', 'TRIPLE'];
            const randType = types[Math.floor(Math.random() * types.length)];
            st.powerups.push({
              x: 180 + Math.random() * (ARENA_W - 360),
              y: 120 + Math.random() * (ARENA_H - 240),
              type: randType,
              duration: 400,
            });
          }
        }

        // Pickup check for local player
        for (let pIdx = st.powerups.length - 1; pIdx >= 0; pIdx--) {
          const pup = st.powerups[pIdx];
          const dist = Math.hypot(me.x - pup.x, me.y - pup.y);
          if (dist < TANK_RADIUS + 15) {
            if (pup.type === 'SHIELD') me.hasShield = true;
            if (pup.type === 'SPEED') {
              me.powerup = 'SPEED';
              me.powerupTimer = 350;
            }
            if (pup.type === 'TRIPLE') {
              me.powerup = 'TRIPLE';
              me.powerupTimer = 350;
            }
            st.powerups.splice(pIdx, 1);
            sound.playScore();
          }
        }

        // Sync local position to server at ~30Hz
        syncTimer++;
        if (syncTimer % 2 === 0) {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'TANK_SYNC_POS',
                x: me.x,
                y: me.y,
                bodyAngle: me.bodyAngle,
                turretAngle: me.turretAngle,
                speed: curSpeed,
                lives: me.lives,
                hasShield: me.hasShield,
                powerup: me.powerup,
              })
            );
          }
        }
      }

      // Update particle lifetimes
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const pt = st.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
        pt.alpha = pt.life / 25;
        if (pt.life <= 0) st.particles.splice(i, 1);
      }

      // =====================================================================
      // RENDERING CANVAS
      // =====================================================================
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Cyber Grid Background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < ARENA_W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ARENA_H);
        ctx.stroke();
      }
      for (let y = 0; y < ARENA_H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_W, y);
        ctx.stroke();
      }

      // Draw Arena Obstacles & Walls
      for (const obs of st.obstacles) {
        if (obs.type === 'WALL' || obs.type === 'PILLAR') {
          ctx.fillStyle = '#111827';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

          // Inner high-tech accent
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.fillRect(obs.x + 3, obs.y + 3, Math.max(0, obs.w - 6), Math.max(0, obs.h - 6));
        } else if (obs.type === 'BOX') {
          ctx.fillStyle = '#1E1B4B';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#818CF8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          ctx.fillStyle = '#818CF8';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('CRATE', obs.x + obs.w / 2, obs.y + obs.h / 2);
        }
      }

      // Draw Powerups
      for (const pup of st.powerups) {
        ctx.save();
        ctx.translate(pup.x, pup.y);
        ctx.fillStyle = pup.type === 'SHIELD' ? '#3B82F6' : pup.type === 'SPEED' ? '#EAB308' : '#EC4899';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pup.type === 'SHIELD' ? '🛡️' : pup.type === 'SPEED' ? '⚡' : '💥', 0, 1);
        ctx.restore();
      }

      // Draw Particles
      for (const pt of st.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Bullets
      for (const b of st.bullets) {
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Laser tail
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
        ctx.stroke();
        ctx.restore();
      }

      // Helper to Draw a Neon Tank
      const drawTank = (
        t: typeof st.p1,
        slot: 'P1' | 'P2',
        color: string,
        glowColor: string,
        label: string
      ) => {
        if (t.lives <= 0) return; // Destroyed

        ctx.save();
        ctx.translate(t.x, t.y);

        // Energy Shield Ring
        if (t.hasShield) {
          ctx.strokeStyle = '#60A5FA';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#60A5FA';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, TANK_RADIUS + 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Treads & Body (Rotates with bodyAngle)
        ctx.save();
        ctx.rotate(t.bodyAngle);

        // Tread Left & Right
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.fillRect(-TANK_RADIUS - 2, -TANK_RADIUS + 2, (TANK_RADIUS + 2) * 2, 6);
        ctx.strokeRect(-TANK_RADIUS - 2, -TANK_RADIUS + 2, (TANK_RADIUS + 2) * 2, 6);
        ctx.fillRect(-TANK_RADIUS - 2, TANK_RADIUS - 8, (TANK_RADIUS + 2) * 2, 6);
        ctx.strokeRect(-TANK_RADIUS - 2, TANK_RADIUS - 8, (TANK_RADIUS + 2) * 2, 6);

        // Tank Chassis
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-TANK_RADIUS + 4, -TANK_RADIUS + 7, (TANK_RADIUS - 4) * 2, (TANK_RADIUS - 7) * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-TANK_RADIUS + 4, -TANK_RADIUS + 7, (TANK_RADIUS - 4) * 2, (TANK_RADIUS - 7) * 2);
        ctx.restore();

        // Turret (Rotates with turretAngle)
        ctx.save();
        ctx.rotate(t.turretAngle);

        // Cannon barrel (with recoil kick)
        const barrelLen = 22 - t.recoil;
        ctx.fillStyle = color;
        ctx.fillRect(0, -3.5, barrelLen, 7);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, -3.5, barrelLen, 7);

        // Turret Dome
        ctx.fillStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Overhead Player Name & Hearts
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, -TANK_RADIUS - 12);

        // Hearts / Lives
        const hearts = '❤️'.repeat(Math.max(0, t.lives));
        ctx.font = '10px sans-serif';
        ctx.fillText(hearts, 0, -TANK_RADIUS - 2);

        ctx.restore();
      };

      // Draw P1 (Cyan) and P2 (Orange) Tanks
      drawTank(st.p1, 'P1', '#38BDF8', 'rgba(56, 189, 248, 0.8)', mySlot === 'P1' ? 'SEN (Mavi)' : 'Rakip (Mavi)');
      drawTank(st.p2, 'P2', '#F97316', 'rgba(249, 115, 22, 0.8)', mySlot === 'P2' ? 'SEN (Turuncu)' : 'Rakip (Turuncu)');

      // Draw Status Overlays (LOBBY, COUNTDOWN, ROUND_OVER, MATCH_OVER)
      if (st.status === 'LOBBY') {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.75)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OYUNCULAR BEKLENİYOR', ARENA_W / 2, ARENA_H / 2 - 20);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Başlamak için iki oyuncunun da "HAZIR" butonuna basması gerekir.', ARENA_W / 2, ARENA_H / 2 + 15);
      } else if (st.status === 'COUNTDOWN') {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.6)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(st.countdownVal || 3), ARENA_W / 2, ARENA_H / 2 + 25);
      } else if (st.status === 'ROUND_OVER') {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.8)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RAUNT BİTTİ!`, ARENA_W / 2, ARENA_H / 2 - 20);
        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px sans-serif';
        ctx.fillText(`Skor: Mavi ${st.p1.score} - ${st.p2.score} Turuncu`, ARENA_W / 2, ARENA_H / 2 + 15);
      } else if (st.status === 'MATCH_OVER') {
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        const winSlot = roomData?.winner;
        ctx.fillText(`${winSlot === 'P1' ? 'MAVİ' : 'TURUNCU'} TANK ŞAMPİYON OLDU!`, ARENA_W / 2, ARENA_H / 2 - 20);
        ctx.fillStyle = '#38BDF8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Yeniden oynamak için "Rövanş" butonuna tıklayın.', ARENA_W / 2, ARENA_H / 2 + 20);
      }

      animId = requestAnimationFrame(updateGame);
    };

    animId = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(animId);
  }, [firePlayerBullet, isBotEnabled, mySlot, resetRoundArena, roomData?.winner]);

  // Handle Rematch
  const handleRematch = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'TANK_REMATCH' }));
      sound.playJump();
    }
  };

  // Next round
  const handleNextRound = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'TANK_NEXT_ROUND' }));
      sound.playJump();
    }
  };

  // Quick Match generator
  const handleQuickMatch = () => {
    const randomCode = 'TANK' + Math.floor(1 + Math.random() * 99);
    setRoomCodeInput(randomCode);
    setCurrentRoomCode(randomCode);
  };

  const myPlayerInfo = roomData?.players.find((p) => p.id === myPlayerId);
  const isMyReady = !!myPlayerInfo?.ready;

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Top Matchmaking & Room Management Bar */}
      <div className="bg-[#131B2E] border border-white/10 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {isConnected ? (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Wifi className="w-3.5 h-3.5" /> Canlı Sunucu Bağlı
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 font-semibold">
                <WifiOff className="w-3.5 h-3.5" /> Bağlantı Kesildi
              </span>
            )}
          </div>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Oda Kodu:</span>
            <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-2.5 py-1 rounded font-mono font-bold text-sky-400">
              {roomData?.code || currentRoomCode}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomData?.code || currentRoomCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Kodu Kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Room Join & Quick Match */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickMatch}
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-sm transition-colors"
          >
            Hızlı Eşleşme
          </button>
          <input
            type="text"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            placeholder="ODA KODU"
            maxLength={8}
            className="w-24 px-2 py-1 bg-slate-900 border border-white/10 rounded text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={() => {
              if (roomCodeInput.trim()) setCurrentRoomCode(roomCodeInput.trim());
            }}
            className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer shadow-sm transition-colors"
          >
            Katıl
          </button>
          <button
            onClick={() => setIsBotEnabled(!isBotEnabled)}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
              isBotEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
            }`}
            title="Yapay Zeka Botunu Aktif/Pasif Yap"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{isBotEnabled ? 'Bot Devrede' : 'Yapay Zeka Rakip'}</span>
          </button>
        </div>
      </div>

      {/* Players Header & Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 items-center">
        {/* Blue Tank (P1) */}
        <div
          className={`p-2.5 rounded-lg border flex items-center justify-between ${
            mySlot === 'P1' ? 'bg-sky-950/40 border-sky-500/50 ring-1 ring-sky-500/30' : 'bg-slate-900/50 border-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38BDF8]" />
            <div>
              <p className="text-xs font-bold text-white">Mavi Tank {mySlot === 'P1' && '(SEN)'}</p>
              <p className="text-[11px] text-slate-400">
                Raunt Galibiyeti: <span className="font-mono font-bold text-sky-400">{roomData?.players.find((p) => p.slot === 'P1')?.score || 0}</span>
              </p>
            </div>
          </div>
          <Crosshair className="w-4 h-4 text-sky-400" />
        </div>

        {/* Center Match Status & Ready Controls */}
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleReady}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md ${
                isMyReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
              }`}
            >
              {isMyReady ? '✓ HAZIR (İptal Et)' : '⚡ HAZIR OL!'}
            </button>

            {roomData?.status === 'ROUND_OVER' && (
              <button
                onClick={handleNextRound}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer shadow-md"
              >
                Sonraki Raunt
              </button>
            )}

            {roomData?.status === 'MATCH_OVER' && (
              <button
                onClick={handleRematch}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow-md"
              >
                Rövanş Maçı
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            3 Raunt Kazanan Şampiyon Olur · Her Rauntta 3 Can
          </div>
        </div>

        {/* Orange Tank (P2) */}
        <div
          className={`p-2.5 rounded-lg border flex items-center justify-between ${
            mySlot === 'P2' ? 'bg-orange-950/40 border-orange-500/50 ring-1 ring-orange-500/30' : 'bg-slate-900/50 border-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-orange-400 shadow-[0_0_8px_#F97316]" />
            <div>
              <p className="text-xs font-bold text-white">Turuncu Tank {mySlot === 'P2' && '(SEN)'}</p>
              <p className="text-[11px] text-slate-400">
                Raunt Galibiyeti: <span className="font-mono font-bold text-orange-400">{roomData?.players.find((p) => p.slot === 'P2')?.score || 0}</span>
              </p>
            </div>
          </div>
          <Swords className="w-4 h-4 text-orange-400" />
        </div>
      </div>

      {/* Main Canvas Tank Battlefield */}
      <div className="relative bg-[#090D16] border border-white/10 rounded-xl p-2 sm:p-4 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
        {/* Floating Reaction Emoji */}
        {floatingEmoji && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 text-4xl animate-bounce z-20 pointer-events-none drop-shadow-lg">
            {floatingEmoji.emoji}
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          className="w-full max-w-[800px] aspect-[800/520] rounded-lg border border-white/10 shadow-inner bg-slate-950 cursor-crosshair"
        />

        {/* Live Reaction Emojis Floating Bar */}
        <div className="mt-3 flex items-center gap-2 bg-[#111827]/90 border border-white/10 px-3 py-1.5 rounded-full shadow-lg">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Reaksiyon:</span>
          {['🔥', '💥', '🛡️', '😎', '🎯', '⚡', '👏'].map((em) => (
            <button
              key={em}
              onClick={() => sendEmoji(em)}
              className="text-base hover:scale-125 transition-transform cursor-pointer px-1"
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* Control Guide & Game Rules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 bg-[#131B2E] border border-white/10 rounded-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <Crosshair className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Hareket & Nişan Kontrolü</p>
            <p className="text-slate-400">
              <span className="font-mono text-white">W / A / S / D</span> veya Ok tuşları ile tankı sürün. Fare ile namluyu çevirin ve Sol Tık / Boşluk ile ateş edin.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Seken Lazer Fizikleri</p>
            <p className="text-slate-400">
              Lazerler duvarlardan 2 kez seker! Köşe arkasındaki rakipleri seken atışlarla şaşırtarak vurun.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Arenadaki Güçlendiriciler</p>
            <p className="text-slate-400">
              <span className="text-blue-300 font-medium">🛡️ Kalkan</span> 1 vuruşu emer, <span className="text-amber-300 font-medium">⚡ Hız</span> tankı hızlandırır, <span className="text-pink-300 font-medium">💥 Üçlü</span> lazer saçar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
