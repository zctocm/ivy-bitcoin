/*!
 * validator.js - validator for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');

/**
 * Validator
 * @alias module:utils.Validator
 * @constructor
 * @param {Object} options
 */

function Validator(data) {
  if (!(this instanceof Validator)) return new Validator(data);

  this.data = [];

  if (data) this.init(data);
}

/**
 * Initialize the validator.
 * @private
 * @param {Object} data
 */

Validator.prototype.init = function init(data) {
  assert(data && (typeof data === 'undefined' ? 'undefined' : (0, _typeof3.default)(data)) === 'object');

  if (!Array.isArray(data)) data = [data];

  this.data = data;
};

/**
 * Test whether value is present.
 * @param {String} key
 * @returns {Boolean}
 */

Validator.prototype.has = function has(key) {
  assert(typeof key === 'string' || typeof key === 'number', 'Key must be a string or number.');

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(this.data), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var map = _step.value;

      var value = map[key];
      if (value != null) return true;
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

  return false;
};

/**
 * Get a value (no type validation).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Object|null}
 */

Validator.prototype.get = function get(key, fallback) {
  if (fallback === undefined) fallback = null;

  if (Array.isArray(key)) {
    var keys = key;
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = (0, _getIterator3.default)(keys), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _key = _step2.value;

        var value = this.get(_key);
        if (value !== null) return value;
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

    return fallback;
  }

  assert(typeof key === 'string' || typeof key === 'number', 'Key must be a string or number.');

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.data), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var map = _step3.value;

      if (!map || (typeof map === 'undefined' ? 'undefined' : (0, _typeof3.default)(map)) !== 'object') throw new ValidationError('data', 'object');

      var _value = map[key];

      if (_value != null) return _value;
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

  return fallback;
};

/**
 * Get a value's type.
 * @param {String} key
 * @returns {String}
 */

Validator.prototype.typeOf = function typeOf(key) {
  var value = this.get(key);

  if (value == null) return 'null';

  return typeof value === 'undefined' ? 'undefined' : (0, _typeof3.default)(value);
};

/**
 * Get a value (as a string).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {String|null}
 */

Validator.prototype.str = function str(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') throw new ValidationError(key, 'number');

  return value;
};

/**
 * Get a value (as an integer).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.int = function int(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (typeof value !== 'number') throw new ValidationError(key, 'int');

    if (!(0, _isSafeInteger2.default)(value)) throw new ValidationError(key, 'int');

    return value;
  }

  if (!/^\-?\d+$/.test(value)) throw new ValidationError(key, 'int');

  value = parseInt(value, 10);

  if (!(0, _isSafeInteger2.default)(value)) throw new ValidationError(key, 'int');

  return value;
};

/**
 * Get a value (as a signed integer).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.uint = function uint(key, fallback) {
  var value = this.int(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < 0) throw new ValidationError(key, 'uint');

  return value;
};

/**
 * Get a value (as a float).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.float = function float(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (typeof value !== 'number') throw new ValidationError(key, 'float');

    if (!isFinite(value)) throw new ValidationError(key, 'float');

    return value;
  }

  if (!/^\-?\d*(?:\.\d*)?$/.test(value)) throw new ValidationError(key, 'float');

  if (!/\d/.test(value)) throw new ValidationError(key, 'float');

  value = parseFloat(value);

  if (!isFinite(value)) throw new ValidationError(key, 'float');

  return value;
};

/**
 * Get a value (as a positive float).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.ufloat = function ufloat(key, fallback) {
  var value = this.float(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < 0) throw new ValidationError(key, 'positive float');

  return value;
};

/**
 * Get a value (as a fixed number).
 * @param {String} key
 * @param {Number?} exp
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.fixed = function fixed(key, exp, fallback) {
  var value = this.float(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  try {
    return util.fromFloat(value, exp || 0);
  } catch (e) {
    throw new ValidationError(key, 'fixed number');
  }
};

/**
 * Get a value (as a positive fixed number).
 * @param {String} key
 * @param {Number?} exp
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.ufixed = function ufixed(key, exp, fallback) {
  var value = this.fixed(key, exp);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < 0) throw new ValidationError(key, 'positive fixed number');

  return value;
};

/**
 * Get a value (as an int32).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.i8 = function i8(key, fallback) {
  var value = this.int(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < -0x80 || value > 0x7f) throw new ValidationError(key, 'i8');

  return value;
};

/**
 * Get a value (as an int32).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.i16 = function i16(key, fallback) {
  var value = this.int(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < -0x8000 || value > 0x7fff) throw new ValidationError(key, 'i16');

  return value;
};

/**
 * Get a value (as an int32).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.i32 = function i32(key, fallback) {
  var value = this.int(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if ((value | 0) !== value) throw new ValidationError(key, 'int32');

  return value;
};

/**
 * Get a value (as an int64).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.i64 = function i64(key, fallback) {
  return this.int(key, fallback);
};

/**
 * Get a value (as a uint32).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.u8 = function u8(key, fallback) {
  var value = this.uint(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if ((value & 0xff) !== value) throw new ValidationError(key, 'uint8');

  return value;
};

/**
 * Get a value (as a uint16).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.u16 = function u16(key, fallback) {
  var value = this.uint(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if ((value & 0xffff) !== value) throw new ValidationError(key, 'uint16');

  return value;
};

/**
 * Get a value (as a uint32).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.u32 = function u32(key, fallback) {
  var value = this.uint(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value >>> 0 !== value) throw new ValidationError(key, 'uint32');

  return value;
};

/**
 * Get a value (as a uint64).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Validator.prototype.u64 = function u64(key, fallback) {
  return this.uint(key, fallback);
};

/**
 * Get a value (as a reverse hash).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Hash|null}
 */

Validator.prototype.hash = function hash(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (!Buffer.isBuffer(value)) throw new ValidationError(key, 'hash');

    if (value.length !== 32) throw new ValidationError(key, 'hash');

    return value.toString('hex');
  }

  if (value.length !== 64) throw new ValidationError(key, 'hex string');

  if (!/^[0-9a-f]+$/i.test(value)) throw new ValidationError(key, 'hex string');

  var out = '';

  for (var i = 0; i < value.length; i += 2) {
    out = value.slice(i, i + 2) + out;
  }return out;
};

/**
 * Get a value (as a number or reverse hash).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|Hash|null}
 */

Validator.prototype.numhash = function numhash(key, fallback) {
  if (this.typeOf(key) === 'string') return this.hash(key, fallback);
  return this.uint(key, fallback);
};

/**
 * Get a value (as a boolean).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Boolean|null}
 */

Validator.prototype.bool = function bool(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  // Bitcoin Core compat.
  if (typeof value === 'number') {
    if (value === 1) return true;

    if (value === 0) return false;
  }

  if (typeof value !== 'string') {
    if (typeof value !== 'boolean') throw new ValidationError(key, 'boolean');
    return value;
  }

  if (value === 'true' || value === '1') return true;

  if (value === 'false' || value === '0') return false;

  throw new ValidationError(key, 'boolean');
};

/**
 * Get a value (as a buffer).
 * @param {String} key
 * @param {Object?} fallback
 * @param {String?} enc
 * @returns {Buffer|null}
 */

Validator.prototype.buf = function buf(key, fallback, enc) {
  var value = this.get(key);

  if (!enc) enc = 'hex';

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (!Buffer.isBuffer(value)) throw new ValidationError(key, 'buffer');
    return value;
  }

  var data = Buffer.from(value, enc);

  if (data.length !== Buffer.byteLength(value, enc)) throw new ValidationError(key, enc + ' string');

  return data;
};

/**
 * Get a value (as an array).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Array|String[]|null}
 */

Validator.prototype.array = function array(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (!Array.isArray(value)) throw new ValidationError(key, 'list/array');
    return value;
  }

  var parts = value.trim().split(/\s*,\s*/);
  var result = [];

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(parts), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var part = _step4.value;

      if (part.length === 0) continue;

      result.push(part);
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

  return result;
};

/**
 * Get a value (as an object).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Object|null}
 */

Validator.prototype.obj = function obj(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if ((typeof value === 'undefined' ? 'undefined' : (0, _typeof3.default)(value)) !== 'object') throw new ValidationError(key, 'object');

  return value;
};

/**
 * Get a value (as a function).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Function|null}
 */

Validator.prototype.func = function func(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'function') throw new ValidationError(key, 'function');

  return value;
};

/*
 * Helpers
 */

function fmt(key) {
  if (Array.isArray(key)) key = key[0];

  if (typeof key === 'number') return 'Param #' + key;

  return key;
}

function ValidationError(key, type) {
  if (!(this instanceof ValidationError)) return new ValidationError(key, type);

  Error.call(this);

  this.type = 'ValidationError';
  this.message = fmt(key) + ' must be a ' + type + '.';

  if (Error.captureStackTrace) Error.captureStackTrace(this, ValidationError);
}

(0, _setPrototypeOf2.default)(ValidationError.prototype, Error.prototype);

/*
 * Expose
 */

module.exports = Validator;