# 07: Operator presents the Podium

**What to build:** the operator can reveal the result on a projector or through a capture card. The Presentation is a full-screen view showing third place first, then second, then first. It is driven entirely by the keyboard and never advances on its own, so the operator controls the pace of the room. The background can be set to a solid colour or made fully transparent so it composites over video in OBS, with the podium text and costume cards keeping their own backing so the result stays legible over whatever is behind it. The operator can save the podium as an image with the same transparent background.

**Blocked by:** 05 Operator watches the Board and closes Voting

**Status:** ready-for-human

- [x] The Presentation shows the top of the standings in order: third place, then second, then first
- [x] The Presentation is reachable in its own full-screen view
- [x] The reveal advances only on a keypress, never on a timer, and never autoplays
- [x] The operator can step forward, step back, replay the whole reveal from the start, and hold a frame while announcing it
- [x] The operator can enter and leave fullscreen, and exit the Presentation, all from the keyboard
- [x] The available keys are discoverable without a manual, and the hint gets out of the way once the operator starts
- [x] The background is per Contest and is either an opaque colour or fully transparent
- [x] Over a transparent background the podium text and costume cards remain legible
- [x] The number of costumes shown in a place follows the standings, so a tie does not hide a costume or invent a winner
- [x] Saving the podium as an image produces a file that composites identically to the live page, including its transparent background

## Comments

Built on the pure rule in `#lib/contest/podium.ts` — frames are read straight off the
standings' `place`, so a tie needs no special case and the reveal cannot disagree with
the Board the operator watched.

Two decisions worth keeping:

- **The Presentation lives at `/admin/presentation/[contestId]`**, inside the operator
  group, and the group layout drops its chrome for that one route. It cannot live
  anywhere else: the session cookie is scoped to `/admin` (ADR 0003), so a `/presentation`
  route is a route the operator's own browser sends no session to.
- **The exported image is drawn to a canvas**, not screenshotted (ADR 0007). The live view
  and the canvas share `PODIUM_LAYOUT` and `PODIUM_COLOURS`, and the suite compares the
  opacity of the headline's backing on the page against the same pixel in the file, which
  is the only way "composites identically" is a claim that can fail.

The presentation background is set per Contest on the admin page and is writable in any
phase: an operator who picks the wrong colour at seven in the evening must be able to
change it at half past. `migration 0004` backfills existing Contests to the default
colour, because `null` there means transparent rather than unset.
