import { useMemo } from 'react';
import Square from './Square';
import { SquareState, TrackInfo } from '../lib/types';

interface Props {
  board: string[];
  marks: SquareState[];
  trackMeta: Map<string, TrackInfo>;
  highlightedIndices?: Set<number>;
  onSquareClick?: (index: number) => void;
  disabled?: boolean;
}

export default function BingoBoard({
  board, marks, trackMeta, highlightedIndices, onSquareClick, disabled,
}: Props) {
  const cells = useMemo(() => board.map((trackId, idx) => {
    const meta = trackMeta.get(trackId);
    return (
      <Square
        key={idx}
        trackId={trackId}
        title={meta?.name}
        artists={meta?.artists.join(', ')}
        state={marks[idx]}
        highlighted={highlightedIndices?.has(idx)}
        onClick={() => onSquareClick?.(idx)}
        disabled={disabled}
      />
    );
  }), [board, marks, trackMeta, highlightedIndices, onSquareClick, disabled]);

  return <div className="grid grid-cols-5 gap-1.5 sm:gap-2">{cells}</div>;
}
