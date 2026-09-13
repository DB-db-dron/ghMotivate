import { parseContributionsHtml, computeStats } from "./lib/contributions.js";
import { fetchEventBreakdown } from "./lib/events.js";
import { getState, addProfile, removeProfile, setPrimary, getPrimary, DEFAULT_SETTINGS } from "./lib/storage.js";
import { detectMilestones } from "./lib/milestones.js";
import { maybeGenerateRecaps } from "./lib/recap.js";

const ALARM_NAME = "refresh-contributions";

function setBadge(stats, error) {
  if (error) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#d1242f" });
    return;
  }
  const count = stats?.today || 0;
  chrome.action.setBadgeText({ text: String(count) });
  chrome.action.setBadgeBackgroundColor({ color: count > 0 ? "#2da44e" : "#6e7781" });
}

async function notify(fired, notificationsEnabled) {
  if (notificationsEnabled === false) return;
  for (const m of fired) {
    chrome.notifications.create(`${m.key}-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: m.title,
      message: m.message,
    });
  }
}

async function fetchProfileCalendar(username) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const { days, totalLastYear } = parseContributionsHtml(html);
  if (Object.keys(days).length === 0) throw new Error("couldn't parse contribution data");
  return { days, totalLastYear };
}

async function refreshAll() {
  const state = await getState();
  if (state.profiles.length === 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }

  const dataByUser = { ...state.dataByUser };
  const statsByUser = { ...state.statsByUser };
  const errorsByUser = { ...state.errorsByUser };

  for (const profile of state.profiles) {
    try {
      const data = await fetchProfileCalendar(profile.username);
      dataByUser[profile.username] = { ...data, fetchedAt: Date.now() };
      statsByUser[profile.username] = computeStats(data.days);
      errorsByUser[profile.username] = null;
    } catch (err) {
      errorsByUser[profile.username] = String(err && err.message ? err.message : err);
    }
  }

  const breakdownByUser = { ...state.breakdownByUser };
  let milestones = state.milestones;
  let recaps = state.recaps;
  let pendingCelebrations;

  const primary = getPrimary(state);
  if (primary && !errorsByUser[primary.username]) {
    try {
      const breakdown = await fetchEventBreakdown(primary.username);
      breakdownByUser[primary.username] = { ...breakdown, fetchedAt: Date.now() };
    } catch {
      // best-effort: keep whatever breakdown we already had
    }

    const nextStats = statsByUser[primary.username];
    const detected = detectMilestones(nextStats, milestones);
    milestones = detected.state;
    if (detected.fired.length > 0) {
      pendingCelebrations = detected.fired;
      await notify(detected.fired, state.settings.notificationsEnabled);
    }

    const recapResult = maybeGenerateRecaps(dataByUser[primary.username].days, recaps);
    if (recapResult.changed) recaps = recapResult.recaps;
  }

  await chrome.storage.local.set({
    dataByUser,
    statsByUser,
    errorsByUser,
    breakdownByUser,
    milestones,
    recaps,
    ...(pendingCelebrations ? { pendingCelebrations } : {}),
  });

  if (primary) {
    setBadge(statsByUser[primary.username], errorsByUser[primary.username]);
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: DEFAULT_SETTINGS.refreshMinutes });
  refreshAll();
});

chrome.runtime.onStartup.addListener(() => {
  refreshAll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshAll();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "refresh":
        await refreshAll();
        sendResponse({ ok: true });
        break;
      case "add-profile":
        await addProfile(message.username, message.label);
        await refreshAll();
        sendResponse({ ok: true });
        break;
      case "remove-profile":
        await removeProfile(message.username);
        await refreshAll();
        sendResponse({ ok: true });
        break;
      case "set-primary":
        await setPrimary(message.username);
        await refreshAll();
        sendResponse({ ok: true });
        break;
      default:
        sendResponse({ ok: false, error: "unknown message" });
    }
  })();
  return true;
});
