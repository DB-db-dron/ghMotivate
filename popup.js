import { renderHeatmap } from "./ui/heatmap.js";
import { burstConfetti } from "./ui/confetti.js";
import { renderBreakdown, renderRecapCard } from "./ui/components.js";
import { renderCarousel } from "./ui/carousel.js";

const setupView = document.getElementById("setupView");
const mainView = document.getElementById("mainView");
const setupForm = document.getElementById("setupForm");
const usernameInput = document.getElementById("usernameInput");
const dashboardBtn = document.getElementById("dashboardBtn");
const refreshBtn = document.getElementById("refreshBtn");
const errorBanner = document.getElementById("errorBanner");
const celebration = document.getElementById("celebration");

let selectedUsername = null;
let adding = false;
let confirmingRemove = null;

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

  renderCarousel(document.getElementById("carouselSlot"), state, {
    selected: selectedUsername,
    adding,
    confirmingRemove,
    onSelect: (u) => {
      selectedUsername = u;
      render();
    },
    onRequestRemove: (u) => {
      confirmingRemove = u;
      adding = false;
      render();
    },
    onConfirmRemove: (u) => {
      confirmingRemove = null;
      if (u === selectedUsername) selectedUsername = null;
      chrome.runtime.sendMessage({ type: "remove-profile", username: u });
    },
    onCancelRemove: () => {
      confirmingRemove = null;
      render();
    },
    onAdd: (username) => {
      adding = false;
      selectedUsername = username.trim().replace(/^@/, "");
      chrome.runtime.sendMessage({ type: "add-profile", username });
    },
    onToggleAdd: () => {
      adding = !adding;
      confirmingRemove = null;
      render();
    },
  });

  const data = (state.dataByUser || {})[selectedUsername];
  const stats = (state.statsByUser || {})[selectedUsername];
  const error = (state.errorsByUser || {})[selectedUsername];

  errorBanner.hidden = !error;
  if (error) errorBanner.textContent = `Couldn't load @${selectedUsername} (${error}). Check the username, and that you're logged into github.com.`;

  document.getElementById("todayLabel").textContent = isPrimary ? "contributions today" : `@${selectedUsername} — today`;
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
  if (isPrimary) {
    renderBreakdown(breakdownSlot, (state.breakdownByUser || {})[selectedUsername]);
    breakdownSlot.classList.remove("gm-hidden-preserve-space");
  } else {
    // Friends never have breakdown data (fetched for the primary profile
    // only, to limit API calls). Leaving the primary's last-rendered content
    // in place and just hiding it — instead of clearing it to empty — keeps
    // this slot's height identical across every profile switch, so the
    // popup doesn't resize as you move through the carousel.
    breakdownSlot.classList.add("gm-hidden-preserve-space");
  }

  renderHeatmap(document.getElementById("heatmap"), data?.days || {}, { weeks: 16 });

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

dashboardBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
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

render();
