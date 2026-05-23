import { app, BrowserWindow, Menu } from 'electron';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const ADDRESS_BAR_CSS = `
#solid-desktop-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #7C3AED 0%, #2563EB 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
#solid-desktop-nav label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
}
#solid-desktop-uri {
  flex: 1;
  min-width: 280px;
  padding: 10px 16px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  color: white;
  outline: none;
  transition: all 0.2s ease;
}
#solid-desktop-uri::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
#solid-desktop-uri:focus {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
}
#solid-desktop-go {
  padding: 10px 20px;
  background: white;
  color: #7C3AED;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}
#solid-desktop-go:hover {
  background: #f8f8f8;
  transform: translateY(-1px);
}
`;

let config = { port: 3011, width: 1200, height: 800, root: './data' };
try {
  config = { ...config, ...JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8')) };
} catch {
  console.log('Using default config');
}

const PORT = config.port;
const ROOT = resolve(__dirname, config.root);
const POD_URL = `http://localhost:${PORT}/`;

let mainWindow;
let jspodProc;

// Resolve the jspod CLI script from the installed package so we don't
// depend on PATH or .bin symlinks (which can be wrong inside an Electron
// app bundle). jspod's package.json sets `main: index.js`, so resolving
// the package entry gives us the script to hand to node.
function resolveJspodScript() {
  return require.resolve('jspod');
}

async function waitForReady(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1000);
      await fetch(url, { signal: ac.signal, redirect: 'manual' });
      clearTimeout(t);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return false;
}

function startJspod() {
  // Electron sets ELECTRON_RUN_AS_NODE=1 so process.execPath behaves as
  // plain node when invoked with this env. Without it, spawning execPath
  // would launch another full Electron app.
  jspodProc = spawn(
    process.execPath,
    [resolveJspodScript(), '--no-open', '--port', String(PORT), '--root', ROOT],
    {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    }
  );

  jspodProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`jspod exited with code ${code}`);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.width || 1200,
    height: config.height || 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Solid Desktop',
      submenu: [
        { label: 'Home', click: () => mainWindow.loadURL(POD_URL) },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.loadURL(POD_URL);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(ADDRESS_BAR_CSS);
    mainWindow.webContents.executeJavaScript(`
      if (!document.getElementById('solid-desktop-nav')) {
        const nav = document.createElement('div');
        nav.id = 'solid-desktop-nav';
        nav.innerHTML = \`
          <label>Visiting</label>
          <input type="text" id="solid-desktop-uri" placeholder="Enter a Solid URI..." value="\${window.location.href}" />
          <button id="solid-desktop-go">Go</button>
        \`;
        document.body.insertBefore(nav, document.body.firstChild);

        const uriInput = document.getElementById('solid-desktop-uri');
        const goBtn = document.getElementById('solid-desktop-go');

        goBtn.addEventListener('click', () => {
          window.location.href = uriInput.value;
        });

        uriInput.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') window.location.href = uriInput.value;
        });
      }
    `);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  startJspod();
  const ok = await waitForReady(POD_URL);
  if (!ok) {
    console.error(`jspod did not become ready at ${POD_URL} within 30s`);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (jspodProc && !jspodProc.killed) {
    jspodProc.kill('SIGTERM');
  }
});
