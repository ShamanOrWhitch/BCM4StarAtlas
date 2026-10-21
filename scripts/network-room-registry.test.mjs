import test from "node:test";
import assert from "node:assert/strict";
import { SimRoomRegistry } from "../mini-sim/network/room-registry.mjs";

test("separate location instances remain independent within one session", () => {
  let clock = 1000;
  const rooms = new SimRoomRegistry({
    now: () => clock,
    createInitialState: ({ locationId, seed }) => ({ locationId, seed, counter: 0 })
  });
  const a = rooms.join({ sessionId: "session-a", locationId: "hangar", clientId: "client-a", seed: 101 });
  const b = rooms.join({ sessionId: "session-a", locationId: "boss-arena", clientId: "client-b", seed: 202 });

  assert.notEqual(a.roomId, b.roomId);
  assert.equal(rooms.metrics().activeRooms, 2);
  rooms.stepRoom(a.roomId, 0.05, (state) => ({ ...state, counter: state.counter + 1 }));
  rooms.stepRoom(b.roomId, 0.05, (state) => ({ ...state, counter: state.counter + 10 }));
  assert.equal(rooms.snapshot(a.roomId).state.counter, 1);
  assert.equal(rooms.snapshot(b.roomId).state.counter, 10);
});

test("clients submit only normalized inputs; stale sequences are rejected", () => {
  const rooms = new SimRoomRegistry();
  const room = rooms.join({ sessionId: "s", locationId: "l", clientId: "c", seed: 7 });
  assert.deepEqual(rooms.submitInput({
    roomId: room.roomId, clientId: "c", sequence: 4,
    input: { moveX: 7, moveY: -8, buttons: { jump: true, dash: "true", unexpected: true } }
  }), { accepted: true, lastAcceptedSequence: 4 });
  assert.deepEqual(rooms.submitInput({
    roomId: room.roomId, clientId: "c", sequence: 4, input: { moveX: 0 }
  }), { accepted: false, reason: "stale-sequence", lastAcceptedSequence: 4 });
  const state = rooms.snapshot(room.roomId).state;
  assert.deepEqual(state, { seed: 7, tick: 0, entities: [] });
  rooms.stepRoom(room.roomId, 0.05, (world, inputs) => {
    assert.equal(inputs[0].input.moveX, 1);
    assert.equal(inputs[0].input.moveY, -1);
    assert.equal(inputs[0].input.buttons.jump, true);
    assert.equal(inputs[0].input.buttons.dash, false);
    return { ...world, tick: world.tick + 1 };
  });
  assert.equal(rooms.snapshot(room.roomId).state.tick, 1);
});

test("seed mismatch and room/client caps fail explicitly", () => {
  const rooms = new SimRoomRegistry({ maxRooms: 1, maxClientsPerRoom: 1 });
  const room = rooms.join({ sessionId: "s", locationId: "l", clientId: "c", seed: 9 });
  assert.throws(() => rooms.join({ sessionId: "s", locationId: "l", clientId: "other", seed: 9 }), /ROOM_PLAYER_CAPACITY_REACHED/);
  assert.throws(() => rooms.join({ sessionId: "s", locationId: "l", clientId: "c", seed: 10 }), /ROOM_SEED_MISMATCH/);
  assert.throws(() => rooms.join({ sessionId: "s", locationId: "another", clientId: "d", seed: 11 }), /ROOM_CAPACITY_REACHED/);
  assert.equal(rooms.metrics().roomsTotal, 1);
  assert.equal(room.seed, 9);
});

test("empty locations retain state for a grace period then are swept", () => {
  let clock = 0;
  const rooms = new SimRoomRegistry({ now: () => clock, idleRetentionMs: 500 });
  const room = rooms.join({ sessionId: "s", locationId: "far-sector", clientId: "c", seed: 22 });
  rooms.stepRoom(room.roomId, 0.05, (state) => ({ ...state, eventCounter: 3 }));
  rooms.leave({ roomId: room.roomId, clientId: "c" });
  clock = 499;
  assert.equal(rooms.sweep(), 0);
  assert.equal(rooms.snapshot(room.roomId).state.eventCounter, 3);
  clock = 500;
  assert.equal(rooms.sweep(), 1);
  assert.equal(rooms.snapshot(room.roomId), null);
});

test("invalid dt, oversized state and client movement between locations are rejected", () => {
  const rooms = new SimRoomRegistry({ maxRooms: 3, maxStateBytes: 1024 });
  const room = rooms.join({ sessionId: "s", locationId: "l1", clientId: "c", seed: 1 });
  assert.throws(() => rooms.stepRoom(room.roomId, 0.2, (state) => state), /dtSeconds/);
  assert.throws(() => rooms.stepRoom(room.roomId, 0.05, () => ({ data: "x".repeat(1100) })), /byte limit/);
  assert.throws(() => rooms.join({ sessionId: "s", locationId: "l2", clientId: "c", seed: 2 }), /CLIENT_ALREADY_JOINED_ANOTHER_LOCATION/);
  assert.throws(() => rooms.heartbeat({ roomId: room.roomId, clientId: "c" }), /ROOM/ === "x");
});
