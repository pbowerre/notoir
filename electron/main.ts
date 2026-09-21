import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { setupIpcHandlers } from './services/ipcHandlers'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let externalFilePathToOpen: string | null = null

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - SystemJS only
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    icon: path.join(process.env.VITE_PUBLIC ?? '', 'notoir.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.setMenu(null)

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    
    // If Notoir was launched by opening a file, tell the renderer
    if (externalFilePathToOpen) {
      win?.webContents.send('open-external-file', externalFilePathToOpen)
      externalFilePathToOpen = null
    }
  })

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // 2=warning, 3=error
      console.error(`[Renderer Error] ${message} (${sourceId}:${line})`);
    } else {
      console.log(`[Renderer] ${message}`);
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST ?? '', 'index.html'))
  }
}

// Handle 'open-file' on macOS
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (path.endsWith('.md') || path.endsWith('.txt')) {
    if (win && !win.webContents.isLoading()) {
      win.webContents.send('open-external-file', path)
    } else {
      externalFilePathToOpen = path
    }
  }
})

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    
    // Parse args for windows file associations
    const args = commandLine.slice(app.isPackaged ? 1 : 2)
    if (args.length > 0) {
      const maybePath = args[0]
      if (fs.existsSync(maybePath) && (maybePath.endsWith('.md') || maybePath.endsWith('.txt'))) {
        if (win && !win.webContents.isLoading()) {
          win.webContents.send('open-external-file', path.resolve(maybePath))
        } else {
          externalFilePathToOpen = path.resolve(maybePath)
        }
      }
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
      win = null
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  app.whenReady().then(async () => {
    // Parse process.argv for Windows/Linux file associations
    const args = process.argv.slice(app.isPackaged ? 1 : 2)
    if (args.length > 0) {
      const maybePath = args[0]
      if (fs.existsSync(maybePath) && (maybePath.endsWith('.md') || maybePath.endsWith('.txt'))) {
        externalFilePathToOpen = path.resolve(maybePath)
      }
    }

    createWindow()
    
    // Initialize services and IPC handlers asynchronously
    await setupIpcHandlers()
  })
}
