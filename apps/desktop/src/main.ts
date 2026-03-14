/**
 * Pi Builder Desktop — Electron main process
 *
 * Spawns the pi-builder gateway (bun) as a child process on a free port,
 * then opens a BrowserWindow at http://127.0.0.1:{port}/.
 *
 * Using a subprocess avoids the CJS/ESM mismatch: Electron's main process
 * is CommonJS, but @pi-builder/core is pure ESM. bun handles it natively.
 */

import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { spawn, ChildProcess } from 'node:child_process'

// --------------------------------------------------------------------------
// Find a free TCP port
// --------------------------------------------------------------------------

function findFreePort(preferred = 18900): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(preferred, '127.0.0.1', () => {
      const addr = srv.address() as { port: number }
      srv.close(() => resolve(addr.port))
    })
    srv.on('error', () => {
      const fallback = createServer()
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address() as { port: number }
        fallback.close(() => resolve(addr.port))
      })
      fallback.on('error', reject)
    })
  })
}

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null
let gatewayProc: ChildProcess | null = null
let gatewayPort = 18900

// --------------------------------------------------------------------------
// Start gateway subprocess
// --------------------------------------------------------------------------

function startGatewayProcess(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Find the repo root (apps/desktop/dist/main.js → ../../..)
    const repoRoot = join(__dirname, '..', '..', '..')
    const cliEntry = join(repoRoot, 'apps', 'cli', 'src', 'cli.ts')
    const dbPath = join(app.getPath('userData'), 'pi-builder.db')

    // bun handles ESM workspace packages natively.
    // Electron strips PATH so we resolve bun's absolute path explicitly.
    const bunBin = process.platform === 'win32'
      ? join(process.env.USERPROFILE ?? 'C:\\Users\\Default', '.bun', 'bin', 'bun.exe')
      : join(process.env.HOME ?? '/home/user', '.bun', 'bin', 'bun')
    gatewayProc = spawn(bunBin, ['run', cliEntry, 'start', '--port', String(port), '--db', dbPath], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let resolved = false

    gatewayProc.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      console.log('[gateway]', line.trim())
      // Gateway prints "🚀 Pi Builder Gateway listening" when ready
      if (!resolved && line.includes('Gateway listening')) {
        resolved = true
        resolve()
      }
    })

    gatewayProc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[gateway stderr]', chunk.toString().trim())
    })

    gatewayProc.on('error', (err) => {
      if (!resolved) { resolved = true; reject(err) }
    })

    gatewayProc.on('exit', (code) => {
      console.log('[gateway] exited with code', code)
      if (!resolved) { resolved = true; reject(new Error(`Gateway exited early: ${code}`)) }
    })

    // Timeout after 15s
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('Gateway startup timeout'))
      }
    }, 15_000)
  })
}

function stopGateway(): void {
  if (gatewayProc) {
    try { gatewayProc.kill('SIGTERM') } catch { /* ignore */ }
    gatewayProc = null
  }
}

// --------------------------------------------------------------------------
// Main window
// --------------------------------------------------------------------------

async function createWindow(port: number): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: 'Pi Builder',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  await win.loadURL(`http://127.0.0.1:${port}/`)
  win.on('closed', () => { mainWindow = null })
  return win
}

// --------------------------------------------------------------------------
// App menu
// --------------------------------------------------------------------------

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const }, { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const }, { role: 'copy' as const },
        { role: 'paste' as const }, { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const }, { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const }, { role: 'zoomIn' as const }, { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const }, { role: 'zoom' as const },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// --------------------------------------------------------------------------
// IPC
// --------------------------------------------------------------------------

ipcMain.handle('gateway:info', () => ({
  url: `ws://127.0.0.1:${gatewayPort}`,
  port: gatewayPort,
}))

// --------------------------------------------------------------------------
// Lifecycle
// --------------------------------------------------------------------------

app.whenReady().then(async () => {
  buildMenu()

  gatewayPort = await findFreePort(18900)

  try {
    await startGatewayProcess(gatewayPort)
    console.log(`✅ Gateway ready on port ${gatewayPort}`)
  } catch (err) {
    console.error('Gateway failed to start:', err)
    // Still open window — will show disconnected state, user can reconnect
  }

  mainWindow = await createWindow(gatewayPort)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow(gatewayPort)
    }
  })
})

app.on('window-all-closed', () => {
  stopGateway()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopGateway()
})
