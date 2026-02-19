/**
 * Preload script — runs in an isolated context before the renderer page loads.
 * Exposes a minimal, safe API to the web UI via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('piBuilderDesktop', {
  /** Returns gateway info: { url: string | null } */
  gatewayInfo: (): Promise<{ url: string | null }> =>
    ipcRenderer.invoke('gateway:info'),

  /** Whether this page is running inside Electron */
  isDesktop: true,

  /** Electron version info */
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
})
