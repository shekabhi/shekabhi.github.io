// Live sliding-window rate limiter demo.
// Mounts on every element with [data-ratelimit-demo]. Runs entirely in the
// browser; it mirrors the algorithm the real service runs against Redis.
(() => {
  const LIMIT = 5;          // requests
  const WINDOW = 10000;     // per 10 seconds

  document.querySelectorAll("[data-ratelimit-demo]").forEach((root) => {
    root.innerHTML = `
      <div class="rl">
        <div class="rl-head mono"><span><b>POST</b> /api/orders</span><span>limit: ${LIMIT} requests / ${WINDOW / 1000} s per user</span></div>
        <div class="rl-main">
          <div class="rl-track" aria-hidden="true"></div>
          <div class="rl-meter"><span class="rl-count">0/${LIMIT}</span><span class="rl-status">in the window. Send a few requests.</span></div>
          <div class="rl-actions">
            <button type="button" class="btn rl-send">Send request</button>
            <button type="button" class="btn btn-ghost rl-burst">Burst ×8</button>
            <button type="button" class="rl-reset">Reset</button>
          </div>
          <ol class="rl-log mono" aria-live="polite" aria-label="Request log"></ol>
        </div>
      </div>`;
    const track = root.querySelector(".rl-track");
    const count = root.querySelector(".rl-count");
    const status = root.querySelector(".rl-status");
    const log = root.querySelector(".rl-log");

    let accepted = [];      // timestamps inside the window (the "sorted set")
    let dots = [];          // { t, el } for everything drawn on the track
    let n = 0, raf = null;

    const addLog = (html) => {
      const li = document.createElement("li");
      li.innerHTML = html;
      log.appendChild(li);
      while (log.children.length > 6) log.firstChild.remove();
    };
    addLog(`<span class="hint"># each request: drop entries older than 10 s, count, then allow or reject</span>`);

    const prune = (now) => { accepted = accepted.filter((t) => now - t < WINDOW); };

    const send = () => {
      const now = performance.now();
      prune(now);                                   // ZREMRANGEBYSCORE key 0 (now - window)
      const ok = accepted.length < LIMIT;           // ZCARD key < limit ?
      n++;
      const el = document.createElement("i");
      el.className = "rl-dot" + (ok ? "" : " bad");
      track.appendChild(el);
      dots.push({ t: now, el });
      const id = `#${String(n).padStart(2, "0")}`;
      if (ok) {
        accepted.push(now);                         // ZADD key now now
        addLog(`${id} <span class="ok">200 OK</span>  ZCARD ${accepted.length - 1} &lt; ${LIMIT} → ZADD`);
      } else {
        const retry = ((WINDOW - (now - accepted[0])) / 1000).toFixed(1);
        addLog(`${id} <span class="bad">429 Too Many Requests</span>  retry-after ${retry}s → SQS breach event`);
      }
      if (!raf) raf = requestAnimationFrame(frame);
      render(now);
    };

    const render = (now) => {
      prune(now);
      count.textContent = `${accepted.length}/${LIMIT}`;
      const full = accepted.length >= LIMIT;
      count.classList.toggle("full", full);
      status.textContent = full
        ? `window full. Next slot frees in ${((WINDOW - (now - accepted[0])) / 1000).toFixed(1)}s`
        : accepted.length ? "in the window. Old requests slide out on the left." : "in the window. Send a few requests.";
    };

    const frame = () => {
      const now = performance.now();
      dots = dots.filter((d) => {
        const age = (now - d.t) / WINDOW;
        if (age >= 1) { d.el.remove(); return false; }
        d.el.style.left = `${(1 - age) * 100}%`;
        return true;
      });
      render(now);
      raf = dots.length ? requestAnimationFrame(frame) : null;
    };

    root.querySelector(".rl-send").addEventListener("click", send);
    root.querySelector(".rl-burst").addEventListener("click", () => {
      for (let i = 0; i < 8; i++) setTimeout(send, i * 90);
    });
    root.querySelector(".rl-reset").addEventListener("click", () => {
      accepted = []; dots.forEach((d) => d.el.remove()); dots = []; n = 0;
      log.innerHTML = ""; addLog(`<span class="hint"># window cleared</span>`);
      render(performance.now());
    });
  });
})();
