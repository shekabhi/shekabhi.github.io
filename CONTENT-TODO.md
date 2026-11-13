# Content to review and replace

The site was rebuilt around case studies. To get it live quickly, some text was
**drafted by AI** from the résumé and general engineering knowledge. It is
plausible, but it is not yet *your* account of what happened.

Every drafted block is marked in the HTML with the attribute **`data-draft`**.
Find them all with:

```bash
grep -n "data-draft" index.html work/*.html
```

When you have rewritten a block in your own words, delete its `data-draft` attribute.

## What is solid (taken from the résumé)

- Job titles, companies, dates, education, awards
- Every number: 200+ libraries, +30% adoption, −40% exceptions, 20+ CVEs,
  0 regressions, −20% session resources, 10K+ payloads/day
- The technologies used in each project

## What needs your review

### Home page (`index.html`)
- [ ] **Live demo blurb** — why a sliding window (check it matches your reasoning)
- [ ] **"Things I've come to believe"** — six principles. Keep the ones you
      actually hold, rewrite or delete the rest. Ideally tie each to a real story.

### MCP server (`work/mcp-server.html`)
- [ ] The problem, paragraph 2 — framing of agents as a new kind of client
- [ ] Constraints — were these the real ones?
- [ ] "Three checks on every call" — confirm this matches the implementation
- [ ] Trade-offs — especially **"tools generated from the API's own description"**:
      confirm how tools are really produced (generated vs hand-written)
- [ ] The step-through diagram (`mcp-flow.js`) — a standard OAuth2 + PKCE flow;
      adjust names/steps to match the real server
- [ ] What I'd do next
- [ ] **Confidentiality:** check nothing here goes beyond what Progress has made public

### Version-independent app server (`work/pasoe.html`)
- [ ] Constraints
- [ ] How the negotiation protocol works (drafted in general terms)
- [ ] How the phased rollout went ("started as opt-in" is an assumption)
- [ ] Trade-offs — the alternatives you actually considered
- [ ] What I'd do next
- [ ] **Confidentiality** check

### FIPS (`work/fips.html`)
- [ ] The problem, paragraph 2 — how failures showed up before
- [ ] Constraints
- [ ] What startup validation checks, exactly
- [ ] Trade-offs
- [ ] What I'd do next
- [ ] **Confidentiality** check

### Rate limiter (`work/rate-limiter.html`)
- [ ] Design paragraph — says requests are stored in a Redis **sorted set** and the
      steps run **atomically**. Confirm (e.g. Lua script or MULTI/EXEC), or correct it.
- [ ] Trade-offs — the alternatives you actually weighed
- [ ] What I'd do next
- [ ] Add a link to the GitHub repo if it is public

## Still missing
- [ ] Résumé PDF without the phone number (then add a download button + `resume` terminal command)
- [ ] A photo (optional)
