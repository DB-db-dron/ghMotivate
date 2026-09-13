// PR/issue/review breakdown via GitHub's public, unauthenticated Events API.
// Unlike the contribution calendar, this only sees PUBLIC activity and only
// the last ~90 days / 300 events (GitHub's own cap on this endpoint) — every
// caller must surface that window explicitly rather than imply "all time".

const MAX_PAGES = 3;

export async function fetchEventBreakdown(username) {
  const events = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100&page=${page}`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    events.push(...batch);
    if (batch.length < 100) break;
  }
  return summarizeEvents(events);
}

export function summarizeEvents(events) {
  const summary = {
    commits: 0,
    prsOpened: 0,
    prsMerged: 0,
    reviews: 0,
    issuesOpened: 0,
    comments: 0,
    reposCreated: 0,
    eventCount: events.length,
    windowStart: null,
    windowEnd: null,
  };

  for (const e of events) {
    switch (e.type) {
      case "PushEvent":
        summary.commits += e.payload?.commits?.length || 0;
        break;
      case "PullRequestEvent":
        if (e.payload?.action === "opened") summary.prsOpened++;
        if (e.payload?.action === "closed" && e.payload?.pull_request?.merged) summary.prsMerged++;
        break;
      case "PullRequestReviewEvent":
        summary.reviews++;
        break;
      case "IssuesEvent":
        if (e.payload?.action === "opened") summary.issuesOpened++;
        break;
      case "IssueCommentEvent":
      case "PullRequestReviewCommentEvent":
        summary.comments++;
        break;
      case "CreateEvent":
        if (e.payload?.ref_type === "repository") summary.reposCreated++;
        break;
    }
  }

  const dates = events.map((e) => e.created_at).sort();
  summary.windowStart = dates[0] || null;
  summary.windowEnd = dates[dates.length - 1] || null;

  return summary;
}
