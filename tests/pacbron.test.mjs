import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../dist/games/pacbron.js', import.meta.url), 'utf8');
const { createMaze, isOpen, distanceMap, legalMoves, createGame, COLS, ROWS } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const maze = createMaze();
assert.equal(maze.length, ROWS);
assert(maze.every(row => row.length === COLS));
const open = maze.flat().filter(v => v === 0).length;
assert.equal(distanceMap(maze, 1, ROWS - 2).size, open, 'Every pellet must be reachable');
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isOpen(maze, x, y)) {
  assert(legalMoves(maze, x, y).length > 0, 'No isolated tiles');
  for (const [, [dx, dy]] of legalMoves(maze, x, y)) assert(isOpen(maze, x + dx, y + dy));
}
assert.deepEqual(createMaze(), createMaze(), 'Maze should be reproducible');
const statuses = []; let result;
const game = createGame({ difficulty:'normal', updateHUD:h => statuses.push(h), finish:r => result=r });
assert.match(statuses[0].status, /3 lives/);
game.action('up', true);
for (let frame=0; frame<1800; frame++) game.update(1/60);
assert(statuses.every(h => Number.isFinite(h.score)));
assert(statuses.some(h => h.score > 0), 'Movement collects basketballs');
game.destroy();
const before = statuses.length; game.update(1); assert.equal(statuses.length,before,'Destroyed game cannot update');
console.log(`PacBron tests passed: ${open} reachable tiles, valid navigation, gameplay scoring, lifecycle.`);
