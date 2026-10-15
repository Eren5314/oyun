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
  PlusCircle,
  Link,
  Radio,
} from 'lucide-react';
import { sound } from '../utils/sound';

interface HexaPlayer {
  id: string;
  name: string;
  side: 'BLUE' | 'RED';
}

interface RoomData {
  code: string;
  players: HexaPlayer[];
  board: Array<'BLUE' | 'RED' | null>;
  turn: 'BLUE' | 'RED';
  winner: 'BLUE' | 'RED' | 'DRAW' | null;
  blueScore: number;
  redScore: number;
}

export const HexaConquestOnlineGame: React.FC<{
  onScoreUpdate: (id: string, s: number) => void;
  playerName?: string;
}> = ({ onScoreUpdate, playerName }) => {
  const [matchMode, setMatchMode] = useState<'QUICK' | 'CUSTOM'>('CUSTOM');
  const [roomCodeInput, setRoomCodeInput] = useState('ARENA1');
  const [currentRoomCode, setCurrentRoomCode] = useState('ARENA1');
  const [isConnected, setIsConnected] = useState(false);
  const [isSearchingQuick, setIsSearchingQuick] = useState(false);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [myPlayerId] = useState(() => 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isBotPlaying, setIsBotPlaying] = useState(false);
  const [autoBotMode, setAutoBotMode] = useState(false);
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; id: number } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const myDisplayName = playerName || 'Komutan ' + myPlayerId.slice(2, 6);

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
        if (action === 'QUICK') {
          setIsSearchingQuick(true);
          ws.send(
            JSON.stringify({
              type: 'HEXA_QUICK_MATCH',
              playerId: myPlayerId,
              name: myDisplayName,
            })
          );
        } else {
          setIsSearchingQuick(false);
          ws.send(
            JSON.stringify({
              type: 'JOIN_ROOM',
              code: code,
              playerId: myPlayerId,
              name: myDisplayName,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'HEXA_QUEUE_WAITING') {
            setIsSearchingQuick(true);
          } else if (msg.type === 'ROOM_UPDATE') {
            setIsSearchingQuick(false);
            setRoomData(msg);
            setCurrentRoomCode(msg.code);
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
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    },
    [myDisplayName, myPlayerId, onScoreUpdate]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomCodeInput(roomParam);
      setCurrentRoomCode(roomParam);
      connectWs('CUSTOM', roomParam);
    } else {
      connectWs('CUSTOM', currentRoomCode);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

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
          const targetIdx = r * 8 + c;
          if (roomData.board[targetIdx] !== null) continue;

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
    [roomData]
  );

  const handleCellClick = (idx: number) => {
    if (!roomData || !isMyTurn) return;

    const cellVal = roomData.board[idx];

    if (cellVal === mySide) {
      setSelectedCell(idx === selectedCell ? null : idx);
      sound.playPop();
      return;
    }

    if (selectedCell !== null && cellVal === null) {
      const valid = getValidMoves(selectedCell);
      const isClone = valid.clones.includes(idx);
      const isJump = valid.jumps.includes(idx);

      if (isClone || isJump) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
        }
        setSelectedCell(null);
      }
    }
  };

  // Bot logic
  const playBotMove = useCallback(() => {
    if (!roomData || isBotPlaying || roomData.winner) return;

    setIsBotPlaying(true);
    setTimeout(() => {
      const enemySide = mySide === 'BLUE' ? 'RED' : 'BLUE';
      const enemyPieces: number[] = [];
      roomData.board.forEach((val, idx) => {
        if (val === enemySide) enemyPieces.push(idx);
      });

      if (enemyPieces.length === 0) {
        setIsBotPlaying(false);
        return;
      }

      let bestMove: { from: number; to: number } | null = null;
      let maxScore = -1;

      for (const from of enemyPieces) {
        const moves = getValidMoves(from);
        for (const to of [...moves.clones, ...moves.jumps]) {
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
  }, [getValidMoves, mySide, roomData, isBotPlaying]);

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
      wsRef.current.send(JSON.stringify({ type: 'RESET_GAME' }));
      sound.playJump();
    }
  };

  const handleQuickMatch = () => {
    setMatchMode('QUICK');
    connectWs('QUICK', 'QUICK');
    sound.playScore();
  };

  const handleCreateCustomRoom = () => {
    const code = 'HEXA-' + Math.floor(1000 + Math.random() * 9000);
    setRoomCodeInput(code);
    setCurrentRoomCode(code);
    setMatchMode('CUSTOM');
    connectWs('CUSTOM', code);
    sound.playScore();
  };

  const handleJoinCustomRoom = () => {
    if (!roomCodeInput.trim()) return;
    const clean = roomCodeInput.trim().toUpperCase();
    setCurrentRoomCode(clean);
    setMatchMode('CUSTOM');
    connectWs('CUSTOM', clean);
    sound.playScore();
  };

  const copyCode = () => {
    const code = roomData?.code || currentRoomCode;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    sound.playScore();
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const copyInviteLink = () => {
    const code = roomData?.code || currentRoomCode;
    const url = `${window.location.origin}${window.location.pathname}?game=hexa-conquest&room=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    sound.playScore();
    setTimeout(() => setCopiedLink(false), 1500);
  };

  const activeValidMoves = selectedCell !== null ? getValidMoves(selectedCell) : { clones: [], jumps: [] };

  return (
    <div className="flex flex-col gap-4 select-none">
      {/* Top Matchmaking & Room Panel */}
      <div className="bg-[#131B2E] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-extrabold text-white text-sm">HEXA FETİH: CANLI ONLINE STRATEJİ</h3>
              <p className="text-xs text-slate-400">
                Gerçek oyuncularla alan kontrolü savaşı!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Wifi className="w-3.5 h-3.5 animate-pulse" /> Canlı Sunucu Aktif
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <WifiOff className="w-3.5 h-3.5" /> Bağlantı Kesildi
              </span>
            )}
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
          {/* Quick match button */}
          <button
            onClick={handleQuickMatch}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md ${
              matchMode === 'QUICK'
                ? 'bg-blue-600 text-white shadow-blue-600/30 ring-1 ring-blue-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Hızlı Eşleşme (Rastgele)</span>
          </button>

          {/* Create private room */}
          <button
            onClick={handleCreateCustomRoom}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Özel Oda Oluştur</span>
          </button>

          {/* Join private room input */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="Oda Kodu"
              maxLength={10}
              className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-white/15 rounded-xl text-xs font-mono font-bold text-white uppercase focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleJoinCustomRoom}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-sm"
            >
              Katıl
            </button>
          </div>
        </div>

        {/* Active Room Code & Invite Link Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Aktif Oda:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 border border-white/10 font-mono font-bold text-blue-400">
              {roomData?.code || currentRoomCode}
            </span>
            <button
              onClick={copyCode}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Kodu Kopyala"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={copyInviteLink}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer flex items-center gap-1 text-[11px]"
              title="Davet Linki Kopyala"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Link className="w-3 h-3" />}
              <span>{copiedLink ? 'Link Alındı!' : 'Davet Linki'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoBotMode(!autoBotMode)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                autoBotMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{autoBotMode ? 'Yapay Zeka Açık' : 'Yapay Zeka Rakip'}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-white/10"
              title="Oyunu Sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isSearchingQuick && (
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 flex items-center justify-between text-xs animate-pulse">
            <div className="flex items-center gap-2 text-blue-300 font-semibold">
              <Radio className="w-4 h-4 animate-spin" />
              <span>Çevrim içi strateji rakibi aranıyor... Başka bir oyuncu katıldığında maç anında başlayacaktır!</span>
            </div>
            <button
              onClick={() => setAutoBotMode(true)}
              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer"
            >
              Bot ile Oyna
            </button>
          </div>
        )}
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
                Bölge: <span className="font-mono font-bold text-blue-400">{roomData?.blueScore || 2}</span>
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
                Bölge: <span className="font-mono font-bold text-rose-400">{roomData?.redScore || 2}</span>
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
                {isCloneTarget && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                {isJumpTarget && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>

        {/* Live Reaction Emojis Toolbar */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Reaksiyon Gönder:</span>
          {['🔥', '👑', '😎', '💀', '😱', '👏'].map((em) => (
            <button
              key={em}
              onClick={() => sendEmoji(em)}
              className="p-1.5 bg-slate-900 border border-white/10 rounded-lg hover:bg-slate-800 hover:scale-115 transition-all text-base cursor-pointer"
            >
              {em}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
