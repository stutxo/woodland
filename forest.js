const canvas = document.querySelector("#forest-wordmark");
const context = canvas.getContext("2d");
const mask = document.createElement("canvas");
const maskContext = mask.getContext("2d", { willReadFrequently: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const phrase = "woodland.sh";
const textFont = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const emojiFont = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const pointer = {
  active: false,
  direction: 1,
  energy: 0.25,
  lastTime: 0,
  lastX: 0,
  x: -1000,
  y: -1000,
};

let trees = [];
let width = 0;
let height = 0;
let animationFrame = 0;

function fontAt(size) {
  return `900 ${size}px ${textFont}`;
}

function plantForest() {
  const bounds = canvas.getBoundingClientRect();
  const nextWidth = Math.max(1, Math.round(bounds.width));
  const nextHeight = Math.max(1, Math.round(bounds.height));

  if (nextWidth === width && nextHeight === height) return;

  width = nextWidth;
  height = nextHeight;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  mask.width = width;
  mask.height = height;
  maskContext.clearRect(0, 0, width, height);

  const fontSize = height * 0.94;
  maskContext.font = fontAt(fontSize);
  maskContext.fillStyle = "#fff";
  maskContext.textAlign = "center";
  maskContext.textBaseline = "alphabetic";

  const metrics = maskContext.measureText(phrase);
  const horizontalScale = Math.min(1, (width * 0.95) / metrics.width);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const baseline = (height + ascent - descent) / 2;
  maskContext.save();
  maskContext.translate(width / 2, 0);
  maskContext.scale(horizontalScale, 1);
  maskContext.fillText(phrase, 0, baseline);
  maskContext.restore();

  const pixels = maskContext.getImageData(0, 0, width, height).data;
  const treeSize = Math.max(6, Math.min(30, width / 64));
  const stepX = treeSize * 0.76;
  const stepY = treeSize * 0.74;
  const nextTrees = [];
  let row = 0;

  for (let y = treeSize * 0.5; y < height; y += stepY) {
    const stagger = (row % 2) * stepX * 0.32;

    for (let x = treeSize * 0.5 + stagger; x < width; x += stepX) {
      const pixelX = Math.min(width - 1, Math.round(x));
      const pixelY = Math.min(height - 1, Math.round(y));
      const alpha = pixels[(pixelY * width + pixelX) * 4 + 3];

      if (alpha < 96) continue;

      const index = nextTrees.length;
      const variation = (index * 17 + row * 11) % 23;

      nextTrees.push({
        x,
        y,
        size: treeSize,
        scale: 0.94 + (variation % 7) * 0.018,
        phase: x * 0.025 + y * 0.04 + index * 0.13,
        speed: 0.88 + (variation % 5) * 0.045,
        wind: 0,
        lift: 0,
        lean: 0,
      });
    }

    row += 1;
  }

  trees = nextTrees;
  drawForest(performance.now());
}

function drawForest(time) {
  context.clearRect(0, 0, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";

  const radius = Math.max(72, Math.min(190, width * 0.14));

  for (const tree of trees) {
    let influence = 0;

    if (pointer.active) {
      const distanceX = (tree.x - pointer.x) / radius;
      const distanceY = (tree.y - pointer.y) / (radius * 0.62);
      const distance = Math.hypot(distanceX, distanceY);
      influence = Math.max(0, 1 - distance) ** 2;
    }

    const targetWind = pointer.direction * influence * tree.size * (0.2 + pointer.energy * 0.34);
    const targetLift = -influence * tree.size * 0.1;
    const targetLean = pointer.direction * influence * (0.055 + pointer.energy * 0.1);

    tree.wind += (targetWind - tree.wind) * 0.11;
    tree.lift += (targetLift - tree.lift) * 0.1;
    tree.lean += (targetLean - tree.lean) * 0.1;

    const ambient = reducedMotion.matches ? 0 : Math.sin(time * 0.00058 * tree.speed + tree.phase);
    const ambientX = ambient * tree.size * 0.018;
    const ambientY = ambient * tree.size * -0.012;
    const ambientLean = ambient * 0.018;

    context.save();
    context.translate(tree.x + tree.wind + ambientX, tree.y + tree.lift + ambientY + tree.size * 0.36);
    context.rotate(tree.lean + ambientLean);
    context.translate(0, tree.size * -0.36);
    context.font = `${tree.size * tree.scale}px ${emojiFont}`;
    context.fillText("🌲", 0, 0);
    context.restore();
  }

  pointer.energy += (0.25 - pointer.energy) * 0.025;
}

function animate(time) {
  drawForest(time);
  animationFrame = requestAnimationFrame(animate);
}

function updatePointer(event) {
  if (event.pointerType === "touch") return;

  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  const elapsed = Math.max(1, event.timeStamp - pointer.lastTime);
  const velocity = (x - pointer.lastX) / elapsed;

  if (Math.abs(velocity) > 0.025) pointer.direction = Math.sign(velocity);

  pointer.active = true;
  pointer.energy = Math.min(1, 0.35 + Math.abs(velocity) * 7);
  pointer.lastTime = event.timeStamp;
  pointer.lastX = x;
  pointer.x = x;
  pointer.y = y;
}

canvas.addEventListener("pointerenter", updatePointer);
canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
});

new ResizeObserver(plantForest).observe(canvas);

reducedMotion.addEventListener("change", () => {
  cancelAnimationFrame(animationFrame);

  if (reducedMotion.matches) {
    drawForest(0);
  } else {
    animationFrame = requestAnimationFrame(animate);
  }
});

plantForest();

if (!reducedMotion.matches) {
  animationFrame = requestAnimationFrame(animate);
}
