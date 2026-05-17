import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import BingoBoard from '../components/BingoBoard';
import GoalBadge from '../components/GoalBadge';
import { emitAck, getSocket } from '../lib/socket';
import { playerStore } from '../lib/storage';
import {
  FREE_CELL, GoalValue, PlayerBoard, PlayerPublic, RoomSnapshot,
  SquareState, TrackInfo, goalLabel,
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

function cycleState(s: SquareState): SquareState {
  if (s === 'empty') return 'marked';
  if (s === 'marked') return 'possible';
  return 'empty';
}

function countLocalLines(marks: SquareState[]): number {
  let count = 0;
  for (const line of DISPLAY_LINES) {
    if (line.every((i) => marks[i] === 'marked')) count++;
  }
  return count;
}

export default function PlayerRoom() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [board, setBoard] = useState<PlayerBoard | null>(null);
  const [trackMeta, setTrackMeta] = useState<Map<string, TrackInfo>>(new Map());
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [claimFeedback, setClaimFeedback] = useState<'pending' | 'accepted' | 'rejected' | null>(null);
  const myIdRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = playerStore.get();
    if (!stored || stored.roomCode !== code) {
      nav('/');
      return;
    }
    myIdRef.current = stored.playerId;
    const socket = getSocket();

    function attach() {
      setStatus('connecting');
      emitAck<{
        ok: boolean; error?: string;
        snapshot?: RoomSnapshot; board?: PlayerBoard | null; playerId?: string;
      }>('player:resume', { roomCode: code, playerToken: stored!.playerToken })
        .then((res) => {
          if (!res.ok || !res.snapshot) {
            playerStore.clear();
            nav('/');
            return;
          }
          setSnapshot(res.snapshot);
          if (res.board) setBoard(res.board);
          setStatus('connected');
        }).catch(() => setStatus('disconnected'));
    }

    if (socket.connected) attach();
    socket.on('connect', attach);
    socket.on('disconnect', () => setStatus('disconnected'));

    const onPlayers = ({ players }: { players: PlayerPublic[] }) => {
      setSnapshot((s) => s ? { ...s, players } : s);
    };
    const onGoal = ({ currentGoal }: { currentGoal: GoalValue }) => {
      setSnapshot((s) => s ? { ...s, currentGoal } : s);
    };
    const onBoard = (b: PlayerBoard) => setBoard(b);
    const onStarted = ({ snapshot: snap }: { snapshot: RoomSnapshot }) => setSnapshot(snap);
    const onEnded = () => setSnapshot((s) => s ? { ...s, status: 'ended' } : s);
    const onBingoConfirmed = ({ playerId }: { playerId: string }) => {
      if (playerId === myIdRef.current) setClaimFeedback('accepted');
    };
    const onClaimRejected = ({ playerId }: { playerId: string }) => {
      if (playerId === myIdRef.current) setClaimFeedback('rejected');
    };

    socket.on('room:players', onPlayers);
    socket.on('room:goal-changed', onGoal);
    socket.on('player:board', onBoard);
    socket.on('room:started', onStarted);
    socket.on('room:ended', onEnded);
    socket.on('room:bingo-confirmed', onBingoConfirmed);
    socket.on('room:claim-rejected', onClaimRejected);

    return () => {
      socket.off('connect', attach);
      socket.off('room:players', onPlayers);
      socket.off('room:goal-changed', onGoal);
      socket.off('player:board', onBoard);
      socket.off('room:started', onStarted);
      socket.off('room:ended', onEnded);
      socket.off('room:bingo-confirmed', onBingoConfirmed);
      socket.off('room:claim-rejected', onClaimRejected);
    };
  }, [code, nav]);

  useEffect(() => {
    if (claimFeedback === 'accepted' || claimFeedback === 'rejected') {
      const t = setTimeout(() => setClaimFeedback(null), 3500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [claimFeedback]);

  useEffect(() => {
    if (!board) return;
    const need = board.board.filter((id) => id !== FREE_CELL && !trackMeta.has(id));
    if (need.length === 0) return;
    emitAck<{ ok: boolean; tracks?: TrackInfo[] }>(
      'player:track-meta', { roomCode: code, trackIds: need },
    ).then((r) => {
      if (r?.ok && r.tracks) {
        const tracks = r.tracks;
        setTrackMeta((m) => {
          const next = new Map(m);
          for (const t of tracks) next.set(t.id, t);
          return next;
        });
      }
    }).catch(() => {});
  }, [board, code, trackMeta]);

  function handleSquareClick(index: number) {
    if (!board) return;
    if (board.board[index] === FREE_CELL) return;
    const nextState = cycleState(board.marks[index]);
    const nextMarks = board.marks.slice();
    nextMarks[index] = nextState;
    setBoard({ ...board, marks: nextMarks });
    getSocket().emit('player:mark-square', { roomCode: code, index, state: nextState });
  }

  async function handleClaim() {
    if (!board) return;
    setClaimFeedback('pending');
    await emitAck<{ ok: boolean; isValid?: boolean }>('player:claim-bingo', { roomCode: code });
  }

  const canClaim = useMemo(() => {
    if (!board || !snapshot) return false;
    if (snapshot.status !== 'playing') return false;
    const lineCount = countLocalLines(board.marks);
    if (snapshot.currentGoal === 'full') {
      return board.marks.every((m) => m === 'marked');
    }
    return lineCount >= (snapshot.currentGoal as number);
  }, [board, snapshot]);

  if (!snapshot) {
    return <div className="mt-10 text-center text-muted">Loading…</div>;
  }

  if (snapshot.status === 'lobby') {
    return (
      <div className="mt-6 max-w-md mx-auto space-y-4">
        <GlassCard className="text-center">
          <div className="text-xs uppercase tracking-widest text-muted mb-1">Room</div>
          <div className="font-mono text-3xl tracking-[0.3em]">{code}</div>
          <p className="text-sm text-muted mt-3">Waiting for the host to start the game…</p>
        </GlassCard>
        <GlassCard>
          <h3 className="font-semibold mb-2">Players ({snapshot.players.length})</h3>
          <ul className="space-y-1 text-sm">
            {snapshot.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-success' : 'bg-muted/60'}`} />
                <span>{p.name}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    );
  }

  if (snapshot.status === 'ended') {
    return (
      <div className="mt-6 max-w-md mx-auto space-y-4">
        <GlassCard>
          <h2 className="headline text-2xl mb-2">Game over!</h2>
          <ul className="space-y-1 text-sm">
            {snapshot.players.slice().sort((a, b) => b.bingos - a.bingos).map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-muted">{p.bingos} bingo{p.bingos === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 pb-24">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <GoalBadge goal={snapshot.currentGoal} />
        {status !== 'connected' && (
          <span className="text-xs text-muted">Reconnecting…</span>
        )}
      </div>
      {board ? (
        <BingoBoard
          board={board.board}
          marks={board.marks}
          trackMeta={trackMeta}
          onSquareClick={handleSquareClick}
        />
      ) : (
        <div className="text-muted text-sm">Waiting for your board…</div>
      )}

      <div className="fixed bottom-0 inset-x-0 px-4 pb-4 pt-3 bg-gradient-to-t from-bg via-bg/85 to-transparent">
        <div className="max-w-md mx-auto">
          {claimFeedback === 'accepted' && (
            <div className="text-center text-success text-sm mb-2 animate-pulse-glow rounded-full px-3 py-1">
              Bingo confirmed!
            </div>
          )}
          {claimFeedback === 'rejected' && (
            <div className="text-center text-danger text-sm mb-2 rounded-full px-3 py-1">
              Host rejected the claim
            </div>
          )}
          <button
            type="button"
            disabled={!canClaim || claimFeedback === 'pending'}
            onClick={handleClaim}
            className="btn btn-primary w-full !text-lg !py-4 tracking-wider"
          >
            {claimFeedback === 'pending' ? 'Sending…' : `BINGO! (${goalLabel(snapshot.currentGoal)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
