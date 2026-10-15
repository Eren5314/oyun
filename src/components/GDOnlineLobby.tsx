import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Swords,
  Copy,
  Check,
  Wifi,
  ChevronLeft,
  Bot,
  Zap,
  Radio,
  PlusCircle,
  Link,
  Shield,
  Clock,
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
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [searchTimer, setSearchTimer] = useState(0);
  const [roomState, setRoomState] = useState<GDRoomState | null>(null);
  const [myPlayerId] = useState(() => 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showBotOption, setShowBotOption] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const isHandedOver = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search timer
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isSearching && matchMode === 'QUICK') {
      t = setInterval(() => {
        setSearchTimer((s) => {
          if (s >= 5) setShowBotOption(true);
          return s + 1;
        });
      }, 1000);
    }
    return () => clearInterval(t);
  }, [isSearching, matchMode]);

  // Connect to server
  const connectToServer = useCallback(
    (action: 'QUICK' | 'CUSTOM', code?: string) => {
      setErrorMessage(null);
      isHandedOver.current = false;

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
          const targetCode = (code || roomCodeInput || 'GD_' + Math.floor(1000 + Math.random() * 9000)).toUpperCase().trim();
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

            // CRITICAL: When racing begins, hand over socket to match without closing!
            if (msg.status === 'RACING') {
              const myP = msg.players?.find((p: OnlineOpponent) => p.id === myPlayerId);
              const opp = msg.players?.find((p: OnlineOpponent) => p.id !== myPlayerId) || null;
              if (myP) {
                isHandedOver.current = true;
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
        // Only attempt reconnect if not handed over to active match
        if (!isHandedOver.current) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (wsRef.current === ws && !isHandedOver.current) {
              connectToServer(action, code);
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    },
    [myPlayerId, playerName, myCosmetics, roomCodeInput, onStartMatch]
  );

  // Auto connect on mount, check URL for room param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setMatchMode('CUSTOM');
      setRoomCodeInput(roomParam);
      connectToServer('CUSTOM', roomParam);
    } else {
      connectToServer('QUICK');
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      // Only close if NOT handed over to gameplay!
      if (wsRef.current && !isHandedOver.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleCreateCustomRoom = () => {
    const newCode = 'GD-' + Math.floor(1000 + Math.random() * 9000);
    setRoomCodeInput(newCode);
    setMatchMode('CUSTOM');
    connectToServer('CUSTOM', newCode);
    sound.playScore();
  };

  const handleJoinCustomRoom = () => {
    if (!roomCodeInput.trim()) return;
    setMatchMode('CUSTOM');
    connectToServer('CUSTOM', roomCodeInput.trim().toUpperCase());
    sound.playScore();
  };

  const toggleReady = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'GD_TOGGLE_READY' }));
      sound.playPop();
    }
  };

  const copyCode = () => {
    if (!currentRoomCode) return;
    navigator.clipboard.writeText(currentRoomCode);
    setCopiedCode(true);
    sound.playScore();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    if (!currentRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?game=geometry-dash&room=${currentRoomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    sound.playScore();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartBotRace = () => {
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
      isHandedOver.current = true;
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
              Rastgele bir çevrim içi oyuncuyla eşleşin ya da özel oda kodu ile arkadaşınızı davet edin!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
              <Wifi className="w-3.5 h-3.5 animate-pulse" /> Canlı Sunucu Aktif
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
          className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            matchMode === 'QUICK'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Hızlı Eşleşme (Rastgele)</span>
        </button>

        <button
          onClick={() => {
            setMatchMode('CUSTOM');
            sound.playPop();
          }}
          className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            matchMode === 'CUSTOM'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Özel Oda (Arkadaşla)</span>
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
              Sitedeki diğer aktif oyuncularla otomatik eşleşiyorsunuz. Biri girdiğinde yarış 3 saniyelik geri sayımla başlayacak!
            </p>
            <div className="mt-2 text-xs font-mono font-bold text-sky-400 bg-slate-900/80 px-3 py-1 rounded-full border border-white/10 inline-block">
              Geçen Süre: 00:{searchTimer < 10 ? '0' + searchTimer : searchTimer}
            </div>
          </div>

          {showBotOption && (
            <div className="mt-2 p-4 rounded-xl bg-slate-900/90 border border-amber-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-lg w-full animate-in fade-in">
              <div className="text-left text-xs">
                <span className="font-bold text-amber-300 block">Beklemek istemiyor musun?</span>
                <span className="text-slate-400">Hemen akıllı Yapay Zeka Hayalet Drone ile kapışabilirsin!</span>
              </div>
              <button
                onClick={handleStartBotRace}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-colors shrink-0"
              >
                <Bot className="w-4 h-4" />
                <span>Yapay Zekayla Başla</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* CUSTOM ROOM PANEL */}
      {matchMode === 'CUSTOM' && (
        <div className="flex flex-col gap-5">
          {/* Action Row: Create Room vs Join Room */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Create Room Box */}
            <div className="p-5 rounded-xl bg-[#131B2E] border border-blue-500/30 flex flex-col justify-between gap-3 shadow-lg">
              <div>
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-1">
                  <PlusCircle className="w-4 h-4" />
                  <span>Yeni Özel Oda Oluştur</span>
                </div>
                <p className="text-xs text-slate-400">
                  Benzersiz bir oda kurun ve oluşturulan kodu arkadaşınıza ileterek hemen yarışın.
                </p>
              </div>

              <button
                onClick={handleCreateCustomRoom}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-600/30"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Özel Oda Kodu Üret ve Kur</span>
              </button>
            </div>

            {/* Join Room Box */}
            <div className="p-5 rounded-xl bg-[#131B2E] border border-white/10 flex flex-col justify-between gap-3 shadow-lg">
              <div>
                <div className="flex items-center gap-2 text-white font-bold text-sm mb-1">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Arkadaşının Odasına Katıl</span>
                </div>
                <p className="text-xs text-slate-400">
                  Arkadaşınızın verdiği 6-8 haneli oda kodunu girerek onun odasına bağlanın.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="Örn: GD-8492"
                  maxLength={10}
                  className="flex-1 px-3.5 py-2 bg-slate-900 border border-white/15 rounded-xl text-sm font-bold text-white uppercase placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleJoinCustomRoom}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-sm"
                >
                  Katıl
                </button>
              </div>
            </div>
          </div>

          {/* Current Room Active Info Banner */}
          {currentRoomCode && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/60 to-slate-900/80 border border-blue-500/40 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">AKTİF ÖZEL ODA KODU:</span>
                  <span className="font-mono text-lg font-black text-white tracking-widest">{currentRoomCode}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCode}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{copiedCode ? 'Kopyalandı!' : 'Kodu Kopyala'}</span>
                </button>

                <button
                  onClick={copyInviteLink}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Link className="w-3.5 h-3.5 text-white" />}
                  <span>{copiedLink ? 'Link Alındı!' : 'Davet Linki'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2-Player Match Cards (Shows in Custom mode or when matched) */}
      {(matchMode === 'CUSTOM' || !isSearching || (roomState?.players && roomState.players.length >= 2)) && (
        <div className="flex flex-col gap-4">
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
                          roomState.players.find((p) => p.slot === 'P1')?.cosmetics?.primaryColor || '#3B82F6',
                        color:
                          roomState.players.find((p) => p.slot === 'P1')?.cosmetics?.secondaryColor || '#FFFFFF',
                      }}
                    >
                      ▲
                    </div>
                    <div>
                      <div className="font-bold text-white text-base">
                        {roomState.players.find((p) => p.slot === 'P1')?.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Bağlandı · 5 Can</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-500 text-xs italic">Oyuncu bekleniyor...</div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">Durum:</span>
                <span
                  className={`font-bold ${
                    roomState?.players?.find((p) => p.slot === 'P1')?.ready ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {roomState?.players?.find((p) => p.slot === 'P1')?.ready ? '✓ HAZIR' : 'Bekliyor...'}
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
                          roomState.players.find((p) => p.slot === 'P2')?.cosmetics?.primaryColor || '#EF4444',
                        color:
                          roomState.players.find((p) => p.slot === 'P2')?.cosmetics?.secondaryColor || '#FFFFFF',
                      }}
                    >
                      ▲
                    </div>
                    <div>
                      <div className="font-bold text-white text-base">
                        {roomState.players.find((p) => p.slot === 'P2')?.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Bağlandı · 5 Can</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-500 text-xs italic flex flex-col items-center gap-1">
                    <span>Arkadaşının odaya girmesi bekleniyor...</span>
                    <span className="text-[11px] text-blue-400">Yukarıdaki kodu vererek davet edin</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">Durum:</span>
                <span
                  className={`font-bold ${
                    roomState?.players?.find((p) => p.slot === 'P2')?.ready ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {roomState?.players?.find((p) => p.slot === 'P2')?.ready ? '✓ HAZIR' : 'Bekliyor...'}
                </span>
              </div>
            </div>
          </div>

          {/* Countdown Display */}
          {countdown !== null && countdown > 0 && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-400/50 flex flex-col items-center justify-center gap-2 animate-in zoom-in duration-200">
              <span className="text-xs font-bold text-blue-300 tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 animate-spin" /> DÜELLO BAŞLIYOR!
              </span>
              <span className="font-display text-5xl font-black text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">
                {countdown}
              </span>
              <span className="text-xs text-slate-300">Hazır olun, refleksler konuşacak!</span>
            </div>
          )}

          {/* Ready & Start Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#131B2E] border border-white/10">
            <div className="text-xs text-slate-400">
              {roomState?.players && roomState.players.length === 2
                ? 'İki oyuncu da hazır olduğunda 3 saniye içinde yarış başlayacaktır.'
                : 'İkinci oyuncu bağlandığında buton aktif hale gelecektir.'}
            </div>

            <button
              onClick={toggleReady}
              disabled={!roomState || roomState.players.length < 2}
              className={`py-2.5 px-6 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                myPlayer?.ready
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{myPlayer?.ready ? 'HAZIRSIN (İptal Et)' : 'HAZIRIM!'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
