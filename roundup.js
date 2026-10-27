/** Calendar days in Oxford, irrespective of the viewer's local time zone. */
function roundupDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Today through the Monday after this week, inclusive, overlapping weekly posts. */
function roundupDateRange(now = new Date()) {
  const start = roundupDateKey(now);
  const monday = new Date(`${start}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + (7 - monday.getUTCDay()) % 7 + 1);
  return { start, end: monday.toISOString().slice(0, 10) };
}

function roundupEvents(events, range) {
  return events.filter((event) => event.date >= range.start && event.date <= range.end)
    .sort((first, second) => first.date.localeCompare(second.date)
      || (minutesFromTime(first.time) ?? 1440) - (minutesFromTime(second.time) ?? 1440)
      || first.name.localeCompare(second.name));
}

const roundupSlides = { events: [], page: 0, capacity: 6 };

/** Key fields only; all spreadsheet text is escaped before creating markup. */
function roundupEventMarkup(event) {
  const genres = eventGenres(event.genre).map(genreLabel).join(", ");
  const artists = event.lineup ? lineupParts(event.lineup).map(artist => artist.replace(/\s*\([^)]*\)/g, "").trim()).filter(Boolean) : [];
  const cost = costLabel(event.cost).replace(/\.00\b/g, "");
  const age = event.minimumAge ? minimumAgeLabel(event.minimumAge) : "";
  const poster = event.photo ? `<div class="roundup-poster-frame"><img class="roundup-poster" src="${escapeAttribute(event.photo)}" alt="${escapeAttribute(event.name)} poster" crossorigin="anonymous" decoding="async"></div>` : "";
  return `<article class="roundup-event${poster ? " has-poster" : ""}">
    ${poster}
    <div class="roundup-event-details">
    <p class="roundup-event-date">${escapeHtml(displayDate(event.date))}</p>
    <h2>${escapeHtml(event.name)}</h2>
    <div class="roundup-event-meta"><span class="roundup-event-venue">${escapeHtml(event.venue)}</span><span class="roundup-event-time">${escapeHtml(eventTime(event))}</span><span class="roundup-event-cost">${escapeHtml([cost, age].filter(Boolean).join(" · "))}</span></div>
    ${artists.length ? `<p class="roundup-event-lineup" data-artists="${escapeAttribute(JSON.stringify(artists))}"></p>` : ""}
    ${genres ? `<p class="roundup-event-genres">${escapeHtml(genres)}</p>` : ""}
    </div>
  </article>`;
}

/** Keep whole artist names, using the space left after the essential details. */
function fitRoundupList() {
  document.querySelectorAll(".roundup-event-details").forEach(details => {
    const single = details.closest(".roundup-events-single");
    const fields = [...details.querySelectorAll(single ? ".roundup-event-meta > span" : ".roundup-event-time, .roundup-event-cost")];
    fields.forEach(field => { field.style.fontSize = ""; });
    if (single) {
      let size = parseFloat(getComputedStyle(fields[0]).fontSize);
      while (fields.some(field => field.scrollWidth > field.clientWidth + 1) && size > 16) {
        size--;
        fields.forEach(field => { field.style.fontSize = `${size}px`; });
      }
    } else fields.forEach(field => {
      let size = parseFloat(getComputedStyle(field).fontSize);
      while (field.scrollWidth > field.clientWidth + 1 && size > 16) field.style.fontSize = `${--size}px`;
    });
    const lineup = details.querySelector(".roundup-event-lineup");
    if (!lineup) return;
    const artists = JSON.parse(lineup.dataset.artists);
    for (let count = artists.length; count >= 0; count--) {
      const remaining = artists.length - count;
      const names = escapeHtml(artists.slice(0, count).join(" · "));
      lineup.innerHTML = `${names}${remaining ? `<span class="roundup-event-more">${count ? " · " : ""}+${remaining} more</span>` : ""}`;
      if (details.scrollHeight <= details.clientHeight + 1) break;
    }
  });
}

/** Fit the entire artwork on screen while preserving full-size PNG exports. */
function resizeRoundupPreview() {
  const toolsHeight = document.querySelector(".roundup-tools").getBoundingClientRect().height;
  const availableHeight = Math.max(1, window.innerHeight - toolsHeight - 24);
  const scale = Math.max(.01, Math.min((window.innerWidth - 24) / 1080, availableHeight / 1350, 1));
  const preview = document.querySelector(".roundup-preview");
  preview.style.width = `${1080 * scale}px`;
  preview.style.height = `${1350 * scale}px`;
  document.querySelector("#roundup-artwork").style.transform = `scale(${scale})`;
  fitRoundupList();
}

function renderWeeklyRoundup(events) {
  const range = roundupDateRange();
  roundupSlides.events = roundupEvents(events, range);
  roundupSlides.page = Math.min(roundupSlides.page, Math.max(0, Math.ceil(roundupSlides.events.length / roundupSlides.capacity) - 1));
  const format = date => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
  document.querySelector("#roundup-range").textContent = `${format(range.start)}–${format(range.end)}`;
  renderRoundupSlide();
}

/** Additional events get another slide instead of shrinking all the flyers. */
function renderRoundupSlide() {
  const { events, page, capacity } = roundupSlides;
  const weekly = events.slice(page * capacity, (page + 1) * capacity);
  const layout = weekly.length === 1 ? " roundup-events-single" : weekly.length === 3 ? " roundup-events-featured" : "";
  document.querySelector("#roundup-list").innerHTML = weekly.length
    ? `<div class="roundup-events${layout}" style="--roundup-rows: ${Math.ceil(weekly.length / 2)}">${weekly.map(roundupEventMarkup).join("")}</div>`
    : '<p class="roundup-empty">No events listed for the rest of this week.</p>';
  document.querySelectorAll(".roundup-poster").forEach((poster) => {
    poster.addEventListener("load", resizeRoundupPreview, { once: true });
    poster.addEventListener("error", () => {
      poster.closest(".roundup-event").classList.remove("has-poster");
      poster.parentElement.remove();
      resizeRoundupPreview();
    }, { once: true });
  });
  const pages = Math.ceil(events.length / capacity);
  const previous = document.querySelector("#roundup-previous");
  const next = document.querySelector("#roundup-next");
  const pageLabel = document.querySelector("#roundup-page");
  previous.hidden = next.hidden = pageLabel.hidden = pages <= 1;
  previous.disabled = page === 0;
  next.disabled = page >= pages - 1;
  pageLabel.textContent = `${page + 1} / ${pages}`;
  document.querySelector("#roundup-status").textContent = "1080 × 1350 · through next Monday";
  document.querySelector("#roundup-export").disabled = false;
  resizeRoundupPreview();
}

async function exportWeeklyRoundup() {
  const button = document.querySelector("#roundup-export");
  const status = document.querySelector("#roundup-status");
  button.disabled = true;
  status.textContent = "Preparing PNG…";
  try {
    if (!window.html2canvas) throw new Error("The image exporter could not load. Reload and try again.");
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll("#roundup-artwork img")].map((image) => image.decode().catch(() => {})));
    fitRoundupList();
    const canvas = await window.html2canvas(document.querySelector("#roundup-artwork"), {
      width: 1080, height: 1350, scale: 1, backgroundColor: "#101110", useCORS: true,
      onclone: (clone) => {
        const artwork = clone.querySelector("#roundup-artwork");
        artwork.style.transform = "none";
        // html2canvas ignores object-fit. Give contained posters their actual
        // painted size so it preserves the same proportions and letterboxing.
        artwork.querySelectorAll(".roundup-poster").forEach((poster) => {
          if (clone.defaultView.getComputedStyle(poster).objectFit !== "contain"
            || !poster.naturalWidth || !poster.naturalHeight) return;
          const scale = Math.min(poster.clientWidth / poster.naturalWidth,
            poster.clientHeight / poster.naturalHeight);
          poster.style.width = `${poster.naturalWidth * scale}px`;
          poster.style.height = `${poster.naturalHeight * scale}px`;
        });
      }
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Unable to create the image. Please try again.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const suffix = roundupSlides.events.length > roundupSlides.capacity ? `-${roundupSlides.page + 1}` : "";
    link.download = `ouems-roundup-${roundupDateRange().start}${suffix}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "PNG downloaded · 1080 × 1350";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function initializeWeeklyRoundup() {
  resizeRoundupPreview();
  window.addEventListener("resize", resizeRoundupPreview);
  document.querySelector("#roundup-export").addEventListener("click", exportWeeklyRoundup);
  document.querySelector("#roundup-previous").addEventListener("click", () => {
    if (roundupSlides.page > 0) { roundupSlides.page--; renderRoundupSlide(); }
  });
  document.querySelector("#roundup-next").addEventListener("click", () => {
    if ((roundupSlides.page + 1) * roundupSlides.capacity < roundupSlides.events.length) { roundupSlides.page++; renderRoundupSlide(); }
  });
  await loadEvents(renderWeeklyRoundup);
  if (state.loadError) {
    document.querySelector("#roundup-status").textContent = "Unable to load events. Please reload to try again.";
    document.querySelector("#roundup-list").innerHTML = '<p class="roundup-empty">Events could not be loaded.</p>';
  }
  await document.fonts.ready;
  resizeRoundupPreview();
}

initializeWeeklyRoundup();
