/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
    off: (channel: string, ...omit: any[]) => void
    send: (channel: string, ...omit: any[]) => void
    invoke: (channel: string, ...omit: any[]) => Promise<any>
  }
}
