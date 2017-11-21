path          = require 'path'
through       = require 'through2'
gutil         = require 'gulp-util'
_             = require 'underscore'

PLUGIN_NAME = 'bitwig-rewrite-meta'
# ucs2 encoding endian
IS_UCS2_LE  = (new Buffer 'a', 'ucs2')[0]

# bwpreset chunk1
# ----------------------------------------------
# Polysynth Acido.bwpreset (1.1 BETA 1)
#
#  chunk identifier: 00000561
#  ---------------------------------
#  item identifier:  00001423 (unknown)
#  value type:       05 (byte)
#  value:            00
#  ---------------------------------
#  item identifier:  0000150a (unknown)
#  value type:       05 (byte)
#  value:            00
#  ---------------------------------
#  item identifier:  00001421 (unknown)
#  value type:       09 (32bit)
#  value:            00000040
#  ---------------------------------
#  item identifier:  000002b9 (unknown)
#  value type:       08 (string)
#  string size:      00000000
#  ---------------------------------
#  item identifier   000012de (preset_name)
#  value type:       08 (string)
#  string size:      00000005
#  value:            416369646f ("Acido")
#  ---------------------------------
#  item identifier:  0000 009a (device_name)
#  value type:       08 (string)
#  string size:      00000009
#  value:            506f6c7973796e7468 ("Polysynth")
#  ---------------------------------
#  item identifer:   0000009b (device_creator)
#  value type:       08 (string)
#  string size:      00000006
#  value:            426974776967 ("Bitwig")
#  ---------------------------------
#  item identifier:  0000009c (device_type)
#  value type:       08 (string)
#  string size:      0000000b
#  value:            496e737472756d656e7473 ("Instrument")
#  ---------------------------------
#  item identifier:  0000009d (unknown)
#  value type:       01 (byte)
#  value:            02
#  ---------------------------------
#  item identifier:  0000009e (creator)
#  value type:       08 (string)
#  string size:      00000005
#  value:            436c616573 ("Claes")
#  ---------------------------------
#  item identifier:  0000009f (comment)
#  value type:       08 (string)
#  string size:      00000000
#  ---------------------------------
#  item identifier:  000000a1 (category)
#  value type:       08 (string)
#  string size:      00000004
#  value:            42617373 ("Bass")
#  ---------------------------------
#  item identifier:  000000a2 (tags)
#  value type:       08 (string)
#  string size:      0000000d
#  value:            6861726d6f6e6963206d6f6e6f ("harmonic mon")
#  ---------------------------------
#  item identifier   000000a3 (unknown) end of meta
#  value type:       05 (byte)
#  value:            01
#  ---------------------------------
#  item identifier:  0000137e (unknown)
#  value type:       05 (byte)
#  value:            01
#  ---------------------------------
#  .... don't need any more
#
# ----------------------------------------------
# Spire BA Agress Dub 02.bwpreset (1.0.10)
#
#  chunk identifier: 000001a5
#  ---------------------------------
#  item identifier:  000002b9 (unknown)
#  value identifier: 08 (string)
#  string size:      00000000
#  ---------------------------------
#  item identifier:  000012de (preset_name)
#  value type:       08 (string)
#  string size:      00000000
#  ---------------------------------
#  item identifier:  0000009a (device_name)
#  value type:       08 (string)
#  string size:      00000005
#  value:            5370697265 ("Spire")
#  ---------------------------------
#  item identifier:  0000009b (device_creator)
#  value type:       08 (string)
#  string size:      0000000c
#  value:            52657665616c20536f756e64 ("Reveal Sound")
#  ---------------------------------
#  item identifier:  0000009c (device_type)
#  value type:       08 (string)
#  string size:      00000005
#  value:            53796e7468 ("Synth")
#  ---------------------------------
#  item identifier:  0000009d (unknown)
#  value type:       01 (byte)
#  value:            02
#  ---------------------------------
#  item identifier:  0000009e (creator)
#  value type:       08 (string)
#  string size:      00000008
#  value:            466163746f727931 ("Factory1")
#  ---------------------------------
#  item identifier:  0000009f (comment)
#  value type:       08 (string)
#  string size:      00000000
#  ---------------------------------
#  item identifier:  000000a1 (category)
#  value type:       08 (string)
#  string size:      00000004
#  value:            42617373 ("Bass")
#  ---------------------------------
#  item identifier:  000000a2 (tags)
#  value type:       08 (string)
#  string size:      00000000
#  ---------------------------------
#  item identifier:  000000a3 (unknwon) end of meta
#  value type:       05 (byte)
#  value:            01
#  ---------------------------------
#  .... don't need any more

# constants
$ =
  magic: 'BtWg'
  metaId: 'meta'
  presetType:
    type1: 0x000001a5
    type2: 0x00000561
  valueType:
    byte_1: 0x01
    int16: 0x02
    int32_1: 0x03   # since 1.2 some preset file's revision_no use 32bit int
    byte_2: 0x05
    double: 0x07
    string: 0x08
    int32_2: 0x09
    byte_array: 0x0d
    string_array: 0x19
  protectedMetaItem:
    device_name: 0x009a
    device_creator: 0x009b
    device_category: 0x009c
  metaItem:
    name: 0x12de
    creator: 0x009e
    comment: 0x009f
    preset_category: 0x00a1
    tags: 0x00a2
  endOfMeta: 0x00a3

module.exports = (data) ->
  through.obj (file, enc, cb) ->
    rewrited = off
    rewrite = (err, data) =>
      if rewrited
        @emit 'error', new gutil.PluginError PLUGIN_NAME, 'duplicate callback'
        return
      rewrited = on
      if err
        @emit 'error', new gutil.PluginError PLUGIN_NAME, err
        return cb()
      try
        rewriteMeta file, data
        @push file
      catch err2
        @emit 'error', new gutil.PluginError PLUGIN_NAME, err2
      cb()
      
    unless file
      rewrite 'Files can not be empty'
      return
    
    if file.isNull()
      @push file
      return cb()

    if file.isStream()
      rewrite 'Streaming not supported'
      return

    if file.isBuffer()
      if _.isFunction data
        try
          obj = data file, (parseMetadata file), rewrite
        catch error
          rewrite error
        if data.length <= 2
          rewrite undefined, obj
      else
        rewrite undefined, data
#
# rewrite metadata
# -------------------------------------
# -file src file
# -data function or object for rewrite
rewriteMeta = (file, data) ->
  reader = new BufferReader file.contents
  writer = new BufferWriter
  data = validateData data

  # header chunk 48byte
  if (magic = reader.readString 4) isnt $.magic
    throw new Error "Invalid file: unknown file magic. file:#{file.path} magic:#{magic}"

  # chunk1 offset = metadata size
  reader.position 16
  chunk1_offset = reader.readHexInt()

  # chunk2 offset
  reader.position 32
  chunk2_offset = reader.readHexInt()
    
  # metadata chunk (chuk1 offset - 48) byte
  reader.position 48
  if reader.readString(4) isnt $.metaId
    throw new Error "Invalid file: metadata not contained. file:#{file.path}"
    
  new_metadata = replaceMetadata reader, writer, data

  #  chunk1
  reader.position chunk1_offset
  writer.push reader.mark()

  # set chunk1 offset = metadata size
  new_chunk1_offset = writer.tell()
  writer.writeHexInt new_chunk1_offset, 16
  
  # bitwig-preset contains silly redundancy metadata.
  if new_metadata.type is 'application/bitwig-preset'
    replacePresetChunk1 reader, writer, data

  # has chunk2 ?
  if chunk2_offset
    reader.position chunk2_offset
    writer.push reader.mark()
    # set chunk2 offset = metadata size + chunk1 size
    new_chunk2_offset = writer.tell()
    writer.writeHexInt new_chunk2_offset, 32

  writer.push reader.end()

  # setup output file
  extname = path.extname file.path
  if data.name
    new_metadata.name = data.name
    dirname = path.dirname file.path
    file.path = path.join dirname, data.name + extname
  else
    new_metadata.name = path.basename file.path, extname
  file.contents = writer.buffer()
  file.data = new_metadata

# parse metadata chunk
#
# return JSON object to explain metadata of original source file.
parseMetadata = (file) ->
  reader = new BufferReader file.contents
  if (magic = reader.readString(4)) isnt $.magic
    throw new Error "Invalid file: unknown file magic. file:#{file.path} magic:#{magic}"

  reader.position 48
  if reader.readString(4) isnt $.metaId
    throw new Error "Invalid file: metadata not contained. file:#{file.path}"
  extname = path.extname file.path
  ret =
    file: file.path
    name: path.basename file.path, extname
  # iterate metadata items
  while reader.readInt32() is 1
    # read key kength
    key = reader.readString()
    unless key
      throw new Error "Invalid file: metadata item name can not be empty. file:#{file.path}"
    valueType = reader.readByte()
    value = undefined
    switch valueType
      when $.valueType.string
        value = reader.readString()
        if key is 'tags'
          value = if value then value.split ' ' else []
      when $.valueType.int16 then value = reader.readInt16()
      when $.valueType.int32_1 then value = reader.readInt32()
      when $.valueType.double then value = reader.readDouble()
      when $.valueType.byte_array then value = reader.readBytes()
      when $.valueType.string_array
        size = reader.readInt32()
        value = for i in [0...size]
          reader.readString()
      else
        throw new Error "Unsupported file format: unknown value type. file:#{file.path} key:#{key} valueType:#{valueType}"
    ret[key] = value
  ret


# reprace metadata chunk
#
# return JSON object to explain metadata
replaceMetadata = (reader, writer, data) ->
  new_metadata = {}
  # iterate metadata items
  while reader.readInt32() is 1
    # read key kength
    key = reader.readString()
    unless key
      throw new Error "Invalid file: metadata item name can not be empty."
    valueType = reader.readByte()
    value = undefined
    switch valueType
      when $.valueType.string
        if (key in _.keys $.metaItem) and (key in _.keys data)
          writer.push reader.mark()
          value = data[key]
          if key is 'tags'
            writer.pushString value.join ' '
          else
            writer.pushString value
          reader.readString()
          reader.mark()
        else
          value = reader.readString()
          if key is 'tags'
            value = if value then value.split ' ' else []
      when $.valueType.int16 then value = reader.readInt16()
      when $.valueType.int32_1 then value = reader.readInt32()
      when $.valueType.double then value = reader.readDouble()
      when $.valueType.byte_array then value = reader.readBytes()
      when $.valueType.string_array
        size = reader.readInt32()
        value = for i in [0...size]
          reader.readString()
      else
        throw new Error "Unsupported file format: unknown value type. key: #{key} valueType:#{valueType}"
    new_metadata[key] = value
  new_metadata

# reprace chunk1 (.bwpreset only)
replacePresetChunk1 = (reader, writer, data) ->
  chunkId = reader.readInt32()
  # iterate chunk1 items
  while (itemId = reader.readInt32()) isnt $.endOfMeta
    value = undefined
    valueType = reader.readByte()
    key = _.findKey $.metaItem, (v, k, o) -> v is itemId
    if key and key of data
      if valueType isnt $.valueType.string
        throw new Error "Unsupported file format: unknow value type. valueType:#{valueType}"
      writer.push reader.mark()
      oldValue = reader.readString()
      value = if key is 'tags' then data.tags.join ' ' else data[key]
      # old preset file dosen't have name
      value = '' if key is 'name' and oldValue is ''
      writer.pushString value
      reader.mark()
    else
      switch valueType
        when $.valueType.byte_1 then value = reader.readByte()
        when $.valueType.byte_2 then value = reader.readByte()
        when $.valueType.string then value = reader.readString()
        when $.valueType.int32_2 then value = reader.readInt32()
        else
          throw new Error "Unsupported File Format: unknown value type. itemId:#{itemId} valueType:#{valueType}"
  
#----------------------------------------
# validate data object for rewrite
#----------------------------------------
validateData = (data) ->
  data = data or {}
  keys = _.keys data
  if ('name' in keys) and not _.isString data.name
    throw new Error "option name must be string. name: #{data.name}"
    
  if ('creator' in keys) and not _.isString data.creator
    throw new Error "option creator must be string. creator: #{data.creator}"
      
  if ('comment' in keys) and not _.isString data.comment
    throw new Error "option comment must be string. comment: #{data.comment}"
      
  if ('preset_category' in keys) and not _.isString data.preset_category
    throw new Error "option preset_category must be string. preset_category: #{data.preset_category}"
    
  if 'tags' in keys
    unless _.isArray data.tags
      throw new Error "option tags must be array of strings. tags: #{data.tags}"
    for tag in data.tags
      unless _.isString tag
        throw new Error "option tags must be array of strings. tags: #{data.tags}"
      if (tag.indexOf ' ') >= 0
        throw new Error "tag can't contain spaces. tags: #{tag}"
  data

#----------------------------------------
# simple reader class
#----------------------------------------
class BufferReader
  constructor: (buf) ->
    @buf = buf
    @marker = 0
    @pos = 0

  skip: (n) ->
    @pos += n
    @
    
  position: (pos) ->
    @pos = pos
    @
      
  tell: ->
    @pos
    
  readInt32: ->
    ret = @buf.readUInt32BE @pos
    @pos += 4
    ret
    
  readInt16: ->
    ret = @buf.readUInt16BE @pos
    @pos += 2
    ret

  readDouble: ->
    ret = @buf.readDoubleBE @pos
    @pos += 8
    ret
     
  readByte: ->
    ret = @buf.readUInt8(@pos)
    @pos += 1
    ret
    
  readHexInt: ->
    s = @buf.toString 'ascii',@pos, @pos + 8
    @pos += 8
    parseInt s, 16

  readBytes: (len) ->
    unless len
      len = @readInt32()
    ret = ''
    if len
      ret = @buf.toString 'hex',@pos, @pos + len
      @pos += len
    ret
    
  readString: (len) ->
    enc = 'utf-8'
    unless len
      len = @readInt32()
    if len & 0x80000000
      enc = 'ucs2'
      len = (len & 0x7ffffffff) << 1
    ret = ''
    if len
      b = @buf.slice @pos, @pos + len
      if IS_UCS2_LE and enc is 'ucs2'
        b = swapBytes b
      ret = b.toString enc, 0, len
      @pos += len
    ret

  mark: ->
    ret = @buf.slice @marker, @pos
    @marker = @pos
    ret
    
  end: ->
    @buf.slice @marker
    
#----------------------------------------
# simple writer class
#----------------------------------------
class BufferWriter
  constructor: ->
    @buf = new Buffer 0

  buffer: ->
    @buf
    
  tell: ->
    @buf.length
      
  writeHexInt: (num, offset) ->
    s = "00000000#{num.toString 16}"[-8..]
    @buf.write s, offset, 8, 'ascii'
    
  push: (buf, start, end) ->
    b = buf
    if _.isNumber start
      if _.isNumber end
        b = buf.slice start, end
      else
        b = buf.slice start
    @buf = Buffer.concat [@buf, b]
    @
  
  pushInt: (value) ->
    b = new Buffer 4
    b.writeUInt32BE value, 0
    @push b
    @
    
  pushString: (value) ->
    if value
      if /^[\u0000-\u007f]*$/.test value
        # ascii
        b = new Buffer value, 'ascii'
        @pushInt b.length
        @push b if b.length
      else
        # value has non-ascii characters
        b = new Buffer value, 'ucs2'
        if IS_UCS2_LE
          b = swapBytes b
        @pushInt 0x80000000 + (b.length >> 1)
        @push b if b.length
    else
      @pushInt 0
    @

swapBytes = (b) ->
  l = b.length >> 1
  for i in [0...l]
    p = i << 1
    a = b[p]
    b[p] = b[p + 1]
    b[p + 1] = a
  b
