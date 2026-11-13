// Temporary verification script (deleted after the check).
const BASE = "http://127.0.0.1:5174";
async function json(path, method = "GET") {
  const res = await fetch(`http://127.0.0.1:9222${path}`, { method });
  return res.json();
}
const target = await json(`/json/new?${encodeURIComponent(BASE + "/dashboard")}`, "PUT");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
});
await new Promise((resolve) => ws.addEventListener("open", resolve));
function send(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => pending.set(msgId, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result))));
}
async function ev(expression) {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expression, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await ev(expression)) return;
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${label}`);
}
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); };

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Network.setCookie", { name: "role", value: "operator", domain: "127.0.0.1", path: "/" });
await send("Page.navigate", { url: BASE + "/dashboard" });
await waitFor(`!!document.querySelector('header') && [...document.querySelectorAll('header button')].some((b) => b.textContent.trim() === 'Logout')`, "header logout button");

const click = (label) => ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '${label}')?.click()`);

// Opening the dialog must not sign out.
await click("Logout");
await waitFor(`document.body.innerText.includes('Are you sure you want to sign out of your session?')`, "logout dialog");
const styles = JSON.parse(await ev(`(() => {
  const dialog = document.querySelector('[data-slot="alert-dialog-content"]');
  const primary = document.querySelector('[data-slot="alert-dialog-action"]');
  const cancel = document.querySelector('[data-slot="alert-dialog-cancel"]');
  return JSON.stringify({
    title: dialog.querySelector('[data-slot="alert-dialog-title"]')?.textContent,
    dialogClasses: dialog.className,
    primaryClasses: primary.className,
    cancelClasses: cancel.className,
    roleCookie: document.cookie.includes('role=operator'),
    path: location.pathname,
  });
})()`));
check(
  "dialog opens with monochrome zinc-950 surface and white primary",
  styles.dialogClasses.includes("bg-zinc-950") &&
    styles.dialogClasses.includes("border-zinc-800") &&
    styles.primaryClasses.includes("bg-white") &&
    styles.primaryClasses.includes("text-black") &&
    !styles.dialogClasses.includes("green") &&
    !styles.primaryClasses.includes("green"),
  `title "${styles.title}"`,
);
check("opening the dialog does not clear the session", styles.roleCookie && styles.path === "/dashboard", `path ${styles.path}`);

// Cancel closes and keeps the session.
await click("Cancel");
await sleep(500);
check(
  "Cancel closes without signing out",
  !(await ev(`document.body.innerText.includes('Are you sure you want to sign out')`)) && (await ev(`document.cookie.includes('role=operator')`)) && (await ev(`location.pathname`)) === "/dashboard",
  `path ${await ev(`location.pathname`)}`,
);

// Confirm signs out and redirects to login.
await click("Logout");
await waitFor(`document.body.innerText.includes('Are you sure you want to sign out of your session?')`, "dialog again");
await click("Sign out");
await waitFor(`location.pathname === '/login' && document.querySelectorAll('input').length >= 2`, "login redirect/rendered form");
check(
  "Sign out clears the session and redirects to /login",
  !(await ev(`document.cookie.includes('role=operator')`)) && (await ev(`document.body.innerText.includes('Sign in') || document.body.innerText.includes('Login') || !!document.querySelector('input')`)),
  `path ${await ev(`location.pathname`)}`,
);

console.log("RUNTIME_ERRORS:", errors.length ? errors : "none");
console.log("RESULT:", results.every(Boolean) ? "ALL PASS" : "FAILURES");
ws.close();
process.exit(results.every(Boolean) ? 0 : 1);
