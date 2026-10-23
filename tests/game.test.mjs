import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLANK,
  createRng,
  formatTime,
  isSolvable,
  isSolved,
  legalMoves,
  moveInDirection,
  moveTile,
  readBest,
  shuffleBoard,
  solvedBoard,
  writeBest,
} from '../js/game.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('solved board has the blank last for every size', () => {
  assert.deepEqual(solvedBoard(3), [1, 2, 3, 4, 5, 6, 7, 8, BLANK]);
  assert.deepEqual(solvedBoard(2), [1, 2, 3, BLANK]);
  assert.equal(isSolved(solvedBoard(4)), true);
});

test('solved detection rejects a displaced tile', () => {
  const board = solvedBoard(3);
  [board[0], board[1]] = [board[1], board[0]];
  assert.equal(isSolved(board), false);
});

test('only tiles next to the blank can move', () => {
  const board = solvedBoard(3);
  assert.equal(moveTile(board, 4, 3), false, 'center tile is diagonal');
  assert.equal(moveTile(board, 5, 3), true, 'tile above the blank slides down');
  assert.deepEqual(board, [1, 2, 3, 4, 5, BLANK, 7, 8, 6]);
  assert.equal(moveTile(board, 0, 3), false);
  assert.equal(moveTile(board, 4, 3), true, 'tile left of the blank slides right');
  assert.deepEqual(board, [1, 2, 3, 4, BLANK, 5, 7, 8, 6]);
  assert.deepEqual(legalMoves(board, 3).sort((a, b) => a - b), [1, 3, 5, 7]);
});

test('direction keys move the empty space', () => {
  const board = solvedBoard(3);
  assert.equal(moveInDirection(board, 'up', 3), 5);
  assert.deepEqual(board, [1, 2, 3, 4, 5, BLANK, 7, 8, 6]);
  assert.equal(moveInDirection(board, 'left', 3), 4);
  assert.deepEqual(board, [1, 2, 3, 4, BLANK, 5, 7, 8, 6]);
  assert.equal(moveInDirection(board, 'diagonal', 3), null);
});

test('shuffle produces a solvable, non-solved permutation', () => {
  for (const size of [3, 4, 5]) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const board = shuffleBoard(size, createRng(seed));
      assert.equal(board.length, size * size);
      assert.deepEqual([...board].sort((a, b) => a - b), Array.from({ length: size * size }, (_, i) => i));
      assert.equal(isSolved(board), false);
      assert.equal(isSolvable(board, size), true);
    }
  }
});

test('shuffle is deterministic for a given seed', () => {
  assert.deepEqual(shuffleBoard(4, createRng(42)), shuffleBoard(4, createRng(42)));
});

test('time formatting is stable and clamps negatives', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(999), '00:00');
  assert.equal(formatTime(61_000), '01:01');
  assert.equal(formatTime(3_599_000), '59:59');
  assert.equal(formatTime(-500), '00:00');
});

test('best results keep the fewest moves then the fastest time', () => {
  const storage = memoryStorage();
  assert.equal(readBest(storage, 4), null);
  assert.equal(writeBest(storage, 4, { moves: 120, time: 90_000 }), true);
  assert.equal(writeBest(storage, 4, { moves: 140, time: 40_000 }), false);
  assert.equal(writeBest(storage, 4, { moves: 120, time: 70_000 }), true);
  assert.deepEqual(readBest(storage, 4), { moves: 120, time: 70_000 });
  assert.equal(readBest(storage, 3), null);
});
