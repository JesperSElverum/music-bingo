import { GoalValue, goalLabel } from '../lib/types';

export default function GoalBadge({ goal }: { goal: GoalValue }) {
  return (
    <div className="glass-surface rounded-full px-4 py-2 inline-flex items-center gap-2 text-sm">
      <span className="opacity-70">Current goal:</span>
      <span className="font-semibold tracking-tight">{goalLabel(goal)}</span>
    </div>
  );
}
