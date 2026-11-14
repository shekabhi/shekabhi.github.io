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

  // `origin` is the {x, y} the change starts from (the button that was clicked).
  // With it, the new theme spreads out in a circle from that point.
  const set = (next, origin) => {
    if (!ORDER.includes(next)) return false;
    pref = next;
    try {
      if (pref === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
    } catch { /* not saved, still applied for this page */ }
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!origin || still || !document.startViewTransition) { apply(); return true; }
    root.classList.add("theme-switching");
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
      root.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 600, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove("theme-switching"));
    return true;
  };

  apply();
  if (media && media.addEventListener) media.addEventListener("change", apply);

  document.addEventListener("DOMContentLoaded", () => {
    apply(); // the meta tag and buttons exist now
    document.querySelectorAll(".theme-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const r = b.getBoundingClientRect();
        set(ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length], { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      })
    );
  });

  // Used by the terminal's `theme` command
  window.portfolioTheme = { get: () => pref, set, effective };
})();
