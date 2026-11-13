const BASE = "http://127.0.0.1:5173";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(BASE + "/dashboard")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + " " + m.params.args.map((a) => a.value ?? a.description).join(" "));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return "ERR " + r.exceptionDetails.text; return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Network.setCookie", { name: "role", value: "operator", domain: "127.0.0.1", path: "/" });
await send("Page.navigate", { url: BASE + "/dashboard" });
await sleep(2500);
console.log("before:", await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root')?.innerHTML.length })`));
await ev(`[...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'Logout')?.click()`);
await sleep(500);
await ev(`[...document.querySelectorAll('[data-slot="alert-dialog-action"]')][0]?.click()`);
await sleep(2000);
console.log("after:", await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root')?.innerHTML.length, cookie: document.cookie })`));
console.log("LOGS:", logs.filter((l) => !l.startsWith("debug")).slice(-10));
ws.close();
