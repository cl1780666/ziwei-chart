import { build } from 'esbuild'
import { copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const output = resolve(root, 'miniprogram/vendor/cloudbase.js')
await mkdir(dirname(output), { recursive: true })
await build({
  entryPoints: [resolve(root, 'client-sdk-entry.js')],
  outfile: output,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2017',
  minify: true,
  legalComments: 'eof',
  banner: { js: '// Generated from @cloudbase/js-sdk 3.10.4; run pnpm build:sdk. Apache-2.0.' },
})
await copyFile(resolve(root, 'node_modules/@cloudbase/js-sdk/LICENSE'), resolve(dirname(output), 'LICENSE.cloudbase.txt'))
await copyFile(
  resolve(root, 'node_modules/@cloudbase/js-sdk/dist/index.cjs.js.LICENSE.txt'),
  resolve(dirname(output), 'index.js.LICENSE.txt'),
)

async function totalBytes(directory) {
  let size = 0
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name)
    size += item.isDirectory() ? await totalBytes(path) : (await stat(path)).size
  }
  return size
}

const bytes = await totalBytes(resolve(root, 'miniprogram'))
console.log(`SDK bundle: ${(await readFile(output)).length} bytes; Mini Program package: ${bytes} bytes`)
if (bytes >= 2 * 1024 * 1024) throw new Error('Mini Program main package exceeds 2 MiB')
