/**
 * Spreadsheet loading and cache coordination.
 *
 * The page renders cached events first for a fast, resilient startup, then
 * revalidates against Google Sheets. A failed refresh leaves valid cached data
 * on screen rather than replacing it with an error state.
 */

/** Download and normalize the first worksheet from the configured workbook. */
async function fetchEventsFromSheet() {
  if (!window.XLSX) throw new Error("XLSX parser failed to load");

  const response = await fetch(SHEET_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Sheet request failed: ${response.status}`);

  const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true
  });

  return normalizeRows(rows);
}

/** Render cached data immediately and then refresh it from the spreadsheet. */
async function loadEvents() {
  state.loadError = false;
  state.month = new Date();

  const cachedEvents = readEventCache();
  if (cachedEvents) applyEvents(cachedEvents);

  try {
    const events = await fetchEventsFromSheet();
    writeEventCache(events);
    applyEvents(events);
  } catch (error) {
    state.loadError = !cachedEvents;
    const message = cachedEvents
      ? "Unable to refresh events; using cached data"
      : "Unable to load events";
    console[cachedEvents ? "warn" : "error"](message, error);
  }
}