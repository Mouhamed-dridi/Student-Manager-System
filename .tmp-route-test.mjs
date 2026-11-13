const BASE = "http://127.0.0.1:5174";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
const t0 = Date.now();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push(`${Date.now()-t0}ms ` + m.params.args.map((a) => (a.description ?? a.value ?? "")).join(" || ").slice(0, 300));
  if (m.method === "Runtime.exceptionThrown") logs.push(`${Date.now()-t0}ms EXC ` + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = async () => JSON.parse(await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root').childElementCount, inputs: document.querySelectorAll('form input').length })`));
await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
await send("Network.setCookie", { name: "role", value: "operator", domain: "127.0.0.1", path: "/" });
await send("Page.navigate", { url: BASE + "/dashboard" });
await sleep(5000);
console.log(`[${Date.now()-t0}ms] dashboard:`, await state(), "logs:", logs);
// Clear the cookie and ask React Router to render /login without the logout handler.
await ev(`document.cookie = 'role=; path=/; max-age=0'; history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate'))`);
await sleep(5000);
console.log(`[${Date.now()-t0}ms] after route change:`, await state(), "logs:", logs);
ws.close();
