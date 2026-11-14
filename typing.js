// Typing speed test on /play/. Original game: type words against the clock,
// get WPM, accuracy and a speed chart. Personal bests are kept in this browser.
(() => {
  const root = document.querySelector("[data-typing-test]");
  if (!root) return;

  const WORDS = {
    common: ("the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are has had been more find here thing many long great little world still own life while last might again never under same tell ask turn place feel high every near add food between keep tree start light story far left late run hold off city show open seem together next white begin got walk example ease paper group always music those both mark often letter until mile river car feet care second book carry took science eat room friend began idea fish mountain stop once base hear horse cut sure watch color face wood main enough plain girl usual young ready above ever red list though talk bird soon body dog family direct pose leave song measure door product black short numeral class wind question happen complete ship area half rock order fire south problem piece told knew pass since top whole king space heard best hour better true during hundred five remember step early hold west ground interest reach fast verb sing listen six table travel less morning ten simple several vowel toward war lay against pattern slow center love person money serve appear road map rain rule govern pull cold notice voice unit power town fine certain fly fall lead cry dark machine note wait plan figure star box noun field rest correct able pound done beauty drive stood contain front teach week final gave green oh quick develop ocean warm free minute strong special mind behind clear tail produce fact street inch multiply nothing course stay wheel full force blue object decide surface deep moon island foot system busy test record boat common gold possible plane stead dry wonder laugh thousand ago ran check game shape equate miss brought heat snow tire bring yes distant fill east paint language among").split(" "),
    dev: ("api cache thread lock queue redis kafka token scope jwt jwks oauth pkce spring boot java bean stream lambda async await retry timeout latency index query join commit rollback deploy docker build test mock patch merge branch rebase kernel socket packet header cookie session request response status error null void final static class interface record enum switch yield shard replica leader quorum consensus raft idempotent throttle limiter window bucket counter metric trace span log alert config secret vault cert tls fips cipher hash salt nonce payload schema field column table view trigger cursor batch bulk topic partition offset consumer producer broker cluster node pod container image volume ingress gateway proxy router endpoint handler filter servlet tomcat jvm heap stack garbage collector pool executor future promise callback event listener observer factory builder singleton adapter facade strategy mutex semaphore volatile atomic deadlock livelock backoff jitter circuit breaker bulkhead fallback saga outbox webhook grpc rest json yaml http https dns cdn load balancer replication failover snapshot backup migration flyway liquibase hibernate jpa entity repository service controller dto mapper validator middleware interceptor serializer deserializer encoder decoder buffer channel selector reactor netty vertx coroutine scheduler cron daemon systemd nginx apache bastion firewall subnet vpc iam role policy principal claim audience issuer expiry refresh revoke grant consent tenant quota sla slo sli uptime incident postmortem runbook canary rollout feature flag toggle sidecar mesh envoy istio helm terraform ansible pipeline artifact registry semver changelog hotfix release tag sprint backlog ticket review approve ZREMRANGEBYSCORE ZCARD ZADD EXPIRE SETNX INCR").split(" "),
  };
  const PB_KEY = "typing-pb";

  // ---------- elements ----------
  const $ = (sel) => root.querySelector(sel);
  const stage = $(".type-stage");
  const wordsEl = $(".type-words");
  const input = $(".type-input");
  const caret = document.createElement("span");
  caret.className = "type-caret";
  const timeEl = $(".type-time");
  const liveWpmEl = $(".type-live-wpm");
  const hint = $(".type-hint");
  const results = $(".type-results");
  const modeButtons = [...root.querySelectorAll("[data-mode]")];
  const timeButtons = [...root.querySelectorAll("[data-time]")];

  // ---------- state ----------
  let mode = "dev", duration = 30;
  let words, wordEls, index, typedPrev, history, keys, started, finished, startAt, timer, samples;

  const loadPB = () => { try { return JSON.parse(localStorage.getItem(PB_KEY)) || {}; } catch { return {}; } };
  const savePB = (pb) => { try { localStorage.setItem(PB_KEY, JSON.stringify(pb)); } catch { /* not saved */ } };

  const randomWords = (n) => {
    const list = WORDS[mode], out = [];
    for (let i = 0; i < n; i++) {
      let w;
      do { w = list[Math.floor(Math.random() * list.length)]; } while (w === out[out.length - 1]);
      out.push(w);
    }
    return out;
  };

  const makeWordEl = (w) => {
    const el = document.createElement("span");
    el.className = "w";
    for (const ch of w) {
      const l = document.createElement("span");
      l.className = "l";
      l.textContent = ch;
      el.appendChild(l);
    }
    return el;
  };

  const addWords = (n) => {
    const fresh = randomWords(n);
    words.push(...fresh);
    fresh.forEach((w) => { const el = makeWordEl(w); wordEls.push(el); wordsEl.appendChild(el); });
  };

  const reset = () => {
    clearInterval(timer);
    words = []; wordEls = []; index = 0; typedPrev = ""; history = [];
    keys = { correct: 0, incorrect: 0 }; started = false; finished = false; samples = [];
    wordsEl.innerHTML = "";
    wordsEl.appendChild(caret);
    addWords(120);
    input.value = "";
    input.disabled = false;
    timeEl.textContent = duration;
    liveWpmEl.textContent = "0";
    stage.classList.remove("running");
    stage.hidden = false;
    results.hidden = true;
    hint.textContent = "Start typing to begin";
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    timeButtons.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.time === duration)));
    requestAnimationFrame(placeCaret);
    input.focus({ preventScroll: true });
  };

  // ---------- rendering ----------
  const paintWord = (i, typed) => {
    const el = wordEls[i], word = words[i];
    el.querySelectorAll(".extra").forEach((x) => x.remove());
    const letters = el.querySelectorAll(".l");
    letters.forEach((l, k) => {
      l.classList.toggle("ok", k < typed.length && typed[k] === word[k]);
      l.classList.toggle("bad", k < typed.length && typed[k] !== word[k]);
    });
    for (let k = word.length; k < typed.length; k++) {
      const x = document.createElement("span");
      x.className = "l extra";
      x.textContent = typed[k];
      el.appendChild(x);
    }
  };

  const placeCaret = () => {
    const el = wordEls[index];
    if (!el) return;
    const letters = el.querySelectorAll(".l");
    const typedLen = input.value.length;
    let left, top;
    if (typedLen < letters.length) {
      left = letters[typedLen].offsetLeft + el.offsetLeft;
      top = el.offsetTop;
    } else {
      const last = letters[letters.length - 1];
      left = el.offsetLeft + last.offsetLeft + last.offsetWidth;
      top = el.offsetTop;
    }
    caret.style.transform = `translate(${left}px, ${top}px)`;
  };

  // Keep the current word on the first or second line: drop finished lines above it
  const scrollLines = () => {
    const el = wordEls[index];
    const first = wordEls.find((w) => w.isConnected);
    if (!el || !first) return;
    const lineH = el.offsetHeight;
    if (el.offsetTop - first.offsetTop >= lineH * 1.5) {
      const top = first.offsetTop;
      wordEls.forEach((w, i) => { if (i < index && w.isConnected && w.offsetTop === top) w.remove(); });
    }
    if (words.length - index < 60) addWords(60);
  };

  // ---------- stats ----------
  const correctChars = () => {
    let n = 0;
    history.forEach((h) => { if (h.typed === h.word) n += h.word.length + 1; });
    const cur = input.value;
    if (cur && words[index].startsWith(cur)) n += cur.length;
    return n;
  };
  const elapsedSec = () => (started ? Math.min(duration, (Date.now() - startAt) / 1000) : 0);
  const wpmNow = () => { const t = elapsedSec(); return t > 0 ? Math.round((correctChars() / 5) / (t / 60)) : 0; };
  const rawNow = () => {
    const t = elapsedSec();
    const typed = keys.correct + keys.incorrect;
    return t > 0 ? Math.round((typed / 5) / (t / 60)) : 0;
  };

  const start = () => {
    started = true;
    startAt = Date.now();
    stage.classList.add("running");
    hint.textContent = "Esc to restart";
    timer = setInterval(tick, 1000);
  };

  const tick = () => {
    const t = elapsedSec();
    samples.push({ wpm: wpmNow(), raw: rawNow() });
    timeEl.textContent = Math.max(0, Math.ceil(duration - t));
    liveWpmEl.textContent = wpmNow();
    if (t >= duration) finish();
  };

  // ---------- input ----------
  const onInput = () => {
    if (finished) return;
    let v = input.value;
    if (!started && v.length) start();
    const word = words[index];

    if (v.endsWith(" ")) {
      const typed = v.trim();
      if (!typed) { input.value = ""; return; }   // ignore a space at the start of a word
      keys.correct++;                               // the space itself
      history.push({ word, typed });
      wordEls[index].classList.add("done");
      wordEls[index].classList.toggle("wrong", typed !== word);
      paintWord(index, typed);
      index++;
      input.value = ""; typedPrev = "";
      scrollLines();
      placeCaret();
      return;
    }

    // count keystrokes for every new character typed (handles paste and autocomplete too)
    if (v.length > typedPrev.length && v.startsWith(typedPrev)) {
      for (let k = typedPrev.length; k < v.length; k++) {
        if (v[k] === word[k]) keys.correct++; else keys.incorrect++;
      }
    }
    typedPrev = v;
    paintWord(index, v);
    placeCaret();
  };

  const finish = () => {
    finished = true;
    clearInterval(timer);
    input.disabled = true;
    stage.classList.remove("running");
    // count the half-typed word too
    const cur = input.value;
    if (cur) history.push({ word: words[index], typed: cur, partial: true });

    const minutes = duration / 60;
    const totalKeys = keys.correct + keys.incorrect;
    let cc = 0, ic = 0, extra = 0, missed = 0, ccWords = 0;
    history.forEach((h) => {
      for (let k = 0; k < Math.max(h.word.length, h.typed.length); k++) {
        if (k >= h.word.length) extra++;
        else if (k >= h.typed.length) { if (!h.partial) missed++; }
        else if (h.typed[k] === h.word[k]) cc++;
        else ic++;
      }
      if (h.typed === h.word) ccWords += h.word.length + 1;
      else if (h.partial && h.word.startsWith(h.typed)) ccWords += h.typed.length;
    });
    const wpm = Math.round((ccWords / 5) / minutes);
    const raw = Math.round((totalKeys / 5) / minutes);
    const acc = totalKeys ? Math.round((keys.correct / totalKeys) * 100) : 0;

    const pb = loadPB();
    const key = `${mode}-${duration}`;
    const isPB = wpm > 0 && wpm > (pb[key] || 0);
    if (isPB) { pb[key] = wpm; savePB(pb); }

    const set = (sel, text) => { results.querySelector(sel).textContent = text; };
    set(".r-wpm", wpm);
    set(".r-acc", `${acc}%`);
    set(".r-raw", raw);
    set(".r-chars", `${cc} / ${ic} / ${extra} / ${missed}`);
    set(".r-test", `${mode === "dev" ? "dev words" : "common words"} · ${duration}s`);
    set(".r-pb", isPB ? "New personal best!" : pb[key] ? `Personal best: ${pb[key]} wpm` : "");
    results.querySelector(".r-pb").classList.toggle("new", isPB);
    drawChart();
    stage.hidden = true;
    results.hidden = false;
    results.querySelector(".r-again").focus();
  };

  const drawChart = () => {
    const svg = results.querySelector(".r-chart");
    const W = 600, H = 160, P = 28;
    const pts = samples.length ? samples : [{ wpm: 0, raw: 0 }];
    const max = Math.max(20, ...pts.map((s) => Math.max(s.wpm, s.raw)));
    const top = Math.ceil(max / 20) * 20;
    const x = (i) => P + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * (W - P * 2));
    const y = (v) => H - P - (v / top) * (H - P * 2);
    const line = (key) => pts.map((s, i) => `${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(" ");
    let grid = "";
    for (let v = 0; v <= top; v += top / 4) {
      grid += `<line class="c-grid" x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}"/><text class="c-axis" x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    }
    svg.innerHTML = `${grid}
      <polyline class="c-raw" points="${line("raw")}"/>
      <polyline class="c-wpm" points="${line("wpm")}"/>
      ${pts.map((s, i) => `<circle class="c-dot" cx="${x(i)}" cy="${y(s.wpm)}" r="3"/>`).join("")}
      <text class="c-axis" x="${W - P}" y="${H - 6}" text-anchor="end">seconds</text>`;
  };

  // ---------- events ----------
  input.addEventListener("input", onInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); reset(); }
  });
  input.addEventListener("focus", () => stage.classList.add("focused"));
  input.addEventListener("blur", () => stage.classList.remove("focused"));
  stage.addEventListener("click", () => input.focus());
  results.querySelector(".r-again").addEventListener("click", reset);
  modeButtons.forEach((b) => b.addEventListener("click", () => { mode = b.dataset.mode; reset(); }));
  timeButtons.forEach((b) => b.addEventListener("click", () => { duration = +b.dataset.time; reset(); }));
  window.addEventListener("resize", () => requestAnimationFrame(placeCaret));

  reset();
})();
