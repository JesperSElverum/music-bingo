export const FREE_CELL = '__FREE__';
export const BOARD_SIZE = 5;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const CENTER_INDEX = 12;
export const NON_FREE_NEEDED = CELL_COUNT - 1;

const LINES = (() => {
  const lines = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    lines.push(Array.from({ length: BOARD_SIZE }, (_, c) => r * BOARD_SIZE + c));
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    lines.push(Array.from({ length: BOARD_SIZE }, (_, r) => r * BOARD_SIZE + c));
  }
  lines.push(Array.from({ length: BOARD_SIZE }, (_, i) => i * BOARD_SIZE + i), Array.from({ length: BOARD_SIZE }, (_, i) => i * BOARD_SIZE + (BOARD_SIZE - 1 - i)));
  return lines;
})();

export function getLines() {
  return LINES;
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateBoard(trackIds) {
  if (trackIds.length < NON_FREE_NEEDED) {
    throw new Error(`Need at least ${NON_FREE_NEEDED} tracks, got ${trackIds.length}`);
  }
  const picked = shuffle(trackIds).slice(0, NON_FREE_NEEDED);
  const board = [];
  let pickedIdx = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (i === CENTER_INDEX) board.push(FREE_CELL);
    else board.push(picked[pickedIdx++]);
  }
  return board;
}

export function makeInitialMarks() {
  const marks = new Array(CELL_COUNT).fill('empty');
  marks[CENTER_INDEX] = 'marked';
  return marks;
}

export function findValidBingoLines(player, playedTrackIds) {
  const { board, marks } = player;
  const valid = [];
  for (let li = 0; li < LINES.length; li++) {
    const line = LINES[li];
    let ok = true;
    for (const idx of line) {
      if (marks[idx] !== 'marked') { ok = false; break; }
      const tid = board[idx];
      if (tid === FREE_CELL) continue;
      if (!playedTrackIds.has(tid)) { ok = false; break; }
    }
    if (ok) valid.push(li);
  }
  return valid;
}

export function isFullBoardValid(player, playedTrackIds) {
  const { board, marks } = player;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (marks[i] !== 'marked') return false;
    if (board[i] === FREE_CELL) continue;
    if (!playedTrackIds.has(board[i])) return false;
  }
  return true;
}

export function goalThreshold(currentGoal) {
  // 1,2,3,4 means "at least N completed lines"; 'full' is special.
  return currentGoal === 'full' ? null : currentGoal;
}

export function nextGoal(currentGoal) {
  if (currentGoal === 1) return 2;
  if (currentGoal === 2) return 3;
  if (currentGoal === 3) return 4;
  if (currentGoal === 4) return 'full';
  return 'full';
}
