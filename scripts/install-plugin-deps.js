// Installs the plugin's runtime dependencies inside the .sdPlugin folder, so they're packed with it.
//
// Run from an npm script. The parent npm's config is passed to child processes as npm_config_*
// environment variables, and some of those (such as allow-scripts) are rejected by a nested
// project install, so they're removed and the child npm reads the user's .npmrc as normal.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const pluginDir = fileURLToPath(new URL('../com.organismzero.chattriggers.sdPlugin/', import.meta.url))
const command = process.argv[2] === 'ci' ? 'ci' : 'install'

const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_'))
)

const result = spawnSync('npm', [command, '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: pluginDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

process.exit(result.status ?? 1)
