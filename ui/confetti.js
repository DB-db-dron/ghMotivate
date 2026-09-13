const COLORS = ["#2da44e", "#40c463", "#ffd33d", "#fb8500", "#54aeff", "#bc8cff"];

/** A short, dependency-free confetti burst. Fire-and-forget, self-cleaning. */
export function burstConfetti() {
  const layer = document.createElement("div");
  layer.className = "gm-confetti-layer";
  document.body.appendChild(layer);

  const pieceCount = 36;
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    piece.className = "gm-confetti-piece";
    const left = Math.random() * 100;
    const delay = Math.random() * 0.25;
    const duration = 1.4 + Math.random() * 0.9;
    const drift = (Math.random() - 0.5) * 120;
    const rotation = Math.random() * 360;
    const color = COLORS[i % COLORS.length];
    piece.style.left = `${left}%`;
    piece.style.background = color;
    piece.style.animationDelay = `${delay}s`;
    piece.style.animationDuration = `${duration}s`;
    piece.style.setProperty("--gm-drift", `${drift}px`);
    piece.style.setProperty("--gm-rotate", `${rotation}deg`);
    layer.appendChild(piece);
  }

  setTimeout(() => layer.remove(), 2600);
}
