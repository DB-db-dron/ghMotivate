import { formatShort } from "../lib/contributions.js";

function formatIsoShort(iso) {
  const d = new Date(iso);
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
}

export function renderBreakdown(container, breakdown) {
  container.innerHTML = "";

  const items = [
    ["📝", breakdown?.commits ?? 0, "commits"],
    ["🔀", breakdown?.prsOpened ?? 0, "PRs opened"],
    ["✅", breakdown?.prsMerged ?? 0, "PRs merged"],
    ["🔍", breakdown?.reviews ?? 0, "reviews"],
  ];

  const chips = document.createElement("div");
  chips.className = "gm-breakdown";
  if (breakdown.windowStart) {
    chips.title = `Recent public activity, ${formatIsoShort(breakdown.windowStart)} – ${formatIsoShort(breakdown.windowEnd)} (from GitHub's public events API, which only covers roughly the last 300 public events).`;
  }
  for (const [icon, value, label] of items) {
    const chip = document.createElement("span");
    chip.className = "gm-chip";
    chip.textContent = `${icon} ${value} ${label}`;
    chips.appendChild(chip);
  }
  container.appendChild(chips);
}

export function renderRecapCard(container, recap, { onDismiss } = {}) {
  container.innerHTML = "";
  if (!recap) return;

  const overlay = document.createElement("div");
  overlay.className = "gm-recap-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
      onDismiss?.();
    }
  });

  const card = document.createElement("div");
  card.className = "gm-recap";

  const dismiss = document.createElement("button");
  dismiss.className = "icon-btn gm-recap-dismiss";
  dismiss.textContent = "✕";
  dismiss.title = "Dismiss";
  dismiss.addEventListener("click", () => {
    overlay.remove();
    onDismiss?.();
  });

  const title = document.createElement("div");
  title.className = "gm-recap-title";
  title.textContent = recap.period === "week" ? "Your week in review" : "Your month in review";

  const body = document.createElement("div");
  body.className = "gm-recap-body";
  const range = `${formatShort(recap.start)} – ${formatShort(recap.end)}`;
  const bestLine = recap.bestDay ? ` Best day: ${formatShort(recap.bestDay.date)} with ${recap.bestDay.count}.` : "";
  body.textContent = `${recap.total} contributions, ${range}.${bestLine}`;

  card.append(dismiss, title, body);
  overlay.appendChild(card);
  container.appendChild(overlay);
}
