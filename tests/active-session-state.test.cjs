const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadStateMachine() {
  const filename = path.resolve(__dirname, "..", "lib/session/active-session-state.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output, filename);
  return loaded.exports;
}

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output, filename);
  return loaded.exports;
}

const usage = {
  input_tokens: 10,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 4,
  reasoning_output_tokens: 0,
};

function event(reducer, state, value) {
  return reducer(state, { type: "EVENT", event: value });
}

test("execution enters running before the server responds", () => {
  const { initialState, reducer } = loadStateMachine();
  const state = reducer(initialState, { type: "START_EXECUTION", resumeSessionId: null });

  assert.equal(state.status, "running");
  assert.equal(state.timeline.length, 0);
});
test("resuming a session keeps prior turns while the next turn starts", () => {
  const { initialState, reducer } = loadStateMachine();
  let state = reducer(initialState, { type: "START_REPLAY" });
  state = reducer(state, { type: "SET_RESUME", sessionId: "session-1" });
  state = event(reducer, state, {
    type: "session.meta",
    meta: {
      session_id: "session-1",
      id: "session-1",
      timestamp: "2026-08-02T00:00:00.000Z",
      cwd: "D:\\Projects\\demo",
    },
  });
  state = event(reducer, state, { type: "turn.started", startedAt: 1 });
  state = event(reducer, state, {
    type: "item.completed",
    item: { id: "user-1", type: "user_message", text: "first" },
  });
  state = event(reducer, state, {
    type: "item.completed",
    item: { id: "agent-1", type: "agent_message", text: "reply" },
  });
  state = event(reducer, state, { type: "turn.completed", usage });
  const historyLength = state.timeline.length;

  state = reducer(state, {
    type: "START_EXECUTION",
    resumeSessionId: "session-1",
  });

  assert.equal(state.status, "running");
  assert.equal(state.isReplay, false);
  assert.equal(state.resumeSessionId, "session-1");
  assert.equal(state.timeline.length, historyLength);

  state = event(reducer, state, { type: "turn.started", startedAt: 2 });
  assert.equal(state.timeline.length, historyLength + 1);
  assert.equal(state.timeline[0].kind, "turn");
  assert.equal(state.timeline[0].status, "completed");
});

test("a submitted prompt is visible before the live stream returns its user item", () => {
  const { initialState, reducer } = loadStateMachine();
  let state = reducer(initialState, { type: "START_REPLAY" });
  state = event(reducer, state, {
    type: "item.completed",
    item: { id: "user-1", type: "user_message", text: "earlier prompt" },
  });
  state = event(reducer, state, {
    type: "item.completed",
    item: { id: "agent-1", type: "agent_message", text: "earlier reply" },
  });

  state = reducer(state, {
    type: "ADD_PENDING_USER_MESSAGE",
    item: { id: "pending-user-2", type: "user_message", text: "new prompt" },
  });

  assert.equal(state.timeline.length, 3);
  assert.deepEqual(state.timeline.at(-1), {
    kind: "item",
    id: "pending-user-2",
    item: { id: "pending-user-2", type: "user_message", text: "new prompt" },
    timestamp: undefined,
    pendingUserMessage: true,
  });
});

test("a live user item reconciles its matching pending message instead of duplicating it", () => {
  const { initialState, reducer } = loadStateMachine();
  let state = reducer(initialState, {
    type: "ADD_PENDING_USER_MESSAGE",
    item: { id: "pending-user-1", type: "user_message", text: "new prompt" },
  });

  state = event(reducer, state, {
    type: "item.completed",
    item: { id: "server-user-1", type: "user_message", text: "new prompt" },
    timestamp: "2026-08-02T00:00:00.000Z",
  });

  assert.equal(state.timeline.length, 1);
  assert.deepEqual(state.timeline[0], {
    kind: "item",
    id: "server-user-1",
    item: { id: "server-user-1", type: "user_message", text: "new prompt" },
    timestamp: "2026-08-02T00:00:00.000Z",
  });
});

test("a completed replay closes unmatched running turns", () => {
  const { initialState, reducer } = loadStateMachine();
  let state = reducer(initialState, { type: "START_REPLAY" });
  state = event(reducer, state, { type: "turn.started", startedAt: 123 });

  state = reducer(state, { type: "FINISH_REPLAY" });

  assert.equal(state.status, "completed");
  assert.equal(state.timeline[0].kind, "turn");
  assert.equal(state.timeline[0].status, "completed");
});

test("execution failures appear as timeline cards beside the submitted prompt", () => {
  const { initialState, reducer } = loadStateMachine();
  let state = reducer(initialState, { type: "START_EXECUTION", resumeSessionId: null });
  state = reducer(state, {
    type: "ADD_PENDING_USER_MESSAGE",
    item: { id: "prompt-1", type: "user_message", text: "hello" },
  });
  state = event(reducer, state, {
    type: "error",
    message: "app-server startup failed",
    stderr: "spawn failed",
  });

  assert.equal(state.status, "failed");
  assert.equal(state.timeline.length, 2);
  assert.deepEqual(state.timeline[1].item, {
    id: state.timeline[1].id,
    type: "error",
    message: "app-server startup failed\nspawn failed",
    severity: undefined,
  });
});

test("global rate limits survive session switches and ignore historical replay snapshots", () => {
  const { initialState, reducer } = loadStateMachine();
  const liveRateLimits = { primary: { used_percent: 42, window_duration_mins: 300 } };
  const historicalRateLimits = { primary: { used_percent: 16, window_duration_mins: 300 } };
  let state = event(reducer, initialState, {
    type: "rate_limits.updated",
    rateLimits: liveRateLimits,
  });

  state = reducer(state, { type: "START_REPLAY" });
  assert.deepEqual(state.rateLimits, liveRateLimits);

  state = event(reducer, state, {
    type: "usage.updated",
    snapshot: { contextTokens: 123, rateLimits: historicalRateLimits },
  });
  assert.equal(state.contextTokens, 123);
  assert.deepEqual(state.rateLimits, liveRateLimits);

  state = reducer(state, { type: "START_EXECUTION", resumeSessionId: null });
  assert.deepEqual(state.rateLimits, liveRateLimits);
});

test("global rate limits are restored after a page reload", () => {
  const { loadCachedRateLimits, saveCachedRateLimits } = loadTypeScriptModule(
    "lib/session/global-rate-limits.ts",
  );
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const rateLimits = { primary: { used_percent: 42, window_duration_mins: 300 } };

  saveCachedRateLimits(storage, rateLimits);
  assert.deepEqual(loadCachedRateLimits(storage), rateLimits);
});
