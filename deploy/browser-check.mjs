// Oracle: load the site in headless Chrome and exit 0 iff the Slint app
// boots and paints under the served CSP with no CSP violations or JS errors.
// Usage: node deploy/browser-check.mjs http://127.0.0.1:18080 [screenshot.png]
// Dependency-free: Node >= 22 (global WebSocket) + a local Chrome.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:18080';
const shot = process.argv[3];
const chrome = process.env.CHROME ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'vhpc-cdp-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1200,800', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const problems = [];
let exitCode = 1;
try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(t => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      const text = d.exception?.description ?? d.text;
      // winit's intentional control-flow exception on the web backend.
      if (!/don't mind me/.test(text)) problems.push(`exception: ${text}`);
    }
    if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      if (e.level === 'error' && !/favicon/.test(e.url ?? '')) problems.push(`log[${e.source}]: ${e.text}`);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      const t = m.params.args.map(a => a.value ?? a.description).join(' ');
      if (!/don't mind me/.test(t)) problems.push(`console.error: ${t}`);
    }
  };
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expr =>
    (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  // Record CSP violations from document start.
  await send('Page.addScriptToEvaluateOnNewDocument', { source:
    `window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));` });
  await send('Page.navigate', { url });

  let visible = false;
  for (let i = 0; i < 100 && !visible; i++) {
    await sleep(200);
    visible = await evaluate(`document.getElementById('canvas-wrapper')?.classList.contains('visible') === true`);
  }
  if (!visible) problems.push('canvas never became visible (boot sequence did not finish)');
  await sleep(1500);

  const csp = await evaluate('window.__csp');
  for (const v of csp ?? []) problems.push(`CSP violation: ${v}`);
  const canvas = await evaluate(`(() => { const c = document.getElementById('canvas'); return c ? [c.width, c.height] : null; })()`);
  if (!canvas || canvas[0] < 300 || canvas[1] < 200) problems.push(`canvas not sized: ${JSON.stringify(canvas)}`);

  const pic = await send('Page.captureScreenshot', { format: 'png' });
  const png = Buffer.from(pic.result.data, 'base64');
  if (shot) writeFileSync(shot, png);
  // A blank/black page compresses to a tiny PNG; a rendered UI does not.
  if (png.length < 20000) problems.push(`screenshot looks blank (${png.length} bytes)`);

  console.log(`canvas=${JSON.stringify(canvas)} screenshot=${png.length}B csp_violations=${csp?.length ?? '?'}`);
  ws.close();
  exitCode = problems.length ? 1 : 0;
} catch (e) {
  problems.push(String(e));
} finally {
  for (const p of problems) console.log('FAIL - ' + p);
  if (!problems.length) console.log('ok   - app booted under CSP with no violations/errors');
  proc.kill('SIGKILL');
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(exitCode);
}
