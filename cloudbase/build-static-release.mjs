import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const cloudbaseDir = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.dirname(cloudbaseDir)
const distDir = path.join(repositoryRoot, 'app', 'dist')
const publicAudioDir = path.join(repositoryRoot, 'app', 'public', 'audio')
const releaseDir = path.join(repositoryRoot, 'cloudbase-release')
const releaseAudioDir = path.join(releaseDir, 'audio')

const tracks = [
  {
    file: 'soothing-cafe-bossa.mp3',
    remote: 'https://cdn.pixabay.com/download/audio/2025/06/13/audio_4d2920bf9f.mp3?filename=tunetank-soothing-cafe-music-349586.mp3',
  },
  {
    file: 'priscilla-bossa-nova.mp3',
    remote: 'https://cdn.pixabay.com/download/audio/2024/10/11/audio_9114fa0972.mp3?filename=alanajordan-priscilla-bossa-nova-249846.mp3',
  },
  {
    file: 'quiet-bossa-nova.mp3',
    remote: 'https://cdn.pixabay.com/download/audio/2022/01/17/audio_8ddeaf7dc7.mp3?filename=capitalnerd2617-bossa-nova-14396.mp3',
  },
  {
    file: 'bossa-nova-cafe.mp3',
    remote: 'https://cdn.pixabay.com/download/audio/2025/06/13/audio_e08413f251.mp3?filename=tunetank-bossa-nova-cafe-music-347362.mp3',
  },
]

await rm(releaseDir, { recursive: true, force: true })
await cp(distDir, releaseDir, { recursive: true })
await rm(releaseAudioDir, { recursive: true, force: true })
await mkdir(releaseAudioDir, { recursive: true })
await cp(path.join(publicAudioDir, 'LICENSE.txt'), path.join(releaseAudioDir, 'LICENSE.txt'))

for (const track of tracks) {
  await cp(path.join(publicAudioDir, track.file), path.join(releaseAudioDir, track.file))
}

const assetFiles = await readdir(path.join(releaseDir, 'assets'))
let replacementCount = 0
for (const assetFile of assetFiles.filter((file) => file.endsWith('.js'))) {
  const assetPath = path.join(releaseDir, 'assets', assetFile)
  let source = await readFile(assetPath, 'utf8')
  for (const track of tracks) {
    if (source.includes(track.remote)) {
      source = source.replaceAll(track.remote, `/audio/${track.file}`)
      replacementCount += 1
    }
  }
  await writeFile(assetPath, source)
}

if (replacementCount !== tracks.length) {
  throw new Error(`Expected ${tracks.length} local-audio replacements, found ${replacementCount}`)
}

console.log(`CloudBase static release ready at ${releaseDir}`)
console.log(`Bundled ${tracks.length} licensed local music tracks`)
