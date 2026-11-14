// Theme switch: "system" (follow the device), "light" or "dark".
// Loaded in <head> before the stylesheet, so the saved theme applies before the
// page is drawn and there's no flash of the wrong colours.
(() => {
  const KEY = "theme";
  const ORDER = ["system", "light", "dark"];
  const LABEL = { system: "System", light: "Light", dark: "Dark" };
  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  let pref = "system";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") pref = saved;
  } catch { /* storage blocked: fall back to system */ }

  const effective = () => (pref === "system" ? (media && media.matches ? "light" : "dark") : pref);

  const apply = () => {
    if (pref === "system") delete root.dataset.theme; else root.dataset.theme = pref;
    root.dataset.themePref = pref;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", effective() === "light" ? "#f7f8fb" : "#0b0f17");
    const label = `Theme: ${LABEL[pref]}. Click to switch.`;
    document.querySelectorAll(".theme-btn").forEach((b) => {
      b.setAttribute("aria-label", label);
      b.title = label;
      const text = b.querySelector(".theme-text");
      if (text) text.textContent = `Theme: ${LABEL[pref]}`;
    });
  };

  const set = (next) => {
    if (!ORDER.includes(next)) return false;
    pref = next;
    try {
      if (pref === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
    } catch { /* not saved, still applied for this page */ }
    apply();
    return true;
  };

  apply();
  if (media && media.addEventListener) media.addEventListener("change", apply);

  document.addEventListener("DOMContentLoaded", () => {
    apply(); // the meta tag and buttons exist now
    document.querySelectorAll(".theme-btn").forEach((b) =>
      b.addEventListener("click", () => set(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]))
    );
  });

  // Used by the terminal's `theme` command
  window.portfolioTheme = { get: () => pref, set, effective };
})();
