const BASE = "http://127.0.0.1:5174";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
const t0 = Date.now();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) logs.push(`${Date.now()-t0}ms ` + m.params.args.map((a) => (a.value ?? a.description ?? "")).join("\n---\n").slice(0, 3000));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = async () => JSON.parse(await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root').childElementCount, inputs: document.querySelectorAll('form input').length, cookie: document.cookie })`));
await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
await send("Network.setCookie", { name: "role", value: "operator", domain: "127.0.0.1", path: "/" });
await send("Page.navigate", { url: BASE + "/dashboard" });
await sleep(5000);
console.log("dashboard:", await state());
await ev(`[...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'Logout')?.click()`);
await sleep(1000);
console.log("dialog open:", await ev(`document.body.innerText.includes('Are you sure')`));
await ev(`[...document.querySelectorAll('[data-slot="alert-dialog-action"]')].at(-1)?.click()`);
await sleep(6000);
console.log("after confirm:", await state());
for (const l of logs) console.log("=====\n" + l);
ws.close();
