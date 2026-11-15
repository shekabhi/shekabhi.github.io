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

    // Run buttons. A runnable example is a Java block followed by its recorded output, which
    // scripts/check-examples.py verifies against a real Java 21 run (CI fails if they differ).
    // Without JavaScript the output simply shows under the code.
    body.querySelectorAll("div.runnable").forEach((block, i) => {
      const out = block.nextElementSibling;
      if (!out || !out.classList.contains("run-output")) return;
      out.id = `run-output-${i + 1}`;
      out.hidden = true;
      const label = document.createElement("p");
      label.className = "run-label mono";
      label.textContent = "Output · recorded from a real run on Java 21";
      out.prepend(label);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-run mono";
      btn.textContent = "▶ Run";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", out.id);
      btn.addEventListener("click", () => {
        btn.disabled = true;
        btn.textContent = "Running…";
        out.hidden = true;
        out.classList.remove("show");
        setTimeout(() => {
          out.hidden = false;
          void out.offsetWidth;          // restart the reveal animation
          out.classList.add("show");
          btn.disabled = false;
          btn.textContent = "↻ Run again";
          btn.setAttribute("aria-expanded", "true");
          if (out.getBoundingClientRect().top > innerHeight - 80) out.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 350);
      });
      block.classList.add("is-runnable");
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
