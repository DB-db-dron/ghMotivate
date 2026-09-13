// Carrot-only milestone detection. Never fires on the very first reading
// after install (nothing "just happened" yet) — only on a real increase
// relative to state persisted from the previous check.

const STREAK_THRESHOLDS = [7, 30, 50, 100, 200, 365];

export function detectMilestones(nextStats, prevMilestoneState = {}) {
  const state = {
    longestStreakSeen: prevMilestoneState.longestStreakSeen || 0,
    bestDayCountSeen: prevMilestoneState.bestDayCountSeen || 0,
    streakThresholdsHit: prevMilestoneState.streakThresholdsHit || [],
    lastToday: prevMilestoneState.lastToday ?? null,
  };
  const fired = [];

  if (state.lastToday === 0 && nextStats.today > 0) {
    fired.push({ key: "first-today", title: "First contribution today", message: "You're on the board for today." });
  }

  if (nextStats.currentStreak === 0) {
    state.streakThresholdsHit = [];
  } else {
    for (const t of STREAK_THRESHOLDS) {
      if (nextStats.currentStreak >= t && !state.streakThresholdsHit.includes(t)) {
        fired.push({ key: `streak-${t}`, title: `${t}-day streak`, message: `${t} days in a row.` });
        state.streakThresholdsHit = [...state.streakThresholdsHit, t];
      }
    }
  }

  if (nextStats.currentStreak > state.longestStreakSeen) {
    if (state.longestStreakSeen > 0) {
      fired.push({
        key: "streak-record",
        title: "New streak record",
        message: `${nextStats.currentStreak} days — your best yet.`,
      });
    }
    state.longestStreakSeen = nextStats.currentStreak;
  }

  if (nextStats.today > state.bestDayCountSeen) {
    if (state.bestDayCountSeen > 0) {
      fired.push({
        key: "best-day",
        title: "Most productive day yet",
        message: `${nextStats.today} contributions today — a new personal best.`,
      });
    }
    state.bestDayCountSeen = nextStats.today;
  }

  state.lastToday = nextStats.today;
  return { fired, state };
}
