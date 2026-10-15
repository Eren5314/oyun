import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Users,
  RotateCcw,
  Shield,
  Swords,
  Wifi,
  WifiOff,
  Bot,
  Zap,
  Sparkles,
  Trophy,
  Bomb,
  Flame,
  ShieldAlert,
  Crosshair,
  Lock,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface Player {
  id: string;
  name: string;
  side: 'BLUE' | 'RED';
}

interface GameState {
  code: string;
  players: Player[];
  board: Array<'BLUE' | 'RED' | 'SHIELDED' | null>;
  turn: 'BLUE' | 'RED';
  winner: 'BLUE' | 'RED' | 'DRAW' | null;
  blueScore: number;
  redScore: number;
  blueEnergy: number;
  redEnergy: number;
}

export const HexaConquestOnlineGame: React.FC<{
  onScoreUpdate: (id: string, s: number) => void;
  playerName?: string;
}> = ({ onScoreUpdate, playerName }) => {
  const [playMode, setPlayMode] = useState<'ONLINE' | 'SOLO' | 'LOCAL_2P'>('SOLO');
  const [roomCodeInput, setRoomCodeInput] = useState('CYBER1');
  const [currentRoomCode, setCurrentRoomCode] = useState('CYBER1');
  const [isConnected, setIsConnected] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [activeAbility, setActiveAbility] = useState<'NONE' | 'LASER' | 'SHIELD'>('NONE');
  const [myPlayerId] = useState(() => 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; id: number } | null>(null);

  // 8x8 Grid for Cyber Territory Strategy
  const createInitialBoard = () => {
    const board: Array<'BLUE' | 'RED' | 'SHIELDED' | null> = Array(64).fill(null);
    // Starting positions
    board[0] = 'BLUE';
    board[7] = 'RED';
    board[56] = 'RED';
    board[63] = 'BLUE';
    return board;
  };

  const [gameState, setGameState] = useState<GameState>(() => ({
    code: 'SOLO-AI',
    players: [
      { id: myPlayerId, name: playerName || 'Komutan', side: 'BLUE' },
      { id: 'BOT', name: 'Cyber AI', side: 'RED' },
    ],
    board: createInitialBoard(),
    turn: 'BLUE',
    winner: null,
    blueScore: 2,
    redScore: 2,
    blueEnergy: 3,
    redEnergy: 3,
  }));

  const wsRef = useRef<WebSocket | null>(null);
  const myDisplayName = playerName || 'Komutan ' + myPlayerId.slice(2, 6);

  const handleModeChange = (mode: 'ONLINE' | 'SOLO' | 'LOCAL_2P') => {
    setPlayMode(mode);
    sound.playScore();
    setSelectedCell(null);
    setActiveAbility('NONE');

    const board = createInitialBoard();
    if (mode === 'SOLO') {
      setGameState({
        code: 'SOLO-AI',
        players: [
          { id: myPlayerId, name: myDisplayName, side: 'BLUE' },
          { id: 'BOT', name: 'Cyber AI', side: 'RED' },
        ],
        board,
        turn: 'BLUE',
        winner: null,
        blueScore: 2,
        redScore: 2,
        blueEnergy: 3,
        redEnergy: 3,
      });
    } else if (mode === 'LOCAL_2P') {
      setGameState({
        code: 'LOCAL-2P',
        players: [
          { id: 'P1', name: '1. Oyuncu (Mavi)', side: 'BLUE' },
          { id: 'P2', name: '2. Oyuncu (Kırmızı)', side: 'RED' },
        ],
        board,
        turn: 'BLUE',
        winner: null,
        blueScore: 2,
        redScore: 2,
        blueEnergy: 3,
        redEnergy: 3,
      });
    }
  };

  const connectWs = useCallback(
    (action: 'QUICK' | 'CUSTOM', code: string) => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            code: code,
            playerId: myPlayerId,
            name: myDisplayName,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ROOM_UPDATE') {
            setGameState(msg);
            setCurrentRoomCode(msg.code);
            if (msg.winner) {
              sound.playVictory();
              onScoreUpdate('hexa-conquest', Math.max(msg.blueScore, msg.redScore) * 15);
            }
          } else if (msg.type === 'HEXA_EMOJI_RELAY') {
            setFloatingEmoji({ emoji: msg.emoji, id: Date.now() });
            setTimeout(() => setFloatingEmoji(null), 2000);
            sound.playPop();
          }
        } catch {}
      };

      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);
    },
    [myDisplayName, myPlayerId, onScoreUpdate]
  );

  useEffect(() => {
    if (playMode === 'ONLINE') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room') || currentRoomCode;
      connectWs('CUSTOM', roomParam);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [playMode, connectWs, currentRoomCode]);

  const me = gameState?.players.find((p) => p.id === myPlayerId) || gameState?.players[0];
  const mySide = playMode === 'ONLINE' ? (me?.side || 'BLUE') : gameState.turn;
  const isMyTurn = playMode === 'ONLINE' ? (gameState?.turn === (me?.side || 'BLUE') && !gameState?.winner) : !gameState?.winner;

  const sendEmoji = (emoji: string) => {
    setFloatingEmoji({ emoji, id: Date.now() });
    setTimeout(() => setFloatingEmoji(null), 2000);
    sound.playPop();
    if (playMode === 'ONLINE' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'HEXA_EMOJI', emoji }));
    }
  };

  // Valid moves: Any empty cell within distance 1 (clone) or 2 (jump) of ANY of player's existing pieces
  const getValidMoves = useCallback(
    (fromIdx: number): { clones: number[]; jumps: number[] } => {
      if (!gameState) return { clones: [], jumps: [] };
      const clones: number[] = [];
      const jumps: number[] = [];

      const fromR = Math.floor(fromIdx / 8);
      const fromC = fromIdx % 8;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const targetIdx = r * 8 + c;
          if (gameState.board[targetIdx] !== null) continue;

          const dist = Math.max(Math.abs(fromR - r), Math.abs(fromC - c));
          if (dist === 1) {
            clones.push(targetIdx);
          } else if (dist === 2) {
            jumps.push(targetIdx);
          }
        }
      }
      return { clones, jumps };
    },
    [gameState]
  );

  // Execute Move Locally with Othello-style neighboring conversion
  const executeMoveLocally = (fromIdx: number, toIdx: number) => {
    const currentBoard = [...gameState.board];
    const currentTurn = gameState.turn;
    const enemySide = currentTurn === 'BLUE' ? 'RED' : 'BLUE';

    const fromR = Math.floor(fromIdx / 8);
    const fromC = fromIdx % 8;
    const toR = Math.floor(toIdx / 8);
    const toC = toIdx % 8;

    const dist = Math.max(Math.abs(fromR - toR), Math.abs(fromC - toC));

    if (dist === 2) {
      currentBoard[fromIdx] = null; // Jump leaves original square
    }

    currentBoard[toIdx] = currentTurn;

    // Convert all adjacent opponent cells (unless shielded)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = toR + dr;
        const nc = toC + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const nIdx = nr * 8 + nc;
          if (currentBoard[nIdx] === enemySide) {
            currentBoard[nIdx] = currentTurn;
          }
        }
      }
    }

    // Recount scores & award energy
    let blueCount = 0;
    let redCount = 0;
    let emptyCount = 0;

    currentBoard.forEach((cell) => {
      if (cell === 'BLUE') blueCount++;
      else if (cell === 'RED') redCount++;
      else emptyCount++;
    });

    let winner: 'BLUE' | 'RED' | 'DRAW' | null = null;
    if (emptyCount === 0 || blueCount === 0 || redCount === 0) {
      if (blueCount > redCount) winner = 'BLUE';
      else if (redCount > blueCount) winner = 'RED';
      else winner = 'DRAW';
      sound.playVictory();
      onScoreUpdate('hexa-conquest', Math.max(blueCount, redCount) * 15);
    } else {
      sound.playScore();
    }

    const nextTurn = enemySide;
    const energyGain = 1;

    setGameState((prev) => ({
      ...prev,
      board: currentBoard,
      turn: nextTurn,
      winner,
      blueScore: blueCount,
      redScore: redCount,
      blueEnergy: currentTurn === 'BLUE' ? prev.blueEnergy + energyGain : prev.blueEnergy,
      redEnergy: currentTurn === 'RED' ? prev.redEnergy + energyGain : prev.redEnergy,
    }));
  };

  // Laser Strike Ability (Cost: 3 energy)
  const useLaserLocally = (targetIdx: number) => {
    const currentBoard = [...gameState.board];
    const currentTurn = gameState.turn;
    const cellVal = currentBoard[targetIdx];

    if (cellVal === null || cellVal === currentTurn) return;

    currentBoard[targetIdx] = null;
    sound.playCrash();

    let blueCount = 0;
    let redCount = 0;
    currentBoard.forEach((cell) => {
      if (cell === 'BLUE') blueCount++;
      else if (cell === 'RED') redCount++;
    });

    const enemySide = currentTurn === 'BLUE' ? 'RED' : 'BLUE';

    setGameState((prev) => ({
      ...prev,
      board: currentBoard,
      turn: enemySide,
      blueScore: blueCount,
      redScore: redCount,
      blueEnergy: currentTurn === 'BLUE' ? prev.blueEnergy - 3 : prev.blueEnergy,
      redEnergy: currentTurn === 'RED' ? prev.redEnergy - 3 : prev.redEnergy,
    }));
    setActiveAbility('NONE');
  };

  const handleCellClick = (idx: number) => {
    if (gameState.winner) return;

    if (playMode === 'ONLINE') {
      if (!isMyTurn) return;
      const cellVal = gameState.board[idx];
      if (cellVal === mySide) {
        setSelectedCell(idx === selectedCell ? null : idx);
        sound.playPop();
        return;
      }
      if (selectedCell !== null && cellVal === null) {
        const valid = getValidMoves(selectedCell);
        if (valid.clones.includes(idx) || valid.jumps.includes(idx)) {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'MAKE_MOVE',
                fromIdx: selectedCell,
                toIdx: idx,
                playerId: myPlayerId,
              })
            );
            sound.playScore();
          }
          setSelectedCell(null);
        }
      }
      return;
    }

    // Local / Solo Mode Handling
    if (activeAbility === 'LASER') {
      const cellVal = gameState.board[idx];
      const currentTurn = gameState.turn;
      const energy = currentTurn === 'BLUE' ? gameState.blueEnergy : gameState.redEnergy;
      if (cellVal && cellVal !== currentTurn && energy >= 3) {
        useLaserLocally(idx);
      }
      return;
    }

    const cellVal = gameState.board[idx];
    const currentTurn = gameState.turn;

    if (cellVal === currentTurn) {
      setSelectedCell(idx === selectedCell ? null : idx);
      sound.playPop();
      return;
    }

    if (selectedCell !== null && cellVal === null) {
      const valid = getValidMoves(selectedCell);
      if (valid.clones.includes(idx) || valid.jumps.includes(idx)) {
        executeMoveLocally(selectedCell, idx);
        setSelectedCell(null);
      }
    }
  };

  // Bot AI Turn in SOLO Mode
  const [isBotPlaying, setIsBotPlaying] = useState(false);
  useEffect(() => {
    if (playMode === 'SOLO' && gameState.turn === 'RED' && !gameState.winner && !isBotPlaying) {
      setIsBotPlaying(true);
      const timer = setTimeout(() => {
        const redPieces: number[] = [];
        gameState.board.forEach((val, idx) => {
          if (val === 'RED') redPieces.push(idx);
        });

        if (redPieces.length === 0) {
          setIsBotPlaying(false);
          return;
        }

        // AI Laser ability if enough energy
        if (gameState.redEnergy >= 3 && Math.random() < 0.4) {
          const bluePieces: number[] = [];
          gameState.board.forEach((val, idx) => {
            if (val === 'BLUE') bluePieces.push(idx);
          });
          if (bluePieces.length > 0) {
            const target = bluePieces[Math.floor(Math.random() * bluePieces.length)];
            const currentBoard = [...gameState.board];
            currentBoard[target] = null;
            sound.playCrash();
            let blueCount = 0;
            let redCount = 0;
            currentBoard.forEach((cell) => {
              if (cell === 'BLUE') blueCount++;
              else if (cell === 'RED') redCount++;
            });
            setGameState((prev) => ({
              ...prev,
              board: currentBoard,
              turn: 'BLUE',
              blueScore: blueCount,
              redScore: redCount,
              redEnergy: prev.redEnergy - 3,
            }));
            setIsBotPlaying(false);
            return;
          }
        }

        // Find best move capturing max tiles
        let bestMove: { from: number; to: number } | null = null;
        let maxCaptures = -1;

        for (const from of redPieces) {
          const fromR = Math.floor(from / 8);
          const fromC = from % 8;
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const to = r * 8 + c;
              if (gameState.board[to] !== null) continue;
              const dist = Math.max(Math.abs(fromR - r), Math.abs(fromC - c));
              if (dist === 1 || dist === 2) {
                let captures = 0;
                for (let dr = -1; dr <= 1; dr++) {
                  for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                      if (gameState.board[nr * 8 + nc] === 'BLUE') captures++;
                    }
                  }
                }
                if (captures > maxCaptures) {
                  maxCaptures = captures;
                  bestMove = { from, to };
                }
              }
            }
          }
        }

        if (bestMove) {
          executeMoveLocally(bestMove.from, bestMove.to);
        }
        setIsBotPlaying(false);
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [playMode, gameState, isBotPlaying]);

  const handleReset = () => {
    setSelectedCell(null);
    setActiveAbility('NONE');
    if (playMode === 'ONLINE') {
      if (wsRef.current) wsRef.current.send(JSON.stringify({ type: 'RESET_GAME' }));
    } else {
      handleModeChange(playMode);
    }
  };

  const activeValidMoves = selectedCell !== null ? getValidMoves(selectedCell) : { clones: [], jumps: [] };

  return (
    <div className="flex flex-col gap-4 select-none max-w-4xl mx-auto w-full">
      {/* Mode Selector Tabs */}
      <div className="flex bg-[#131B2E] border border-white/10 rounded-2xl p-1.5 gap-2">
        <button
          onClick={() => handleModeChange('SOLO')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
            playMode === 'SOLO'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-400" />
          <span>Tek Kişilik (Yapay Zeka)</span>
        </button>

        <button
          onClick={() => handleModeChange('LOCAL_2P')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
            playMode === 'LOCAL_2P'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Yerel 2 Kişilik (Aynı Cihaz)</span>
        </button>

        <button
          onClick={() => handleModeChange('ONLINE')}
          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
            playMode === 'ONLINE'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Wifi className="w-4 h-4 text-sky-400" />
          <span>Canlı Online Oda</span>
        </button>
      </div>

      {playMode === 'ONLINE' && (
        <div className="bg-[#131B2E] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="font-extrabold text-white text-sm">SIBER ALAN: CANLI ONLINE SAVAŞ</h3>
                <p className="text-xs text-slate-400">Alan Hakimiyeti & Enerji Yetenekleri</p>
              </div>
            </div>
            <div>
              {isConnected ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Wifi className="w-3.5 h-3.5 animate-pulse" /> Bağlı
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <WifiOff className="w-3.5 h-3.5" /> Bağlantı Bekleniyor
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Score, Energy & Turn Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 items-center">
        <div className="p-2.5 rounded-lg border bg-blue-950/40 border-blue-500/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6]" />
            <div>
              <p className="text-xs font-bold text-white">Mavi Birlik</p>
              <p className="text-[11px] text-slate-400">
                Bölge: <span className="font-mono font-bold text-blue-400">{gameState.blueScore}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              <Zap className="w-3 h-3" /> {gameState.blueEnergy}
            </span>
            {playMode !== 'ONLINE' && gameState.turn === 'BLUE' && gameState.blueEnergy >= 3 && !gameState.winner && (
              <button
                onClick={() => setActiveAbility(activeAbility === 'LASER' ? 'NONE' : 'LASER')}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  activeAbility === 'LASER' ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                Lazer (3ş)
              </button>
            )}
          </div>
        </div>

        <div className="text-center relative">
          {floatingEmoji && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl animate-bounce z-20 pointer-events-none drop-shadow-lg">
              {floatingEmoji.emoji}
            </div>
          )}
          {gameState.winner ? (
            <div className="flex flex-col items-center">
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                {gameState.winner === 'DRAW' ? 'BERABERLİK!' : `${gameState.winner === 'BLUE' ? 'MAVİ BİRLİK' : 'KIRMIZI LEJYON'} KAZANDI!`}
              </div>
              <button
                onClick={handleReset}
                className="mt-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Yeni Maç
              </button>
            </div>
          ) : (
            <div>
              <span className="text-xs text-slate-400">Sıra: </span>
              <span className={`text-xs font-bold ${gameState.turn === 'BLUE' ? 'text-blue-400' : 'text-rose-400'}`}>
                {gameState.turn === 'BLUE' ? 'MAVİ BİRLİK' : 'KIRMIZI LEJYON'}
                {playMode === 'SOLO' && gameState.turn === 'RED' && isBotPlaying ? ' (Düşünüyor...)' : ''}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {activeAbility === 'LASER' ? '⚡ Yok edilecek rakip taşı seç!' : 'Komşu = Çoğalt & Dönüştür · Her tur +1 Enerji'}
              </p>
            </div>
          )}
        </div>

        <div className="p-2.5 rounded-lg border bg-rose-950/40 border-rose-500/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-[0_0_8px_#F43F5E]" />
            <div>
              <p className="text-xs font-bold text-white">Kırmızı Lejyon</p>
              <p className="text-[11px] text-slate-400">
                Bölge: <span className="font-mono font-bold text-rose-400">{gameState.redScore}</span>
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            <Zap className="w-3 h-3" /> {gameState.redEnergy}
          </span>
        </div>
      </div>

      {/* Board (8x8) */}
      <div className="bg-[#090D16] border border-white/10 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center shadow-2xl">
        <div className="grid grid-cols-8 gap-1.5 sm:gap-2 max-w-[480px] w-full aspect-square bg-slate-950 p-2 sm:p-3 rounded-xl border border-white/10 shadow-2xl">
          {gameState.board.map((cell, idx) => {
            const isSelected = selectedCell === idx;
            const isCloneTarget = activeValidMoves.clones.includes(idx);
            const isJumpTarget = activeValidMoves.jumps.includes(idx);

            let bgClass = 'bg-[#131B2E]/80 border-white/5 hover:border-white/20';

            if (cell === 'BLUE') {
              bgClass = 'bg-blue-600/90 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]';
            } else if (cell === 'RED') {
              bgClass = 'bg-rose-600/90 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
            }

            if (isSelected) {
              bgClass += ' ring-2 ring-white scale-95';
            } else if (isCloneTarget) {
              bgClass = 'bg-emerald-500/25 border-emerald-400 hover:bg-emerald-500/40 animate-pulse';
            } else if (isJumpTarget) {
              bgClass = 'bg-amber-500/25 border-amber-400 hover:bg-amber-500/40';
            }

            return (
              <button
                key={idx}
                onClick={() => handleCellClick(idx)}
                className={`w-full h-full rounded-lg border transition-all cursor-pointer flex items-center justify-center font-bold text-xs ${bgClass}`}
              >
                {cell === 'BLUE' && <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[9px] text-blue-700 font-extrabold">⬡</span>}
                {cell === 'RED' && <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[9px] text-rose-700 font-extrabold">⬡</span>}
                {isCloneTarget && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                {isJumpTarget && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>

        {/* Emojis & Reset */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Reaksiyon:</span>
          {['🔥', '👑', '😎', '💀', '😱', '👏'].map((em) => (
            <button
              key={em}
              onClick={() => sendEmoji(em)}
              className="p-1.5 bg-slate-900 border border-white/10 rounded-lg hover:bg-slate-800 hover:scale-115 transition-all text-base cursor-pointer"
            >
              {em}
            </button>
          ))}
          <button
            onClick={handleReset}
            className="ml-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-200 border border-white/10 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Sıfırla
          </button>
        </div>
      </div>
    </div>
  );
};
