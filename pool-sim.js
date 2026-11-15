// Interactive ThreadPoolExecutor simulator. Mounts on [data-pool-sim].
// Follows the real submit rules: core thread → queue → extra thread → rejection policy.
// Idle extra threads retire after keep-alive. Everything runs in the browser.
(() => {
  const TASK_MS = 2500;      // how long each simulated task runs
  const KEEP_ALIVE_MS = 4000; // idle time before an extra thread retires
  const QUEUE_SHOWN = 8;      // queue slots drawn; more are shown as "+n"

  document.querySelectorAll("[data-pool-sim]").forEach((root) => {
    root.innerHTML = `
      <div class="ps">
        <div class="ps-head mono"><b>ThreadPoolExecutor</b><span class="ps-summary"></span></div>
        <div class="ps-controls">
          <label>core <select data-k="core">${[1, 2, 3, 4].map((n) => `<option${n === 2 ? " selected" : ""}>${n}</option>`).join("")}</select></label>
          <label>max <select data-k="max">${[1, 2, 3, 4, 5, 6].map((n) => `<option${n === 4 ? " selected" : ""}>${n}</option>`).join("")}</select></label>
          <label>queue <select data-k="queue"><option value="0">0 (hand-off)</option><option value="3" selected>3</option><option value="6">6</option><option value="-1">unbounded</option></select></label>
          <label>policy <select data-k="policy"><option value="abort" selected>AbortPolicy</option><option value="caller">CallerRunsPolicy</option><option value="discard">DiscardPolicy</option></select></label>
        </div>
        <div class="ps-lane"><span class="ps-lab mono">threads</span><div class="ps-threads"></div></div>
        <div class="ps-lane"><span class="ps-lab mono">queue</span><div class="ps-queue"></div></div>
        <div class="ps-stats mono"></div>
        <div class="ps-actions">
          <button type="button" class="btn ps-one">Submit 1 task</button>
          <button type="button" class="btn btn-ghost ps-burst">Burst ×10</button>
          <button type="button" class="ps-reset">Reset</button>
        </div>
        <ol class="ps-log mono" aria-live="polite" aria-label="What the pool did"></ol>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const threadsEl = $(".ps-threads"), queueEl = $(".ps-queue"), statsEl = $(".ps-stats"), logEl = $(".ps-log"), summaryEl = $(".ps-summary");
    const sel = (k) => root.querySelector(`select[data-k="${k}"]`);

    let cfg, workers, queue, nextId, stats, timers, callerBusyUntil;

    const readCfg = () => {
      const core = +sel("core").value;
      let max = +sel("max").value;
      if (max < core) { max = core; sel("max").value = String(max); }
      cfg = { core, max, queue: +sel("queue").value, policy: sel("policy").value };
      const q = cfg.queue < 0 ? "unbounded" : cfg.queue;
      const policyName = { abort: "AbortPolicy", caller: "CallerRunsPolicy", discard: "DiscardPolicy" }[cfg.policy];
      summaryEl.textContent = `core ${cfg.core} · max ${cfg.max} · queue ${q} · ${policyName}`;
    };

    const log = (html, cls = "") => {
      const li = document.createElement("li");
      if (cls) li.className = cls;
      li.innerHTML = html;
      logEl.appendChild(li);
      while (logEl.children.length > 6) logEl.firstChild.remove();
    };

    const reset = () => {
      (timers || []).forEach(clearTimeout);
      timers = [];
      readCfg();
      workers = [];     // { id, core, task, idleSince }
      queue = [];
      nextId = 1;
      stats = { done: 0, rejected: 0, callerRan: 0, discarded: 0, largest: 0 };
      callerBusyUntil = 0;
      logEl.innerHTML = "";
      log(`<span class="hint"># submit tasks and watch the pool decide</span>`);
      render();
    };

    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };

    const runOn = (w, task) => {
      w.task = task;
      w.idleSince = null;
      w.startedAt = Date.now();
      later(() => finish(w), TASK_MS);
    };

    const finish = (w) => {
      stats.done++;
      w.task = null;
      if (queue.length) {                                   // pick up queued work
        const t = queue.shift();
        runOn(w, t);
        log(`#${t} taken from the queue by <b>${w.name}</b>`);
      } else {
        w.idleSince = Date.now();
        if (!w.core) later(() => retire(w), KEEP_ALIVE_MS);  // extra threads time out
      }
      render();
    };

    const retire = (w) => {
      if (w.task || w.core || w.idleSince === null || Date.now() - w.idleSince < KEEP_ALIVE_MS) return;
      workers = workers.filter((x) => x !== w);
      log(`<b>${w.name}</b> idle for ${KEEP_ALIVE_MS / 1000}s → retired (above core size)`, "hint");
      render();
    };

    const newWorker = (core) => {
      const w = { id: workers.length, core, task: null, idleSince: null, name: `${core ? "core" : "extra"}-${workers.filter((x) => x.core === core).length + 1}` };
      workers.push(w);
      stats.largest = Math.max(stats.largest, workers.length);
      return w;
    };

    const submit = () => {
      const id = nextId++;
      const idle = workers.find((w) => !w.task);
      const queueFull = cfg.queue >= 0 && queue.length >= cfg.queue;
      // 1. fewer than core threads → start a new core thread, even if others are idle
      if (workers.length < cfg.core) {
        const w = newWorker(true);
        runOn(w, id);
        log(`#${id} <span class="ok">threads &lt; core</span> → new thread <b>${w.name}</b>`);
      // 2. otherwise queue it (an idle thread picks it straight up)
      } else if (!queueFull || (cfg.queue === 0 && idle)) {
        if (idle) {
          runOn(idle, id);
          log(`#${id} → queued and taken at once by idle <b>${idle.name}</b>`);
        } else {
          queue.push(id);
          log(`#${id} <span class="acc">queued</span> (${queue.length}${cfg.queue < 0 ? "" : "/" + cfg.queue})`);
        }
      // 3. queue full and fewer than max → start an extra thread
      } else if (workers.length < cfg.max) {
        const w = newWorker(false);
        runOn(w, id);
        log(`#${id} <span class="ev">queue full, threads &lt; max</span> → new thread <b>${w.name}</b>`);
      // 4. saturated → rejection policy
      } else if (cfg.policy === "caller") {
        stats.callerRan++;
        callerBusyUntil = Math.max(Date.now(), callerBusyUntil) + TASK_MS;
        log(`#${id} <span class="bad">saturated</span> → CallerRunsPolicy: the submitting thread runs it`, "bad");
      } else if (cfg.policy === "discard") {
        stats.discarded++;
        log(`#${id} <span class="bad">saturated</span> → DiscardPolicy: silently dropped`, "bad");
      } else {
        stats.rejected++;
        log(`#${id} <span class="bad">saturated</span> → RejectedExecutionException`, "bad");
      }
      render();
    };

    const render = () => {
      const now = Date.now();
      threadsEl.innerHTML = "";
      for (let i = 0; i < cfg.max; i++) {
        const w = workers[i];
        const slot = document.createElement("span");
        const isCoreSlot = i < cfg.core;
        if (!w) {
          slot.className = "ps-slot empty";
          slot.textContent = isCoreSlot ? "core" : "extra";
          slot.title = "not created yet";
        } else {
          slot.className = `ps-slot ${w.core ? "core" : "extra"} ${w.task ? "busy" : "idle"}`;
          slot.innerHTML = w.task
            ? `<span class="ps-name">${w.name}</span><span class="ps-task">#${w.task}</span><span class="ps-bar" style="animation-duration:${TASK_MS}ms;animation-delay:-${Math.min(TASK_MS, now - w.startedAt)}ms"></span>`
            : `<span class="ps-name">${w.name}</span><span class="ps-task">idle</span>`;
        }
        threadsEl.appendChild(slot);
      }
      queueEl.innerHTML = "";
      const cap = cfg.queue < 0 ? QUEUE_SHOWN : cfg.queue;
      if (cap === 0) {
        queueEl.innerHTML = `<span class="ps-note">no capacity: a task needs an idle thread or a new one</span>`;
      }
      for (let i = 0; i < Math.min(cap, QUEUE_SHOWN); i++) {
        const q = document.createElement("span");
        q.className = "ps-q" + (queue[i] ? " full" : "");
        q.textContent = queue[i] ? `#${queue[i]}` : "";
        queueEl.appendChild(q);
      }
      if (queue.length > QUEUE_SHOWN) {
        const more = document.createElement("span");
        more.className = "ps-more mono";
        more.textContent = `+${queue.length - QUEUE_SHOWN}`;
        queueEl.appendChild(more);
      }
      const busy = workers.filter((w) => w.task).length;
      statsEl.innerHTML =
        `<span>threads <b data-s="threads">${workers.length}</b> (busy ${busy})</span>` +
        `<span>queued <b data-s="queued">${queue.length}</b></span>` +
        `<span>done <b data-s="done">${stats.done}</b></span>` +
        `<span>rejected <b data-s="rejected">${stats.rejected}</b></span>` +
        (stats.callerRan ? `<span>ran by caller <b data-s="caller">${stats.callerRan}</b></span>` : "") +
        (stats.discarded ? `<span>dropped <b data-s="discarded">${stats.discarded}</b></span>` : "") +
        `<span>largest <b data-s="largest">${stats.largest}</b></span>`;
    };

    $(".ps-one").addEventListener("click", submit);
    $(".ps-burst").addEventListener("click", () => { for (let i = 0; i < 10; i++) submit(); });
    $(".ps-reset").addEventListener("click", reset);
    root.querySelectorAll("select").forEach((s) => s.addEventListener("change", reset));
    reset();
  });
})();
