interface Props {
  trackName?: string | null;
  artists?: string[];
  paused: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function NowPlaying({ trackName, artists, paused, onTogglePlay, onNext, onPrev }: Props) {
  return (
    <div className="glass-surface rounded-2xl p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted">Now playing</div>
        {trackName ? (
          <>
            <div className="font-semibold truncate">{trackName}</div>
            <div className="text-sm text-muted truncate">{artists?.join(', ')}</div>
          </>
        ) : (
          <div className="text-sm text-muted">Press play to start the playlist</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" className="btn btn-ghost !py-2 !px-3" onClick={onPrev} aria-label="Previous">⏮</button>
        <button type="button" className="btn btn-primary !py-2 !px-4" onClick={onTogglePlay} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? '▶' : '⏸'}
        </button>
        <button type="button" className="btn btn-ghost !py-2 !px-3" onClick={onNext} aria-label="Next">⏭</button>
      </div>
    </div>
  );
}
