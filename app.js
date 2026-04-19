const STORAGE_KEY = "patience_exe_save_v1";
const STAGES = 6;

const state = {
  stage: 1,
  attempts: 0,
  fails: 0,
  bestProgress: 0,
  impatientMove: "None yet",
  achievements: new Set(),
  paused: false,
  sound: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  brutal: false,
  runStart: null,
  totalTimeMs: 0,
  clickCount: 0,
  board: [],
};

const els = {
  loader: document.getElementById("app-loader"),
  stageLabel: document.getElementById("stage-label"),
  feedback: document.getElementById("feedback"),
  trueProgress: document.getElementById("true-progress"),
  fakeProgress: document.getElementById("fake-progress"),
  gameArea: document.getElementById("game-area"),
  statAttempts: document.getElementById("stat-attempts"),
  statFails: document.getElementById("stat-fails"),
  statTime: document.getElementById("stat-time"),
  statBest: document.getElementById("stat-best"),
  statImpatient: document.getElementById("stat-impatient"),
  statAchievements: document.getElementById("stat-achievements"),
  boardBody: document.getElementById("leaderboard-body"),
  sortBoard: document.getElementById("sort-board"),
  reducedToggle: document.getElementById("reduced-motion-toggle"),
  difficultyToggle: document.getElementById("difficulty-toggle"),
};

const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "start-game") startGame(true);
    if (action === "pause") togglePause(btn);
    if (action === "restart") restartGame();
    if (action === "toggle-sound") toggleSound(btn);
    if (action === "hint") showHint();
    if (action === "share") shareRun();
  });
});

document.getElementById("year").textContent = new Date().getFullYear();
els.sortBoard.addEventListener("change", renderBoard);
els.reducedToggle.addEventListener("change", () => {
  state.reducedMotion = els.reducedToggle.checked;
  save();
});
els.difficultyToggle.addEventListener("change", () => {
  state.brutal = els.difficultyToggle.checked;
  save();
});

load();
setTimeout(() => els.loader.classList.add("hidden"), 600);
startGame(false);
setInterval(tick, 1000);

function tick() {
  if (state.paused || !state.runStart) return;
  const elapsed = Date.now() - state.runStart + state.totalTimeMs;
  els.statTime.textContent = msToClock(elapsed);
}

function startGame(newAttempt) {
  if (newAttempt) {
    state.attempts += 1;
    state.stage = 1;
    state.clickCount = 0;
    state.runStart = Date.now();
    state.totalTimeMs = 0;
  }
  renderStage();
  updateStats();
  save();
}

function restartGame() {
  fail("Manual reset. Retreat is also a move.", "Restart tapped");
  state.stage = 1;
  renderStage();
}

function togglePause(btn) {
  state.paused = !state.paused;
  btn.textContent = state.paused ? "Resume" : "Pause";
  if (state.paused) {
    state.totalTimeMs += Date.now() - state.runStart;
  } else {
    state.runStart = Date.now();
  }
  speak(state.paused ? "Paused" : "Resumed");
  save();
}

function toggleSound(btn) {
  state.sound = !state.sound;
  btn.textContent = `Sound: ${state.sound ? "On" : "Off"}`;
  btn.setAttribute("aria-pressed", String(state.sound));
  save();
}

function showHint() {
  const hints = {
    1: "The safe button is not always still.",
    2: "The shortest path is expensive.",
    3: "Sometimes the best click is no click.",
    4: "Press only when the pulse is centered.",
    5: "Memorize before acting.",
    6: "Hold. Do not release early.",
  };
  feedback(hints[state.stage] || "No hint. Endure.");
}

function shareRun() {
  const text = `I reached ${Math.round((state.stage - 1) / STAGES * 100)}% in Patience.exe. Can you beat my discipline?`;
  if (navigator.share) navigator.share({ title: "Patience.exe", text }).catch(() => {});
  else {
    navigator.clipboard?.writeText(text);
    feedback("Share text copied to clipboard.");
  }
}

function renderStage() {
  els.gameArea.innerHTML = "";
  const pct = Math.round(((state.stage - 1) / STAGES) * 100);
  state.bestProgress = Math.max(state.bestProgress, pct);

  els.stageLabel.textContent = `Stage ${Math.min(state.stage, STAGES)} / ${STAGES} — ${stageName(state.stage)}`;
  els.trueProgress.style.width = `${pct}%`;
  els.trueProgress.setAttribute("aria-valuenow", String(pct));

  if (state.stage === 1) stageMovingTarget();
  else if (state.stage === 2) stageTrapChoice();
  else if (state.stage === 3) stageWait();
  else if (state.stage === 4) stageTiming();
  else if (state.stage === 5) stageSequence();
  else if (state.stage === 6) stageFinalDoor();
  else victory();

  updateStats();
  save();
}

function stageName(stage) {
  return ["", "Moving Target", "Shortcut Trap", "Discipline Wait", "Precision Pulse", "Sequence Lock", "Final Door"][stage] || "Complete";
}

function stageMovingTarget() {
  feedback("Catch the moving ACCEPT button. Red buttons reset progress.");
  const target = button("ACCEPT", "target");
  target.style.position = "absolute";
  moveTarget(target);

  const trap = button("FAST PASS", "trap");
  trap.style.position = "absolute";
  trap.style.left = "10%";
  trap.style.top = "65%";

  target.addEventListener("click", () => nextStage());
  trap.addEventListener("click", () => fail("Shortcut detected. Stage reset.", "Clicked FAST PASS"));

  els.gameArea.append(target, trap);
  let ticker = setInterval(() => moveTarget(target), state.reducedMotion ? 1200 : 800);
  cleanupOnStageChange(() => clearInterval(ticker));
}

function moveTarget(target) {
  const x = Math.random() * 75;
  const y = Math.random() * 70;
  target.style.left = `${x}%`;
  target.style.top = `${y}%`;
}

function stageTrapChoice() {
  feedback("Select the long path. The instant button is a trap.");
  els.fakeProgress.style.width = "0%";

  const wrap = document.createElement("div");
  wrap.className = "controls";
  const safe = button("Slow Route", "choice");
  const trap = button("Finish Now", "trap");
  const progressBtn = button("Charge", "target");

  let charge = 0;
  progressBtn.addEventListener("click", () => {
    charge += state.brutal ? 8 : 12;
    els.trueProgress.style.width = `${Math.min(100, Math.round(((state.stage - 1) / STAGES) * 100 + charge / STAGES))}%`;
    if (charge >= 100) nextStage();
  });
  trap.addEventListener("click", () => {
    els.fakeProgress.style.width = "100%";
    setTimeout(() => {
      els.fakeProgress.style.width = "0%";
      fail("Fake completion. Back to stage 2.", "Clicked Finish Now");
    }, 700);
  });
  safe.addEventListener("click", () => feedback("Correct instinct. Now earn it with Charge."));

  wrap.append(safe, trap, progressBtn);
  els.gameArea.append(wrap);
}

function stageWait() {
  feedback("Do nothing for 9 seconds. Any click restarts this stage.");
  const msg = document.createElement("p");
  msg.textContent = "Hands off. Breathe.";
  els.gameArea.append(msg);

  const required = state.brutal ? 12 : 9;
  let left = required;
  const timer = setInterval(() => {
    left -= 1;
    msg.textContent = `Stillness required: ${left}s`;
    if (left <= 0) {
      clearInterval(timer);
      nextStage();
    }
  }, 1000);

  const triggerFail = () => fail("Impatience triggered. Wait stage reset.", "Clicked during stillness");
  els.gameArea.addEventListener("click", triggerFail, { once: true });
  cleanupOnStageChange(() => clearInterval(timer));
}

function stageTiming() {
  feedback("Hit LOCK when the pulse is in the center zone.");
  const pulse = document.createElement("div");
  pulse.style.width = "80%";
  pulse.style.height = "10px";
  pulse.style.background = "#1d2645";
  pulse.style.borderRadius = "999px";
  pulse.style.position = "relative";

  const marker = document.createElement("div");
  marker.style.position = "absolute";
  marker.style.left = "45%";
  marker.style.width = "10%";
  marker.style.height = "100%";
  marker.style.background = "rgba(125,255,154,.3)";

  const dot = document.createElement("div");
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "50%";
  dot.style.background = "#fff";
  dot.style.position = "absolute";
  dot.style.top = "-2px";

  pulse.append(marker, dot);
  const lock = button("LOCK", "target");

  let t = 0;
  const speed = state.brutal ? 0.11 : 0.08;
  const int = setInterval(() => {
    t += speed;
    const x = ((Math.sin(t) + 1) / 2) * 100;
    dot.style.left = `${x}%`;
    dot.dataset.x = x.toFixed(2);
  }, 16);

  lock.addEventListener("click", () => {
    const x = Number(dot.dataset.x || 0);
    if (x > 45 && x < 55) nextStage();
    else fail("Timing miss. Precision required.", "Pressed LOCK outside window");
  });

  els.gameArea.append(pulse, document.createElement("br"), lock);
  cleanupOnStageChange(() => clearInterval(int));
}

function stageSequence() {
  feedback("Memorize sequence: 2 → 4 → 1 → 3");
  const seq = [2, 4, 1, 3];
  let step = 0;
  const wrap = document.createElement("div");
  wrap.className = "controls";

  for (let i = 1; i <= 4; i++) {
    const b = button(String(i), "seq-btn choice");
    b.addEventListener("click", () => {
      if (seq[step] === i) {
        b.classList.add("good");
        step += 1;
        if (step === seq.length) nextStage();
      } else {
        fail("Wrong order. Memory lock reset.", `Pressed ${i} in sequence stage`);
      }
    });
    wrap.append(b);
  }

  const fakeHint = button("Auto-Solve", "trap");
  fakeHint.addEventListener("click", () => fail("Auto-Solve is decorative sabotage.", "Clicked Auto-Solve"));
  els.gameArea.append(wrap, document.createElement("br"), fakeHint);
}

function stageFinalDoor() {
  feedback("Hold the key for 5 seconds. Releasing early fails.");
  const hold = button("Hold to Open Final Door", "target");
  const meter = document.createElement("div");
  meter.className = "progress-wrap";
  const fill = document.createElement("div");
  fill.className = "bar bar--true";
  meter.append(fill);

  let start = 0;
  let rafId = 0;
  const needed = state.brutal ? 6500 : 5000;

  const stop = (success) => {
    cancelAnimationFrame(rafId);
    if (success) {
      state.achievements.add("Final Discipline");
      nextStage();
    } else {
      fail("Released too early. Final door remains shut.", "Released hold early");
    }
  };

  const loop = () => {
    const ratio = Math.min(1, (Date.now() - start) / needed);
    fill.style.width = `${Math.round(ratio * 100)}%`;
    if (ratio >= 1) stop(true);
    else rafId = requestAnimationFrame(loop);
  };

  const onDown = (e) => {
    e.preventDefault();
    start = Date.now();
    rafId = requestAnimationFrame(loop);
  };
  const onUp = () => stop(false);

  hold.addEventListener("mousedown", onDown);
  hold.addEventListener("touchstart", onDown, { passive: false });
  hold.addEventListener("mouseup", onUp);
  hold.addEventListener("mouseleave", onUp);
  hold.addEventListener("touchend", onUp);

  els.gameArea.append(hold, meter);
}

function nextStage() {
  if (state.stage === 3) state.achievements.add("Zen Candidate");
  if (state.stage === 4) state.achievements.add("Pulse Reader");
  if (state.stage === 5) state.achievements.add("Memory Under Pressure");
  state.stage += 1;
  if (!state.reducedMotion) els.gameArea.classList.add("shake");
  setTimeout(() => els.gameArea.classList.remove("shake"), 260);
  renderStage();
}

function fail(message, move) {
  state.fails += 1;
  state.impatientMove = move;
  feedback(message);
  if (!state.reducedMotion) els.gameArea.classList.add("shake");
  setTimeout(() => els.gameArea.classList.remove("shake"), 260);
  updateStats();
  save();
  renderStage();
}

function victory() {
  feedback("ACCESS GRANTED. You endured what others rushed.");
  const t = Date.now() - state.runStart + state.totalTimeMs;
  const patienceScore = Math.max(1, Math.floor((100000 / Math.max(1, t)) + (300 - state.fails * 12)));

  state.board.push({
    name: "You",
    time: t,
    fails: state.fails,
    patience: patienceScore,
  });

  state.board = [...seedBoard(), ...state.board].slice(-20);

  const win = document.createElement("div");
  win.innerHTML = `
    <h3>Final Door Open</h3>
    <p>You finished in <strong>${msToClock(t)}</strong> with <strong>${state.fails}</strong> fails.</p>
    <p class="kicker">Patience Score: ${patienceScore}</p>
    <button class="btn btn--primary" id="play-again">Play Again</button>
  `;
  els.gameArea.append(win);
  document.getElementById("play-again").addEventListener("click", () => startGame(true));
  renderBoard();
  updateStats();
  save();
}

function button(text, cls) {
  const btn = document.createElement("button");
  btn.className = cls;
  btn.textContent = text;
  return btn;
}

function feedback(text) {
  els.feedback.textContent = text;
}

function updateStats() {
  els.statAttempts.textContent = state.attempts;
  els.statFails.textContent = state.fails;
  els.statBest.textContent = `${state.bestProgress}%`;
  els.statImpatient.textContent = state.impatientMove;
  els.statAchievements.textContent = `${state.achievements.size} / 4`;
}

function renderBoard() {
  const mode = els.sortBoard.value;
  const rows = [...seedBoard(), ...state.board];
  rows.sort((a, b) => {
    if (mode === "fails") return a.fails - b.fails;
    if (mode === "patience") return b.patience - a.patience;
    return a.time - b.time;
  });
  els.boardBody.innerHTML = rows.slice(0, 8).map((r, i) => `
    <tr><td>${i + 1}</td><td>${r.name}</td><td>${msToClock(r.time)}</td><td>${r.fails}</td><td>${r.patience}</td></tr>
  `).join("");
}

function seedBoard() {
  return [
    { name: "Nox", time: 132000, fails: 4, patience: 355 },
    { name: "Vee", time: 178000, fails: 1, patience: 420 },
    { name: "Arc", time: 118000, fails: 6, patience: 297 },
  ];
}

function cleanupOnStageChange(cb) {
  const current = state.stage;
  setTimeout(() => {
    const watch = setInterval(() => {
      if (state.stage !== current) {
        cb();
        clearInterval(watch);
      }
    }, 50);
  }, 0);
}

function msToClock(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function speak(text) {
  if (!state.sound || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return renderBoard();
    const data = JSON.parse(raw);
    state.attempts = data.attempts || 0;
    state.fails = data.fails || 0;
    state.bestProgress = data.bestProgress || 0;
    state.impatientMove = data.impatientMove || "None yet";
    state.sound = Boolean(data.sound);
    state.brutal = Boolean(data.brutal);
    state.reducedMotion = Boolean(data.reducedMotion);
    state.board = data.board || [];
    state.achievements = new Set(data.achievements || []);
    els.reducedToggle.checked = state.reducedMotion;
    els.difficultyToggle.checked = state.brutal;
    renderBoard();
  } catch {
    feedback("Save data looked corrupted. Starting fresh.");
    renderBoard();
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      attempts: state.attempts,
      fails: state.fails,
      bestProgress: state.bestProgress,
      impatientMove: state.impatientMove,
      sound: state.sound,
      brutal: state.brutal,
      reducedMotion: state.reducedMotion,
      achievements: [...state.achievements],
      board: state.board,
    }),
  );
}
