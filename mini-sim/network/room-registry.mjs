const ID_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;
const INPUT_BUTTONS = ["jump", "activate", "dash", "interact"];
const ZERO_INPUT = Object.freeze({
  moveX: 0,
  moveY: 0,
  buttons: Object.freeze({ jump: false, activate: false, dash: false, interact: false })
});

function validId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(label + " must contain 1-64 letters, digits, dot, underscore or hyphen");
  }
  return value;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneJson(value, maxBytes) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError("Room state must be JSON-serializable");
  }
  if (typeof serialized !== "string") throw new TypeError("Room state must be JSON-serializable");
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > maxBytes) throw new RangeError("Room state exceeds configured byte limit");
  return JSON.parse(serialized);
}

function normalizeInput(value) {
  const source = value && typeof value === "object" ? value : {};
  const rawButtons = source.buttons && typeof source.buttons === "object" ? source.buttons : {};
  const buttons = {};
  for (const key of INPUT_BUTTONS) buttons[key] = rawButtons[key] === true;
  return {
    moveX: clamp(finiteNumber(source.moveX), -1, 1),
    moveY: clamp(finiteNumber(source.moveY), -1, 1),
    buttons
  };
}

/**
 * A bounded, in-memory registry for authoritative simulation location instances.
 *
 * This is a transport-independent prototype: the WebSocket endpoint, auth,
 * fixed-rate scheduler, snapshot broadcast and persistent recovery are separate
 * integration work. Only server code should call stepRoom() and provide the
 * simulation callback; clients can submit normalized input only.
 */
export class SimRoomRegistry {
  constructor({
    maxRooms = 16,
    maxClientsPerRoom = 4,
    idleRetentionMs = 180_000,
    maxStateBytes = 256 * 1024,
    createInitialState = ({ seed }) => ({ seed, tick: 0, entities: [] }),
    now = () => Date.now()
  } = {}) {
    if (!Number.isInteger(maxRooms) || maxRooms < 1) throw new RangeError("maxRooms must be a positive integer");
    if (!Number.isInteger(maxClientsPerRoom) || maxClientsPerRoom < 1) {
      throw new RangeError("maxClientsPerRoom must be a positive integer");
    }
    if (!Number.isFinite(idleRetentionMs) || idleRetentionMs < 0) {
      throw new RangeError("idleRetentionMs must be a non-negative number");
    }
    if (!Number.isFinite(maxStateBytes) || maxStateBytes < 1024) {
      throw new RangeError("maxStateBytes must be at least 1024");
    }
    if (typeof createInitialState !== "function") throw new TypeError("createInitialState must be a function");
    if (typeof now !== "function") throw new TypeError("now must be a function");

    this.maxRooms = maxRooms;
    this.maxClientsPerRoom = maxClientsPerRoom;
    this.idleRetentionMs = idleRetentionMs;
    this.maxStateBytes = maxStateBytes;
    this.createInitialState = createInitialState;
    this.now = now;
    this.rooms = new Map();
    this.clientRooms = new Map();
  }

  roomKey(sessionId, locationId) {
    return validId(sessionId, "sessionId") + "::" + validId(locationId, "locationId");
  }

  join({ sessionId, locationId, clientId, seed }) {
    sessionId = validId(sessionId, "sessionId");
    locationId = validId(locationId, "locationId");
    clientId = validId(clientId, "clientId");
    const roomId = this.roomKey(sessionId, locationId);
    const now = this.now();
    this.sweep(now);

    const oldRoomId = this.clientRooms.get(clientId);
    if (oldRoomId && oldRoomId !== roomId) {
      throw new Error("CLIENT_ALREADY_JOINED_ANOTHER_LOCATION");
    }

    let room = this.rooms.get(roomId);
    if (!room) {
      if (this.rooms.size >= this.maxRooms) throw new Error("ROOM_CAPACITY_REACHED");
      const numericSeed = Number(seed);
      if (!Number.isSafeInteger(numericSeed) || numericSeed < 0 || numericSeed > 0xffffffff) {
        throw new TypeError("seed must be an unsigned 32-bit integer");
      }
      const state = cloneJson(this.createInitialState({ roomId, sessionId, locationId, seed: numericSeed }), this.maxStateBytes);
      room = {
        roomId,
        sessionId,
        locationId,
        seed: numericSeed,
        state,
        tick: 0,
        revision: 0,
        createdAt: now,
        lastActivityAt: now,
        lastEmptyAt: now,
        clients: new Map()
      };
      this.rooms.set(roomId, room);
    } else if (Number(seed) !== room.seed) {
      throw new Error("ROOM_SEED_MISMATCH");
    }

    if (!room.clients.has(clientId) && room.clients.size >= this.maxClientsPerRoom) {
      throw new Error("ROOM_PLAYER_CAPACITY_REACHED");
    }
    if (!room.clients.has(clientId)) {
      room.clients.set(clientId, {
        clientId,
        joinedAt: now,
        lastSeenAt: now,
        lastInputSequence: -1,
        input: normalizeInput(ZERO_INPUT)
      });
    }
    this.clientRooms.set(clientId, roomId);
    room.lastActivityAt = now;
    room.lastEmptyAt = null;
    return this.snapshot(roomId);
  }

  submitInput({ roomId, clientId, sequence, input }) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    const client = room.clients.get(validId(clientId, "clientId"));
    if (!client) throw new Error("CLIENT_NOT_IN_ROOM");
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new TypeError("sequence must be a non-negative integer");

    if (sequence <= client.lastInputSequence) {
      return { accepted: false, reason: "stale-sequence", lastAcceptedSequence: client.lastInputSequence };
    }
    client.lastInputSequence = sequence;
    client.input = normalizeInput(input);
    client.lastSeenAt = this.now();
    room.lastActivityAt = client.lastSeenAt;
    return { accepted: true, lastAcceptedSequence: client.lastInputSequence };
  }

  heartbeat({ roomId, clientId }) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    const client = room.clients.get(validId(clientId, "clientId"));
    if (!client) throw new Error("CLIENT_NOT_IN_ROOM");
    client.lastSeenAt = this.now();
    room.lastActivityAt = client.lastSeenAt;
    // The client measures RTT using its own monotonic clock and echoed nonce.
    return { roomId, clientId, serverTime: client.lastSeenAt, tick: room.tick, revision: room.revision };
  }

  stepRoom(roomId, dtSeconds, simulate) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    if (room.clients.size === 0) return { stepped: false, reason: "no-active-clients" };
    if (typeof simulate !== "function") throw new TypeError("simulate must be a server-owned function");
    const dt = Number(dtSeconds);
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) {
      throw new RangeError("dtSeconds must be within (0, 0.1]");
    }

    const inputs = [...room.clients.values()].map((client) => ({
      clientId: client.clientId,
      sequence: client.lastInputSequence,
      input: cloneJson(client.input, 4096)
    }));
    const nextState = simulate(cloneJson(room.state, this.maxStateBytes), inputs, dt, {
      roomId: room.roomId,
      sessionId: room.sessionId,
      locationId: room.locationId,
      seed: room.seed,
      tick: room.tick + 1
    });
    room.state = cloneJson(nextState, this.maxStateBytes);
    room.tick += 1;
    room.revision += 1;
    room.lastActivityAt = this.now();
    return { stepped: true, tick: room.tick, revision: room.revision };
  }

  snapshot(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      roomId: room.roomId,
      sessionId: room.sessionId,
      locationId: room.locationId,
      seed: room.seed,
      tick: room.tick,
      revision: room.revision,
      state: cloneJson(room.state, this.maxStateBytes),
      players: [...room.clients.values()].map((client) => ({
        clientId: client.clientId,
        joinedAt: client.joinedAt,
        lastInputSequence: client.lastInputSequence
      }))
    };
  }

  leave({ roomId, clientId }) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const id = validId(clientId, "clientId");
    if (!room.clients.delete(id)) return false;
    this.clientRooms.delete(id);
    room.lastActivityAt = this.now();
    if (room.clients.size === 0) room.lastEmptyAt = room.lastActivityAt;
    return true;
  }

  sweep(now = this.now()) {
    let removed = 0;
    for (const [roomId, room] of this.rooms) {
      if (room.clients.size > 0 || room.lastEmptyAt == null) continue;
      if (now - room.lastEmptyAt < this.idleRetentionMs) continue;
      this.rooms.delete(roomId);
      removed += 1;
    }
    return removed;
  }

  metrics() {
    let activeRooms = 0;
    let clients = 0;
    for (const room of this.rooms.values()) {
      if (room.clients.size > 0) activeRooms += 1;
      clients += room.clients.size;
    }
    return { roomsTotal: this.rooms.size, activeRooms, clients, maxRooms: this.maxRooms };
  }
}

export const NETWORK_SIM_INPUT_BUTTONS = INPUT_BUTTONS.slice();
