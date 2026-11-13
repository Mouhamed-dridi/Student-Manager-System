const BASE = "http://127.0.0.1:5174";
const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") logs.push("EXC " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("error " + m.params.args.map((a) => (a.description ?? a.value ?? "")).join(" || ").slice(0, 500));
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
await send("Network.setCookie", { name: "role", value: "operator", domain: "127.0.0.1", path: "/" });
await send("Page.navigate", { url: BASE + "/dashboard" });
await sleep(4000);
console.log("dashboard:", await ev(`JSON.stringify({ path: location.pathname, root: document.getElementById('root').childElementCount })`));
await ev(`[...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'Logout')?.click()`);
await sleep(4000);
console.log("after direct logout:", await ev(`JSON.stringify({ path: location.pathname, cookie: document.cookie, root: document.getElementById('root').childElementCount, inputs: document.querySelectorAll('form input').length, text: document.body.innerText.slice(0,80) })`));
console.log("ERRORS:", logs.slice(-4));
ws.close();
