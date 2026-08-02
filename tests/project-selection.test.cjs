const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadProjectSelection() {
  const filename = path.resolve(__dirname, "..", "lib/session/project-selection.ts");
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

test("a project click resets an unrelated active session and targets the project default", () => {
  const { resolveProjectSelection } = loadProjectSelection();
  assert.deepEqual(
    resolveProjectSelection("tcs-session", ["mamba-session"]),
    { targetSessionId: null, resetSession: true },
  );
});
test("a project click keeps a session already belonging to that project", () => {
  const { resolveProjectSelection } = loadProjectSelection();
  assert.deepEqual(
    resolveProjectSelection("mamba-session", ["mamba-session"]),
    { targetSessionId: "mamba-session", resetSession: false },
  );
});
