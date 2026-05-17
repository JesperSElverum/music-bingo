import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import { emitAck, getSocket } from '../lib/socket';
import { playerStore } from '../lib/storage';
import { RoomSnapshot } from '../lib/types';

export default function JoinGame() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    getSocket(); // ensure connection
    try {
      const res = await emitAck<{
        ok: boolean; error?: string;
        playerId?: string; playerToken?: string; snapshot?: RoomSnapshot;
      }>('player:join', { roomCode: code.trim().toUpperCase(), name: name.trim() });
      if (!res.ok || !res.playerId || !res.playerToken) {
        setErr(res.error ?? 'Could not join');
        setBusy(false);
        return;
      }
      playerStore.set({
        roomCode: code.trim().toUpperCase(),
        playerToken: res.playerToken,
        playerId: res.playerId,
        name: name.trim(),
      });
      nav(`/play/${code.trim().toUpperCase()}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unknown error');
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 max-w-md mx-auto">
      <GlassCard>
        <h2 className="headline text-2xl mb-4">Join a game</h2>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm">
            Room code
            <input
              className="input mt-1 tracking-[0.4em] uppercase font-mono"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </label>
          <label className="text-sm">
            Your name
            <input
              className="input mt-1"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          {err && <div className="text-danger text-sm">{err}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Joining…' : 'Join'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
