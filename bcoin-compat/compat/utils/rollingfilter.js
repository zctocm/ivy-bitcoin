/*!
 * rollingfilter.js - rolling bloom filter for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var murmur3 = require('./murmur3');
var sum32 = murmur3.sum32;
var mul32 = murmur3.mul32;
var DUMMY = Buffer.alloc(0);

/**
 * A rolling bloom filter used internally
 * (do not relay this on the p2p network).
 * @alias module:utils.RollingFilter
 * @constructor
 * @param {Number} items - Expected number of items.
 * @param {Number} rate - False positive rate (0.0-1.0).
 */

function RollingFilter(items, rate) {
  if (!(this instanceof RollingFilter)) return new RollingFilter(items, rate);

  this.entries = 0;
  this.generation = 1;
  this.n = 0;
  this.limit = 0;
  this.size = 0;
  this.items = 0;
  this.tweak = 0;
  this.filter = DUMMY;

  if (items != null) this.fromRate(items, rate);
}

/**
 * Inject properties from items and FPR.
 * @private
 * @param {Number} items - Expected number of items.
 * @param {Number} rate - False positive rate (0.0-1.0).
 * @returns {RollingFilter}
 */

RollingFilter.prototype.fromRate = function fromRate(items, rate) {
  assert(typeof items === 'number', '`items` must be a number.');
  assert(items > 0, '`items` must be greater than zero.');
  assert((0, _isSafeInteger2.default)(items), '`items` must be an integer.');
  assert(typeof rate === 'number', '`rate` must be a number.');
  assert(rate >= 0 && rate <= 1, '`rate` must be between 0.0 and 1.0.');

  var logRate = Math.log(rate);

  var n = Math.max(1, Math.min(Math.round(logRate / Math.log(0.5)), 50));
  var limit = (items + 1) / 2 | 0;

  var max = limit * 3;

  var size = -1 * n * max / Math.log(1.0 - Math.exp(logRate / n));
  size = Math.ceil(size);

  items = ((size + 63) / 64 | 0) << 1;
  items >>>= 0;
  items = Math.max(1, items);

  var tweak = Math.random() * 0x100000000 >>> 0;

  var filter = Buffer.allocUnsafe(items * 8);
  filter.fill(0);

  this.n = n;
  this.limit = limit;
  this.size = size;
  this.items = items;
  this.tweak = tweak;
  this.filter = filter;

  return this;
};

/**
 * Instantiate rolling filter from items and FPR.
 * @param {Number} items - Expected number of items.
 * @param {Number} rate - False positive rate (0.0-1.0).
 * @returns {RollingFilter}
 */

RollingFilter.fromRate = function fromRate(items, rate) {
  return new RollingFilter().fromRate(items, rate);
};

/**
 * Perform the mumur3 hash on data.
 * @param {Buffer} val
 * @param {Number} seed
 * @returns {Number}
 */

RollingFilter.prototype.hash = function hash(val, n) {
  return murmur3(val, sum32(mul32(n, 0xfba4c795), this.tweak));
};

/**
 * Reset the filter.
 */

RollingFilter.prototype.reset = function reset() {
  if (this.entries === 0) return;

  this.entries = 0;
  this.generation = 1;
  this.filter.fill(0);
};

/**
 * Add data to the filter.
 * @param {Buffer|String}
 * @param {String?} enc - Can be any of the Buffer object's encodings.
 */

RollingFilter.prototype.add = function add(val, enc) {
  if (typeof val === 'string') val = Buffer.from(val, enc);

  if (this.entries === this.limit) {
    this.entries = 0;
    this.generation += 1;

    if (this.generation === 4) this.generation = 1;

    var m1 = (this.generation & 1) * 0xffffffff;
    var m2 = (this.generation >>> 1) * 0xffffffff;

    for (var i = 0; i < this.items; i += 2) {
      var pos1 = i * 8;
      var pos2 = (i + 1) * 8;
      var v1 = read(this.filter, pos1);
      var v2 = read(this.filter, pos2);
      var mhi = v1.hi ^ m1 | v2.hi ^ m2;
      var mlo = v1.lo ^ m1 | v2.lo ^ m2;

      v1.hi &= mhi;
      v1.lo &= mlo;
      v2.hi &= mhi;
      v2.lo &= mlo;

      write(this.filter, v1, pos1);
      write(this.filter, v2, pos2);
    }
  }

  this.entries += 1;

  for (var _i = 0; _i < this.n; _i++) {
    var hash = this.hash(val, _i);
    var bits = hash & 0x3f;
    var pos = (hash >>> 6) % this.items;
    var _pos = (pos & ~1) * 8;
    var _pos2 = (pos | 1) * 8;
    var bit = bits % 8;
    var oct = (bits - bit) / 8;

    this.filter[_pos + oct] &= ~(1 << bit);
    this.filter[_pos + oct] |= (this.generation & 1) << bit;

    this.filter[_pos2 + oct] &= ~(1 << bit);
    this.filter[_pos2 + oct] |= this.generation >>> 1 << bit;
  }
};

/**
 * Test whether data is present in the filter.
 * @param {Buffer|String} val
 * @param {String?} enc - Can be any of the Buffer object's encodings.
 * @returns {Boolean}
 */

RollingFilter.prototype.test = function test(val, enc) {
  if (this.entries === 0) return false;

  if (typeof val === 'string') val = Buffer.from(val, enc);

  for (var i = 0; i < this.n; i++) {
    var hash = this.hash(val, i);
    var bits = hash & 0x3f;
    var pos = (hash >>> 6) % this.items;
    var pos1 = (pos & ~1) * 8;
    var pos2 = (pos | 1) * 8;
    var bit = bits % 8;
    var oct = (bits - bit) / 8;

    var bit1 = this.filter[pos1 + oct] >>> bit & 1;
    var bit2 = this.filter[pos2 + oct] >>> bit & 1;

    if ((bit1 | bit2) === 0) return false;
  }

  return true;
};

/**
 * Test whether data is present in the
 * filter and potentially add data.
 * @param {Buffer|String} val
 * @param {String?} enc - Can be any of the Buffer object's encodings.
 * @returns {Boolean} Whether data was added.
 */

RollingFilter.prototype.added = function added(val, enc) {
  if (typeof val === 'string') val = Buffer.from(val, enc);

  if (!this.test(val)) {
    this.add(val);
    return true;
  }

  return false;
};

/*
 * Helpers
 */

function U64(hi, lo) {
  this.hi = hi;
  this.lo = lo;
}

function read(data, off) {
  var hi = data.readUInt32LE(off + 4, true);
  var lo = data.readUInt32LE(off, true);
  return new U64(hi, lo);
}

function write(data, value, off) {
  data.writeUInt32LE(value.hi, off + 4, true);
  data.writeUInt32LE(value.lo, off, true);
}

/*
 * Expose
 */

module.exports = RollingFilter;