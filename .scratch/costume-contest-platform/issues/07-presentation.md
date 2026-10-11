# 07: Operator presents the Podium

**What to build:** the operator can reveal the result on a projector or through a capture card. The Presentation is a full-screen view showing third place first, then second, then first. It is driven entirely by the keyboard and never advances on its own, so the operator controls the pace of the room. The background can be set to a solid colour or made fully transparent so it composites over video in OBS, with the podium text and costume cards keeping their own backing so the result stays legible over whatever is behind it. The operator can save the podium as an image with the same transparent background.

**Blocked by:** 05 Operator watches the Board and closes Voting

**Status:** ready-for-agent

- [ ] The Presentation shows the top of the standings in order: third place, then second, then first
- [ ] The Presentation is reachable in its own full-screen view
- [ ] The reveal advances only on a keypress, never on a timer, and never autoplays
- [ ] The operator can step forward, step back, replay the whole reveal from the start, and hold a frame while announcing it
- [ ] The operator can enter and leave fullscreen, and exit the Presentation, all from the keyboard
- [ ] The available keys are discoverable without a manual, and the hint gets out of the way once the operator starts
- [ ] The background is per Contest and is either an opaque colour or fully transparent
- [ ] Over a transparent background the podium text and costume cards remain legible
- [ ] The number of costumes shown in a place follows the standings, so a tie does not hide a costume or invent a winner
- [ ] Saving the podium as an image produces a file that composites identically to the live page, including its transparent background
