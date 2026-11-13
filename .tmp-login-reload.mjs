const BASE = "http://127.0.0.1:5174";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + " " + m.params.args.map((a) => (a.description ?? a.value ?? "")).join(" || ").slice(0, 1500));
  if (m.method === "Log.entryAdded") logs.push("LOG " + m.params.entry.level + " " + m.params.entry.text.slice(0, 500));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.value; };
await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
await send("Page.navigate", { url: BASE + "/login" });
await new Promise((r) => setTimeout(r, 5000));
console.log(await ev(`JSON.stringify({ path: location.pathname, rootChildren: document.getElementById('root')?.childElementCount, bodyChildren: document.body.childElementCount, forms: document.querySelectorAll('form').length, text: document.body.innerText.slice(0,200) })`));
console.log("LOGS:"); for (const l of logs) if (!l.startsWith("debug")) console.log("-", l);
ws.close();
