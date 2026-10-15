import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Users,
  RotateCcw,
  Shield,
  Swords,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Bot,
  Zap,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { sound } from '../utils/sound';

type CellValue = 'BLUE' | 'RED' | null;

interface OnlinePlayer {
  id: string;
  name: string;
  side: 'BLUE' | 'RED';
}

interface RoomData {
  code: string;
  players: OnlinePlayer[];
  board: CellValue[];
  turn: 'BLUE' | 'RED';
  winner: 'BLUE' | 'RED' | 'DRAW' | null;
  blueScore: number;
  redScore: number;
}

export const HexaConquestOnlineGame: React.FC<{
  onScoreUpdate: (id: string, s: number) => void;
  playerName?: string;
}> = ({ onScoreUpdate, playerName }) => {
  const [roomCodeInput, setRoomCodeInput] = useState('ARENA1');
  const [currentRoomCode, setCurrentRoomCode] = useState('ARENA1');
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [myPlayerId] = useState(() => 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [isBotPlaying, setIsBotPlaying] = useState(false);
  const [autoBotMode, setAutoBotMode] = useState(false);
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; id: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const myDisplayName = playerName || 'Komutan ' + myPlayerId.slice(2, 6);

  const connectWs = useCallback(
    (code: string) => {
      if (wsRef.current) {
        wsRef.current.close();
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
            setRoomData(msg);
            if (msg.winner) {
              sound.playVictory();
              onScoreUpdate('hexa-conquest', Math.max(msg.blueScore, msg.redScore) * 10);
            }
          } else if (msg.type === 'HEXA_EMOJI_RELAY') {
            setFloatingEmoji({ emoji: msg.emoji, id: Date.now() });
            setTimeout(() => setFloatingEmoji(null), 2000);
            sound.playPop();
          }
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(() => {
          if (wsRef.current === ws) {
            connectWs(code);
          }
        }, 1500);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    },
    [myPlayerId, onScoreUpdate]
  );

  useEffect(() => {
    connectWs(currentRoomCode);
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs, currentRoomCode]);

  const me = roomData?.players.find((p) => p.id === myPlayerId);
  const mySide = me?.side || 'BLUE';
  const isMyTurn = roomData?.turn === mySide && !roomData?.winner;

  // Send reaction emoji
  const sendEmoji = (emoji: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'HEXA_EMOJI', emoji }));
      setFloatingEmoji({ emoji, id: Date.now() });
      setTimeout(() => setFloatingEmoji(null), 2000);
      sound.playPop();
    }
  };

  // Valid move calculations (Clone: dist 1, Jump: dist 2)
  const getValidMoves = useCallback(
    (fromIdx: number): { clones: number[]; jumps: number[] } => {
      if (!roomData) return { clones: [], jumps: [] };
      const clones: number[] = [];
      const jumps: number[] = [];

      const fromR = Math.floor(fromIdx / 8);
      const fromC = fromIdx % 8;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const idx = r * 8 + c;
          if (roomData.board[idx] !== null) continue;

          const dist = Math.max(Math.abs(fromR - r), Math.abs(fromC - c));
          if (dist === 1) clones.push(idx);
          else if (dist === 2) jumps.push(idx);
        }
      }

      return { clones, jumps };
    },
    [roomData]
  );

  const handleCellClick = (idx: number) => {
    if (!roomData || !wsRef.current || roomData.winner) return;

    // Select piece
    if (roomData.board[idx] === mySide) {
      setSelectedCell(idx);
      sound.playPop();
      return;
    }

    // Move piece if target is valid
    if (selectedCell !== null && roomData.board[idx] === null && isMyTurn) {
      const valid = getValidMoves(selectedCell);
      const isClone = valid.clones.includes(idx);
      const isJump = valid.jumps.includes(idx);

      if (isClone || isJump) {
        wsRef.current.send(
          JSON.stringify({
            type: 'MAKE_MOVE',
            fromIdx: selectedCell,
            toIdx: idx,
            playerId: myPlayerId,
          })
        );
        if (isClone) sound.playPad();
        else sound.playScore();
        setSelectedCell(null);
      }
    }
  };

  // Bot move logic
  const playBotMove = useCallback(() => {
    if (!roomData || !wsRef.current || roomData.winner || roomData.turn === mySide) return;
    setIsBotPlaying(true);

    setTimeout(() => {
      const enemySide = mySide === 'BLUE' ? 'RED' : 'BLUE';
      const enemyPieces: number[] = [];
      roomData.board.forEach((cell, idx) => {
        if (cell === enemySide) enemyPieces.push(idx);
      });

      let bestMove: { from: number; to: number } | null = null;
      let maxScore = -1;

      for (const from of enemyPieces) {
        const moves = getValidMoves(from);
        for (const to of [...moves.clones, ...moves.jumps]) {
          // Calculate captures
          const toR = Math.floor(to / 8);
          const toC = to % 8;
          let captures = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = toR + dr;
              const nc = toC + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (roomData.board[nr * 8 + nc] === mySide) captures++;
              }
            }
          }
          if (captures > maxScore) {
            maxScore = captures;
            bestMove = { from, to };
          }
        }
      }

      if (bestMove && wsRef.current) {
        const enemyPlayer = roomData.players.find((p) => p.side === enemySide);
        wsRef.current.send(
          JSON.stringify({
            type: 'MAKE_MOVE',
            fromIdx: bestMove.from,
            toIdx: bestMove.to,
            playerId: enemyPlayer?.id || 'BOT',
          })
        );
      }
      setIsBotPlaying(false);
    }, 450);
  }, [getValidMoves, mySide, roomData]);

  // If autoBotMode is on and it's the opponent's turn, trigger bot move automatically
  useEffect(() => {
    if (autoBotMode && !isMyTurn && !roomData?.winner && !isBotPlaying) {
      const timer = setTimeout(() => {
        playBotMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoBotMode, isMyTurn, playBotMove, roomData?.winner, isBotPlaying]);

  const handleReset = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'RESET_BOARD' }));
      sound.playJump();
    }
  };

  const handleQuickMatch = () => {
    const code = 'ARENA' + Math.floor(1 + Math.random() * 99);
    setRoomCodeInput(code);
    setCurrentRoomCode(code);
  };

  const activeValidMoves = selectedCell !== null ? getValidMoves(selectedCell) : { clones: [], jumps: [] };

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Top Multiplayer Matchmaking Bar */}
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
            <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-2.5 py-1 rounded font-mono font-bold text-blue-400">
              {roomData?.code || currentRoomCode}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomData?.code || currentRoomCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Oda Kodunu Kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Change room / Quick match input */}
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
            placeholder="ODA ADI"
            maxLength={8}
            className="w-24 px-2 py-1 bg-slate-900 border border-white/10 rounded text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => {
              if (roomCodeInput.trim()) setCurrentRoomCode(roomCodeInput.trim());
            }}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            Katıl
          </button>
          <button
            onClick={() => setAutoBotMode(!autoBotMode)}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
              autoBotMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
            }`}
            title="Otomatik Botu Aç / Kapat"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>{autoBotMode ? 'Otomatik Bot Açık' : 'Yapay Zeka Rakip'}</span>
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-white/10"
            title="Tahtayı Sıfırla"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Players & Turn Status Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131B2E] border border-white/10 rounded-xl p-3.5 items-center">
        {/* Blue Team */}
        <div
          className={`p-2.5 rounded-lg border flex items-center justify-between ${
            mySide === 'BLUE' ? 'bg-blue-950/40 border-blue-500/50 ring-1 ring-blue-500/30' : 'bg-slate-900/50 border-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6]" />
            <div>
              <p className="text-xs font-bold text-white">Mavi Birlik {mySide === 'BLUE' && '(SEN)'}</p>
              <p className="text-[11px] text-slate-400">
                Bölge Sayısı: <span className="font-mono font-bold text-blue-400">{roomData?.blueScore || 2}</span>
              </p>
            </div>
          </div>
          <Shield className="w-4 h-4 text-blue-400" />
        </div>

        {/* Match Center Banner */}
        <div className="text-center relative">
          {floatingEmoji && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl animate-bounce z-20 pointer-events-none drop-shadow-lg">
              {floatingEmoji.emoji}
            </div>
          )}

          {roomData?.winner ? (
            <div className="flex flex-col items-center">
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                {roomData.winner === 'DRAW' ? 'BERABERLİK!' : `${roomData.winner === 'BLUE' ? 'MAVİ BİRLİK' : 'KIRMIZI LEJYON'} KAZANDI!`}
              </div>
              <button
                onClick={handleReset}
                className="mt-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
              >
                Yeni Maç Başlat
              </button>
            </div>
          ) : (
            <div>
              <span className="text-xs text-slate-400">Sıradaki Hamle: </span>
              <span className={`text-xs font-bold ${roomData?.turn === 'BLUE' ? 'text-blue-400' : 'text-rose-400'}`}>
                {roomData?.turn === 'BLUE' ? 'MAVİ' : 'KIRMIZI'} {roomData?.turn === mySide ? '(Senin Sıran!)' : ''}
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Komşu = Çoğalma (Yeşil) · 2 Adım = Atlama (Sarı)</p>
            </div>
          )}
        </div>

        {/* Red Team */}
        <div
          className={`p-2.5 rounded-lg border flex items-center justify-between ${
            mySide === 'RED' ? 'bg-rose-950/40 border-rose-500/50 ring-1 ring-rose-500/30' : 'bg-slate-900/50 border-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-[0_0_8px_#F43F5E]" />
            <div>
              <p className="text-xs font-bold text-white">Kırmızı Lejyon {mySide === 'RED' && '(SEN)'}</p>
              <p className="text-[11px] text-slate-400">
                Bölge Sayısı: <span className="font-mono font-bold text-rose-400">{roomData?.redScore || 2}</span>
              </p>
            </div>
          </div>
          <Swords className="w-4 h-4 text-rose-400" />
        </div>
      </div>

      {/* Main 8x8 Strategy Board */}
      <div className="bg-[#090D16] border border-white/10 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center shadow-2xl">
        <div className="grid grid-cols-8 gap-1.5 sm:gap-2 max-w-[480px] w-full aspect-square bg-slate-950 p-2 sm:p-3 rounded-xl border border-white/10 shadow-2xl">
          {roomData?.board.map((cell, idx) => {
            const isSelected = selectedCell === idx;
            const isCloneTarget = activeValidMoves.clones.includes(idx);
            const isJumpTarget = activeValidMoves.jumps.includes(idx);

            let bgClass = 'bg-[#131B2E]/80 border-white/5 hover:border-white/20';

            if (cell === 'BLUE') {
              bgClass = 'bg-blue-600/90 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
            } else if (cell === 'RED') {
              bgClass = 'bg-rose-600/90 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
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
                {cell === 'BLUE' && <span className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-white/95 shadow-md" />}
                {cell === 'RED' && <span className="w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-white/95 shadow-md" />}
                {isCloneTarget && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm" />}
                {isJumpTarget && <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />}
              </button>
            );
          })}
        </div>

        {/* Reaction Emojis & Bot Assistant Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 bg-[#111827] border border-white/10 px-3 py-1.5 rounded-full shadow-md">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Taktik Emojisi:</span>
            {['🔥', '😎', '🧠', '💥', '🏆', '👏', '🎯'].map((em) => (
              <button
                key={em}
                onClick={() => sendEmoji(em)}
                className="text-base hover:scale-125 transition-transform cursor-pointer px-1"
              >
                {em}
              </button>
            ))}
          </div>

          {!isMyTurn && !roomData?.winner && !autoBotMode && (
            <button
              onClick={playBotMove}
              disabled={isBotPlaying}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer border border-white/10"
            >
              <Bot className="w-3.5 h-3.5 text-blue-400" />
              {isBotPlaying ? 'Bot Düşünüyor...' : 'Rakip Sırasını Bot Oynasın'}
            </button>
          )}
        </div>
      </div>

      {/* Rules & Multiplayer Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300 bg-[#131B2E] border border-white/10 rounded-xl p-3.5">
        <div className="flex items-start gap-2.5">
          <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Canlı Online Çok Oyunculu</p>
            <p className="text-slate-400">Arkadaşınızla aynı Oda Kodunu girin veya "Hızlı Eşleşme" ile anında strateji savaşına başlayın.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Çoğalma & Dönüştürme</p>
            <p className="text-slate-400">1 kare yana oynarsanız çoğalırsınız. Vardığınız karenin 8 komşusundaki tüm rakip taşlar sizin renginize bürünür!</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Swords className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">2 Kare Atlama Taktiği</p>
            <p className="text-slate-400">2 kare uzağa atlarsanız eski kareniz boşalır ama rakip hattının arkasına sıçrayıp büyük fethe imza atabilirsiniz.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
