## gulp-bitwig-rewrite-meta

Gulp plugin for rewriting metadata of Bitwig Studio's files

## Build
```
  npm install
  gulp
```

## Installation
```
  npm install gulp-bitwig-rewrite-meta --save-dev
```

## Usage

rewriting tag.
```coffeescript
gulp.task 'tagging', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["src/Like/**/*.bwpreset"], read: true
    .pipe rewrite
      tags: [
        'Like'
        'いいね！'
        ]
    .pipe gulp.dest "dist"
```
adding tag and renaming.

```coffeescript
gulp.task 'tagging', ->
  rewrite = require './gulp-bitwig-rewrite-meta'
  gulp.src ["src/Like/**/*.bwpreset"], read: true
    .pipe rewrite, (file, metadata) ->
      name: "#{metadata.name}_new"
      tags: metadata.tags.concat [
        'Like'
        'いいね！'
        ]
    .pipe gulp.dest "dist"
```

## API

### rewrite(data)

#### data
Type: `Object` or `function(file, metadata)`

The data or data provider to rewrite for.

##### data.name
Type: `String`

Preset or Clip name to rewrite for. It also means filename in Bitwig Studio.

##### data.creator [optional]
Type: `String`

##### data.preset_category [optional]
Type: `String`

##### data.tags [optional]
Type: `Array` of `String`

##### data.comment [optional]
Type: `String`

#### function (file, metadata)

##### file
Type: `Object'

The `vinyl` file.

##### metadata
Type: `Object`

The metadata of source file.

example metadata of .bwpreset
```javascript
{
  "file": "/.../Wood Pop Melody ARP SURR.bwpreset",
  "name": "Wood Pop Melody ARP SURR",
  "application_version_name": "1.0.11",
  "branch": "1.0-fixes",
  "comment": "",
  "creator": "Evolve R2",
  "device_category": "Synth",
  "device_creator": "Native Instruments GmbH",
  "device_id": "vst:1315524405:84082944",
  "device_name": "Kontakt 5",
  "device_type": "note_to_audio",
  "preset_category": "FX",
  "referenced_device_ids": [],
  "referenced_packaged_file_ids": [],
  "revision_id": "20140715114044-v9t60rw9c97duf4w",
  "revision_no": 4430,
  "tags": [],
  "type": "application/bitwig-preset"
}
```

example metadata of .bwpclip
```javascript
{
  "file": "/.../installed-packages/1.0/clips/Cristian Vogel/Cristian Vogel Bitwig Lab/Techne Sigh.bwclip",
  "name": "Techne Sigh",
  "application_version_name": "1.1.3",
  "beat_length": 4,
  "branch": "release/1.1",
  "creator": "Cristian Vogel",
  "orig_file_checksum": "aa7163e9523fed2b95ebc177d28c3cca",
  "packaged_file_id": "Cristian Vogel/Cristian Vogel Bitwig Lab/clips/Techne Sigh.bwclip",
  "referenced_packaged_file_ids": ["Cristian Vogel/Cristian Vogel Bitwig Lab/samples/Custom Waves 4096/lo pulse ems.wav"],
  "revision_id": "d68e2e1d21660ebd6781db8d2a408fa7dba2cccb",
  "revision_no": 25290,
  "tags": ["digital", "metallic", "quirky", "wonky"],
  "type": "application/bitwig-note-clip"
}
```

## Notes

- Currentlly supported files.
  - .bwpreset
  - .bwclip
