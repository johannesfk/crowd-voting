# The Podium image is drawn to a canvas, not screenshotted from the page

"Saving the Podium as an image" renders the current frame to a canvas at 1920×1080 and downloads it as a PNG. The live view and the canvas draw from one set of measurements — `PODIUM_LAYOUT` in `#lib/contest/podium.js`, expressed in cqw (hundredths of the Podium's own width) — so the exported file composites the way the live page does rather than merely resembling it.

The alternative, serialising the page's own markup into an SVG `foreignObject` (`html-to-image` and its relatives), was rejected. It depends on the browser rasterising live DOM including webfonts, which is unreliable across engines, and it taints the canvas on any cross-origin subresource — and this image's photographs are same-origin but private, served only with the operator's session, so a route that quietly became cross-origin would cost the export entirely rather than merely degrade it. Drawing it ourselves also means the file is exactly 1920×1080 with exactly the background the operator chose, every time, which is the thing OBS composites.

## Consequences

Text is not pixel-identical to the DOM's rendering and is not trying to be: what must match is the composite — same proportions, same opaque backing behind the title, the headline and every card, and genuine transparency where the operator asked for it. Photographs are read through the operator's own session at the same origin; one that fails to load is left out rather than waited on, so a broken object in storage cannot stop the operator getting a file at all. A photograph that never loads costs the eight-second timeout in `PHOTO_TIMEOUT_MS` and nothing more.

The live view's geometry is container-relative (`container-type: inline-size`), which is what lets the same numbers size a phone screen and a projector. A layout change therefore has to be made in `PODIUM_LAYOUT` or in both renderers, not in one — that is the cost of sharing them, and it is cheaper than the drift it prevents.
