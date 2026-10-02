// Ensure capitalization helper is globally accessible immediately
function capitalize(str) {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}
window.capitalize = capitalize;

const BOARD_DIM = 15;

// 52 common perimeter track steps in clockwise order
const COMMON_TRACK = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], [6, 0]
];

// Colored home runway steps heading into the center
const HOME_RUNWAYS = {
  red:    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green:  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue:   [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
};

// Four base sockets in each quadrant
const BASE_SLOTS = {
  red:    [[2, 2], [2, 3], [3, 2], [3, 3]],
  green:  [[2, 11], [2, 12], [3, 11], [3, 12]],
  yellow: [[11, 11], [11, 12], [12, 11], [12, 12]],
  blue:   [[11, 2], [11, 3], [12, 2], [12, 3]]
};

// Starting indices on COMMON_TRACK
const START_STEP = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};

// Safe Star positions on COMMON_TRACK (4 starting colored stars + 4 path stars)
const STAR_SAFE_STEPS = [0, 8, 13, 21, 26, 34, 39, 47];

let playerRoles = {};
let activeColors = [];
let currentIdx = 0;
let rolledNumber = null;
let awaitingPawnPick = false;
let isRolling = false;
let isGameOver = false;
let pawns = {};

// Web Audio API synthesizer for sound effects
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playDiceSound() {
  try {
    const ctx = getAudioContext();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120 + Math.random() * 200, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }, i * 90);
    }
  } catch (e) {}
}

function playScoreSound() {
  try {
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }, idx * 100);
    });
  } catch (e) {}
}

const boardEl = document.getElementById('board');
const diceCube = document.getElementById('diceCube');
const diceNumText = document.getElementById('diceNumText');
const rollDiceBtn = document.getElementById('rollDiceBtn');
const statusMsg = document.getElementById('statusMsg');
const turnBadge = document.getElementById('turnBadge');
const scoreListing = document.getElementById('scoreListing');
const setupModal = document.getElementById('setupModal');
const startBtn = document.getElementById('startBtn');
const resetMatchBtn = document.getElementById('resetMatchBtn');
const winnerBanner = document.getElementById('winnerBanner');
const winnerTitle = document.getElementById('winnerTitle');
const newMatchBtn = document.getElementById('newMatchBtn');

// 3D rotation angles for 1-6
const DICE_ROTATIONS = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: 180 },
  3: { x: 0, y: 90 },
  4: { x: 0, y: -90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 }
};

// Cryptographically unbiased random generator (0% bias for Human & AI alike)
function getRandomDiceRoll() {
  if (window.crypto && window.crypto.getRandomValues) {
    const maxUnbiasedRange = 0xFFFFFFFF - (0xFFFFFFFF % 6);
    const buffer = new Uint32Array(1);
    do {
      window.crypto.getRandomValues(buffer);
    } while (buffer[0] >= maxUnbiasedRange);
    return (buffer[0] % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

function generateBoardGrid() {
  boardEl.querySelectorAll('.cell').forEach(c => c.remove());

  for (let r = 0; r < BOARD_DIM; r++) {
    for (let c = 0; c < BOARD_DIM; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.r = r;
      cell.dataset.c = c;

      // Corner bases
      if (r < 6 && c < 6) cell.classList.add('base-red');
      else if (r < 6 && c > 8) cell.classList.add('base-green');
      else if (r > 8 && c > 8) cell.classList.add('base-yellow');
      else if (r > 8 && c < 6) cell.classList.add('base-blue');

      // Inner white base squares
      if (r >= 1 && r <= 4 && c >= 1 && c <= 4) cell.classList.add('base-inner-box');
      if (r >= 1 && r <= 4 && c >= 10 && c <= 13) cell.classList.add('base-inner-box');
      if (r >= 10 && r <= 13 && c >= 10 && c <= 13) cell.classList.add('base-inner-box');
      if (r >= 10 && r <= 13 && c >= 1 && c <= 4) cell.classList.add('base-inner-box');

      // Circular token slots inside bases
      assignBaseSlotStyle(cell, r, c);

      // Home runways
      if (r === 7 && c >= 1 && c <= 5) cell.classList.add('runway-red');
      if (c === 7 && r >= 1 && r <= 5) cell.classList.add('runway-green');
      if (r === 7 && c >= 9 && c <= 13) cell.classList.add('runway-yellow');
      if (c === 7 && r >= 9 && r <= 13) cell.classList.add('runway-blue');

      // 4 Colored starting squares with stars
      if (r === 6 && c === 1) { 
        cell.classList.add('start-red', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol">★</span>'; 
      }
      if (r === 1 && c === 8) { 
        cell.classList.add('start-green', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol">★</span>'; 
      }
      if (r === 8 && c === 13) { 
        cell.classList.add('start-yellow', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol" style="color:#000;">★</span>'; 
      }
      if (r === 13 && c === 6) { 
        cell.classList.add('start-blue', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol">★</span>'; 
      }

      // 4 Neutral safe star squares on the track
      if (r === 2 && c === 6) { 
        cell.classList.add('neutral-star', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol" style="color:var(--red-main)">★</span>'; 
      }
      if (r === 6 && c === 12) { 
        cell.classList.add('neutral-star', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol" style="color:var(--green-main)">★</span>'; 
      }
      if (r === 12 && c === 8) { 
        cell.classList.add('neutral-star', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol" style="color:var(--yellow-dark)">★</span>'; 
      }
      if (r === 8 && c === 2) { 
        cell.classList.add('neutral-star', 'star-cell'); 
        cell.innerHTML = '<span class="star-symbol" style="color:var(--blue-main)">★</span>'; 
      }

      // Directional colored entrance arrows
      if (r === 7 && c === 0) { cell.innerHTML = '<span class="arrow-indicator arrow-red">➜</span>'; }
      if (r === 0 && c === 7) { cell.innerHTML = '<span class="arrow-indicator arrow-green">⬇</span>'; }
      if (r === 7 && c === 14) { cell.innerHTML = '<span class="arrow-indicator arrow-yellow">⬅</span>'; }
      if (r === 14 && c === 7) { cell.innerHTML = '<span class="arrow-indicator arrow-blue">⬆</span>'; }

      boardEl.appendChild(cell);
    }
  }
}

function assignBaseSlotStyle(cell, r, c) {
  Object.keys(BASE_SLOTS).forEach(color => {
    BASE_SLOTS[color].forEach(([sr, sc]) => {
      if (sr === r && sc === c) {
        cell.classList.add('base-slot-circle', `slot-${color}`);
      }
    });
  });
}

startBtn.addEventListener('click', () => {
  playerRoles = {
    red: document.getElementById('sel-red').value,
    green: document.getElementById('sel-green').value,
    yellow: document.getElementById('sel-yellow').value,
    blue: document.getElementById('sel-blue').value
  };

  activeColors = Object.keys(playerRoles).filter(c => playerRoles[c] !== 'none');

  if (activeColors.length < 2) {
    statusMsg.textContent = 'Please choose at least 2 active players to start!';
    return;
  }

  setupModal.classList.add('hidden');
  initGame();
});

function initGame() {
  currentIdx = 0;
  rolledNumber = null;
  awaitingPawnPick = false;
  isGameOver = false;
  isRolling = false;
  winnerBanner.classList.remove('active');

  pawns = {};
  activeColors.forEach(color => {
    pawns[color] = [0, 1, 2, 3].map(i => ({
      id: `${color}-${i}`,
      step: -1,
      finished: false
    }));
  });

  generateBoardGrid();
  buildScoreboard();
  renderPawns();
  setupTurn();
}

function buildScoreboard() {
  scoreListing.innerHTML = '';
  activeColors.forEach(c => {
    const isAI = playerRoles[c] === 'bot';
    const row = document.createElement('div');
    row.classList.add('score-row');
    const formattedName = capitalize(c);
    row.innerHTML = `
      <span><span class="color-dot" style="background:var(--${c}-main)"></span>${formattedName} ${isAI ? '(AI)' : ''}</span>
      <strong id="${c}ScoreBadge">0 / 4</strong>
    `;
    scoreListing.appendChild(row);
  });
}

function getPawnCoordinates(color, step, index) {
  if (step === -1) {
    const [r, c] = BASE_SLOTS[color][index];
    return { r, c };
  }
  if (step < 51) {
    const globalIdx = (START_STEP[color] + step) % COMMON_TRACK.length;
    const [r, c] = COMMON_TRACK[globalIdx];
    return { r, c };
  }
  const runwayIndex = Math.min(step - 51, HOME_RUNWAYS[color].length - 1);
  const [r, c] = HOME_RUNWAYS[color][runwayIndex];
  return { r, c };
}

function renderPawns() {
  document.querySelectorAll('.pawn').forEach(p => p.remove());

  const activeColor = activeColors[currentIdx];
  const isHumanTurn = playerRoles[activeColor] === 'human';

  const cellOccupancy = {};

  activeColors.forEach(color => {
    pawns[color].forEach((pawn, idx) => {
      if (pawn.finished) return;

      const { r, c } = getPawnCoordinates(color, pawn.step, idx);
      const key = `${r}_${c}`;
      if (!cellOccupancy[key]) cellOccupancy[key] = [];
      cellOccupancy[key].push({ color, idx, pawn, r, c });
    });
  });

  Object.keys(cellOccupancy).forEach(key => {
    const group = cellOccupancy[key];
    const [r, c] = key.split('_').map(Number);
    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return;

    group.forEach((item, stackPos) => {
      const pawnEl = document.createElement('div');
      pawnEl.classList.add('pawn', `pawn-${item.color}`);
      
      if (group.length > 1) {
        pawnEl.classList.add(`pawn-sub-${stackPos % 4}`);
      }

      if (awaitingPawnPick && isHumanTurn && activeColor === item.color && canPawnAdvance(item.pawn, rolledNumber)) {
        pawnEl.classList.add('selectable');
        pawnEl.addEventListener('click', (e) => {
          e.stopPropagation();
          handlePawnSelection(item.color, item.idx);
        });
      }

      cell.appendChild(pawnEl);
    });
  });
}

function canPawnAdvance(pawn, roll) {
  if (pawn.finished) return false;
  if (pawn.step === -1) return roll === 6;
  return (pawn.step + roll) <= 56;
}

function hasValidMoves(color, roll) {
  return pawns[color].some(p => canPawnAdvance(p, roll));
}

rollDiceBtn.addEventListener('click', () => {
  if (awaitingPawnPick || isRolling || isGameOver) return;
  triggerDiceRoll();
});

function triggerDiceRoll() {
  isRolling = true;
  rollDiceBtn.disabled = true;
  diceNumText.textContent = 'Rolling...';
  diceCube.classList.add('rolling');
  playDiceSound();

  setTimeout(() => {
    diceCube.classList.remove('rolling');
    rolledNumber = getRandomDiceRoll();

    const rot = DICE_ROTATIONS[rolledNumber];
    diceCube.style.transform = `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
    diceNumText.textContent = `Rolled: ${rolledNumber}`;
    isRolling = false;

    evaluateRollResult();
  }, 750);
}

function evaluateRollResult() {
  const activeColor = activeColors[currentIdx];
  const isBot = playerRoles[activeColor] === 'bot';

  if (!hasValidMoves(activeColor, rolledNumber)) {
    statusMsg.textContent = `${capitalize(activeColor)} rolled ${rolledNumber}. No moves available!`;
    setTimeout(passTurnToNext, 1100);
    return;
  }

  awaitingPawnPick = true;

  if (isBot) {
    statusMsg.textContent = `Computer (${capitalize(activeColor)}) rolled ${rolledNumber}. Thinking...`;
    setTimeout(() => executeAIMove(activeColor, rolledNumber), 700);
  } else {
    statusMsg.textContent = `${capitalize(activeColor)} rolled ${rolledNumber}! Click a glowing pawn to move.`;
    renderPawns();
  }
}

function handlePawnSelection(color, pawnIndex) {
  if (!awaitingPawnPick || isGameOver) return;

  const pawn = pawns[color][pawnIndex];
  if (!canPawnAdvance(pawn, rolledNumber)) return;

  awaitingPawnPick = false;
  let gainedExtraTurn = false;

  if (pawn.step === -1 && rolledNumber === 6) {
    pawn.step = 0;
  } else {
    pawn.step += rolledNumber;
  }

  // Check home arrival
  if (pawn.step === 56) {
    pawn.finished = true;
    gainedExtraTurn = true;
    updateScoreDisplay(color);
    triggerConfetti(window.innerWidth / 2, window.innerHeight / 2, 40);
    playScoreSound();
    statusMsg.textContent = `🌟 ${capitalize(color)}'s pawn reached HOME!`;
  } else if (pawn.step < 51) {
    const capturedOpponent = checkOpponentCapture(color, pawn.step);
    if (capturedOpponent) {
      gainedExtraTurn = true;
      statusMsg.textContent = `⚔️ ${capitalize(color)} captured an opponent pawn and earns another turn!`;
    }
  }

  renderPawns();

  // Check match victory
  if (pawns[color].every(p => p.finished)) {
    handlePlayerVictory(color);
    return;
  }

  if (rolledNumber === 6 && !gainedExtraTurn) {
    gainedExtraTurn = true;
    statusMsg.textContent = `${capitalize(color)} rolled a 6 and earns an extra roll!`;
  }

  if (gainedExtraTurn) {
    setTimeout(setupTurn, 900);
  } else {
    setTimeout(passTurnToNext, 850);
  }
}

function checkOpponentCapture(color, step) {
  const myGlobalPos = (START_STEP[color] + step) % COMMON_TRACK.length;

  // Safe star squares are immune from captures
  if (STAR_SAFE_STEPS.includes(myGlobalPos)) return false;

  let captured = false;
  activeColors.forEach(otherColor => {
    if (otherColor === color) return;

    pawns[otherColor].forEach(oppPawn => {
      if (oppPawn.step >= 0 && oppPawn.step < 51) {
        const oppGlobalPos = (START_OFFSET[otherColor] + oppPawn.step) % COMMON_TRACK.length;
        if (oppGlobalPos === myGlobalPos) {
          oppPawn.step = -1;
          captured = true;
        }
      }
    });
  });

  return captured;
}

function passTurnToNext() {
  currentIdx = (currentIdx + 1) % activeColors.length;
  setupTurn();
}

function setupTurn() {
  if (isGameOver) return;

  awaitingPawnPick = false;
  rolledNumber = null;

  const activeColor = activeColors[currentIdx];
  const isBot = playerRoles[activeColor] === 'bot';

  turnBadge.textContent = `${capitalize(activeColor)} ${isBot ? '(AI)' : ''}`;
  turnBadge.className = `badge-tag badge-${activeColor}`;

  renderPawns();

  if (isBot) {
    rollDiceBtn.disabled = true;
    statusMsg.textContent = `Computer (${capitalize(activeColor)}) is rolling...`;
    setTimeout(triggerDiceRoll, 750);
  } else {
    rollDiceBtn.disabled = false;
    statusMsg.textContent = `${capitalize(activeColor)}'s turn. Roll the dice!`;
  }
}

function updateScoreDisplay(color) {
  const el = document.getElementById(`${color}ScoreBadge`);
  if (el) {
    const count = pawns[color].filter(p => p.finished).length;
    el.textContent = `${count} / 4`;
  }
}

function executeAIMove(color, roll) {
  const legalIndices = [];
  pawns[color].forEach((p, idx) => {
    if (canPawnAdvance(p, roll)) legalIndices.push(idx);
  });

  if (legalIndices.length === 0) {
    passTurnToNext();
    return;
  }

  let chosenIndex = legalIndices[0];
  let bestScore = -9999;

  legalIndices.forEach(idx => {
    const p = pawns[color][idx];
    let score = 0;

    // Unlocking from base
    if (p.step === -1 && roll === 6) {
      score += 1000;
    }

    const nextStep = (p.step === -1) ? 0 : p.step + roll;

    // Entering center home
    if (nextStep === 56) {
      score += 1500;
    }

    if (nextStep < 51) {
      const targetGlobal = (START_STEP[color] + nextStep) % COMMON_TRACK.length;
      if (!STAR_SAFE_STEPS.includes(targetGlobal)) {
        let wouldCapture = false;
        activeColors.forEach(otherColor => {
          if (otherColor !== color) {
            pawns[otherColor].forEach(opp => {
              if (opp.step >= 0 && opp.step < 51) {
                const oppGlobal = (START_OFFSET[otherColor] + opp.step) % COMMON_TRACK.length;
                if (oppGlobal === targetGlobal) wouldCapture = true;
              }
            });
          }
        });
        if (wouldCapture) score += 800;
      }

      if (STAR_SAFE_STEPS.includes(targetGlobal)) {
        score += 250;
      }
    }

    if (nextStep >= 51 && nextStep < 56) {
      score += 400;
    }

    score += nextStep * 2;

    if (score > bestScore) {
      bestScore = score;
      chosenIndex = idx;
    }
  });

  handlePawnSelection(color, chosenIndex);
}

const canvas = document.getElementById('confettiCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function triggerConfetti(originX, originY, amount = 70) {
  const colors = ['#ef4444', '#22c55e', '#eab308', '#3b82f6', '#ec4899', '#38bdf8'];
  for (let i = 0; i < amount; i++) {
    particles.push({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      alpha: 1,
      gravity: 0.35
    });
  }
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.rotation += p.rotationSpeed;
    p.alpha -= 0.012;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();

    if (p.alpha <= 0 || p.y > canvas.height + 50) {
      particles.splice(i, 1);
    }
  }
  requestAnimationFrame(animateConfetti);
}
requestAnimationFrame(animateConfetti);

function handlePlayerVictory(color) {
  isGameOver = true;
  rollDiceBtn.disabled = true;
  winnerTitle.textContent = `🏆 ${color.toUpperCase()} WINS! 🏆`;
  winnerTitle.style.color = `var(--${color}-main)`;
  winnerBanner.classList.add('active');

  const interval = setInterval(() => {
    if (!isGameOver) {
      clearInterval(interval);
      return;
    }
    triggerConfetti(Math.random() * window.innerWidth, window.innerHeight * 0.4, 35);
  }, 350);
}

resetMatchBtn.addEventListener('click', () => {
  isGameOver = false;
  setupModal.classList.remove('hidden');
  rollDiceBtn.disabled = true;
});

newMatchBtn.addEventListener('click', () => {
  winnerBanner.classList.remove('active');
  setupModal.classList.remove('hidden');
});

// Render board grid immediately on page load
generateBoardGrid();