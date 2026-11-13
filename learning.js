// Learning section: topic filters + search on the hub, and a table of contents
// and copy buttons on note pages.
(() => {
  // ---------- hub ----------
  const list = document.querySelector(".note-list");
  if (list) {
    const cards = [...list.querySelectorAll(".note-card")];
    const buttons = [...document.querySelectorAll(".topic-filters button")];
    const search = document.querySelector(".learn-search");
    const empty = document.querySelector(".learn-empty");
    let topic = new URLSearchParams(location.search).get("topic") || "all";
    if (!buttons.some((b) => b.dataset.topic === topic)) topic = "all";

    const apply = () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      cards.forEach((c) => {
        const ok = (topic === "all" || c.dataset.topic === topic) && (!q || c.dataset.search.includes(q));
        c.hidden = !ok;
        if (ok) shown++;
      });
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.topic === topic)));
      empty.hidden = shown > 0;
    };
    buttons.forEach((b) => b.addEventListener("click", () => {
      topic = b.dataset.topic;
      const url = new URL(location.href);
      if (topic === "all") url.searchParams.delete("topic"); else url.searchParams.set("topic", topic);
      history.replaceState(null, "", url);
      apply();
    }));
    search.addEventListener("input", apply);
    apply();
  }

  // ---------- note page ----------
  const body = document.querySelector(".note-body");
  if (body) {
    const toc = document.querySelector(".toc");
    const heads = [...body.querySelectorAll("h2[id]")];
    if (toc && heads.length >= 2) {
      toc.innerHTML = `<p class="toc-title mono">On this page</p><ol>${heads
        .map((h) => `<li><a href="#${h.id}"></a></li>`).join("")}</ol>`;
      toc.querySelectorAll("a").forEach((a, i) => (a.textContent = heads[i].textContent));
      toc.hidden = false;
      if ("IntersectionObserver" in window) {
        const links = [...toc.querySelectorAll("a")];
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${e.target.id}`));
            }
          });
        }, { rootMargin: "-80px 0px -70% 0px" });
        heads.forEach((h) => obs.observe(h));
      }
    }

    // Copy button on every code block
    body.querySelectorAll("div.highlighter-rouge, figure.highlight").forEach((block) => {
      const pre = block.querySelector("pre");
      if (!pre) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy mono";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")); btn.textContent = "Copied ✓"; }
        catch { btn.textContent = "Copy failed"; }
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });
      block.classList.add("has-copy");
      block.appendChild(btn);
    });

    // Code blocks that scroll sideways must be reachable by keyboard
    body.querySelectorAll("pre").forEach((pre) => pre.setAttribute("tabindex", "0"));
    body.querySelectorAll("table").forEach((t) => {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.tabIndex = 0;
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
  }
})();
