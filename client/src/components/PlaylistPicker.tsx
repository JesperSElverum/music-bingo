import { useEffect, useState } from 'react';
import { getPlaylists, SpotifyPlaylist } from '../lib/api';

interface Props {
  onPick: (p: SpotifyPlaylist) => void;
  disabled?: boolean;
}

export default function PlaylistPicker({ onPick, disabled }: Props) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getPlaylists()
      .then((p) => { if (!cancelled) setPlaylists(p); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="text-danger">Failed to load playlists: {error}</div>;
  if (!playlists) return <div className="text-muted">Loading your playlists…</div>;

  const filtered = playlists.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <input
        className="input"
        placeholder="Search playlists…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {filtered.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(p)}
              className="w-full text-left glass-surface rounded-xl p-3 flex items-center gap-3 hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {p.image ? (
                <img src={p.image} alt="" className="w-12 h-12 rounded-md object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-surface-2" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted truncate">
                  {p.owner ?? 'Unknown'}
                  {p.trackCount > 0 && ` · ${p.trackCount} tracks`}
                </div>
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-sm text-muted px-2">No playlists match.</li>
        )}
      </ul>
    </div>
  );
}
