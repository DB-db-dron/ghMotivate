// Central storage schema. One list of "tracked profiles" covers both
// multi-account and friend-leaderboard use cases: fetching a profile's
// calendar with credentials included is always safe (GitHub only reveals
// private squares if that profile happens to be whoever is logged into this
// browser), so "you" and "a friend" are the same kind of list entry — one is
// just flagged primary, which is the one that drives the toolbar badge.

export const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  refreshMinutes: 10,
};

const EMPTY_STATE = {
  profiles: [],
  dataByUser: {},
  statsByUser: {},
  breakdownByUser: {},
  errorsByUser: {},
  milestones: {},
  recaps: { weekly: [], monthly: [] },
  settings: DEFAULT_SETTINGS,
};

/** Reads the full state, migrating the old single-username schema in place. */
export async function getState() {
  const raw = await chrome.storage.local.get(null);

  if (raw.username && !raw.profiles) {
    const migrated = {
      profiles: [{ username: raw.username, label: null, primary: true, addedAt: Date.now() }],
      dataByUser: raw.lastData ? { [raw.username]: raw.lastData } : {},
      statsByUser: raw.lastStats ? { [raw.username]: raw.lastStats } : {},
    };
    await chrome.storage.local.set(migrated);
    await chrome.storage.local.remove(["username", "lastData", "lastStats", "lastError"]);
    return normalize({ ...raw, ...migrated });
  }

  return normalize(raw);
}

function normalize(raw) {
  return {
    ...EMPTY_STATE,
    ...raw,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
  };
}

export function getPrimary(state) {
  return state.profiles.find((p) => p.primary) || state.profiles[0] || null;
}

export async function addProfile(username, label = null) {
  const state = await getState();
  const clean = username.trim().replace(/^@/, "");
  if (!clean) return state;
  if (state.profiles.some((p) => p.username.toLowerCase() === clean.toLowerCase())) return state;

  const profiles = [
    ...state.profiles,
    { username: clean, label, primary: state.profiles.length === 0, addedAt: Date.now() },
  ];
  await chrome.storage.local.set({ profiles });
  return { ...state, profiles };
}

export async function removeProfile(username) {
  const state = await getState();
  const wasPrimary = state.profiles.find((p) => p.username === username)?.primary;
  let profiles = state.profiles.filter((p) => p.username !== username);
  if (wasPrimary && profiles.length > 0) {
    profiles = profiles.map((p, i) => ({ ...p, primary: i === 0 }));
  }

  const dataByUser = { ...state.dataByUser };
  const statsByUser = { ...state.statsByUser };
  const breakdownByUser = { ...state.breakdownByUser };
  const errorsByUser = { ...state.errorsByUser };
  delete dataByUser[username];
  delete statsByUser[username];
  delete breakdownByUser[username];
  delete errorsByUser[username];

  await chrome.storage.local.set({ profiles, dataByUser, statsByUser, breakdownByUser, errorsByUser });
  return { ...state, profiles, dataByUser, statsByUser, breakdownByUser, errorsByUser };
}

export async function setPrimary(username) {
  const state = await getState();
  const profiles = state.profiles.map((p) => ({ ...p, primary: p.username === username }));
  await chrome.storage.local.set({ profiles });
  return { ...state, profiles };
}
