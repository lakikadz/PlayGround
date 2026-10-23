import {
  DIFFICULTIES,
  canMove,
  formatTime,
  isSolved,
  moveInDirection,
  moveTile,
  progressOf,
  readBest,
  shuffleBoard,
  solvedBoard,
  writeBest,
} from './game.js';

const IMAGE_URL = 'assets/puzzle.svg';
const MUTE_KEY = 'imagePuzzle.muted';
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const storage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      /* storage can be unavailable in private contexts */
    }
  },
};

const $ = (selector) => document.querySelector(selector);

const els = {
  ambient: $('#ambient'),
  board: $('#board'),
  blankSlot: $('#blankSlot'),
  tiles: $('#tiles'),
  moves: $('#moves'),
  time: $('#time'),
  best: $('#best'),
  progressFill: $('#progressFill'),
  progressLabel: $('#progressLabel'),
  progressBar: $('#progressBar'),
  difficulty: $('#difficulty'),
  sizeBadge: $('#sizeBadge'),
  newGame: $('#newGame'),
  previewBtn: $('#previewBtn'),
  preview: $('#preview'),
  win: $('#win'),
  winMoves: $('#winMoves'),
  winTime: $('#winTime'),
  winNote: $('#winNote'),
  winBadge: $('#winBadge'),
  winPlay: $('#winPlay'),
  winPreview: $('#winPreview'),
  confetti: $('#confetti'),
  muteBtn: $('#muteBtn'),
  helpBtn: $('#helpBtn'),
  help: $('#helpDialog'),
  helpClose: $('#helpClose'),
  helpDone: $('#helpDone'),
  status: $('#status'),
  stageHint: $('#stageHint'),
};

const state = {
  size: 4,
  board: solvedBoard(4),
  moves: 0,
  elapsed: 0,
  startedAt: 0,
  timer: null,
  running: false,
  won: false,
  busy: true,
  generation: 0,
  previewTimer: null,
  winTimer: null,
  winCloseTimer: null,
};

const sound = {
  ctx: null,
  muted: storage.getItem(MUTE_KEY) === '1',

  ensure() {
    if (this.muted) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!this.ctx) this.ctx = new AudioCtor();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  tone({ freq, end = freq, duration = 0.16, type = 'sine', gain = 0.03, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const amp = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (end !== freq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(end, 1), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amp).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  },

  slide() {
    this.tone({ freq: 560, end: 300, duration: 0.1, type: 'triangle', gain: 0.022 });
    this.tone({ freq: 172, end: 132, duration: 0.16, type: 'sine', gain: 0.016, delay: 0.012 });
  },

  bump() {
    this.tone({ freq: 150, end: 108, duration: 0.1, type: 'square', gain: 0.01 });
  },

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this.tone({ freq, duration: 0.62, type: 'sine', gain: 0.045, delay: index * 0.11 });
    });
    this.tone({ freq: 261.63, duration: 1.5, type: 'sine', gain: 0.02, delay: 0.05 });
    this.tone({ freq: 1567.98, duration: 0.8, type: 'triangle', gain: 0.014, delay: 0.45 });
  },

  toggle() {
    this.muted = !this.muted;
    storage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (!this.muted) this.tone({ freq: 620, end: 880, duration: 0.16, type: 'sine', gain: 0.028 });
    return this.muted;
  },
};

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setStatus(message) {
  els.status.textContent = '';
  window.setTimeout(() => {
    els.status.textContent = message;
  }, 40);
}

function setActiveDifficulty() {
  els.difficulty.querySelectorAll('button[data-size]').forEach((button) => {
    const active = Number(button.dataset.size) === state.size;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function buildTiles() {
  const fragment = document.createDocumentFragment();
  const total = state.size * state.size;
  const tileSize = 100 / state.size;

  for (let value = 1; value < total; value += 1) {
    const home = value - 1;
    const homeRow = Math.floor(home / state.size);
    const homeCol = home % state.size;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tile';
    tile.dataset.value = String(value);
    tile.style.width = `${tileSize}%`;
    tile.style.height = `${tileSize}%`;
    tile.style.backgroundImage = `url("${IMAGE_URL}")`;
    tile.style.backgroundSize = `${state.size * 100}% ${state.size * 100}%`;
    tile.style.backgroundPosition = `${(homeCol / (state.size - 1)) * 100}% ${(homeRow / (state.size - 1)) * 100}%`;
    tile.style.setProperty('--order', String((value * 3) % 9));
    tile.tabIndex = -1;
    tile.setAttribute('aria-label', `القطعة ${value}`);
    fragment.appendChild(tile);
  }

  els.blankSlot.style.width = `${tileSize}%`;
  els.blankSlot.style.height = `${tileSize}%`;
  els.tiles.replaceChildren(fragment);
}

function renderBoard({ instant = false } = {}) {
  if (instant) els.board.classList.add('is-instant');

  for (const tile of els.tiles.children) {
    const value = Number(tile.dataset.value);
    const index = state.board.indexOf(value);
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    tile.style.transform = `translate3d(${col * 100}%, ${row * 100}%, 0)`;
  }

  if (els.blankSlot) {
    const blank = state.board.indexOf(0);
    const blankRow = Math.floor(blank / state.size);
    const blankCol = blank % state.size;
    els.blankSlot.style.transform = `translate3d(${blankCol * 100}%, ${blankRow * 100}%, 0)`;
  }

  updateMovable();

  if (instant) {
    void els.board.offsetWidth;
    window.requestAnimationFrame(() => {
      els.board.classList.remove('is-instant');
    });
  }
}

function updateMovable() {
  const canPlay = !state.busy && !state.won;
  for (const tile of els.tiles.children) {
    const value = Number(tile.dataset.value);
    const index = state.board.indexOf(value);
    const movable = canPlay && canMove(state.board, index, state.size);
    tile.classList.toggle('tile--movable', movable);
    tile.tabIndex = movable ? 0 : -1;
  }
}

function updateStats() {
  els.moves.textContent = String(state.moves);
  els.time.textContent = formatTime(state.elapsed);
  updateBest();
}

function updateBest() {
  const best = readBest(storage, state.size);
  if (best) {
    els.best.textContent = `${best.moves} حركة`;
    els.best.title = `أفضل نتيجة: ${best.moves} حركة في ${formatTime(best.time)}`;
  } else {
    els.best.textContent = '—';
    els.best.removeAttribute('title');
  }
}

function updateProgress(value) {
  const pct = typeof value === 'number' ? value : Math.round(progressOf(state.board, state.size) * 100);
  els.progressFill.style.width = `${pct}%`;
  els.progressLabel.textContent = `${pct}%`;
  els.progressBar.setAttribute('aria-valuenow', String(pct));
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  state.startedAt = performance.now() - state.elapsed;
  state.timer = window.setInterval(tickTimer, 200);
  tickTimer();
}

function tickTimer() {
  if (!state.running) return;
  state.elapsed = performance.now() - state.startedAt;
  els.time.textContent = formatTime(state.elapsed);
}

function stopTimer() {
  if (state.timer) {
    window.clearInterval(state.timer);
    state.timer = null;
  }
  state.running = false;
}

function nudgeTile(value) {
  const tile = els.tiles.querySelector(`.tile[data-value="${value}"]`);
  if (!tile) return;
  tile.classList.remove('tile--locked');
  void tile.offsetWidth;
  tile.classList.add('tile--locked');
  window.setTimeout(() => tile.classList.remove('tile--locked'), 280);
}

function attemptValue(value) {
  if (state.busy || state.won) return;
  const index = state.board.indexOf(value);
  if (!canMove(state.board, index, state.size)) {
    nudgeTile(value);
    sound.bump();
    return;
  }

  startTimer();
  moveTile(state.board, index, state.size);
  state.moves += 1;
  sound.slide();
  renderBoard();
  updateStats();
  updateProgress();
  checkWin();
}

function handleDirection(direction) {
  if (state.busy || state.won) return;
  const target = moveInDirection(state.board, direction, state.size);
  if (target === null) return;

  startTimer();
  state.moves += 1;
  sound.slide();
  renderBoard();
  updateStats();
  updateProgress();
  checkWin();
}

function checkWin() {
  if (!isSolved(state.board)) return;

  state.won = true;
  state.elapsed = state.running ? performance.now() - state.startedAt : state.elapsed;
  stopTimer();
  els.time.textContent = formatTime(state.elapsed);

  const result = { moves: state.moves, time: Math.round(state.elapsed) };
  const newBest = writeBest(storage, state.size, result);

  updateBest();
  updateProgress(100);
  updateMovable();
  els.tiles.classList.add('is-won');
  els.stageHint.textContent = 'اكتملت الصورة — أحسنت!';
  els.stageHint.classList.add('is-active');
  sound.win();
  setStatus('أحسنت! اكتملت الصورة.');
  els.board.setAttribute('aria-label', `اكتملت الصورة في ${state.moves} حركة. اضغط N للعب مرة أخرى.`);

  const generation = state.generation;
  window.clearTimeout(state.winTimer);
  state.winTimer = window.setTimeout(() => {
    if (generation === state.generation && state.won) openWin(result, newBest);
  }, 680);
}

function openWin(result, newBest) {
  els.winMoves.textContent = String(result.moves);
  els.winTime.textContent = formatTime(result.time);

  const best = readBest(storage, state.size);
  if (newBest) {
    els.winBadge.hidden = false;
    els.winNote.textContent = 'أنت الآن صاحب أفضل نتيجة في هذا المستوى.';
  } else {
    els.winBadge.hidden = true;
    els.winNote.textContent = best
      ? `أفضل نتيجة حتى الآن: ${best.moves} حركة في ${formatTime(best.time)}.`
      : 'عادت واحة القمر إلى كمالها.';
  }

  window.clearTimeout(state.winCloseTimer);
  els.win.hidden = false;
  window.requestAnimationFrame(() => els.win.classList.add('is-open'));
  spawnConfetti();

  window.setTimeout(() => {
    if (els.win.classList.contains('is-open')) els.winPlay.focus({ preventScroll: true });
  }, 380);
}

function closeWin() {
  window.clearTimeout(state.winCloseTimer);
  els.win.classList.remove('is-open');
  state.winCloseTimer = window.setTimeout(() => {
    if (!els.win.classList.contains('is-open')) {
      els.win.hidden = true;
      els.confetti.replaceChildren();
    }
  }, 340);
}

function spawnConfetti() {
  if (REDUCED_MOTION) return;
  const colors = ['#f0c27a', '#ffe4ae', '#7ee0cd', '#e59a8d', '#fff7e6'];
  const fall = Math.round(els.board.clientHeight * 1.05 + 40);
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 38; i += 1) {
    const piece = document.createElement('span');
    piece.style.setProperty('--x', `${4 + Math.random() * 92}%`);
    piece.style.setProperty('--c', colors[i % colors.length]);
    piece.style.setProperty('--r', `${Math.round(Math.random() * 360)}deg`);
    piece.style.setProperty('--dur', `${(1.25 + Math.random() * 1.25).toFixed(2)}s`);
    piece.style.setProperty('--delay', `${(Math.random() * 0.4).toFixed(2)}s`);
    piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 200)}px`);
    piece.style.setProperty('--fall', `${fall}px`);
    fragment.appendChild(piece);
  }
  els.confetti.replaceChildren(fragment);
}

function showPreview(duration = 2400) {
  if (els.win.classList.contains('is-open')) return;
  window.clearTimeout(state.previewTimer);
  els.preview.hidden = false;
  window.requestAnimationFrame(() => els.preview.classList.add('is-open'));
  els.previewBtn.setAttribute('aria-pressed', 'true');
  state.previewTimer = window.setTimeout(hidePreview, duration);
}

function hidePreview() {
  window.clearTimeout(state.previewTimer);
  state.previewTimer = null;
  els.preview.classList.remove('is-open');
  els.previewBtn.setAttribute('aria-pressed', 'false');
  window.setTimeout(() => {
    if (!els.preview.classList.contains('is-open')) els.preview.hidden = true;
  }, 340);
}

function togglePreview() {
  if (els.preview.hidden) showPreview();
  else hidePreview();
}

async function newGame({ animate = true } = {}) {
  const generation = (state.generation += 1);

  stopTimer();
  window.clearTimeout(state.winTimer);
  state.running = false;
  state.won = false;
  state.busy = true;
  state.moves = 0;
  state.elapsed = 0;

  closeWin();
  hidePreview();
  els.tiles.classList.remove('is-won');
  els.stageHint.classList.remove('is-active');
  els.stageHint.textContent = 'انقر على القطعة المجاورة للفراغ لتحريكها بسلاسة.';
  els.board.setAttribute('aria-label', 'لوحة لغز الصورة. استخدم الأسهم أو انقر على قطعة مجاورة للفراغ.');
  els.sizeBadge.textContent = `${state.size} × ${state.size}`;
  els.time.textContent = '00:00';
  updateStats();
  setActiveDifficulty();

  state.board = solvedBoard(state.size);
  buildTiles();
  renderBoard({ instant: true });
  updateProgress(0);
  setStatus('تُخلط القطع…');

  if (animate && !REDUCED_MOTION) {
    await delay(460);
    if (generation !== state.generation) return;
    state.board = shuffleBoard(state.size);
    renderBoard();
    await delay(580);
  } else {
    state.board = shuffleBoard(state.size);
    buildTiles();
    renderBoard({ instant: true });
  }

  if (generation !== state.generation) return;

  state.busy = false;
  updateMovable();
  updateProgress();
  updateStats();
  setStatus('اللغز جاهز. حرّك القطع لإعادة الصورة.');
  els.board.focus({ preventScroll: true });
}

function setSize(size) {
  if (!DIFFICULTIES.some((entry) => entry.size === size)) return;
  if (state.size !== size) {
    state.size = size;
    updateBest();
  }
  newGame();
}

function syncMuteButton() {
  els.muteBtn.classList.toggle('is-muted', sound.muted);
  els.muteBtn.setAttribute('aria-pressed', String(sound.muted));
  const label = sound.muted ? 'تشغيل الصوت' : 'كتم الصوت';
  els.muteBtn.setAttribute('aria-label', label);
  els.muteBtn.title = label;
}

function openHelp() {
  if (els.help.open) return;
  if (typeof els.help.showModal === 'function') els.help.showModal();
  else els.help.setAttribute('open', '');
}

function closeHelp() {
  if (typeof els.help.close === 'function') els.help.close();
  else els.help.removeAttribute('open');
  els.helpBtn.focus({ preventScroll: true });
}

function initAmbient() {
  const canvas = els.ambient;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let raf = 0;
  let last = 0;

  function fill() {
    const count = Math.round(Math.min(90, Math.max(34, (width * height) / 24000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.5 + Math.random() * 1.7,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -(0.015 + Math.random() * 0.07),
      alpha: 0.14 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.9,
      tint: Math.random() < 0.16 ? 'gold' : Math.random() < 0.28 ? 'teal' : 'ice',
    }));
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fill();
    if (reduceMotion) draw(0);
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    for (const particle of particles) {
      const flicker = reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(time * 0.001 * particle.speed + particle.phase);
      const alpha = particle.alpha * flicker;
      let color;
      if (particle.tint === 'gold') color = `rgba(240, 194, 122, ${alpha})`;
      else if (particle.tint === 'teal') color = `rgba(126, 224, 205, ${alpha})`;
      else color = `rgba(226, 234, 255, ${alpha})`;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (particle.r > 1.25) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(/[\d.]+\)$/, `${(alpha * 0.06).toFixed(3)})`);
        ctx.fill();
      }
    }
  }

  function frame(time) {
    if (!last) last = time;
    const dt = Math.min(60, time - last);
    last = time;
    for (const particle of particles) {
      particle.x += particle.vx * dt * 0.06;
      particle.y += particle.vy * dt * 0.06;
      if (particle.y < -12) {
        particle.y = height + 12;
        particle.x = Math.random() * width;
      }
      if (particle.x < -12) particle.x = width + 12;
      if (particle.x > width + 12) particle.x = -12;
    }
    draw(time);
    raf = window.requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (!reduceMotion) {
    raf = window.requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
    });
  }
}

// Events
els.tiles.addEventListener('click', (event) => {
  const tile = event.target.closest('.tile');
  if (!tile || !els.tiles.contains(tile)) return;
  attemptValue(Number(tile.dataset.value));
});

els.difficulty.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-size]');
  if (!button) return;
  setSize(Number(button.dataset.size));
});

els.newGame.addEventListener('click', () => newGame());
els.previewBtn.addEventListener('click', togglePreview);
els.winPlay.addEventListener('click', () => newGame());
els.winPreview.addEventListener('click', () => {
  closeWin();
  showPreview(2600);
});

els.muteBtn.addEventListener('click', () => {
  sound.toggle();
  syncMuteButton();
});

els.helpBtn.addEventListener('click', openHelp);
els.helpClose.addEventListener('click', closeHelp);
els.helpDone.addEventListener('click', closeHelp);
els.help.addEventListener('click', (event) => {
  if (event.target === els.help) closeHelp();
});

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (els.help.open) return;
  const active = document.activeElement;
  if (active && active.matches('input, textarea, select')) return;

  const key = event.key;
  const lower = typeof key === 'string' ? key.toLowerCase() : '';
  const directions = {
    arrowup: 'up',
    arrowdown: 'down',
    arrowleft: 'left',
    arrowright: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
  };

  if (directions[lower]) {
    event.preventDefault();
    handleDirection(directions[lower]);
    return;
  }

  if (lower === 'p') {
    event.preventDefault();
    togglePreview();
    return;
  }

  if (lower === 'n') {
    event.preventDefault();
    newGame();
    return;
  }

  if (key === '1' || key === '2' || key === '3') {
    event.preventDefault();
    setSize(2 + Number(key));
    return;
  }

  if (key === 'Escape') {
    if (!els.win.hidden && els.win.classList.contains('is-open')) closeWin();
    else hidePreview();
  }
});

// Boot
syncMuteButton();
setActiveDifficulty();
updateBest();
initAmbient();
newGame();
