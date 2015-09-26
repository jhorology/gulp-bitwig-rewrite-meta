(function() {
  var $, BufferReader, BufferWriter, IS_UCS2_LE, PLUGIN_NAME, _, gutil, parseMetadata, path, replaceMetadata, replacePresetChunk1, rewriteMeta, swapBytes, through, validateData,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  path = require('path');

  through = require('through2');

  gutil = require('gulp-util');

  _ = require('underscore');

  PLUGIN_NAME = 'bitwig-rewrite-meta';

  IS_UCS2_LE = (new Buffer('a', 'ucs2'))[0];

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
      byte_2: 0x05,
      double: 0x07,
      string: 0x08,
      int32: 0x09,
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
    endOfMeta: 0x00a3
  };

  module.exports = function(data) {
    return through.obj(function(file, enc, cb) {
      var error, error1, obj, rewrite, rewrited;
      rewrited = false;
      rewrite = (function(_this) {
        return function(err, data) {
          var error, error1;
          if (rewrited) {
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'duplicate callback'));
            return;
          }
          rewrited = true;
          if (err) {
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
            return cb();
          }
          try {
            rewriteMeta(file, data);
            _this.push(file);
          } catch (error1) {
            error = error1;
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
          }
          return cb();
        };
      })(this);
      if (!file) {
        rewrite('Files can not be empty');
      }
      if (file.isNull()) {
        this.push(file);
        return cb();
      }
      if (file.isStream()) {
        rewrite('Streaming not supported');
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

  rewriteMeta = function(file, data) {
    var chunk1_offset, chunk2_offset, dirname, extname, magic, new_chunk1_offset, new_chunk2_offset, new_metadata, reader, writer;
    reader = new BufferReader(file.contents);
    writer = new BufferWriter;
    data = validateData(data);
    if ((magic = reader.readString(4)) !== $.magic) {
      throw new Error("Invalid file: unknown file magic:" + magic);
    }
    reader.position(16);
    chunk1_offset = reader.readHexInt();
    reader.position(32);
    chunk2_offset = reader.readHexInt();
    reader.position(48);
    if (reader.readString(4) !== $.metaId) {
      throw new Error("Invalid file: metadata not contained.");
    }
    new_metadata = replaceMetadata(reader, writer, data);
    reader.position(chunk1_offset);
    writer.push(reader.mark());
    new_chunk1_offset = writer.tell();
    writer.writeHexInt(new_chunk1_offset, 16);
    if (new_metadata.type === 'application/bitwig-preset') {
      replacePresetChunk1(reader, writer, data);
    }
    if (chunk2_offset) {
      reader.position(chunk2_offset);
      writer.push(reader.mark());
      new_chunk2_offset = writer.tell();
      writer.writeHexInt(new_chunk2_offset, 32);
    }
    writer.push(reader.end());
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

  parseMetadata = function(file) {
    var extname, i, key, reader, ret, size, value, valueType;
    reader = new BufferReader(file.contents);
    if (reader.readString(4) !== $.magic) {
      throw new Error("Invalid file: unknown file magic:" + magic);
    }
    reader.position(48);
    if (reader.readString(4) !== $.metaId) {
      throw new Error("Invalid file: metadata not contained.");
    }
    extname = path.extname(file.path);
    ret = {
      file: file.path,
      name: path.basename(file.path, extname)
    };
    while (reader.readInt32() === 1) {
      key = reader.readString();
      if (!key) {
        throw new Error("Invalid file: metadata item name can not be empty.");
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
            for (i = j = 0, ref = size; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
              results.push(reader.readString());
            }
            return results;
          })();
          break;
        default:
          throw new Error("Unsupported file format: unknown value type. key: " + key + " valueType:" + valueType);
      }
      ret[key] = value;
    }
    return ret;
  };

  replaceMetadata = function(reader, writer, data) {
    var i, key, new_metadata, size, value, valueType;
    new_metadata = {};
    while (reader.readInt32() === 1) {
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
            for (i = j = 0, ref = size; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
              results.push(reader.readString());
            }
            return results;
          })();
          break;
        default:
          throw new Error("Unsupported file format: unknown value type. key: " + key + " valueType:" + valueType);
      }
      new_metadata[key] = value;
    }
    return new_metadata;
  };

  replacePresetChunk1 = function(reader, writer, data) {
    var chunkId, itemId, key, oldValue, results, value, valueType;
    chunkId = reader.readInt32();
    results = [];
    while ((itemId = reader.readInt32()) !== $.endOfMeta) {
      value = void 0;
      valueType = reader.readByte();
      key = _.findKey($.metaItem, function(v, k, o) {
        return v === itemId;
      });
      if (key && key in data) {
        if (valueType !== $.valueType.string) {
          throw new Error("Unsupported file format: unknow value type. valueType:" + valueType);
        }
        writer.push(reader.mark());
        oldValue = reader.readString();
        value = key === 'tags' ? data.tags.join(' ') : data[key];
        if (key === 'name' && oldValue === '') {
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
          case $.valueType.int32:
            results.push(value = reader.readInt32());
            break;
          default:
            throw new Error("Unsupported File Format: unknown value type. itemId:" + itemId + " valueType:" + valueType);
        }
      }
    }
    return results;
  };

  validateData = function(data) {
    var j, len1, ref, tag;
    data = data || {};
    if (data.name && !_.isString(data.name)) {
      throw new Error('option name must be string');
    }
    if (data.creator && !_.isString(data.creator)) {
      throw new Error('option creator must be string');
    }
    if (data.comment && !_.isString(data.comment)) {
      throw new Error('option comment must be string');
    }
    if (data.preset_category && !_.isString(data.preset_category)) {
      throw new Error('option preset_category must be string');
    }
    if (data.tags) {
      if (!_.isArray(data.tags)) {
        throw new Error('option tags must be array of strings');
      }
      ref = data.tags;
      for (j = 0, len1 = ref.length; j < len1; j++) {
        tag = ref[j];
        if (!_.isString(tag)) {
          throw new Error('option tags must be array of strings');
        }
      }
    }
    return data;
  };

  BufferReader = (function() {
    function BufferReader(buf) {
      this.buf = buf;
      this.marker = 0;
      this.pos = 0;
    }

    BufferReader.prototype.skip = function(n) {
      this.pos += n;
      return this;
    };

    BufferReader.prototype.position = function(pos) {
      this.pos = pos;
      return this;
    };

    BufferReader.prototype.tell = function() {
      return this.pos;
    };

    BufferReader.prototype.readInt32 = function() {
      var ret;
      ret = this.buf.readUInt32BE(this.pos);
      this.pos += 4;
      return ret;
    };

    BufferReader.prototype.readInt16 = function() {
      var ret;
      ret = this.buf.readUInt16BE(this.pos);
      this.pos += 2;
      return ret;
    };

    BufferReader.prototype.readDouble = function() {
      var ret;
      ret = this.buf.readDoubleBE(this.pos);
      this.pos += 8;
      return ret;
    };

    BufferReader.prototype.readByte = function() {
      var ret;
      ret = this.buf.readUInt8(this.pos);
      this.pos += 1;
      return ret;
    };

    BufferReader.prototype.readHexInt = function() {
      var s;
      s = this.buf.toString('ascii', this.pos, this.pos + 8);
      this.pos += 8;
      return parseInt(s, 16);
    };

    BufferReader.prototype.readBytes = function(len) {
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
    };

    BufferReader.prototype.readString = function(len) {
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
    };

    BufferReader.prototype.mark = function() {
      var ret;
      ret = this.buf.slice(this.marker, this.pos);
      this.marker = this.pos;
      return ret;
    };

    BufferReader.prototype.end = function() {
      return this.buf.slice(this.marker);
    };

    return BufferReader;

  })();

  BufferWriter = (function() {
    function BufferWriter() {
      this.buf = new Buffer(0);
    }

    BufferWriter.prototype.buffer = function() {
      return this.buf;
    };

    BufferWriter.prototype.tell = function() {
      return this.buf.length;
    };

    BufferWriter.prototype.writeHexInt = function(num, offset) {
      var s;
      s = ("00000000" + (num.toString(16))).slice(-8);
      return this.buf.write(s, offset, 8, 'ascii');
    };

    BufferWriter.prototype.push = function(buf, start, end) {
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
    };

    BufferWriter.prototype.pushInt = function(value) {
      var b;
      b = new Buffer(4);
      b.writeUInt32BE(value, 0);
      this.push(b);
      return this;
    };

    BufferWriter.prototype.pushString = function(value) {
      var b;
      if (value) {
        if (/^[\u0000-\u007f]*$/.test(value)) {
          b = new Buffer(value, 'ascii');
          this.pushInt(b.length);
          if (b.length) {
            this.push(b);
          }
        } else {
          b = new Buffer(value, 'ucs2');
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
    };

    return BufferWriter;

  })();

  swapBytes = function(b) {
    var a, i, j, l, p, ref;
    l = b.length >> 1;
    for (i = j = 0, ref = l; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
      p = i << 1;
      a = b[p];
      b[p] = b[p + 1];
      b[p + 1] = a;
    }
    return b;
  };

}).call(this);
