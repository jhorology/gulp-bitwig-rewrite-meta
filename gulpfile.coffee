gulp        = require 'gulp'
coffeelint  = require 'gulp-coffeelint'
coffee      = require 'gulp-coffee'
mocha       = require 'gulp-mocha'
runSequence = require 'run-sequence'
del         = require 'del'
watch       = require 'gulp-watch'
mocha       = require 'gulp-mocha'
beautify    = require 'js-beautify'

# paths, misc settings
$ =
  myLibDir: "#{process.env.HOME}/Documents/Bitwig Studio/Library"
  pkgDir: "#{process.env.HOME}/Library/Application Support/Bitwig/Bitwig Studio/installed-packages/1.0"
  testDataDir: "./test_data"
  testOutDir: "./test_out"
  
gulp.task 'coffeelint', ->
  gulp.src ['./*.coffee', './test/*.coffee']
    .pipe coffeelint './coffeelint.json'
    .pipe coffeelint.reporter()

gulp.task 'coffee', ->
  gulp.src ['./gulp-bitwig-rewrite-meta.coffee']
    .pipe coffee()
    .pipe gulp.dest './'

gulp.task 'default', (cb) -> runSequence.apply null, [
  'coffeelint'
  'coffee'
  cb
]

gulp.task 'watch', ->
  gulp.watch './**/*.coffee', ['default']
 
gulp.task 'clean', (cb) ->
  del ['./*.js', './**/*~', $.testOutDir, './node_modules'], force: true, cb

# parse all my library files
gulp.task 'test_1', ['default'], ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.myLibDir}/**/*.bwpreset", "#{$.myLibDir}/**/*.bwclip"], read: true
    .pipe rewrite (file, data) ->
      console.info beautify (JSON.stringify data), indent_size: 2
      undefined

# parse all package files
gulp.task 'test_2', ['default'], ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.pkgDir}/**/*.bwpreset", "#{$.pkgDir}/**/*.bwclip"], read: true
    .pipe rewrite (file, data) ->
      console.info beautify (JSON.stringify data), indent_size: 2
      undefined

# rewrite preset metadata 'ascii'
gulp.task 'test_3', ['default'], ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwpreset"], read: true
    .pipe rewrite
      name: 'test_3'
      preset_category: 'category_test_3'
      creator: 'creator_test_3'
      tags: ['tag_test_3_1', 'tag_test_3_2', 'tag_test_3_3']
    .pipe gulp.dest "#{$.testOutDir}/test_3"

# rewrite preset metadata 'ucs2'
gulp.task 'test_4', ['default'], ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwpreset"], read: true
    .pipe rewrite
      name: 'テスト_4'
      preset_category: 'カテゴリ_テスト_4'
      creator: '作者_テスト_4'
      tags: ['タグ_テスト_4_1', 'タグ_テスト_4_2', 'タグ_テスト_4_3']
    .pipe gulp.dest "#{$.testOutDir}/test_4"

# rewrite clip metadata 'ascii'
gulp.task 'test_5', ['default'], ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwclip"], read: true
    .pipe rewrite
      name: 'test_5'
      creator: 'creator_test_5'
      tags: ['tag_test_5_1', 'tag_test_5_2', 'tag_test_5_3']
    .pipe gulp.dest "#{$.testOutDir}/test_5"

# rewrite clip metadata 'ucs2'
gulp.task 'test_6', ['default'], ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwclip"], read: true
    .pipe rewrite
      name: 'テスト_6'
      creator: '作者_テスト_6'
      tags: ['タグ_テスト_6_1', 'タグ_テスト_6_2', 'タグ_テスト_6_3']
    .pipe gulp.dest "#{$.testOutDir}/test_6"


gulp.task 'test', ['test_3', 'test_4','test_5','test_6']
