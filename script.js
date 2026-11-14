// Shared page behaviour. Every block checks that its elements exist,
// because case study pages don't have all of them.

// Footer year
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// Nav: border on scroll
const nav = document.querySelector(".nav");
if (nav) {
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

// Reveal sections on scroll
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); }
    }),
    { threshold: 0.08 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
}

// Background glow follows the cursor
const glow = document.querySelector(".bg-glow");
if (glow) {
  window.addEventListener("pointermove", (e) => {
    glow.style.setProperty("--mx", `${(e.clientX / window.innerWidth) * 100}%`);
    glow.style.setProperty("--my", `${(e.clientY / window.innerHeight) * 100}%`);
  });
}

// Remove any service worker left behind by the old version of this site
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}

// Home page "Play" teaser: show this visitor's best score and a small typing preview
const teaser = document.getElementById("play-teaser");
if (teaser) {
  const NAMES = { dev: "dev words", common: "common words", code: "code" };
  try {
    const pb = JSON.parse(localStorage.getItem("typing-pb")) || {};
    let best = null;
    Object.entries(pb).forEach(([key, wpm]) => { if (!best || wpm > best.wpm) best = { key, wpm }; });
    if (best) {
      const [mode, secs] = best.key.split("-");
      teaser.querySelector(".teaser-best").textContent =
        `Your best: ${best.wpm} wpm · ${NAMES[mode] || mode} · ${secs}s. Can you beat it?`;
    }
  } catch { /* storage blocked: keep the default text */ }

  const box = teaser.querySelector(".teaser-words");
  const wpmEl = teaser.querySelector(".teaser-wpm");
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LINES = ["kafka idempotent mutex jwks sharding", "ZREMRANGEBYSCORE backoff quorum tenant", "volatile deadlock outbox canary webhook"];
  const render = (text, typed) => {
    box.textContent = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.textContent = ch;
      if (i < typed) span.className = "t-ok";
      if (i === typed) span.className = "t-caret";
      box.appendChild(span);
    });
  };
  if (still) {
    render(LINES[0], LINES[0].length);
    wpmEl.textContent = "64";
  } else {
    let line = 0, typed = 0;
    const step = () => {
      const text = LINES[line];
      render(text, typed);
      wpmEl.textContent = typed ? Math.min(99, 40 + Math.round(typed * 1.3)) : 0;
      if (typed <= text.length) { typed++; setTimeout(step, 70 + Math.random() * 90); }
      else { setTimeout(() => { line = (line + 1) % LINES.length; typed = 0; step(); }, 1600); }
    };
    // only animate while the teaser is on screen
    let running = false;
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !running) { running = true; step(); } }).observe(teaser);
    render(LINES[0], 0);
  }
}
