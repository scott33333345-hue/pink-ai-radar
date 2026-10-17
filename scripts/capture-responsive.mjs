import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputDir = path.resolve("docs/step-14-responsive");
const profileDir = path.join(outputDir, ".edge-cdp-profile");
const port = 9333;
const sitePort = 4173;
const siteRoot = process.cwd();
const mimeTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".xml": "application/rss+xml", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

const server = createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url, `http://127.0.0.1:${sitePort}`).pathname;
    const relativePath = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath.slice(1));
    const filePath = path.resolve(siteRoot, relativePath);
    if (!filePath.startsWith(`${siteRoot}${path.sep}`) && filePath !== path.join(siteRoot, "index.html")) throw new Error("Invalid path");
    const body = await readFile(filePath);
    response.writeHead(200, { "Content-Type": `${mimeTypes[path.extname(filePath)] || "application/octet-stream"}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((resolve) => server.listen(sitePort, "127.0.0.1", resolve));

const cases = [
  { file: "01-desktop-home.png", width: 1440, height: 1400, url: `http://127.0.0.1:${sitePort}/?qa=step14-desktop-cdp` },
  { file: "02-tablet-home.png", width: 768, height: 1180, url: `http://127.0.0.1:${sitePort}/?qa=step14-tablet-cdp` },
  { file: "03-mobile-home.png", width: 390, height: 844, url: `http://127.0.0.1:${sitePort}/?qa=step14-mobile-cdp` },
  { file: "04-tablet-detail.png", width: 768, height: 1180, url: `http://127.0.0.1:${sitePort}/?news=9&qa=step14-tablet-detail-cdp` },
  { file: "05-mobile-detail.png", width: 390, height: 844, url: `http://127.0.0.1:${sitePort}/?news=9&qa=step14-mobile-detail-cdp` },
  { file: "06-mobile-analytics.png", width: 390, height: 844, url: `http://127.0.0.1:${sitePort}/?analytics=1&qa=step14-mobile-analytics-cdp` },
];

await mkdir(outputDir, { recursive: true });

const browser = spawn(edgePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let websocketUrl;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    websocketUrl = pages.find((page) => page.type === "page")?.webSocketDebuggerUrl;
    if (websocketUrl) break;
  } catch {}
  await sleep(250);
}

if (!websocketUrl) {
  browser.kill();
  throw new Error("Could not connect to the Edge debugging endpoint.");
}

const socket = new WebSocket(websocketUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

await command("Page.enable");
for (const capture of cases) {
  await command("Emulation.setDeviceMetricsOverride", {
    width: capture.width,
    height: capture.height,
    deviceScaleFactor: 1,
    mobile: capture.width <= 620,
  });
  await command("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await command("Page.navigate", { url: capture.url });
  await sleep(3000);
  const metrics = await command("Runtime.evaluate", {
    expression: `JSON.stringify((() => {
      const dialog = document.querySelector('dialog[open]');
      const layout = dialog?.querySelector('.article-layout, .analytics-panel');
      return {
        viewport: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
        dialog: dialog ? [dialog.clientWidth, dialog.scrollWidth, dialog.scrollLeft, Math.round(dialog.getBoundingClientRect().left), Math.round(dialog.getBoundingClientRect().right)] : null,
        layout: layout ? [layout.clientWidth, layout.scrollWidth, Math.round(layout.getBoundingClientRect().left), Math.round(layout.getBoundingClientRect().right)] : null,
        active: document.activeElement?.className || document.activeElement?.id || document.activeElement?.tagName,
      };
    })())`,
    returnByValue: true,
  });
  const result = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(outputDir, capture.file), Buffer.from(result.data, "base64"));
  process.stdout.write(`${capture.file} ${capture.width}x${capture.height} ${metrics.result.value}\n`);
}

await command("Browser.close");
socket.close();
server.close();
