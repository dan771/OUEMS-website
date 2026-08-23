const SHEET_URL = "https://docs.google.com/spreadsheets/d/1x_Kh3BFTKyPbOROTVhJjXCurGtGAq78nZQFckgYVeZc/export?format=xlsx";
const OXFORD_TERMS = [
  { name: "Michaelmas", zeroWeekStart: "2026-10-04", start: "2026-10-11", end: "2026-12-05" },
  { name: "Hilary", zeroWeekStart: "2027-01-10", start: "2027-01-17", end: "2027-03-13" },
  { name: "Trinity", zeroWeekStart: "2027-04-18", start: "2027-04-25", end: "2027-06-19" },
  { name: "Michaelmas", zeroWeekStart: "2027-10-03", start: "2027-10-10", end: "2027-12-04" },
  { name: "Hilary", zeroWeekStart: "2028-01-09", start: "2028-01-16", end: "2028-03-11" },
  { name: "Trinity", zeroWeekStart: "2028-04-16", start: "2028-04-23", end: "2028-06-17" },
  { name: "Michaelmas", zeroWeekStart: "2028-10-01", start: "2028-10-08", end: "2028-12-02" },
  { name: "Hilary", zeroWeekStart: "2029-01-07", start: "2029-01-14", end: "2029-03-10" },
  { name: "Trinity", zeroWeekStart: "2029-04-15", start: "2029-04-22", end: "2029-06-16" },
  { name: "Michaelmas", zeroWeekStart: "2029-09-30", start: "2029-10-07", end: "2029-12-01" },
  { name: "Hilary", zeroWeekStart: "2030-01-06", start: "2030-01-13", end: "2030-03-09" },
  { name: "Trinity", zeroWeekStart: "2030-04-21", start: "2030-04-28", end: "2030-06-22" },
  { name: "Michaelmas", zeroWeekStart: "2030-10-06", start: "2030-10-13", end: "2030-12-07" },
  { name: "Hilary", zeroWeekStart: "2031-01-12", start: "2031-01-19", end: "2031-03-15" },
  { name: "Trinity", zeroWeekStart: "2031-04-20", start: "2031-04-27", end: "2031-06-21" },
  { name: "Michaelmas", zeroWeekStart: "2031-10-05", start: "2031-10-12", end: "2031-12-06" },
  { name: "Hilary", zeroWeekStart: "2032-01-11", start: "2032-01-18", end: "2032-03-13" },
  { name: "Trinity", zeroWeekStart: "2032-04-18", start: "2032-04-25", end: "2032-06-19" },
  { name: "Michaelmas", zeroWeekStart: "2032-10-03", start: "2032-10-10", end: "2032-12-04" },
  { name: "Hilary", zeroWeekStart: "2033-01-09", start: "2033-01-16", end: "2033-03-12" },
  { name: "Trinity", zeroWeekStart: "2033-04-17", start: "2033-04-24", end: "2033-06-18" }
];
const state = { events: [], filtered: [], selectedGenres: new Set(), selectedOrganizers: new Set(), organizerLabels: new Map(), view: "cards", month: null };
const elements = {
  cards: document.querySelector("#cards-view"),
  calendar: document.querySelector("#calendar-view"),
  count: document.querySelector("#event-count"),
  activeFilters: document.querySelector("#active-filters"),
  filterToggle: document.querySelector("#filter-toggle"),
  filterCount: document.querySelector("#filter-count"),
  filterMenu: document.querySelector("#filter-menu"),
  search: document.querySelector("#search-input"),
  genre: document.querySelector("#genre-filter"),
  organizer: document.querySelector("#organizer-filter"),
  sort: document.querySelector("#sort-select"),
  dateFrom: document.querySelector("#date-from"),
  dateTo: document.querySelector("#date-to"),
  startMode: document.querySelector("#start-time-mode"),
  startTime: document.querySelector("#start-time"),
  endMode: document.querySelector("#end-time-mode"),
  endTime: document.querySelector("#end-time"),
  eventDialog: document.querySelector("#event-dialog"),
  eventDialogContent: document.querySelector("#event-dialog-content")
};
const customSelects = new Map();

function closeCustomSelect(control) {
  control.open = false;
  control.menu.hidden = true;
  control.trigger.setAttribute("aria-expanded", "false");
  control.wrapper.classList.remove("is-open");
}

function closeCustomSelects() {
  customSelects.forEach(closeCustomSelect);
}

function refreshCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control) return;
  const selected = select.options[select.selectedIndex] || select.options[0];
  control.value.textContent = selected?.textContent || "Select...";
  control.trigger.setAttribute("aria-label", select.getAttribute("aria-label") || selected?.textContent || "Select option");
  control.menu.replaceChildren(...[...select.options].map((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "custom-select-option";
    item.textContent = option.textContent;
    item.disabled = option.disabled;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.value === select.value));
    item.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.dispatchEvent(new Event("input", { bubbles: true }));
      closeCustomSelect(control);
      control.trigger.focus();
    });
    return item;
  }));
}

function setupCustomSelect(select) {
  const wrapper = document.createElement("div");
  wrapper.className = "custom-select";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(select);
  select.classList.add("custom-select-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const value = document.createElement("span");
  value.className = "custom-select-value";
  trigger.append(value);

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.hidden = true;
  menu.setAttribute("role", "listbox");
  wrapper.append(trigger, menu);
  const control = { select, wrapper, trigger, value, menu, open: false };
  customSelects.set(select, control);
  trigger.addEventListener("click", () => {
    if (control.open) closeCustomSelect(control);
    else {
      closeCustomSelects();
      control.open = true;
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      wrapper.classList.add("is-open");
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      trigger.click();
    }
    if (event.key === "Escape") closeCustomSelect(control);
  });
  select.addEventListener("change", () => refreshCustomSelect(select));
  refreshCustomSelect(select);
}

function setupCustomSelects() {
  [elements.genre, elements.organizer, elements.sort, elements.startMode, elements.endMode].forEach(setupCustomSelect);
}

function driveImageSource(value) {
  const text = String(value || "").trim();
  const match = text.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  const id = match?.[1] || (/^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : "");
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : text;
}

function driveImageUrl(value) {
  const source = driveImageSource(value);
  return source.includes("drive.google.com/")
    ? `https://wsrv.nl/?url=${encodeURIComponent(source)}&w=1600&q=85`
    : source;
}

function minutesFromTime(value) {
  if (typeof value === "number") return Math.round(value * 24 * 60) % 1440;
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm)?$/) || text.match(/^(\d{1,2})\s*(am|pm)$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  if (minutes > 59 || hours > 23 || (match[3] && hours > 12)) return null;
  if (match[3]) hours = (hours % 12) + (match[3] === "pm" ? 12 : 0);
  return hours * 60 + minutes;
}

function formatClock(minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}.${String(normalized % 60).padStart(2, "0")}`;
}

function eventTime(event) {
  const start = minutesFromTime(event.time);
  const end = minutesFromTime(event.endTime);
  return start !== null && end !== null ? `${formatClock(start)}–${formatClock(end)}` : start !== null ? formatClock(start) : "Time TBA";
}

function eventEndMinutes(event) {
  return minutesFromTime(event.endTime);
}

function matchesTimeBoundary(eventTime, boundary, mode) {
  if (boundary === null) return true;
  if (eventTime === null) return false;
  return mode === "before" ? eventTime <= boundary : eventTime >= boundary;
}

function excelDate(value) {
  if (typeof value === "number" && window.XLSX) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function excelTime(value) {
  if (typeof value === "number") {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return String(value || "").trim();
}

function headerIndex(headers, label) {
  const normalized = headers.map((header) => String(header).toLowerCase().trim());
  const exact = normalized.findIndex((header) => header === label);
  return exact >= 0 ? exact : normalized.findIndex((header) => header.includes(label));
}

function normalizeRows(rows) {
  const headers = rows[0].map((header) => String(header).trim());
  const index = {
    name: headerIndex(headers, "name of event"),
    promoter: headerIndex(headers, "organization"),
    description: headerIndex(headers, "desciption"),
    lineup: headerIndex(headers, "lineup"),
    date: headerIndex(headers, "date"),
    time: headerIndex(headers, "start time"),
    endTime: headerIndex(headers, "end time"),
    cost: headerIndex(headers, "cost"),
    photo: headerIndex(headers, "poster"),
    genre: headerIndex(headers, "genre"),
    venue: headerIndex(headers, "venue"),
    ticketUrl: headerIndex(headers, "ticket url"),
    minimumAge: headerIndex(headers, "minimum age"),
    signupUrl: headerIndex(headers, "sign up link"),
    accepted: headerIndex(headers, "accepted")
  };
  return rows.slice(1).filter((row) => row[index.name] && String(row[index.accepted] || "").trim().toLowerCase() === "yes").map((row) => ({
    name: row[index.name] || "Untitled transmission",
    promoter: row[index.promoter] || "OUEMS",
    description: row[index.description] || "An OUEMS electronic music event.",
    lineup: row[index.lineup] || "Lineup TBA",
    date: excelDate(row[index.date]),
    time: excelTime(row[index.time]),
    endTime: excelTime(row[index.endTime]),
    cost: costLabel(row[index.cost]),
    genre: row[index.genre] || "electronic",
    venue: row[index.venue] || "Venue TBA",
    ticketUrl: row[index.ticketUrl] || "",
    minimumAge: row[index.minimumAge] ?? "",
    signupUrl: row[index.signupUrl] || "",
    accepted: row[index.accepted] || "",
    photo: driveImageUrl(row[index.photo]),
    photoSource: driveImageSource(row[index.photo])
  }));
}

function displayDate(date) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function displayMonth(date) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(date);
}

function oxfordTermForDate(dateKey) {
  return OXFORD_TERMS.find((term) => dateKey >= term.zeroWeekStart && dateKey <= term.end) || null;
}

function oxfordTermForMonth(year, month) {
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
  return OXFORD_TERMS.find((term) => term.zeroWeekStart <= monthEnd && term.end >= monthStart) || null;
}

function oxfordWeekLabel(dateKey, day) {
  const term = oxfordTermForDate(dateKey);
  if (!term) return String(day);
  const daysSinceZeroWeek = Math.round((new Date(`${dateKey}T12:00:00`) - new Date(`${term.zeroWeekStart}T12:00:00`)) / 86400000);
  return `wk${Math.floor(daysSinceZeroWeek / 7)} // ${day}`;
}

function lineupList(value) {
  return String(value || "Lineup TBA").split(/\r?\n|[,;]+/).map((artist) => artist.trim()).filter(Boolean).map((artist) => `<span>${artist}</span>`).join("");
}

function eventGenres(value) {
  return String(value || "").split(",").map((genre) => genre.trim().toLowerCase()).filter(Boolean);
}

function genreLabel(genre) {
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

function organizerParts(value) {
  return String(value || "").split(/\s+x\s+|,|\//i).map((organizer) => organizer.trim()).filter(Boolean);
}

function organizerKey(value) {
  return String(value || "").trim().toLowerCase();
}

function costLabel(value) {
  return String(value ?? "").trim() === "0" ? "Free" : value || "Free / TBA";
}

function ticketUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function minimumAgeLabel(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Age TBA";
  const numeric = Number(text);
  return Number.isFinite(numeric) ? `${numeric}+` : text.endsWith("+") ? text : `${text}+`;
}

function eventAction(event) {
  const signup = ticketUrl(event.signupUrl);
  if (signup) return { url: signup, label: "Sign up", icon: "clipboard-pen-line" };
  const tickets = ticketUrl(event.ticketUrl);
  return tickets ? { url: tickets, label: "Tickets", icon: "ticket" } : null;
}

function updateGenreOptions() {
  [...elements.genre.options].forEach((option) => {
    option.disabled = option.value !== "all" && state.selectedGenres.has(option.value);
  });
  refreshCustomSelect(elements.genre);
}

function updateOrganizerOptions() {
  [...elements.organizer.options].forEach((option) => {
    option.disabled = option.value !== "all" && state.selectedOrganizers.has(option.value);
  });
  refreshCustomSelect(elements.organizer);
}

function renderActiveFilters() {
  const filters = [];
  const query = elements.search.value.trim();
  if (query) filters.push({ key: "search", label: `Search: ${query}` });
  state.selectedGenres.forEach((genre) => filters.push({ key: `genre:${genre}`, label: `Genre: ${genreLabel(genre)}` }));
  state.selectedOrganizers.forEach((organizer) => filters.push({ key: `organizer:${organizer}`, label: `Organizer: ${state.organizerLabels.get(organizer) || organizer}` }));
  if (elements.dateFrom.value) filters.push({ key: "date-from", label: `Date from: ${elements.dateFrom.value}` });
  if (elements.dateTo.value) filters.push({ key: "date-to", label: `Date to: ${elements.dateTo.value}` });
  if (elements.startTime.value) filters.push({ key: "start-time", label: `Start ${elements.startMode.value}: ${elements.startTime.value}` });
  if (elements.endTime.value) filters.push({ key: "end-time", label: `End ${elements.endMode.value}: ${elements.endTime.value}` });
  elements.activeFilters.hidden = !filters.length;
  elements.filterCount.hidden = !filters.length;
  elements.filterCount.textContent = filters.length ? filters.length : "";
  elements.activeFilters.replaceChildren(...filters.map(({ key, label }) => {
    const button = document.createElement("button");
    button.className = "filter-chip";
    button.type = "button";
    button.dataset.removeFilter = key;
    button.setAttribute("aria-label", `Remove ${label}`);
    const text = document.createElement("span");
    text.textContent = label;
    const icon = document.createElement("i");
    icon.dataset.lucide = "x";
    icon.setAttribute("aria-hidden", "true");
    button.append(text, icon);
    return button;
  }));
  updateGenreOptions();
  updateOrganizerOptions();
  window.lucide?.createIcons();
}

function closeFilterMenu() {
  elements.filterMenu.hidden = true;
  elements.filterToggle.setAttribute("aria-expanded", "false");
}

function syncCardSizing(card) {
  const image = card.querySelector(".event-image");
  const poster = image?.querySelector("img");
  const content = card.querySelector(".event-content");
  const description = card.querySelector(".event-description");
  if (!image || !content || !description || !window.matchMedia("(min-width: 761px)").matches || !poster) {
    content?.style.removeProperty("height");
    description?.style.removeProperty("-webkit-line-clamp");
    description?.style.removeProperty("line-clamp");
    return;
  }
  const imageHeight = image.getBoundingClientRect().height;
  if (!imageHeight) return;
  content.style.height = `${imageHeight}px`;
  description.style.removeProperty("-webkit-line-clamp");
  description.style.removeProperty("line-clamp");
  const lineHeight = Number.parseFloat(getComputedStyle(description).lineHeight);
  if (description.scrollHeight > description.clientHeight + 1 && lineHeight > 0) {
    const lines = String(Math.max(1, Math.floor(description.clientHeight / lineHeight)));
    description.style.webkitLineClamp = lines;
    description.style.lineClamp = lines;
  }
}

function setupCardSizing(container = elements.cards) {
  container.querySelectorAll(".event-card").forEach((card) => {
    const poster = card.querySelector(".event-image img");
    const sync = () => requestAnimationFrame(() => syncCardSizing(card));
    poster?.addEventListener("load", sync, { once: true });
    if (poster?.complete) sync();
    if (window.ResizeObserver) new ResizeObserver(sync).observe(card.querySelector(".event-image"));
    sync();
  });
}

function renderCard(event, index, showTicketButton = false) {
  const date = new Date(`${event.date}T12:00:00`);
  const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  const image = event.photo ? `<img src="${event.photo}" alt="${event.name} event poster" loading="${index === 0 ? "eager" : "lazy"}">` : "";
  const action = eventAction(event);
  const actionLabel = ticketUrl(event.signupUrl) ? "Sign up" : "Tickets";
  const actionButton = showTicketButton ? action ? `<a class="event-ticket-button" href="${escapeAttribute(action.url)}" target="_blank" rel="noreferrer"><i data-lucide="${action.icon}" aria-hidden="true"></i>${action.label}</a>` : `<button class="event-ticket-button" type="button" title="${actionLabel} link not available" disabled><i data-lucide="${actionLabel === "Sign up" ? "clipboard-pen-line" : "ticket"}" aria-hidden="true"></i>${actionLabel}</button>` : "";
  const ticketAttributes = !showTicketButton && action ? `data-ticket-index="${index}" role="link" tabindex="0" aria-label="Open ${action.label.toLowerCase()} for ${event.name}"` : "";
  return `<article class="event-card" ${ticketAttributes} style="animation-delay: ${index * 70}ms">
    <div class="event-image">${image}</div>
    <div class="event-content"><h3>${event.name}</h3><div class="event-meta"><span><i data-lucide="clock-3" aria-hidden="true"></i>${eventTime(event)}</span><span><i data-lucide="map-pin" aria-hidden="true"></i>${event.venue}</span><span><i data-lucide="ticket" aria-hidden="true"></i>${event.cost}</span><span class="event-age">${minimumAgeLabel(event.minimumAge)}</span></div><div class="event-lineup"><div class="lineup-list">${lineupList(event.lineup)}</div></div><p class="event-description">${event.description}</p><div class="event-footer"><span class="event-footer-date">${displayDate(event.date)}</span><span class="event-footer-genre">${event.genre}</span><span class="event-footer-promoter" title="${event.promoter}">${organizerParts(event.promoter).join(" / ")}</span>${actionButton}</div></div>
  </article>`;
}

function renderCards() {
  elements.count.textContent = state.filtered.length;
  elements.cards.innerHTML = state.filtered.length ? state.filtered.map((event, index) => renderCard(event, index)).join("") : '<div class="empty-state">No events match that signal. Try another search.</div>';
  window.lucide?.createIcons();
  setupCardSizing();
  elements.cards.querySelectorAll("[data-ticket-index]").forEach((card) => {
    const openTickets = () => {
      const event = state.filtered[Number(card.dataset.ticketIndex)];
      const url = eventAction(event)?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    };
    card.addEventListener("click", (event) => { if (!event.target.closest("a, button")) openTickets(); });
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openTickets(); } });
  });
}

function renderCalendar() {
  const base = state.month || new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  let cells = "";
  for (let slot = 0; slot < offset + daysInMonth; slot += 1) {
    if (slot < offset) { cells += '<div class="calendar-day"></div>'; continue; }
    const day = slot - offset + 1;
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = state.filtered.filter((event) => event.date === dateKey);
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    cells += `<div class="calendar-day current${isToday ? " today" : ""}"><span class="day-number">${oxfordWeekLabel(dateKey, day)}</span>${dayEvents.map((event) => { const eventIndex = state.filtered.indexOf(event); const titleClass = /\s/.test(event.name.trim()) ? "" : " calendar-event-title-single"; return `<button class="calendar-event" type="button" data-event-index="${eventIndex}" aria-label="Open details for ${event.name}"><strong class="calendar-event-title${titleClass}">${event.name}</strong><span>${organizerParts(event.promoter).join(" / ") || "Organizer TBA"}</span><span class="calendar-event-genre">${event.genre || "Genre TBA"}</span><span><i data-lucide="map-pin" aria-hidden="true"></i>${event.venue || "Venue TBA"}</span><span><i data-lucide="clock-3" aria-hidden="true"></i>${eventTime(event)}</span><span>${minimumAgeLabel(event.minimumAge)}</span></button>`; }).join("")}</div>`;
  }
  let renderedCells = offset + daysInMonth;
  while (renderedCells % 7 !== 0) { cells += '<div class="calendar-day"></div>'; renderedCells += 1; }
  const term = oxfordTermForMonth(year, month);
  elements.calendar.innerHTML = `<div class="calendar-toolbar"><h3>${displayMonth(new Date(year, month, 1))}${term ? ` // ${term.name}` : ""}</h3><div class="calendar-actions"><button class="icon-button" type="button" data-month="previous" aria-label="Previous month"><i data-lucide="chevron-left"></i></button><button class="icon-button" type="button" data-month="next" aria-label="Next month"><i data-lucide="chevron-right"></i></button></div></div><div class="calendar-weekdays"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div><div class="calendar-grid">${cells}</div>`;
  elements.calendar.querySelectorAll(".calendar-event").forEach((button) => button.addEventListener("click", () => openEventDialog(state.filtered[Number(button.dataset.eventIndex)])));
  elements.calendar.querySelectorAll("[data-month]").forEach((button) => button.addEventListener("click", () => { state.month.setMonth(state.month.getMonth() + (button.dataset.month === "next" ? 1 : -1)); renderCalendar(); window.lucide?.createIcons(); }));
  window.lucide?.createIcons();
}

function openEventDialog(event) {
  if (!event) return;
  elements.eventDialogContent.innerHTML = renderCard(event, 0, true);
  elements.eventDialogContent.querySelector("h3")?.setAttribute("id", "event-dialog-title");
  elements.eventDialog.showModal();
  window.lucide?.createIcons();
  setupCardSizing(elements.eventDialogContent);
}

function closeEventDialog() {
  if (elements.eventDialog.open) elements.eventDialog.close();
}

function applyFilters() {
  const query = elements.search.value.trim().toLowerCase();
  const selectedGenres = [...state.selectedGenres];
  const selectedOrganizers = [...state.selectedOrganizers];
  const dateFrom = elements.dateFrom.value;
  const dateTo = elements.dateTo.value;
  const startTime = minutesFromTime(elements.startTime.value);
  const endTime = minutesFromTime(elements.endTime.value);
  state.filtered = state.events.filter((event) => {
    const matchesSearch = !query || Object.values(event).join(" ").toLowerCase().includes(query);
    const matchesGenre = !selectedGenres.length || selectedGenres.some((genre) => eventGenres(event.genre).includes(genre));
    const matchesOrganizer = !selectedOrganizers.length || organizerParts(event.promoter).some((organizer) => selectedOrganizers.includes(organizerKey(organizer)));
    const matchesDate = (!dateFrom || event.date >= dateFrom) && (!dateTo || event.date <= dateTo);
    const eventStart = minutesFromTime(event.time);
    const eventEnd = eventEndMinutes(event);
    const matchesStart = matchesTimeBoundary(eventStart, startTime, elements.startMode.value);
    const matchesEnd = matchesTimeBoundary(eventEnd, endTime, elements.endMode.value);
    return matchesSearch && matchesGenre && matchesOrganizer && matchesDate && matchesStart && matchesEnd;
  });
  const sort = elements.sort.value;
  state.filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "genre" ? a.genre.localeCompare(b.genre) : sort === "organizer" ? a.promoter.localeCompare(b.promoter) : a.date.localeCompare(b.date));
  if (query || selectedGenres.length || selectedOrganizers.length || dateFrom || dateTo || startTime !== null || endTime !== null) setView("cards");
  renderActiveFilters();
  renderCards();
  if (state.view === "calendar") renderCalendar();
}

function setView(view) {
  state.view = view;
  elements.cards.hidden = view !== "cards";
  elements.calendar.hidden = view !== "calendar";
  document.querySelectorAll(".view-button").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (view === "calendar") {
    renderCalendar();
    window.lucide?.createIcons();
  }
}

function fillGenres() {
  [...new Set(state.events.flatMap((event) => eventGenres(event.genre)))].sort().forEach((genre) => {
    elements.genre.insertAdjacentHTML("beforeend", `<option value="${genre}">${genre.charAt(0).toUpperCase() + genre.slice(1)}</option>`);
  });
  updateGenreOptions();
}

function fillOrganizers() {
  state.organizerLabels.clear();
  state.events.flatMap((event) => organizerParts(event.promoter)).forEach((organizer) => {
    const key = organizerKey(organizer);
    if (key && !state.organizerLabels.has(key)) state.organizerLabels.set(key, organizer);
  });
  [...state.organizerLabels.entries()].sort(([, first], [, second]) => first.localeCompare(second)).forEach(([key, organizer]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = organizer;
    elements.organizer.append(option);
  });
  updateOrganizerOptions();
}

function addGenreFilter() {
  if (elements.genre.value === "all") return;
  state.selectedGenres.add(elements.genre.value);
  elements.genre.value = "all";
  applyFilters();
}

function addOrganizerFilter() {
  if (elements.organizer.value === "all") return;
  state.selectedOrganizers.add(elements.organizer.value);
  elements.organizer.value = "all";
  applyFilters();
}

function removeFilter(key) {
  if (key === "search") elements.search.value = "";
  if (key === "date-from") elements.dateFrom.value = "";
  if (key === "date-to") elements.dateTo.value = "";
  if (key === "start-time") elements.startTime.value = "";
  if (key === "end-time") elements.endTime.value = "";
  if (key.startsWith("genre:")) state.selectedGenres.delete(key.slice(6));
  if (key.startsWith("organizer:")) state.selectedOrganizers.delete(key.slice(10));
  applyFilters();
}

async function loadEvents() {
  state.events = [];
  state.month = null;
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "", raw: true });
    state.events = normalizeRows(rows);
    state.month = state.events.length ? new Date(`${state.events[0].date}T12:00:00`) : null;
  } catch (error) {}
  fillGenres();
  fillOrganizers();
  applyFilters();
}

document.querySelectorAll(".view-button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
elements.search.addEventListener("input", applyFilters);
elements.genre.addEventListener("change", addGenreFilter);
elements.organizer.addEventListener("change", addOrganizerFilter);
elements.sort.addEventListener("change", applyFilters);
[elements.dateFrom, elements.dateTo, elements.startMode, elements.startTime, elements.endMode, elements.endTime].forEach((input) => input.addEventListener("input", applyFilters));
elements.activeFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-filter]");
  if (button) removeFilter(button.dataset.removeFilter);
});
elements.eventDialog.querySelector(".event-dialog-close").addEventListener("click", closeEventDialog);
elements.eventDialog.addEventListener("click", (event) => { if (event.target === elements.eventDialog) closeEventDialog(); });
elements.filterToggle.addEventListener("click", () => {
  closeCustomSelects();
  const isOpening = elements.filterMenu.hidden;
  elements.filterMenu.hidden = !isOpening;
  elements.filterToggle.setAttribute("aria-expanded", String(isOpening));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".filter-popover")) closeFilterMenu();
  if (!event.target.closest(".custom-select")) closeCustomSelects();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closeFilterMenu(); closeCustomSelects(); }
});
document.addEventListener("keydown", (event) => { if (event.key === "/" && document.activeElement !== elements.search) { event.preventDefault(); elements.search.focus(); } });
if (window.lucide) lucide.createIcons();
setupCustomSelects();
loadEvents();