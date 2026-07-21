import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");

const URL = process.env.AUDIT_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.AUDIT_OUT ?? "/tmp/nudge-landing-audit";
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const allViewports = [
  [320, 568],
  [360, 800],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [568, 320],
  [844, 390],
];
const requestedViewport = process.env.AUDIT_VIEWPORT?.split("x").map(Number);
const viewports = requestedViewport?.length === 2 ? [requestedViewport] : allViewports;

const sections = [
  ["hero", "#hero"],
  ["night", "#night-shift"],
  ["features", "#features"],
  ["industries", "#industries"],
  ["compare", "#compare"],
  ["final", "#get-access"],
  ["footer", "#site-footer"],
];

await fs.mkdir(OUT, { recursive: true });

const debugPort = 9333;
const chromeProfile = await fs.mkdtemp(path.join(os.tmpdir(), "nudge-audit-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--no-sandbox",
    "--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfile}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function waitForDebugger() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome debugging endpoint did not become ready");
}

await waitForDebugger();
const target = await fetch(
  `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`,
  { method: "PUT" }
).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.once("open", resolve);
  socket.once("error", reject);
});

let requestId = 0;
const pending = new Map();
const listeners = new Map();
socket.on("message", (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
    return;
  }
  for (const listener of listeners.get(message.method) ?? []) listener(message.params);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function once(method) {
  return new Promise((resolve) => {
    const handler = (params) => {
      listeners.set(method, (listeners.get(method) ?? []).filter((item) => item !== handler));
      resolve(params);
    };
    listeners.set(method, [...(listeners.get(method) ?? []), handler]);
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

let networkIssues = [];
listeners.set("Network.responseReceived", [({ response }) => {
  if (response.status >= 400) networkIssues.push({ status: response.status, url: response.url });
}]);
listeners.set("Network.loadingFailed", [({ errorText, canceled, type }) => {
  if (!canceled) networkIssues.push({ errorText, type });
}]);

const report = [];

for (const [width, height] of viewports) {
  networkIssues = [];
  const consoleErrors = [];
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: width < 1024,
    maxTouchPoints: width < 1024 ? 5 : 1,
  });
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: URL });
  await loaded;
  const hydrated = await evaluate(`new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const button = document.querySelector('button[aria-label="Open menu"]');
      const hydrated = button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
      if (hydrated || Date.now() - started > 10000) resolve(Boolean(hydrated));
      else setTimeout(check, 100);
    };
    check();
  })`);

  const heroShot = await send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(`${OUT}/${width}x${height}-hero.png`, heroShot.data, "base64");

  const motionNightY = await evaluate(`(() => {
    const track = document.querySelector("#night-shift");
    if (!track) return null;
    const top = track.getBoundingClientRect().top + window.scrollY;
    return top + Math.max(0, track.scrollHeight - window.innerHeight) * 0.08;
  })()`);
  if (motionNightY !== null) {
    await evaluate(`(() => {
      const y = ${JSON.stringify(motionNightY)};
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const motionShot = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(`${OUT}/${width}x${height}-motion-night.png`, motionShot.data, "base64");
  }

  await evaluate(`(() => {
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  })()`);

  let menu = null;
  if (width < 1024) {
    const menuPoint = await evaluate(`(() => {
      const button = document.querySelector('button[aria-label="Open menu"]');
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (menuPoint) {
      await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...menuPoint });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...menuPoint });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    menu = await evaluate(`(() => ({
      triggerFound: ${JSON.stringify(Boolean(menuPoint))},
      opened: Boolean(document.querySelector('[role="dialog"][aria-label="Site navigation"]')),
      bodyLocked: document.body.style.overflow === "hidden"
    }))()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 350));
    menu.closedWithEscape = await evaluate(
      `!document.querySelector('[role="dialog"][aria-label="Site navigation"]') && document.body.style.overflow !== "hidden"`
    );
  }

  const accessPoint = await evaluate(`(() => {
    const trigger = [...document.querySelectorAll("#hero button")].find(
      (button) => button.textContent?.trim() === "Get Access"
    );
    if (!trigger) return null;
    const rect = trigger.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (accessPoint) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...accessPoint });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...accessPoint });
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  const accessModal = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Get access"]');
    if (!dialog) return { triggerFound: ${JSON.stringify(Boolean(accessPoint))}, opened: false };
    const rect = dialog.firstElementChild?.getBoundingClientRect();
    return {
      opened: true,
      triggerFound: ${JSON.stringify(Boolean(accessPoint))},
      bodyLocked: document.body.style.overflow === "hidden",
      activeField: document.activeElement?.getAttribute("name"),
      cardTop: rect ? Math.round(rect.top) : null,
      cardBottom: rect ? Math.round(rect.bottom) : null,
      overlayScrollable: dialog.scrollHeight > dialog.clientHeight
    };
  })()`);
  if (width === 320 && accessModal.opened) {
    const modalShot = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(`${OUT}/${width}x${height}-access-modal.png`, modalShot.data, "base64");
  }
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  accessModal.closedWithEscape = await evaluate(
    `!document.querySelector('[role="dialog"][aria-label="Get access"]') && document.body.style.overflow !== "hidden"`
  );

  await evaluate(`(() => {
    document.documentElement.classList.remove("jsm");
    window.__lenis?.destroy?.();
    document.documentElement.style.scrollBehavior = "auto";
  })()`);

  const metrics = await evaluate(`(() => {
    const root = document.documentElement;
    const viewportWidth = root.clientWidth;
    const visible = [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    const outside = visible
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === "string" ? element.className.slice(0, 160) : "",
          text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -1 || item.right > viewportWidth + 1)
      .slice(0, 30);

    const smallTargets = visible
      .filter((element) => element.matches("a, button, input, select, textarea, [role='button']"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute("aria-label") ?? element.textContent?.trim().replace(/\s+/g, " ").slice(0, 50) ?? "",
          tag: element.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.width < 44 || item.height < 44)
      .slice(0, 50);

    return {
      viewportWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      outside,
      smallTargets,
    };
  })()`);

  for (const [name, selector] of sections) {
    const found = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return false;
      node.scrollIntoView({ block: "start" });
      return true;
    })()`);
    if (!found) continue;
    await new Promise((resolve) => setTimeout(resolve, 120));
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(`${OUT}/${width}x${height}-${name}.png`, screenshot.data, "base64");
  }

  report.push({ width, height, hydrated, consoleErrors, networkIssues, menu, accessModal, ...metrics });
}

await fs.writeFile(`${OUT}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
await send("Browser.close");
socket.close();
chrome.kill();

console.log(
  JSON.stringify(
    report.map(({ width, height, hydrated, consoleErrors, networkIssues, menu, accessModal, viewportWidth, scrollWidth, smallTargets }) => ({
      size: `${width}x${height}`,
      hydrated,
      overflow: scrollWidth - viewportWidth,
      consoleErrors: consoleErrors.length,
      networkIssues: networkIssues.length,
      menu,
      accessModal,
      smallTargets: smallTargets.length,
    })),
    null,
    2
  )
);
