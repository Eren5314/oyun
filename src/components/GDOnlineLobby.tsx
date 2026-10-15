import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Swords,
  Copy,
  Check,
  Wifi,
  WifiOff,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  Bot,
  Zap,
  Radio,
} from 'lucide-react';
import { PlayerCosmetics } from '../utils/cosmetics';
import { sound } from '../utils/sound';

export interface OnlineOpponent {
  id: string;
  name: string;
  slot: 'P1' | 'P2';
  cosmetics: PlayerCosmetics;
  lives: number;
  ready: boolean;
}

export interface GDRoomState {
  code: string;
  status: 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  winner: 'P1' | 'P2' | null;
  seed: number;
  players: OnlineOpponent[];
  countdown?: number;
  matchFound?: boolean;
}

interface Props {
  playerName: string;
  myCosmetics: PlayerCosmetics;
  onStartMatch: (
    ws: WebSocket,
    roomCode: string,
    mySlot: 'P1' | 'P2',
    opponent: OnlineOpponent | null,
    seed: number
  ) => void;
  onBackToMenu: () => void;
}

export const GDOnlineLobby: React.FC<Props> = ({
  playerName,
  myCosmetics,
  onStartMatch,
  onBackToMenu,
}) => {
  const [matchMode, setMatchMode] = useState<'QUICK' | 'CUSTOM'>('QUICK');
  const [roomCodeInput, setRoomCodeInput] = useState('ARENA1');
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [searchTimer, setSearchTimer] = useState(0);
  const [roomState, setRoomState] = useState<GDRoomState | null>(null);
  const [myPlayerId] = useState(() => 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showBotOption, setShowBotOption] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search timer
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isSearching) {
      t = setInterval(() => {
        setSearchTimer((s) => {
          if (s >= 5) setShowBotOption(true);
          return s + 1;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isSearching]);

  // Connect to server
  const connectToServer = useCallback(
    (action: 'QUICK' | 'CUSTOM', code?: string) => {
      setErrorMessage(null);
      if (wsRef.current) {
        wsRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (action === 'QUICK') {
          setIsSearching(true);
          setSearchTimer(0);
          setShowBotOption(false);
          ws.send(
            JSON.stringify({
              type: 'GD_QUICK_MATCH',
              playerId: myPlayerId,
              name: playerName,
              cosmetics: myCosmetics,
            })
          );
        } else {
          setIsSearching(false);
          const targetCode = code || roomCodeInput;
          setCurrentRoomCode(targetCode);
          ws.send(
            JSON.stringify({
              type: 'GD_JOIN_ROOM',
              code: targetCode,
              playerId: myPlayerId,
              name: playerName,
              cosmetics: myCosmetics,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'GD_QUEUE_WAITING') {
            setIsSearching(true);
          } else if (msg.type === 'GD_ROOM_UPDATE') {
            setRoomState(msg);
            setCurrentRoomCode(msg.code);

            if (msg.players?.length >= 2) {
              setIsSearching(false);
            }

            if (msg.countdown !== undefined) {
              setCountdown(msg.countdown);
              sound.playOrb();
            }

            if (msg.status === 'RACING') {
              const myP = msg.players?.find((p: OnlineOpponent) => p.id === myPlayerId);
              const opp = msg.players?.find((p: OnlineOpponent) => p.id !== myPlayerId) || null;
              if (myP) {
                sound.playVictory();
                onStartMatch(ws, msg.code, myP.slot, opp, msg.seed);
              }
            }
          } else if (msg.type === 'GD_ERROR') {
            setErrorMessage(msg.message);
          }
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 1.5 seconds if still mounted
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsRef.current === ws) {
            connectToServer(action, code);
          }
        }, 1500);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    },
    [myPlayerId, playerName, myCosmetics, roomCodeInput, onStartMatch]
  );

  // Auto start quick match on mount
  useEffect(() => {
    connectToServer('QUICK');
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const toggleReady = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'GD_TOGGLE_READY' }));
      sound.playPop();
    }
  };

  const copyCode = () => {
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode);
    setCopied(true);
    sound.playScore();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartBotRace = () => {
    // Generate a dummy bot opponent and start match immediately
    const botOpponent: OnlineOpponent = {
      id: 'BOT_SPECTER',
      name: 'Yapay Zeka (Drone)',
      slot: 'P2',
      cosmetics: {
        cubeSkin: 'ninja',
        shipSkin: 'falcon',
        waveSkin: 'laser',
        primaryColor: '#F43F5E',
        secondaryColor: '#FDA4AF',
        trailEffect: 'neon-fire',
        deathEffect: 'shockwave',
      },
      lives: 5,
      ready: true,
    };
    if (wsRef.current) {
      onStartMatch(wsRef.current, 'BOT_SOLO', 'P1', botOpponent, Math.floor(Math.random() * 100000));
    }
  };

  const myPlayer = roomState?.players?.find((p) => p.id === myPlayerId);
  const opponent = roomState?.players?.find((p) => p.id !== myPlayerId);

  return (
    <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-6 text-slate-100 max-w-4xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
            title="Ana Menüye Dön"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-black text-white tracking-wide">ONLINE ÇOK OYUNCULU DÜELLO</h2>
            </div>
            <p className="text-xs text-slate-400">
              Gerçek oyuncularla otomatik eşleşin veya arkadaşınızla özel oda koduyla kapışın!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
              <Wifi className="w-3.5 h-3.5 animate-pulse" /> Canlı Sunucu Bağlı
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-sm animate-pulse">
              <Radio className="w-3.5 h-3.5" /> Bağlanıyor...
            </span>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1.5 bg-[#131B2E] border border-white/10 rounded-xl text-xs font-bold max-w-md mx-auto w-full">
        <button
          onClick={() => {
            setMatchMode('QUICK');
            connectToServer('QUICK');
            sound.playPop();
          }}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            matchMode === 'QUICK'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Hızlı Eşleşme (Otomatik)</span>
        </button>

        <button
          onClick={() => {
            setMatchMode('CUSTOM');
            connectToServer('CUSTOM', roomCodeInput);
            sound.playPop();
          }}
          className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            matchMode === 'CUSTOM'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Özel Oda Kodu</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-semibold text-center">
          {errorMessage}
        </div>
      )}

      {/* QUICK MATCH RADAR VIEW */}
      {matchMode === 'QUICK' && isSearching && (
        <div className="p-8 rounded-2xl bg-gradient-to-b from-blue-950/40 to-slate-900/60 border border-blue-500/30 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden shadow-2xl">
          <div className="relative flex items-center justify-center w-28 h-28">
            <span className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
            <span className="absolute inset-3 rounded-full border border-sky-400/40 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-blue-600/30 border-2 border-blue-400 flex items-center justify-center text-blue-300 shadow-xl">
              <Radio className="w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          <div>
            <h3 className="font-extrabold text-lg text-white">Çevrim İçi Rakip Aranıyor...</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-sm">
              Sitedeki diğer aktif oyuncularla otomatik eşleşiyorsunuz. Biri girdiğinde yarış anında başlayacak!
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-sky-400 bg-slate-900/80 px-3 py-1 rounded-full border border-white/10 inline-block">
              Geçen Süre: 00:{searchTimer < 10 ? '0' + searchTimer : searchTimer}
            </div>
          </div>

          {showBotOption && (
            <div className="mt-2 p-4 rounded-xl bg-slate-900/90 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-lg w-full animate-in fade-in">
              <div className="text-left text-xs">
                <span className="font-bold text-amber-300 block">Şu an sırada bekleyen başka oyuncu yok</span>
                <span className="text-slate-400">İstersen hemen Yapay Zeka Hayaleti ile yarışabilirsin.</span>
              </div>
              <button
                onClick={handleStartBotRace}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors shrink-0"
              >
                <Bot className="w-4 h-4" />
                <span>Bot ile Başla</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* CUSTOM ROOM SEARCH BAR */}
      {matchMode === 'CUSTOM' && (
        <div className="p-4 bg-[#131B2E] border border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Özel Oda:</span>
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              className="px-3 py-1.5 bg-slate-900 border border-white/15 rounded-lg text-sm font-bold text-blue-400 w-32 tracking-wider focus:outline-none focus:border-blue-500"
              maxLength={8}
            />
            <button
              onClick={() => connectToServer('CUSTOM', roomCodeInput)}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold cursor-pointer transition-colors shadow-sm"
            >
              Odaya Katıl
            </button>
          </div>

          {currentRoomCode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Arkadaşını Davet Et:</span>
              <button
                onClick={copyCode}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-white font-mono flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                {currentRoomCode}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2-Player Match Cards (Shows when matched or in custom room) */}
      {(!isSearching || matchMode === 'CUSTOM' || (roomState?.players && roomState.players.length >= 2)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slot 1: Player 1 (Blue) */}
          <div className="p-5 rounded-2xl bg-[#131B2E] border-2 border-blue-500/50 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
                  1. OYUNCU (MAVİ)
                </span>
                {myPlayer?.slot === 'P1' && (
                  <span className="text-xs font-semibold text-emerald-400">SEN</span>
                )}
              </div>

              {roomState?.players?.find((p) => p.slot === 'P1') ? (
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg border border-white/20"
                    style={{
                      backgroundColor:
                        roomState.players.find((p) => p.slot === 'P1')?.cosmetics?.primaryColor ||
                        '#3B82F6',
                      color:
                        roomState.players.find((p) => p.slot === 'P1')?.cosmetics?.secondaryColor ||
                        '#FFFFFF',
                    }}
                  >
                    ■
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      {roomState.players.find((p) => p.slot === 'P1')?.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Kostüm: {roomState.players.find((p) => p.slot === 'P1')?.cosmetics?.cubeSkin || 'Klasik'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs font-medium">
                  1. Oyuncu bekleniyor...
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">Durum:</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                HAZIR
              </span>
            </div>
          </div>

          {/* Slot 2: Player 2 (Red) */}
          <div className="p-5 rounded-2xl bg-[#131B2E] border-2 border-rose-500/50 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/40">
                  2. OYUNCU (KIRMIZI)
                </span>
                {myPlayer?.slot === 'P2' && (
                  <span className="text-xs font-semibold text-emerald-400">SEN</span>
                )}
              </div>

              {roomState?.players?.find((p) => p.slot === 'P2') ? (
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg border border-white/20"
                    style={{
                      backgroundColor:
                        roomState.players.find((p) => p.slot === 'P2')?.cosmetics?.primaryColor ||
                        '#F43F5E',
                      color:
                        roomState.players.find((p) => p.slot === 'P2')?.cosmetics?.secondaryColor ||
                        '#FFFFFF',
                    }}
                  >
                    ■
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      {roomState.players.find((p) => p.slot === 'P2')?.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Kostüm: {roomState.players.find((p) => p.slot === 'P2')?.cosmetics?.cubeSkin || 'Klasik'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs font-medium">
                  2. Oyuncu bekleniyor...
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-slate-400">Durum:</span>
              {roomState?.players?.find((p) => p.slot === 'P2') ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  HAZIR
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  BEKLENİYOR
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay when countdown is active */}
      {countdown !== null && (
        <div className="p-6 rounded-2xl bg-blue-600/30 border-2 border-blue-400 text-center animate-in zoom-in shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-300 mb-1">EŞLEŞME BAŞARIYLA TAMAMLANDI!</p>
          <div className="text-6xl font-black text-amber-300 tracking-tight animate-bounce">
            {countdown}
          </div>
          <p className="text-xs text-white/80 mt-1">Yarış başlıyor, hazırlan!</p>
        </div>
      )}

      {/* Bottom Action Bar */}
      {matchMode === 'CUSTOM' && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={toggleReady}
            className={`px-8 py-3 rounded-xl font-black text-sm tracking-wider cursor-pointer transition-all shadow-xl ${
              myPlayer?.ready
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
            }`}
          >
            {myPlayer?.ready ? '✓ HAZIR (İptal Et)' : '⚡ HAZIR OL'}
          </button>
        </div>
      )}
    </div>
  );
};
