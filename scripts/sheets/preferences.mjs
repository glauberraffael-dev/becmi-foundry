/** Small helpers shared by the BECMI ApplicationV2 sheets. */

export function isDarkMode() {
  try {
    return Boolean(game.settings?.get?.("becmi", "darkMode"));
  } catch {
    return false;
  }
}

export async function setDarkMode(value) {
  try {
    if (game.settings?.settings?.settings?.has("becmi.darkMode")
      || game.settings?.settings?.has("becmi.darkMode")) {
      await game.settings.set("becmi", "darkMode", Boolean(value));
    }
  } catch {
    // The sheet still toggles for this render when settings are unavailable.
  }
}

export function applySheetTheme(element, dark) {
  if (!element?.classList) return;
  element.classList.toggle("becmi-dark", Boolean(dark));
  element.dataset.theme = dark ? "dark" : "light";
}

const IMAGE_PATHS = new Set([
  "img", "prototypeToken.texture.src", "texture.src", "system.img"
]);

/**
 * Foundry rejects empty or extension-less image paths. Those values can leak
 * into a form submission when the FilePicker is cancelled, so drop only the
 * invalid image fields and keep every other change.
 */
export function sanitizeImageUpdate(update) {
  const data = { ...(update ?? {}) };
  for (const path of IMAGE_PATHS) {
    if (!(path in data)) continue;
    const value = String(data[path] ?? "").trim();
    if (!value || !/\.[A-Za-z0-9]+(?:$|[?#])/.test(value)) delete data[path];
  }
  return data;
}
