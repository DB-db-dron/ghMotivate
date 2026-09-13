import { formatShort } from "../lib/contributions.js";

function formatIsoShort(iso) {
  const d = new Date(iso);
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
}

export function renderBreakdown(container, breakdown) {
  container.innerHTML = "";

  const items = breakdown
    ? [
        ["📝", breakdown.commits, "commits"],
        ["🔀", breakdown.prsOpened, "PRs opened"],
        ["✅", breakdown.prsMerged, "PRs merged"],
        ["🔍", breakdown.reviews, "reviews"],
      ].filter(([, value]) => value)
    : [];

  if (items.length === 0) {
    const note = document.createElement("div");
    note.className = "gm-breakdown-window";
    note.textContent = "No recent public PR/issue/review activity found.";
    container.appendChild(note);
    return;
  }

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

  const card = document.createElement("div");
  card.className = "gm-recap";

  const dismiss = document.createElement("button");
  dismiss.className = "icon-btn gm-recap-dismiss";
  dismiss.textContent = "✕";
  dismiss.title = "Dismiss";
  dismiss.addEventListener("click", () => {
    card.remove();
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
  container.appendChild(card);
}

export function renderLeaderboard(container, state, { onSelect, onSetPrimary, onRemove, selected } = {}) {
  container.innerHTML = "";
  if (state.profiles.length === 0) return;

  const rows = [...state.profiles].sort((a, b) => {
    const totalA = state.dataByUser[a.username]?.totalLastYear || 0;
    const totalB = state.dataByUser[b.username]?.totalLastYear || 0;
    return totalB - totalA;
  });

  const list = document.createElement("div");
  list.className = "gm-leaderboard";

  for (const profile of rows) {
    const stats = state.statsByUser[profile.username];
    const total = state.dataByUser[profile.username]?.totalLastYear;
    const row = document.createElement("div");
    row.className = "gm-leaderboard-row" + (profile.primary ? " gm-leaderboard-row--primary" : "");
    if (selected === profile.username) row.style.outline = "1px solid var(--accent)";

    const name = document.createElement("div");
    name.className = "gm-leaderboard-name";

    const star = document.createElement("button");
    star.className = "gm-star";
    star.textContent = profile.primary ? "★" : "☆";
    star.title = profile.primary ? "Primary profile" : "Set as primary";
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      onSetPrimary?.(profile.username);
    });

    const label = document.createElement("span");
    label.textContent = profile.label ? `${profile.label} (@${profile.username})` : `@${profile.username}`;

    name.append(star, label);

    const statsEl = document.createElement("div");
    statsEl.className = "gm-leaderboard-stats";
    statsEl.textContent = stats
      ? `${total ?? "—"} total · ${stats.currentStreak}d streak`
      : "loading…";

    const remove = document.createElement("button");
    remove.className = "gm-remove";
    remove.textContent = "✕";
    remove.title = "Stop tracking";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      onRemove?.(profile.username);
    });

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";
    right.append(statsEl, remove);

    row.append(name, right);
    row.addEventListener("click", () => onSelect?.(profile.username));
    list.appendChild(row);
  }

  container.appendChild(list);
}
