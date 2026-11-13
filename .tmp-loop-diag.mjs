const BASE = "http://127.0.0.1:5173";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(BASE + "/dashboard")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + JSON.stringify(m.params.exceptionDetails, null, 1).slice(0, 2000));
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + " " + m.params.args.map((a) => a.value ?? a.description ?? JSON.stringify(a.preview)).join(" | "));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Network.setCookie", { name: "role", value: "operator", domain: "127.0.0.1", path: "/" });
await send("Page.navigate", { url: BASE + "/dashboard" });
await sleep(3000);
console.log("state:", await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root')?.innerHTML.length })`));
for (const log of logs.filter((l) => l.startsWith("error") || l.startsWith("EXC"))) console.log("----\n" + log.slice(0, 4000));
ws.close();
