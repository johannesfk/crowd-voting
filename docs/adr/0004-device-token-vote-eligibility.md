# Vote eligibility is enforced per device token, which is best-effort by design

One Ballot per device per Contest, enforced by an opaque device token. Self-voting is blocked the same way: the entry registered by the same device token is shown on the ballot but unselectable, pinned outside the shuffled grid.

The weakness is deliberate and documented: the token is a browser, not a person. Registering on a phone and voting on a laptop yields two tokens with nothing linking them. A network/UA hash is recorded as an advisory duplicate signal that the Operator can see but which never blocks, because venue guests share one WiFi access point and a hard block would reject most of the room.

Rejected: a hard per-IP limit — it would lock out every guest on shared venue WiFi, the dominant case. Rejected: Turnstile — it loses real votes from people who abandon the prompt, and the stake is a party trophy.

## Consequences

The duplicate signal is stored so the Operator can spot multi-ballot devices, but no request is ever refused on its basis. Anyone wanting stronger guarantees must accept either login or blocking shared networks.
