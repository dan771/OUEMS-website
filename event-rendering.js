/**
 * Event presentation for card, calendar, pagination, and dialog views.
 *
 * This file assumes event-data.js has already normalized and supplied all
 * escaping helpers. It owns generated markup and short-lived listeners attached
 * to markup that is replaced on each render.
 */

// -----------------------------------------------------------------------------
// Card rendering and responsive sizing
// -----------------------------------------------------------------------------

/** Match desktop card content to poster height and clamp overflowing copy. */
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

  // On desktop, cards match the content column to the poster height. Measure
  // the remaining description space before applying a line clamp.
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

/** Observe poster dimensions and keep generated card sizing synchronized. */
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

/** Render a poster, loading only the first visible image eagerly. */
function renderEventImage(event, index) {
  if (!event.photo) return "";

  const source = escapeAttribute(event.photo);
  const alt = escapeAttribute(`${event.name} event poster`);
  const loading = index === 0 ? "eager" : "lazy";
  return `<img src="${source}" alt="${alt}" loading="${loading}">`;
}

/** Render the time, venue, cost, and age metadata row. */
function renderEventMeta(event) {
  return `<div class="event-meta">
    <span><i data-lucide="clock-3" aria-hidden="true"></i>${escapeHtml(eventTime(event))}</span>
    <span><i data-lucide="map-pin" aria-hidden="true"></i>${escapeHtml(event.venue)}</span>
    <span><i data-lucide="ticket" aria-hidden="true"></i>${escapeHtml(event.cost)}</span>
    <span class="event-age">${escapeHtml(minimumAgeLabel(event.minimumAge))}</span>
  </div>`;
}

/** Render an actionable or explicitly disabled dialog ticket button. */
function renderTicketButton(event, action) {
  if (action) {
    return `<a class="event-ticket-button" href="${escapeAttribute(action.url)}" target="_blank" rel="noreferrer"><i data-lucide="${action.icon}" aria-hidden="true"></i>${action.label}</a>`;
  }

  const isSignup = Boolean(ticketUrl(event.signupUrl));
  const label = isSignup ? "Sign up" : "Tickets";
  const icon = isSignup ? "clipboard-pen-line" : "ticket";
  return `<button class="event-ticket-button" type="button" title="${label} link not available" disabled><i data-lucide="${icon}" aria-hidden="true"></i>${label}</button>`;
}

/** Add keyboard-link semantics to actionable list cards. */
function cardTicketAttributes(event, action, eventIndex, showTicketButton) {
  if (showTicketButton || !action) return "";

  const label = escapeAttribute(`Open ${action.label.toLowerCase()} for ${event.name}`);
  return `data-ticket-index="${eventIndex}" role="link" tabindex="0" aria-label="${label}"`;
}

/** Render one event card for either the list or the detail dialog. */
function renderCard(event, index, showTicketButton = false, eventIndex = index) {
  const eventName = escapeHtml(event.name);
  const promoter = escapeHtml(organizerParts(event.promoter).join(" / "));
  const eventGenre = escapeHtml(event.genre);
  const action = eventAction(event);
  const actionButton = showTicketButton ? renderTicketButton(event, action) : "";
  const ticketAttributes = cardTicketAttributes(event, action, eventIndex, showTicketButton);

  return `<article class="event-card" ${ticketAttributes} style="animation-delay: ${index * 70}ms">
    <div class="event-image">${renderEventImage(event, index)}</div>
    <div class="event-content">
      <h3>${eventName}</h3>
      ${renderEventMeta(event)}
      <div class="event-lineup"><div class="lineup-list">${lineupList(event.lineup)}</div></div>
      <p class="event-description">${escapeHtml(event.description)}</p>
      <div class="event-footer">
        <span class="event-footer-date">${escapeHtml(displayDate(event.date))}</span>
        <span class="event-footer-genre">${eventGenre}</span>
        <span class="event-footer-promoter" title="${escapeAttribute(event.promoter)}">${promoter}</span>
        ${actionButton}
      </div>
    </div>
  </article>`;
}

/** Return at least one page so pager arithmetic remains well-defined. */
function pageCount() {
  return Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
}

/** Clamp page state and synchronize every pager control. */
function syncPagination() {
  const totalPages = pageCount();
  state.page = Math.min(state.page, totalPages);

  elements.cardsPagination.hidden = state.view !== "cards" || !state.filtered.length;
  elements.pageJump.value = state.filtered.length ? state.page : "";
  elements.pageJump.max = String(totalPages);
  elements.pageTotal.textContent = totalPages;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;
}

/** Attach mouse and keyboard ticket actions to newly rendered list cards. */
function bindCardActions() {
  elements.cards.querySelectorAll("[data-ticket-index]").forEach((card) => {
    // The attribute stores an index into the full filtered list, not merely the
    // visible page. This keeps ticket actions correct after pagination.
    const openTickets = () => {
      const event = state.filtered[Number(card.dataset.ticketIndex)];
      const url = eventAction(event)?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    };

    card.addEventListener("click", (event) => {
      if (!event.target.closest("a, button")) openTickets();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openTickets();
    });
  });
}

/** Render only the active card page and bind its ticket actions. */
function renderCards() {
  elements.count.textContent = state.filtered.length;
  syncPagination();

  const pageStart = (state.page - 1) * state.pageSize;
  const pageEvents = state.filtered.slice(pageStart, pageStart + state.pageSize);

  if (state.filtered.length) {
    elements.cards.innerHTML = pageEvents.map((event, index) => renderCard(event, index, false, pageStart + index)).join("");
  } else {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = state.loadError ? "Unable to load events right now. Please try again later." : "No events match that signal. Try another search.";
    elements.cards.replaceChildren(emptyState);
  }

  window.lucide?.createIcons();
  setupCardSizing();
  bindCardActions();
}


// -----------------------------------------------------------------------------
// Calendar and event dialog
// -----------------------------------------------------------------------------

/** Render a compact event button inside one calendar day. */
function renderCalendarEvent(event) {
  const eventIndex = state.filtered.indexOf(event);
  const titleClass = /\s/.test(String(event.name).trim()) ? "" : " calendar-event-title-single";
  const eventName = escapeHtml(event.name);
  const organizer = escapeHtml(organizerParts(event.promoter).join(" / ") || "Organizer TBA");
  const genre = escapeHtml(event.genre || "Genre TBA");
  const venue = escapeHtml(event.venue || "Venue TBA");
  const time = escapeHtml(eventTime(event));
  const age = escapeHtml(minimumAgeLabel(event.minimumAge));

  return `<button class="calendar-event" type="button" data-event-index="${eventIndex}" aria-label="${escapeAttribute(`Open details for ${event.name}`)}">
    <strong class="calendar-event-title${titleClass}">${eventName}</strong>
    <span>${organizer}</span>
    <span class="calendar-event-genre">${genre}</span>
    <span><i data-lucide="map-pin" aria-hidden="true"></i>${venue}</span>
    <span><i data-lucide="clock-3" aria-hidden="true"></i>${time}</span>
    <span>${age}</span>
  </button>`;
}

/** Build complete Monday-to-Sunday rows for one calendar month. */
function renderCalendarCells(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  let cells = "";

  for (let slot = 0; slot < offset + daysInMonth; slot += 1) {
    if (slot < offset) {
      cells += '<div class="calendar-day"></div>';
      continue;
    }

    const day = slot - offset + 1;
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = state.filtered.filter((event) => event.date === dateKey);
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const events = dayEvents.map(renderCalendarEvent).join("");

    cells += `<div class="calendar-day current${isToday ? " today" : ""}"><span class="day-number">${oxfordWeekLabel(dateKey, day)}</span>${events}</div>`;
  }

  // Finish the final week so the grid always contains complete seven-day rows.
  let renderedCells = offset + daysInMonth;
  while (renderedCells % 7 !== 0) {
    cells += '<div class="calendar-day"></div>';
    renderedCells += 1;
  }

  return cells;
}

/** Move calendar state by one month and rerender it. */
function changeCalendarMonth(direction) {
  const nextMonth = new Date(state.month || new Date());
  nextMonth.setMonth(nextMonth.getMonth() + (direction === "next" ? 1 : -1));
  state.month = nextMonth;
  renderCalendar();
}

/** Build the calendar frame around the generated day cells. */
function calendarMarkup(title, cells) {
  return `<div class="calendar-toolbar">
    <h3>${title}</h3>
    <div class="calendar-actions">
      <button class="icon-button" type="button" data-month="previous" aria-label="Previous month"><i data-lucide="chevron-left"></i></button>
      <button class="icon-button" type="button" data-month="next" aria-label="Next month"><i data-lucide="chevron-right"></i></button>
    </div>
  </div>
  <div class="calendar-weekdays">
    <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
  </div>
  <div class="calendar-grid">${cells}</div>`;
}

/** Render the selected month and attach controls for generated calendar markup. */
function renderCalendar() {
  const base = state.month || new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const term = oxfordTermForMonth(year, month);
  const cells = renderCalendarCells(year, month);
  const title = `${displayMonth(new Date(year, month, 1))}${term ? ` // ${term.name}` : ""}`;

  elements.calendar.innerHTML = calendarMarkup(title, cells);
  elements.calendar.querySelectorAll(".calendar-event").forEach((button) => button.addEventListener("click", () => openEventDialog(state.filtered[Number(button.dataset.eventIndex)])));
  elements.calendar.querySelectorAll("[data-month]").forEach((button) => button.addEventListener("click", () => changeCalendarMonth(button.dataset.month)));
  window.lucide?.createIcons();
}

/** Render full event details into the shared modal dialog. */
function openEventDialog(event) {
  if (!event) return;
  elements.eventDialogContent.innerHTML = renderCard(event, 0, true);
  elements.eventDialogContent.querySelector("h3")?.setAttribute("id", "event-dialog-title");
  elements.eventDialog.showModal();
  window.lucide?.createIcons();
  setupCardSizing(elements.eventDialogContent);
}

/** Close the event dialog only when it is currently open. */
function closeEventDialog() {
  if (elements.eventDialog.open) elements.eventDialog.close();
}
