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
