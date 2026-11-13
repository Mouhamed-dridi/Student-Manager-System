const BASE = "http://127.0.0.1:5174";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(BASE + "/login")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type !== "debug") logs.push(m.params.type + " " + m.params.args.map((a) => (a.description ?? a.value ?? "")).join(" || ").slice(0, 800));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.value; };
await send("Runtime.enable");
for (const ms of [1000, 2000, 3000]) {
  await new Promise((r) => setTimeout(r, ms === 1000 ? 1000 : 1000));
  console.log(ms + "ms:", await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root')?.innerHTML.length, inputs: document.querySelectorAll('input').length })`));
}
console.log("LOGS:", logs.slice(-6));
ws.close();
