import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import GlassCard from '../components/GlassCard';
import PlayerList from '../components/PlayerList';
import GoalBadge from '../components/GoalBadge';
import NowPlaying from '../components/NowPlaying';
import BingoBoard from '../components/BingoBoard';
import { emitAck, getSocket } from '../lib/socket';
import { hostStore, spotifyStore } from '../lib/storage';
import {
  setupPlayer, transferPlaybackTo, startPlayback, PlayerHandle, FatalReason,
} from '../lib/spotifyPlayer';
import {
  ClaimPayload, GoalValue, PlayerPublic, RoomSnapshot, SquareState, TrackInfo,
} from '../lib/types';

const BOARD_N = 5;
const DISPLAY_LINES: number[][] = (() => {
  const lines: number[][] = [];
  for (let r = 0; r < BOARD_N; r++) lines.push(Array.from({ length: BOARD_N }, (_, c) => r * BOARD_N + c));
  for (let c = 0; c < BOARD_N; c++) lines.push(Array.from({ length: BOARD_N }, (_, r) => r * BOARD_N + c));
  lines.push(Array.from({ length: BOARD_N }, (_, i) => i * BOARD_N + i));
  lines.push(Array.from({ length: BOARD_N }, (_, i) => i * BOARD_N + (BOARD_N - 1 - i)));
  return lines;
})();

export default function HostRoom() {
  const { code = '' } = useParams();
  const nav = useNavigate();

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [trackMeta, setTrackMeta] = useState<Map<string, TrackInfo>>(new Map());
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [playerHandle, setPlayerHandle] = useState<PlayerHandle | null>(null);
  const [paused, setPaused] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [claim, setClaim] = useState<ClaimPayload | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const hasStartedPlaybackRef = useRef(false);
  const trackChangeSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const host = hostStore.get();
    if (!host || host.roomCode !== code) {
      nav('/');
      return;
    }
    const socket = getSocket();

    function attach() {
      setConnectStatus('connecting');
      emitAck<{ ok: boolean; snapshot?: RoomSnapshot; error?: string }>(
        'host:resume',
        { roomCode: code, hostToken: host!.hostToken },
      ).then((res) => {
        if (!res.ok || !res.snapshot) {
          hostStore.clear();
          nav('/');
          return;
        }
        setSnapshot(res.snapshot);
        setConnectStatus('connected');
        if (res.snapshot.playedTrackIds.length > 0) {
          getSocket().emit('host:track-meta',
            { roomCode: code, trackIds: res.snapshot.playedTrackIds },
            (r: { ok: boolean; tracks?: TrackInfo[] }) => {
              if (r.ok && r.tracks) mergeTrackMeta(r.tracks);
            });
        }
      }).catch(() => setConnectStatus('disconnected'));
    }

    if (socket.connected) attach();
    socket.on('connect', attach);
    socket.on('disconnect', () => setConnectStatus('disconnected'));

    const onPlayerJoined = ({ player }: { player: PlayerPublic }) => {
      setSnapshot((s) => s ? { ...s, players: [...s.players.filter(x => x.id !== player.id), player] } : s);
    };
    const onPlayers = ({ players }: { players: PlayerPublic[] }) => {
      setSnapshot((s) => s ? { ...s, players } : s);
    };
    const onGoal = ({ currentGoal }: { currentGoal: GoalValue }) => {
      setSnapshot((s) => s ? { ...s, currentGoal } : s);
    };
    const onTrackChanged = ({ track }: { track: TrackInfo }) => {
      mergeTrackMeta([track]);
      setSnapshot((s) => s ? {
        ...s,
        currentTrackId: track.id,
        playedTrackIds: Array.from(new Set([...s.playedTrackIds, track.id])),
      } : s);
    };
    const onClaim = (payload: ClaimPayload) => setClaim(payload);
    const onConfirmed = () => setClaim(null);
    const onStarted = ({ snapshot: snap }: { snapshot: RoomSnapshot }) => setSnapshot(snap);
    const onEnded = () => setSnapshot((s) => s ? { ...s, status: 'ended' } : s);

    socket.on('room:player-joined', onPlayerJoined);
    socket.on('room:players', onPlayers);
    socket.on('room:goal-changed', onGoal);
    socket.on('room:track-changed', onTrackChanged);
    socket.on('room:claim', onClaim);
    socket.on('room:bingo-confirmed', onConfirmed);
    socket.on('room:claim-rejected', onConfirmed);
    socket.on('room:started', onStarted);
    socket.on('room:ended', onEnded);

    return () => {
      socket.off('connect', attach);
      socket.off('room:player-joined', onPlayerJoined);
      socket.off('room:players', onPlayers);
      socket.off('room:goal-changed', onGoal);
      socket.off('room:track-changed', onTrackChanged);
      socket.off('room:claim', onClaim);
      socket.off('room:bingo-confirmed', onConfirmed);
      socket.off('room:claim-rejected', onConfirmed);
      socket.off('room:started', onStarted);
      socket.off('room:ended', onEnded);
    };
  }, [code, nav]);

  function mergeTrackMeta(tracks: TrackInfo[]) {
    setTrackMeta((m) => {
      const next = new Map(m);
      for (const t of tracks) next.set(t.id, t);
      return next;
    });
  }

  useEffect(() => {
    const joinUrl = `${globalThis.location.origin}/join?code=${code}`;
    QRCode.toDataURL(joinUrl, { margin: 1, scale: 6 }).then(setQrUrl).catch(() => setQrUrl(null));
  }, [code]);

  useEffect(() => {
    if (!spotifyStore.get()) return;
    let cancelled = false;
    let created: PlayerHandle | null = null;
    setupPlayer({
      onTrackChange: (t) => {
        setCurrentTrack(t);
        mergeTrackMeta([t]);
        if (trackChangeSentRef.current.has(t.id)) return;
        trackChangeSentRef.current.add(t.id);
        getSocket().emit('host:track-changed', { roomCode: code, trackId: t.id });
      },
      onStateChange: (state) => {
        if (state) setPaused(state.paused);
      },
      onFatal: (reason: FatalReason, message: string) => {
        setFatal(messageForFatal(reason, message));
      },
    }).then((h) => {
      if (cancelled) {
        h.player.disconnect();
        return;
      }
      created = h;
      setPlayerHandle(h);
    }).catch((e) => {
      setFatal(e instanceof Error ? e.message : 'Failed to set up Spotify player');
    });
    return () => {
      cancelled = true;
      created?.player.disconnect();
    };
  }, [code]);

  async function handleStart() {
    if (!playerHandle) {
      setFatal('Spotify player is not ready yet.');
      return;
    }
    try { await transferPlaybackTo(playerHandle.deviceId); } catch { /* fall through */ }
    const res = await emitAck<{ ok: boolean; error?: string }>('host:start', { roomCode: code });
    if (!res.ok) setFatal(res.error ?? 'Could not start');
  }

  async function handlePlay() {
    if (!playerHandle) return;
    if (!hasStartedPlaybackRef.current) {
      try {
        const res = await emitAck<{ ok: boolean; uris?: string[] }>(
          'host:get-track-uris', { roomCode: code },
        );
        if (!res.ok || !res.uris?.length) {
          setFatal('Could not fetch track list');
          return;
        }
        await transferPlaybackTo(playerHandle.deviceId);
        await startPlayback(playerHandle.deviceId, res.uris);
        hasStartedPlaybackRef.current = true;
      } catch (e) {
        setFatal(e instanceof Error ? e.message : 'Could not start playback');
      }
    } else {
      await playerHandle.player.togglePlay();
    }
  }

  async function handleValidate(accept: boolean) {
    if (!claim) return;
    await emitAck<{ ok: boolean }>('host:validate-claim', {
      roomCode: code, playerId: claim.playerId, accept,
    });
    setClaim(null);
  }

  if (!snapshot) {
    return <div className="mt-10 text-center text-muted">Loading room…</div>;
  }

  return (
    <div className="mt-4 space-y-4">
      {connectStatus !== 'connected' && (
        <div className="text-xs text-muted text-center">Reconnecting…</div>
      )}
      {fatal && (
        <GlassCard className="!border-danger/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-danger text-sm">{fatal}</div>
            <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setFatal(null)}>Dismiss</button>
          </div>
        </GlassCard>
      )}

      {snapshot.status === 'lobby' && (
        <LobbyView code={code} players={snapshot.players} qrUrl={qrUrl} onStart={handleStart} />
      )}

      {snapshot.status === 'playing' && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <GoalBadge goal={snapshot.currentGoal} />
            <div className="text-xs text-muted">Room <span className="font-mono">{code}</span></div>
          </div>
          <NowPlaying
            trackName={currentTrack?.name}
            artists={currentTrack?.artists}
            paused={paused}
            onTogglePlay={handlePlay}
            onNext={() => playerHandle?.player.nextTrack()}
            onPrev={() => playerHandle?.player.previousTrack()}
          />
          <GlassCard>
            <h3 className="font-semibold mb-2">Players</h3>
            <PlayerList players={snapshot.players} />
          </GlassCard>
        </>
      )}

      {snapshot.status === 'ended' && (
        <GlassCard>
          <h2 className="headline text-2xl mb-2">Game over!</h2>
          <PlayerList players={snapshot.players.slice().sort((a, b) => b.bingos - a.bingos)} />
        </GlassCard>
      )}

      {claim && (
        <ClaimModal
          claim={claim}
          trackMeta={trackMeta}
          onAccept={() => handleValidate(true)}
          onReject={() => handleValidate(false)}
        />
      )}
    </div>
  );
}

function messageForFatal(reason: FatalReason, message: string) {
  if (reason === 'account') return 'Spotify Premium is required to play music in the browser.';
  if (reason === 'auth') return 'Spotify authentication failed. Reconnect Spotify and try again.';
  return `Spotify player error: ${message}`;
}

interface LobbyProps {
  readonly code: string;
  readonly players: PlayerPublic[];
  readonly qrUrl: string | null;
  readonly onStart: () => void;
}

function LobbyView({ code, players, qrUrl, onStart }: LobbyProps) {
  return (
    <div className="space-y-4">
      <GlassCard className="text-center">
        <div className="text-xs uppercase tracking-widest text-muted mb-1">Room code</div>
        <div className="font-mono text-5xl sm:text-6xl tracking-[0.3em] headline">{code}</div>
        <button
          type="button"
          className="btn btn-ghost mt-3"
          onClick={() => {
            navigator.clipboard?.writeText(`${globalThis.location.origin}/join?code=${code}`).catch(() => {});
          }}
        >
          Copy join link
        </button>
        {qrUrl && (
          <div className="mt-4 flex justify-center">
            <img src={qrUrl} alt="Join QR code" className="rounded-lg bg-white p-2 w-40 h-40" />
          </div>
        )}
      </GlassCard>
      <GlassCard>
        <h3 className="font-semibold mb-3">Players ({players.length})</h3>
        <PlayerList players={players} />
      </GlassCard>
      <button type="button" className="btn btn-primary w-full" onClick={onStart} disabled={players.length === 0}>
        Start game
      </button>
    </div>
  );
}

interface ClaimProps {
  readonly claim: ClaimPayload;
  readonly trackMeta: Map<string, TrackInfo>;
  readonly onAccept: () => void;
  readonly onReject: () => void;
}

function ClaimModal({ claim, trackMeta, onAccept, onReject }: ClaimProps) {
  const highlighted = useMemo(() => {
    const s = new Set<number>();
    claim.validLines.forEach((li) => DISPLAY_LINES[li].forEach((idx) => s.add(idx)));
    return s;
  }, [claim.validLines]);

  const goalText =
    claim.currentGoal === 'full'
      ? 'full board'
      : `${claim.currentGoal} line${claim.currentGoal === 1 ? '' : 's'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/40 backdrop-blur-sm">
      <div className="glass-surface rounded-2xl p-4 w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{claim.name} claims BINGO</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${claim.isValid ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {claim.isValid ? 'Looks valid' : 'Not valid yet'}
          </span>
        </div>
        <div className="text-xs text-muted mb-3">
          Valid lines: {claim.validLines.length} · Goal: {goalText}
        </div>
        <BingoBoard
          board={claim.board}
          marks={claim.marks as SquareState[]}
          trackMeta={trackMeta}
          highlightedIndices={highlighted}
          disabled
        />
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" className="btn btn-ghost" onClick={onReject}>Reject</button>
          <button type="button" className="btn btn-primary" onClick={onAccept} disabled={!claim.isValid}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
