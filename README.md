# Personal Portfolio

A dark, modern, single-page developer portfolio. Plain HTML/CSS/JS — no build step.

## Files
- `index.html` — all content (edit this to personalize)
- `style.css` — theme & layout (colors are at the top under `:root`)
- `script.js` — mobile menu, scroll reveal, cursor glow

## Personalize
1. Search `index.html` for `Your Name`, `yourusername`, and `you@example.com` and replace them.
2. Edit the About text, Skills tags, Projects (titles, descriptions, links) and Experience.
3. Add a photo: put `me.jpg` next to `index.html` and replace the `avatar-placeholder` div with
   `<img src="me.jpg" alt="Your Name" />`.
4. Add your résumé as `resume.pdf` next to `index.html` (or remove the button).
5. Change the accent colors via `--accent` and `--accent-2` in `style.css`.

## Preview locally
Open `index.html` in a browser, or run:

```bash
python3 -m http.server 8000
```

## Deploy for free
- **GitHub Pages:** push to a repo named `yourusername.github.io`, then enable Pages in Settings → Pages.
- **Netlify / Vercel:** drag-and-drop the folder or connect the repo — no build command needed.
