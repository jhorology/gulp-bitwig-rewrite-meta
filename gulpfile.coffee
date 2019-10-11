gulp        = require 'gulp'
coffeelint  = require 'gulp-coffeelint'
coffee      = require 'gulp-coffee'
tap         = require 'gulp-tap'
del         = require 'del'
beautify    = require 'js-beautify'

# paths, misc settings
$ =
  myLibDir: "#{process.env.HOME}/Documents/Bitwig Studio/Library"
  # pkgDir: "#{process.env.HOME}/Library/Application Support/Bitwig/Bitwig Studio/installed-packages/1.0"
  pkgDir: '/Volumes/Media/Music/Bitwig Studio/Installed Bitwig Packs/1.0'
  testDataDir: "./test_data"
  testOutDir: "./test_out"
  
gulp.task 'coffeelint', ->
  gulp.src ['./*.coffee', './test/*.coffee']
    .pipe coffeelint './coffeelint.json'
    .pipe coffeelint.reporter()

gulp.task 'coffee', gulp.series 'coffeelint', ->
  gulp.src ['./gulp-bitwig-rewrite-meta.coffee']
    .pipe coffee()
    .pipe gulp.dest './'

gulp.task 'default', gulp.series 'coffee'

gulp.task 'watch', ->
  gulp.watch './**/*.coffee', ['default']
 
gulp.task 'clean', (cb) ->
  del ['./*.js', './**/*~', $.testOutDir], force: true, cb

gulp.task 'clean-all', (cb) ->
  del ['./*.js', './**/*~', $.testOutDir, './node_modules'], force: true, cb

# aanalyze header format
gulp.task 'analyze-header', ->
  gulp.src [
      "#{$.myLibDir}/**/*.bwpreset"
      "#{$.myLibDir}/**/*.bwclip"
      "#{$.pkgDir}/**/*.bwpreset"
      "#{$.pkgDir}/**/*.bwclip"
  ], read: true
    .pipe tap (file) ->
      match = undefined
      testStr = file.contents.toString 'ascii', 0, 80
      [
        /^BtWg[0-9a-f]{12}([0-9a-f]{8})0{8}([0-9a-f]{8})\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u0004meta/
        /^BtWg[0-9a-f]{12}([0-9a-f]{8})0{8}([0-9a-f]{8})00\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u0004meta/
        /^BtWg[0-9a-f]{12}([0-9a-f]{8})0{28}([0-9a-f]{8})\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u0004meta/
      ].find (regexp) ->
        match = testStr.match regexp
      if match
        if match[0].length isnt 52
          console.info match, match[0].length, file.path
      else
        throw new Error "Error: unknown header. file:#{file.path} header:#{file.contents.toString 'hex', 0, 80}"
        
# parse all my library files
gulp.task 'test-parse-library', gulp.series 'default', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src [
      "#{$.myLibDir}/**/*.bwpreset"
      "#{$.myLibDir}/**/*.bwclip"
  ], read: true
    .pipe rewrite (file, data) ->
      console.info beautify (JSON.stringify data), indent_size: 2
      undefined

# parse all package files
gulp.task 'test-parse-package', gulp.series 'default', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src [
    "#{$.pkgDir}/**/*.bwpreset"
    "#{$.pkgDir}/**/*.bwclip"
  ], read: true
    .pipe rewrite (file, data) ->
      console.info beautify (JSON.stringify data), indent_size: 2
      undefined

# clip
gulp.task 'test-clip', gulp.series 'default', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwclip"], read: true
    .pipe rewrite (file, data) ->
      name: "_test_clip_#{data.name}"
      creator: 'creator_test_clip'
      tags: [
        'tag_test_clip_1'
        'tag_test_clip_2'
        'tag_test_clip_3'
        ]
    .pipe gulp.dest "#{$.testOutDir}/test_clip"

# clip non-ascii
gulp.task 'test-clip-non-ascii', gulp.series 'default', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwclip"], read: true
    .pipe rewrite (file, data) ->
      name: "_テスト_クリップ_#{data.name}"
      creator: '作者_テスト_クリップ'
      tags: [
        'タグ_テスト_クリップ_1'
        'タグ_テスト_クリップ_2'
        'タグ_テスト_クリップ_3'
        ]
      comment: '説明_テスト_クリップ6_1\n説明_テスト_クリップ_2'
    .pipe gulp.dest "#{$.testOutDir}/test_clip"

# preset
gulp.task 'test-preset', gulp.series 'default', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwpreset"], read: true
    .pipe rewrite (file, data) ->
      name: "_test_preset_#{data.name}"
      creator: 'creator_test_preset'
      preset_category: 'category_test_preset'
      tags: [
        'tag_test_preset_1'
        'tag_test_preset_2'
        'tag_test_preset_3'
        ]
    .pipe gulp.dest "#{$.testOutDir}/test_preset"

# clip non-ascii
gulp.task 'test-preset-non-ascii', gulp.series 'default', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["#{$.testDataDir}/**/*.bwpreset"], read: true
    .pipe rewrite (file, data) ->
      name: "_テスト_プリセット_#{data.name}"
      creator: '作者_テスト_プリセット'
      preset_category: 'カテゴリー_テスト_プリセット'
      tags: [
        'タグ_テスト_プリセット_1'
        'タグ_テスト_プリセット_2'
        'タグ_テスト_プリセット_3'
        ]
      comment: '説明_テスト_プリセット_1\n説明_テスト_プリセット_2'
    .pipe gulp.dest "#{$.testOutDir}/test_preset"

# test all
gulp.task 'test', gulp.series 'clean'
,  'test-parse-library'
,  'test-parse-package'
,  'test-clip'
,  'test-clip-non-ascii'
,  'test-preset'
,  'test-preset-non-ascii'
