import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

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

wss.on('connection', (ws) => {
  let currentRoom: Room | null = null;
  let myPlayerId = '';

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'JOIN_ROOM') {
        const roomCode = (data.code || 'GLOBAL').toUpperCase().trim().slice(0, 8);
        myPlayerId = data.playerId || Math.random().toString(36).substring(2, 9);
        const playerName = data.name || 'Komutan ' + myPlayerId.slice(0, 4);

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
          // Clone / Expand to neighbor
          currentRoom.board[toIdx] = player.side;
        } else if (dist === 2) {
          // Jump: leave old tile, jump to target
          currentRoom.board[fromIdx] = null;
          currentRoom.board[toIdx] = player.side;
        } else {
          return; // invalid distance
        }

        // Convert adjacent opponent cells
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

        // Check winner or end
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
      }
    } catch {
      // ignore
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      currentRoom.players = currentRoom.players.filter((p) => p.id !== myPlayerId);
      if (currentRoom.players.length === 0) {
        rooms.delete(currentRoom.code);
      } else {
        broadcastRoom(currentRoom);
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
