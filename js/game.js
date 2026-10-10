const MODES = {
  easy:   { rows: 8,  cols: 8,  label: "轻松 · 8 × 8" },
  normal: { rows: 10, cols: 10, label: "普通 · 10 × 10" },
  hard:   { rows: 14, cols: 10, label: "困难 · 10 × 14" }
};

// 只需要把你的图片放进 images 文件夹，文件名保持 dy01、dy02……
// 默认会自动尝试 jpg / png / jpeg / webp 四种扩展名。
const IMAGE_KEYS = [
  "dy01", "dy02", "dy03", "dy04",
  "dy05", "dy06", "dy07", "dy08",
  "dy09", "dy10", "dy11", "dy12"
];

const IMAGE_EXTENSIONS = ["jpg", "png", "jpeg", "webp"];

let currentMode = "normal";
let rows = 10;
let cols = 10;
let board = [];
let selected = null;
let matchedPairs = 0;
let totalPairs = 0;
let hintCount = 0;
let elapsedSeconds = 0;
let timerHandle = null;
let interactionLocked = false;
let toastHandle = null;

const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");
const gameBoard = document.getElementById("gameBoard");
const pathLayer = document.getElementById("pathLayer");

document.querySelectorAll(".difficulty-card").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".difficulty-card").forEach(x => x.classList.remove("selected"));
    btn.classList.add("selected");
    currentMode = btn.dataset.mode;
  });
});

document.getElementById("startButton").addEventListener("click", () => startGame(currentMode));
document.getElementById("rulesButton").addEventListener("click", () => openModal("rulesModal"));
document.getElementById("backButton").addEventListener("click", goHome);
document.getElementById("restartTopButton").addEventListener("click", restartGame);
document.getElementById("restartButton").addEventListener("click", restartGame);
document.getElementById("hintButton").addEventListener("click", showHint);
document.getElementById("shuffleButton").addEventListener("click", () => shuffleRemaining(true));
document.getElementById("playAgainButton").addEventListener("click", () => {
  closeModal("winModal");
  startGame(currentMode);
});
document.getElementById("homeButton").addEventListener("click", () => {
  closeModal("winModal");
  goHome();
});

document.querySelectorAll("[data-close-modal]").forEach(el => {
  el.addEventListener("click", () => closeModal(el.dataset.closeModal));
});

function startGame(mode) {
  currentMode = mode;
  rows = MODES[mode].rows;
  cols = MODES[mode].cols;
  totalPairs = (rows * cols) / 2;
  matchedPairs = 0;
  hintCount = 0;
  elapsedSeconds = 0;
  selected = null;
  interactionLocked = false;

  board = createBoard(rows, cols);

  document.getElementById("modeLabel").textContent = MODES[mode].label;
  document.getElementById("totalPairs").textContent = totalPairs;
  document.getElementById("matchedCount").textContent = "0";
  document.getElementById("hintCount").textContent = "0";
  document.getElementById("timer").textContent = "00:00";

  homeScreen.classList.remove("active");
  gameScreen.classList.add("active");

  renderBoard();
  fitBoardToScreen();
  startTimer();

  // 极小概率首盘无解时自动调整。
  if (!findHintPair()) {
    shuffleRemaining(false);
  }
}

function createBoard(r, c) {
  const needed = (r * c) / 2;
  const pairKeys = [];

  for (let i = 0; i < needed; i++) {
    const key = IMAGE_KEYS[i % IMAGE_KEYS.length];
    pairKeys.push(key, key);
  }

  shuffleArray(pairKeys);

  const result = [];
  let index = 0;
  for (let y = 0; y < r; y++) {
    const row = [];
    for (let x = 0; x < c; x++) {
      row.push(pairKeys[index++]);
    }
    result.push(row);
  }
  return result;
}

function renderBoard() {
  gameBoard.innerHTML = "";
  gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gameBoard.dataset.rows = rows;
  gameBoard.dataset.cols = cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = board[r][c];
      const cell = document.createElement("button");
      cell.className = "game-cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (key === null) {
        cell.classList.add("empty");
        cell.disabled = true;
      } else {
        const img = document.createElement("img");
        img.alt = key;
        setImageWithFallback(img, key, 0);
        cell.appendChild(img);
        cell.addEventListener("click", () => handleCellClick(r, c));
      }

      gameBoard.appendChild(cell);
    }
  }

  requestAnimationFrame(() => resizePathLayer());
}

function setImageWithFallback(img, key, extIndex) {
  if (extIndex >= IMAGE_EXTENSIONS.length) {
    img.removeAttribute("src");
    img.alt = `${key}（未找到图片）`;
    img.style.background = "#eee5dc";
    return;
  }

  img.onerror = () => setImageWithFallback(img, key, extIndex + 1);
  img.src = `images/${key}.${IMAGE_EXTENSIONS[extIndex]}`;
}

async function handleCellClick(r, c) {
  if (interactionLocked || board[r][c] === null) return;

  clearTransientStates();

  if (!selected) {
    selected = { r, c };
    getCell(r, c).classList.add("selected");
    return;
  }

  if (selected.r === r && selected.c === c) {
    getCell(r, c).classList.remove("selected");
    selected = null;
    return;
  }

  const first = { ...selected };
  const second = { r, c };

  if (board[first.r][first.c] !== board[second.r][second.c]) {
    getCell(first.r, first.c).classList.remove("selected");
    getCell(second.r, second.c).classList.add("invalid");
    selected = second;
    getCell(second.r, second.c).classList.add("selected");
    showToast("不是同一张盆盆～");
    return;
  }

  const path = findConnectionPath(first.r, first.c, second.r, second.c);

  if (!path) {
    getCell(first.r, first.c).classList.remove("selected");
    getCell(second.r, second.c).classList.add("invalid", "selected");
    selected = second;
    showToast("这两张现在还连不到");
    return;
  }

  interactionLocked = true;
  selected = null;
  getCell(first.r, first.c).classList.remove("selected");

  drawConnection(path);
  await wait(260);

  const firstCell = getCell(first.r, first.c);
  const secondCell = getCell(second.r, second.c);
  firstCell.classList.add("removing");
  secondCell.classList.add("removing");

  await wait(180);
  board[first.r][first.c] = null;
  board[second.r][second.c] = null;
  matchedPairs++;

  document.getElementById("matchedCount").textContent = matchedPairs;
  clearPath();
  renderBoard();
  fitBoardToScreen();

  if (matchedPairs >= totalPairs) {
    stopTimer();
    document.getElementById("finalTime").textContent = formatTime(elapsedSeconds);
    document.getElementById("finalHints").textContent = hintCount;
    await wait(180);
    openModal("winModal");
    interactionLocked = false;
    return;
  }

  // 如果已经没有合法组合，自动洗牌。
  if (!findHintPair()) {
    showToast("没有可连组合，自动洗牌啦");
    await wait(300);
    shuffleRemaining(false);
  }

  interactionLocked = false;
}

function findConnectionPath(r1, c1, r2, c2) {
  if (r1 === r2 && c1 === c2) return null;
  if (board[r1][c1] === null || board[r2][c2] === null) return null;
  if (board[r1][c1] !== board[r2][c2]) return null;

  const H = rows + 2;
  const W = cols + 2;
  const sr = r1 + 1;
  const sc = c1 + 1;
  const tr = r2 + 1;
  const tc = c2 + 1;

  const dirs = [
    [-1, 0], // up
    [0, 1],  // right
    [1, 0],  // down
    [0, -1]  // left
  ];

  function isPassable(pr, pc) {
    if (pr < 0 || pr >= H || pc < 0 || pc >= W) return false;
    if (pr === tr && pc === tc) return true;
    if (pr === sr && pc === sc) return true;

    // 外围一整圈永远为空，因此经典连连看可以从棋盘外绕行。
    if (pr === 0 || pc === 0 || pr === H - 1 || pc === W - 1) return true;

    return board[pr - 1][pc - 1] === null;
  }

  // best[r][c][dir] = 到达该状态所需最少转弯数
  const best = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => Array(4).fill(Infinity))
  );

  const queue = [];
  const parents = new Map();

  for (let d = 0; d < 4; d++) {
    const nr = sr + dirs[d][0];
    const nc = sc + dirs[d][1];
    if (!isPassable(nr, nc)) continue;

    best[nr][nc][d] = 0;
    const state = { r: nr, c: nc, d, turns: 0 };
    queue.push(state);
    parents.set(stateKey(nr, nc, d), { r: sr, c: sc, d: -1 });
  }

  let head = 0;
  let endState = null;

  while (head < queue.length) {
    const cur = queue[head++];

    if (cur.r === tr && cur.c === tc) {
      endState = cur;
      break;
    }

    for (let nd = 0; nd < 4; nd++) {
      const nr = cur.r + dirs[nd][0];
      const nc = cur.c + dirs[nd][1];
      if (!isPassable(nr, nc)) continue;

      const nextTurns = cur.turns + (nd === cur.d ? 0 : 1);
      if (nextTurns > 2) continue;
      if (best[nr][nc][nd] <= nextTurns) continue;

      best[nr][nc][nd] = nextTurns;
      parents.set(stateKey(nr, nc, nd), { r: cur.r, c: cur.c, d: cur.d });

      const next = { r: nr, c: nc, d: nd, turns: nextTurns };

      // 同方向继续走优先，能更稳定地找到较自然的路径。
      if (nd === cur.d) {
        queue.splice(head, 0, next);
      } else {
        queue.push(next);
      }
    }
  }

  if (!endState) return null;

  const raw = [{ r: endState.r, c: endState.c }];
  let cr = endState.r;
  let cc = endState.c;
  let cd = endState.d;

  while (!(cr === sr && cc === sc)) {
    const parent = parents.get(stateKey(cr, cc, cd));
    if (!parent) break;
    raw.push({ r: parent.r, c: parent.c });
    cr = parent.r;
    cc = parent.c;
    cd = parent.d;
    if (cd === -1) break;
  }

  raw.reverse();
  return simplifyPath(raw);
}

function simplifyPath(points) {
  if (points.length <= 2) return points;

  const result = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];

    const dir1 = [b.r - a.r, b.c - a.c];
    const dir2 = [c.r - b.r, c.c - b.c];

    if (dir1[0] !== dir2[0] || dir1[1] !== dir2[1]) {
      result.push(b);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

function stateKey(r, c, d) {
  return `${r},${c},${d}`;
}

function drawConnection(path) {
  resizePathLayer();
  const boardRect = gameBoard.getBoundingClientRect();
  const wrapRect = document.querySelector(".board-wrap").getBoundingClientRect();

  const firstRealCell = getCell(0, 0) || gameBoard.querySelector(".game-cell");
  const cellRect = firstRealCell.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(gameBoard).gap) || 0;
  const padLeft = gameBoard.clientLeft + parseFloat(getComputedStyle(gameBoard).paddingLeft);
  const padTop = gameBoard.clientTop + parseFloat(getComputedStyle(gameBoard).paddingTop);
  const cellW = cellRect.width;
  const cellH = cellRect.height;

  function gridPoint(p) {
    // padded coordinate: 1..cols / 1..rows 对应实际棋盘格，0 和 cols+1 / rows+1 为外围
    const xInside = padLeft + (p.c - 1) * (cellW + gap) + cellW / 2;
    const yInside = padTop + (p.r - 1) * (cellH + gap) + cellH / 2;

    return {
      x: (boardRect.left - wrapRect.left) + xInside,
      y: (boardRect.top - wrapRect.top) + yInside
    };
  }

  const pts = path.map(gridPoint);
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("class", "path-line");
  polyline.setAttribute("points", pts.map(p => `${p.x},${p.y}`).join(" "));
  pathLayer.innerHTML = "";
  pathLayer.appendChild(polyline);
}

function clearPath() {
  pathLayer.innerHTML = "";
}

function resizePathLayer() {
  const wrap = document.querySelector(".board-wrap");
  pathLayer.setAttribute("viewBox", `0 0 ${wrap.clientWidth} ${wrap.clientHeight}`);
}

function showHint() {
  if (interactionLocked) return;

  const pair = findHintPair();
  if (!pair) {
    showToast("暂时没有可连组合，正在洗牌");
    shuffleRemaining(false);
    return;
  }

  hintCount++;
  document.getElementById("hintCount").textContent = hintCount;

  const [a, b] = pair;
  getCell(a.r, a.c).classList.add("hint");
  getCell(b.r, b.c).classList.add("hint");

  setTimeout(() => {
    getCell(a.r, a.c)?.classList.remove("hint");
    getCell(b.r, b.c)?.classList.remove("hint");
  }, 1450);
}

function findHintPair() {
  const byKey = new Map();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = board[r][c];
      if (key === null) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push({ r, c });
    }
  }

  for (const positions of byKey.values()) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        if (findConnectionPath(a.r, a.c, b.r, b.c)) {
          return [a, b];
        }
      }
    }
  }

  return null;
}

function shuffleRemaining(manual) {
  if (interactionLocked) return;

  const positions = [];
  const values = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== null) {
        positions.push({ r, c });
        values.push(board[r][c]);
      }
    }
  }

  if (values.length <= 2) return;

  let solved = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    shuffleArray(values);
    positions.forEach((p, i) => {
      board[p.r][p.c] = values[i];
    });

    if (findHintPair()) {
      solved = true;
      break;
    }
  }

  selected = null;
  renderBoard();
  fitBoardToScreen();
  clearPath();

  if (manual) {
    showToast(solved ? "已重新排列剩余图片" : "已洗牌");
  }
}

function restartGame() {
  if (!gameScreen.classList.contains("active")) return;
  startGame(currentMode);
  showToast("重新开始啦");
}

function goHome() {
  stopTimer();
  selected = null;
  clearPath();
  gameScreen.classList.remove("active");
  homeScreen.classList.add("active");
}

function getCell(r, c) {
  return gameBoard.querySelector(`.game-cell[data-row="${r}"][data-col="${c}"]`);
}

function clearTransientStates() {
  gameBoard.querySelectorAll(".game-cell").forEach(cell => {
    cell.classList.remove("invalid", "hint");
  });
}

function startTimer() {
  stopTimer();
  timerHandle = setInterval(() => {
    elapsedSeconds++;
    document.getElementById("timer").textContent = formatTime(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

function formatTime(total) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => toast.classList.remove("show"), 1600);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fitBoardToScreen() {
  if (!gameScreen.classList.contains("active")) return;

  const isMobile = window.matchMedia("(max-width: 620px)").matches;
  const wrap = document.querySelector(".board-wrap");
  const board = gameBoard;

  if (!isMobile) {
    board.style.width = "";
    return;
  }

  const styles = getComputedStyle(board);
  const gap = parseFloat(styles.gap) || 3;
  const horizontalPadding =
    (parseFloat(styles.paddingLeft) || 0) +
    (parseFloat(styles.paddingRight) || 0);

  const availableWidth = Math.max(280, wrap.clientWidth);
  const idealWidth = availableWidth;

  // 手机竖屏始终以“列数”决定单格大小。
  // 困难模式增加行数而不是增加列数，因此不会把图片压得更小。
  board.style.width = `${idealWidth}px`;

  // 如果困难模式高度较长，board-wrap 会在可用高度里尽量占满；
  // 仍保持图片为正方形，不做非等比压缩。
}

window.addEventListener("resize", () => {
  fitBoardToScreen();
  resizePathLayer();
});
