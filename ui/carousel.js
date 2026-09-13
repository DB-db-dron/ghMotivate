// A focused-item avatar carousel for switching between tracked profiles.
// The active avatar sits enlarged with an accent ring; neighbors are smaller
// and faded so the strip reads as "here's who's next" at a glance. Click any
// avatar (including the peeking neighbors) or the arrows/arrow-keys to
// switch — scroll-snap keeps whichever is selected centered.

function buildAvatarItem(profile, selected, onSelect) {
  const item = document.createElement("div");
  item.className = "gm-carousel-item" + (profile.username === selected ? " gm-carousel-item--active" : "");
  item.dataset.username = profile.username;

  const wrap = document.createElement("div");
  wrap.className = "gm-avatar-wrap";

  const avatar = document.createElement("img");
  avatar.className = "gm-avatar";
  avatar.src = `https://github.com/${encodeURIComponent(profile.username)}.png?size=80`;
  avatar.alt = `@${profile.username}`;
  wrap.appendChild(avatar);

  if (profile.primary) {
    const badge = document.createElement("span");
    badge.className = "gm-avatar-badge";
    badge.textContent = "★";
    wrap.appendChild(badge);
  }

  item.appendChild(wrap);
  item.addEventListener("click", () => onSelect?.(profile.username));
  return item;
}

function buildAddItem(onToggleAdd) {
  const item = document.createElement("div");
  item.className = "gm-carousel-item gm-carousel-item--add";
  item.textContent = "+";
  item.title = "Track another username";
  item.addEventListener("click", () => onToggleAdd?.());
  return item;
}

function buildCaption(container, profiles, selected, { onSetPrimary }) {
  const profile = profiles.find((p) => p.username === selected);
  if (!profile) return;

  const caption = document.createElement("div");
  caption.className = "gm-carousel-caption";

  const name = document.createElement("span");
  name.className = "gm-carousel-name";
  name.textContent = profile.label ? `${profile.label} (@${profile.username})` : `@${profile.username}`;

  const star = document.createElement("button");
  star.className = "gm-star";
  star.textContent = profile.primary ? "★" : "☆";
  star.title = profile.primary ? "Primary profile (drives the toolbar badge)" : "Set as primary";
  star.addEventListener("click", () => onSetPrimary?.(profile.username));

  caption.append(name, star);
  container.appendChild(caption);
}

function buildAddForm(container, { onAdd, onToggleAdd }) {
  const form = document.createElement("form");
  form.className = "gm-carousel-add-form";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "github username";
  input.autocomplete = "off";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Add";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "icon-btn";
  cancel.textContent = "✕";
  cancel.addEventListener("click", () => onToggleAdd?.());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (value) onAdd?.(value);
  });

  form.append(input, submit, cancel);
  container.appendChild(form);
  setTimeout(() => input.focus(), 0);
}

export function renderCarousel(container, state, opts) {
  const { selected, adding, onSelect, onSetPrimary, onAdd, onToggleAdd } = opts;
  container.innerHTML = "";
  const profiles = state.profiles || [];
  if (profiles.length === 0) return;

  const row = document.createElement("div");
  row.className = "gm-carousel-row";

  const carousel = document.createElement("div");
  carousel.className = "gm-carousel";
  // Hidden (not removed) while the add-form overlay is up, so the row's
  // height never changes and the popup doesn't resize when it opens/closes.
  if (adding) carousel.style.visibility = "hidden";

  const leftArrow = document.createElement("button");
  leftArrow.className = "gm-carousel-arrow";
  leftArrow.textContent = "‹";
  leftArrow.setAttribute("aria-label", "Previous profile");

  const rightArrow = document.createElement("button");
  rightArrow.className = "gm-carousel-arrow";
  rightArrow.textContent = "›";
  rightArrow.setAttribute("aria-label", "Next profile");

  const track = document.createElement("div");
  track.className = "gm-carousel-track";
  track.tabIndex = 0;

  const items = profiles.map((p) => buildAvatarItem(p, selected, onSelect));
  items.forEach((el) => track.appendChild(el));
  track.appendChild(buildAddItem(onToggleAdd));

  const step = (delta) => {
    const idx = profiles.findIndex((p) => p.username === selected);
    const next = profiles[idx + delta];
    if (next) onSelect?.(next.username);
  };
  leftArrow.addEventListener("click", () => step(-1));
  rightArrow.addEventListener("click", () => step(1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  carousel.append(leftArrow, track, rightArrow);
  row.appendChild(carousel);

  if (adding) {
    const overlay = document.createElement("div");
    overlay.className = "gm-carousel-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) onToggleAdd?.();
    });
    buildAddForm(overlay, { onAdd, onToggleAdd });
    row.appendChild(overlay);
  }

  container.appendChild(row);
  buildCaption(container, profiles, selected, { onSetPrimary });

  if (!adding) {
    const activeItem = items.find((el) => el.dataset.username === selected);
    activeItem?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}
