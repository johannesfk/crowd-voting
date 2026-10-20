# Costume contest platform

## Problem Statement

Running a costume contest for a university party currently means juggling two Tally forms and a lot of manual copying. The first form collects registrations — a person or group signs up with their names, what they are dressed as, and a photo — and stays open until closed by hand. The second form is then built by hand: every registration is retyped as an option in a multiple-select, so the audience can vote for up to three costumes, limited to one vote per device, anonymously and without logging in. That form is sent out, and closed by hand again. Results are then sorted by hand, and a graphic of the top three is built by hand.

The manual retyping step is fragile and slow, the two forms are separate links to communicate, there is no live sense of how voting is going, and the results presentation has to be assembled by hand at the moment the operator is busiest. There is nowhere that the whole lifecycle sits together.

## Solution

One platform, one link per contest, that carries a Contest from registration through voting to a published Podium. The audience registers an Entry — a costume, as an individual or a group — with their names, what they are dressed as, and a photo. When Voting opens, the ballot appears automatically at the same link: every registered costume, shuffled per device so position gives no advantage, with up to three unranked picks, one Ballot per device, no login and no identity. The operator hides unsuitable Entries before voting opens, watches the Board live while voting runs, closes voting when ready, and presents a keyboard-driven Podium — third, then second, then first — on a projector or through a capture card. Once published, the audience sees the standings at the same link.

Because it is one system, everything replaces a manual step: the ballot builds itself, the standings compute themselves, the reveal is navigable without a mouse, and the contest is deleted with its photos when the party is over.

## User Stories

1. As an operator, I want to create a Contest with a title and description, so that I can set up a contest for a specific party.
2. As an operator, I want to write short guidance that appears on the registration form, so that the audience knows they may sign up as an individual or a group.
3. As an operator, I want to write short guidance that appears on the voting form, so that the audience knows they may choose one to three costumes.
4. As an operator, I want to see a list of all my Contests, so that I can find last year's party as easily as tonight's.
5. As an operator, I want to run several Contests at once, so that I can keep a long-running contest live while a one-off contest runs for a single night.
6. As an operator, I want to share one link for a Contest that works for registration and for voting, so that I do not have to send two different links at two different times.
7. As an audience member, I want to open the Contest link and see the registration form while registration is open, so that I can sign up.
8. As an audience member, I want to open the Contest link and see the ballot once registration has closed and voting has opened, so that I can vote.
9. As an audience member, I want to open the Contest link and see a waiting page once voting has closed, so that I know what happens next.
10. As an audience member, I want the published standings to appear on that waiting page without reloading once the operator publishes, so that I do not miss the moment.
11. As an audience member, I want to see the final standings at a public link after the operator publishes them, so that I can check the result and share it.
12. As an audience member, I want to register as an individual, so that I can enter on my own.
13. As an audience member, I want to register as a group, so that my friends and I can enter as one costume.
14. As an audience member, I want to add every person in my group, so that everyone gets named in the results.
15. As an audience member, I want to say what my group is dressed up as, so that my costume is properly identified.
16. As an audience member, I want to take a photo of my costume with my phone's camera, so that people can see it.
17. As an audience member, I want to pick a photo from my library, so that I can submit one I already took.
18. As an audience member, I want to see a preview of my photo before I submit, so that I do not submit a bad picture.
19. As an audience member, I want to retake my photo, so that a mistake does not have to be my final entry.
20. As an audience member, I want my photo to be compressed before it is uploaded, so that registration works on venue wifi.
21. As an audience member, I want registration to complete even if photo processing fails, so that a decode error does not cost me my entry.
22. As an audience member, I want to see a confirmation after registering, so that I know I have entered.
23. As an audience member, I want to be told I have already registered when I revisit the link, so that I do not enter twice by mistake.
24. As an audience member, I want my registration to be final, so that nobody can quietly change a costume after the fact.
25. As an audience member, I want my treatment to be the same whether my group is two people or ten, so that a big group is not advantaged.
26. As an audience member, I want to vote without creating an account, so that I do not have to sign up to a system for one party.
27. As an audience member, I want my vote to be anonymous, so that nobody can tell what I chose.
28. As an audience member, I want to see all the costumes with their names, descriptions and photos on the ballot, so that I can decide.
29. As an audience member, I want the costume order to be randomised, so that the first costume I see does not have an unfair advantage.
30. As an audience member, I want that random order to stay the same each time I look, so that I am not tempted to reload for a better arrangement.
31. As an audience member, I want to select one costume, so that I can vote if I only like one.
32. As an audience member, I want to select up to three costumes, so that I can spread my picks.
33. As an audience member, I want to be prevented from selecting a fourth costume, so that the ballot rules are not guesswork.
34. As an audience member, I want my three picks to each count equally, so that the result reflects the most-liked costumes.
35. As an audience member, I want to change my mind before I submit, so that an accidental tap does not ruin my ballot.
36. As an audience member, I want my ballot to be final once submitted, so that the result cannot be swayed by late changes.
37. As an audience member, I want to be prevented from voting twice from the same device, so that the vote stays fair.
38. As an audience member, I want to be prevented from voting on my own costume, so that I cannot inflate my own result.
39. As an audience member, I want to see which costume is mine on my ballot, so that I know why I cannot select it.
40. As an audience member, I want my costume to count in the ballot as one entry, so that a group of six people is not six entries.
41. As an audience member, I want to be counted only once per costume I pick, so that my ballot cannot inflate a costume by picking it twice.
42. As an audience member, I want a costume that has been hidden to be absent from my ballot rather than shown unselectable, so that I am never shown something I cannot choose.
43. As an audience member, I want to see a waiting page after I vote, so that I know to come back for the result.
44. As an audience member, I want to vote on the same phone I registered on, so that I do not need a second device.
45. As an audience member, I want to register on one phone and vote on another, so that I am not blocked by device.
46. As an audience member, I want my vote to be counted even though I share the venue wifi with everyone else, so that a shared network does not disenfranchise me.
47. As an audience member, I want to be able to browse the standings after they are published, so that I can see who won.
48. As an audience member, I want the result to be a surprise until the operator publishes it, so that the reveal is worth watching.
49. As an operator, I want to log in with one shared password, so that the admin area is not open to the audience.
50. As an operator, I want to log out, so that the next person using my laptop cannot reach the admin area.
51. As an operator, I want to see every registration with its photo as it comes in, so that I know what is on my ballot.
52. As an operator, I want to hide an Entry before voting starts, so that I can remove something inappropriate, unreadable, or duplicated.
53. As an operator, I want to remove a bad Entry without discarding anyone's votes, so that moderation is a clean act rather than a judgement on the audience.
54. As an operator, I want hidden Entries excluded from the standings, so that the podium reflects what the audience could choose.
55. As an operator, I want the entry list to be frozen once voting opens, so that no costume can vanish from a ballot that was already cast.
56. As an operator, I want to be warned if I open voting with nothing to vote on, so that I do not run an empty contest.
57. As an operator, I want to close registration and open voting in one action, so that the handover moment is a single decision.
58. As an operator, I want to watch the vote counts update live while voting is open, so that I know how the contest is going.
59. As an operator, I want to see how many Ballots have been cast, so that I know how many people have voted.
60. As an operator, I want to be warned when two Ballots look like they came from the same device, so that I can judge whether something is wrong.
61. As an operator, I want those warnings to be advisory only, so that guests on shared wifi are never blocked from voting.
62. As an operator, I want to see the standings ordered by votes, so that I know the result.
63. As an operator, I want tied costumes shown as sharing a place, so that the result does not invent a winner the audience did not pick.
64. As an operator, I want to close voting, so that the result becomes final.
65. As an operator, I want standings to stay private after voting closes, so that I can decide when to announce them.
66. As an operator, I want to publish the standings, so that the audience can see them.
67. As an operator, I want to present the Podium full screen, so that the room can see the result.
68. As an operator, I want to advance the reveal with the arrow keys, so that I do not need a mouse while running the room.
69. As an operator, I want the reveal not to advance on its own, so that I can pace it.
70. As an operator, I want to step backwards through the reveal, so that I can replay a moment.
71. As an operator, I want to replay the whole reveal from the start, so that I can run it again for a second crowd.
72. As an operator, I want to hold a frame while I announce it, so that the room can look at one costume at a time.
73. As an operator, I want to go fullscreen and leave fullscreen from the keyboard, so that I never need the mouse.
74. As an operator, I want to know which keys to press without a manual, so that I am not guessing at the projector.
75. As an operator, I want a transparent background for the Podium, so that I can composite it over video in OBS.
76. As an operator, I want to set the background colour, so that the Podium looks right on the projector I actually have.
77. As an operator, I want the podium text to stay readable over a transparent background, so that the result does not become illegible.
78. As an operator, I want to download the podium as an image, so that I can post it or keep it.
79. As an operator, I want that image to have a transparent background, so that it composites the same way the live page does.
80. As an operator, I want to delete a Contest, so that it does not take up space after the party.
81. As an operator, I want deletion to remove the photos too, so that pictures of guests do not linger.
82. As an operator, I want to confirm a Contest deletion by re-typing its title, so that I cannot delete it by accident.
83. As an operator, I want deletion to be safe to retry, so that a half-finished delete can be finished rather than leaving orphans.
84. As an operator, I want to edit a registration to fix a typo, so that a misspelling does not ruin someone's entry.
85. As an operator, I want to see which device registered which Entry, so that I can answer questions about a specific entry.
86. As an audience member, I want my photo stored somewhere it is not exposed to other guests before voting opens, so that my entry is a surprise too.

## Implementation Decisions

**Vocabulary.** This spec uses the project glossary terms: Contest, Phase, Registration, Voting, Results, Published, Entry, Participant, Ballot, Vote, Device token, Duplicate signal, Operator, Hidden Entry, Own entry, Presentation, Podium, Board. A group of any size is one Entry. The audience votes on costumes, not on people.

**Phase machine.** A Contest moves Registration → Voting → Results → Published, and never backwards. Contest creation lands in Registration. One function owns every transition and asserts the edge exists before mutating; no route or remote function mutates the phase directly. Publication is what exposes the standings publicly, so Results means "final but private" and Publishing is a separate deliberate act. Late arrivals during Results or Published are served the waiting page, never the ballot.

**Data model.** Six tables, all under Drizzle over SQLite/D1:

- `contest` — title, description, two optional notice fields, current phase, presentation background, published-at timestamp.
- `device` — one row per browser per Contest: hashed device token, a shuffle seed fixed at first visit, hashed network address and browser fingerprint, first-seen timestamp. This table is what makes one-Ballot-per-device and Own entry detection work.
- `entry` — the Contest, an R2 photo key, the registering device, a hidden flag, registration timestamp.
- `participant` — entry, name, position.
- `ballot` — Contest, device, cast timestamp; unique per device per Contest.
- `vote` — ballot and entry; composite primary key, so an Entry cannot be picked twice on one Ballot.

**Own entry detection is a foreign key, not a heuristic.** Because the Ballot's device and the Entry's registering device are the same row, "this entry is mine" is a structural fact rather than a guess, and it holds per-browser rather than per-person. The device token is stored hashed, so the DB does not hold the credential in the clear.

**Ballot semantics.** One Ballot per device, holding one to three unranked Votes, all weighting equally. Rank is the count of Ballots containing an Entry — no weighting by group size, no 3/2/1 scoring. Casting is final and never amended.

**Ballot order.** The order is random, frozen per device for the life of the Contest, derived server-side from a seed persisted on `device` at the device's first visit. It is not generated in the browser. A Hidden Entry is excluded from the ballot; an Own entry is pinned outside the shuffled grid rather than occupying a slot, so position bias never lands on an unselectable card.

**Vote eligibility.** Enforced by the device token, which identifies a browser and not a person — registering on one phone and voting on another yields two unlinked tokens, so self-voting and double-voting are blocked within a device and defeated across devices. This limit is deliberate and documented rather than papered over. A derived network/fingerprint hash is stored as an advisory Duplicate signal shown on the Board; it never refuses a request, because venue guests share one access point and a hard limit would reject most of the room.

**Entry freeze.** Whether an Entry is hidden is only writable while the Contest is in Registration. Once voting opens the entry list is immutable, so no Entry disappears from a ballot that was already cast. Hidden Entries therefore have no votes, and excluding them from the standings needs no special case.

**Shared placement.** Standings order by vote count; tied Entries share a place and all appear on the Podium. The Podium must render a variable number of cards, not always three.

**Photos.** Registering uploads a photo via multipart form data. The browser downscales to a 1600px long edge and roughly 300 KB JPEG and re-encodes through a canvas, which bakes orientation into pixels. Two file inputs are used — one with the camera capture hint and one without — because modern Android no longer offers a camera tile in the picker for a plain image accept. Server-side is storage only, with a byte-size guard; there is no image processing on the Worker. Photo processing failures fall back to the original file rather than failing the registration. Picker dismissal is detected via the `cancel` event, guarded on the file list being empty, because re-picking the same file also fires `cancel`.

**Path shape.** One audience route per Contest serving registration or voting depending on current phase, plus a waiting route, a results route, and a presentation route. Contest identifiers are unguessable rather than names, so an unpublished Contest cannot be found by guessing a URL.

**Live waiting page.** The waiting page shows published standings without a reload using SvelteKit live queries — a server-side generator the client stays connected to, with reconnect and deduplication handled by the framework. The generator polls the Contest's phase and yields on change. A Durable Object broadcast hub is the documented upgrade path if this ever needs to push more than a phase change or fan out to a large audience; it is not built now.

**Auth.** One shared operator password held as a deployment secret, exchanged for a signed HttpOnly session cookie. There is no user table, no registration, and no reset flow; revoking is rotating the secret. Phase transitions and publication re-check the cookie server-side rather than trusting the client.

**Presentation.** A dedicated route, fullscreen-capable, keyboard driven with no auto-advance of any kind — every step of the reveal is a deliberate keypress. Keys advance forward and backward, replay from the start, hold a frame, toggle fullscreen, and exit. Background is per-Contest and either an opaque colour or fully transparent; overlay text and costume cards keep their own solid backing so the Podium stays legible over whatever the projector or capture card is fed. Downloading renders the same layout to a canvas at the same size with a transparent fill, so the exported image composites identically to the live page.

**Deletion.** Hard Delete removes the Contest, its entries, votes and every photo object in R2. There is no soft-delete staging area and no keeping images after deletion. Deletion is confirmed by re-typing the Contest title, and the delete path enumerates R2 objects by Contest prefix so that an interrupted delete can be retried to completion rather than leaving orphaned objects.

**Registration finality.** Entries are never amended by the people who registered them — no editing, no correcting a name, no swapping the photo, no withdrawing. The operator may correct an Entry from the admin area while the Contest is still in Registration; once voting opens, that goes too.

**Module seams.** The feature is built as a contest lifecycle module holding the phase machine, the ordering/shuffle rule, and the ranking rule as pure functions, plus a data layer and a small set of routes. Routes and remote functions stay thin and delegate to the module.

## Testing Decisions

**What makes a good test.** Tests assert external behaviour — what a guest or operator can observe through a route, a rendered ballot, or a returned value — and never reach into private helpers, mocks of the database, or implementation details that could be refactored without changing behaviour. Domain rules are tested through the pure functions they are expressed in, and browser behaviour is tested through the running app.

**Test seams.** Two existing seams, both already configured in the repository, and no new ones. Each ticket carries its own acceptance criteria against these seams; this section records only the rationale, so the tickets stay the source of truth for what is verified.

- A browser-driven end-to-end seam exercising the Contest through the built worker. This is the seam that proves a slice cuts through every layer, so each ticket is demoable end to end rather than verified per layer.
- A unit seam for the pure domain rules — the phase-transition guards, ranking with shared placement, ballot ordering, and the one-to-three-vote rule. These are pure functions with no request, no database and no random identifiers, so they are cheap to test exhaustively and are exactly where a wrong result would be silent.

No seam is introduced for the live waiting page or the browser image pipeline — both are observable from a page, and no meaningful boundary is crossed by testing them separately.

**Prior art.** The repository already contains a node-environment unit suite for a plain function and a Playwright suite driving the built preview by navigating and asserting on visible elements; the new tests follow both.

**Critical cases to cover.** The phase machine rejecting every illegal transition, including a guest whose form was left open past close. Shuffle remaining byte-identical across repeated calls for one device and differing between devices. Ranking producing shared placement on a tie and a podium that renders more than three cards. A ballot being refused once a contest leaves Voting. An Own entry appearing unselectable and outside the shuffled grid. Deletion removing photo objects and being safe to run twice. Registration completing when photo processing fails.

**What is not worth testing.** The browser image pipeline is verified end-to-end rather than mocked pixel by pixel; the duplicate signal is asserted to be recorded and displayed, not to be an accurate detector.

## Out of Scope

- Any account system, user table, login for the audience, or per-person identity of any kind.
- Bot protection or a captcha on the ballot.
- Moderation after voting opens; entries are frozen at that point.
- Editing or withdrawing an Entry by the people who registered it.
- Editing or withdrawing a Ballot by the device that cast it.
- A public live leaderboard during Voting — standings are operator-only until publication.
- Auto-closing a Contest on a timer; closing and publishing are always deliberate operator acts.
- Per-Contest operator passwords or multiple operator accounts.
- Serving photos through an image-transformation pipeline on the Worker.
- Device-binding strong enough to defeat a determined voter using two browsers, or hard limits based on network address.

## Further Notes

Three things blocked a working build before implementation and must come first: bindings for the database and object storage do not yet exist in the worker configuration, generated worker types have not been created, and the component library has not been initialised.

The most likely source of a wrong result is not the voting but the reveal: with three unselectable picks per ballot and a small audience, ties are common, and a podium that assumes exactly three entries will silently mis-report a real result. Ranking with shared placement is therefore worth testing before the reveal is animated.

Two operational facts are worth writing on the box, because they will otherwise be rediscovered by accident: deleting a Contest destroys photographs of real people with no undo, and a guest who registers on one phone and votes on another is treated as two devices.
