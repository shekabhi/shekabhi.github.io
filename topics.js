// Topics page. Visitors see only topics that have notes. When the owner has
// switched on the private plan view (terminal: `plan on`), this browser also
// shows every topic in the catalogue and the owner's own quiz results.
(() => {
  let on = false;
  try { on = localStorage.getItem("study-plan") === "on"; } catch { /* storage blocked */ }
  if (!on) return;
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem("study-progress")) || {}; } catch { /* ignore */ }

  document.body.classList.add("plan-mode");
  document.querySelector(".plan-banner").hidden = false;
  document.querySelectorAll(".plan-only").forEach((el) => (el.hidden = false));
  document.querySelectorAll(".topic.plan-only").forEach((li) => {
    const tag = document.createElement("span");
    tag.className = "plan-todo mono";
    tag.textContent = "not started";
    li.appendChild(tag);
  });

  // key topics get a star, only in the private view
  document.querySelectorAll('[data-key="true"]').forEach((li) => {
    const star = document.createElement("span");
    star.className = "plan-star";
    star.title = "Key topic";
    star.textContent = "★";
    li.prepend(star);
  });

  document.querySelectorAll(".topic-area").forEach((area) => {
    const all = area.querySelectorAll(".topic").length;
    const covered = area.querySelectorAll(".topic:not(.plan-only)").length;
    const stat = document.createElement("p");
    stat.className = "plan-area-stat mono";
    stat.textContent = `${covered} of ${all} topics have notes`;
    area.querySelector("h2").after(stat);
  });

  document.querySelectorAll(".plan-stat").forEach((el) => {
    const slug = el.dataset.note, n = +el.dataset.questions;
    let got = 0, tried = 0;
    for (let i = 1; i <= n; i++) {
      const r = progress[`${slug}-${i}`];
      if (r) { tried++; if (r.lastResult === "got") got++; }
    }
    el.textContent = tried ? `quiz ${got}/${n}` : "quiz not tried";
    el.hidden = false;
  });
})();
