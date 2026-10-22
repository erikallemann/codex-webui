const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const filename = path.resolve(__dirname, "..", "lib/session/scroll-follow.ts");
const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: filename,
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(output, filename);
const { shouldFollowScroll } = loaded.exports;

test("content growth does not stop following when the scroll position stays put", () => {
  assert.equal(shouldFollowScroll(true, 500, 500, 180), true);
});

test("scrolling upward pauses following and reaching the bottom resumes it", () => {
  assert.equal(shouldFollowScroll(true, 500, 420, 180), false);
  assert.equal(shouldFollowScroll(false, 420, 480, 120), false);
  assert.equal(shouldFollowScroll(false, 480, 500, 80), true);
});
