import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import PlaylistPicker from '../components/PlaylistPicker';
import { spotifyStore } from '../lib/storage';
import { getPlaylistTracks, SpotifyPlaylist } from '../lib/api';
import { hostStore } from '../lib/storage';
import { emitAck, getSocket } from '../lib/socket';
import { RoomSnapshot } from '../lib/types';

type Phase = 'connect' | 'pick' | 'creating';

export default function CreateGame() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('connect');
  const [error, setError] = useState<string | null>(null);

  // Pick up OAuth callback redirect params
  useEffect(() => {
    const err = params.get('error');
    if (err) {
      setError(`Spotify error: ${err}`);
      const next = new URLSearchParams(params);
      next.delete('error');
      setParams(next, { replace: true });
      return;
    }
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');
    if (accessToken && refreshToken && expiresIn) {
      spotifyStore.set({
        accessToken,
        refreshToken,
        expiresAt: Date.now() + parseInt(expiresIn, 10) * 1000,
      });
      setPhase('pick');
      const next = new URLSearchParams(params);
      next.delete('access_token');
      next.delete('refresh_token');
      next.delete('expires_in');
      setParams(next, { replace: true });
    } else if (spotifyStore.get()) {
      setPhase('pick');
    }
  }, [params, setParams]);

  async function handlePick(p: SpotifyPlaylist) {
    setPhase('creating');
    setError(null);
    try {
      const tracks = await getPlaylistTracks(p.id);
      if (tracks.length < 24) {
        setError(`Playlist has only ${tracks.length} playable tracks; need at least 24.`);
        setPhase('pick');
        return;
      }
      getSocket();
      const res = await emitAck<{
        ok: boolean; error?: string;
        roomCode?: string; hostToken?: string; snapshot?: RoomSnapshot;
      }>('host:create', {
        tracks,
        spotifyPlaylistId: p.id,
        playlistName: p.name,
      });
      if (!res.ok || !res.roomCode || !res.hostToken) {
        setError(res.error ?? 'Could not create room');
        setPhase('pick');
        return;
      }
      hostStore.set({ roomCode: res.roomCode, hostToken: res.hostToken });
      nav(`/host/${res.roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setPhase('pick');
    }
  }

  return (
    <div className="mt-6 max-w-lg mx-auto space-y-4">
      <GlassCard>
        <h2 className="headline text-2xl mb-3">Create a game</h2>
        {phase === 'connect' && (
          <>
            <p className="text-sm text-muted mb-4">
              Connect your Spotify account (Premium required) to choose a playlist.
            </p>
            {error && <div className="text-danger text-sm mb-3">{error}</div>}
            <a href="/api/spotify/login" className="btn btn-primary w-full">
              Connect Spotify
            </a>
          </>
        )}
        {(phase === 'pick' || phase === 'creating') && (
          <>
            <p className="text-sm text-muted mb-3">
              Pick a playlist. It needs at least 24 playable tracks.
            </p>
            {error && <div className="text-danger text-sm mb-3">{error}</div>}
            <PlaylistPicker onPick={handlePick} disabled={phase === 'creating'} />
            <button
              type="button"
              className="btn btn-ghost w-full mt-3"
              onClick={() => {
                spotifyStore.clear();
                setPhase('connect');
              }}
            >
              Disconnect Spotify
            </button>
          </>
        )}
      </GlassCard>
    </div>
  );
}
