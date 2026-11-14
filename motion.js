// Motion effects. Everything here is decoration: the page is complete without it,
// links and buttons keep working while it plays, and visitors who ask their
// device for reduced motion get the final state straight away.
(() => {
  const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);
  const reduce = mq("(prefers-reduced-motion: reduce)");
  const finePointer = mq("(hover: hover) and (pointer: fine)");
  const root = document.documentElement;
  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  const finishers = [];
  window.portfolioMotion = { finishAll: () => finishers.forEach((f) => f()) };

  // Run fn(el) once, the first time each element scrolls into view
  const onVisible = (els, fn, threshold = 0.25) => {
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(fn); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); }
    }), { threshold });
    els.forEach((el) => io.observe(el));
  };

  // ---------- 10. server boot sequence (home page, once per browser session) ----------
  const hero = document.querySelector(".hero");
  const heading = hero && hero.querySelector("h1");
  let bootDone = Promise.resolve();
  if (hero && !reduce) {
    let seen = true;
    try { seen = sessionStorage.getItem("boot-seen") === "1"; sessionStorage.setItem("boot-seen", "1"); } catch { /* skip if storage is blocked */ }
    if (!seen) bootDone = runBoot();
  }

  function runBoot() {
    const LINES = [
      ["acc", "  :: abhishek-portfolio ::  (v5.0)"],
      ["", "INFO  Starting PortfolioApplication on shekabhi.github.io"],
      ["", "INFO  Loading case studies ............ <b>4 found</b>"],
      ["", "INFO  Warming up the rate limiter ...... <b>OK</b>"],
      ["", "INFO  FIPS validation .................. <b>passed</b>"],
      ["", "INFO  Learning notes indexed ........... <b>OK</b>"],
      ["ok", "INFO  Started in 0.42s. Hello! 👋"],
    ];
    const overlay = document.createElement("div");
    overlay.className = "boot-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<div class="boot-log mono"></div><p class="boot-skip mono">press any key to skip</p>`;
    document.body.appendChild(overlay);
    const log = overlay.querySelector(".boot-log");
    return new Promise((resolve) => {
      let i = 0, timer, ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        ["keydown", "pointerdown", "wheel", "touchstart"].forEach((t) => window.removeEventListener(t, skip, true));
        overlay.classList.add("out");
        setTimeout(() => overlay.remove(), 450);
        resolve();
      };
      const skip = () => end();
      ["keydown", "pointerdown", "wheel", "touchstart"].forEach((t) => window.addEventListener(t, skip, { capture: true, passive: true }));
      const next = () => {
        if (i < LINES.length) {
          const [cls, html] = LINES[i++];
          const line = document.createElement("div");
          if (cls) line.className = cls;
          line.innerHTML = html;
          log.appendChild(line);
          timer = setTimeout(next, 170);
        } else {
          timer = setTimeout(end, 450);
        }
      };
      next();
      finishers.push(end);
    });
  }

  // ---------- 01. decrypting headline ----------
  if (heading && !reduce) {
    const GLYPHS = "!<>-_/[]{}=+*^?#01";
    const nodes = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push({ node: walker.currentNode, text: walker.currentNode.textContent });
    const full = nodes.map((n) => n.text).join("");
    let raf, done = false;
    const restore = () => {
      done = true;
      cancelAnimationFrame(raf);
      nodes.forEach((n) => (n.node.textContent = n.text));
      heading.removeAttribute("aria-label");
    };
    heading.setAttribute("aria-label", heading.textContent.trim());
    // show scrambled text straight away so the real headline doesn't flash first
    let offset = 0;
    const settle = nodes.map((n) => { const s = offset; offset += n.text.length; return s; });
    const frameAt = (pos) => 8 + (pos / full.length) * 42;
    const draw = (frame) => {
      nodes.forEach((n, k) => {
        let out = "";
        for (let i = 0; i < n.text.length; i++) {
          const ch = n.text[i];
          out += ch === " " || frame >= frameAt(settle[k] + i) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        n.node.textContent = out;
      });
    };
    draw(0);
    bootDone.then(() => {
      if (done) return;
      let frame = 0, last = 0;
      const tick = (t) => {
        if (done) return;
        if (t - last > 32) { last = t; draw(++frame); }
        if (frame < 52) raf = requestAnimationFrame(tick); else restore();
      };
      raf = requestAnimationFrame(tick);
    });
    finishers.push(restore);
  }

  // ---------- 02. living network background (home intro) ----------
  if (hero) {
    const canvas = document.createElement("canvas");
    canvas.className = "net-bg";
    canvas.setAttribute("aria-hidden", "true");
    hero.prepend(canvas);
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, nodes = [], colors = {}, running = false, onScreen = true, frame = 0;
    const mouse = { x: -1e4, y: -1e4 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const readColors = () => { colors = { line: cssVar("--accent") || "#5eead4", dot: cssVar("--accent-2") || "#818cf8" }; };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = canvas.width = Math.max(1, Math.round(r.width * dpr));
      H = canvas.height = Math.max(1, Math.round(r.height * dpr));
      const count = Math.round(Math.min(70, Math.max(22, (r.width * r.height) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35 * dpr, vy: (Math.random() - 0.5) * 0.35 * dpr,
      }));
    };
    const paint = () => {
      ctx.clearRect(0, 0, W, H);
      const D = 120 * dpr;
      ctx.lineWidth = dpr;
      ctx.strokeStyle = colors.line;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < D) { ctx.globalAlpha = (1 - d / D) * 0.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colors.dot;
      nodes.forEach((n) => { ctx.beginPath(); ctx.arc(n.x, n.y, 2 * dpr, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    };
    const step = () => {
      if (!running) return;
      if (++frame % 60 === 0) readColors();
      const R = 110 * dpr;
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < R && d > 0) { n.x += (dx / d) * 1.2 * dpr; n.y += (dy / d) * 1.2 * dpr; }
      });
      paint();
      requestAnimationFrame(step);
    };
    const start = () => { if (!running && onScreen && !document.hidden && !reduce) { running = true; requestAnimationFrame(step); } };
    const stop = () => { running = false; };
    readColors(); resize(); paint();
    window.addEventListener("resize", () => { resize(); paint(); });
    window.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * dpr; mouse.y = (e.clientY - r.top) * dpr;
    }, { passive: true });
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? start() : stop(); }).observe(hero);
    }
    // repaint with new colours when the theme changes
    new MutationObserver(() => { readColors(); paint(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    start();
  }

  // ---------- 05. numbers that count up ----------
  const counters = [...document.querySelectorAll(".outcomes strong, .case-body .results strong")]
    .map((el) => {
      const text = el.textContent.trim();
      const m = text.match(/^([−+-]?)(\d+)(\D*)$/);
      return m && +m[2] > 0 ? { el, text, pre: m[1], to: +m[2], suf: m[3] } : null;
    })
    .filter(Boolean);
  if (counters.length && !reduce) {
    counters.forEach((c) => { c.el.classList.add("counting"); c.el.textContent = `${c.pre}0${c.suf}`; });
    onVisible(counters.map((c) => c.el), (el) => {
      const c = counters.find((x) => x.el === el);
      const t0 = performance.now(), dur = 1300;
      const tick = (now) => {
        if (c.done) return;
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = `${c.pre}${Math.round(c.to * eased)}${c.suf}`;
        if (p < 1) requestAnimationFrame(tick); else c.done = true;
      };
      requestAnimationFrame(tick);
    }, 0.5);
    finishers.push(() => counters.forEach((c) => { c.done = true; c.el.textContent = c.text; }));
  }

  // ---------- 04. diagrams that draw themselves + 03. requests flowing through them ----------
  const diagrams = [...document.querySelectorAll(".figure > svg")];
  const startPackets = (svg) => {
    if (reduce || !svg.dataset.routes || svg._packets) return;
    let routes;
    try { routes = JSON.parse(svg.dataset.routes); } catch { return; }
    svg._packets = true;
    const NS = "http://www.w3.org/2000/svg";
    const layer = document.createElementNS(NS, "g");
    layer.setAttribute("class", "pk-layer");
    // behind the boxes, so requests travel along the lines and pass under the boxes
    svg.insertBefore(layer, svg.querySelector(".d-box"));
    const total = routes.reduce((n, r) => n + (r.w || 1), 0);
    let visible = true;
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(svg);
    const spawn = () => {
      if (!visible || document.hidden) return;
      let pick = Math.random() * total, route = routes[0];
      for (const r of routes) { pick -= r.w || 1; if (pick <= 0) { route = r; break; } }
      const pts = route.pts;
      const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
      const length = lens.reduce((a, b) => a + b, 0);
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("r", route.r || 5);
      dot.setAttribute("class", `pk ${route.cls || "hi"}`);
      layer.appendChild(dot);
      const speed = 0.12; // svg units per ms
      const t0 = performance.now();
      const move = (now) => {
        let dist = (now - t0) * speed;
        if (dist >= length) { dot.remove(); return; }
        let i = 0;
        while (dist > lens[i]) { dist -= lens[i]; i++; }
        const f = dist / lens[i], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        dot.setAttribute("cx", x1 + (x2 - x1) * f);
        dot.setAttribute("cy", y1 + (y2 - y1) * f);
        requestAnimationFrame(move);
      };
      requestAnimationFrame(move);
    };
    spawn();
    setInterval(spawn, 750);
  };

  if (diagrams.length && !reduce) {
    diagrams.forEach((svg) => {
      const parts = [...svg.querySelectorAll(".d-box, .d-text, .d-sub, .d-label, .d-head, .d-line")];
      svg._parts = parts;
      parts.forEach((el) => {
        if (el.classList.contains("d-line")) {
          const len = el.getTotalLength ? el.getTotalLength() : 200;
          el._marker = el.getAttribute("marker-end");
          el.removeAttribute("marker-end");
          el._markerStart = el.getAttribute("marker-start");
          el.removeAttribute("marker-start");
          el.style.strokeDasharray = len;
          el.style.strokeDashoffset = len;
        } else {
          el.style.opacity = 0;
        }
      });
    });
    const settle = (el) => {
      el.style.transition = el.style.opacity = el.style.strokeDasharray = el.style.strokeDashoffset = "";
      if (el._marker) el.setAttribute("marker-end", el._marker);
      if (el._markerStart) el.setAttribute("marker-start", el._markerStart);
      el._marker = el._markerStart = null;
    };
    onVisible(diagrams, (svg) => {
      svg._parts.forEach((el, i) => {
        setTimeout(() => {
          if (svg._settled) return;
          if (el.classList.contains("d-line")) {
            el.style.transition = "stroke-dashoffset .5s ease";
            el.style.strokeDashoffset = 0;
            setTimeout(() => settle(el), 520);
          } else {
            el.style.transition = "opacity .35s ease";
            el.style.opacity = 1;
            setTimeout(() => settle(el), 380);
          }
        }, i * 70);
      });
      setTimeout(() => { svg._settled = true; startPackets(svg); }, svg._parts.length * 70 + 600);
    }, 0.3);
    finishers.push(() => diagrams.forEach((svg) => { svg._settled = true; svg._parts.forEach(settle); }));
  } else {
    onVisible(diagrams, startPackets, 0.3);
  }

  // ---------- 06. spotlight and tilt on cards ----------
  document.querySelectorAll(".case-card, .note-card, .role, .skill-groups .card, .edu-grid .card").forEach((card) => {
    card.classList.add("spotlight");
    let raf = null;
    card.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty("--x", `${x}px`);
        card.style.setProperty("--y", `${y}px`);
        if (finePointer && !reduce) {
          const rx = (y / r.height - 0.5) * -5, ry = (x / r.width - 0.5) * 5;
          card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
        }
      });
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

  // ---------- 08. staggered entrances ----------
  const groups = [...document.querySelectorAll(".work-grid, .principles, .roles, .note-list, .skill-groups, .edu-grid")];
  if (groups.length && !reduce) {
    groups.forEach((g) => {
      [...g.children].forEach((c, i) => c.style.setProperty("--i", i));
      g.classList.add("st-wait");
    });
    const clear = (g) => { g.classList.remove("st-wait", "st-go"); [...g.children].forEach((c) => c.style.removeProperty("--i")); };
    onVisible(groups, (g) => {
      g.classList.add("st-go");
      requestAnimationFrame(() => g.classList.remove("st-wait"));
      setTimeout(() => clear(g), g.children.length * 80 + 700);
    }, 0.12);
    finishers.push(() => groups.forEach(clear));
  }

  // ---------- 09. magnetic buttons ----------
  const magnets = [...document.querySelectorAll(".hero-cta .btn, .contact .btn, .teaser .btn")];
  if (magnets.length && finePointer && !reduce) {
    let raf = null, last = null;
    window.addEventListener("pointermove", (e) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        magnets.forEach((b) => {
          const r = b.getBoundingClientRect();
          const dx = last.clientX - (r.left + r.width / 2), dy = last.clientY - (r.top + r.height / 2);
          const reach = Math.max(r.width, r.height) * 0.9 + 40;
          b.style.transform = Math.hypot(dx, dy) < reach ? `translate(${(dx * 0.22).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)` : "";
        });
      });
    }, { passive: true });
  }
})();
