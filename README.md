# cathzhou.github.io

My personal website: <https://cathzhou.github.io>

Plain HTML, no build step. Pushing to `master` deploys it to GitHub Pages.

- `index.html`, `research/index.html`, `things/index.html`: the three pages. Edit the text directly.
- Colored links with `data-description` expand a short blurb underneath when clicked (`script.js`).
- `glass.js`: the stained glass. The page background is a leaded glass window of trees (`growTrees`) against the sky; the cursor acts as the sun, lighting the glass and catching glints near it. Click a pane to recolor it, RE-LEAD for new trees, RESET for the original colors. The text sits on a clear pointed-arch pane (`addPaneFrame`). It also draws the rose-window logo and the leaded strips under section headings. Colors are the palettes at the top.
- `styles.css`: page styles. Link colors cycle through `JEWEL_TEXT` in `script.js`.
