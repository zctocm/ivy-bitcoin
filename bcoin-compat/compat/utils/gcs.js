/*!
 * gcs.js - gcs filters for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');

var _require = require('./int64'),
    U64 = _require.U64;

var digest = require('../crypto/digest');
var siphash = require('../crypto/siphash');
var DUMMY = Buffer.alloc(0);
var EOF = new U64(-1);

/**
 * GCSFilter
 * @alias module:utils.GCSFilter
 * @constructor
 */

function GCSFilter() {
  this.n = 0;
  this.p = 0;
  this.m = new U64(0);
  this.data = DUMMY;
}

GCSFilter.prototype.hash = function hash(enc) {
  var h = digest.hash256(this.data);
  return enc === 'hex' ? h.toString('hex') : h;
};

GCSFilter.prototype.header = function header(prev) {
  return digest.root256(this.hash(), prev);
};

GCSFilter.prototype.match = function match(key, data) {
  var br = new BitReader(this.data);
  var term = siphash24(data, key).imod(this.m);

  var last = new U64(0);

  while (last.lt(term)) {
    var value = this.readU64(br);

    if (value === EOF) return false;

    value.iadd(last);

    if (value.eq(term)) return true;

    last = value;
  }

  return false;
};

GCSFilter.prototype.matchAny = function matchAny(key, items) {
  assert(items.length > 0);

  var br = new BitReader(this.data);
  var last1 = new U64(0);
  var values = [];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(items), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var item = _step.value;

      var hash = siphash24(item, key).imod(this.m);
      values.push(hash);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  values.sort(compare);

  var last2 = values[0];
  var i = 1;

  for (;;) {
    var cmp = last1.cmp(last2);

    if (cmp === 0) break;

    if (cmp > 0) {
      if (i < values.length) {
        last2 = values[i];
        i += 1;
        continue;
      }
      return false;
    }

    var value = this.readU64(br);

    if (value === EOF) return false;

    last1.iadd(value);
  }

  return true;
};

GCSFilter.prototype.readU64 = function readU64(br) {
  try {
    return this._readU64(br);
  } catch (e) {
    if (e.message === 'EOF') return EOF;
    throw e;
  }
};

GCSFilter.prototype._readU64 = function _readU64(br) {
  var num = new U64(0);

  // Unary
  while (br.readBit()) {
    num.iaddn(1);
  }var rem = br.readBits64(this.p);

  return num.ishln(this.p).ior(rem);
};

GCSFilter.prototype.toBytes = function toBytes() {
  return this.data;
};

GCSFilter.prototype.toNBytes = function toNBytes() {
  var data = Buffer.allocUnsafe(4 + this.data.length);
  data.writeUInt32BE(this.n, 0, true);
  this.data.copy(data, 4);
  return data;
};

GCSFilter.prototype.toPBytes = function toPBytes() {
  var data = Buffer.allocUnsafe(1 + this.data.length);
  data.writeUInt8(this.p, 0, true);
  this.data.copy(data, 1);
  return data;
};

GCSFilter.prototype.toNPBytes = function toNPBytes() {
  var data = Buffer.allocUnsafe(5 + this.data.length);
  data.writeUInt32BE(this.n, 0, true);
  data.writeUInt8(this.p, 4, true);
  this.data.copy(data, 5);
  return data;
};

GCSFilter.prototype.toRaw = function toRaw() {
  assert(this.p === 20);
  return this.toNBytes();
};

GCSFilter.prototype.fromItems = function fromItems(P, key, items) {
  assert(typeof P === 'number' && isFinite(P));
  assert(P >= 0 && P <= 32);

  assert(Buffer.isBuffer(key));
  assert(key.length === 16);

  assert(Array.isArray(items));
  assert(items.length > 0);
  assert(items.length <= 0xffffffff);

  this.n = items.length;
  this.p = P;
  this.m = U64(this.n).ishln(this.p);

  var values = [];

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(items), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var item = _step2.value;

      assert(Buffer.isBuffer(item));
      var hash = siphash24(item, key).imod(this.m);
      values.push(hash);
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  values.sort(compare);

  var bw = new BitWriter();

  var last = new U64(0);

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(values), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var hash = _step3.value;

      var rem = hash.sub(last).imaskn(this.p);
      var value = hash.sub(last).isub(rem).ishrn(this.p);

      last = hash;

      // Unary
      while (!value.isZero()) {
        bw.writeBit(1);
        value.isubn(1);
      }
      bw.writeBit(0);

      bw.writeBits64(rem, this.p);
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  this.data = bw.render();

  return this;
};

GCSFilter.prototype.fromBytes = function fromBytes(N, P, data) {
  assert(typeof N === 'number' && isFinite(N));
  assert(typeof P === 'number' && isFinite(P));
  assert(P >= 0 && P <= 32);
  assert(Buffer.isBuffer(data));

  this.n = N;
  this.p = P;
  this.m = U64(this.n).ishln(this.p);
  this.data = data;

  return this;
};

GCSFilter.prototype.fromNBytes = function fromNBytes(P, data) {
  assert(typeof P === 'number' && isFinite(P));
  assert(Buffer.isBuffer(data));
  assert(data.length >= 4);

  var N = data.readUInt32BE(0, true);

  return this.fromBytes(N, P, data.slice(4));
};

GCSFilter.prototype.fromPBytes = function fromPBytes(N, data) {
  assert(typeof N === 'number' && isFinite(N));
  assert(Buffer.isBuffer(data));
  assert(data.length >= 1);

  var P = data.readUInt8(0, true);

  return this.fromBytes(N, P, data.slice(1));
};

GCSFilter.prototype.fromNPBytes = function fromNPBytes(data) {
  assert(Buffer.isBuffer(data));
  assert(data.length >= 5);

  var N = data.readUInt32BE(0, true);
  var P = data.readUInt8(4, true);

  return this.fromBytes(N, P, data.slice(5));
};

GCSFilter.prototype.fromRaw = function fromRaw(data) {
  return this.fromNBytes(20, data);
};

GCSFilter.prototype.fromBlock = function fromBlock(block) {
  var hash = block.hash();
  var key = hash.slice(0, 16);
  var items = [];

  for (var i = 0; i < block.txs.length; i++) {
    var tx = block.txs[i];

    if (i > 0) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = (0, _getIterator3.default)(tx.inputs), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var input = _step4.value;

          items.push(input.prevout.toRaw());
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }

    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = (0, _getIterator3.default)(tx.outputs), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var output = _step5.value;

        getPushes(items, output.script);
      }
    } catch (err) {
      _didIteratorError5 = true;
      _iteratorError5 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion5 && _iterator5.return) {
          _iterator5.return();
        }
      } finally {
        if (_didIteratorError5) {
          throw _iteratorError5;
        }
      }
    }
  }

  return this.fromItems(20, key, items);
};

GCSFilter.prototype.fromExtended = function fromExtended(block) {
  var hash = block.hash();
  var key = hash.slice(0, 16);
  var items = [];

  for (var i = 0; i < block.txs.length; i++) {
    var tx = block.txs[i];

    items.push(tx.hash());

    if (i > 0) {
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;
      var _iteratorError6 = undefined;

      try {
        for (var _iterator6 = (0, _getIterator3.default)(tx.inputs), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
          var input = _step6.value;

          getWitness(items, input.witness);
          getPushes(items, input.script);
        }
      } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion6 && _iterator6.return) {
            _iterator6.return();
          }
        } finally {
          if (_didIteratorError6) {
            throw _iteratorError6;
          }
        }
      }
    }
  }

  return this.fromItems(20, key, items);
};

GCSFilter.fromItems = function fromItems(P, key, items) {
  return new GCSFilter().fromItems(P, key, items);
};

GCSFilter.fromBytes = function fromBytes(N, P, data) {
  return new GCSFilter().fromBytes(N, P, data);
};

GCSFilter.fromNBytes = function fromNBytes(P, data) {
  return new GCSFilter().fromNBytes(P, data);
};

GCSFilter.fromPBytes = function fromPBytes(N, data) {
  return new GCSFilter().fromPBytes(N, data);
};

GCSFilter.fromNPBytes = function fromNPBytes(data) {
  return new GCSFilter().fromNPBytes(data);
};

GCSFilter.fromRaw = function fromRaw(data) {
  return new GCSFilter().fromRaw(data);
};

GCSFilter.fromBlock = function fromBlock(block) {
  return new GCSFilter().fromBlock(block);
};

GCSFilter.fromExtended = function fromExtended(block) {
  return new GCSFilter().fromExtended(block);
};

/**
 * BitWriter
 * @constructor
 * @ignore
 */

function BitWriter() {
  this.stream = [];
  this.remain = 0;
}

BitWriter.prototype.writeBit = function writeBit(bit) {
  if (this.remain === 0) {
    this.stream.push(0);
    this.remain = 8;
  }

  if (bit) {
    var index = this.stream.length - 1;
    this.stream[index] |= 1 << this.remain - 1;
  }

  this.remain--;
};

BitWriter.prototype.writeByte = function writeByte(ch) {
  if (this.remain === 0) {
    this.stream.push(0);
    this.remain = 8;
  }

  var index = this.stream.length - 1;

  this.stream[index] |= ch >> 8 - this.remain & 0xff;
  this.stream.push(0);
  this.stream[index + 1] = ch << this.remain & 0xff;
};

BitWriter.prototype.writeBits = function writeBits(num, count) {
  assert(count >= 0);
  assert(count <= 32);

  num <<= 32 - count;

  while (count >= 8) {
    var ch = num >>> 24;
    this.writeByte(ch);
    num <<= 8;
    count -= 8;
  }

  while (count > 0) {
    var bit = num >>> 31;
    this.writeBit(bit);
    num <<= 1;
    count -= 1;
  }
};

BitWriter.prototype.writeBits64 = function writeBits64(num, count) {
  assert(count >= 0);
  assert(count <= 64);

  if (count > 32) {
    this.writeBits(num.hi, count - 32);
    this.writeBits(num.lo, 32);
  } else {
    this.writeBits(num.lo, count);
  }
};

BitWriter.prototype.render = function render() {
  var data = Buffer.allocUnsafe(this.stream.length);

  for (var i = 0; i < this.stream.length; i++) {
    data[i] = this.stream[i];
  }return data;
};

/**
 * BitReader
 * @constructor
 * @ignore
 */

function BitReader(data) {
  this.stream = data;
  this.pos = 0;
  this.remain = 8;
}

BitReader.prototype.readBit = function readBit() {
  if (this.pos >= this.stream.length) throw new Error('EOF');

  if (this.remain === 0) {
    this.pos += 1;

    if (this.pos >= this.stream.length) throw new Error('EOF');

    this.remain = 8;
  }

  this.remain -= 1;

  return this.stream[this.pos] >> this.remain & 1;
};

BitReader.prototype.readByte = function readByte() {
  if (this.pos >= this.stream.length) throw new Error('EOF');

  if (this.remain === 0) {
    this.pos += 1;

    if (this.pos >= this.stream.length) throw new Error('EOF');

    this.remain = 8;
  }

  if (this.remain === 8) {
    var _ch = this.stream[this.pos];
    this.pos += 1;
    return _ch;
  }

  var ch = this.stream[this.pos] & (1 << this.remain) - 1;
  ch <<= 8 - this.remain;

  this.pos += 1;

  if (this.pos >= this.stream.length) throw new Error('EOF');

  ch |= this.stream[this.pos] >> this.remain;

  return ch;
};

BitReader.prototype.readBits = function readBits(count) {
  assert(count >= 0);
  assert(count <= 32);

  var num = 0;

  while (count >= 8) {
    num <<= 8;
    num |= this.readByte();
    count -= 8;
  }

  while (count > 0) {
    num <<= 1;
    num |= this.readBit();
    count -= 1;
  }

  return num;
};

BitReader.prototype.readBits64 = function readBits64(count) {
  assert(count >= 0);
  assert(count <= 64);

  var num = new U64();

  if (count > 32) {
    num.hi = this.readBits(count - 32);
    num.lo = this.readBits(32);
  } else {
    num.lo = this.readBits(count);
  }

  return num;
};

/*
 * Helpers
 */

function compare(a, b) {
  return a.cmp(b);
}

function siphash24(data, key) {
  var _siphash = siphash(data, key),
      _siphash2 = (0, _slicedToArray3.default)(_siphash, 2),
      hi = _siphash2[0],
      lo = _siphash2[1];

  return U64.fromBits(hi, lo);
}

function getPushes(items, script) {
  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(script.code), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var op = _step7.value;

      if (!op.data || op.data.length === 0) continue;

      items.push(op.data);
    }
  } catch (err) {
    _didIteratorError7 = true;
    _iteratorError7 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion7 && _iterator7.return) {
        _iterator7.return();
      }
    } finally {
      if (_didIteratorError7) {
        throw _iteratorError7;
      }
    }
  }
}

function getWitness(items, witness) {
  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = (0, _getIterator3.default)(witness.items), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var item = _step8.value;

      if (item.length === 0) continue;

      items.push(item);
    }
  } catch (err) {
    _didIteratorError8 = true;
    _iteratorError8 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion8 && _iterator8.return) {
        _iterator8.return();
      }
    } finally {
      if (_didIteratorError8) {
        throw _iteratorError8;
      }
    }
  }
}

/*
 * Expose
 */

module.exports = GCSFilter;