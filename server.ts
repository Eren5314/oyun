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
  } catch {}
}

app.post('/api/auth/register', (req, res) => {
  const { username, password, avatar } = req.body || {};
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalıdır.' });
  }
  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Parola en az 4 karakter olmalıdır.' });
  }
  const cleanUsername = username.trim();
  const lowerKey = cleanUsername.toLowerCase();
  if (usersDb[lowerKey]) {
    return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış! Lütfen başka bir ad seçin.' });
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

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve parola zorunludur.' });
  }
  const lowerKey = String(username).trim().toLowerCase();
  const existing = usersDb[lowerKey];
  if (!existing || existing.password !== password) {
    return res.status(401).json({ error: 'Kullanıcı adı veya parola hatalı!' });
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

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Keep-alive heartbeat every 20 seconds to prevent Cloud Run idle drop
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if ((client as any).isAlive === false) {
      return client.terminate();
    }
    (client as any).isAlive = false;
    client.ping();
  });
}, 20000);

interface Player {
  ws: WebSocket;
  id: string;
  name: string;
  side: 'BLUE' | 'RED';
}

interface Room {
  code: string;
  players: Player[];
  board: Array<('BLUE' | 'RED' | null)>; // 8x8 grid (64 cells)
  turn: 'BLUE' | 'RED';
  winner: 'BLUE' | 'RED' | 'DRAW' | null;
  blueScore: number;
  redScore: number;
}

const rooms = new Map<string, Room>();

function countPieces(board: Array<('BLUE' | 'RED' | null)>) {
  let blue = 0;
  let red = 0;
  board.forEach((cell) => {
    if (cell === 'BLUE') blue++;
    if (cell === 'RED') red++;
  });
  return { blue, red };
}

function broadcastRoom(room: Room) {
  const payload = JSON.stringify({
    type: 'ROOM_UPDATE',
    code: room.code,
    players: room.players.map((p) => ({ id: p.id, name: p.name, side: p.side })),
    board: room.board,
    turn: room.turn,
    winner: room.winner,
    blueScore: room.blueScore,
    redScore: room.redScore,
  });

  room.players.forEach((p) => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  });
}

function initBoard(): Array<('BLUE' | 'RED' | null)> {
  const board: Array<('BLUE' | 'RED' | null)> = new Array(64).fill(null);
  // Initial Hex/Grid Territory pieces
  board[0] = 'BLUE';
  board[7] = 'RED';
  board[56] = 'RED';
  board[63] = 'BLUE';
  return board;
}

// Geometry Dash Online Duel Rooms
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

// ==========================================
// SIBER TANKLAR (CYBER TANKS) ONLINE PROTOCOL
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

// ==========================================
// REAL-TIME MATCHMAKING QUEUES
// ==========================================
interface QueuePlayer {
  ws: WebSocket;
  id: string;
  name: string;
  cosmetics?: any;
  timestamp: number;
}

let gdQueue: QueuePlayer[] = [];
let tankQueue: QueuePlayer[] = [];
let hexaQueue: QueuePlayer[] = [];

wss.on('connection', (ws) => {
  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  let currentRoom: Room | null = null;
  let currentGDRoom: GDRoom | null = null;
  let currentTankRoom: TankRoom | null = null;
  let myPlayerId = '';

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      // ==========================================
      // GEOMETRY DASH ONLINE WEBSOCKET PROTOCOL
      // ==========================================
      if (data.type === 'GD_QUICK_MATCH') {
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Koşucu ' + myPlayerId.slice(0, 4);

        // Filter closed sockets from queue
        gdQueue = gdQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== myPlayerId);

        if (gdQueue.length > 0) {
          // Instant Match Found!
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
                id: myPlayerId,
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
          currentGDRoom = room;
          broadcastGDRoom(room, {
            countdown: 3,
            matchFound: true,
          });
        } else {
          // Add to queue and wait
          gdQueue.push({
            ws,
            id: myPlayerId,
            name: playerName,
            cosmetics: data.cosmetics || {},
            timestamp: Date.now(),
          });
          ws.send(JSON.stringify({ type: 'GD_QUEUE_WAITING', message: 'Çevrim içi rakip aranıyor...' }));
        }
      } else if (data.type === 'GD_LEAVE_QUEUE') {
        gdQueue = gdQueue.filter((qp) => qp.id !== myPlayerId);
      } else if (data.type === 'GD_JOIN_ROOM') {
        const roomCode = (data.code || 'GD1').toUpperCase().trim().slice(0, 8);
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Koşucu ' + myPlayerId.slice(0, 4);

        // If code is QUICK, route to quick match
        if (roomCode === 'QUICK') {
          // Trigger quick match directly
          gdQueue = gdQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== myPlayerId);
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
                  id: myPlayerId,
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
            currentGDRoom = room;
            broadcastGDRoom(room, { countdown: 3, matchFound: true });
            return;
          } else {
            gdQueue.push({ ws, id: myPlayerId, name: playerName, cosmetics: data.cosmetics || {}, timestamp: Date.now() });
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

        currentGDRoom = room;

        let existing = room.players.find((p) => p.id === myPlayerId);
        if (!existing) {
          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'GD_ERROR', message: 'Oda dolu! (Maksimum 2 oyuncu)' }));
            return;
          }
          const slot: 'P1' | 'P2' = room.players.some((p) => p.slot === 'P1') ? 'P2' : 'P1';
          existing = {
            ws,
            id: myPlayerId,
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

        broadcastGDRoom(room);
      } else if (data.type === 'GD_TOGGLE_READY' && currentGDRoom) {
        const player = currentGDRoom.players.find((p) => p.id === myPlayerId);
        if (player) {
          player.ready = !player.ready;
          // If both players ready, start countdown
          if (currentGDRoom.players.length === 2 && currentGDRoom.players.every((p) => p.ready)) {
            currentGDRoom.status = 'COUNTDOWN';
            currentGDRoom.winner = null;
            currentGDRoom.seed = Math.floor(Math.random() * 100000);
            currentGDRoom.players.forEach((p) => {
              p.lives = 5;
            });
            broadcastGDRoom(currentGDRoom, { countdown: 3 });
          } else {
            broadcastGDRoom(currentGDRoom);
          }
        }
      } else if (data.type === 'GD_START_RACE' && currentGDRoom) {
        currentGDRoom.status = 'RACING';
        broadcastGDRoom(currentGDRoom);
      } else if (data.type === 'GD_SYNC_POS' && currentGDRoom) {
        // High frequency position relay to opponent
        const opponent = currentGDRoom.players.find((p) => p.id !== myPlayerId);
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
      } else if (data.type === 'GD_CRASH' && currentGDRoom) {
        const player = currentGDRoom.players.find((p) => p.id === myPlayerId);
        if (player) {
          player.lives = Math.max(0, data.lives);
          if (player.lives <= 0 && currentGDRoom.status === 'RACING') {
            currentGDRoom.status = 'FINISHED';
            const winnerPlayer = currentGDRoom.players.find((p) => p.id !== myPlayerId);
            currentGDRoom.winner = winnerPlayer ? winnerPlayer.slot : null;
          }
          broadcastGDRoom(currentGDRoom);
        }
      } else if (data.type === 'GD_REMATCH' && currentGDRoom) {
        currentGDRoom.status = 'COUNTDOWN';
        currentGDRoom.winner = null;
        currentGDRoom.seed = Math.floor(Math.random() * 100000);
        currentGDRoom.players.forEach((p) => {
          p.lives = 5;
          p.ready = true;
        });
        broadcastGDRoom(currentGDRoom, { countdown: 3 });
      }

      // ==========================================
      // HEXA CONQUEST PROTOCOL
      // ==========================================
      else if (data.type === 'HEXA_QUICK_MATCH') {
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Komutan ' + myPlayerId.slice(0, 4);

        hexaQueue = hexaQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== myPlayerId);
        if (hexaQueue.length > 0) {
          const opponent = hexaQueue.shift()!;
          const matchCode = 'ARENA_' + Math.floor(1000 + Math.random() * 9000);
          const room: Room = {
            code: matchCode,
            players: [
              { ws: opponent.ws, id: opponent.id, name: opponent.name, side: 'BLUE' },
              { ws, id: myPlayerId, name: playerName, side: 'RED' },
            ],
            board: initBoard(),
            turn: 'BLUE',
            winner: null,
            blueScore: 2,
            redScore: 2,
          };
          rooms.set(matchCode, room);
          currentRoom = room;
          broadcastRoom(room);
        } else {
          hexaQueue.push({ ws, id: myPlayerId, name: playerName, timestamp: Date.now() });
          ws.send(JSON.stringify({ type: 'HEXA_QUEUE_WAITING', message: 'Strateji rakibi aranıyor...' }));
        }
      } else if (data.type === 'JOIN_ROOM') {
        const roomCode = (data.code || 'GLOBAL').toUpperCase().trim().slice(0, 8);
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Komutan ' + myPlayerId.slice(0, 4);

        if (roomCode === 'QUICK') {
          hexaQueue = hexaQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== myPlayerId);
          if (hexaQueue.length > 0) {
            const opponent = hexaQueue.shift()!;
            const matchCode = 'ARENA_' + Math.floor(1000 + Math.random() * 9000);
            const room: Room = {
              code: matchCode,
              players: [
                { ws: opponent.ws, id: opponent.id, name: opponent.name, side: 'BLUE' },
                { ws, id: myPlayerId, name: playerName, side: 'RED' },
              ],
              board: initBoard(),
              turn: 'BLUE',
              winner: null,
              blueScore: 2,
              redScore: 2,
            };
            rooms.set(matchCode, room);
            currentRoom = room;
            broadcastRoom(room);
            return;
          } else {
            hexaQueue.push({ ws, id: myPlayerId, name: playerName, timestamp: Date.now() });
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
            blueScore: 2,
            redScore: 2,
          };
          rooms.set(roomCode, room);
        }

        currentRoom = room;

        // Assign side
        let existing = room.players.find((p) => p.id === myPlayerId);
        if (!existing) {
          const side: 'BLUE' | 'RED' = room.players.some((p) => p.side === 'BLUE') ? 'RED' : 'BLUE';
          existing = { ws, id: myPlayerId, name: playerName, side };
          room.players.push(existing);
        } else {
          existing.ws = ws;
          existing.name = playerName;
        }

        const counts = countPieces(room.board);
        room.blueScore = counts.blue;
        room.redScore = counts.red;

        broadcastRoom(room);
      } else if (data.type === 'MAKE_MOVE' && currentRoom) {
        const { fromIdx, toIdx, playerId } = data;
        const player = currentRoom.players.find((p) => p.id === playerId);
        if (!player || player.side !== currentRoom.turn || currentRoom.winner) return;

        // Validate move
        if (toIdx < 0 || toIdx >= 64 || fromIdx < 0 || fromIdx >= 64) return;
        if (currentRoom.board[fromIdx] !== player.side) return;
        if (currentRoom.board[toIdx] !== null) return;

        const fromR = Math.floor(fromIdx / 8);
        const fromC = fromIdx % 8;
        const toR = Math.floor(toIdx / 8);
        const toC = toIdx % 8;
        const dist = Math.max(Math.abs(fromR - toR), Math.abs(fromC - toC));

        if (dist === 1) {
          currentRoom.board[toIdx] = player.side;
        } else if (dist === 2) {
          currentRoom.board[fromIdx] = null;
          currentRoom.board[toIdx] = player.side;
        } else {
          return;
        }

        const enemySide: 'BLUE' | 'RED' = player.side === 'BLUE' ? 'RED' : 'BLUE';
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = toR + dr;
            const nc = toC + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const neighborIdx = nr * 8 + nc;
              if (currentRoom.board[neighborIdx] === enemySide) {
                currentRoom.board[neighborIdx] = player.side;
              }
            }
          }
        }

        const counts = countPieces(currentRoom.board);
        currentRoom.blueScore = counts.blue;
        currentRoom.redScore = counts.red;

        const emptyCells = currentRoom.board.filter((c) => c === null).length;
        if (emptyCells === 0 || counts.blue === 0 || counts.red === 0) {
          if (counts.blue > counts.red) currentRoom.winner = 'BLUE';
          else if (counts.red > counts.blue) currentRoom.winner = 'RED';
          else currentRoom.winner = 'DRAW';
        } else {
          currentRoom.turn = enemySide;
        }

        broadcastRoom(currentRoom);
      } else if (data.type === 'RESET_BOARD' && currentRoom) {
        currentRoom.board = initBoard();
        currentRoom.turn = 'BLUE';
        currentRoom.winner = null;
        currentRoom.blueScore = 2;
        currentRoom.redScore = 2;
        broadcastRoom(currentRoom);
      } else if (data.type === 'HEXA_EMOJI' && currentRoom) {
        const opponent = currentRoom.players.find((p) => p.id !== myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'HEXA_EMOJI_RELAY',
              emoji: data.emoji,
              senderId: myPlayerId,
            })
          );
        }
      }

      // ==========================================
      // SIBER TANKLAR (CYBER TANKS) WEBSOCKET HANDLERS
      // ==========================================
      else if (data.type === 'TANK_QUICK_MATCH') {
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Tankçı ' + myPlayerId.slice(0, 4);

        tankQueue = tankQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== myPlayerId);
        if (tankQueue.length > 0) {
          const opponent = tankQueue.shift()!;
          const matchCode = 'TANK_' + Math.floor(1000 + Math.random() * 9000);
          const room: TankRoom = {
            code: matchCode,
            players: [
              { ws: opponent.ws, id: opponent.id, name: opponent.name, slot: 'P1', ready: true, score: 0, lives: 3 },
              { ws, id: myPlayerId, name: playerName, slot: 'P2', ready: true, score: 0, lives: 3 },
            ],
            status: 'COUNTDOWN',
            round: 1,
            winner: null,
            roundWinner: null,
            mapSeed: Math.floor(Math.random() * 100000),
          };
          tankRooms.set(matchCode, room);
          currentTankRoom = room;
          broadcastTankRoom(room, { countdown: 3, matchFound: true });
        } else {
          tankQueue.push({ ws, id: myPlayerId, name: playerName, timestamp: Date.now() });
          ws.send(JSON.stringify({ type: 'TANK_QUEUE_WAITING', message: 'Tank düellosu için rakip aranıyor...' }));
        }
      } else if (data.type === 'TANK_JOIN_ROOM') {
        const roomCode = (data.code || 'TANK1').toUpperCase().trim().slice(0, 8);
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Tankçı ' + myPlayerId.slice(0, 4);

        if (roomCode === 'QUICK') {
          tankQueue = tankQueue.filter((qp) => qp.ws.readyState === WebSocket.OPEN && qp.id !== myPlayerId);
          if (tankQueue.length > 0) {
            const opponent = tankQueue.shift()!;
            const matchCode = 'TANK_' + Math.floor(1000 + Math.random() * 9000);
            const room: TankRoom = {
              code: matchCode,
              players: [
                { ws: opponent.ws, id: opponent.id, name: opponent.name, slot: 'P1', ready: true, score: 0, lives: 3 },
                { ws, id: myPlayerId, name: playerName, slot: 'P2', ready: true, score: 0, lives: 3 },
              ],
              status: 'COUNTDOWN',
              round: 1,
              winner: null,
              roundWinner: null,
              mapSeed: Math.floor(Math.random() * 100000),
            };
            tankRooms.set(matchCode, room);
            currentTankRoom = room;
            broadcastTankRoom(room, { countdown: 3, matchFound: true });
            return;
          } else {
            tankQueue.push({ ws, id: myPlayerId, name: playerName, timestamp: Date.now() });
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

        currentTankRoom = room;

        let existing = room.players.find((p) => p.id === myPlayerId);
        if (!existing) {
          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'TANK_ERROR', message: 'Tank odası dolu! (Maksimum 2 oyuncu)' }));
            return;
          }
          const slot: 'P1' | 'P2' = room.players.some((p) => p.slot === 'P1') ? 'P2' : 'P1';
          existing = {
            ws,
            id: myPlayerId,
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

        broadcastTankRoom(room);
      } else if (data.type === 'TANK_TOGGLE_READY' && currentTankRoom) {
        const p = currentTankRoom.players.find((pl) => pl.id === myPlayerId);
        if (p) {
          p.ready = !p.ready;
          // If both players are ready (or 1 ready in solo bot mode), start countdown
          if (currentTankRoom.players.length === 2 && currentTankRoom.players.every((pl) => pl.ready)) {
            currentTankRoom.status = 'COUNTDOWN';
            currentTankRoom.winner = null;
            currentTankRoom.roundWinner = null;
            currentTankRoom.mapSeed = Math.floor(Math.random() * 100000);
            currentTankRoom.players.forEach((pl) => {
              pl.lives = 3;
            });
            broadcastTankRoom(currentTankRoom, { countdown: 3 });
          } else {
            broadcastTankRoom(currentTankRoom);
          }
        }
      } else if (data.type === 'TANK_START_BATTLE' && currentTankRoom) {
        currentTankRoom.status = 'BATTLE';
        broadcastTankRoom(currentTankRoom);
      } else if (data.type === 'TANK_SYNC_POS' && currentTankRoom) {
        // High frequency position & turret relay to opponent
        const opponent = currentTankRoom.players.find((p) => p.id !== myPlayerId);
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
      } else if (data.type === 'TANK_FIRE_BULLET' && currentTankRoom) {
        // Relay projectile to opponent
        const opponent = currentTankRoom.players.find((p) => p.id !== myPlayerId);
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
      } else if (data.type === 'TANK_HIT' && currentTankRoom) {
        const victim = currentTankRoom.players.find((p) => p.id === myPlayerId);
        if (victim && currentTankRoom.status === 'BATTLE') {
          victim.lives = Math.max(0, data.lives);
          if (victim.lives <= 0) {
            const winnerPlayer = currentTankRoom.players.find((p) => p.id !== myPlayerId);
            if (winnerPlayer) {
              winnerPlayer.score += 1;
              currentTankRoom.roundWinner = winnerPlayer.slot;
              if (winnerPlayer.score >= 3) {
                currentTankRoom.status = 'MATCH_OVER';
                currentTankRoom.winner = winnerPlayer.slot;
              } else {
                currentTankRoom.status = 'ROUND_OVER';
              }
            }
            broadcastTankRoom(currentTankRoom);
          } else {
            broadcastTankRoom(currentTankRoom);
          }
        }
      } else if (data.type === 'TANK_NEXT_ROUND' && currentTankRoom) {
        currentTankRoom.round += 1;
        currentTankRoom.status = 'COUNTDOWN';
        currentTankRoom.roundWinner = null;
        currentTankRoom.mapSeed = Math.floor(Math.random() * 100000);
        currentTankRoom.players.forEach((p) => {
          p.lives = 3;
          p.ready = true;
        });
        broadcastTankRoom(currentTankRoom, { countdown: 3 });
      } else if (data.type === 'TANK_REMATCH' && currentTankRoom) {
        currentTankRoom.round = 1;
        currentTankRoom.status = 'COUNTDOWN';
        currentTankRoom.winner = null;
        currentTankRoom.roundWinner = null;
        currentTankRoom.mapSeed = Math.floor(Math.random() * 100000);
        currentTankRoom.players.forEach((p) => {
          p.score = 0;
          p.lives = 3;
          p.ready = true;
        });
        broadcastTankRoom(currentTankRoom, { countdown: 3 });
      } else if (data.type === 'TANK_EMOJI' && currentTankRoom) {
        const opponent = currentTankRoom.players.find((p) => p.id !== myPlayerId);
        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          opponent.ws.send(
            JSON.stringify({
              type: 'TANK_EMOJI_RELAY',
              emoji: data.emoji,
              senderId: myPlayerId,
            })
          );
        }
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    gdQueue = gdQueue.filter((qp) => qp.id !== myPlayerId);
    tankQueue = tankQueue.filter((qp) => qp.id !== myPlayerId);
    hexaQueue = hexaQueue.filter((qp) => qp.id !== myPlayerId);

    if (currentRoom) {
      currentRoom.players = currentRoom.players.filter((p) => p.id !== myPlayerId);
      if (currentRoom.players.length === 0) {
        rooms.delete(currentRoom.code);
      } else {
        broadcastRoom(currentRoom);
      }
    }
    if (currentGDRoom) {
      currentGDRoom.players = currentGDRoom.players.filter((p) => p.id !== myPlayerId);
      if (currentGDRoom.players.length === 0) {
        gdRooms.delete(currentGDRoom.code);
      } else {
        currentGDRoom.status = 'LOBBY';
        currentGDRoom.winner = null;
        broadcastGDRoom(currentGDRoom);
      }
    }
    if (currentTankRoom) {
      currentTankRoom.players = currentTankRoom.players.filter((p) => p.id !== myPlayerId);
      if (currentTankRoom.players.length === 0) {
        tankRooms.delete(currentTankRoom.code);
      } else {
        currentTankRoom.status = 'LOBBY';
        currentTankRoom.winner = null;
        broadcastTankRoom(currentTankRoom);
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
