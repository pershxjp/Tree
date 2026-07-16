// Replace this text with your own message. Keep the backticks for multiline text.
const loveMessage = `My Sweets, Pooks, Coco, Opal, and Cinnamon ❤️,

I know we haven't felt as connected lately, and I miss us more than I can put into words. I just want you to know that no amount of distance could ever change how much you mean to me.

You're still my cutie patootie, my safe place, and the person I want to choose every single day. I love you so much, and you're still my favorite person, and I can't wait to make even more memories with you.

Always yours. ❤️`;

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d", { alpha: false });
const messageBox = document.getElementById("messageBox");
const messageText = document.getElementById("messageText");
const replayButton = document.getElementById("replayButton");
const ambientAudio = document.getElementById("ambientAudio");

const timeline = {
  heartAppears: 1000,
  heartFalls: 2000,
  heartLands: 3200,
  heartGone: 3900,
  treeDone: 7000,
  leavesDone: 11300,
  messageStarts: 11800
};

const heartColors = [
  "#ffd1df",
  "#ff9bbb",
  "#ff6fa3",
  "#ff3f8a",
  "#e92d67",
  "#ff6b5f",
  "#ff8f7f",
  "#f52255"
];

let width = 0;
let height = 0;
let dpr = 1;
let layout = {};
let tree = null;
let stars = [];
let sinkParticles = [];
let ambientHearts = [];
let ambientSparkles = [];
let startTime = 0;
let lastFrameTime = 0;
let messageStarted = false;
let animationFinished = false;
let typingTimer = 0;
let heartSpawnClock = 0;
let sparkleSpawnClock = 0;

const unitHeart = createUnitHeartPath();

function createRng(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createUnitHeartPath() {
  const path = new Path2D();
  const steps = 72;

  for (let i = 0; i <= steps; i += 1) {
    const t = (Math.PI * 2 * i) / steps;
    const x = (16 * Math.pow(Math.sin(t), 3)) / 18;
    const y = -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    ) / 18;

    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }

  path.closePath();
  return path;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function easeInQuad(t) {
  return t * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function smoothstep(t) {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const narrow = width < 720;
  const groundY = Math.round(height * (narrow ? 0.79 : 0.82));
  const treeHeight = clamp(
    Math.min(height * (narrow ? 0.49 : 0.54), width * (narrow ? 0.78 : 0.43)),
    250,
    430
  );
  const heartSize = clamp(treeHeight * 0.078, 21, 36);

  layout = {
    narrow,
    groundY,
    baseX: width / 2,
    treeHeight,
    groundWidth: Math.min(width * (narrow ? 0.82 : 0.7), 920),
    heartSize,
    heartFloatY: groundY - treeHeight * 0.58,
    heartImpactY: groundY - heartSize * 0.9
  };

  stars = createStars();
  tree = createTree();
}

function createStars() {
  const rng = createRng(90817);
  const count = width < 720 ? 58 : 110;
  return Array.from({ length: count }, () => ({
    x: rng(),
    y: rng() * 0.78,
    r: 0.35 + rng() * 1.15,
    phase: rng() * Math.PI * 2,
    speed: 0.0004 + rng() * 0.0009,
    alpha: 0.12 + rng() * 0.55
  }));
}

function createTree() {
  const rng = createRng(271828);
  const branches = [];

  function addBranch(sx, sy, ex, ey, widthNorm, level, bend = 0) {
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const dx = ex - sx;
    const dy = ey - sy;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;

    branches.push({
      sx,
      sy,
      ex,
      ey,
      cx: mx + normalX * bend,
      cy: my + normalY * bend,
      widthNorm,
      level,
      phase: 0
    });
  }

  function growBranch(sx, sy, angle, lengthNorm, depth, widthNorm, level) {
    if (depth <= 0 || lengthNorm < 0.035) return;

    const ex = sx + Math.cos(angle) * lengthNorm;
    const ey = sy + Math.sin(angle) * lengthNorm;
    const bend = (rng() - 0.5) * 0.055 * (depth / 5);
    addBranch(sx, sy, ex, ey, widthNorm, level, bend);

    const spread = 0.48 + rng() * 0.42;
    const nextLength = lengthNorm * (0.58 + rng() * 0.07);
    const nextWidth = widthNorm * 0.68;

    growBranch(ex, ey, angle - spread, nextLength, depth - 1, nextWidth, level + 1);
    growBranch(ex, ey, angle + spread * (0.82 + rng() * 0.42), nextLength * (0.86 + rng() * 0.15), depth - 1, nextWidth, level + 1);

    if (rng() > 0.54 && depth > 2) {
      const side = rng() > 0.5 ? 1 : -1;
      growBranch(ex, ey, angle + side * (0.22 + rng() * 0.38), nextLength * 0.58, depth - 2, nextWidth * 0.82, level + 1);
    }
  }

  addBranch(0, 0, -0.012, -0.18, 0.052, 0, 0.018);
  addBranch(-0.012, -0.18, 0.01, -0.37, 0.044, 0, -0.014);
  addBranch(0.01, -0.37, 0, -0.48, 0.034, 0, 0.006);

  growBranch(-0.006, -0.17, -2.06, 0.22, 4, 0.019, 1);
  growBranch(0.004, -0.2, -1.03, 0.22, 4, 0.019, 1);
  growBranch(0.008, -0.32, -2.28, 0.24, 5, 0.016, 1);
  growBranch(0.002, -0.34, -0.82, 0.25, 5, 0.016, 1);
  growBranch(0, -0.47, -1.58, 0.2, 4, 0.014, 1);

  branches.forEach((branch, index) => {
    branch.phase = Math.min(0.78, index / Math.max(1, branches.length - 1) * 0.76);
  });

  const endpoints = branches
    .filter((branch) => branch.level >= 2)
    .map((branch) => ({ x: branch.ex, y: branch.ey }));

  return {
    branches,
    leaves: createHeartLeaves(rng, endpoints),
    sparkles: createTreeSparkles(rng)
  };
}

function createHeartLeaves(rng, endpoints) {
const count = width < 720 ? 650 : 950;
  const leaves = [];
  let attempts = 0;

  while (leaves.length < count && attempts < count * 80) {
    attempts += 1;
    const hx = -1.22 + rng() * 2.44;
    const hy = -1.08 + rng() * 2.34;
    const insideHeart = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * hy * hy * hy <= 0;

    if (!insideHeart) continue;

    const tx = hx * 0.56 + (rng() - 0.5) * 0.010;
const ty = -0.66 - hy * 0.40 + (rng() - 0.5) * 0.010;
    let source = endpoints[Math.floor(rng() * endpoints.length)] || { x: 0, y: -0.45 };
    let bestDistance = Infinity;

    for (let i = 0; i < Math.min(18, endpoints.length); i += 1) {
      const candidate = endpoints[Math.floor(rng() * endpoints.length)];
      const distance = Math.hypot(candidate.x - tx, candidate.y - ty);
      if (distance < bestDistance) {
        bestDistance = distance;
        source = candidate;
      }
    }

    leaves.push({
      sx: source.x,
      sy: source.y,
      tx,
      ty,
      sizeNorm: (3.4 + rng() * 5.6) / 400,
      color: heartColors[Math.floor(rng() * heartColors.length)],
      rotation: -0.35 + rng() * 0.7,
      appearAt: clamp((ty + 1.02) * 0.46 + rng() * 0.36, 0, 0.92),
      phase: rng() * Math.PI * 2,
      drift: 0.002 + rng() * 0.007,
      waveSpeed: 0.0008 + rng() * 0.0014,
      glow: rng() > 0.68 ? 6 + rng() * 7 : 2 + rng() * 3
    });
  }

  leaves.sort((a, b) => a.appearAt - b.appearAt);
  return leaves;
}

function createTreeSparkles(rng) {
  return Array.from({ length: width < 720 ? 28 : 44 }, () => ({
    x: (-0.52 + rng() * 1.04),
    y: (-0.98 + rng() * 0.68),
    size: 0.004 + rng() * 0.006,
    phase: rng() * Math.PI * 2,
    speed: 0.001 + rng() * 0.0018
  }));
}

function createSinkParticles() {
  const rng = createRng(141421);
  return Array.from({ length: 54 }, () => {
    const angle = -Math.PI + rng() * Math.PI;
    const speed = 22 + rng() * 76;
    return {
      delay: rng() * 580,
      life: 680 + rng() * 620,
      x: (rng() - 0.5) * 18,
      y: (rng() - 0.5) * 3,
      vx: Math.cos(angle) * speed * (0.24 + rng() * 0.38),
      vy: -Math.abs(Math.sin(angle) * speed) - 18,
      r: 1 + rng() * 2.7,
      color: heartColors[Math.floor(rng() * heartColors.length)]
    };
  });
}

function resetAnimation() {
  startTime = performance.now();
  lastFrameTime = startTime;
  messageStarted = false;
  animationFinished = false;
  ambientHearts = [];
  ambientSparkles = [];
  sinkParticles = createSinkParticles();
  heartSpawnClock = 0;
  sparkleSpawnClock = 0;
  clearTimeout(typingTimer);
  messageText.textContent = "";
  messageBox.classList.remove("is-visible", "is-complete");
  replayButton.classList.remove("is-visible");
}

function drawFrame(now) {
  const elapsed = now - startTime;
  const dt = Math.min(40, now - lastFrameTime);
  lastFrameTime = now;

  updateAmbient(dt, elapsed);
  drawScene(now, elapsed);

  if (!messageStarted && elapsed >= timeline.messageStarts) {
    messageStarted = true;
    startTypewriter();
  }

  if (!animationFinished && elapsed >= timeline.leavesDone + 650) {
    animationFinished = true;
    replayButton.classList.add("is-visible");
  }

  requestAnimationFrame(drawFrame);
}

function drawScene(now, elapsed) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  drawBackgroundStars(now, elapsed);
  drawTreeAura(elapsed);

  if (elapsed >= timeline.heartAppears && elapsed < timeline.heartGone) {
    drawOpeningHeart(now, elapsed);
  }

  if (elapsed >= timeline.heartLands - 80 && elapsed < timeline.heartGone + 900) {
    drawSinkParticles(now, elapsed);
  }

  if (elapsed >= timeline.heartGone) {
    const treeProgress = easeOutCubic(clamp((elapsed - timeline.heartGone) / (timeline.treeDone - timeline.heartGone)));
    const leafProgress = easeOutCubic(clamp((elapsed - timeline.treeDone) / (timeline.leavesDone - timeline.treeDone)));
    drawTree(now, treeProgress, leafProgress);
  }

  drawAmbient(now);
  drawGroundLine();
}

function drawBackgroundStars(now, elapsed) {
  const fade = smoothstep((elapsed - 2400) / 3600);
  if (fade <= 0) return;

  ctx.save();
  for (const star of stars) {
    const twinkle = 0.45 + Math.sin(now * star.speed + star.phase) * 0.55;
    ctx.globalAlpha = fade * star.alpha * twinkle * 0.58;
    ctx.fillStyle = "#fff3fa";
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTreeAura(elapsed) {
  const glow = smoothstep((elapsed - timeline.treeDone) / 2800);
  if (glow <= 0) return;

  const gradient = ctx.createRadialGradient(
    layout.baseX,
    layout.groundY - layout.treeHeight * 0.58,
    layout.treeHeight * 0.08,
    layout.baseX,
    layout.groundY - layout.treeHeight * 0.58,
    layout.treeHeight * 0.88
  );
  gradient.addColorStop(0, `rgba(255, 82, 146, ${0.12 * glow})`);
  gradient.addColorStop(0.55, `rgba(255, 82, 146, ${0.035 * glow})`);
  gradient.addColorStop(1, "rgba(255, 82, 146, 0)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawOpeningHeart(now, elapsed) {
  const size = layout.heartSize;
  let x = layout.baseX;
  let y = layout.heartFloatY;
  let alpha = 1;
  let scaleX = 1;
  let scaleY = 1;
  let rotation = Math.sin(now * 0.0013) * 0.035;

  if (elapsed < timeline.heartFalls) {
    const appear = easeOutCubic(clamp((elapsed - timeline.heartAppears) / (timeline.heartFalls - timeline.heartAppears)));
    alpha = appear;
    y += Math.sin(now * 0.0022) * 7;
    scaleX = 0.88 + appear * 0.12 + Math.sin(now * 0.005) * 0.035;
    scaleY = 0.88 + appear * 0.12 + Math.sin(now * 0.005) * 0.035;
  } else if (elapsed < timeline.heartLands) {
    const fall = clamp((elapsed - timeline.heartFalls) / (timeline.heartLands - timeline.heartFalls));
    y = lerp(layout.heartFloatY, layout.heartImpactY, easeInQuad(fall));
    rotation += lerp(0, 0.12, fall) * Math.sin(fall * Math.PI);
  } else {
    const sink = clamp((elapsed - timeline.heartLands) / (timeline.heartGone - timeline.heartLands));
    const sinkEase = easeInOutSine(sink);
    const squash = clamp(1 - sink / 0.28);
    y = layout.heartImpactY + sinkEase * size * 1.95;
    scaleX = 1 + squash * 0.32 - sinkEase * 0.1;
    scaleY = 1 - squash * 0.34 - sinkEase * 0.52;
    alpha = 1 - Math.pow(sink, 1.35);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, layout.groundY + 1);
    ctx.clip();
    drawHeart(x, y, size, "#ff4f9a", alpha, scaleX, scaleY, rotation, 28);
    ctx.restore();
    return;
  }

  drawHeart(x, y, size, "#ff4f9a", alpha, scaleX, scaleY, rotation, 28);
}

function drawSinkParticles(now, elapsed) {
  const baseElapsed = elapsed - timeline.heartLands;
  const gravity = 85;

  ctx.save();
  ctx.translate(layout.baseX, layout.groundY);

  for (const particle of sinkParticles) {
    const age = baseElapsed - particle.delay;
    if (age <= 0 || age > particle.life) continue;

    const t = age / particle.life;
    const seconds = age / 1000;
    const x = particle.x + particle.vx * seconds;
    const y = particle.y + particle.vy * seconds + gravity * seconds * seconds;
    const alpha = (1 - t) * 0.85;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTree(now, treeProgress, leafProgress) {
  const sway = Math.sin(now * 0.001) * (leafProgress >= 1 ? 0.007 : 0.0025 * treeProgress);

  ctx.save();
  ctx.translate(layout.baseX, layout.groundY);
  ctx.rotate(sway);
  drawBranches(treeProgress);

  if (leafProgress > 0) {
    drawLeaves(now, leafProgress);
    drawTreeSparkles(now, leafProgress);
  }

  ctx.restore();
}

function drawBranches(progress) {
  const h = layout.treeHeight;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(190, 92, 56, 0.26)";
  ctx.shadowBlur = 5;

  for (const branch of tree.branches) {
    const local = clamp((progress - branch.phase) / 0.22);
    if (local <= 0) continue;

    const amount = easeOutCubic(local);
    const widthPx = Math.max(1.15, branch.widthNorm * h * (0.9 + 0.1 * amount));
    const warm = branch.level <= 1 ? "#744028" : "#8b5131";

    ctx.strokeStyle = warm;
    ctx.lineWidth = widthPx;
    drawPartialQuadratic(branch, amount, h);

    ctx.strokeStyle = "rgba(255, 184, 132, 0.12)";
    ctx.lineWidth = Math.max(0.5, widthPx * 0.26);
    drawPartialQuadratic(branch, amount, h, -0.14);
  }

  ctx.restore();
}

function drawPartialQuadratic(branch, amount, scale, highlightShift = 0) {
  const steps = Math.max(4, Math.ceil(18 * amount));

  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = (amount * i) / steps;
    const x = quadratic(branch.sx, branch.cx, branch.ex, t) * scale + highlightShift;
    const y = quadratic(branch.sy, branch.cy, branch.ey, t) * scale;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function quadratic(start, control, end, t) {
  return (1 - t) * (1 - t) * start + 2 * (1 - t) * t * control + t * t * end;
}

function drawLeaves(now, progress) {
  const h = layout.treeHeight;

  for (const leaf of tree.leaves) {
    const local = clamp((progress - leaf.appearAt) / 0.14);
    if (local <= 0) continue;

    const settle = easeOutCubic(local);
    const bloom = clamp(easeOutBack(local), 0, 1.28);
    const drift = Math.sin(now * leaf.waveSpeed + leaf.phase) * leaf.drift;
    const x = lerp(leaf.sx, leaf.tx, settle) * h;
    const y = (lerp(leaf.sy, leaf.ty, settle) + drift * progress) * h;
    const size = leaf.sizeNorm * h * (0.22 + 0.78 * bloom);
    const alpha = clamp(local * 1.18);
    const rotation = leaf.rotation + Math.sin(now * 0.0014 + leaf.phase) * 0.055 * progress;

    drawHeart(x, y, size, leaf.color, alpha, 1, 1, rotation, leaf.glow);
  }
}

function drawTreeSparkles(now, progress) {
  const h = layout.treeHeight;
  const alphaBase = smoothstep((progress - 0.16) / 0.7);

  ctx.save();
  ctx.lineCap = "round";
  for (const sparkle of tree.sparkles) {
    const twinkle = 0.5 + Math.sin(now * sparkle.speed + sparkle.phase) * 0.5;
    const alpha = alphaBase * twinkle * 0.42;
    if (alpha <= 0.02) continue;
    drawSparkle(sparkle.x * h, sparkle.y * h, sparkle.size * h, alpha);
  }
  ctx.restore();
}

function updateAmbient(dt, elapsed) {
  if (elapsed <= timeline.leavesDone) return;

  heartSpawnClock += dt;
  sparkleSpawnClock += dt;

  while (heartSpawnClock > 460) {
    heartSpawnClock -= 460;
    ambientHearts.push(createAmbientHeart());
  }

  while (sparkleSpawnClock > 720) {
    sparkleSpawnClock -= 720;
    ambientSparkles.push(createAmbientSparkle());
  }

  for (const item of ambientHearts) item.age += dt;
  for (const item of ambientSparkles) item.age += dt;

  ambientHearts = ambientHearts.filter((item) => item.age < item.life);
  ambientSparkles = ambientSparkles.filter((item) => item.age < item.life);
}

function createAmbientHeart() {
  const rng = Math.random;
  const spread = layout.treeHeight * 0.42;
  return {
    age: 0,
    life: 5200 + rng() * 2600,
    x: layout.baseX + (rng() - 0.5) * spread,
    y: layout.groundY - layout.treeHeight * (0.22 + rng() * 0.46),
    vx: (rng() - 0.5) * 10,
    vy: -(10 + rng() * 18),
    size: 3 + rng() * 4.8,
    color: heartColors[Math.floor(rng() * heartColors.length)],
    phase: rng() * Math.PI * 2
  };
}

function createAmbientSparkle() {
  const rng = Math.random;
  return {
    age: 0,
    life: 1200 + rng() * 1400,
    x: layout.baseX + (rng() - 0.5) * layout.treeHeight * 1.05,
    y: layout.groundY - layout.treeHeight * (0.32 + rng() * 0.66),
    size: 2 + rng() * 3.5,
    phase: rng() * Math.PI * 2
  };
}

function drawAmbient(now) {
  ctx.save();

  for (const heart of ambientHearts) {
    const t = heart.age / heart.life;
    const seconds = heart.age / 1000;
    const x = heart.x + heart.vx * seconds + Math.sin(now * 0.001 + heart.phase) * 8;
    const y = heart.y + heart.vy * seconds - easeOutCubic(t) * 34;
    const alpha = Math.sin(Math.PI * t) * 0.7;
    drawHeart(x, y, heart.size, heart.color, alpha, 1, 1, Math.sin(now * 0.001 + heart.phase) * 0.25, 7);
  }

  for (const sparkle of ambientSparkles) {
    const t = sparkle.age / sparkle.life;
    const alpha = Math.sin(Math.PI * t) * 0.5;
    drawSparkle(sparkle.x, sparkle.y, sparkle.size, alpha);
  }

  ctx.restore();
}

function drawGroundLine() {
  const half = layout.groundWidth / 2;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
  ctx.lineWidth = width < 720 ? 1.35 : 1.6;
  ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(layout.baseX - half, layout.groundY);
  ctx.lineTo(layout.baseX + half, layout.groundY);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(x, y, size, color, alpha = 1, scaleX = 1, scaleY = 1, rotation = 0, glow = 0) {
  if (alpha <= 0 || size <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(size * scaleX, size * scaleY);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fill(unitHeart);
  ctx.restore();
}

function drawSparkle(x, y, size, alpha) {
  if (alpha <= 0) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#fff4fb";
  ctx.lineWidth = 0.9;
  ctx.shadowColor = "rgba(255, 197, 224, 0.8)";
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(size, 0);
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.stroke();
  ctx.restore();
}

function startTypewriter() {
  messageBox.classList.add("is-visible");
  messageText.textContent = "";
  messageBox.classList.remove("is-complete");

  let index = 0;
  const characters = [...loveMessage];

  function typeNext() {
    if (index >= characters.length) {
      messageBox.classList.add("is-complete");
      return;
    }

    messageText.textContent += characters[index];
    const current = characters[index];
    index += 1;

    const delay = current === "\n" ? 420 : current === "." || current === "," ? 95 : 42;
    typingTimer = window.setTimeout(typeNext, delay);
  }

  typingTimer = window.setTimeout(typeNext, 360);
}

function setupAudioUnlock() {
  if (!ambientAudio) return;
  ambientAudio.volume = 0.28;

  const tryPlay = () => {
    ambientAudio.play().catch(() => {
      // The animation works without audio; browsers may block or the placeholder may be absent.
    });
  };

  window.addEventListener("pointerdown", tryPlay, { once: true });
  window.addEventListener("keydown", tryPlay, { once: true });
}

window.addEventListener("resize", resize);
replayButton.addEventListener("click", () => {
  resetAnimation();
  ambientAudio?.play().catch(() => {});
});

resize();
resetAnimation();
setupAudioUnlock();
requestAnimationFrame(drawFrame);
