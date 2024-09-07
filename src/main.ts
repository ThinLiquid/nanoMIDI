import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import path from 'path'

import fs from 'fs'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'

const _dirname = process.env.DEV == undefined
  ? path.join(path.resolve(), 'src/extras')
  : process.resourcesPath

if (require('electron-squirrel-startup') === true) {
  app.quit()
}

const initPlayback = async (buffer: ArrayBuffer): Promise<void> => {
  if (fs.existsSync(`${_dirname}/file.mid`)) {
    await fs.promises.unlink(`${_dirname}/file.mid`)
  }
  if (fs.existsSync(`${_dirname}/song.txt`)) {
    await fs.promises.unlink(`${_dirname}/song.txt`)
  }

  await fs.promises.writeFile(`${_dirname}/file.mid`, Buffer.from(buffer))
}

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 30
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const errorHandler = (error: Error): void => {
    console.error(error)
    mainWindow.webContents.send('error', error.message)
  }

  const endPlayerSession = (): void => {
    if (player == null) return

    mainWindow.webContents.send('end', null)
    unregisterAllShortcuts()
    player = null
  }

  const hookKeybinds = (): void => {
    registerShortcut('Delete', () => {
      if (player != null) player.stdin.write('pp\n')
      mainWindow.webContents.send('pp', null)
    })

    registerShortcut('Home', () => {
      if (player != null) player.stdin.write('speed\n')
      mainWindow.webContents.send('speed', null)
    })

    registerShortcut('End', () => {
      if (player != null) player.stdin.write('slow\n')
      mainWindow.webContents.send('slow', null)
    })

    registerShortcut('CommandOrControl+Delete', () => {
      if (player == null) return
      player.kill()
      endPlayerSession()
    })
  }

  /**
   * Start the player and control the player
   *
   * @returns {Promise<void>}
   */
  const startPlayer = async (): Promise<void> => {
    const _player = spawn('python', [`${_dirname}/playMIDI.py`, _dirname])
    let lineBuffer = ''

    _player.on('exit', endPlayerSession)

    _player.stderr?.on('data', data => {
      errorHandler(new Error(data.toString()))
    })

    _player.stdout.on('data', data => {
      lineBuffer += data.toString() as string
      const lines = lineBuffer.split('\n')

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]

        if (line === 'ready\r') {
          player = _player
          mainWindow.webContents.send('ready', null)
          hookKeybinds()
        }
      }

      lineBuffer = lines[lines.length - 1]
    })
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL == null) {
    mainWindow.loadFile(
      path.join(_dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    ).catch(errorHandler)
  } else {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL).catch(errorHandler)
  }

  ipcMain.on('songData', (event, buffer: ArrayBuffer) => {
    if (player != null) {
      player.kill()
      endPlayerSession()
    }

    initPlayback(buffer).catch(errorHandler)

    const startTask = async (task: string): Promise<void> =>
      await new Promise(resolve => {
        const _ = spawn('python', [`${_dirname}/${task}.py`, _dirname])
        _.on('exit', () => resolve())
      })

    if (!fs.existsSync(`${_dirname}/file.mid`)) return

    startTask('installDeps')
      .then(startPlayer)
      .catch(errorHandler)
  })
}

app.on('ready', createWindow)
let player: ChildProcessWithoutNullStreams | null = null

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

const registerShortcut = (shortcut: string, callback: () => void): void => {
  const _ = globalShortcut.register(shortcut, callback)
  if (!_) {
    throw new Error(`Failed to register shortcut: ${shortcut}`)
  }
}

const unregisterAllShortcuts = (): void => {
  globalShortcut.unregisterAll()
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
