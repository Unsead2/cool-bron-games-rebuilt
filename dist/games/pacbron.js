/** PacBron — deterministic grid movement, buffered turns and breadth-first ghost navigation. */
export const COLS = 25;
export const ROWS = 17;
const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const COLORS = ['#ff7994', '#65e6ed', '#bc9bff', '#ffba63'];
const key = (x, y) => `${x},${y}`;

export function createMaze(seed = 23) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const stack = [[1, 1]];
  grid[1][1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = Object.values(DIRECTIONS).filter(([dx, dy]) => {
      const nx = x + dx * 2, ny = y + dy * 2;
      return nx > 0 && nx < COLS - 1 && ny > 0 && ny < ROWS - 1 && grid[ny][nx] === 1;
    });
    if (!next.length) { stack.pop(); continue; }
    const [dx, dy] = next[Math.floor(random() * next.length)];
    grid[y + dy][x + dx] = grid[y + dy * 2][x + dx * 2] = 0;
    stack.push([x + dx * 2, y + dy * 2]);
  }
  // Add loops to give players escape routes, never creating disconnected pockets.
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[y][x] && ((x % 2 === 0 && y % 2 === 1) || (x % 2 === 1 && y % 2 === 0)) && random() < .22) grid[y][x] = 0;
    }
  }
  return grid;
}
export function isOpen(grid, x, y) { return grid[y]?.[x] === 0; }
export function distanceMap(grid, targetX, targetY) {
  const distances = new Map([[key(targetX, targetY), 0]]);
  const queue = [[targetX, targetY]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of Object.values(DIRECTIONS)) {
      const nx = x + dx, ny = y + dy, id = key(nx, ny);
      if (isOpen(grid, nx, ny) && !distances.has(id)) {
        distances.set(id, distances.get(key(x, y)) + 1);
        queue.push([nx, ny]);
      }
    }
  }
  return distances;
}
export function legalMoves(grid, x, y) {
  return Object.entries(DIRECTIONS).filter(([, [dx, dy]]) => isOpen(grid, x + dx, y + dy));
}
function actor(x, y, color) { return { x, y, tx: x, ty: y, progress: 0, dir: null, color, idle: true, homeX: x, homeY: y, grace: 0 }; }
function position(a) { return { x: a.x + (a.tx - a.x) * a.progress, y: a.y + (a.ty - a.y) * a.progress }; }

export function createGame(api) {
  const difficulty = { easy: .82, normal: 1, hard: 1.15 }[api.difficulty] || 1;
  const grid = createMaze();
  let pellets, powerPellets, player, ghosts, score = 0, lives = 3, level = 1, time = 0;
  let desired = null, powered = 0, invincible = 2, ended = false, ghostCombo = 0;
  let collected = 0, total = 0, respawnWait = 0, banner = 'Collect every basketball. Gold rings power you up.', bannerTime = 4;
  let hudTime = 0;
  function setHUD() {
    api.updateHUD({ score, status: `${lives} ${lives === 1 ? 'life' : 'lives'} · Level ${level} · ${pellets.size} balls left${powered > 0 ? ` · POWER ${Math.ceil(powered)}s` : ''}` });
  }
  function resetActors() {
    player = actor(1, ROWS - 2, '#f8cf58');
    ghosts = [actor(11, 7, COLORS[0]), actor(13, 7, COLORS[1]), actor(11, 9, COLORS[2]), actor(13, 9, COLORS[3])];
    ghosts.forEach((g, i) => { g.grace = .7 + i * .45; });
    desired = null;
    invincible = 2.4;
    powered = 0;
    ghostCombo = 0;
  }
  function nextLevel() {
    pellets = new Set();
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (isOpen(grid, x, y)) pellets.add(key(x, y));
    powerPellets = new Set([key(1, 1), key(COLS - 2, 1), key(COLS - 2, ROWS - 2), key(1, 9)]);
    resetActors();
    pellets.delete(key(player.x, player.y));
    total = pellets.size;
    collected = 0;
    setHUD();
  }
  function collect() {
    const id = key(player.x, player.y);
    if (!pellets.delete(id)) return;
    collected++;
    score += 10;
    if (powerPellets.delete(id)) {
      powered = Math.max(4.5, 8 - level * .3);
      ghostCombo = 0;
      banner = 'KING MODE — chase the defenders!'; bannerTime = 2;
      api.sound?.('power');
    } else if (collected % 4 === 0) api.sound?.('coin');
    if (!pellets.size) {
      score += 500;
      if (level === 3) { ended = true; api.finish({ score, coins: Math.floor(score / 80), message: 'Court conquered! All three levels cleared.' }); }
      else { level++; banner = `Level ${level} — defenders are getting faster.`; bannerTime = 3; nextLevel(); respawnWait = 1.2; }
    }
    setHUD();
  }
  function choosePlayer() {
    const wanted = DIRECTIONS[desired];
    if (wanted && isOpen(grid, player.x + wanted[0], player.y + wanted[1])) return desired;
    const current = DIRECTIONS[player.dir];
    if (current && isOpen(grid, player.x + current[0], player.y + current[1])) return player.dir;
    return null;
  }
  function chooseGhost(g, index) {
    const options = legalMoves(grid, g.x, g.y);
    const previous = DIRECTIONS[g.dir];
    const forward = options.filter(([, [dx, dy]]) => !previous || dx !== -previous[0] || dy !== -previous[1]);
    const candidates = forward.length ? forward : options;
    const p = position(player);
    // Each defender alternates between chasing and guarding a corner.
    const scatter = Math.floor(time / 10) % 3 === 2;
    const corners = [[1, 1], [COLS - 2, 1], [COLS - 2, ROWS - 2], [1, ROWS - 2]];
    let target = scatter && !powered ? corners[index] : [player.tx, player.ty];
    if (!isOpen(grid, ...target)) target = [Math.round(p.x), Math.round(p.y)];
    const distances = distanceMap(grid, ...target);
    candidates.sort((a, b) => {
      const da = distances.get(key(g.x + a[1][0], g.y + a[1][1])) ?? 999;
      const db = distances.get(key(g.x + b[1][0], g.y + b[1][1])) ?? 999;
      return powered ? db - da : da - db;
    });
    return candidates[0]?.[0] || null;
  }
  function move(a, amount, choose, arrive) {
    while (amount > 0 && !ended) {
      if (a.idle) {
        const direction = choose();
        if (!direction) return;
        const [dx, dy] = DIRECTIONS[direction];
        a.dir = direction; a.tx = a.x + dx; a.ty = a.y + dy; a.idle = false;
      }
      const advance = Math.min(amount, 1 - a.progress);
      a.progress += advance; amount -= advance;
      if (a.progress >= 1 - 1e-8) {
        a.x = a.tx; a.y = a.ty; a.progress = 0; a.idle = true;
        if (arrive) { arrive(); if (respawnWait > 0 || ended) return; }
      }
    }
  }
  nextLevel();
  return {
    action(name, down) { if (down && DIRECTIONS[name]) desired = name; },
    update(dt) {
      if (ended) return;
      dt = Math.min(.05, Math.max(0, dt));
      time += dt;
      bannerTime = Math.max(0, bannerTime - dt);
      invincible = Math.max(0, invincible - dt);
      powered = Math.max(0, powered - dt);
      hudTime += dt;
      if (hudTime > .25) { setHUD(); hudTime = 0; }
      if (respawnWait > 0) { respawnWait -= dt; return; }
      move(player, dt * 5.1, choosePlayer, collect);
      if (ended || respawnWait > 0) return;
      ghosts.forEach((g, i) => {
        if (g.grace > 0) { g.grace -= dt; return; }
        move(g, dt * (powered ? 2.5 : (3.3 + level * .23 + i * .08) * difficulty), () => chooseGhost(g, i));
      });
      const p = position(player);
      for (const g of ghosts) {
        if (g.grace > 0) continue;
        const q = position(g);
        if (Math.hypot(q.x - p.x, q.y - p.y) > .63) continue;
        if (powered) {
          score += 200 * Math.min(4, ++ghostCombo);
          g.x = g.tx = g.homeX; g.y = g.ty = g.homeY; g.progress = 0; g.idle = true; g.dir = null; g.grace = 2.5;
          api.sound?.('score'); setHUD();
        } else if (!invincible) {
          lives--; api.sound?.('hit');
          if (!lives) { ended = true; api.finish({ score, coins: Math.floor(score / 100), message: `Final buzzer. You reached level ${level}.` }); }
          else { resetActors(); respawnWait = .9; banner = 'Shake it off. Pick a direction to get moving.'; bannerTime = 3; }
          setHUD(); break;
        }
      }
    },
    draw(ctx, w, h) {
      const scale = Math.min(w / 960, h / 600);
      ctx.save(); ctx.translate((w - 960 * scale) / 2, (h - 600 * scale) / 2); ctx.scale(scale, scale);
      const bg = ctx.createLinearGradient(0, 0, 960, 600); bg.addColorStop(0, '#111126'); bg.addColorStop(1, '#080b17');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 960, 600);
      // Quiet hardwood texture outside the neon court.
      ctx.strokeStyle = '#272037'; ctx.lineWidth = 1;
      for (let y = 12; y < 600; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
      const tile = 28, ox = 130, oy = 66;
      ctx.fillStyle = '#080e20'; ctx.fillRect(ox - 10, oy - 10, COLS * tile + 20, ROWS * tile + 20);
      ctx.strokeStyle = '#7550b8'; ctx.lineWidth = 2; ctx.strokeRect(ox - 10, oy - 10, COLS * tile + 20, ROWS * tile + 20);
      ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillStyle = '#f6cf62'; ctx.textAlign = 'left'; ctx.fillText('PACBRON', ox, 36);
      ctx.fillStyle = '#aaa4c6'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`COURT ${String(level).padStart(2, '0')}  /  03`, ox + COLS * tile, 35);
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const px = ox + x * tile, py = oy + y * tile;
        if (grid[y][x]) {
          ctx.fillStyle = '#211c3e'; ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
          ctx.strokeStyle = '#6d55a8'; ctx.lineWidth = 1.3;
          ctx.beginPath();
          if (isOpen(grid, x, y - 1)) { ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + tile - 2, py + 2); }
          if (isOpen(grid, x, y + 1)) { ctx.moveTo(px + 2, py + tile - 2); ctx.lineTo(px + tile - 2, py + tile - 2); }
          if (isOpen(grid, x - 1, y)) { ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + 2, py + tile - 2); }
          if (isOpen(grid, x + 1, y)) { ctx.moveTo(px + tile - 2, py + 2); ctx.lineTo(px + tile - 2, py + tile - 2); }
          ctx.stroke();
        } else if (pellets.has(key(x, y))) {
          const power = powerPellets.has(key(x, y));
          ctx.beginPath(); ctx.arc(px + tile / 2, py + tile / 2, power ? 7 + Math.sin(time * 5) : 3, 0, Math.PI * 2);
          ctx.fillStyle = power ? '#ffe288' : '#f0a258'; ctx.fill();
          if (power) { ctx.strokeStyle = '#a37025'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(px + 14, py + 14, 3, 0, 7); ctx.fillStyle = '#121529'; ctx.fill(); }
        }
      }
      const p = position(player), px = ox + (p.x + .5) * tile, py = oy + (p.y + .5) * tile;
      if (invincible <= 0 || Math.floor(time * 8) % 2 === 0) {
        ctx.save(); ctx.translate(px, py);
        if (powered) { ctx.strokeStyle = '#ffeab1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.stroke(); }
        ctx.fillStyle = api.skin === 'cavs' ? '#b69aff' : api.skin === 'miami' ? '#ee658d' : '#ffcb4c'; ctx.beginPath(); ctx.arc(0, 0, 10.7, 0, 7); ctx.fill();
        ctx.strokeStyle = '#6e401f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
        ctx.fillStyle = '#fff4ba'; ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(-8, -17); ctx.lineTo(-3, -14); ctx.lineTo(0, -19); ctx.lineTo(3, -14); ctx.lineTo(8, -17); ctx.lineTo(7, -10); ctx.fill();
        ctx.restore();
      }
      ghosts.forEach((g) => {
        const p = position(g), x = ox + (p.x + .5) * tile, y = oy + (p.y + .5) * tile;
        ctx.save(); ctx.globalAlpha = g.grace > 0 ? .4 : 1;
        ctx.fillStyle = powered ? (powered < 2 && Math.floor(time * 8) % 2 ? '#edf2ff' : '#455be1') : g.color;
        ctx.beginPath(); ctx.arc(x, y - 2, 10, Math.PI, 0); ctx.lineTo(x + 10, y + 10); ctx.lineTo(x + 5, y + 6); ctx.lineTo(x, y + 10); ctx.lineTo(x - 5, y + 6); ctx.lineTo(x - 10, y + 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, y - 4, 4, 5); ctx.fillRect(x + 2, y - 4, 4, 5);
        ctx.fillStyle = '#151425'; ctx.fillRect(x - 4, y - 2, 2, 3); ctx.fillRect(x + 4, y - 2, 2, 3); ctx.restore();
      });
      ctx.textAlign = 'center'; ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = powered ? '#ffe294' : '#b9b4cc';
      ctx.fillText(bannerTime > 0 ? banner : powered ? 'KING MODE • Defenders are vulnerable' : 'ARROWS / WASD to move  •  Clear the court to advance', 480, 575);
      ctx.restore();
    },
    destroy() { ended = true; }
  };
}
