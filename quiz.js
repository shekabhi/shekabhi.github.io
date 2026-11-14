// Quiz on /learning/quiz/: questions from the notes' front matter, shuffled.
// "Ask me again" puts a question back a few cards later. Results are only saved
// (privately, in this browser) when the owner has switched on the plan view.
(() => {
  const root = document.querySelector("[data-quiz]");
  if (!root) return;
  const ALL = JSON.parse(document.getElementById("quiz-data").textContent);
  const $ = (s) => root.querySelector(s);
  const card = $(".quiz-card"), done = $(".quiz-done"), filters = $(".quiz-filters");
  const qEl = $(".quiz-q"), aEl = $(".quiz-a"), countEl = $(".quiz-count"), source = $(".quiz-source");
  const revealBtn = $(".quiz-reveal"), gotBtn = $(".quiz-got"), againBtn = $(".quiz-again");

  let planOn = false;
  try { planOn = localStorage.getItem("study-plan") === "on"; } catch { /* storage blocked */ }
  const record = (id, got) => {
    if (!planOn) return;
    try {
      const p = JSON.parse(localStorage.getItem("study-progress")) || {};
      const r = p[id] || { got: 0, again: 0 };
      if (got) r.got++; else r.again++;
      r.lastResult = got ? "got" : "again";
      r.last = new Date().toISOString().slice(0, 10);
      p[id] = r;
      localStorage.setItem("study-progress", JSON.stringify(p));
    } catch { /* not saved */ }
  };

  const params = new URLSearchParams(location.search);
  let noteFilter = params.get("note");
  let topicFilter = params.get("topic") || "all";
  if (noteFilter && !ALL.some((q) => q.note === noteFilter)) noteFilter = null;

  // topic buttons
  const topics = [];
  ALL.forEach((q) => { const t = topics.find((x) => x.slug === q.topicSlug); if (t) t.n++; else topics.push({ slug: q.topicSlug, name: q.topic, n: 1 }); });
  const makeBtn = (slug, label, n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.topic = slug;
    b.innerHTML = `${label} <span>${n}</span>`;
    b.addEventListener("click", () => { noteFilter = null; topicFilter = slug; syncUrl(); start(); });
    filters.appendChild(b);
  };
  makeBtn("all", "All", ALL.length);
  topics.sort((a, b) => a.name.localeCompare(b.name)).forEach((t) => makeBtn(t.slug, t.name, t.n));

  const syncUrl = () => {
    const url = new URL(location.href);
    url.searchParams.delete("note"); url.searchParams.delete("topic");
    if (noteFilter) url.searchParams.set("note", noteFilter);
    else if (topicFilter !== "all") url.searchParams.set("topic", topicFilter);
    history.replaceState(null, "", url);
  };

  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  let deck, pos, firstTry, total;
  const start = () => {
    const pool = ALL.filter((q) => (noteFilter ? q.note === noteFilter : topicFilter === "all" || q.topicSlug === topicFilter));
    filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(!noteFilter && b.dataset.topic === topicFilter)));
    deck = shuffle(pool.slice());
    total = pool.length;
    pos = 0;
    firstTry = new Map();
    done.hidden = true;
    card.hidden = false;
    if (!deck.length) { qEl.textContent = "No questions here yet."; aEl.hidden = true; countEl.textContent = ""; source.hidden = true; revealBtn.hidden = gotBtn.hidden = againBtn.hidden = true; return; }
    show();
  };

  const show = () => {
    const q = deck[pos];
    countEl.textContent = `Question ${Math.min(firstTry.size + 1, total)} of ${total} · `;
    source.hidden = false;
    source.href = q.url;
    source.textContent = noteFilter ? q.noteTitle : `${q.topic}: ${q.noteTitle}`;
    qEl.innerHTML = q.q.replace(/^<p>|<\/p>$/g, "");
    aEl.innerHTML = q.a;
    aEl.hidden = true;
    revealBtn.hidden = false;
    gotBtn.hidden = againBtn.hidden = true;
  };

  const reveal = () => {
    if (aEl.hidden === false || card.hidden) return;
    aEl.hidden = false;
    revealBtn.hidden = true;
    gotBtn.hidden = againBtn.hidden = false;
    gotBtn.focus({ preventScroll: true });
  };

  const answer = (got) => {
    if (aEl.hidden || card.hidden) return;
    const q = deck[pos];
    record(q.id, got);
    if (!firstTry.has(q.id)) firstTry.set(q.id, got);
    if (!got) deck.splice(Math.min(pos + 4, deck.length), 0, q); // ask again a few cards later
    pos++;
    if (pos >= deck.length) finish(); else { show(); revealBtn.focus({ preventScroll: true }); }
  };

  const finish = () => {
    card.hidden = true;
    done.hidden = false;
    const knew = [...firstTry.values()].filter(Boolean).length;
    done.querySelector(".quiz-score").textContent = `You knew ${knew} of ${total} on the first try.`;
    const missed = ALL.filter((q) => firstTry.get(q.id) === false);
    const review = done.querySelector(".quiz-review"), list = done.querySelector(".quiz-review-list");
    list.innerHTML = "";
    missed.forEach((q) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = q.url;
      a.textContent = q.noteTitle;
      const qs = document.createElement("span");
      qs.className = "muted";
      qs.innerHTML = ` · ${q.q.replace(/<\/?p>/g, "")}`;
      li.append(a, qs);
      list.appendChild(li);
    });
    review.hidden = missed.length === 0;
    done.querySelector(".quiz-restart").focus({ preventScroll: true });
  };

  revealBtn.addEventListener("click", reveal);
  gotBtn.addEventListener("click", () => answer(true));
  againBtn.addEventListener("click", () => answer(false));
  done.querySelector(".quiz-restart").addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (document.querySelector(".term-overlay:not([hidden])")) return;
    const onControl = /BUTTON|A|SUMMARY/.test(e.target.tagName);
    if (e.key === " " && !onControl) { e.preventDefault(); reveal(); }
    else if (e.key === "1") answer(true);
    else if (e.key === "2") answer(false);
  });
  start();
})();
