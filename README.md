# cathzhou.github.io

My personal website: <https://cathzhou.github.io>

Plain HTML, no build step. Pushing to `master` deploys it to GitHub Pages.

- `index.html`, `research/index.html`, `things/index.html`: the three pages. Edit the text directly.
- Colored links with `data-description` expand a short blurb underneath when clicked (`script.js`).
- `glass.js`: the stained glass, modeled on the piece "Impressionable". The page background (`GlassWindow.build`) is a big roundel ringed in heavy lead, with warm panes between thick spokes outside it; inside, pale rays stream out from behind the text, chrysanthemums and leaves (`flower`, `leaf`) fill the left, and angular blue-violet shards sit on the right. Palettes are at the top (`RAY`, `FACE`, `WARM_FLOWER`, `LEAF`, `BORDER`). The cursor is the sun: glass near it lights up and catches glints. Click a piece to recolor it, RE-LEAD for a new layout, RESET for the original colors. The text sits on a wide, clear pointed-arch pane with a gold rim and a rose window (`addPaneFrame`, `roseWindow`). It also draws the favicon and the leaded strips under section headings.
- `styles.css`: page styles. Link colors cycle through `JEWEL_TEXT` in `script.js`.
