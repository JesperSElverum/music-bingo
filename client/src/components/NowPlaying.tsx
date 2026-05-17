interface Props {
  trackName?: string | null;
  artists?: string[];
  paused: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true as const,
};

function PrevIcon() {
  return (
    <svg className="w-5 h-5" {...iconProps}>
      <path d="M6 5h2v14H6zM20 5v14L9 12z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg className="w-5 h-5" {...iconProps}>
      <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-5 h-5" {...iconProps}>
      <path d="M7 4v16l13-8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" {...iconProps}>
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
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
        <button type="button" className="btn btn-ghost !py-2 !px-3" onClick={onPrev} aria-label="Previous">
          <PrevIcon />
        </button>
        <button type="button" className="btn btn-primary !py-2 !px-4" onClick={onTogglePlay} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button type="button" className="btn btn-ghost !py-2 !px-3" onClick={onNext} aria-label="Next">
          <NextIcon />
        </button>
      </div>
    </div>
  );
}
