/**
 * Shared application state and event-list controllers.
 *
 * Script ownership:
 * - event-data.js parses and validates external values.
 * - event-rendering.js owns cards, calendars, and dialogs.
 * - event-loader.js coordinates the cache and spreadsheet request.
 * - app-startup.js attaches browser events and starts the application.
 *
 * These are classic scripts rather than ES modules so index.html continues to
 * work when opened directly through file://. Scripts load sequentially, while
 * initialization is deferred until every shared declaration is available.
 */

// -----------------------------------------------------------------------------
// Configuration and shared state
// -----------------------------------------------------------------------------

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1x_Kh3BFTKyPbOROTVhJjXCurGtGAq78nZQFckgYVeZc/export?format=xlsx";
const EVENT_CACHE_KEY = "ouems-events-cache-v1";
const REQUIRED_SHEET_COLUMNS = ["name", "date", "time", "accepted"];
const SHEET_HEADERS = {
  name: "name of event",
  // "promoter" is the historical internal field name. The interface presents
  // this value as "Organizer" to match the language used by event submitters.
  promoter: "organization",
  description: ["description", "desciption"],
  lineup: "lineup",
  date: "date",
  time: "start time",
  endTime: "end time",
  cost: "cost",
  photo: "poster",
  genre: "genre",
  venue: "venue",
  ticketUrl: "ticket url",
  minimumAge: "minimum age",
  signupUrl: "sign up link",
  accepted: "accepted"
};

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

const state = {
  events: [],
  filtered: [],
  selectedGenres: new Set(),
  selectedOrganizers: new Set(),
  selectedVenues: new Set(),
  organizerLabels: new Map(),
  venueLabels: new Map(),
  loadError: false,
  view: "cards",
  month: null,
  page: 1,
  pageSize: 10
};

const elements = {
  cards: document.querySelector("#cards-view"),
  cardsPagination: document.querySelector("#cards-pagination"),
  pageSize: document.querySelector("#page-size"),
  previousPage: document.querySelector("#previous-page"),
  nextPage: document.querySelector("#next-page"),
  pageJumpForm: document.querySelector("#page-jump-form"),
  pageJump: document.querySelector("#page-jump"),
  pageTotal: document.querySelector("#page-total"),
  calendar: document.querySelector("#calendar-view"),
  count: document.querySelector("#event-count"),
  activeFilters: document.querySelector("#active-filters"),
  filterToggle: document.querySelector("#filter-toggle"),
  filterCount: document.querySelector("#filter-count"),
  filterMenu: document.querySelector("#filter-menu"),
  search: document.querySelector("#search-input"),
  genre: document.querySelector("#genre-filter"),
  organizer: document.querySelector("#organizer-filter"),
  venue: document.querySelector("#venue-filter"),
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


/** Replace the dataset and rebuild every control derived from event values. */
function applyEvents(events) {
  state.events = events;
  state.loadError = false;
  fillGenres();
  fillOrganizers();
  fillVenues();
  applyFilters();
}


// -----------------------------------------------------------------------------
// Filter options and active filter chips
// -----------------------------------------------------------------------------

function updateGenreOptions() {
  const values = new Set(state.events.flatMap((event) => eventGenres(event.genre)));
  retainKnownValues(state.selectedGenres, values);
  updateFilterOptions(elements.genre, state.selectedGenres);
}

/** Remove selected organizers that no longer exist in refreshed data. */
function updateOrganizerOptions() {
  retainKnownValues(state.selectedOrganizers, state.organizerLabels);
  updateFilterOptions(elements.organizer, state.selectedOrganizers);
}

/** Remove selected venues that no longer exist in refreshed data. */
function updateVenueOptions() {
  retainKnownValues(state.selectedVenues, state.venueLabels);
  updateFilterOptions(elements.venue, state.selectedVenues);
}

/** Mutate a selected-value set so it contains only currently known values. */
function retainKnownValues(selectedValues, knownValues) {
  selectedValues.forEach((value) => {
    if (!knownValues.has(value)) selectedValues.delete(value);
  });
}

/** Disable already-selected native options and refresh their custom control. */
function updateFilterOptions(select, selectedValues) {
  [...select.options].forEach((option) => {
    option.disabled = option.value !== "all" && selectedValues.has(option.value);
  });
  refreshCustomSelect(select);
}

/** Rebuild the visible chips and synchronize disabled filter options. */
function renderActiveFilters() {
  const filters = activeFilterDescriptions();

  elements.activeFilters.hidden = !filters.length;
  elements.filterCount.hidden = !filters.length;
  elements.filterCount.textContent = filters.length ? filters.length : "";
  elements.activeFilters.replaceChildren(...filters.map(createFilterChip));

  updateGenreOptions();
  updateOrganizerOptions();
  updateVenueOptions();
  window.lucide?.createIcons();
}

/** Convert current filter state into labels and stable removal keys. */
function activeFilterDescriptions() {
  const filters = [];
  const query = elements.search.value.trim();

  if (query) filters.push({ key: "search", label: `Search: ${query}` });
  state.selectedGenres.forEach((genre) => filters.push({ key: `genre:${genre}`, label: `Genre: ${genreLabel(genre)}` }));
  state.selectedOrganizers.forEach((organizer) => filters.push({ key: `organizer:${organizer}`, label: `Organizer: ${state.organizerLabels.get(organizer) || organizer}` }));
  state.selectedVenues.forEach((venue) => filters.push({ key: `venue:${venue}`, label: `Venue: ${state.venueLabels.get(venue) || venue}` }));
  if (elements.dateFrom.value) filters.push({ key: "date-from", label: `Date from: ${elements.dateFrom.value}` });
  if (elements.dateTo.value) filters.push({ key: "date-to", label: `Date to: ${elements.dateTo.value}` });
  if (elements.startTime.value) filters.push({ key: "start-time", label: `Start ${elements.startMode.value}: ${elements.startTime.value}` });
  if (elements.endTime.value) filters.push({ key: "end-time", label: `End ${elements.endMode.value}: ${elements.endTime.value}` });

  return filters;
}

/** Create one safe DOM button for removing an active filter. */
function createFilterChip({ key, label }) {
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
}

/** Close the categorical filter popover and synchronize its trigger. */
function closeFilterMenu() {
  elements.filterMenu.hidden = true;
  elements.filterToggle.setAttribute("aria-expanded", "false");
}


// -----------------------------------------------------------------------------
// Filtering, sorting and view state
// -----------------------------------------------------------------------------

/** Capture the current controls as a stable filtering snapshot. */
function currentFilterCriteria() {
  return {
    query: elements.search.value.trim().toLowerCase(),
    genres: [...state.selectedGenres],
    organizers: [...state.selectedOrganizers],
    venues: [...state.selectedVenues],
    dateFrom: elements.dateFrom.value,
    dateTo: elements.dateTo.value,
    startTime: minutesFromTime(elements.startTime.value),
    endTime: minutesFromTime(elements.endTime.value)
  };
}

/** Return whether one normalized event satisfies every active criterion. */
function eventMatchesFilters(event, criteria) {
  const matchesSearch = !criteria.query || Object.values(event).join(" ").toLowerCase().includes(criteria.query);
  const matchesGenre = !criteria.genres.length || criteria.genres.some((genre) => eventGenres(event.genre).includes(genre));
  const matchesOrganizer = !criteria.organizers.length || organizerParts(event.promoter).some((organizer) => criteria.organizers.includes(organizerKey(organizer)));
  const matchesVenue = !criteria.venues.length || criteria.venues.includes(organizerKey(event.venue));
  const matchesDate = (!criteria.dateFrom || event.date >= criteria.dateFrom) && (!criteria.dateTo || event.date <= criteria.dateTo);
  const matchesStart = matchesTimeBoundary(minutesFromTime(event.time), criteria.startTime, elements.startMode.value);
  const matchesEnd = matchesTimeBoundary(eventEndMinutes(event), criteria.endTime, elements.endMode.value);

  return matchesSearch && matchesGenre && matchesOrganizer && matchesVenue && matchesDate && matchesStart && matchesEnd;
}

/** Compare two events using the active sort control. */
function compareEvents(first, second) {
  const sortValues = {
    name: [first.name, second.name],
    genre: [first.genre, second.genre],
    organizer: [first.promoter, second.promoter],
    venue: [first.venue, second.venue],
    date: [first.date, second.date]
  };
  const [firstValue, secondValue] = sortValues[elements.sort.value] || sortValues.date;
  return firstValue.localeCompare(secondValue);
}

/** Return whether criteria contain any value that narrows the event list. */
function hasActiveFilters(criteria) {
  return Boolean(
    criteria.query || criteria.genres.length || criteria.organizers.length || criteria.venues.length
    || criteria.dateFrom || criteria.dateTo || criteria.startTime !== null || criteria.endTime !== null
  );
}

/** Filter, sort, reset pagination, and render the current event collection. */
function applyFilters() {
  const criteria = currentFilterCriteria();
  state.filtered = state.events.filter((event) => eventMatchesFilters(event, criteria));
  state.filtered.sort(compareEvents);
  state.page = 1;

  if (hasActiveFilters(criteria)) setView("cards");

  renderActiveFilters();
  renderCards();
  if (state.view === "calendar") renderCalendar();
}

/** Activate cards or calendar view and synchronize view buttons. */
function setView(view) {
  state.view = view;
  elements.cards.hidden = view !== "cards";
  elements.calendar.hidden = view !== "calendar";
  elements.cardsPagination.hidden = view !== "cards" || !state.filtered.length;
  document.querySelectorAll(".view-button").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (view === "calendar") {
    renderCalendar();
  }
}

/** Rebuild genre options from the current normalized dataset. */
function fillGenres() {
  elements.genre.replaceChildren(new Option("Add genre...", "all"));
  [...new Set(state.events.flatMap((event) => eventGenres(event.genre)))].sort().forEach((genre) => {
    elements.genre.append(new Option(genreLabel(genre), genre));
  });
  updateGenreOptions();
}

/** Build organizer options while preserving their original display casing. */
function fillOrganizers() {
  state.organizerLabels.clear();
  elements.organizer.replaceChildren(new Option("Add organizer...", "all"));
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

/** Build venue options while preserving their original display casing. */
function fillVenues() {
  state.venueLabels.clear();
  elements.venue.replaceChildren(new Option("Add venue...", "all"));
  state.events.forEach((event) => {
    const key = organizerKey(event.venue);
    if (key && !state.venueLabels.has(key)) state.venueLabels.set(key, event.venue);
  });
  [...state.venueLabels.entries()].sort(([, first], [, second]) => first.localeCompare(second)).forEach(([key, venue]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = venue;
    elements.venue.append(option);
  });
  updateVenueOptions();
}

/** Add the selected genre, then reset and reapply the filters. */
function addGenreFilter() {
  if (elements.genre.value === "all") return;
  state.selectedGenres.add(elements.genre.value);
  elements.genre.value = "all";
  applyFilters();
}

/** Add the selected organizer, then reset and reapply the filters. */
function addOrganizerFilter() {
  if (elements.organizer.value === "all") return;
  state.selectedOrganizers.add(elements.organizer.value);
  elements.organizer.value = "all";
  applyFilters();
}

/** Add the selected venue, then reset and reapply the filters. */
function addVenueFilter() {
  if (elements.venue.value === "all") return;
  state.selectedVenues.add(elements.venue.value);
  elements.venue.value = "all";
  applyFilters();
}

/** Remove one filter using the stable key stored on its chip. */
function removeFilter(key) {
  if (key === "search") elements.search.value = "";
  if (key === "date-from") elements.dateFrom.value = "";
  if (key === "date-to") elements.dateTo.value = "";
  if (key === "start-time") elements.startTime.value = "";
  if (key === "end-time") elements.endTime.value = "";
  if (key.startsWith("genre:")) state.selectedGenres.delete(key.slice(6));
  if (key.startsWith("organizer:")) state.selectedOrganizers.delete(key.slice(10));
  if (key.startsWith("venue:")) state.selectedVenues.delete(key.slice(6));
  applyFilters();
}
