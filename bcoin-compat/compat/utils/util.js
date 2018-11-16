/*!
 * util.js - utils for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _maxSafeInteger = require('babel-runtime/core-js/number/max-safe-integer');

var _maxSafeInteger2 = _interopRequireDefault(_maxSafeInteger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var nodeUtil = require('util');

/**
 * @exports utils/util
 */

var util = exports;

/*
 * Constants
 */

var inspectOptions = {
  showHidden: false,
  depth: 20,
  colors: false,
  customInspect: true,
  showProxy: false,
  maxArrayLength: Infinity,
  breakLength: 60
};

/**
 * Test whether a number is Number,
 * finite, and below MAX_SAFE_INTEGER.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isNumber = function isNumber(value) {
  return typeof value === 'number' && isFinite(value) && value >= -_maxSafeInteger2.default && value <= _maxSafeInteger2.default;
};

/**
 * Test whether an object is an int.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isInt = function isInt(value) {
  return (0, _isSafeInteger2.default)(value);
};

/**
 * Test whether an object is a uint.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isUint = function isUint(value) {
  return util.isInt(value) && value >= 0;
};

/**
 * Test whether a number is a float.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isFloat = function isFloat(value) {
  return typeof value === 'number' && isFinite(value);
};

/**
 * Test whether a number is a positive float.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isUfloat = function isUfloat(value) {
  return util.isFloat(value) && value >= 0;
};

/**
 * Test whether an object is an int8.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI8 = function isI8(value) {
  return (value | 0) === value && value >= -0x80 && value <= 0x7f;
};

/**
 * Test whether an object is an int16.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI16 = function isI16(value) {
  return (value | 0) === value && value >= -0x8000 && value <= 0x7fff;
};

/**
 * Test whether an object is an int32.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI32 = function isI32(value) {
  return (value | 0) === value;
};

/**
 * Test whether an object is a int53.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI64 = function isI64(value) {
  return util.isInt(value);
};

/**
 * Test whether an object is a uint8.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU8 = function isU8(value) {
  return (value & 0xff) === value;
};

/**
 * Test whether an object is a uint16.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU16 = function isU16(value) {
  return (value & 0xffff) === value;
};

/**
 * Test whether an object is a uint32.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU32 = function isU32(value) {
  return value >>> 0 === value;
};

/**
 * Test whether an object is a uint53.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU64 = function isU64(value) {
  return util.isUint(value);
};

/**
 * Test whether a string is a plain
 * ascii string (no control characters).
 * @param {String} str
 * @returns {Boolean}
 */

util.isAscii = function isAscii(str) {
  return typeof str === 'string' && /^[\t\n\r -~]*$/.test(str);
};

/**
 * Test whether a string is base58 (note that you
 * may get a false positive on a hex string).
 * @param {String?} str
 * @returns {Boolean}
 */

util.isBase58 = function isBase58(str) {
  return typeof str === 'string' && /^[1-9A-Za-z]+$/.test(str);
};

/**
 * Test whether a string is bech32 (note that
 * this doesn't guarantee address is bech32).
 * @param {String?} str
 * @returns {Boolean}
 */

util.isBech32 = function isBech32(str) {
  if (typeof str !== 'string') return false;

  if (str.toUpperCase() !== str && str.toLowerCase() !== str) return false;

  if (str.length < 8 || str.length > 90) return false;

  // it's unlikely any network will have hrp other than a-z symbols.
  return (/^[a-z]{2}1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/i.test(str)
  );
};

/**
 * Test whether a string is hex (length must be even).
 * Note that this _could_ await a false positive on
 * base58 strings.
 * @param {String?} str
 * @returns {Boolean}
 */

util.isHex = function isHex(str) {
  if (typeof str !== 'string') return false;
  return str.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(str);
};

/**
 * Test whether an object is a 160 bit hash (hex string).
 * @param {String?} hash
 * @returns {Boolean}
 */

util.isHex160 = function isHex160(hash) {
  if (typeof hash !== 'string') return false;
  return hash.length === 40 && util.isHex(hash);
};

/**
 * Test whether an object is a 256 bit hash (hex string).
 * @param {String?} hash
 * @returns {Boolean}
 */

util.isHex256 = function isHex256(hash) {
  if (typeof hash !== 'string') return false;
  return hash.length === 64 && util.isHex(hash);
};

/**
 * Test whether the result of a positive
 * addition would be below MAX_SAFE_INTEGER.
 * @param {Number} value
 * @returns {Boolean}
 */

util.isSafeAddition = function isSafeAddition(a, b) {
  // We only work on positive numbers.
  assert(a >= 0);
  assert(b >= 0);

  // Fast case.
  if (a <= 0xfffffffffffff && b <= 0xfffffffffffff) return true;

  // Do a 64 bit addition and check the top 11 bits.
  var ahi = a * (1 / 0x100000000) | 0;
  var alo = a | 0;

  var bhi = b * (1 / 0x100000000) | 0;
  var blo = b | 0;

  // Credit to @indutny for this method.
  var lo = alo + blo | 0;

  var s = lo >> 31;
  var as = alo >> 31;
  var bs = blo >> 31;

  var c = (as & bs | ~s & (as ^ bs)) & 1;

  var hi = (ahi + bhi | 0) + c | 0;

  hi >>>= 0;
  ahi >>>= 0;
  bhi >>>= 0;

  // Overflow?
  if (hi < ahi || hi < bhi) return false;

  return (hi & 0xffe00000) === 0;
};

/**
 * util.inspect() with 20 levels of depth.
 * @param {Object|String} obj
 * @param {Boolean?} color
 * @return {String}
 */

util.inspectify = function inspectify(obj, color) {
  if (typeof obj === 'string') return obj;

  inspectOptions.colors = color !== false;

  return nodeUtil.inspect(obj, inspectOptions);
};

/**
 * Format a string.
 * @function
 * @param {...String} args
 * @returns {String}
 */

util.fmt = nodeUtil.format;

/**
 * Format a string.
 * @param {Array} args
 * @param {Boolean?} color
 * @return {String}
 */

util.format = function format(args, color) {
  if (args.length > 0 && args[0] && (0, _typeof3.default)(args[0]) === 'object') {
    if (color == null) color = Boolean(process.stdout && process.stdout.isTTY);
    return util.inspectify(args[0], color);
  }
  return util.fmt.apply(util, (0, _toConsumableArray3.default)(args));
};

/**
 * Write a message to stdout (console in browser).
 * @param {Object|String} obj
 * @param {...String} args
 */

util.log = function log() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  if (!process.stdout) {
    var _msg = void 0;
    if (args.length > 0) {
      _msg = (0, _typeof3.default)(args[0]) !== 'object' ? util.fmt.apply(util, args) : args[0];
    }
    console.log(_msg);
    return;
  }

  var msg = util.format(args);

  process.stdout.write(msg + '\n');
};

/**
 * Write a message to stderr (console in browser).
 * @param {Object|String} obj
 * @param {...String} args
 */

util.error = function error() {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  if (!process.stderr) {
    var _msg2 = void 0;
    if (args.length > 0) {
      _msg2 = (0, _typeof3.default)(args[0]) !== 'object' ? util.fmt.apply(util, args) : args[0];
    }
    console.error(_msg2);
    return;
  }

  var msg = util.format(args);

  process.stderr.write(msg + '\n');
};

/**
 * Return hrtime (shim for browser).
 * @param {Array} time
 * @returns {Array} [seconds, nanoseconds]
 */

util.hrtime = function hrtime(time) {
  if (!process.hrtime) {
    var now = util.ms();

    if (time) {
      var _time = (0, _slicedToArray3.default)(time, 2),
          _hi = _time[0],
          _lo = _time[1];

      var start = _hi * 1000 + _lo / 1e6;
      return now - start;
    }

    var ms = now % 1000;

    // Seconds
    var hi = (now - ms) / 1000;

    // Nanoseconds
    var lo = ms * 1e6;

    return [hi, lo];
  }

  if (time) {
    var _process$hrtime = process.hrtime(time),
        _process$hrtime2 = (0, _slicedToArray3.default)(_process$hrtime, 2),
        _hi2 = _process$hrtime2[0],
        _lo2 = _process$hrtime2[1];

    return _hi2 * 1000 + _lo2 / 1e6;
  }

  return process.hrtime();
};

/**
 * Get current time in unix time (seconds).
 * @returns {Number}
 */

util.now = function now() {
  return Math.floor(util.ms() / 1000);
};

/**
 * Get current time in unix time (milliseconds).
 * @returns {Number}
 */

util.ms = function ms() {
  return Date.now();
};

/**
 * Create a Date ISO string from time in unix time (seconds).
 * @param {Number?} time - Seconds in unix time.
 * @returns {String}
 */

util.date = function date(time) {
  if (time == null) time = util.now();

  return new Date(time * 1000).toISOString().slice(0, -5) + 'Z';
};

/**
 * Get unix seconds from a Date string.
 * @param {String?} date - Date ISO String.
 * @returns {Number}
 */

util.time = function time(date) {
  if (date == null) return util.now();

  return new Date(date) / 1000 | 0;
};

/**
 * Get random range.
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */

util.random = function random(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Create a 32 or 64 bit nonce.
 * @param {Number} size
 * @returns {Buffer}
 */

util.nonce = function nonce(size) {
  var n = void 0,
      data = void 0;

  if (!size) size = 8;

  switch (size) {
    case 8:
      data = Buffer.allocUnsafe(8);
      n = util.random(0, 0x100000000);
      data.writeUInt32LE(n, 0, true);
      n = util.random(0, 0x100000000);
      data.writeUInt32LE(n, 4, true);
      break;
    case 4:
      data = Buffer.allocUnsafe(4);
      n = util.random(0, 0x100000000);
      data.writeUInt32LE(n, 0, true);
      break;
    default:
      assert(false, 'Bad nonce size.');
      break;
  }

  return data;
};

/**
 * String comparator (memcmp + length comparison).
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {Number} -1, 1, or 0.
 */

util.strcmp = function strcmp(a, b) {
  var len = Math.min(a.length, b.length);

  for (var i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }

  if (a.length < b.length) return -1;

  if (a.length > b.length) return 1;

  return 0;
};

/**
 * Convert bytes to mb.
 * @param {Number} size
 * @returns {Number} mb
 */

util.mb = function mb(size) {
  return Math.floor(size / 1024 / 1024);
};

/**
 * Find index of a buffer in an array of buffers.
 * @param {Buffer[]} items
 * @param {Buffer} data - Target buffer to find.
 * @returns {Number} Index (-1 if not found).
 */

util.indexOf = function indexOf(items, data) {
  assert(Array.isArray(items));
  assert(Buffer.isBuffer(data));

  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    assert(Buffer.isBuffer(item));

    if (item.equals(data)) return i;
  }

  return -1;
};

/**
 * Convert a number to a padded uint8
 * string (3 digits in decimal).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.pad8 = function pad8(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(10);

  switch (num.length) {
    case 1:
      return '00' + num;
    case 2:
      return '0' + num;
    case 3:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Convert a number to a padded uint32
 * string (10 digits in decimal).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.pad32 = function pad32(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(10);

  switch (num.length) {
    case 1:
      return '000000000' + num;
    case 2:
      return '00000000' + num;
    case 3:
      return '0000000' + num;
    case 4:
      return '000000' + num;
    case 5:
      return '00000' + num;
    case 6:
      return '0000' + num;
    case 7:
      return '000' + num;
    case 8:
      return '00' + num;
    case 9:
      return '0' + num;
    case 10:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Convert a number to a padded uint8
 * string (2 digits in hex).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.hex8 = function hex8(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(16);

  switch (num.length) {
    case 1:
      return '0' + num;
    case 2:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Convert a number to a padded uint32
 * string (8 digits in hex).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.hex32 = function hex32(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(16);

  switch (num.length) {
    case 1:
      return '0000000' + num;
    case 2:
      return '000000' + num;
    case 3:
      return '00000' + num;
    case 4:
      return '0000' + num;
    case 5:
      return '000' + num;
    case 6:
      return '00' + num;
    case 7:
      return '0' + num;
    case 8:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Reverse a hex-string (used because of
 * bitcoind's affinity for uint256le).
 * @param {String} data - Hex string.
 * @returns {String} Reversed hex string.
 */

util.revHex = function revHex(data) {
  assert(typeof data === 'string');
  assert(data.length > 0);
  assert(data.length % 2 === 0);

  var out = '';

  for (var i = 0; i < data.length; i += 2) {
    out = data.slice(i, i + 2) + out;
  }return out;
};

/**
 * Reverse an object's keys and values.
 * @param {Object} obj
 * @returns {Object} Reversed object.
 */

util.reverse = function reverse(obj) {
  var reversed = {};

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)((0, _keys2.default)(obj)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      reversed[obj[key]] = key;
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

  return reversed;
};

/**
 * Perform a binary search on a sorted array.
 * @param {Array} items
 * @param {Object} key
 * @param {Function} compare
 * @param {Boolean?} insert
 * @returns {Number} Index.
 */

util.binarySearch = function binarySearch(items, key, compare, insert) {
  var start = 0;
  var end = items.length - 1;

  while (start <= end) {
    var pos = start + end >>> 1;
    var cmp = compare(items[pos], key);

    if (cmp === 0) return pos;

    if (cmp < 0) start = pos + 1;else end = pos - 1;
  }

  if (!insert) return -1;

  return start;
};

/**
 * Perform a binary insert on a sorted array.
 * @param {Array} items
 * @param {Object} item
 * @param {Function} compare
 * @returns {Number} index
 */

util.binaryInsert = function binaryInsert(items, item, compare, uniq) {
  var i = util.binarySearch(items, item, compare, true);

  if (uniq && i < items.length) {
    if (compare(items[i], item) === 0) return -1;
  }

  if (i === 0) items.unshift(item);else if (i === items.length) items.push(item);else items.splice(i, 0, item);

  return i;
};

/**
 * Perform a binary removal on a sorted array.
 * @param {Array} items
 * @param {Object} item
 * @param {Function} compare
 * @returns {Boolean}
 */

util.binaryRemove = function binaryRemove(items, item, compare) {
  var i = util.binarySearch(items, item, compare, false);

  if (i === -1) return false;

  items.splice(i, 1);

  return true;
};

/**
 * Quick test to see if a string is uppercase.
 * @param {String} str
 * @returns {Boolean}
 */

util.isUpperCase = function isUpperCase(str) {
  assert(typeof str === 'string');

  if (str.length === 0) return false;

  return (str.charCodeAt(0) & 32) === 0;
};

/**
 * Test to see if a string starts with a prefix.
 * @param {String} str
 * @param {String} prefix
 * @returns {Boolean}
 */

util.startsWith = function startsWith(str, prefix) {
  assert(typeof str === 'string');

  if (!str.startsWith) return str.indexOf(prefix) === 0;

  return str.startsWith(prefix);
};

/**
 * Get memory usage info.
 * @returns {Object}
 */

util.memoryUsage = function memoryUsage() {
  if (!process.memoryUsage) {
    return {
      total: 0,
      jsHeap: 0,
      jsHeapTotal: 0,
      nativeHeap: 0,
      external: 0
    };
  }

  var mem = process.memoryUsage();

  return {
    total: util.mb(mem.rss),
    jsHeap: util.mb(mem.heapUsed),
    jsHeapTotal: util.mb(mem.heapTotal),
    nativeHeap: util.mb(mem.rss - mem.heapTotal),
    external: util.mb(mem.external)
  };
};

/**
 * Convert int to fixed number string and reduce by a
 * power of ten (uses no floating point arithmetic).
 * @param {Number} num
 * @param {Number} exp - Number of decimal places.
 * @returns {String} Fixed number string.
 */

util.toFixed = function toFixed(num, exp) {
  assert(typeof num === 'number');
  assert((0, _isSafeInteger2.default)(num), 'Invalid integer value.');

  var sign = '';

  if (num < 0) {
    num = -num;
    sign = '-';
  }

  var mult = pow10(exp);

  var lo = num % mult;
  var hi = (num - lo) / mult;

  lo = lo.toString(10);
  hi = hi.toString(10);

  while (lo.length < exp) {
    lo = '0' + lo;
  }lo = lo.replace(/0+$/, '');

  assert(lo.length <= exp, 'Invalid integer value.');

  if (lo.length === 0) lo = '0';

  if (exp === 0) return '' + sign + hi;

  return '' + sign + hi + '.' + lo;
};

/**
 * Parse a fixed number string and multiply by a
 * power of ten (uses no floating point arithmetic).
 * @param {String} str
 * @param {Number} exp - Number of decimal places.
 * @returns {Number} Integer.
 */

util.fromFixed = function fromFixed(str, exp) {
  assert(typeof str === 'string');
  assert(str.length <= 32, 'Fixed number string too large.');

  var sign = 1;

  if (str.length > 0 && str[0] === '-') {
    str = str.substring(1);
    sign = -1;
  }

  var hi = str;
  var lo = '0';

  var index = str.indexOf('.');

  if (index !== -1) {
    hi = str.substring(0, index);
    lo = str.substring(index + 1);
  }

  hi = hi.replace(/^0+/, '');
  lo = lo.replace(/0+$/, '');

  assert(hi.length <= 16 - exp, 'Fixed number string exceeds 2^53-1.');

  assert(lo.length <= exp, 'Too many decimal places in fixed number string.');

  if (hi.length === 0) hi = '0';

  while (lo.length < exp) {
    lo += '0';
  }if (lo.length === 0) lo = '0';

  assert(/^\d+$/.test(hi) && /^\d+$/.test(lo), 'Non-numeric characters in fixed number string.');

  hi = parseInt(hi, 10);
  lo = parseInt(lo, 10);

  var mult = pow10(exp);
  var maxLo = modSafe(mult);
  var maxHi = divSafe(mult);

  assert(hi < maxHi || hi === maxHi && lo <= maxLo, 'Fixed number string exceeds 2^53-1.');

  return sign * (hi * mult + lo);
};

/**
 * Convert int to float and reduce by a power
 * of ten (uses no floating point arithmetic).
 * @param {Number} num
 * @param {Number} exp - Number of decimal places.
 * @returns {Number} Double float.
 */

util.toFloat = function toFloat(num, exp) {
  return Number(util.toFixed(num, exp));
};

/**
 * Parse a double float number and multiply by a
 * power of ten (uses no floating point arithmetic).
 * @param {Number} num
 * @param {Number} exp - Number of decimal places.
 * @returns {Number} Integer.
 */

util.fromFloat = function fromFloat(num, exp) {
  assert(typeof num === 'number' && isFinite(num));
  assert((0, _isSafeInteger2.default)(exp));
  return util.fromFixed(num.toFixed(exp), exp);
};

/*
 * Helpers
 */

function pow10(exp) {
  switch (exp) {
    case 0:
      return 1;
    case 1:
      return 10;
    case 2:
      return 100;
    case 3:
      return 1000;
    case 4:
      return 10000;
    case 5:
      return 100000;
    case 6:
      return 1000000;
    case 7:
      return 10000000;
    case 8:
      return 100000000;
  }
  throw new Error('Exponent is too large.');
}

function modSafe(mod) {
  switch (mod) {
    case 1:
      return 0;
    case 10:
      return 1;
    case 100:
      return 91;
    case 1000:
      return 991;
    case 10000:
      return 991;
    case 100000:
      return 40991;
    case 1000000:
      return 740991;
    case 10000000:
      return 4740991;
    case 100000000:
      return 54740991;
  }
  throw new Error('Exponent is too large.');
}

function divSafe(div) {
  switch (div) {
    case 1:
      return 9007199254740991;
    case 10:
      return 900719925474099;
    case 100:
      return 90071992547409;
    case 1000:
      return 9007199254740;
    case 10000:
      return 900719925474;
    case 100000:
      return 90071992547;
    case 1000000:
      return 9007199254;
    case 10000000:
      return 900719925;
    case 100000000:
      return 90071992;
  }
  throw new Error('Exponent is too large.');
}