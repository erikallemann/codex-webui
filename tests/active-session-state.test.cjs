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
