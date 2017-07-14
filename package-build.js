'use strict'

const build_dir = 'js'
const out_file = build_dir + '/pkeyjs-bundle.js'
const argv = require('minimist')(process.argv.slice(2))
const browserify = require('browserify')
const fs = require('fs')
const exorcist = require('exorcist')

const bundler_args = {debug: true, entries: ['src/main.js']}
if (argv.watch) {
  const watchify = require('watchify')
  bundler_args.cache = {}
  bundler_args.packageCache = {}
  bundler_args.plugin = [watchify]
}
const bundler = browserify(bundler_args)
if (!argv.debug) bundler.transform({global: true}, 'uglifyify')

function bundle() {
  if (!fs.existsSync(build_dir)) fs.mkdirSync(build_dir)
  bundler.bundle()
    .pipe(exorcist(out_file + '.map'))
    .pipe(fs.createWriteStream(out_file))
}

if (argv.watch) bundler.on('update', bundle)
bundle()
