import path from 'path'
import { existsSync } from 'fs'
import consola from 'consola'
import esm from 'esm'
import defaultsDeep from 'lodash/defaultsDeep'
import { getDefaultNuxtConfig } from '@nuxt/config'
import boxen from 'boxen'
import chalk from 'chalk'
import prettyBytes from 'pretty-bytes'
import env from 'std-env'

export const requireModule = esm(module, {
  cache: false,
  cjs: {
    cache: true,
    vars: true,
    namedExports: true
  }
})

const getRootDir = argv => path.resolve(argv._[0] || '.')
const getNuxtConfigFile = argv => path.resolve(getRootDir(argv), argv['config-file'])

export async function loadNuxtConfig(argv, configFile = null) {
  const rootDir = getRootDir(argv)
  const nuxtConfigFile = configFile || getNuxtConfigFile(argv)

  let options = {}

  if (existsSync(nuxtConfigFile)) {
    delete require.cache[nuxtConfigFile]
    options = requireModule(nuxtConfigFile) || {}
    if (options.default) {
      options = options.default
    }

    if (typeof options === 'function') {
      try {
        options = await options()
        if (options.default) {
          options = options.default
        }
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }
  } else if (argv['config-file'] !== 'nuxt.config.js') {
    consola.fatal('Could not load config file: ' + argv['config-file'])
  }
  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  // Nuxt Mode
  options.mode =
    (argv.spa && 'spa') || (argv.universal && 'universal') || options.mode

  // Server options
  options.server = defaultsDeep({
    port: argv.port || undefined,
    host: argv.hostname || undefined,
    socket: argv['unix-socket'] || undefined
  }, options.server || {}, getDefaultNuxtConfig().server)

  return options
}

export function showBanner(nuxt) {
  if (env.test) {
    return
  }

  if (env.minimalCLI) {
    for (const listener of nuxt.server.listeners) {
      consola.info('Listening on: ' + listener.url)
    }
    return
  }

  const lines = []

  // Name and version
  lines.push(`${chalk.green.bold('Nuxt.js')} v${nuxt.constructor.version}`)

  // Running mode
  lines.push(`Running in ${nuxt.options.dev ? chalk.bold.blue('development') : chalk.bold.green('production')} mode (${chalk.bold(nuxt.options.mode)})`)

  // https://nodejs.org/api/process.html#process_process_memoryusage
  const { heapUsed, rss } = process.memoryUsage()
  lines.push(`Memory usage: ${chalk.bold(prettyBytes(heapUsed))} (RSS: ${prettyBytes(rss)})`)

  // Listeners
  lines.push('')
  for (const listener of nuxt.server.listeners) {
    lines.push(chalk.bold('Listening on: ') + chalk.underline.blue(listener.url))
  }

  // Add custom badge messages
  if (nuxt.options.cli.badgeMessages.length) {
    lines.push('', ...nuxt.options.cli.badgeMessages)
  }

  const box = boxen(lines.join('\n'), {
    borderColor: 'green',
    borderStyle: 'round',
    padding: 1,
    margin: 1
  })

  process.stdout.write(box + '\n')
}