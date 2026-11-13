// Step-through sequence diagram: an AI agent calling a tool on the MCP server
// with OAuth2 + PKCE. Mounts on [data-mcp-flow].
(() => {
  const LANES = ["AI agent", "MCP server", "Auth server", "REST API"];
  const STEPS = [
    [0, 1, "initialize, tools/list", "The agent asks what it can do",
      "The agent connects and asks which tools exist. It knows nothing about the product's REST API yet."],
    [1, 0, "tools: getCustomer, createOrder …", "REST endpoints come back as tools",
      "The server describes each REST operation as a tool with a name, a description and a typed input schema, so the model can decide when and how to call it."],
    [0, 1, "tools/call createOrder (no token)", "First call, no credentials",
      "The agent tries to use a tool. It has no access token yet."],
    [1, 0, "401 + where to authenticate", "The server refuses and points to the auth server",
      "Nothing runs without a token. The 401 response tells the agent which authorization server protects this resource."],
    [0, 2, "authorize + code_challenge", "PKCE: prove it later",
      "The agent invents a random secret (the code verifier) and sends only its SHA-256 hash. The user signs in and approves the scopes, for example orders:write."],
    [2, 0, "authorization code", "A one-time code comes back",
      "The code alone is not enough to get a token. That is the point of PKCE."],
    [0, 2, "code + code_verifier", "Now reveal the secret",
      "The auth server hashes the verifier and compares it with the challenge from step 5. A stolen authorization code is useless without it."],
    [2, 0, "access token (JWT, scoped)", "A short-lived, scoped JWT",
      "The token is signed by the auth server and carries only the scopes the user approved."],
    [0, 1, "tools/call createOrder + Bearer JWT", "Retry with the token",
      "Same tool call as step 3, now with the JWT in the Authorization header."],
    [1, 3, "REST call (JWT verified, scope ok)", "Verify, then forward",
      "The MCP server checks the signature against the auth server's public keys (JWKS), then expiry, audience, and that the token's scopes cover this tool. Only then does it call the REST API."],
    [3, 1, "201 Created", "The API does the work",
      "The existing REST API is unchanged. It never has to know an AI agent was involved."],
    [1, 0, "tool result", "The agent gets a structured result",
      "The response is returned as a tool result the model can read and act on."],
  ];
  const NS = "http://www.w3.org/2000/svg";
  const W = 800, X = [100, 300, 500, 700], TOP = 70, GAP = 40;
  const H = TOP + STEPS.length * GAP + 20;
  const el = (name, attrs, text) => {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text) n.textContent = text;
    return n;
  };

  document.querySelectorAll("[data-mcp-flow]").forEach((root) => {
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Sequence diagram of an AI agent calling an MCP tool with OAuth2 and PKCE" });
    LANES.forEach((name, i) => {
      svg.appendChild(el("line", { class: "f-life", x1: X[i], y1: 44, x2: X[i], y2: H - 6 }));
      svg.appendChild(el("rect", { class: "f-lane", x: X[i] - 70, y: 8, width: 140, height: 36, rx: 8 }));
      svg.appendChild(el("text", { class: "d-text", x: X[i], y: 31, "text-anchor": "middle" }, name));
    });
    const groups = STEPS.map(([from, to, label], i) => {
      const y = TOP + i * GAP + 14, dir = to > from ? 1 : -1;
      const x1 = X[from] + dir * 6, x2 = X[to] - dir * 6;
      const g = el("g", { class: "f-step" });
      g.appendChild(el("text", { x: (x1 + x2) / 2, y: y - 7, "text-anchor": "middle" }, `${i + 1}. ${label}`));
      g.appendChild(el("line", { x1, y1: y, x2: x2 - dir * 8, y2: y }));
      g.appendChild(el("polygon", { points: `${x2},${y} ${x2 - dir * 9},${y - 5} ${x2 - dir * 9},${y + 5}` }));
      svg.appendChild(g);
      return g;
    });

    const fig = document.createElement("div");
    fig.style.overflowX = "auto";
    fig.tabIndex = 0;
    fig.setAttribute("role", "group");
    fig.setAttribute("aria-label", "Sequence diagram, scrolls sideways on small screens");
    fig.appendChild(svg);
    const caption = document.createElement("div");
    caption.className = "flow-caption";
    caption.setAttribute("aria-live", "polite");
    const controls = document.createElement("div");
    controls.className = "flow-controls";
    controls.innerHTML = `<button type="button" data-a="prev">← Back</button><button type="button" data-a="next">Next →</button><button type="button" data-a="play">▶ Play</button>`;
    root.append(fig, caption, controls);
    const [prev, next, play] = controls.querySelectorAll("button");

    let cur = 0, timer = null;
    const show = (i) => {
      cur = Math.max(0, Math.min(STEPS.length - 1, i));
      groups.forEach((g, k) => { g.classList.toggle("active", k === cur); g.classList.toggle("done", k < cur); });
      const [, , , title, detail] = STEPS[cur];
      caption.innerHTML = `<div class="step">STEP ${cur + 1} / ${STEPS.length}</div><h3></h3><p></p>`;
      caption.querySelector("h3").textContent = title;
      caption.querySelector("p").textContent = detail;
      // On narrow screens the diagram scrolls sideways: keep the active arrow in view
      const [from, to] = STEPS[cur];
      const mid = ((X[from] + X[to]) / 2 / W) * svg.getBoundingClientRect().width;
      if (fig.scrollWidth > fig.clientWidth) fig.scrollTo({ left: mid - fig.clientWidth / 2, behavior: "smooth" });
      prev.disabled = cur === 0;
      next.disabled = cur === STEPS.length - 1;
    };
    const stop = () => { clearInterval(timer); timer = null; play.textContent = "▶ Play"; };
    prev.addEventListener("click", () => { stop(); show(cur - 1); });
    next.addEventListener("click", () => { stop(); show(cur + 1); });
    play.addEventListener("click", () => {
      if (timer) return stop();
      if (cur === STEPS.length - 1) show(0);
      play.textContent = "❚❚ Pause";
      timer = setInterval(() => { if (cur === STEPS.length - 1) stop(); else show(cur + 1); }, 2200);
    });
    show(0);
  });
})();
