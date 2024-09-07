import VanillaTilt from 'vanilla-tilt'

import './index.css'
import 'material-symbols'
import { title } from 'process'

const { ipcRenderer } = window.require('electron')
const prompt = window.require('native-prompt')

const Icon = (name: string): HTMLSpanElement => {
  const icon = document.createElement('span')
  icon.classList.add('material-symbols-rounded')
  icon.textContent = name
  return icon
}

export type RequestType<T> = T extends 'json' ? object : T extends 'blob' ? Blob : T extends 'text' ? string : never

const makeRequest = async <T extends 'json' | 'blob' | 'text'>(url: string, type: T = 'json' as T): Promise<Awaited<RequestType<T>>> => {
  const response: Response = await fetch(url)
  return await (response[type] as () => Promise<RequestType<T>>)()
}

const MIDIRepos: IRepoData[] = [
  {
    name: 'nanoMIDI',
    repo: 'NotHammer043/midi-db',
    url: 'https://raw.githubusercontent.com/NotHammer043/midi-db/main'
  }
]

const MIDI_PATH = '/midis'
const IMAGE_PATH = '/images'

interface IMidiEntry {
  name: string
  artists: string
  midiFilename: string
  imageFilename: string
  githubUser: string
  arrangement: string
}

interface IRepoData {
  name: string
  repo: string
  url: string
}

ipcRenderer.on('error', (_, error) => {
  console.log(error)
  alert(error)
})

const createScreen = () => {
  const container = document.createElement('div')
  container.style.zIndex = '100'
  container.classList.add('container')
  return container
}

const createScreenItem = (name: string, artists?: string, background?: string, onclick: () => unknown = () => null, icon?: string) => {
  const button = document.createElement('div')
  button.tabIndex = 0
  button.classList.add('button')
  button.onclick = onclick

  const text = document.createElement('div')
  text.classList.add('text')

  const bold = document.createElement('b')
  bold.textContent = name
  text.appendChild(bold)

  if (artists) {
    const p = document.createElement('div')
    p.textContent = artists
    text.appendChild(p)
  }

  if (icon) {
    const _icon = Icon(icon)
    _icon.classList.add('icon')
    button.appendChild(_icon)
  }

  button.appendChild(text)

  if (background) {
    button.style.background = background
    button.style.backgroundSize = 'cover'
    button.style.backgroundPosition = 'center'
  }

  VanillaTilt.init(button, {
    max: 12.5,
    speed: 1000,
    scale: 1.1,
    glare: true,
    'max-glare': 0.25
  })

  return button
}

const Repo = async (repo: IRepoData) => {
  if (!navigator.onLine) throw new Error('No internet connection')
  const screen = createScreen()

  screen.appendChild(createScreenItem('Back', undefined, 'black', () => {
    screen.classList.add('hide')
    setTimeout(() => screen.remove(), 500)
  }, 'arrow_back'))

  screen.appendChild(createScreenItem('Refresh', undefined, 'black', async () => {
    screen.remove()
    document.body.appendChild(await Repo(repo))
  }, 'refresh'))

  screen.appendChild(createScreenItem('Search', undefined, 'black', async () => {
    const search = await prompt('nanoMIDI', 'Search for a song')
    if (search == null) return

    const items = screen.querySelectorAll('.button[data-search]')
    for (const item of items) {
      if ((item as HTMLElement).dataset.search?.includes(search.toLowerCase())) {
        item.classList.remove('hide')
      } else {
        item.classList.add('hide')
      }
    }
  }, 'search'))

  const midiEntries = await makeRequest(`${repo.url}/midiData.json`, 'json') as IMidiEntry[]

  const getMidi = async (filename: string) => await makeRequest(`${repo.url}${MIDI_PATH}/${filename}`, 'blob')
  const getImage = async (filename: string) => await makeRequest(`${repo.url}${IMAGE_PATH}/${filename}`, 'blob')

  console.log(midiEntries)

  const sendDataToMain = async (filename: string) => {
    const buffer = await (await getMidi(filename)).arrayBuffer()
    ipcRenderer.send('songData', buffer)
  }

  (async () => {
    for (const entry of midiEntries) {
      const item = createScreenItem(`${entry.name} (${entry.arrangement == '' ? 'N/A' : entry.arrangement})`, entry.artists, `url(${URL.createObjectURL(await getImage(entry.imageFilename))})`, () => {
        show('loading...')
        sendDataToMain(entry.midiFilename)
      })
      item.setAttribute('data-search', `${entry.name} ${entry.artists} ${entry.arrangement} ${entry.githubUser}`.toLowerCase())
      screen.appendChild(item)
      await new Promise((resolve) => setTimeout(resolve, 1))
    }
  })()

  return screen
}

const Home = () => {
  const container = createScreen()

  container.appendChild(createScreenItem('Settings', undefined, 'black', () => {}, 'settings'))

  container.appendChild(createScreenItem('Upload MIDI file', undefined, 'black', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mid'
    input.onchange = async () => {
      const file = input.files?.item(0)
      if (file == null) return

      const buffer = await file.arrayBuffer()
      ipcRenderer.send('songData', buffer)
    }

    input.click()
  }, 'upload'))

  for (const repo of MIDIRepos) {
    container.appendChild(createScreenItem(repo.name, repo.repo, 'black', async () => {
      document.body.appendChild(await Repo(repo))
    }, 'folder'))
  }

  return container
}

const show = (text: string) => {
  const playingContainer = document.createElement('div')
  playingContainer.tabIndex = -1
  playingContainer.classList.add('playing')
  playingContainer.textContent = text
  document.body.appendChild(playingContainer)

  playingContainer.classList.add('show')

  setTimeout(() => {
    playingContainer.classList.add('hide')

    setTimeout(() => {
      playingContainer.remove()
    }, 250)
  }, 500 + 2000)
}

ipcRenderer.on('ready', () => {
  show('ready 2 play')
})

ipcRenderer.on('end', () => {
  show('playback end')
})

ipcRenderer.on('pp', () => {
  show('playback toggle')
})

ipcRenderer.on('speed', () => {
  show('speed up')
})

ipcRenderer.on('slow', () => {
  show('speed down')
})

document.body.appendChild(Home())

const titlebar = document.createElement('div')
titlebar.classList.add('titlebar')
titlebar.textContent = 'nanoMIDI'
document.body.appendChild(titlebar)