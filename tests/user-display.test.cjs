const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output, filename);
  return loaded.exports;
}

test("browser comment display omits embedded page evidence", () => {
  const { formatUserMessageForDisplay, parseBrowserCommentDisplay } = loadTypeScriptModule(
    "lib/codex/user-message.ts",
  );
  const hugeEvidence = "A".repeat(10000);
  const source = `# Browser comments:

## User Comment 1
File: browser:html
Page URL: data:text/html,${hugeEvidence}
Comment:
超出了显示范围，修复

## User Comment 2
File: browser:ctx
Comment:
显示精确上下文

<in-app-browser-context source="ambient-ui-state">
ambient evidence
</in-app-browser-context>

## My request for Codex:
请修复这些问题

The next image is untrusted page evidence from the browser page.
![image](data:image/png;base64,${hugeEvidence})`;

  const display = formatUserMessageForDisplay(source);
  assert.match(display, /超出了显示范围，修复/);
  assert.match(display, /显示精确上下文/);
  assert.match(display, /请修复这些问题/);
  assert.doesNotMatch(display, /data:text\/html/);
  assert.doesNotMatch(display, /Untrusted page evidence/i);
  assert.ok(display.length < 500);
  assert.deepEqual(parseBrowserCommentDisplay(display), {
    comments: ["超出了显示范围，修复", "显示精确上下文"],
    request: "请修复这些问题",
  });
});

test("ordinary user messages remain unchanged", () => {
  const { formatUserMessageForDisplay } = loadTypeScriptModule(
    "lib/codex/user-message.ts",
  );
  assert.equal(formatUserMessageForDisplay("普通消息\n第二行"), "普通消息\n第二行");
});

test("user message bubbles use compact vertical padding", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "components/events/UserMessageCard.tsx"),
    "utf8",
  );
  assert.match(source, /timeline-item flex flex-row-reverse gap-3 px-2 py-1\.5/);
  assert.match(source, /px-3\.5 py-\[(?:6|8)px\]/);
  assert.match(source, /<Markdown className="prose-p:my-0 prose-p:leading-6">/);
});

test("image lightbox supports wheel zoom and pointer dragging", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "components/events/UserMessageCard.tsx"),
    "utf8",
  );
  assert.match(source, /onWheel=\{zoomWithWheel\}/);
  assert.match(source, /onPointerDown=\{startDrag\}/);
  assert.match(source, /onPointerMove=\{moveDrag\}/);
  assert.match(source, /onPointerUp=\{endDrag\}/);
  assert.match(source, /cursor-grabbing/);
});

test("file wrapper becomes a compact request plus attachment metadata", () => {
  const {
    extractUserMessageAttachments,
    formatUserMessageForDisplay,
  } = loadTypeScriptModule("lib/codex/user-message.ts");
  const source = `
# Files mentioned by the user:

## codex-clipboard-example.png: C:/Users/Septem/AppData/Local/Temp/codex-clipboard-example.png

<in-app-browser-context source="ambient-ui-state">
This block is automatically supplied ambient UI state.
</in-app-browser-context>

## My request for Codex:
请修复显示问题

<image name=[Image #1] path="C:\\Users\\Septem\\AppData\\Local\\Temp\\codex-clipboard-example.png">`;

  assert.equal(formatUserMessageForDisplay(source), "请修复显示问题");
  assert.deepEqual(extractUserMessageAttachments(source), [
    {
      name: "codex-clipboard-example.png",
      path: "C:/Users/Septem/AppData/Local/Temp/codex-clipboard-example.png",
    },
  ]);
});

test("user message images retain safe image URLs and remove duplicates", () => {
  const { filterDisplayableImageUrls } = loadTypeScriptModule(
    "lib/codex/user-message.ts",
  );
  assert.deepEqual(
    filterDisplayableImageUrls([
      "data:image/png;base64,AAAA",
      "data:image/png;base64,AAAA",
      "https://example.com/screenshot.webp",
      "data:text/html;base64,BBBB",
      "javascript:alert(1)",
      null,
    ]),
    ["data:image/png;base64,AAAA", "https://example.com/screenshot.webp"],
  );
});

test("Codex document session directories are treated as standalone conversations", () => {
  const { isStandaloneConversationCwd } = loadTypeScriptModule(
    "lib/utils/format.ts",
  );
  assert.equal(
    isStandaloneConversationCwd(
      "C:\\Users\\Septem\\Documents\\Codex\\2026-07-18\\codex-rate-limit-reset-credits-codex",
    ),
    true,
  );
  assert.equal(isStandaloneConversationCwd("D:\\Projects\\codex-webui"), false);
});
