const bar = document.getElementById('bar-fill');
const pctText = document.getElementById('progress-pct');
const loader = document.getElementById('loader');
const termLog = document.getElementById('term-log');

const startTime = Date.now();

function getTimestamp() {
    const ms = Date.now() - startTime;
    const seconds = (ms / 1000).toFixed(3);
    return `[+${seconds.padStart(5, '0')}s]`;
}

function addLog(tag, tagClass, message) {
    const lines = termLog.querySelectorAll('.log-line');
    lines.forEach(l => l.classList.remove('active'));
    // Remove cursor from previous lines
    lines.forEach(l => {
        const c = l.querySelector('.cursor');
        if(c) c.remove();
    });

    if (lines.length > 5) {
        // Keep max 6 lines visible given the height
        lines[0].remove();
    }

    const line = document.createElement('div');
    line.className = 'log-line active';
    const span = (cls, text) => {
        const el = document.createElement('span');
        if (cls) el.className = cls;
        if (text !== undefined) el.textContent = text;
        return el;
    };
    const msg = span(null, message + ' ');
    msg.appendChild(span('cursor'));
    line.append(span('timestamp', getTimestamp()), span('tag ' + tagClass, '[' + tag + ']'), ' ', msg);
    
    termLog.appendChild(line);
}

function setProgress(pct, tag, tagClass, msg) {
    bar.style.width = pct + '%';
    pctText.textContent = pct.toFixed(1) + '%';
    addLog(tag, tagClass, msg);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Start sequence
await sleep(400);
addLog('SYS', 'ok', 'Enforcing WebAssembly sandbox execution boundary...');
await sleep(600);

setProgress(12.4, 'NET', 'warn', 'Fetching Rust → Wasm binary payload (vhpc26.wasm)...');
await sleep(500);

// __ASSET_HASH__ is replaced at image build time with the content hash of the
// wasm build (see Dockerfile). Local dev: serve pkg/ under pkg/__ASSET_HASH__/.
const module = await import('./pkg/__ASSET_HASH__/vhpc26.js');

setProgress(34.2, 'MEM', 'warn', 'Allocating isolated linear memory for WASM runtime...');
await sleep(350);

setProgress(51.8, 'SYS', 'ok', 'WebAssembly module instantiated securely.');
await sleep(400);

setProgress(68.5, 'RENDER', 'warn', 'Bootstrapping Slint native compositing engine...');
await sleep(450);

setProgress(85.0, 'SYS', 'warn', 'Decoupling JavaScript UI thread. Handing over to Canvas/WebGL...');
try {
    await module.default();
} catch(e) {
    if (!e.message?.includes("don't mind me")) throw e;
}

setProgress(96.5, 'RENDER', 'ok', 'Interface layout mounted to isolated graphics context.');
await sleep(300);

setProgress(100.0, 'SYS', 'ok', 'Sandbox locked. Execution environment secured.');

// Remove the cursor from the final line after a brief moment to look cleaner
setTimeout(() => {
    const c = termLog.querySelector('.cursor');
    if (c) c.style.animation = 'none', c.style.opacity = '1';
}, 100);

await sleep(600);

// Let the actual canvas fade in as the sandbox unmounts
document.getElementById('canvas-wrapper').classList.add('visible');

await sleep(300);

loader.classList.add('fade-out');
setTimeout(() => loader.remove(), 1000); // Wait for the transition
