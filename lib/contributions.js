// Parsing and stats logic for GitHub's contribution-calendar HTML fragment.
// Kept dependency-free and DOM-free so it works in a MV3 service worker
// (which has no document/DOMParser) as well as in the popup.

/**
 * Parses the HTML returned by https://github.com/users/<name>/contributions
 * into a date -> count map, plus the "total in last year" header count.
 */
export function parseContributionsHtml(html) {
  const idToDate = new Map();
  const tdRe = /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"[^>]*class="ContributionCalendar-day"/g;
  let m;
  while ((m = tdRe.exec(html))) {
    idToDate.set(m[2], m[1]);
  }

  const days = {};
  const tipRe = /<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g;
  while ((m = tipRe.exec(html))) {
    const date = idToDate.get(m[1]);
    if (!date) continue;
    const text = m[2].trim();
    const countMatch = text.match(/^(No|\d+)\s+contribution/i);
    const count = countMatch ? (countMatch[1] === "No" ? 0 : parseInt(countMatch[1], 10)) : 0;
    days[date] = count;
  }

  let totalLastYear = null;
  const headerMatch = html.match(/id="js-contribution-activity-description"[^>]*>\s*([\d,]+)\s*\n?\s*contributions/);
  if (headerMatch) {
    totalLastYear = parseInt(headerMatch[1].replace(/,/g, ""), 10);
  }

  return { days, totalLastYear };
}

function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/**
 * Computes today's count, current streak, and longest streak from a
 * date -> count map. "Current streak" counts backward from today; if today
 * has 0 contributions yet, it counts backward from yesterday instead so an
 * in-progress day doesn't falsely zero out an otherwise-live streak.
 */
export function computeStats(days) {
  const dates = Object.keys(days).sort();
  if (dates.length === 0) {
    return { today: 0, currentStreak: 0, longestStreak: 0 };
  }

  const today = todayKey();
  const todayCount = days[today] || 0;

  let cursor = new Date();
  if (todayCount === 0) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let currentStreak = 0;
  while (true) {
    const key = todayKey(cursor);
    if ((days[key] || 0) > 0) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  let longestStreak = 0;
  let running = 0;
  for (const date of dates) {
    if ((days[date] || 0) > 0) {
      running++;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  }

  return { today: todayCount, currentStreak, longestStreak };
}

/** The single highest-count day in the map, or null if all zero/empty. */
export function getBestDay(days) {
  let best = null;
  for (const [date, count] of Object.entries(days)) {
    if (count > 0 && (!best || count > best.count)) best = { date, count };
  }
  return best;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Matches GitHub's own tooltip phrasing, e.g. "3 contributions on October 5th." */
export function formatTooltip(dateKey, count) {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const day = ordinal(d);
  const month = MONTH_NAMES[mo - 1];
  if (count === 0) return `No contributions on ${month} ${day}.`;
  return `${count} contribution${count === 1 ? "" : "s"} on ${month} ${day}.`;
}

/** "2026-09-07" -> "Sep 7" */
export function formatShort(dateKey) {
  const [, mo, d] = dateKey.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1].slice(0, 3)} ${d}`;
}

export function formatDateRange(startKey, endKey) {
  const fmt = (key) => {
    const [y, mo] = key.split("-").map(Number);
    return { y, mo };
  };
  const a = fmt(startKey);
  const b = fmt(endKey);
  const short = (mo) => MONTH_NAMES[mo - 1].slice(0, 3);
  if (a.y === b.y) return `${short(a.mo)} – ${short(b.mo)} ${b.y}`;
  return `${short(a.mo)} ${a.y} – ${short(b.mo)} ${b.y}`;
}

export { todayKey };
