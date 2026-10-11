# Contest updates reach the audience via live queries, not a Durable Object

The waiting page must show the published leaderboard without a reload. This was
originally decided as a Durable Object per Contest acting as an SSE broadcast hub,
on the grounds that Workers isolates may host the publish request and the
audience's connections separately, so an in-isolate broadcast would reach nobody
silently.

That reasoning holds for hand-rolled SSE, but it does not survive SvelteKit 3's
`query.live`, which the runtime handles for us: the client holds one connection,
survives reconnect, dedupes across consumers, and needs no client-side transport
code. The generator polls D1 for the contest phase while connected and yields on
change. D1 stays the single source of truth; the generator is pure transport.

Rejected: Durable Object hub — correct for high fan-out or bidirectional traffic,
but here the event is one publish per contest to roughly fifty people in a room,
and it adds a lifecycle to reason about for no observable gain. Rejected: client
polling — user code that `query.live` writes for us.

## Consequences

The waiting page's CPU cost is a sleeping loop, not work. If a contest ever needs
to push something other than a phase change, or fan out to thousands of waiting
viewers, the DO hub is the upgrade path and the interface stays the same.