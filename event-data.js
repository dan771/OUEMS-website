/**
 * External data normalization, display formatting, and cache primitives.
 *
 * Everything returned by normalizeRows has a stable shape. Rendering code can
 * therefore use event fields without knowing whether the spreadsheet supplied
 * a column, an Excel serial value, a Google Drive ID, or an empty cell.
 */

// -----------------------------------------------------------------------------
// Spreadsheet value normalization
// -----------------------------------------------------------------------------

/** Convert a Drive sharing URL or bare ID into a direct image source. */
function driveImageSource(value) {
  const text = String(value || "").trim();
  const match = text.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  const id = match?.[1] || (/^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : "");
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : text;
}

/** Route Drive images through an image proxy while leaving normal URLs intact. */
function driveImageUrl(value) {
  const source = driveImageSource(value);
  return source.includes("drive.google.com/")
    ? `https://wsrv.nl/?url=${encodeURIComponent(source)}&w=1600&q=85`
    : source;
}

/** Convert spreadsheet or human-entered times into minutes after midnight. */
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

/** Format minutes after midnight using the site's 24-hour dotted style. */
function formatClock(minutes) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}.${String(normalized % 60).padStart(2, "0")}`;
}

/** Create the display range for one normalized event. */
function eventTime(event) {
  const start = minutesFromTime(event.time);
  const end = minutesFromTime(event.endTime);
  return start !== null && end !== null ? `${formatClock(start)}–${formatClock(end)}` : start !== null ? formatClock(start) : "Time TBA";
}

function eventEndMinutes(event) {
  return minutesFromTime(event.endTime);
}

/** Test an event time against an optional before/after filter boundary. */
function matchesTimeBoundary(eventTime, boundary, mode) {
  if (boundary === null) return true;
  if (eventTime === null) return false;
  return mode === "before" ? eventTime <= boundary : eventTime >= boundary;
}

/** Normalize Excel serial dates and date-like strings to YYYY-MM-DD. */
function excelDate(value) {
  if (typeof value === "number" && window.XLSX) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

/** Normalize Excel fractional-day times and strings to a parseable value. */
function excelTime(value) {
  if (typeof value === "number") {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return String(value || "").trim();
}

/**
 * Find a column by exact alias first, then tolerate descriptive header suffixes.
 * The fallback supports form-generated headers such as "Venue (include room)".
 */
function headerIndex(headers, label) {
  const labels = Array.isArray(label) ? label : [label];
  const normalized = headers.map((header) => String(header).toLowerCase().trim());
  const exact = normalized.findIndex((header) => labels.includes(header));
  if (exact >= 0) return exact;
  return normalized.findIndex((header) => labels.some((candidate) => header.includes(candidate)));
}

function rowValue(row, index, fallback = "") {
  return index >= 0 && row[index] !== undefined && row[index] !== null ? row[index] : fallback;
}

/** Map stable event field names to their current worksheet column positions. */
function buildColumnIndex(headers) {
  return Object.fromEntries(
    Object.entries(SHEET_HEADERS).map(([key, aliases]) => [key, headerIndex(headers, aliases)])
  );
}

/** Convert one accepted spreadsheet row into the application's event shape. */
function normalizeEventRow(row, index) {
  const photo = rowValue(row, index.photo);

  return {
    name: rowValue(row, index.name, "Untitled transmission"),
    promoter: rowValue(row, index.promoter, "OUEMS"),
    description: rowValue(row, index.description, "An OUEMS electronic music event."),
    lineup: rowValue(row, index.lineup, "Lineup TBA"),
    date: excelDate(rowValue(row, index.date)),
    time: excelTime(rowValue(row, index.time)),
    endTime: excelTime(rowValue(row, index.endTime)),
    cost: costLabel(rowValue(row, index.cost)),
    genre: rowValue(row, index.genre, "electronic"),
    venue: rowValue(row, index.venue, "Venue TBA"),
    ticketUrl: rowValue(row, index.ticketUrl),
    minimumAge: rowValue(row, index.minimumAge),
    signupUrl: rowValue(row, index.signupUrl),
    accepted: rowValue(row, index.accepted),
    photo: driveImageUrl(photo),
    photoSource: driveImageSource(photo)
  };
}

/** Validate required columns and normalize every accepted event row. */
function normalizeRows(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map((header) => String(header).trim());
  const index = buildColumnIndex(headers);
  const missingColumns = REQUIRED_SHEET_COLUMNS.filter((key) => index[key] < 0);

  if (missingColumns.length) throw new Error(`Missing required sheet columns: ${missingColumns.join(", ")}`);

  // Optional columns deliberately fall back inside normalizeEventRow. This
  // keeps harmless spreadsheet edits from taking down the entire programme.
  return rows
    .slice(1)
    .filter((row) => rowValue(row, index.name) && String(rowValue(row, index.accepted)).trim().toLowerCase() === "yes")
    .map((row) => normalizeEventRow(row, index));
}


// -----------------------------------------------------------------------------
// Event labels, dates and safe output
// -----------------------------------------------------------------------------

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

/** Add Oxford week notation when a date falls within a configured term. */
function oxfordWeekLabel(dateKey, day) {
  const term = oxfordTermForDate(dateKey);
  if (!term) return String(day);
  const daysSinceZeroWeek = Math.round((new Date(`${dateKey}T12:00:00`) - new Date(`${term.zeroWeekStart}T12:00:00`)) / 86400000);
  return `wk${Math.floor(daysSinceZeroWeek / 7)} // ${day}`;
}

/** Split a free-form lineup field into escaped artist-name elements. */
function lineupList(value) {
  return String(value || "Lineup TBA")
    .split(/\r?\n|[,;]+/)
    .map((artist) => artist.trim())
    .filter(Boolean)
    .map((artist) => `<span>${escapeHtml(artist)}</span>`)
    .join("");
}

/** Return normalized genre keys used by filtering. */
function eventGenres(value) {
  return String(value || "")
    .split(",")
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean);
}

function genreLabel(genre) {
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

/** Split collaborations into individual organizer labels. */
function organizerParts(value) {
  return String(value || "")
    .split(/\s+x\s+|,|\//i)
    .map((organizer) => organizer.trim())
    .filter(Boolean);
}

function organizerKey(value) {
  return String(value || "").trim().toLowerCase();
}

/** Normalize empty and numeric-zero costs into readable labels. */
function costLabel(value) {
  const text = String(value ?? "").trim();
  return text && Number(text) === 0 ? "Free" : text || "Free / TBA";
}

/** Accept only web URLs before exposing spreadsheet links to the DOM. */
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
// Spreadsheet fields are user-controlled. Escape every field before placing it
// in an HTML template, including values used inside attributes.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

/** Escape a value before interpolation into an HTML attribute. */
function escapeAttribute(value) {
  return escapeHtml(value);
}

/** Normalize numeric and free-form age restrictions for display. */
function minimumAgeLabel(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Age TBA";
  const numeric = Number(text);
  return Number.isFinite(numeric) ? `${numeric}+` : text.endsWith("+") ? text : `${text}+`;
}

/** Prefer signup links over ticket links and return their UI metadata. */
function eventAction(event) {
  if (!event) return null;
  const signup = ticketUrl(event.signupUrl);
  if (signup) return { url: signup, label: "Sign up", icon: "clipboard-pen-line" };
  const tickets = ticketUrl(event.ticketUrl);
  return tickets ? { url: tickets, label: "Tickets", icon: "ticket" } : null;
}


// -----------------------------------------------------------------------------
// Local cache and event state
// -----------------------------------------------------------------------------

/** Read cached events only when their minimum required shape is intact. */
function readEventCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(EVENT_CACHE_KEY) || "null");
    if (!cached || !Array.isArray(cached.events) || !cached.events.every((event) => event && typeof event.name === "string" && typeof event.date === "string" && typeof event.time === "string")) return null;
    return cached.events;
  } catch (error) {
    return null;
  }
}

/** Cache normalized events; storage failures remain non-fatal. */
function writeEventCache(events) {
  try {
    localStorage.setItem(EVENT_CACHE_KEY, JSON.stringify({ events }));
  } catch (error) {
    console.warn("Unable to cache events", error);
  }
}
