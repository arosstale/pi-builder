/**
 * Pi Builder Desktop — Electron main process
 *
 * Starts the pi-builder WebSocket gateway on a free port,
 * then opens a BrowserWindow loading the web UI served from that gateway.
 *
 * When the window closes the gateway is stopped cleanly.
 */

import { app, BrowserWindow, shell, Menu, ipcMain } from 'electron'
import { join } from 'node:path'
import { createServer } from 'node:net'

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
      // preferred port busy — let OS assign one
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
let gateway: { stop(): Promise<void>; url: string } | null = null

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
    // Platform-specific chrome
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  })

  // Open external links in the user's default browser, not in Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the web UI served by the gateway
  await win.loadURL(`http://127.0.0.1:${port}/`)

  win.on('closed', () => { mainWindow = null })

  return win
}

// --------------------------------------------------------------------------
// App menu (minimal)
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
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// --------------------------------------------------------------------------
// IPC — expose gateway info to renderer
// --------------------------------------------------------------------------

ipcMain.handle('gateway:info', () => ({
  url: gateway?.url ?? null,
}))

// --------------------------------------------------------------------------
// Lifecycle
// --------------------------------------------------------------------------

app.whenReady().then(async () => {
  buildMenu()

  // Import gateway dynamically (CJS-compatible path from dist)
  const port = await findFreePort(18900)

  try {
    // Try to import the compiled core package
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startGateway } = require('@pi-builder/core')
    gateway = await startGateway({
      port,
      host: '127.0.0.1',
      orchestrator: {
        workDir: process.cwd(),
        dbPath: join(app.getPath('userData'), 'pi-builder.db'),
      },
    })
    console.log(`✅ Gateway started: ${gateway!.url}`)
  } catch (err) {
    console.error('Gateway failed to start:', err)
    // Still open the window — it will show a "not connected" state
  }

  mainWindow = await createWindow(port)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow(port)
    }
  })
})

app.on('window-all-closed', async () => {
  if (gateway) {
    try { await gateway.stop() } catch { /* ignore */ }
    gateway = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  if (gateway) {
    try { await gateway.stop() } catch { /* ignore */ }
    gateway = null
  }
})
