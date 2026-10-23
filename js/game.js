export const BLANK = 0;

export const DIFFICULTIES = [
  { size: 3, key: 'easy', label: 'سهل', detail: '٣ × ٣' },
  { size: 4, key: 'medium', label: 'متوسط', detail: '٤ × ٤' },
  { size: 5, key: 'hard', label: 'صعب', detail: '٥ × ٥' },
];

export function solvedBoard(size) {
  assertSize(size);
  const total = size * size;
  const board = new Array(total - 1);
  for (let i = 0; i < total - 1; i += 1) board[i] = i + 1;
  board.push(BLANK);
  return board;
}

export function isSolved(board) {
  for (let i = 0; i < board.length - 1; i += 1) {
    if (board[i] !== i + 1) return false;
  }
  return board[board.length - 1] === BLANK;
}

export function blankIndex(board) {
  return board.indexOf(BLANK);
}

export function isAdjacent(a, b, size) {
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

export function canMove(board, index, size) {
  if (index < 0 || index >= board.length) return false;
  if (board[index] === BLANK) return false;
  return isAdjacent(index, blankIndex(board), size);
}

export function legalMoves(board, size) {
  const blank = blankIndex(board);
  const moves = [];
  const row = Math.floor(blank / size);
  const col = blank % size;
  if (row > 0) moves.push(blank - size);
  if (row < size - 1) moves.push(blank + size);
  if (col > 0) moves.push(blank - 1);
  if (col < size - 1) moves.push(blank + 1);
  return moves;
}

export function moveTile(board, index, size) {
  if (!canMove(board, index, size)) return false;
  const blank = blankIndex(board);
  board[blank] = board[index];
  board[index] = BLANK;
  return true;
}

export function moveInDirection(board, direction, size) {
  const offsets = {
    up: -size,
    down: size,
    left: -1,
    right: 1,
  };
  const offset = offsets[direction];
  if (offset === undefined) return null;
  const blank = blankIndex(board);
  const target = blank + offset;
  const row = Math.floor(target / size);
  const blankRow = Math.floor(blank / size);
  const col = target % size;
  const blankCol = blank % size;
  if (target < 0 || target >= board.length) return null;
  if (Math.abs(row - blankRow) + Math.abs(col - blankCol) !== 1) return null;
  moveTile(board, target, size);
  return target;
}

export function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleBoard(size, rng = Math.random, steps) {
  assertSize(size);
  const board = solvedBoard(size);
  const walk = steps ?? size * size * 12;
  let previous = -1;
  let performed = 0;
  let guard = 0;
  while (performed < walk && guard < walk * 30) {
    guard += 1;
    const moves = legalMoves(board, size).filter((index) => index !== previous);
    if (moves.length === 0) continue;
    const index = moves[Math.floor(rng() * moves.length)];
    previous = blankIndex(board);
    moveTile(board, index, size);
    performed += 1;
  }
  if (isSolved(board)) return shuffleBoard(size, rng, steps);
  return board;
}

export function permutationParity(board) {
  const values = board.filter((value) => value !== BLANK);
  let inversions = 0;
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (values[i] > values[j]) inversions += 1;
    }
  }
  return inversions % 2;
}

export function isSolvable(board, size) {
  const blank = blankIndex(board);
  const blankRowFromBottom = size - Math.floor(blank / size);
  if (size % 2 === 1) return permutationParity(board) === 0;
  return (permutationParity(board) + blankRowFromBottom) % 2 === 1;
}

export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function bestKey(size) {
  return `imagePuzzle.best.${size}`;
}

export function readBest(storage, size) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(bestKey(size));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.moves !== 'number' || typeof parsed?.time !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isBetter(candidate, current) {
  if (!current) return true;
  if (candidate.moves !== current.moves) return candidate.moves < current.moves;
  return candidate.time < current.time;
}

export function writeBest(storage, size, result) {
  if (!storage) return false;
  if (!isBetter(result, readBest(storage, size))) return false;
  try {
    storage.setItem(bestKey(size), JSON.stringify(result));
    return true;
  } catch {
    return false;
  }
}

export function progressOf(board, size) {
  let correct = 0;
  for (let i = 0; i < board.length - 1; i += 1) {
    if (board[i] === i + 1) correct += 1;
  }
  return correct / (size * size - 1);
}

function assertSize(size) {
  if (!Number.isInteger(size) || size < 2) throw new Error(`Invalid board size: ${size}`);
}
