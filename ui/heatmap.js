import { todayKey, formatTooltip, formatDateRange } from "../lib/contributions.js";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function levelFor(count) {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

function buildCells(days, weeksBack) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - weeksBack * 7 + 1);
  start.setDate(start.getDate() - start.getDay()); // snap back to the preceding Sunday

  const cells = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = todayKey(d);
    cells.push({ key, count: days[key] || 0, weekday: d.getDay(), isFirstOfMonth: d.getDate() === 1, month: d.getMonth() });
  }
  return cells;
}

function chunkIntoWeeks(cells) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function getSharedTooltip() {
  let tip = document.getElementById("gh-motivate-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "gh-motivate-tooltip";
    tip.className = "gm-tooltip";
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  return tip;
}

function showTooltip(target, text) {
  const tip = getSharedTooltip();
  tip.textContent = text;
  tip.hidden = false;
  const rect = target.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const cellCenterX = rect.left + rect.width / 2;
  let left = cellCenterX - tipRect.width / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - tipRect.width - 4));
  let top = rect.top - tipRect.height - 8;

  // The box's left edge may have just been clamped away from centering on
  // the cell (edge cells near the popup's sides) — without this, the arrow
  // (CSS ::after, centered on the *box*) stays centered on the box instead
  // of following the cell, so it visibly points at the wrong place. Keep it
  // pinned to the cell's actual center, clamped to stay within the box.
  let arrowLeft = cellCenterX - left;
  arrowLeft = Math.max(10, Math.min(arrowLeft, tipRect.width - 10));
  tip.style.setProperty("--gm-arrow-left", `${arrowLeft}px`);

  // A cell in the grid's top row sits right under the month-label row (only
  // a 2px gap), so "above" never has room — checking the viewport's edge
  // alone misses this, since the popup itself has plenty of space above the
  // whole heatmap. Flip below whenever placing it above would creep into
  // whatever this heatmap's own container sits inside of.
  const boundary = target.closest(".gm-heatmap-inner")?.getBoundingClientRect();
  const minTop = Math.max(4, boundary ? boundary.top : 4);

  let arrowBelow = false;
  if (top < minTop) {
    top = rect.bottom + 8;
    arrowBelow = true;
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.classList.toggle("gm-tooltip--below", arrowBelow);
}

function hideTooltip() {
  const tip = document.getElementById("gh-motivate-tooltip");
  if (tip) tip.hidden = true;
}

/**
 * Renders a GitHub-style contribution heatmap into `container`: a date-range
 * caption, month tick labels, and a week-column grid with a custom hover
 * tooltip (GitHub's own phrasing: "3 contributions on October 5th.").
 */
export function renderHeatmap(container, days, { weeks = 13, cellSize = 13, gap = 2 } = {}) {
  container.innerHTML = "";
  const cells = buildCells(days, weeks);
  const weekCols = chunkIntoWeeks(cells);
  const columnPitch = cellSize + gap;

  const range = document.createElement("div");
  range.className = "gm-heatmap-range";
  range.textContent = `${formatDateRange(cells[0].key, cells[cells.length - 1].key)} · ${weeks} weeks`;
  container.appendChild(range);

  const scroller = document.createElement("div");
  scroller.className = "gm-heatmap-scroller";

  const monthsRow = document.createElement("div");
  monthsRow.className = "gm-heatmap-months";
  // Explicit width, matching the grid below exactly, so this row still
  // takes up real layout space even though every label inside it is
  // absolutely positioned (position:absolute takes children out of flow,
  // so the row would otherwise collapse to zero width/height).
  monthsRow.style.width = `${weekCols.length * columnPitch - gap}px`;
  monthsRow.style.height = `${cellSize}px`;

  weekCols.forEach((week, colIndex) => {
    // Only label a column that actually contains a real month-start. Forcing
    // a label on column 0 too (whatever month the window happens to open on)
    // can land right next to the following real month-start when the window
    // doesn't begin on a calendar boundary, and two 3-letter labels can't
    // both fit in adjacent 13px columns — hence the "MayJun" overlap.
    const monthOfFirstOfMonth = week.find((c) => c.isFirstOfMonth)?.month;
    if (monthOfFirstOfMonth === undefined) return;

    const label = document.createElement("span");
    label.textContent = MONTH_SHORT[monthOfFirstOfMonth];
    // Positioned by exact pixel math (rather than left to grid-item/text
    // layout) so its left edge always lands precisely on this column's
    // left edge, matching the cell grid beneath it pixel-for-pixel.
    label.style.left = `${colIndex * columnPitch}px`;
    monthsRow.appendChild(label);
  });

  const grid = document.createElement("div");
  grid.className = "gm-heatmap-grid";
  grid.style.gridAutoColumns = `${cellSize}px`;
  grid.style.gap = `${gap}px`;
  weekCols.forEach((week) => {
    const col = document.createElement("div");
    col.className = "gm-heatmap-col";
    col.style.gridTemplateRows = `repeat(7, ${cellSize}px)`;
    col.style.gap = `${gap}px`;
    for (let row = 0; row < 7; row++) {
      const cellData = week.find((c) => c.weekday === row);
      const cell = document.createElement("div");
      cell.className = "gm-cell";
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;
      if (cellData) {
        cell.dataset.level = String(levelFor(cellData.count));
        const text = formatTooltip(cellData.key, cellData.count);
        cell.addEventListener("mouseenter", () => showTooltip(cell, text));
        cell.addEventListener("mouseleave", hideTooltip);
      } else {
        cell.classList.add("gm-cell--empty");
      }
      col.appendChild(cell);
    }
    grid.appendChild(col);
  });

  const inner = document.createElement("div");
  inner.className = "gm-heatmap-inner";
  inner.appendChild(monthsRow);
  inner.appendChild(grid);

  scroller.appendChild(inner);
  container.appendChild(scroller);
  scroller.scrollLeft = scroller.scrollWidth;
}
