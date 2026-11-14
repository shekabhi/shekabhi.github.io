// Terminal mode: press ~ (or click >_) to explore the portfolio from a shell.
(() => {
  const EMAIL = "shekabhi369@gmail.com";
  const LINKS = {
    github: "https://github.com/shekabhi",
    linkedin: "https://www.linkedin.com/in/abhishekshukla0",
    leetcode: "https://leetcode.com/shekabhi369",
  };

  // A tiny virtual filesystem
  const FILES = {
    "about.txt": [
      "Abhishek Shukla · Senior Software Engineer · Hyderabad, India",
      "",
      "5+ years building scalable backend systems in Java and Spring Boot.",
      "I own features end to end: research, design, implementation and",
      "production hardening. Strong in security engineering (FIPS, OAuth2)",
      "and AI infrastructure (Model Context Protocol).",
      "",
      "More: https://shekabhi.github.io/about/",
    ],
    "experience.txt": [
      "[2024-11 → now]   Senior Software Engineer 1 @ Progress Software",
      "                  PASOE architecture · Bouncy Castle FIPS · OpenEdge MCP Server",
      "[2023-01 → 2024-11] Software Engineer 2 @ Progress Software",
      "                  -20% session resources · Logback contextSelector · Swagger",
      "[2021-01 → 2023-01] Software Engineer @ Tata Consultancy Services",
      "                  Spring Boot APIs, 10K+ payloads/day · resilient microservices",
      "[2016 → 2020]     B.Tech IT @ Dr. A.P.J. Abdul Kalam Technical University (8.1)",
      "",
      "More: https://shekabhi.github.io/about/",
    ],
    "skills.txt": [
      "languages   Java (multithreading, concurrency), SQL",
      "frameworks  Spring Boot, Spring MVC, Spring Security, Tomcat",
      "data        MySQL, Redis, Hibernate/JPA, Kafka",
      "cloud       AWS: EC2, ElastiCache, SQS, CloudWatch, API Gateway",
      "security    OAuth2, JWT/JWKS, FIPS, Bouncy Castle",
      "tools       Git, Linux, Docker, Gradle, TeamCity, MCP",
      "",
      "More: https://shekabhi.github.io/about/",
    ],
    "achievements.txt": [
      "🏆 XRPL Blockchain Hackathon 2024: 1st place of 20 teams, IIT Bombay",
      "⭐ TCS Performance Recognition 2021–22: Performance Band A",
      "",
      "More: https://shekabhi.github.io/about/",
    ],
    "contact.txt": [
      `email     ${EMAIL}`,
      `github    ${LINKS.github}`,
      `linkedin  ${LINKS.linkedin}`,
      `leetcode  ${LINKS.leetcode}`,
    ],
  };
  const PROJECTS = {
    "rate-limiter.md": [
      "# Distributed Rate Limiter Service",
      "Spring Boot + Redis sliding window, throttles per user/IP at high throughput.",
      "AWS EC2 + ElastiCache, CloudWatch monitoring, SQS breach events for alerting.",
      "Case study: https://shekabhi.github.io/work/rate-limiter.html",
    ],
    "mcp-server.md": [
      "# OpenEdge MCP Server",
      "Turns REST APIs into AI-consumable tools via the Model Context Protocol.",
      "JWT/JWKS, OAuth2 + PKCE, scope-based access control, Docker deployment.",
      "Case study: https://shekabhi.github.io/work/mcp-server.html",
    ],
    "pasoe.md": [
      "# Version-Independent App Server (PASOE)",
      "Decoupled from the LTS release cycle so 200+ libraries can be patched",
      "independently. Cross-version negotiation protocol + phased rollout.",
      "Case study: https://shekabhi.github.io/work/pasoe.html",
    ],
    "fips.md": [
      "# FIPS Security Hardening",
      "Bouncy Castle FIPS provider: +30% client security adoption.",
      "Startup FIPS validation: -40% security exceptions. 20+ CVEs fixed, 0 regressions.",
      "Case study: https://shekabhi.github.io/work/fips.html",
    ],
  };

  const HELP = [
    ["help", "show this list"],
    ["whoami", "who is this?"],
    ["ls [projects]", "list files"],
    ["cat <file>", "read a file, e.g. cat skills.txt"],
    ["projects", "what I've built"],
    ["experience", "where I've worked"],
    ["skills", "my stack"],
    ["contact", "how to reach me"],
    ["github | linkedin | leetcode", "open a profile"],
    ["email", "copy my email address"],
    ["notes", "my learning notes"],
    ["play", "open the typing game"],
    ["theme [light|dark|system]", "switch the colour theme"],
    ["history", "commands you've typed"],
    ["clear", "clear the screen"],
    ["exit", "close the terminal (or press Esc)"],
  ];
  const COMMANDS = ["help", "whoami", "ls", "cat", "projects", "experience", "skills", "notes", "learning", "theme", "play",
    "contact", "achievements", "github", "linkedin", "leetcode", "email", "history",
    "clear", "date", "echo", "pwd", "cd", "sudo", "exit"];

  // ---- DOM ----
  const wrap = document.createElement("div");
  wrap.className = "term-overlay";
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="term" role="dialog" aria-modal="true" aria-label="Terminal">
      <div class="term-bar">
        <span class="term-dots" aria-hidden="true"><i class="close"></i><i></i><i></i></span>
        <span class="term-title">abhishek@portfolio: ~</span>
        <button type="button" class="term-x" aria-label="Close terminal">✕</button>
      </div>
      <div class="term-body" aria-live="polite"></div>
      <div class="term-chips" aria-label="Suggested commands"></div>
    </div>`;
  document.body.appendChild(wrap);
  const body = wrap.querySelector(".term-body");
  const chips = wrap.querySelector(".term-chips");

  ["help", "whoami", "projects", "notes", "experience", "skills", "contact", "sudo hire abhishek"].forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = c;
    b.addEventListener("click", () => { input.value = c; submit(); });
    chips.appendChild(b);
  });

  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linkify = (t) => esc(t)
    .replace(/(https:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(new RegExp(EMAIL.replace(/\./g, "\\."), "g"), `<a href="mailto:${EMAIL}">${EMAIL}</a>`);

  const print = (lines, cls = "") => {
    [].concat(lines).forEach((l) => {
      const div = document.createElement("div");
      div.className = "term-line " + cls;
      div.innerHTML = linkify(l) || "&nbsp;";
      body.appendChild(div);
    });
    body.scrollTop = body.scrollHeight;
  };
  const printHTML = (html, cls = "") => {
    const div = document.createElement("div");
    div.className = "term-line " + cls;
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  };

  // Prompt line with the input
  const promptRow = document.createElement("label");
  promptRow.className = "term-prompt";
  promptRow.innerHTML = `<span class="ps1"><b>abhishek@portfolio:</b><i>~</i>$</span>`;
  const input = document.createElement("input");
  Object.assign(input, { type: "text", autocomplete: "off", spellcheck: false, autocapitalize: "off" });
  input.setAttribute("aria-label", "Terminal command");
  promptRow.appendChild(input);

  const history = [];
  let hIdx = 0;
  const open = () => {
    if (!wrap.hidden) return;
    wrap.hidden = false;
    document.querySelector(".nav-links")?.classList.remove("open");
    document.querySelector(".nav-toggle")?.setAttribute("aria-expanded", "false");
    document.body.classList.add("term-open");
    if (!body.childElementCount) boot();
    body.appendChild(promptRow);
    fitViewport();
    // Focus right away (inside the tap) so phones open their keyboard
    input.focus({ preventScroll: true });
    setTimeout(() => { if (document.activeElement !== input) input.focus({ preventScroll: true }); }, 50);
  };
  const fitViewport = () => {
    const vv = window.visualViewport;
    if (!vv || wrap.hidden) return;
    wrap.style.height = vv.height + "px";
    wrap.style.top = vv.offsetTop + "px";
    body.scrollTop = body.scrollHeight;
  };
  window.visualViewport?.addEventListener("resize", fitViewport);
  window.visualViewport?.addEventListener("scroll", fitViewport);

  const close = () => {
    wrap.hidden = true;
    document.body.classList.remove("term-open");
    document.querySelector(".term-btn")?.focus();
  };

  const boot = () => {
    print("Last login: " + new Date().toDateString() + " on ttys001", "dim");
    printHTML(`<div class="term-banner">
        <div class="term-logo" aria-hidden="true">AS</div>
        <div><b>Abhishek Shukla</b><br>Senior Software Engineer<br><span class="dim">Java · Spring Boot · Security · MCP</span></div>
      </div>`);
    print("Welcome! Type 'help' to see what you can do, or tap a command below.", "dim");
    print("");
  };

  const fileFor = (name) => {
    const n = name.replace(/^~\//, "").replace(/^\.\//, "");
    if (FILES[n]) return FILES[n];
    const p = n.replace(/^projects\//, "");
    if (n.startsWith("projects/") && PROJECTS[p]) return PROJECTS[p];
    if (PROJECTS[n]) return null; // exists but needs projects/ prefix
    return undefined;
  };

  const run = (raw) => {
    const line = raw.trim();
    if (!line) return;
    const [cmd, ...args] = line.split(/\s+/);
    const arg = args.join(" ");
    switch (cmd.toLowerCase()) {
      case "help":
        print("Available commands:", "accent");
        HELP.forEach(([c, d]) => printHTML(`  <span class="cmd">${esc(c.padEnd(30))}</span><span class="dim">${esc(d)}</span>`));
        break;
      case "whoami":
      case "about":
        print(FILES["about.txt"]); break;
      case "ls":
        if (!arg || arg === "~" || arg === ".") {
          printHTML(Object.keys(FILES).map((f) => `<span class="file">${f}</span>`).join("   ") + `   <span class="dir">projects/</span>`);
        } else if (arg.replace(/\/$/, "") === "projects") {
          printHTML(Object.keys(PROJECTS).map((f) => `<span class="file">${f}</span>`).join("   "));
        } else print(`ls: cannot access '${arg}': No such file or directory`, "err");
        break;
      case "cat": {
        if (!arg) { print("usage: cat <file>   (try: cat skills.txt)", "err"); break; }
        if (arg.replace(/\/$/, "") === "projects") { print("cat: projects: Is a directory", "err"); break; }
        const f = fileFor(arg);
        if (f) print(f);
        else if (f === null) print(`cat: ${arg}: No such file. Did you mean projects/${arg}?`, "err");
        else print(`cat: ${arg}: No such file or directory`, "err");
        break;
      }
      case "projects":
        Object.values(PROJECTS).forEach((p, i, a) => { print(p[0], "accent"); print(p.slice(1)); if (i < a.length - 1) print(""); });
        break;
      case "experience": print(FILES["experience.txt"]); break;
      case "skills": print(FILES["skills.txt"]); break;
      case "achievements": print(FILES["achievements.txt"]); break;
      case "theme": {
        const t = window.portfolioTheme;
        if (!t) { print("Theme switching isn't available on this page.", "err"); break; }
        if (!arg) { print(`theme: ${t.get()} (showing ${t.effective()}). Try: theme light | theme dark | theme system`); break; }
        if (t.set(arg.toLowerCase())) print(`✓ Theme set to ${t.get()}.`, "ok");
        else print(`theme: unknown option '${arg}'. Use light, dark or system.`, "err");
        break;
      }
      case "play":
        print("Loading the typing test…", "dim");
        setTimeout(() => { location.href = "/play/"; }, 400);
        break;
      case "notes":
      case "learning":
        print("Loading notes…", "dim");
        fetch("/learning/notes.json")
          .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then((notes) => {
            notes.slice(0, 8).forEach((n) =>
              printHTML(`<span class="dim">${esc(n.date)}</span>  <span class="cmd">${esc(n.topic.padEnd(14))}</span><a href="${esc(n.url)}">${esc(n.title)}</a>`));
            print(`All ${notes.length} notes: https://shekabhi.github.io/learning/`, "dim");
          })
          .catch(() => print("Couldn't load notes. Open https://shekabhi.github.io/learning/", "err"))
          .finally(() => { body.appendChild(promptRow); body.scrollTop = body.scrollHeight; });
        break;
      case "contact": print(FILES["contact.txt"]); break;
      case "github": case "linkedin": case "leetcode":
        print(`Opening ${LINKS[cmd]} ...`, "dim"); window.open(LINKS[cmd], "_blank", "noopener"); break;
      case "email":
        navigator.clipboard?.writeText(EMAIL).then(
          () => print(`✓ Copied ${EMAIL} to your clipboard.`, "ok"),
          () => print(EMAIL)
        ) ?? print(EMAIL);
        break;
      case "history": history.forEach((h, i) => print(`${String(i + 1).padStart(4)}  ${h}`)); break;
      case "clear": body.innerHTML = ""; body.appendChild(promptRow); return;
      case "date": print(new Date().toString()); break;
      case "pwd": print("/home/abhishek"); break;
      case "echo": print(arg); break;
      case "cd":
        if (!arg || arg === "~") break;
        print(arg.replace(/\/$/, "") === "projects"
          ? "Projects are best read with: ls projects, then cat projects/<file>"
          : `cd: ${arg}: No such file or directory`, arg.replace(/\/$/, "") === "projects" ? "dim" : "err");
        break;
      case "sudo":
        if (/^hire\s+abhishek/i.test(arg)) return hire();
        if (/^rm\s+-rf/.test(arg)) { print("Permission denied: this portfolio is FIPS compliant. 🔒", "err"); break; }
        print(`[sudo] password for guest: ********`, "dim");
        print(`guest is not in the sudoers file. This incident will be reported. 😄 (try: sudo hire abhishek)`, "err");
        break;
      case "rm": print("rm: refusing to delete production. Zero regressions, remember?", "err"); break;
      case "exit": case "quit": close(); return;
      default:
        print(`command not found: ${cmd}. Type 'help' for a list of commands.`, "err");
    }
  };

  const hire = () => {
    input.disabled = true;
    const steps = [
      ["Verifying credentials ............ ", "OK"],
      ["Checking Java & Spring Boot ...... ", "5+ years"],
      ["Running security audit ........... ", "20+ CVEs fixed, 0 regressions"],
      ["Loading distributed systems ...... ", "OK"],
      ["Drafting offer letter ............ ", "done"],
    ];
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        printHTML(`<span class="dim">${esc(steps[i][0])}</span><span class="ok">${esc(steps[i][1])}</span>`);
        i++; setTimeout(tick, 380);
      } else {
        print("");
        print(`✓ Great choice! Send the offer to ${EMAIL}`, "ok");
        print("");
        input.disabled = false; body.appendChild(promptRow); input.focus();
      }
    };
    tick();
  };

  const submit = () => {
    const val = input.value;
    printHTML(`<span class="ps1"><b>abhishek@portfolio:</b><i>~</i>$</span> ${esc(val)}`);
    if (val.trim()) { history.push(val.trim()); }
    hIdx = history.length;
    input.value = "";
    run(val);
    if (!input.disabled) { body.appendChild(promptRow); input.focus(); }
    body.scrollTop = body.scrollHeight;
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (hIdx > 0) input.value = history[--hIdx]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] ?? ""; }
    else if (e.key === "Tab") {
      e.preventDefault();
      const parts = input.value.split(" ");
      const last = parts.pop();
      const pool = parts.length
        ? [...Object.keys(FILES), "projects/", ...Object.keys(PROJECTS).map((p) => "projects/" + p)]
        : COMMANDS;
      const hits = pool.filter((c) => c.startsWith(last));
      if (hits.length === 1) input.value = [...parts, hits[0]].join(" ") + (hits[0].endsWith("/") ? "" : " ");
      else if (hits.length > 1) { printHTML(`<span class="dim">${esc(hits.join("   "))}</span>`); body.appendChild(promptRow); input.focus(); }
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); run("clear"); }
  });

  // On pages where letters are game input, "T" isn't a shortcut, so don't advertise it
  if (document.querySelector("[data-typing-test]")) {
    document.querySelectorAll(".term-btn[title]").forEach((b) => (b.title = "Open terminal (press ~)"));
  }

  // Open / close
  document.querySelectorAll(".term-btn").forEach((b) => b.addEventListener("click", open));
  wrap.querySelector(".term-x").addEventListener("click", close);
  wrap.querySelector(".term-dots .close").addEventListener("click", close);
  wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(); });
  body.addEventListener("click", () => { if (!window.getSelection().toString()) input.focus(); });
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    const isShortcut = !mod && (
      e.code === "Backquote" ||                 // the ~ / ` key, on any layout
      e.key === "~" || e.key === "`" ||
      ((e.key === "t" || e.key === "T") &&     // alternative shortcut, except on pages
        !document.querySelector("[data-typing-test]")) // where letters are game input
    );
    if (wrap.hidden && !typing && !e.repeat && isShortcut) { e.preventDefault(); open(); }
    else if (!wrap.hidden && e.key === "Escape") close();
    else if (!wrap.hidden && e.key === "Tab" && document.activeElement !== input) {
      // keep focus inside the dialog
      const f = [...wrap.querySelectorAll("button, input, a")].filter((el) => !el.disabled);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
