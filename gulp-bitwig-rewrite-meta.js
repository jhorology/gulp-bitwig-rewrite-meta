(function() {
  var $, BufferReader, BufferWriter, IS_UCS2_LE, PLUGIN_NAME, PluginError, _, parseMetadata, path, replaceMetadata, replacePresetChunk1, rewriteMeta, swapBytes, through, validateData,
    indexOf = [].indexOf;

  path = require('path');

  through = require('through2');

  _ = require('underscore');

  PluginError = require('plugin-error');

  PLUGIN_NAME = 'bitwig-rewrite-meta';

  // ucs2 encoding endian
  IS_UCS2_LE = (Buffer.from('a', 'ucs2'))[0];

  // bwpreset chunk1
  // ----------------------------------------------
  // Polysynth Acido.bwpreset (1.1 BETA 1)

  //  chunk identifier: 00000561
  //  ---------------------------------
  //  item identifier:  00001423 (unknown)
  //  value type:       05 (byte)
  //  value:            00
  //  ---------------------------------
  //  item identifier:  0000150a (unknown)
  //  value type:       05 (byte)
  //  value:            00
  //  ---------------------------------
  //  item identifier:  00001421 (unknown)
  //  value type:       09 (32bit)
  //  value:            00000040
  //  ---------------------------------
  //  item identifier:  000002b9 (unknown)
  //  value type:       08 (string)
  //  string size:      00000000
  //  ---------------------------------
  //  item identifier   000012de (preset_name)
  //  value type:       08 (string)
  //  string size:      00000005
  //  value:            416369646f ("Acido")
  //  ---------------------------------
  //  item identifier:  0000 009a (device_name)
  //  value type:       08 (string)
  //  string size:      00000009
  //  value:            506f6c7973796e7468 ("Polysynth")
  //  ---------------------------------
  //  item identifer:   0000009b (device_creator)
  //  value type:       08 (string)
  //  string size:      00000006
  //  value:            426974776967 ("Bitwig")
  //  ---------------------------------
  //  item identifier:  0000009c (device_type)
  //  value type:       08 (string)
  //  string size:      0000000b
  //  value:            496e737472756d656e7473 ("Instrument")
  //  ---------------------------------
  //  item identifier:  0000009d (unknown)
  //  value type:       01 (byte)
  //  value:            02
  //  ---------------------------------
  //  item identifier:  0000009e (creator)
  //  value type:       08 (string)
  //  string size:      00000005
  //  value:            436c616573 ("Claes")
  //  ---------------------------------
  //  item identifier:  0000009f (comment)
  //  value type:       08 (string)
  //  string size:      00000000
  //  ---------------------------------
  //  item identifier:  000000a1 (category)
  //  value type:       08 (string)
  //  string size:      00000004
  //  value:            42617373 ("Bass")
  //  ---------------------------------
  //  item identifier:  000000a2 (tags)
  //  value type:       08 (string)
  //  string size:      0000000d
  //  value:            6861726d6f6e6963206d6f6e6f ("harmonic mon")
  //  ---------------------------------
  //  item identifier   000000a3 (unknown) end of meta
  //  value type:       05 (byte)
  //  value:            01
  //  ---------------------------------
  //  item identifier:  0000137e (unknown)
  //  value type:       05 (byte)
  //  value:            01
  //  ---------------------------------
  //  .... don't need any more

  // ----------------------------------------------
  // Spire BA Agress Dub 02.bwpreset (1.0.10)

  //  chunk identifier: 000001a5
  //  ---------------------------------
  //  item identifier:  000002b9 (unknown)
  //  value identifier: 08 (string)
  //  string size:      00000000
  //  ---------------------------------
  //  item identifier:  000012de (preset_name)
  //  value type:       08 (string)
  //  string size:      00000000
  //  ---------------------------------
  //  item identifier:  0000009a (device_name)
  //  value type:       08 (string)
  //  string size:      00000005
  //  value:            5370697265 ("Spire")
  //  ---------------------------------
  //  item identifier:  0000009b (device_creator)
  //  value type:       08 (string)
  //  string size:      0000000c
  //  value:            52657665616c20536f756e64 ("Reveal Sound")
  //  ---------------------------------
  //  item identifier:  0000009c (device_type)
  //  value type:       08 (string)
  //  string size:      00000005
  //  value:            53796e7468 ("Synth")
  //  ---------------------------------
  //  item identifier:  0000009d (unknown)
  //  value type:       01 (byte)
  //  value:            02
  //  ---------------------------------
  //  item identifier:  0000009e (creator)
  //  value type:       08 (string)
  //  string size:      00000008
  //  value:            466163746f727931 ("Factory1")
  //  ---------------------------------
  //  item identifier:  0000009f (comment)
  //  value type:       08 (string)
  //  string size:      00000000
  //  ---------------------------------
  //  item identifier:  000000a1 (category)
  //  value type:       08 (string)
  //  string size:      00000004
  //  value:            42617373 ("Bass")
  //  ---------------------------------
  //  item identifier:  000000a2 (tags)
  //  value type:       08 (string)
  //  string size:      00000000
  //  ---------------------------------
  //  item identifier:  000000a3 (unknwon) end of meta
  //  value type:       05 (byte)
  //  value:            01
  //  ---------------------------------
  //  .... don't need any more

  // constants
  $ = {
    magic: 'BtWg',
    metaId: 'meta',
    presetType: {
      type1: 0x000001a5,
      type2: 0x00000561
    },
    valueType: {
      byte_1: 0x01,
      int16: 0x02,
      int32_1: 0x03, // since 1.2 some preset file's revision_no use 32bit int
      byte_2: 0x05,
      double: 0x07,
      string: 0x08,
      int32_2: 0x09,
      byte_array: 0x0d,
      string_array: 0x19
    },
    protectedMetaItem: {
      device_name: 0x009a,
      device_creator: 0x009b,
      device_category: 0x009c
    },
    metaItem: {
      name: 0x12de,
      creator: 0x009e,
      comment: 0x009f,
      preset_category: 0x00a1,
      tags: 0x00a2
    },
    endOfMeta: 0x00a3,
    // supported header format
    headers: [
      {
        regexp: /^BtWg[0-9a-f]{12}([0-9a-f]{8})0{8}([0-9a-f]{8})\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u0004meta/,
        size: 52,
        contentAddress: 16,
        zipContentAddress: 32
      },
      {
        regexp: /^BtWg[0-9a-f]{12}([0-9a-f]{8})0{8}([0-9a-f]{8})00\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u0004meta/,
        size: 54,
        contentAddress: 16,
        zipContentAddress: 32
      },
      {
        regexp: /^BtWg[0-9a-f]{12}([0-9a-f]{8})0{28}([0-9a-f]{8})\u0000\u0000\u0000\u0004\u0000\u0000\u0000\u0004meta/,
        size: 72,
        contentAddress: 16,
        zipContentAddress: 52
      }
    ]
  };

  module.exports = function(data) {
    return through.obj(function(file, enc, cb) {
      var error, obj, rewrite, rewrited;
      rewrited = false;
      rewrite = (err, data) => {
        var err2;
        if (rewrited) {
          this.emit('error', new PluginError(PLUGIN_NAME, 'duplicate callback'));
          return;
        }
        rewrited = true;
        if (err) {
          this.emit('error', new PluginError(PLUGIN_NAME, err));
          return cb();
        }
        try {
          rewriteMeta(file, data);
          this.push(file);
        } catch (error1) {
          err2 = error1;
          this.emit('error', new PluginError(PLUGIN_NAME, err2));
        }
        return cb();
      };
      if (!file) {
        rewrite('Files can not be empty');
        return;
      }
      if (file.isNull()) {
        this.push(file);
        return cb();
      }
      if (file.isStream()) {
        rewrite('Streaming not supported');
        return;
      }
      if (file.isBuffer()) {
        if (_.isFunction(data)) {
          try {
            obj = data(file, parseMetadata(file), rewrite);
          } catch (error1) {
            error = error1;
            rewrite(error);
          }
          if (data.length <= 2) {
            return rewrite(void 0, obj);
          }
        } else {
          return rewrite(void 0, data);
        }
      }
    });
  };

  
  // rewrite metadata
  // -------------------------------------
  // -file src file
  // -data function or object for rewrite
  rewriteMeta = function(file, data) {
    var content_offset, dirname, extname, headerData, headerFormat, headerStr, new_metadata, reader, writer, zip_content_offset;
    data = validateData(data);
    // analyze header
    headerStr = file.contents.toString('ascii', 0, 80);
    headerData = void 0;
    headerFormat = $.headers.find(function(fmt) {
      return headerData = headerStr.match(fmt.regexp);
    });
    if (!headerFormat) {
      throw new Error(`Invalid file: unknown header format. file:${file.path} header:${file.contents.toString('hex', 0, 80)}`);
    }
    
    // content data offset
    content_offset = parseInt(headerData[1], 16);
    // zip archive offset
    zip_content_offset = parseInt(headerData[2], 16);
    reader = new BufferReader(file.contents);
    writer = new BufferWriter;
    reader.position(headerFormat.size);
    new_metadata = replaceMetadata(reader, writer, data);
    //  chunk1
    reader.position(content_offset);
    writer.push(reader.mark());
    // write new content offset address to header
    writer.writeHexInt(writer.tell(), headerFormat.contentAddress);
    if (new_metadata.type === 'application/bitwig-preset') {
      replacePresetChunk1(reader, writer, data);
    }
    // has zipped content
    if (zip_content_offset) {
      reader.position(zip_content_offset);
      writer.push(reader.mark());
      // write zipped content offset address to header
      writer.writeHexInt(writer.tell(), headerFormat.zipContentAddress);
    }
    writer.push(reader.end());
    // setup output file
    extname = path.extname(file.path);
    if (data.name) {
      new_metadata.name = data.name;
      dirname = path.dirname(file.path);
      file.path = path.join(dirname, data.name + extname);
    } else {
      new_metadata.name = path.basename(file.path, extname);
    }
    file.contents = writer.buffer();
    return file.data = new_metadata;
  };

  // parse metadata chunk

  // return JSON object to explain metadata of original source file.
  parseMetadata = function(file) {
    var extname, headerData, headerFormat, headerStr, i, key, reader, ret, size, value, valueType;
    // analyze header
    headerStr = file.contents.toString('ascii', 0, 80);
    headerData = void 0;
    headerFormat = $.headers.find(function(fmt) {
      return headerData = headerStr.match(fmt.regexp);
    });
    if (!headerFormat) {
      throw new Error(`Invalid file: unknown header format. file:${file.path} header:${file.contents.toString('hex', 0, 80)}`);
    }
    reader = new BufferReader(file.contents);
    reader.position(headerFormat.size);
    extname = path.extname(file.path);
    ret = {
      file: file.path,
      name: path.basename(file.path, extname)
    };
    // iterate metadata items
    while (reader.readInt32() === 1) {
      // read key kength
      key = reader.readString();
      if (!key) {
        throw new Error(`Invalid file: metadata item name can not be empty. file:${file.path}`);
      }
      valueType = reader.readByte();
      value = void 0;
      switch (valueType) {
        case $.valueType.string:
          value = reader.readString();
          if (key === 'tags') {
            value = value ? value.split(' ') : [];
          }
          break;
        case $.valueType.int16:
          value = reader.readInt16();
          break;
        case $.valueType.int32_1:
          value = reader.readInt32();
          break;
        case $.valueType.double:
          value = reader.readDouble();
          break;
        case $.valueType.byte_array:
          value = reader.readBytes();
          break;
        case $.valueType.string_array:
          size = reader.readInt32();
          value = (function() {
            var j, ref, results;
            results = [];
            for (i = j = 0, ref = size; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
              results.push(reader.readString());
            }
            return results;
          })();
          break;
        default:
          throw new Error(`Unsupported file format: unknown value type. file:${file.path} key:${key} valueType:${valueType}`);
      }
      ret[key] = value;
    }
    return ret;
  };

  // reprace metadata chunk

  // return JSON object to explain metadata
  replaceMetadata = function(reader, writer, data) {
    var i, key, new_metadata, size, value, valueType;
    new_metadata = {};
    // iterate metadata items
    while (reader.readInt32() === 1) {
      // read key kength
      key = reader.readString();
      if (!key) {
        throw new Error("Invalid file: metadata item name can not be empty.");
      }
      valueType = reader.readByte();
      value = void 0;
      switch (valueType) {
        case $.valueType.string:
          if ((indexOf.call(_.keys($.metaItem), key) >= 0) && (indexOf.call(_.keys(data), key) >= 0)) {
            writer.push(reader.mark());
            value = data[key];
            if (key === 'tags') {
              writer.pushString(value.join(' '));
            } else {
              writer.pushString(value);
            }
            reader.readString();
            reader.mark();
          } else {
            value = reader.readString();
            if (key === 'tags') {
              value = value ? value.split(' ') : [];
            }
          }
          break;
        case $.valueType.int16:
          value = reader.readInt16();
          break;
        case $.valueType.int32_1:
          value = reader.readInt32();
          break;
        case $.valueType.double:
          value = reader.readDouble();
          break;
        case $.valueType.byte_array:
          value = reader.readBytes();
          break;
        case $.valueType.string_array:
          size = reader.readInt32();
          value = (function() {
            var j, ref, results;
            results = [];
            for (i = j = 0, ref = size; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
              results.push(reader.readString());
            }
            return results;
          })();
          break;
        default:
          throw new Error(`Unsupported file format: unknown value type. key: ${key} valueType:${valueType}`);
      }
      new_metadata[key] = value;
    }
    return new_metadata;
  };

  // reprace chunk1 (.bwpreset only)
  replacePresetChunk1 = function(reader, writer, data) {
    var chunkId, itemId, key, oldValue, results, value, valueType;
    chunkId = reader.readInt32();
    results = [];
    // iterate chunk1 items
    while ((itemId = reader.readInt32()) !== $.endOfMeta) {
      value = void 0;
      valueType = reader.readByte();
      key = _.findKey($.metaItem, function(v, k, o) {
        return v === itemId;
      });
      if (key && key in data) {
        if (valueType !== $.valueType.string) {
          throw new Error(`Unsupported file format: unknow value type. valueType:${valueType}`);
        }
        writer.push(reader.mark());
        oldValue = reader.readString();
        value = key === 'tags' ? data.tags.join(' ') : data[key];
        if (key === 'name' && oldValue === '') {
          // old preset file dosen't have name
          value = '';
        }
        writer.pushString(value);
        results.push(reader.mark());
      } else {
        switch (valueType) {
          case $.valueType.byte_1:
            results.push(value = reader.readByte());
            break;
          case $.valueType.byte_2:
            results.push(value = reader.readByte());
            break;
          case $.valueType.string:
            results.push(value = reader.readString());
            break;
          case $.valueType.int32_2:
            results.push(value = reader.readInt32());
            break;
          default:
            throw new Error(`Unsupported File Format: unknown value type. itemId:${itemId} valueType:${valueType}`);
        }
      }
    }
    return results;
  };

  
  //----------------------------------------
  // validate data object for rewrite
  //----------------------------------------
  validateData = function(data) {
    var j, keys, len1, ref, tag;
    data = data || {};
    keys = _.keys(data);
    if ((indexOf.call(keys, 'name') >= 0) && !_.isString(data.name)) {
      throw new Error(`option name must be string. name: ${data.name}`);
    }
    if ((indexOf.call(keys, 'creator') >= 0) && !_.isString(data.creator)) {
      throw new Error(`option creator must be string. creator: ${data.creator}`);
    }
    if ((indexOf.call(keys, 'comment') >= 0) && !_.isString(data.comment)) {
      throw new Error(`option comment must be string. comment: ${data.comment}`);
    }
    if ((indexOf.call(keys, 'preset_category') >= 0) && !_.isString(data.preset_category)) {
      throw new Error(`option preset_category must be string. preset_category: ${data.preset_category}`);
    }
    if (indexOf.call(keys, 'tags') >= 0) {
      if (!_.isArray(data.tags)) {
        throw new Error(`option tags must be array of strings. tags: ${data.tags}`);
      }
      ref = data.tags;
      for (j = 0, len1 = ref.length; j < len1; j++) {
        tag = ref[j];
        if (!_.isString(tag)) {
          throw new Error(`option tags must be array of strings. tags: ${data.tags}`);
        }
        if ((tag.indexOf(' ')) >= 0) {
          throw new Error(`tag can't contain spaces. tags: ${tag}`);
        }
      }
    }
    return data;
  };

  //----------------------------------------
  // simple reader class
  //----------------------------------------
  BufferReader = class BufferReader {
    constructor(buf) {
      this.buf = buf;
      this.marker = 0;
      this.pos = 0;
    }

    skip(n) {
      this.pos += n;
      return this;
    }

    position(pos) {
      this.pos = pos;
      return this;
    }

    tell() {
      return this.pos;
    }

    readInt32() {
      var ret;
      ret = this.buf.readUInt32BE(this.pos);
      this.pos += 4;
      return ret;
    }

    readInt16() {
      var ret;
      ret = this.buf.readUInt16BE(this.pos);
      this.pos += 2;
      return ret;
    }

    readDouble() {
      var ret;
      ret = this.buf.readDoubleBE(this.pos);
      this.pos += 8;
      return ret;
    }

    readByte() {
      var ret;
      ret = this.buf.readUInt8(this.pos);
      this.pos += 1;
      return ret;
    }

    readHexInt() {
      var s;
      s = this.buf.toString('ascii', this.pos, this.pos + 8);
      this.pos += 8;
      return parseInt(s, 16);
    }

    readBytes(len) {
      var ret;
      if (!len) {
        len = this.readInt32();
      }
      ret = '';
      if (len) {
        ret = this.buf.toString('hex', this.pos, this.pos + len);
        this.pos += len;
      }
      return ret;
    }

    readString(len) {
      var b, enc, ret;
      enc = 'utf-8';
      if (!len) {
        len = this.readInt32();
      }
      if (len & 0x80000000) {
        enc = 'ucs2';
        len = (len & 0x7ffffffff) << 1;
      }
      ret = '';
      if (len) {
        b = this.buf.slice(this.pos, this.pos + len);
        if (IS_UCS2_LE && enc === 'ucs2') {
          b = swapBytes(b);
        }
        ret = b.toString(enc, 0, len);
        this.pos += len;
      }
      return ret;
    }

    mark() {
      var ret;
      ret = this.buf.slice(this.marker, this.pos);
      this.marker = this.pos;
      return ret;
    }

    end() {
      return this.buf.slice(this.marker);
    }

  };

  
  //----------------------------------------
  // simple writer class
  //----------------------------------------
  BufferWriter = class BufferWriter {
    constructor() {
      this.buf = Buffer.alloc(0);
    }

    buffer() {
      return this.buf;
    }

    tell() {
      return this.buf.length;
    }

    writeHexInt(num, offset) {
      var s;
      s = `00000000${num.toString(16)}`.slice(-8);
      return this.buf.write(s, offset, 8, 'ascii');
    }

    push(buf, start, end) {
      var b;
      b = buf;
      if (_.isNumber(start)) {
        if (_.isNumber(end)) {
          b = buf.slice(start, end);
        } else {
          b = buf.slice(start);
        }
      }
      this.buf = Buffer.concat([this.buf, b]);
      return this;
    }

    pushInt(value) {
      var b;
      b = Buffer.alloc(4);
      b.writeUInt32BE(value, 0);
      this.push(b);
      return this;
    }

    pushString(value) {
      var b;
      if (value) {
        if (/^[\u0000-\u007f]*$/.test(value)) {
          // ascii
          b = Buffer.from(value, 'ascii');
          this.pushInt(b.length);
          if (b.length) {
            this.push(b);
          }
        } else {
          // value has non-ascii characters
          b = Buffer.from(value, 'ucs2');
          if (IS_UCS2_LE) {
            b = swapBytes(b);
          }
          this.pushInt(0x80000000 + (b.length >> 1));
          if (b.length) {
            this.push(b);
          }
        }
      } else {
        this.pushInt(0);
      }
      return this;
    }

  };

  swapBytes = function(b) {
    var a, i, j, l, p, ref;
    l = b.length >> 1;
    for (i = j = 0, ref = l; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
      p = i << 1;
      a = b[p];
      b[p] = b[p + 1];
      b[p + 1] = a;
    }
    return b;
  };

}).call(this);
