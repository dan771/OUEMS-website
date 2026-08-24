/**
 * Accessible custom select enhancement.
 *
 * Native <select> elements remain the source of truth for values and change
 * events. This script only supplies the visual trigger and option menu used by
 * the site design, which keeps the rest of the application framework-free.
 */

const customSelects = new Map();

/** Close one enhanced select and synchronize its accessibility state. */
function closeCustomSelect(control) {
  control.open = false;
  control.menu.hidden = true;
  control.trigger.setAttribute("aria-expanded", "false");
  control.wrapper.classList.remove("is-open");
}

/** Close every enhanced select currently registered on the page. */
function closeCustomSelects() {
  customSelects.forEach(closeCustomSelect);
}

/**
 * Rebuild the visible option menu from the native select.
 *
 * Rebuilding is useful because filter options may be disabled or replaced
 * after fresh spreadsheet data arrives.
 */
function refreshCustomSelect(select) {
  const control = customSelects.get(select);
  if (!control) return;

  const selected = select.options[select.selectedIndex] || select.options[0];
  control.value.textContent = selected?.textContent || "Select...";
  control.trigger.setAttribute("aria-label", select.getAttribute("aria-label") || selected?.textContent || "Select option");

  const optionButtons = [...select.options].map((option) => {
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
  });

  control.menu.replaceChildren(...optionButtons);
}

/** Enhance one native select with the site's custom trigger and listbox. */
function setupCustomSelect(select) {
  // Keep the native select in the DOM so forms, values, and browser semantics
  // continue to work even though the visual control is custom.
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
    if (control.open) {
      closeCustomSelect(control);
      return;
    }

    closeCustomSelects();
    control.open = true;
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    wrapper.classList.add("is-open");
  });

  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      trigger.click();
    }
    if (event.key === "Escape") closeCustomSelect(control);
  });

  select.addEventListener("change", () => refreshCustomSelect(select));
  refreshCustomSelect(select);
}

/** Enhance every select used by the event controls. */
function setupCustomSelects() {
  [
    elements.genre,
    elements.organizer,
    elements.venue,
    elements.sort,
    elements.startMode,
    elements.endMode,
    elements.pageSize
  ].forEach(setupCustomSelect);
}