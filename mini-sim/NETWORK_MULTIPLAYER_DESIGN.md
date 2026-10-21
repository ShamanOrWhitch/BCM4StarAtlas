# Networked Co-op — staged architecture

**Status:** architecture + transport-independent memory prototype; not an integrated/live multiplayer mode.
**Owner target:** Mini-Sim / Render. Local co-op and remote co-op remain independent options.

## Goal

A player on Client A and a player on Client B can be in separate location instances under one session while both instances continue ticking in authoritative server memory. The client should see connection state and its measured round-trip latency (RTT), rather than a hard-coded ping number. A network disconnect must not silently convert a stale client-side simulation into authoritative world state.

## Protocol shape

Transport target: WebSocket over WSS, subject to a server-entry/runtime spike. The repository currently starts TanStack Start via `node .output/server/index.mjs`; its documented server entry is Fetch-handler based. Do not assume it already supports HTTP Upgrade without a dedicated Node HTTP integration or separate service.

Client-to-server messages (validate every field; reject unknown message kinds):
- `join`: protocol version, session token, `sessionId`, `locationId`, requested seed (only accepted for creating a new room under server policy).
- `input`: `roomId`, monotonic per-client `sequence`, current input axes in [-1, 1], a small allowlisted button set; do not send claimed positions, item pickups, health or boss results.
- `ping`: a random nonce and client-local monotonic timestamp. Server echoes the nonce and its own timestamp; the client measures RTT with `performance.now()`, so wall-clock differences cannot forge the measurement.
- `leave`: room ID and current session token.

Server-to-client messages:
- `welcome`: canonical room ID/seed, tick and protocol version.
- `snapshot`: canonical server tick/revision, authoritative location state and player roster.
- `pong`: matching nonce and server timestamp.
- `resync`, `capacity`, `reconnecting`, `stale`, `server-restarting`: explicit status messages, never silent failure.

## Simulation and memory model

- Key each location instance by `sessionId::locationId`; different locations in one session are distinct state machines and can tick concurrently.
- The server owns positions, collision outcomes, player status, NPC/boss brains, pickups, timers, hazards, checkpoints and transitions. Clients only send input intent.
- Initial target: server simulation at 20 Hz, latest-input sampling each tick, snapshots around 10 Hz. These are tuning targets, not latency/performance claims; measure CPU, serialized bytes and RTT before setting final rates.
- Render interpolation uses server tick/revision; input has an acknowledged sequence number. Duplicate/old input sequences are rejected. Clamp movement axes and cap input message rate per connection.
- Initially cap at 16 simultaneous in-memory location instances and 4 clients per room; monitor state bytes, tick time and outgoing bandwidth. Change caps only after measured tests.
- Tick rooms with attached clients. When a room becomes empty, preserve its serialized state for a 3-minute grace window, then evict it; important durable session state must eventually move to a shared database, not untrusted browser storage or process-local memory.
- Seed is fixed for an instance and server-owned after room creation. All random gameplay decisions must be derived from a server-owned seeded PRNG to keep location state reproducible.
- Local split-screen does not require a network connection. Remote players may each own a different location instance; co-op events and location transfers need explicit server messages.

## Latency and reconnect policy

Initial UI interpretation (tune after collecting measurements): under 120 ms = good; 120–200 ms = playable with interpolation; 201–300 ms = degraded warning; over 300 ms or repeated missed heartbeats = reconnect/degraded state. These are product targets, not promises.
- Send heartbeat every 5 seconds and close a stale connection after a bounded timeout (initial target: 15 seconds without pong).
- Reconnect with exponential backoff plus jitter (for example 1, 2, 4, 8 seconds, capped at 30–60 seconds).
- Rejoin using a short-lived session token and recover the last acknowledged tick/revision; never accept client state as an authoritative restore.
- On deploy/shutdown, stop admitting new sessions, send a restart warning where possible, save appropriate state to shared storage, and close sockets gracefully.
- Never publish a fixed ping value: display measured RTT plus connection status and sample age.

## Render realities and hosting plan

The current `render.yaml` defines one Frankfurt **Free** Node web service. Current Render documentation says Free web services spin down after 15 minutes without inbound HTTP/WebSocket traffic, take about a minute to wake, can be restarted at any time, cannot scale past one instance, and have an ephemeral filesystem. WebSocket connections can be interrupted, and after reconnect the load balancer may route the client to another instance, so an in-memory-only world cannot promise recovery. Sources: <https://render.com/docs/free> and <https://render.com/docs/websocket>.
- The memory registry in `mini-sim/network/room-registry.mjs` proves state isolation/caps and input validation only. It is not yet an endpoint, socket server, scheduler, authentication layer, or deployed feature.
- First exercise two local scripted clients against a deterministic test driver; then add a WebSocket transport and explicit room/auth validation; then run a remote two-browser test with disconnect/reconnect and RTT samples.
- For persistent recovery / horizontally scaled deployment, evaluate shared storage such as Postgres or a shared key-value service. Do not present ephemeral in-memory rooms as durable sessions.

## Security, stability and acceptance

- Validate origin, authentication, session membership, protocol version, input size/rate and all IDs before message dispatch. Never trust client-reported ping, position, resources or event outcomes.
- Add bounded JSON state size, per-room and global client caps, idle cleanup and metrics (active rooms, clients, tick duration, state bytes, outbound bytes).
- Tests must cover separate locations ticking simultaneously, sequence replay, clamping, seed mismatch, caps, inactive retention, oversized state and reconnect semantics.
- Current prototype status: in-memory registry and tests only. No socket is accepting traffic and no live player state is being synchronized.
