// Quiz on /learning/quiz/: questions from the notes' front matter, shuffled.
// Two kinds of question:
//  - multiple choice (has options): pick one, get marked right or wrong straight away
//  - flashcard: think of the answer, reveal it, then say "Got it" or "Ask me again"
// A missed question comes back a few cards later. Results are only saved (privately, in
// this browser) when the owner has switched on the plan view.
(() => {
  const root = document.querySelector("[data-quiz]");
  if (!root) return;
  const ALL = JSON.parse(document.getElementById("quiz-data").textContent)
    .map((q) => ({ ...q, mcq: Array.isArray(q.options) && q.options.length > 1 }));
  const $ = (s) => root.querySelector(s);
  const card = $(".quiz-card"), done = $(".quiz-done"), filters = $(".quiz-filters");
  const qEl = $(".quiz-q"), aEl = $(".quiz-a"), countEl = $(".quiz-count"), source = $(".quiz-source");
  const optsEl = $(".quiz-options"), feedback = $(".quiz-feedback"), keysEl = $(".quiz-keys");
  const revealBtn = $(".quiz-reveal"), gotBtn = $(".quiz-got"), againBtn = $(".quiz-again"), nextBtn = $(".quiz-next");
  const skipBtn = $(".quiz-skip");
  const typeBtns = [...root.querySelectorAll(".type-filters button")];

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
  let typeFilter = ["mcq", "card"].includes(params.get("type")) ? params.get("type") : "all";
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
  typeBtns.forEach((b) => b.addEventListener("click", () => { typeFilter = b.dataset.type; syncUrl(); start(); }));

  const syncUrl = () => {
    const url = new URL(location.href);
    ["note", "topic", "type"].forEach((k) => url.searchParams.delete(k));
    if (noteFilter) url.searchParams.set("note", noteFilter);
    else if (topicFilter !== "all") url.searchParams.set("topic", topicFilter);
    if (typeFilter !== "all") url.searchParams.set("type", typeFilter);
    history.replaceState(null, "", url);
  };

  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const strip = (html) => html.replace(/^<p>|<\/p>$/g, "");

  let deck, pos, firstTry, skipped, total, state; // state: "ask" | "answered"
  const start = () => {
    const pool = ALL.filter((q) =>
      (noteFilter ? q.note === noteFilter : topicFilter === "all" || q.topicSlug === topicFilter) &&
      (typeFilter === "all" || (typeFilter === "mcq") === q.mcq));
    filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(!noteFilter && b.dataset.topic === topicFilter)));
    typeBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === typeFilter)));
    deck = shuffle(pool.slice());
    total = pool.length;
    pos = 0;
    firstTry = new Map();
    skipped = new Set();
    done.hidden = true;
    card.hidden = false;
    if (!deck.length) {
      qEl.textContent = "No questions here yet.";
      countEl.textContent = "";
      source.hidden = aEl.hidden = optsEl.hidden = feedback.hidden = true;
      revealBtn.hidden = gotBtn.hidden = againBtn.hidden = nextBtn.hidden = skipBtn.hidden = true;
      keysEl.textContent = "";
      return;
    }
    show();
  };

  const show = () => {
    const q = deck[pos];
    state = "ask";
    countEl.textContent = `Question ${Math.min(firstTry.size + skipped.size + 1, total)} of ${total} · `;
    source.hidden = false;
    source.href = q.url;
    source.textContent = noteFilter ? q.noteTitle : `${q.topic}: ${q.noteTitle}`;
    qEl.innerHTML = strip(q.q);
    aEl.innerHTML = q.a;
    aEl.hidden = true;
    feedback.hidden = true;
    gotBtn.hidden = againBtn.hidden = nextBtn.hidden = true;
    skipBtn.hidden = false;
    card.classList.toggle("is-mcq", q.mcq);
    if (q.mcq) {
      revealBtn.hidden = true;
      optsEl.hidden = false;
      optsEl.innerHTML = "";
      // shuffle the options each time the question is shown
      shuffle(q.options.map((html, i) => ({ html, right: i === q.correct }))).forEach((o, i) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "quiz-option";
        b.dataset.right = o.right ? "1" : "";
        b.innerHTML = `<span class="opt-key mono">${i + 1}</span><span class="opt-text">${o.html}</span>`;
        b.addEventListener("click", () => choose(b));
        li.appendChild(b);
        optsEl.appendChild(li);
      });
      keysEl.innerHTML = `Keys: <kbd>1</kbd>–<kbd>${q.options.length}</kbd> choose · <kbd>S</kbd> skip · <kbd>Enter</kbd> next question`;
    } else {
      optsEl.hidden = true;
      revealBtn.hidden = false;
      keysEl.innerHTML = "Keys: <kbd>Space</kbd> show answer · <kbd>S</kbd> skip · <kbd>1</kbd> got it · <kbd>2</kbd> ask me again";
    }
  };

  // multiple choice
  const choose = (btn) => {
    if (state !== "ask") return;
    state = "answered";
    const right = btn.dataset.right === "1";
    optsEl.querySelectorAll(".quiz-option").forEach((b) => {
      b.disabled = true;
      if (b.dataset.right === "1") b.classList.add("right");
    });
    if (!right) btn.classList.add("wrong");
    btn.setAttribute("aria-pressed", "true");
    skipBtn.hidden = true;
    feedback.hidden = false;
    feedback.className = `quiz-feedback ${right ? "ok" : "bad"}`;
    feedback.textContent = right ? "Correct!" : "Not quite. The right answer is highlighted.";
    aEl.hidden = false;
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
    settle(right);
  };

  // flashcards
  const reveal = () => {
    if (state !== "ask" || deck[pos].mcq || card.hidden) return;
    state = "answered";
    aEl.hidden = false;
    revealBtn.hidden = true;
    skipBtn.hidden = true;
    gotBtn.hidden = againBtn.hidden = false;
    gotBtn.focus({ preventScroll: true });
  };
  const rate = (got) => {
    if (state !== "answered" || deck[pos].mcq || card.hidden) return;
    settle(got);
    advance();
  };

  // skip: move on without answering; not scored, listed in the summary
  const skip = () => {
    if (state !== "ask" || card.hidden) return;
    const q = deck[pos];
    if (!firstTry.has(q.id)) skipped.add(q.id);
    advance();
  };

  // shared: record the result and, if missed, ask again a few cards later
  const settle = (got) => {
    const q = deck[pos];
    record(q.id, got);
    if (!firstTry.has(q.id)) firstTry.set(q.id, got);
    if (!got) deck.splice(Math.min(pos + 4, deck.length), 0, q);
  };
  const advance = () => {
    pos++;
    if (pos >= deck.length) finish();
    else { show(); (deck[pos].mcq ? optsEl.querySelector("button") : revealBtn).focus({ preventScroll: true }); }
  };

  const finish = () => {
    card.hidden = true;
    done.hidden = false;
    const knew = [...firstTry.values()].filter(Boolean).length;
    const answered = firstTry.size;
    done.querySelector(".quiz-score").textContent = !answered
      ? `You skipped all ${total} questions.`
      : `You knew ${knew} of ${answered} on the first try${skipped.size ? `, and skipped ${skipped.size}` : ""}.`;
    const missed = ALL.filter((q) => firstTry.get(q.id) === false || skipped.has(q.id));
    const review = done.querySelector(".quiz-review"), list = done.querySelector(".quiz-review-list");
    list.innerHTML = "";
    missed.forEach((q) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = q.url;
      a.textContent = q.noteTitle;
      const qs = document.createElement("span");
      qs.className = "muted";
      qs.innerHTML = ` · ${q.q.replace(/<\/?p>/g, "")}${skipped.has(q.id) ? " <em>(skipped)</em>" : ""}`;
      li.append(a, qs);
      list.appendChild(li);
    });
    review.hidden = missed.length === 0;
    done.querySelector(".quiz-restart").focus({ preventScroll: true });
  };

  revealBtn.addEventListener("click", reveal);
  gotBtn.addEventListener("click", () => rate(true));
  againBtn.addEventListener("click", () => rate(false));
  nextBtn.addEventListener("click", () => { if (state === "answered") advance(); });
  skipBtn.addEventListener("click", skip);
  done.querySelector(".quiz-restart").addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || card.hidden || !deck || !deck.length) return;
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (document.querySelector(".term-overlay:not([hidden])")) return;
    const onControl = /BUTTON|A|SUMMARY/.test(e.target.tagName);
    const q = deck[pos];
    if ((e.key === "s" || e.key === "S") && state === "ask") { e.preventDefault(); skip(); return; }
    if (q.mcq) {
      const n = parseInt(e.key, 10);
      if (state === "ask" && n >= 1 && n <= q.options.length) { e.preventDefault(); choose(optsEl.querySelectorAll(".quiz-option")[n - 1]); }
      else if (state === "answered" && e.key === "Enter" && !onControl) { e.preventDefault(); advance(); }
    } else {
      if (e.key === " " && !onControl) { e.preventDefault(); reveal(); }
      else if (e.key === "1") rate(true);
      else if (e.key === "2") rate(false);
    }
  });
  start();
})();
