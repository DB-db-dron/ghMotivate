import { renderHeatmap } from "./ui/heatmap.js";
import { burstConfetti } from "./ui/confetti.js";
import { renderBreakdown, renderRecapCard, renderLeaderboard } from "./ui/components.js";

const setupView = document.getElementById("setupView");
const mainView = document.getElementById("mainView");
const setupForm = document.getElementById("setupForm");
const usernameInput = document.getElementById("usernameInput");
const refreshBtn = document.getElementById("refreshBtn");
const errorBanner = document.getElementById("errorBanner");
const celebration = document.getElementById("celebration");
const addProfileForm = document.getElementById("addProfileForm");
const addProfileInput = document.getElementById("addProfileInput");

let selectedUsername = null;

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function pickSelected(profiles) {
  if (selectedUsername && profiles.some((p) => p.username === selectedUsername)) return selectedUsername;
  const primary = profiles.find((p) => p.primary) || profiles[0];
  return primary?.username || null;
}

async function maybeCelebrate(state) {
  const pending = state.pendingCelebrations;
  if (!pending || pending.length === 0) return;
  const first = pending[0];

  celebration.hidden = false;
  celebration.innerHTML = "";
  const title = document.createElement("div");
  title.className = "gm-recap-title";
  title.textContent = `🎉 ${first.title}`;
  const body = document.createElement("div");
  body.className = "gm-recap-body";
  body.textContent = first.message;
  celebration.append(title, body);

  burstConfetti();
  await chrome.storage.local.set({ pendingCelebrations: [] });
}

async function dismissRecap(key) {
  const { dismissedRecaps = [] } = await chrome.storage.local.get("dismissedRecaps");
  await chrome.storage.local.set({ dismissedRecaps: [...dismissedRecaps, key] });
}

async function render() {
  const state = await chrome.storage.local.get(null);
  const profiles = state.profiles || [];

  if (profiles.length === 0) {
    setupView.hidden = false;
    mainView.hidden = true;
    return;
  }
  setupView.hidden = true;
  mainView.hidden = false;

  selectedUsername = pickSelected(profiles);
  const selectedProfile = profiles.find((p) => p.username === selectedUsername);
  const isPrimary = !!selectedProfile?.primary;

  const data = (state.dataByUser || {})[selectedUsername];
  const stats = (state.statsByUser || {})[selectedUsername];
  const error = (state.errorsByUser || {})[selectedUsername];

  document.getElementById("profileHeading").textContent = selectedProfile?.label
    ? `${selectedProfile.label} (@${selectedUsername})`
    : `@${selectedUsername}`;

  errorBanner.hidden = !error;
  if (error) errorBanner.textContent = `Couldn't load @${selectedUsername} (${error}). Check the username, and that you're logged into github.com.`;

  document.getElementById("todayCount").textContent = stats?.today ?? 0;
  document.getElementById("currentStreak").textContent = stats?.currentStreak ?? 0;
  document.getElementById("longestStreak").textContent = stats?.longestStreak ?? 0;
  document.getElementById("totalYear").textContent = data?.totalLastYear ?? "—";

  const recapSlot = document.getElementById("recapSlot");
  recapSlot.innerHTML = "";
  if (isPrimary) {
    const dismissed = state.dismissedRecaps || [];
    const recap = [...(state.recaps?.weekly || []), ...(state.recaps?.monthly || [])]
      .filter((r) => !dismissed.includes(r.key))
      .sort((a, b) => b.generatedAt - a.generatedAt)[0];
    if (recap) renderRecapCard(recapSlot, recap, { onDismiss: () => dismissRecap(recap.key) });
  }

  const breakdownSlot = document.getElementById("breakdownSlot");
  breakdownSlot.innerHTML = "";
  if (isPrimary) {
    renderBreakdown(breakdownSlot, (state.breakdownByUser || {})[selectedUsername]);
  } else {
    const note = document.createElement("div");
    note.className = "gm-breakdown-window";
    note.textContent = "PR/issue/review breakdown is only fetched for your primary profile.";
    breakdownSlot.appendChild(note);
  }

  renderHeatmap(document.getElementById("heatmap"), data?.days || {}, { weeks: 52, cellSize: 15, gap: 2 });

  renderLeaderboard(document.getElementById("leaderboardSlot"), state, {
    selected: selectedUsername,
    onSelect: (u) => {
      selectedUsername = u;
      render();
    },
    onSetPrimary: (u) => chrome.runtime.sendMessage({ type: "set-primary", username: u }),
    onRemove: (u) => chrome.runtime.sendMessage({ type: "remove-profile", username: u }),
  });

  document.getElementById("fetchedAt").textContent = data?.fetchedAt ? `updated ${timeAgo(data.fetchedAt)}` : "";

  await maybeCelebrate(state);
}

setupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;
  setupForm.querySelector("button").disabled = true;
  await chrome.runtime.sendMessage({ type: "add-profile", username });
  setupForm.querySelector("button").disabled = false;
  render();
});

addProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = addProfileInput.value.trim();
  if (!username) return;
  addProfileInput.value = "";
  await chrome.runtime.sendMessage({ type: "add-profile", username });
  render();
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  await chrome.runtime.sendMessage({ type: "refresh" });
  refreshBtn.disabled = false;
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") render();
});

// Paint instantly from cache, then trigger a live fetch (storage.onChanged
// above re-renders once it lands) instead of only ever showing data from
// the last 10-minute alarm tick.
render();
chrome.runtime.sendMessage({ type: "refresh" });
