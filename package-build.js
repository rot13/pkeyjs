'use strict'

let build_dir = 'js'
let out_file = build_dir + '/pkeyjs-bundle.js'
let argv = require('minimist')(process.argv.slice(2))
let browserify = require('browserify')
let fs = require('fs')
let exorcist = require('exorcist')

let bundler_args = {debug: true, entries: ['src/main.js']}
if (argv.watch) {
  let watchify = require('watchify')
  bundler_args.cache = {}
  bundler_args.packageCache = {}
  bundler_args.plugin = [watchify]
}
let bundler = browserify(bundler_args)
if (!argv.debug) bundler.transform({global: true}, 'uglifyify')

function bundle() {
  if (!fs.existsSync(build_dir)) fs.mkdirSync(build_dir)
  bundler.bundle()
    .pipe(exorcist(out_file + '.map'))
    .pipe(fs.createWriteStream(out_file))
}

if (argv.watch) bundler.on('update', bundle)
bundle()
