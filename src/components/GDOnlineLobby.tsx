import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Swords,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Play,
  RotateCcw,
  Sparkles,
  Shield,
  Zap,
  ChevronLeft,
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
  const [roomCodeInput, setRoomCodeInput] = useState('ARENA1');
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<GDRoomState | null>(null);
  const [myPlayerId] = useState(() => 'P_' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const connectToRoom = useCallback(
    (codeToJoin: string) => {
      setErrorMessage(null);
      if (wsRef.current) {
        wsRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setCurrentRoomCode(codeToJoin);
        ws.send(
          JSON.stringify({
            type: 'GD_JOIN_ROOM',
            code: codeToJoin,
            playerId: myPlayerId,
            name: playerName,
            cosmetics: myCosmetics,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'GD_ROOM_UPDATE') {
            setRoomState(msg);
            if (msg.countdown !== undefined) {
              setCountdown(msg.countdown);
              sound.playBeat(1);
            }
            if (msg.status === 'RACING') {
              const myPlayer = msg.players?.find((p: OnlineOpponent) => p.id === myPlayerId);
              const opponent = msg.players?.find((p: OnlineOpponent) => p.id !== myPlayerId) || null;
              if (myPlayer) {
                onStartMatch(ws, msg.code, myPlayer.slot, opponent, msg.seed);
              }
            }
          } else if (msg.type === 'GD_ERROR') {
            setErrorMessage(msg.message);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };
    },
    [myPlayerId, playerName, myCosmetics, onStartMatch]
  );

  // Auto connect on mount to initial code
  useEffect(() => {
    connectToRoom(roomCodeInput);
    return () => {
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

  const generateRandomRoom = () => {
    const rnd = 'GD_' + Math.floor(1000 + Math.random() * 9000);
    setRoomCodeInput(rnd);
    connectToRoom(rnd);
  };

  const myPlayer = roomState?.players?.find((p) => p.id === myPlayerId);
  const opponent = roomState?.players?.find((p) => p.id !== myPlayerId);

  return (
    <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-6 text-slate-100 max-w-4xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-black text-white tracking-wide">ONLINE ÇOK OYUNCULU DÜELLO</h2>
            </div>
            <p className="text-xs text-slate-400">
              Arkadaşınla aynı oda kodunu girerek canlı yarış veya rastgele bir odaya katıl!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 animate-pulse" /> Canlı Sunucu Bağlı
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5" /> Bağlantı Kesildi
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Room Code Selection Bar */}
      <div className="p-4 bg-[#131B2E] border border-white/10 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Oda Kodu:</span>
          <input
            type="text"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            className="px-3 py-1.5 bg-slate-900 border border-white/15 rounded-lg text-sm font-bold text-blue-400 w-32 tracking-wider focus:outline-none focus:border-blue-500"
            maxLength={8}
          />
          <button
            onClick={() => connectToRoom(roomCodeInput)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold cursor-pointer transition-colors"
          >
            Odaya Katıl
          </button>
          <button
            onClick={generateRandomRoom}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium cursor-pointer transition-colors"
          >
            Rastgele Kod
          </button>
        </div>

        {currentRoomCode && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Arkadaşını Davet Et:</span>
            <button
              onClick={copyCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-white font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              {currentRoomCode}
            </button>
          </div>
        )}
      </div>

      {/* 2-Player Match Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slot 1: Host / Player 1 (Blue) */}
        <div className="p-5 rounded-2xl bg-[#131B2E] border-2 border-blue-500/50 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
                1. OYUNCU (MAVİ)
              </span>
              {myPlayer?.slot === 'P1' && (
                <span className="text-xs font-semibold text-emerald-400">SENİN KONTROLÜNDE</span>
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
                    Kostüm:{' '}
                    {roomState.players.find((p) => p.slot === 'P1')?.cosmetics?.cubeSkin || 'Klasik'}
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
            {roomState?.players?.find((p) => p.slot === 'P1')?.ready ? (
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

        {/* Slot 2: Guest / Player 2 (Red) */}
        <div className="p-5 rounded-2xl bg-[#131B2E] border-2 border-rose-500/50 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600/30 text-rose-300 border border-rose-500/40">
                2. OYUNCU (KIRMIZI)
              </span>
              {myPlayer?.slot === 'P2' && (
                <span className="text-xs font-semibold text-emerald-400">SENİN KONTROLÜNDE</span>
              )}
            </div>

            {opponent?.slot === 'P2' || myPlayer?.slot === 'P2' ? (
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg border border-white/20"
                  style={{
                    backgroundColor:
                      roomState?.players?.find((p) => p.slot === 'P2')?.cosmetics?.primaryColor ||
                      '#EF4444',
                    color:
                      roomState?.players?.find((p) => p.slot === 'P2')?.cosmetics?.secondaryColor ||
                      '#FFFFFF',
                  }}
                >
                  ■
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">
                    {roomState?.players?.find((p) => p.slot === 'P2')?.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kostüm:{' '}
                    {roomState?.players?.find((p) => p.slot === 'P2')?.cosmetics?.cubeSkin || 'Klasik'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs font-medium flex flex-col items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                <span>Rakip oyuncu aranıyor / bekleniyor...</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-400">Durum:</span>
            {roomState?.players?.find((p) => p.slot === 'P2')?.ready ? (
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

      {/* Action / Ready Button */}
      <div className="flex flex-col items-center justify-center gap-3 pt-2">
        {countdown !== null && countdown > 0 ? (
          <div className="text-center animate-bounce">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">
              HER İKİ OYUNCU HAZIR! DÜELLO BAŞLIYOR:
            </p>
            <span className="text-6xl font-black text-white font-mono-num">{countdown}</span>
          </div>
        ) : (
          <>
            <button
              onClick={toggleReady}
              disabled={!isConnected || (roomState?.players?.length || 0) < 2}
              className={`px-10 py-3.5 rounded-xl font-black text-base cursor-pointer shadow-2xl transition-all flex items-center gap-2 ${
                myPlayer?.ready
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
                  : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {myPlayer?.ready ? (
                <>
                  <Check className="w-5 h-5" /> HAZIRSIN! (İptal Etmek İçin Tıkla)
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" /> HAZIR OL (Yarışı Başlat)
                </>
              )}
            </button>

            {(roomState?.players?.length || 0) < 2 && (
              <p className="text-xs text-amber-400">
                Yarışın başlayabilmesi için 2. oyuncunun odaya katılması bekleniyor.
              </p>
            )}
          </>
        )}
      </div>

      {/* Rules Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400 bg-[#131B2E] border border-white/5 rounded-xl p-3.5">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p>
            <strong>Canlı Senkronize Yarış</strong>: Her iki oyuncu aynı rastgele oluşturulan parkurda eşzamanlı koşar.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            <strong>5 Can ve Koruma</strong>: Çarpıldığında 1.5 sn koruma kalkanı devreye girer; 5 canı ilk tükenen kaybeder.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong>Özel Kostümler</strong>: Garajda seçtiğin küp, roket ve dalga kostümleri rakibin ekranında birebir görünür.
          </p>
        </div>
      </div>
    </div>
  );
};
