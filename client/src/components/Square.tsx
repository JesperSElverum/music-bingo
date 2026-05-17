import { SquareState, FREE_CELL } from '../lib/types';

interface Props {
  trackId: string;
  title?: string;
  artists?: string;
  state: SquareState;
  highlighted?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const stateClass: Record<SquareState, string> = {
  empty: 'bg-surface/40 border-border/40 text-text/85',
  possible:
    'bg-accent/15 border-dashed border-accent/70 text-text shadow-[inset_0_0_18px_rgb(var(--c-accent)/0.20)]',
  marked:
    'bg-gradient-to-br from-accent to-accent-2 text-white border-transparent shadow-glow',
};

export default function Square({
  trackId, title, artists, state, highlighted, onClick, disabled,
}: Props) {
  const isFree = trackId === FREE_CELL;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'relative aspect-square rounded-xl border p-1.5 text-[10px] sm:text-xs leading-tight overflow-hidden',
        'transition-all duration-150 active:scale-[0.96] select-none',
        'flex flex-col items-stretch justify-between',
        isFree ? stateClass.marked : stateClass[state],
        highlighted ? 'ring-2 ring-accent-2 ring-offset-1 ring-offset-bg' : '',
        disabled ? 'opacity-70 cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      {isFree ? (
        <span className="m-auto font-semibold tracking-wide uppercase text-[11px] sm:text-sm">
          FREE
        </span>
      ) : (
        <>
          <span className="font-semibold line-clamp-2 break-words">{title}</span>
          <span className="opacity-80 line-clamp-2 break-words">{artists}</span>
        </>
      )}
      {state === 'marked' && !isFree && (
        <span className="absolute right-1 top-1 text-xs">✓</span>
      )}
      {state === 'possible' && !isFree && (
        <span className="absolute right-1 top-1 text-xs opacity-75">?</span>
      )}
    </button>
  );
}
