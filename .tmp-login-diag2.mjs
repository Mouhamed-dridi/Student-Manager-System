const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
for (const t of targets.filter((x) => x.type === "page" && x.url.includes("5174"))) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  await new Promise((r) => ws.addEventListener("open", r));
  const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pending.set(i, (m) => m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))); };
  const r = await send("Runtime.evaluate", { expression: `JSON.stringify({ path: location.pathname, root: document.getElementById('root')?.innerHTML.length, inputs: document.querySelectorAll('input').length, buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0,8), text: document.body.innerText.slice(0, 200), cookie: document.cookie })`, returnByValue: true });
  console.log(r.result.value);
  ws.close();
}
