import { todayKey } from "./contributions.js";

function buildRecap(days, start, end, key, period) {
  let total = 0;
  let best = null;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const k = todayKey(d);
    const count = days[k] || 0;
    total += count;
    if (count > 0 && (!best || count > best.count)) best = { date: k, count };
  }
  return { key, period, start: todayKey(start), end: todayKey(end), total, bestDay: best, generatedAt: Date.now() };
}

/**
 * Generates a recap for the previous completed week (fired on Mondays) and/or
 * previous completed month (fired on the 1st), keyed so each period is only
 * ever generated once even if this runs multiple times that day.
 */
export function maybeGenerateRecaps(days, recaps, now = new Date()) {
  const weekly = [...recaps.weekly];
  const monthly = [...recaps.monthly];
  let changed = false;

  if (now.getDay() === 1) {
    const end = new Date(now);
    end.setDate(now.getDate() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const key = `${todayKey(start)}_${todayKey(end)}`;
    if (!weekly.some((r) => r.key === key)) {
      weekly.unshift(buildRecap(days, start, end, key, "week"));
      changed = true;
    }
  }

  if (now.getDate() === 1) {
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const key = `${todayKey(start)}_${todayKey(end)}`;
    if (!monthly.some((r) => r.key === key)) {
      monthly.unshift(buildRecap(days, start, end, key, "month"));
      changed = true;
    }
  }

  return { recaps: { weekly: weekly.slice(0, 12), monthly: monthly.slice(0, 12) }, changed };
}
