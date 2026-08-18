const SHEET_URL = "https://docs.google.com/spreadsheets/d/1x_Kh3BFTKyPbOROTVhJjXCurGtGAq78nZQFckgYVeZc/export?format=xlsx";
const fallbackEvents = [{
  name: "Jungle is massive",
  promoter: "OUEMS",
  description: "Wicked jungle night eh",
  lineup: "Mr Bean",
  date: "2026-10-28",
  time: "23:00",
  duration: "5 hours",
  cost: "£5-10",
  genre: "jungle",
  photo: "",
  photoSource: ""
}];

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
  endTime: document.querySelector("#end-time")
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

function durationInMinutes(value) {
  if (typeof value === "number") return Math.round(value < 1 ? value * 1440 : value * 60);
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/);
  const minutes = text.match(/(\d+)\s*(?:minutes?|mins?|m)/);
  if (hours || minutes) return Math.round(Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0));
  const clock = text.match(/^(\d+)\s*[:.]\s*(\d{2})$/);
  if (clock && Number(clock[2]) < 60) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text) * 60);
  return null;
}

function formatClock(minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}.${String(normalized % 60).padStart(2, "0")}`;
}

function eventTime(event) {
  const start = minutesFromTime(event.time);
  const duration = durationInMinutes(event.duration);
  return start !== null && duration !== null ? `${formatClock(start)}–${formatClock(start + duration)}` : start !== null ? formatClock(start) : "Time TBA";
}

function eventEndMinutes(event) {
  const start = minutesFromTime(event.time);
  if (start === null) return null;
  return (start + (durationInMinutes(event.duration) || 0)) % 1440;
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
    time: headerIndex(headers, "time"),
    duration: headerIndex(headers, "duration"),
    cost: headerIndex(headers, "cost"),
    photo: headerIndex(headers, "poster"),
    genre: headerIndex(headers, "genre")
  };
  return rows.slice(1).filter((row) => row[index.name]).map((row) => ({
    name: row[index.name] || "Untitled transmission",
    promoter: row[index.promoter] || "OUEMS",
    description: row[index.description] || "An OUEMS electronic music event.",
    lineup: row[index.lineup] || "Lineup TBA",
    date: excelDate(row[index.date]),
    time: excelTime(row[index.time]),
    duration: row[index.duration] ?? "",
    cost: row[index.cost] || "Free / TBA",
    genre: row[index.genre] || "electronic",
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

function setupCardSizing() {
  elements.cards.querySelectorAll(".event-card").forEach((card) => {
    const poster = card.querySelector(".event-image img");
    const sync = () => requestAnimationFrame(() => syncCardSizing(card));
    poster?.addEventListener("load", sync, { once: true });
    if (poster?.complete) sync();
    if (window.ResizeObserver) new ResizeObserver(sync).observe(card.querySelector(".event-image"));
    sync();
  });
}

function renderCard(event, index) {
  const date = new Date(`${event.date}T12:00:00`);
  const day = new Intl.DateTimeFormat("en-GB", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  const image = event.photo ? `<img src="${event.photo}" alt="${event.name} event poster" loading="${index === 0 ? "eager" : "lazy"}">` : "";
  return `<article class="event-card" style="animation-delay: ${index * 70}ms">
    <div class="event-image">${image}</div>
    <div class="event-content"><h3>${event.name}</h3><div class="event-meta"><span><i data-lucide="clock-3" aria-hidden="true"></i>${eventTime(event)}</span><span><i data-lucide="ticket" aria-hidden="true"></i>${event.cost}</span></div><div class="event-lineup"><div class="lineup-list">${lineupList(event.lineup)}</div></div><p class="event-description">${event.description}</p><div class="event-footer"><span class="event-footer-date">${displayDate(event.date)}</span><span class="event-footer-genre">${event.genre}</span><span class="event-footer-promoter" title="${event.promoter}">${organizerParts(event.promoter).join(" / ")}</span></div></div>
  </article>`;
}

function renderCards() {
  elements.count.textContent = state.filtered.length;
  elements.cards.innerHTML = state.filtered.length ? state.filtered.map(renderCard).join("") : '<div class="empty-state">No events match that signal. Try another search.</div>';
  window.lucide?.createIcons();
  setupCardSizing();
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
    cells += `<div class="calendar-day current${isToday ? " today" : ""}"><span class="day-number">${day}</span>${dayEvents.map((event) => `<span class="calendar-event"><strong>${event.name}</strong><span>${event.time || "Time TBA"} / ${event.genre}</span></span>`).join("")}</div>`;
  }
  let renderedCells = offset + daysInMonth;
  while (renderedCells % 7 !== 0) { cells += '<div class="calendar-day"></div>'; renderedCells += 1; }
  elements.calendar.innerHTML = `<div class="calendar-toolbar"><h3>${displayMonth(new Date(year, month, 1))}</h3><div class="calendar-actions"><button class="icon-button" type="button" data-month="previous" aria-label="Previous month"><i data-lucide="chevron-left"></i></button><button class="icon-button" type="button" data-month="next" aria-label="Next month"><i data-lucide="chevron-right"></i></button></div></div><div class="calendar-weekdays"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div><div class="calendar-grid">${cells}</div>`;
  elements.calendar.querySelectorAll("[data-month]").forEach((button) => button.addEventListener("click", () => { state.month.setMonth(state.month.getMonth() + (button.dataset.month === "next" ? 1 : -1)); renderCalendar(); window.lucide?.createIcons(); }));
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
  state.filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "genre" ? a.genre.localeCompare(b.genre) : a.date.localeCompare(b.date));
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
  state.events = fallbackEvents;
  state.month = new Date(`${fallbackEvents[0].date}T12:00:00`);
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "", raw: true });
    const liveEvents = normalizeRows(rows);
    if (liveEvents.length) state.events = liveEvents;
    state.month = new Date(`${state.events[0].date}T12:00:00`);
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