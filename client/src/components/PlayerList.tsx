import { PlayerPublic } from '../lib/types';

interface Props {
  players: PlayerPublic[];
}

export default function PlayerList({ players }: Props) {
  if (players.length === 0) {
    return (
      <div className="text-muted text-sm italic">No players yet. Share the room code!</div>
    );
  }
  return (
    <ul className="space-y-2">
      {players.map((p) => (
        <li key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-surface/40 border border-border/40">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-success' : 'bg-muted/60'}`} />
            <span className="font-medium">{p.name}</span>
          </span>
          <span className="text-xs text-muted">
            {p.bingos > 0 ? `${p.bingos} bingo${p.bingos > 1 ? 's' : ''}` : '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}
