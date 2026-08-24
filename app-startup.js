/**
 * Application bootstrap and browser event wiring.
 *
 * This file intentionally loads after the data, rendering, and custom-select
 * scripts. Keeping startup separate makes dependency order visible and keeps
 * the feature files focused on reusable behavior.
 */

/** Move by a relative number of card pages when the destination exists. */
function changePage(offset) {
  const nextPage = state.page + offset;
  if (nextPage < 1 || nextPage > pageCount()) return;

  state.page = nextPage;
  renderCards();
}

/** Clamp a typed page number to the available range and display that page. */
function jumpToPage(event) {
  event.preventDefault();

  const requestedPage = Number.parseInt(elements.pageJump.value, 10);
  if (Number.isFinite(requestedPage)) {
    state.page = Math.min(Math.max(requestedPage, 1), pageCount());
  }

  renderCards();
}

/** Attach all long-lived page interactions in one place. */
function setupEventListeners() {
  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  elements.search.addEventListener("input", applyFilters);
  elements.genre.addEventListener("change", addGenreFilter);
  elements.organizer.addEventListener("change", addOrganizerFilter);
  elements.venue.addEventListener("change", addVenueFilter);
  elements.sort.addEventListener("change", applyFilters);

  elements.pageSize.addEventListener("change", () => {
    state.pageSize = Number(elements.pageSize.value);
    state.page = 1;
    renderCards();
  });
  elements.previousPage.addEventListener("click", () => changePage(-1));
  elements.nextPage.addEventListener("click", () => changePage(1));
  elements.pageJumpForm.addEventListener("submit", jumpToPage);

  const rangeInputs = [
    elements.dateFrom,
    elements.dateTo,
    elements.startMode,
    elements.startTime,
    elements.endMode,
    elements.endTime
  ];
  rangeInputs.forEach((input) => input.addEventListener("input", applyFilters));

  elements.activeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-filter]");
    if (button) removeFilter(button.dataset.removeFilter);
  });

  elements.eventDialog.querySelector(".event-dialog-close").addEventListener("click", closeEventDialog);
  elements.eventDialog.addEventListener("click", (event) => {
    if (event.target === elements.eventDialog) closeEventDialog();
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
    if (event.key === "Escape") {
      closeFilterMenu();
      closeCustomSelects();
    }

    if (event.key === "/" && document.activeElement !== elements.search) {
      event.preventDefault();
      elements.search.focus();
    }
  });

  // Back-forward cache restores do not execute startup again. Revalidate the
  // spreadsheet when a suspended page is revived instead.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) loadEvents();
  });
}

/** Initialize visual controls, browser events, and the event data pipeline. */
function initialize() {
  window.lucide?.createIcons();
  setupCustomSelects();
  setupEventListeners();
  loadEvents();
}

initialize();