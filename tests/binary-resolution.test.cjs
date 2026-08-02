const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadBinary(spawnCalls) {
  const filename = path.resolve(__dirname, "..", "lib/codex/binary.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "node:fs") return { existsSync: () => false };
    if (request === "node:child_process") {
      return {
        spawnSync(command, args, options) {
          spawnCalls.push({ command, args, options });
          return { error: new Error("not found"), status: 1, stdout: "" };
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded._compile(output, filename);
    return loaded.exports;
  } finally {
    Module._load = originalLoad;
  }
}

test("Windows binary discovery does not invoke npm or where through a shell", { skip: process.platform !== "win32" }, () => {
  const originalBin = process.env.CODEX_BIN;
  const originalJs = process.env.CODEX_JS;
  delete process.env.CODEX_BIN;
  delete process.env.CODEX_JS;

  try {
    const spawnCalls = [];
    const binary = loadBinary(spawnCalls);
    binary._clearCache();
    assert.throws(() => binary.resolveCodexBinary(), /codex executable not found/);
    assert.equal(spawnCalls.some((call) => call.options.shell === true), false);
    assert.equal(spawnCalls.some((call) => call.command === "npm"), false);
  } finally {
    if (originalBin === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = originalBin;
    if (originalJs === undefined) delete process.env.CODEX_JS;
    else process.env.CODEX_JS = originalJs;
  }
});
