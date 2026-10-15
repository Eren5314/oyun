import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ==========================================
// USER ACCOUNTS & AUTH PERSISTENCE
// ==========================================
interface UserAccount {
  username: string;
  password: string;
  avatar: string;
  createdAt: string;
  records: {
    'geometry-dash': number;
    'hexa-conquest': number;
    'cyber-tanks': number;
  };
}

const USERS_FILE = path.resolve(__dirname, 'users_db.json');
let usersDb: Record<string, UserAccount> = {};

try {
  if (fs.existsSync(USERS_FILE)) {
    usersDb = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  }
} catch {
  usersDb = {};
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save users_db.json', err);
  }
}

// User Registration endpoint
app.post('/api/auth/register', (req, res) => {
  const { username, password, avatar, overwrite } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
  }
  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Parola en az 4 karakter olmalıdır.' });
  }

  const cleanUsername = username.trim();
  const lowerKey = cleanUsername.toLowerCase();
  const existing = usersDb[lowerKey];

  if (existing) {
    // If the password matches, simply log them in!
    if (existing.password === password) {
      if (avatar) existing.avatar = avatar;
      saveUsers();
      return res.json({
        success: true,
        isExistingLogin: true,
        user: {
          username: existing.username,
          avatar: existing.avatar,
          records: existing.records,
        },
      });
    }

    // If overwrite is requested (reset / takeover)
    if (overwrite === true) {
      existing.password = password;
      if (avatar) existing.avatar = avatar;
      saveUsers();
      return res.json({
        success: true,
        overwritten: true,
        user: {
          username: existing.username,
          avatar: existing.avatar,
          records: existing.records,
        },
      });
    }

    return res.status(409).json({
      error: 'Bu kullanıcı adı zaten kayıtlı!',
      exists: true,
      username: existing.username,
    });
  }

  const newUser: UserAccount = {
    username: cleanUsername,
    password,
    avatar: avatar || '🎮',
    createdAt: new Date().toISOString(),
    records: {
      'geometry-dash': 0,
      'hexa-conquest': 0,
      'cyber-tanks': 0,
    },
  };

  usersDb[lowerKey] = newUser;
  saveUsers();

  return res.json({
    success: true,
    user: {
      username: newUser.username,
      avatar: newUser.avatar,
      records: newUser.records,
    },
  });
});

// User Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve parola zorunludur.' });
  }

  const cleanUsername = String(username).trim();
  const lowerKey = cleanUsername.toLowerCase();
  const existing = usersDb[lowerKey];

  if (!existing) {
    return res.status(404).json({
      error: 'Bu kullanıcı adına ait bir hesap bulunamadı.',
      notFound: true,
      suggestedUsername: cleanUsername,
    });
  }

  if (existing.password !== password) {
    return res.status(401).json({
      error: 'Girilen parola hatalı!',
      wrongPassword: true,
    });
  }

  return res.json({
    success: true,
    user: {
      username: existing.username,
      avatar: existing.avatar,
      records: existing.records,
    },
  });
});

// Reset Password endpoint
app.post('/api/auth/reset', (req, res) => {
  const { username, newPassword } = req.body || {};
  if (!username || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Geçersiz parametreler' });
  }

  const lowerKey = String(username).trim().toLowerCase();
  const existing = usersDb[lowerKey];
  if (!existing) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  existing.password = newPassword;
  saveUsers();

  return res.json({
    success: true,
    user: {
      username: existing.username,
      avatar: existing.avatar,
      records: existing.records,
    },
  });
});

// Update score
app.post('/api/auth/update-score', (req, res) => {
  const { username, gameId, score } = req.body || {};
  if (!username || !gameId) return res.status(400).json({ error: 'Eksik parametre' });

  const lowerKey = String(username).trim().toLowerCase();
  const user = usersDb[lowerKey];
  if (user) {
    const cur = user.records[gameId as keyof typeof user.records] || 0;
    user.records[gameId as keyof typeof user.records] = Math.max(cur, Number(score) || 0);
    saveUsers();
    return res.json({ success: true, records: user.records });
  }
  return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
});

// ==========================================
// HTTP SERVER & WEBSOCKET SETUP
// ==========================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Keep-alive heartbeat every 20 seconds
setInterval(() => {
  wss.clients.forEach((client) => {
    if ((client as any).isAlive === false) {
      return client.terminate();
    }
    (client as any).isAlive = false;
    client.ping();
  });
}, 20000);

// ==========================================
// GAME 1: GEOMETRY DASH DUEL PROTOCOL
// ==========================================
interface GDPerson {
  ws: WebSocket;
  id: string;
  name: string;
  slot: 'P1' | 'P2';
  cosmetics: any;
  ready: boolean;
  lives: number;
}

interface GDRoom {
  code: string;
  players: GDPerson[];
  status: 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  winner: 'P1' | 'P2' | null;
  seed: number;
  countdownTimer?: NodeJS.Timeout;
}

const gdRooms = new Map<string, GDRoom>();

function broadcastGDRoom(room: GDRoom, extraData?: any) {
  const payload = JSON.stringify({
    type: 'GD_ROOM_UPDATE',
    code: room.code,
    status: room.status,
    winner: room.winner,
    seed: room.seed,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      cosmetics: p.cosmetics,
      ready: p.ready,
      lives: p.lives,
    })),
    ...extraData,
  });

  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

function startGDRoomCountdown(room: GDRoom) {
  if (room.countdownTimer) clearInterval(room.countdownTimer);
  room.status = 'COUNTDOWN';
  let count = 3;
  broadcastGDRoom(room, { countdown: count, matchFound: true });

  room.countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      broadcastGDRoom(room, { countdown: count });
    } else {
      if (room.countdownTimer) clearInterval(room.countdownTimer);
      room.status = 'RACING';
      broadcastGDRoom(room, { countdown: 0 });
    }
  }, 1000);
}

// ==========================================
// GAME 2: HEXA CONQUEST STRATEGY PROTOCOL
// ==========================================
interface HexaPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  side: 'BLUE' | 'RED';
}

interface Room {
  code: string;
  players: HexaPlayer[];
  board: Array<'BLUE' | 'RED' | 'OBSTACLE' | null>; // 144 cells
  turn: 'BLUE' | 'RED';
  winner: 'BLUE' | 'RED' | 'DRAW' | null;
  blueScore: number;
  redScore: number;
}

const rooms = new Map<string, Room>();

function initBoard(): Array<'BLUE' | 'RED' | 'OBSTACLE' | null> {
  const board: Array<'BLUE' | 'RED' | 'OBSTACLE' | null> = new Array(144).fill(null);
  // Blue starting pieces (3 pieces)
  board[0] = 'BLUE';
  board[1] = 'BLUE';
  board[12] = 'BLUE';

  // Red starting pieces (3 pieces)
  board[143] = 'RED';
  board[142] = 'RED';
  board[131] = 'RED';

  // Obstacles (8 strategic obstacles)
  const obstacleIndices = [33, 38, 54, 57, 86, 89, 105, 110];
  obstacleIndices.forEach((idx) => {
    board[idx] = 'OBSTACLE';
  });

  return board;
}

function countPieces(board: Array<'BLUE' | 'RED' | null>) {
  let blue = 0;
  let red = 0;
  board.forEach((cell) => {
    if (cell === 'BLUE') blue++;
    if (cell === 'RED') red++;
  });
  return { blue, red };
}

function broadcastRoom(room: Room, extra?: any) {
  const payload = JSON.stringify({
    type: 'ROOM_UPDATE',
    code: room.code,
    players: room.players.map((p) => ({ id: p.id, name: p.name, side: p.side })),
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    blueScore: room.blueScore,
    redScore: room.redScore,
    ...extra,
  });

  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

// ==========================================
// GAME 3: CYBER TANKS PROTOCOL
// ==========================================
interface TankPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  slot: 'P1' | 'P2';
  ready: boolean;
  score: number;
  lives: number;
}

interface TankRoom {
  code: string;
  players: TankPlayer[];
  status: 'LOBBY' | 'COUNTDOWN' | 'BATTLE' | 'ROUND_OVER' | 'MATCH_OVER';
  round: number;
  winner: 'P1' | 'P2' | null;
  roundWinner: 'P1' | 'P2' | null;
  mapSeed: number;
  countdownTimer?: NodeJS.Timeout;
}

const tankRooms = new Map<string, TankRoom>();

function broadcastTankRoom(room: TankRoom, extraData?: any) {
  const payload = JSON.stringify({
    type: 'TANK_ROOM_UPDATE',
    code: room.code,
    status: room.status,
    round: room.round,
    winner: room.winner,
    roundWinner: room.roundWinner,
    mapSeed: room.mapSeed,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      slot: p.slot,
      ready: p.ready,
      score: p.score,
      lives: p.lives,
    })),
    ...extraData,
  });

  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

function startTankRoomCountdown(room: TankRoom) {
  if (room.countdownTimer) clearInterval(room.countdownTimer);
  room.status = 'COUNTDOWN';
  let cd = 3;
  broadcastTankRoom(room, { countdown: cd, matchFound: true });

  room.countdownTimer = setInterval(() => {
    cd--;
    if (cd > 0) {
      broadcastTankRoom(room, { countdown: cd });
    } else {
      if (room.countdownTimer) clearInterval(room.countdownTimer);
      room.status = 'BATTLE';
      broadcastTankRoom(room, { countdown: 0 });
    }
  }, 1000);
}

// ==========================================
// MATCHMAKING QUEUES
// ==========================================
interface QueuePlayer {
  ws: WebSocket;
  id: string;
  name: string;
  cosmetics?: any;
  timestamp: number;
}

let gdQueue: QueuePlayer[] = [];
let hexaQueue: QueuePlayer[] = [];
let tankQueue: QueuePlayer[] = [];

// ==========================================
// WEBSOCKET CONNECTION DISPATCHER
// ==========================================
wss.on('connection', (ws: WebSocket) => {
  const client = ws as any;
  client.isAlive = true;
  client.myPlayerId = '';
  client.currentGDRoom = null as GDRoom | null;
  client.currentRoom = null as Room | null;
  client.currentTankRoom = null as TankRoom | null;

  ws.on('pong', () => {
    client.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      // ==========================================
      // 1. GEOMETRY DASH ONLINE PROTOCOL
      // ==========================================
      if (data.type === 'GD_QUICK_MATCH') {
        client.myPlayerId = data.playerId || 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const playerName = data.name || 'Koşucu ' + client.myPlayerId.slice(2, 6);

        // Filter inactive sockets from queue
        gdQueue = gdQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== client.myPlayerId);

        if (gdQueue.length > 0) {
          const opponent = gdQueue.shift()!;
          const matchCode = 'DUEL_' + Math.floor(1000 + Math.random() * 9000);
          const room: GDRoom = {
            code: matchCode,
            players: [
              {
                ws: opponent.ws,
                id: opponent.id,
                name: opponent.name,
                slot: 'P1',
                cosmetics: opponent.cosmetics || {},
                ready: true,
                lives: 5,
              },
              {
                ws: ws,
                id: client.myPlayerId,
                name: playerName,
                slot: 'P2',
                cosmetics: data.cosmetics || {},
                ready: true,
                lives: 5,
              },
            ],
            status: 'COUNTDOWN',
            winner: null,
            seed: Math.floor(Math.random() * 100000),
          };

          gdRooms.set(matchCode, room);

          // Connect both sockets to the room
          (opponent.ws as any).currentGDRoom = room;
          (opponent.ws as any).myPlayerId = opponent.id;
          client.currentGDRoom = room;

          startGDRoomCountdown(room);
        } else {
          gdQueue.push({
            ws,
            id: client.myPlayerId,
            name: playerName,
            cosmetics: data.cosmetics || {},
            timestamp: Date.now(),
          });
          ws.send(JSON.stringify({ type: 'GD_QUEUE_WAITING', message: 'Çevrim içi rakip aranıyor...' }));
        }
      } else if (data.type === 'GD_LEAVE_QUEUE') {
        gdQueue = gdQueue.filter((qp) => qp.id !== client.myPlayerId);
      } else if (data.type === 'GD_JOIN_ROOM') {
        const roomCode = (data.code || 'GD1').toUpperCase().trim().slice(0, 10);
        client.myPlayerId = data.playerId || 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const playerName = data.name || 'Koşucu ' + client.myPlayerId.slice(2, 6);

        if (roomCode === 'QUICK') {
          // Route to quick match
          gdQueue = gdQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== client.myPlayerId);
          if (gdQueue.length > 0) {
            const opponent = gdQueue.shift()!;
            const matchCode = 'DUEL_' + Math.floor(1000 + Math.random() * 9000);
            const room: GDRoom = {
              code: matchCode,
              players: [
                {
                  ws: opponent.ws,
                  id: opponent.id,
                  name: opponent.name,
                  slot: 'P1',
                  cosmetics: opponent.cosmetics || {},
                  ready: true,
                  lives: 5,
                },
                {
                  ws: ws,
                  id: client.myPlayerId,
                  name: playerName,
                  slot: 'P2',
                  cosmetics: data.cosmetics || {},
                  ready: true,
                  lives: 5,
                },
              ],
              status: 'COUNTDOWN',
              winner: null,
              seed: Math.floor(Math.random() * 100000),
            };
            gdRooms.set(matchCode, room);
            (opponent.ws as any).currentGDRoom = room;
            (opponent.ws as any).myPlayerId = opponent.id;
            client.currentGDRoom = room;

            startGDRoomCountdown(room);
            return;
          } else {
            gdQueue.push({ ws, id: client.myPlayerId, name: playerName, cosmetics: data.cosmetics || {}, timestamp: Date.now() });
            ws.send(JSON.stringify({ type: 'GD_QUEUE_WAITING', message: 'Çevrim içi rakip aranıyor...' }));
            return;
          }
        }

        let room = gdRooms.get(roomCode);
        if (!room) {
          room = {
            code: roomCode,
            players: [],
            status: 'LOBBY',
            winner: null,
            seed: Math.floor(Math.random() * 100000),
          };
          gdRooms.set(roomCode, room);
        }

        client.currentGDRoom = room;

        let existing = room.players.find((p) => p.id === client.myPlayerId);
        if (!existing) {
          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'GD_ERROR', message: 'Oda dolu! (Maksimum 2 oyuncu)' }));
            return;
          }
          const slot: 'P1' | 'P2' = room.players.some((p) => p.slot === 'P1') ? 'P2' : 'P1';
          existing = {
            ws,
            id: client.myPlayerId,
            name: playerName,
            slot,
            cosmetics: data.cosmetics || {},
            ready: false,
            lives: 5,
          };
          room.players.push(existing);
        } else {
          existing.ws = ws;
          existing.name = playerName;
          existing.cosmetics = data.cosmetics || existing.cosmetics;
        }

        room.players.forEach((p) => {
          (p.ws as any).currentGDRoom = room;
          (p.ws as any).myPlayerId = p.id;
        });

        broadcastGDRoom(room);

        if (room.players.length === 2 && room.players.every((p) => p.ready)) {
          startGDRoomCountdown(room);
        }
      } else if (data.type === 'GD_TOGGLE_READY' && client.currentGDRoom) {
        const room = client.currentGDRoom;
        const player = room.players.find((p: GDPerson) => p.id === client.myPlayerId);
        if (player) {
          player.ready = !player.ready;
          broadcastGDRoom(room);
          if (room.players.length === 2 && room.players.every((p: GDPerson) => p.ready)) {
            startGDRoomCountdown(room);
          }
        }
      } else if (data.type === 'GD_START_RACE' && client.currentGDRoom) {
        client.currentGDRoom.status = 'RACING';
        broadcastGDRoom(client.currentGDRoom);
      } else if (data.type === 'GD_SYNC_POS' && client.currentGDRoom) {
        const room = client.currentGDRoom;
        const opponent = room.players.find((p: GDPerson) => p.id !== client.myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'GD_OPPONENT_POS',
              worldX: data.worldX,
              playerY: data.playerY,
              vy: data.vy,
              rotation: data.rotation,
              mode: data.mode,
              lives: data.lives,
              isInvulnerable: data.isInvulnerable,
            })
          );
        }
      } else if (data.type === 'GD_CRASH' && client.currentGDRoom) {
        const room = client.currentGDRoom;
        const player = room.players.find((p: GDPerson) => p.id === client.myPlayerId);
        if (player) {
          player.lives = Math.max(0, data.lives);
          if (player.lives <= 0 && room.status === 'RACING') {
            room.status = 'FINISHED';
            const winnerPlayer = room.players.find((p: GDPerson) => p.id !== client.myPlayerId);
            room.winner = winnerPlayer ? winnerPlayer.slot : null;
          }
          broadcastGDRoom(room);
        }
      } else if (data.type === 'GD_REMATCH' && client.currentGDRoom) {
        const room = client.currentGDRoom;
        room.winner = null;
        room.seed = Math.floor(Math.random() * 100000);
        room.players.forEach((p: GDPerson) => {
          p.lives = 5;
          p.ready = true;
        });
        startGDRoomCountdown(room);
      }

      // ==========================================
      // 2. HEXA CONQUEST STRATEGY PROTOCOL
      // ==========================================
      else if (data.type === 'HEXA_QUICK_MATCH') {
        client.myPlayerId = data.playerId || 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const playerName = data.name || 'Komutan ' + client.myPlayerId.slice(2, 6);

        hexaQueue = hexaQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== client.myPlayerId);
        if (hexaQueue.length > 0) {
          const opponent = hexaQueue.shift()!;
          const matchCode = 'HEXA_' + Math.floor(1000 + Math.random() * 9000);
          const room: Room = {
            code: matchCode,
            players: [
              { ws: opponent.ws, id: opponent.id, name: opponent.name, side: 'BLUE' },
              { ws, id: client.myPlayerId, name: playerName, side: 'RED' },
            ],
            board: initBoard(),
            turn: 'BLUE',
            winner: null,
            blueScore: 3,
            redScore: 3,
          };
          rooms.set(matchCode, room);

          (opponent.ws as any).currentRoom = room;
          (opponent.ws as any).myPlayerId = opponent.id;
          client.currentRoom = room;

          broadcastRoom(room, { matchFound: true });
        } else {
          hexaQueue.push({ ws, id: client.myPlayerId, name: playerName, timestamp: Date.now() });
          ws.send(JSON.stringify({ type: 'HEXA_QUEUE_WAITING', message: 'Strateji rakibi aranıyor...' }));
        }
      } else if (data.type === 'JOIN_ROOM') {
        const roomCode = (data.code || 'ARENA1').toUpperCase().trim().slice(0, 10);
        client.myPlayerId = data.playerId || 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const playerName = data.name || 'Komutan ' + client.myPlayerId.slice(2, 6);

        if (roomCode === 'QUICK') {
          hexaQueue = hexaQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== client.myPlayerId);
          if (hexaQueue.length > 0) {
            const opponent = hexaQueue.shift()!;
            const matchCode = 'HEXA_' + Math.floor(1000 + Math.random() * 9000);
            const room: Room = {
              code: matchCode,
              players: [
                { ws: opponent.ws, id: opponent.id, name: opponent.name, side: 'BLUE' },
                { ws, id: client.myPlayerId, name: playerName, side: 'RED' },
              ],
              board: initBoard(),
              turn: 'BLUE',
              winner: null,
              blueScore: 3,
              redScore: 3,
            };
            rooms.set(matchCode, room);

            (opponent.ws as any).currentRoom = room;
            (opponent.ws as any).myPlayerId = opponent.id;
            client.currentRoom = room;

            broadcastRoom(room, { matchFound: true });
            return;
          } else {
            hexaQueue.push({ ws, id: client.myPlayerId, name: playerName, timestamp: Date.now() });
            ws.send(JSON.stringify({ type: 'HEXA_QUEUE_WAITING', message: 'Strateji rakibi aranıyor...' }));
            return;
          }
        }

        let room = rooms.get(roomCode);
        if (!room) {
          room = {
            code: roomCode,
            players: [],
            board: initBoard(),
            turn: 'BLUE',
            winner: null,
            blueScore: 3,
            redScore: 3,
          };
          rooms.set(roomCode, room);
        }

        client.currentRoom = room;

        let existing = room.players.find((p) => p.id === client.myPlayerId);
        if (!existing) {
          const side: 'BLUE' | 'RED' = room.players.some((p) => p.side === 'BLUE') ? 'RED' : 'BLUE';
          existing = { ws, id: client.myPlayerId, name: playerName, side };
          room.players.push(existing);
        } else {
          existing.ws = ws;
          existing.name = playerName;
        }

        room.players.forEach((p) => {
          (p.ws as any).currentRoom = room;
          (p.ws as any).myPlayerId = p.id;
        });

        const counts = countPieces(room.board);
        room.blueScore = counts.blue;
        room.redScore = counts.red;

        broadcastRoom(room);
      } else if (data.type === 'MAKE_MOVE' && client.currentRoom) {
        const room = client.currentRoom;
        const { fromIdx, toIdx, playerId } = data;
        const player = room.players.find((p: HexaPlayer) => p.id === playerId);
        if (!player || player.side !== room.turn || room.winner) return;

        if (toIdx < 0 || toIdx >= 144 || fromIdx < 0 || fromIdx >= 144) return;
        if (room.board[fromIdx] !== player.side) return;
        if (room.board[toIdx] !== null) return;

        const fromR = Math.floor(fromIdx / 12);
        const fromC = fromIdx % 12;
        const toR = Math.floor(toIdx / 12);
        const toC = toIdx % 12;
        const dist = Math.max(Math.abs(fromR - toR), Math.abs(fromC - toC));

        if (dist === 1) {
          room.board[toIdx] = player.side;
        } else if (dist === 2) {
          room.board[fromIdx] = null;
          room.board[toIdx] = player.side;
        } else {
          return;
        }

        const enemySide: 'BLUE' | 'RED' = player.side === 'BLUE' ? 'RED' : 'BLUE';
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = toR + dr;
            const nc = toC + dc;
            if (nr >= 0 && nr < 12 && nc >= 0 && nc < 12) {
              const neighborIdx = nr * 12 + nc;
              if (room.board[neighborIdx] === enemySide) {
                room.board[neighborIdx] = player.side;
              }
            }
          }
        }

        const counts = countPieces(room.board);
        room.blueScore = counts.blue;
        room.redScore = counts.red;

        const nextTurn: 'BLUE' | 'RED' = player.side === 'BLUE' ? 'RED' : 'BLUE';
        room.turn = nextTurn;

        const isFull = !room.board.includes(null);
        if (isFull || counts.blue === 0 || counts.red === 0) {
          if (counts.blue > counts.red) room.winner = 'BLUE';
          else if (counts.red > counts.blue) room.winner = 'RED';
          else room.winner = 'DRAW';
        }

        broadcastRoom(room);
      } else if (data.type === 'RESET_GAME' && client.currentRoom) {
        const room = client.currentRoom;
        room.board = initBoard();
        room.turn = 'BLUE';
        room.winner = null;
        room.blueScore = 3;
        room.redScore = 3;
        broadcastRoom(room);
      } else if (data.type === 'HEXA_EMOJI' && client.currentRoom) {
        const room = client.currentRoom;
        const opponent = room.players.find((p: HexaPlayer) => p.id !== client.myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'HEXA_EMOJI_RELAY',
              emoji: data.emoji,
              senderId: client.myPlayerId,
            })
          );
        }
      }

      // ==========================================
      // 3. CYBER TANKS PROTOCOL
      // ==========================================
      else if (data.type === 'TANK_QUICK_MATCH') {
        client.myPlayerId = data.playerId || 'TK_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const playerName = data.name || 'Tankçı ' + client.myPlayerId.slice(3, 7);

        tankQueue = tankQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== client.myPlayerId);
        if (tankQueue.length > 0) {
          const opponent = tankQueue.shift()!;
          const matchCode = 'TANK_' + Math.floor(1000 + Math.random() * 9000);
          const room: TankRoom = {
            code: matchCode,
            players: [
              { ws: opponent.ws, id: opponent.id, name: opponent.name, slot: 'P1', ready: true, score: 0, lives: 3 },
              { ws, id: client.myPlayerId, name: playerName, slot: 'P2', ready: true, score: 0, lives: 3 },
            ],
            status: 'COUNTDOWN',
            round: 1,
            winner: null,
            roundWinner: null,
            mapSeed: Math.floor(Math.random() * 100000),
          };
          tankRooms.set(matchCode, room);

          (opponent.ws as any).currentTankRoom = room;
          (opponent.ws as any).myPlayerId = opponent.id;
          client.currentTankRoom = room;

          startTankRoomCountdown(room);
        } else {
          tankQueue.push({ ws, id: client.myPlayerId, name: playerName, timestamp: Date.now() });
          ws.send(JSON.stringify({ type: 'TANK_QUEUE_WAITING', message: 'Tank düellosu için rakip aranıyor...' }));
        }
      } else if (data.type === 'TANK_JOIN_ROOM') {
        const roomCode = (data.code || 'TANK1').toUpperCase().trim().slice(0, 10);
        client.myPlayerId = data.playerId || 'TK_' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const playerName = data.name || 'Tankçı ' + client.myPlayerId.slice(3, 7);

        if (roomCode === 'QUICK') {
          tankQueue = tankQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== client.myPlayerId);
          if (tankQueue.length > 0) {
            const opponent = tankQueue.shift()!;
            const matchCode = 'TANK_' + Math.floor(1000 + Math.random() * 9000);
            const room: TankRoom = {
              code: matchCode,
              players: [
                { ws: opponent.ws, id: opponent.id, name: opponent.name, slot: 'P1', ready: true, score: 0, lives: 3 },
                { ws, id: client.myPlayerId, name: playerName, slot: 'P2', ready: true, score: 0, lives: 3 },
              ],
              status: 'COUNTDOWN',
              round: 1,
              winner: null,
              roundWinner: null,
              mapSeed: Math.floor(Math.random() * 100000),
            };
            tankRooms.set(matchCode, room);

            (opponent.ws as any).currentTankRoom = room;
            (opponent.ws as any).myPlayerId = opponent.id;
            client.currentTankRoom = room;

            startTankRoomCountdown(room);
            return;
          } else {
            tankQueue.push({ ws, id: client.myPlayerId, name: playerName, timestamp: Date.now() });
            ws.send(JSON.stringify({ type: 'TANK_QUEUE_WAITING', message: 'Tank düellosu için rakip aranıyor...' }));
            return;
          }
        }

        let room = tankRooms.get(roomCode);
        if (!room) {
          room = {
            code: roomCode,
            players: [],
            status: 'LOBBY',
            round: 1,
            winner: null,
            roundWinner: null,
            mapSeed: Math.floor(Math.random() * 100000),
          };
          tankRooms.set(roomCode, room);
        }

        client.currentTankRoom = room;

        let existing = room.players.find((p) => p.id === client.myPlayerId);
        if (!existing) {
          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'TANK_ERROR', message: 'Oda dolu! (Maksimum 2 tank)' }));
            return;
          }
          const slot: 'P1' | 'P2' = room.players.some((p) => p.slot === 'P1') ? 'P2' : 'P1';
          existing = {
            ws,
            id: client.myPlayerId,
            name: playerName,
            slot,
            ready: false,
            score: 0,
            lives: 3,
          };
          room.players.push(existing);
        } else {
          existing.ws = ws;
          existing.name = playerName;
        }

        room.players.forEach((p) => {
          (p.ws as any).currentTankRoom = room;
          (p.ws as any).myPlayerId = p.id;
        });

        broadcastTankRoom(room);

        if (room.players.length === 2 && room.players.every((p) => p.ready)) {
          startTankRoomCountdown(room);
        }
      } else if (data.type === 'TANK_TOGGLE_READY' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        const player = room.players.find((p: TankPlayer) => p.id === client.myPlayerId);
        if (player) {
          player.ready = !player.ready;
          broadcastTankRoom(room);
          if (room.players.length === 2 && room.players.every((p: TankPlayer) => p.ready)) {
            startTankRoomCountdown(room);
          }
        }
      } else if (data.type === 'TANK_START_BATTLE' && client.currentTankRoom) {
        client.currentTankRoom.status = 'BATTLE';
        broadcastTankRoom(client.currentTankRoom);
      } else if (data.type === 'TANK_SYNC_POS' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        const opponent = room.players.find((p: TankPlayer) => p.id !== client.myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'TANK_OPPONENT_POS',
              x: data.x,
              y: data.y,
              bodyAngle: data.bodyAngle,
              turretAngle: data.turretAngle,
              speed: data.speed,
              lives: data.lives,
              hasShield: data.hasShield,
              powerup: data.powerup,
            })
          );
        }
      } else if (data.type === 'TANK_FIRE_BULLET' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        const opponent = room.players.find((p: TankPlayer) => p.id !== client.myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'TANK_OPPONENT_BULLET',
              id: data.id,
              x: data.x,
              y: data.y,
              vx: data.vx,
              vy: data.vy,
              bounces: data.bounces,
              isSpecial: data.isSpecial,
            })
          );
        }
      } else if (data.type === 'TANK_HIT' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        const victim = room.players.find((p: TankPlayer) => p.id === client.myPlayerId);
        if (victim && room.status === 'BATTLE') {
          victim.lives = Math.max(0, data.lives);
          if (victim.lives <= 0) {
            const winnerPlayer = room.players.find((p: TankPlayer) => p.id !== client.myPlayerId);
            if (winnerPlayer) {
              winnerPlayer.score += 1;
              room.roundWinner = winnerPlayer.slot;
              if (winnerPlayer.score >= 3) {
                room.status = 'MATCH_OVER';
                room.winner = winnerPlayer.slot;
              } else {
                room.status = 'ROUND_OVER';
              }
            }
          }
          broadcastTankRoom(room);
        }
      } else if (data.type === 'TANK_NEXT_ROUND' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        room.round += 1;
        room.roundWinner = null;
        room.mapSeed = Math.floor(Math.random() * 100000);
        room.players.forEach((p: TankPlayer) => {
          p.lives = 3;
          p.ready = true;
        });
        startTankRoomCountdown(room);
      } else if (data.type === 'TANK_REMATCH' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        room.round = 1;
        room.winner = null;
        room.roundWinner = null;
        room.mapSeed = Math.floor(Math.random() * 100000);
        room.players.forEach((p: TankPlayer) => {
          p.score = 0;
          p.lives = 3;
          p.ready = true;
        });
        startTankRoomCountdown(room);
      } else if (data.type === 'TANK_EMOJI' && client.currentTankRoom) {
        const room = client.currentTankRoom;
        const opponent = room.players.find((p: TankPlayer) => p.id !== client.myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'TANK_EMOJI_RELAY',
              emoji: data.emoji,
              senderId: client.myPlayerId,
            })
          );
        }
      }
    } catch {
      // ignore JSON parse error
    }
  });

  ws.on('close', () => {
    const id = client.myPlayerId;
    gdQueue = gdQueue.filter((qp) => qp.id !== id);
    tankQueue = tankQueue.filter((qp) => qp.id !== id);
    hexaQueue = hexaQueue.filter((qp) => qp.id !== id);

    if (client.currentRoom) {
      const room = client.currentRoom;
      room.players = room.players.filter((p: HexaPlayer) => p.id !== id);
      if (room.players.length === 0) {
        rooms.delete(room.code);
      } else {
        broadcastRoom(room);
      }
    }

    if (client.currentGDRoom) {
      const room = client.currentGDRoom;
      room.players = room.players.filter((p: GDPerson) => p.id !== id);
      if (room.players.length === 0) {
        if (room.countdownTimer) clearInterval(room.countdownTimer);
        gdRooms.delete(room.code);
      } else {
        room.status = 'LOBBY';
        room.winner = null;
        broadcastGDRoom(room);
      }
    }

    if (client.currentTankRoom) {
      const room = client.currentTankRoom;
      room.players = room.players.filter((p: TankPlayer) => p.id !== id);
      if (room.players.length === 0) {
        if (room.countdownTimer) clearInterval(room.countdownTimer);
        tankRooms.delete(room.code);
      } else {
        room.status = 'LOBBY';
        room.winner = null;
        broadcastTankRoom(room);
      }
    }
  });
});

async function start() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
