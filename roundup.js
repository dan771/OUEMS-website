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

/** Key fields only; all spreadsheet text is escaped before creating markup. */
function roundupEventMarkup(event) {
  const notes = [organizerParts(event.promoter).join(" / "), eventGenres(event.genre).map(genreLabel).join(", ")].filter(Boolean);
  const poster = event.photo ? `<img class="roundup-poster" src="${escapeAttribute(event.photo)}" alt="${escapeAttribute(event.name)} poster" crossorigin="anonymous" decoding="async">` : "";
  return `<article class="roundup-event${poster ? " has-poster" : ""}">
    ${poster}
    <div class="roundup-event-details">
    <p class="roundup-event-date">${escapeHtml(displayDate(event.date))} · ${escapeHtml(eventTime(event))}</p>
    <h2>${escapeHtml(event.name)}</h2>
    <div class="roundup-event-meta"><span>${escapeHtml(event.venue)}</span><span>${escapeHtml(costLabel(event.cost))}</span><span>${escapeHtml(minimumAgeLabel(event.minimumAge))}</span></div>
    ${event.lineup ? `<p class="roundup-event-lineup">${escapeHtml(lineupParts(event.lineup).join(" · "))}</p>` : ""}
    <p class="roundup-event-notes">${escapeHtml(notes.join(" · "))}</p>
    </div>
  </article>`;
}

/** Scale the entire list to keep every event and field inside the export. */
function fitRoundupList() {
  const list = document.querySelector("#roundup-list");
  const content = list.querySelector(".roundup-events");
  if (!content) return;
  content.style.transform = "";
  const scale = Math.min(1, list.clientHeight / Math.max(content.scrollHeight, 1));
  content.style.transform = `scale(${scale})`;
}

/** Fit the 1080 × 1350 artwork into one screen, preserving export dimensions. */
function resizeRoundupPreview() {
  const scale = Math.max(.01, Math.min((window.innerWidth - 24) / 1080, (window.innerHeight - 64) / 1350, 1));
  const preview = document.querySelector(".roundup-preview");
  preview.style.width = `${1080 * scale}px`;
  preview.style.height = `${1350 * scale}px`;
  document.querySelector("#roundup-artwork").style.transform = `scale(${scale})`;
  fitRoundupList();
}

function renderWeeklyRoundup(events) {
  const range = roundupDateRange();
  const weekly = roundupEvents(events, range);
  document.querySelector("#roundup-list").innerHTML = weekly.length
    ? `<div class="roundup-events${weekly.length > 5 ? " is-dense" : ""}">${weekly.map(roundupEventMarkup).join("")}</div>`
    : '<p class="roundup-empty">No events listed for the rest of this week.</p>';
  document.querySelectorAll(".roundup-poster").forEach((poster) => {
    poster.addEventListener("load", resizeRoundupPreview, { once: true });
    poster.addEventListener("error", () => {
      poster.closest(".roundup-event").classList.remove("has-poster");
      poster.remove();
      resizeRoundupPreview();
    }, { once: true });
  });
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
      onclone: (clone) => { clone.querySelector("#roundup-artwork").style.transform = "none"; }
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Unable to create the image. Please try again.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ouems-roundup-${roundupDateRange().start}.png`;
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
  await loadEvents(renderWeeklyRoundup);
  if (state.loadError) {
    document.querySelector("#roundup-status").textContent = "Unable to load events. Please reload to try again.";
    document.querySelector("#roundup-list").innerHTML = '<p class="roundup-empty">Events could not be loaded.</p>';
  }
  await document.fonts.ready;
  resizeRoundupPreview();
}

initializeWeeklyRoundup();
