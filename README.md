# cathzhou.github.io

My personal website: <https://cathzhou.github.io>

Plain HTML, no build step. Pushing to `master` deploys it to GitHub Pages.

- `index.html`, `research/index.html`, `things/index.html`: the three pages. Edit the text directly.
- Colored links with `data-description` expand a short blurb underneath when clicked (`script.js`).
- `glass.js`: the stained glass. The page background is a leaded glass window of trees (`growTrees`): long sky shards fan out from a glow, small pieces in the leaves, bands on the floor, colored from the ramps at the top (`SKY`, `LEAF`, `BARK`, `GROUND`). The cursor is the sun: glass near it lights up in its own colors and catches glints. Click a pane to recolor it, RE-LEAD for new trees, RESET for the original colors. The text sits on a clear pointed-arch pane with a gold rim and a rose window (`addPaneFrame`, `roseWindow`). It also draws the favicon and the leaded strips under section headings.
- `styles.css`: page styles. Link colors cycle through `JEWEL_TEXT` in `script.js`.
