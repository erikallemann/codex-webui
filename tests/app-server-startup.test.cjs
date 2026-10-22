const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const ts = require("typescript");

test("a Codex spawn error rejects initialization instead of hanging", async () => {
  const filename = path.resolve(__dirname, "..", "lib/codex/app-server.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  let child;
  Module._load = function (request, parent, isMain) {
    if (request === "./binary") {
      return { resolveCodexBinary: () => ({ command: "codex", argvPrefix: [] }) };
    }
    if (request === "node:child_process") {
      return {
        spawn: () => {
          child = new EventEmitter();
          child.stdin = new PassThrough();
          child.stdout = new PassThrough();
          child.stderr = new PassThrough();
          child.killed = false;
          child.kill = () => { child.killed = true; };
          return child;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  let AppServerConnection;
  try {
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded._compile(output, filename);
    AppServerConnection = loaded.exports.AppServerConnection;
  } finally {
    Module._load = originalLoad;
  }

  const connection = new AppServerConnection("/missing", new AbortController().signal);
  const initialization = connection.initialize();
  child.emit("error", new Error("spawn failed"));
  await assert.rejects(initialization, /spawn failed/);
  assert.deepEqual(await Array.fromAsync(connection.events()), []);
});
