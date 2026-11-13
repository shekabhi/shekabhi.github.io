// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Nav: shadow on scroll
const nav = document.querySelector(".nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 20);
});

// Mobile menu
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
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

// Reveal sections on scroll
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// Background glow follows the cursor
const glow = document.querySelector(".bg-glow");
window.addEventListener("pointermove", (e) => {
  glow.style.setProperty("--mx", `${(e.clientX / window.innerWidth) * 100}%`);
  glow.style.setProperty("--my", `${(e.clientY / window.innerHeight) * 100}%`);
});
