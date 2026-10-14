# Glossary

Ubiquitous language for the costume contest platform. One term, one meaning.
If a word here is used loosely in conversation or code, that is a bug.

## Contest

A single party or event's contest. Owns its entries, ballots and results.
Many contests can exist at once. A contest is created by the operator, moves
through the phases below, and can be deleted by the operator when it is over.

## Phase

The contest's current state, which determines what the audience may do:

- **Registration** — the audience registers entries. Audience cannot vote yet.
- **Voting** — registration is closed, the ballot is live, the audience votes.
  The ballot is shown only to entries the operator has not hidden.
- **Results** — voting is closed and the standings are final but not yet
  public. The Operator may present them before publishing.
- **Published** — the standings are public at a shareable link.

A contest is created in **Registration** and ends in **Published**. It never
moves backwards.

## Entry

One costume, voted on as a single unit. A group of any size is still one Entry.
The audience votes on costumes, not on people.

An Entry belongs to a Contest and is contributed by one or more Participants.
Every Entry has exactly one photo.

An Entry is never amended by the people who registered it. There is no editing,
no correcting a name, no swapping the photo, and no withdrawing.

## Published

The moment the Operator makes results public. Until a Contest is published,
nobody but the Operator can see the standings, however long ago voting closed.
An audience member who arrives at a closed-but-unpublished Contest waits on a
page that reveals itself the moment publication happens.

## Own entry

An Entry that the viewing device registered. It appears on that device's ballot
marked as the voter's own, unselectable, and outside the shuffled grid. Because
an Entry is tied to the browser that registered it rather than to a person,
this is a per-device fact and not a guarantee about a human.

## Participant

A named person who is displayed as part of an Entry. A Participant exists only to
carry a name and their share of the Entry's identity. A Participant is never a
voter in the same contest. One Participant may appear on many Entries.

## Ballot

The set of choices cast by one device in one Contest. A device casts at most one
Ballot per Contest, ever. A Ballot holds up to three unranked Votes; it may also
hold one or two.

Casting a Ballot is final. A cast Ballot is never amended, replaced or
withdrawn: the vote stands exactly as cast.

Each device sees one fixed order of entries for the whole contest, stable across
visits, so that no voter can improve their position by reloading.

## Vote

One selected Entry within a Ballot. All Votes weigh equally: an Entry's rank is
simply the number of Ballots that contain it. Three unranked picks is not a
top-three ranking, and three picks are not weighted 3/2/1.

## Device token

The opaque random value a browser receives on first visit to a Contest. It
identifies the device for the purpose of one-Ballot-per-device, and is stored in
the browser. It is not a login, carries no identity, and reveals nothing about
the person holding it.

## Duplicate signal

A derived hint that two Ballots may have come from one device or one room —
from network address and browser characteristics. It is advisory: the operator
sees it, the audience is never blocked by it, because a venue's guests share one
network address.

## Operator

The single person who runs a Contest: opens and closes phases, hides Entries,
and reads results. Authenticates with one shared password, held as a deployment
secret. There is no Operator user table.

## Hidden Entry

An Entry the operator has withheld before voting begins, because it is
inappropriate, unreadable, or a duplicate. It is not votable and does not appear
in results.

Whether an Entry is hidden is decided while the Contest is in Registration and
never changes afterwards. Once voting opens the entry list is frozen, so no
Entry vanishes from a ballot that has already been cast.

## Presentation

The full-screen reveal of the Podium on a projector or capture card. Driven by
the keyboard rather than by clicking, so the person running it never needs the
mouse. Its background is operator-configurable, and can be made transparent for
compositing into other software.

## Podium

The ranked presentation of the top three Entries of a finished Contest, revealed
after voting closes: third place first, then second, then first.

## Board

The operator's view of Entries and their vote counts, live while voting is open.
Not public to the audience at any time.
