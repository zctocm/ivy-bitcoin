/*!
 * lowlevelup.js - LevelUP module for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');

var LOW = Buffer.from([0x00]);
var HIGH = Buffer.from([0xff]);

var VERSION_ERROR = void 0;

/**
 * Extremely low-level version of levelup.
 *
 * This avoids pulling in extra deps and
 * lowers memory usage.
 *
 * @alias module:db.LowlevelUp
 * @constructor
 * @param {Function} backend - Database backend.
 * @param {String} location - File location.
 * @param {Object?} options - Leveldown options.
 */

function LowlevelUp(backend, location, options) {
  if (!(this instanceof LowlevelUp)) return new LowlevelUp(backend, location, options);

  assert(typeof backend === 'function', 'Backend is required.');
  assert(typeof location === 'string', 'Filename is required.');

  this.options = new LLUOptions(options);
  this.backend = backend;
  this.location = location;

  this.loading = false;
  this.closing = false;
  this.loaded = false;

  this.binding = null;
  this.leveldown = false;

  this.init();
}

/**
 * Initialize the database.
 * @method
 * @private
 */

LowlevelUp.prototype.init = function init() {
  var Backend = this.backend;

  var db = new Backend(this.location);

  // Stay as close to the metal as possible.
  // We want to make calls to C++ directly.
  while (db.db) {
    // Not a database.
    if (typeof db.db.put !== 'function') break;

    // Recursive.
    if (db.db === db) break;

    // Go deeper.
    db = db.db;
  }

  // A lower-level binding.
  if (db.binding) {
    this.binding = db.binding;
    this.leveldown = db !== db.binding;
  } else {
    this.binding = db;
  }
};

/**
 * Open the database.
 * @returns {Promise}
 */

LowlevelUp.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!this.loaded) {
              _context.next = 2;
              break;
            }

            throw new Error('Database is already open.');

          case 2:

            assert(!this.loading);
            assert(!this.closing);

            this.loading = true;

            _context.prev = 5;
            _context.next = 8;
            return this.load();

          case 8:
            _context.next = 14;
            break;

          case 10:
            _context.prev = 10;
            _context.t0 = _context['catch'](5);

            this.loading = false;
            throw _context.t0;

          case 14:

            this.loading = false;
            this.loaded = true;

          case 16:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[5, 10]]);
  }));

  function open() {
    return _ref.apply(this, arguments);
  }

  return open;
}();

/**
 * Close the database.
 * @returns {Promise}
 */

LowlevelUp.prototype.close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (this.loaded) {
              _context2.next = 2;
              break;
            }

            throw new Error('Database is already closed.');

          case 2:

            assert(!this.loading);
            assert(!this.closing);

            this.loaded = false;
            this.closing = true;

            _context2.prev = 6;
            _context2.next = 9;
            return this.unload();

          case 9:
            _context2.next = 16;
            break;

          case 11:
            _context2.prev = 11;
            _context2.t0 = _context2['catch'](6);

            this.loaded = true;
            this.closing = false;
            throw _context2.t0;

          case 16:

            this.closing = false;

          case 17:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[6, 11]]);
  }));

  function close() {
    return _ref2.apply(this, arguments);
  }

  return close;
}();

/**
 * Open the database.
 * @private
 * @returns {Promise}
 */

LowlevelUp.prototype.load = function load() {
  var _this = this;

  return new _promise2.default(function (resolve, reject) {
    _this.binding.open(_this.options, wrap(resolve, reject));
  });
};

/**
 * Close the database.
 * @private
 * @returns {Promise}
 */

LowlevelUp.prototype.unload = function unload() {
  var _this2 = this;

  return new _promise2.default(function (resolve, reject) {
    _this2.binding.close(wrap(resolve, reject));
  });
};

/**
 * Destroy the database.
 * @returns {Promise}
 */

LowlevelUp.prototype.destroy = function destroy() {
  var _this3 = this;

  return new _promise2.default(function (resolve, reject) {
    if (_this3.loaded || _this3.closing) {
      reject(new Error('Cannot destroy open database.'));
      return;
    }

    if (!_this3.backend.destroy) {
      reject(new Error('Cannot destroy (method not available).'));
      return;
    }

    _this3.backend.destroy(_this3.location, wrap(resolve, reject));
  });
};

/**
 * Repair the database.
 * @returns {Promise}
 */

LowlevelUp.prototype.repair = function repair() {
  var _this4 = this;

  return new _promise2.default(function (resolve, reject) {
    if (_this4.loaded || _this4.closing) {
      reject(new Error('Cannot repair open database.'));
      return;
    }

    if (!_this4.backend.repair) {
      reject(new Error('Cannot repair (method not available).'));
      return;
    }

    _this4.backend.repair(_this4.location, wrap(resolve, reject));
  });
};

/**
 * Backup the database.
 * @param {String} path
 * @returns {Promise}
 */

LowlevelUp.prototype.backup = function backup(path) {
  var _this5 = this;

  if (!this.binding.backup) return this.clone(path);

  return new _promise2.default(function (resolve, reject) {
    if (!_this5.loaded) {
      reject(new Error('Database is closed.'));
      return;
    }
    _this5.binding.backup(path, wrap(resolve, reject));
  });
};

/**
 * Retrieve a record from the database.
 * @param {String|Buffer} key
 * @returns {Promise} - Returns Buffer.
 */

LowlevelUp.prototype.get = function get(key) {
  var _this6 = this;

  return new _promise2.default(function (resolve, reject) {
    if (!_this6.loaded) {
      reject(new Error('Database is closed.'));
      return;
    }
    _this6.binding.get(key, function (err, result) {
      if (err) {
        if (isNotFound(err)) {
          resolve(null);
          return;
        }
        reject(err);
        return;
      }
      resolve(result);
    });
  });
};

/**
 * Store a record in the database.
 * @param {String|Buffer} key
 * @param {Buffer} value
 * @returns {Promise}
 */

LowlevelUp.prototype.put = function put(key, value) {
  var _this7 = this;

  if (!value) value = LOW;

  return new _promise2.default(function (resolve, reject) {
    if (!_this7.loaded) {
      reject(new Error('Database is closed.'));
      return;
    }
    _this7.binding.put(key, value, wrap(resolve, reject));
  });
};

/**
 * Remove a record from the database.
 * @param {String|Buffer} key
 * @returns {Promise}
 */

LowlevelUp.prototype.del = function del(key) {
  var _this8 = this;

  return new _promise2.default(function (resolve, reject) {
    if (!_this8.loaded) {
      reject(new Error('Database is closed.'));
      return;
    }
    _this8.binding.del(key, wrap(resolve, reject));
  });
};

/**
 * Create an atomic batch.
 * @returns {Batch}
 */

LowlevelUp.prototype.batch = function batch() {
  if (!this.loaded) throw new Error('Database is closed.');

  return new Batch(this);
};

/**
 * Create an iterator.
 * @param {Object} options
 * @returns {Iterator}
 */

LowlevelUp.prototype.iterator = function iterator(options) {
  if (!this.loaded) throw new Error('Database is closed.');

  return new Iterator(this, options);
};

/**
 * Get a database property.
 * @param {String} name - Property name.
 * @returns {String}
 */

LowlevelUp.prototype.getProperty = function getProperty(name) {
  if (!this.loaded) throw new Error('Database is closed.');

  if (!this.binding.getProperty) return '';

  return this.binding.getProperty(name);
};

/**
 * Calculate approximate database size.
 * @param {String|Buffer} start - Start key.
 * @param {String|Buffer} end - End key.
 * @returns {Promise} - Returns Number.
 */

LowlevelUp.prototype.approximateSize = function approximateSize(start, end) {
  var _this9 = this;

  return new _promise2.default(function (resolve, reject) {
    if (!_this9.loaded) {
      reject(new Error('Database is closed.'));
      return;
    }

    if (!_this9.binding.approximateSize) {
      reject(new Error('Cannot get size.'));
      return;
    }

    _this9.binding.approximateSize(start, end, wrap(resolve, reject));
  });
};

/**
 * Compact range of keys.
 * @param {String|Buffer|null} start - Start key.
 * @param {String|Buffer|null} end - End key.
 * @returns {Promise}
 */

LowlevelUp.prototype.compactRange = function compactRange(start, end) {
  var _this10 = this;

  if (!start) start = LOW;

  if (!end) end = HIGH;

  return new _promise2.default(function (resolve, reject) {
    if (!_this10.loaded) {
      reject(new Error('Database is closed.'));
      return;
    }

    if (!_this10.binding.compactRange) {
      resolve();
      return;
    }

    _this10.binding.compactRange(start, end, wrap(resolve, reject));
  });
};

/**
 * Test whether a key exists.
 * @method
 * @param {String} key
 * @returns {Promise} - Returns Boolean.
 */

LowlevelUp.prototype.has = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(key) {
    var value;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this.get(key);

          case 2:
            value = _context3.sent;
            return _context3.abrupt('return', value != null);

          case 4:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function has(_x) {
    return _ref3.apply(this, arguments);
  }

  return has;
}();

/**
 * Collect all keys from iterator options.
 * @method
 * @param {Object} options - Iterator options.
 * @returns {Promise} - Returns Array.
 */

LowlevelUp.prototype.range = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(options) {
    var iter, items;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            iter = this.iterator({
              gte: options.gte,
              lte: options.lte,
              keys: true,
              values: true
            });
            items = [];
            _context4.next = 4;
            return iter.each(function (key, value) {
              if (options.parse) {
                var item = options.parse(key, value);
                if (item) items.push(item);
              } else {
                items.push(new IteratorItem(key, value));
              }
            });

          case 4:
            return _context4.abrupt('return', items);

          case 5:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function range(_x2) {
    return _ref4.apply(this, arguments);
  }

  return range;
}();

/**
 * Collect all keys from iterator options.
 * @method
 * @param {Object} options - Iterator options.
 * @returns {Promise} - Returns Array.
 */

LowlevelUp.prototype.keys = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(options) {
    var iter, items;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            iter = this.iterator({
              gte: options.gte,
              lte: options.lte,
              keys: true,
              values: false
            });
            items = [];
            _context5.next = 4;
            return iter.each(function (key) {
              if (options.parse) key = options.parse(key);
              items.push(key);
            });

          case 4:
            return _context5.abrupt('return', items);

          case 5:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function keys(_x3) {
    return _ref5.apply(this, arguments);
  }

  return keys;
}();

/**
 * Collect all keys from iterator options.
 * @method
 * @param {Object} options - Iterator options.
 * @returns {Promise} - Returns Array.
 */

LowlevelUp.prototype.values = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(options) {
    var iter, items;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            iter = this.iterator({
              gte: options.gte,
              lte: options.lte,
              keys: false,
              values: true
            });
            items = [];
            _context6.next = 4;
            return iter.each(function (value) {
              if (options.parse) value = options.parse(value);
              items.push(value);
            });

          case 4:
            return _context6.abrupt('return', items);

          case 5:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function values(_x4) {
    return _ref6.apply(this, arguments);
  }

  return values;
}();

/**
 * Dump database (for debugging).
 * @method
 * @returns {Promise} - Returns Object.
 */

LowlevelUp.prototype.dump = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
    var records, items, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item, key, value;

    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            records = (0, _create2.default)(null);
            _context7.next = 3;
            return this.range({
              gte: LOW,
              lte: HIGH
            });

          case 3:
            items = _context7.sent;
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context7.prev = 7;


            for (_iterator = (0, _getIterator3.default)(items); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              item = _step.value;
              key = item.key.toString('hex');
              value = item.value.toString('hex');

              records[key] = value;
            }

            _context7.next = 15;
            break;

          case 11:
            _context7.prev = 11;
            _context7.t0 = _context7['catch'](7);
            _didIteratorError = true;
            _iteratorError = _context7.t0;

          case 15:
            _context7.prev = 15;
            _context7.prev = 16;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 18:
            _context7.prev = 18;

            if (!_didIteratorError) {
              _context7.next = 21;
              break;
            }

            throw _iteratorError;

          case 21:
            return _context7.finish(18);

          case 22:
            return _context7.finish(15);

          case 23:
            return _context7.abrupt('return', records);

          case 24:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function dump() {
    return _ref7.apply(this, arguments);
  }

  return dump;
}();

/**
 * Write and assert a version number for the database.
 * @method
 * @param {Number} version
 * @returns {Promise}
 */

LowlevelUp.prototype.checkVersion = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(key, version) {
    var data, value, batch, num;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _context8.next = 2;
            return this.get(key);

          case 2:
            data = _context8.sent;

            if (data) {
              _context8.next = 11;
              break;
            }

            value = Buffer.allocUnsafe(4);

            value.writeUInt32LE(version, 0, true);
            batch = this.batch();

            batch.put(key, value);
            _context8.next = 10;
            return batch.write();

          case 10:
            return _context8.abrupt('return');

          case 11:
            num = data.readUInt32LE(0, true);

            if (!(num !== version)) {
              _context8.next = 14;
              break;
            }

            throw new Error(VERSION_ERROR);

          case 14:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function checkVersion(_x5, _x6) {
    return _ref8.apply(this, arguments);
  }

  return checkVersion;
}();

/**
 * Clone the database.
 * @method
 * @param {String} path
 * @returns {Promise}
 */

LowlevelUp.prototype.clone = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(path) {
    var hwm, options, tmp, iter, batch, total, key, value;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            if (this.loaded) {
              _context9.next = 2;
              break;
            }

            throw new Error('Database is closed.');

          case 2:
            hwm = 256 << 20;
            options = new LLUOptions(this.options);

            options.createIfMissing = true;
            options.errorIfExists = true;

            tmp = new LowlevelUp(this.backend, path, options);
            _context9.next = 9;
            return tmp.open();

          case 9:
            iter = this.iterator({
              keys: true,
              values: true
            });
            batch = tmp.batch();
            total = 0;

          case 12:
            _context9.next = 14;
            return iter.next();

          case 14:
            if (!_context9.sent) {
              _context9.next = 36;
              break;
            }

            key = iter.key, value = iter.value;


            batch.put(key, value);

            total += key.length + 80;
            total += value.length + 80;

            if (!(total >= hwm)) {
              _context9.next = 34;
              break;
            }

            total = 0;

            _context9.prev = 21;
            _context9.next = 24;
            return batch.write();

          case 24:
            _context9.next = 33;
            break;

          case 26:
            _context9.prev = 26;
            _context9.t0 = _context9['catch'](21);
            _context9.next = 30;
            return iter.end();

          case 30:
            _context9.next = 32;
            return tmp.close();

          case 32:
            throw _context9.t0;

          case 33:

            batch = tmp.batch();

          case 34:
            _context9.next = 12;
            break;

          case 36:
            _context9.prev = 36;
            _context9.next = 39;
            return batch.write();

          case 39:
            _context9.prev = 39;
            _context9.next = 42;
            return tmp.close();

          case 42:
            return _context9.finish(39);

          case 43:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[21, 26], [36,, 39, 43]]);
  }));

  function clone(_x7) {
    return _ref9.apply(this, arguments);
  }

  return clone;
}();

/**
 * Batch
 * @constructor
 * @ignore
 * @param {LowlevelUp} db
 */

function Batch(db) {
  this.batch = db.binding.batch();
}

/**
 * Write a value to the batch.
 * @param {String|Buffer} key
 * @param {Buffer} value
 */

Batch.prototype.put = function put(key, value) {
  if (!value) value = LOW;

  this.batch.put(key, value);

  return this;
};

/**
 * Delete a value from the batch.
 * @param {String|Buffer} key
 */

Batch.prototype.del = function del(key) {
  this.batch.del(key);
  return this;
};

/**
 * Write batch to database.
 * @returns {Promise}
 */

Batch.prototype.write = function write() {
  var _this11 = this;

  return new _promise2.default(function (resolve, reject) {
    _this11.batch.write(wrap(resolve, reject));
  });
};

/**
 * Clear the batch.
 */

Batch.prototype.clear = function clear() {
  this.batch.clear();
  return this;
};

/**
 * Iterator
 * @constructor
 * @ignore
 * @param {LowlevelUp} db
 * @param {Object} options
 */

function Iterator(db, options) {
  this.options = new IteratorOptions(options);
  this.options.keyAsBuffer = db.options.bufferKeys;

  this.iter = db.binding.iterator(this.options);
  this.leveldown = db.leveldown;

  this.cache = [];
  this.finished = false;

  this.key = null;
  this.value = null;
  this.valid = true;
}

/**
 * Clean up iterator.
 * @private
 */

Iterator.prototype.cleanup = function cleanup() {
  this.cache = [];
  this.finished = true;
  this.key = null;
  this.value = null;
  this.valid = false;
};

/**
 * For each.
 * @returns {Promise}
 */

Iterator.prototype.each = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(cb) {
    var _options, keys, values, key, value, result;

    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            assert(this.valid);

            _options = this.options, keys = _options.keys, values = _options.values;

          case 2:
            if (this.finished) {
              _context10.next = 30;
              break;
            }

            _context10.next = 5;
            return this.read();

          case 5:
            if (!(this.cache.length > 0)) {
              _context10.next = 28;
              break;
            }

            key = this.cache.pop();
            value = this.cache.pop();
            result = null;
            _context10.prev = 9;

            if (keys && values) result = cb(key, value);else if (keys) result = cb(key);else if (values) result = cb(value);else assert(false);

            if (!(result instanceof _promise2.default)) {
              _context10.next = 15;
              break;
            }

            _context10.next = 14;
            return result;

          case 14:
            result = _context10.sent;

          case 15:
            _context10.next = 22;
            break;

          case 17:
            _context10.prev = 17;
            _context10.t0 = _context10['catch'](9);
            _context10.next = 21;
            return this.end();

          case 21:
            throw _context10.t0;

          case 22:
            if (!(result === false)) {
              _context10.next = 26;
              break;
            }

            _context10.next = 25;
            return this.end();

          case 25:
            return _context10.abrupt('break', 28);

          case 26:
            _context10.next = 5;
            break;

          case 28:
            _context10.next = 2;
            break;

          case 30:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this, [[9, 17]]);
  }));

  function each(_x8) {
    return _ref10.apply(this, arguments);
  }

  return each;
}();

/**
 * Seek to the next key.
 * @returns {Promise}
 */

Iterator.prototype.next = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11() {
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            assert(this.valid);

            if (this.finished) {
              _context11.next = 5;
              break;
            }

            if (!(this.cache.length === 0)) {
              _context11.next = 5;
              break;
            }

            _context11.next = 5;
            return this.read();

          case 5:
            if (!(this.cache.length > 0)) {
              _context11.next = 9;
              break;
            }

            this.key = this.cache.pop();
            this.value = this.cache.pop();
            return _context11.abrupt('return', true);

          case 9:

            assert(this.finished);

            this.cleanup();

            return _context11.abrupt('return', false);

          case 12:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function next() {
    return _ref11.apply(this, arguments);
  }

  return next;
}();

/**
 * Seek to the next key (buffer values).
 * @private
 * @returns {Promise}
 */

Iterator.prototype.read = function read() {
  var _this12 = this;

  return new _promise2.default(function (resolve, reject) {
    if (!_this12.leveldown) {
      _this12.iter.next(function (err, key, value) {
        if (err) {
          _this12.cleanup();
          _this12.iter.end(function () {
            return reject(err);
          });
          return;
        }

        if (key === undefined && value === undefined) {
          _this12.cleanup();
          _this12.iter.end(wrap(resolve, reject));
          return;
        }

        _this12.cache = [value, key];

        resolve();
      });
      return;
    }

    _this12.iter.next(function (err, cache, finished) {
      if (err) {
        _this12.cleanup();
        _this12.iter.end(function () {
          return reject(err);
        });
        return;
      }

      _this12.cache = cache;
      _this12.finished = finished;

      resolve();
    });
  });
};

/**
 * Seek to an arbitrary key.
 * @param {String|Buffer} key
 */

Iterator.prototype.seek = function seek(key) {
  assert(this.valid);
  this.iter.seek(key);
};

/**
 * End the iterator.
 * @returns {Promise}
 */

Iterator.prototype.end = function end() {
  var _this13 = this;

  return new _promise2.default(function (resolve, reject) {
    _this13.cleanup();
    _this13.iter.end(wrap(resolve, reject));
  });
};

/**
 * Iterator Item
 * @ignore
 * @constructor
 * @param {String|Buffer} key
 * @param {String|Buffer} value
 * @property {String|Buffer} key
 * @property {String|Buffer} value
 */

function IteratorItem(key, value) {
  this.key = key;
  this.value = value;
}

/**
 * LowlevelUp Options
 * @constructor
 * @ignore
 * @param {Object} options
 */

function LLUOptions(options) {
  this.createIfMissing = true;
  this.errorIfExists = false;
  this.compression = true;
  this.cacheSize = 8 << 20;
  this.writeBufferSize = 4 << 20;
  this.maxOpenFiles = 64;
  this.maxFileSize = 2 << 20;
  this.paranoidChecks = false;
  this.memory = false;
  this.sync = false;
  this.mapSize = 256 * (1024 << 20);
  this.writeMap = false;
  this.noSubdir = true;
  this.bufferKeys = true;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options.
 * @private
 * @param {Object} options
 * @returns {LLUOptions}
 */

LLUOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Options are required.');

  if (options.createIfMissing != null) {
    assert(typeof options.createIfMissing === 'boolean', '`createIfMissing` must be a boolean.');
    this.createIfMissing = options.createIfMissing;
  }

  if (options.errorIfExists != null) {
    assert(typeof options.errorIfExists === 'boolean', '`errorIfExists` must be a boolean.');
    this.errorIfExists = options.errorIfExists;
  }

  if (options.compression != null) {
    assert(typeof options.compression === 'boolean', '`compression` must be a boolean.');
    this.compression = options.compression;
  }

  if (options.cacheSize != null) {
    assert(typeof options.cacheSize === 'number', '`cacheSize` must be a number.');
    assert(options.cacheSize >= 0);
    this.cacheSize = Math.floor(options.cacheSize / 2);
    this.writeBufferSize = Math.floor(options.cacheSize / 4);
  }

  if (options.maxFiles != null) {
    assert(typeof options.maxFiles === 'number', '`maxFiles` must be a number.');
    assert(options.maxFiles >= 0);
    this.maxOpenFiles = options.maxFiles;
  }

  if (options.maxFileSize != null) {
    assert(typeof options.maxFileSize === 'number', '`maxFileSize` must be a number.');
    assert(options.maxFileSize >= 0);
    this.maxFileSize = options.maxFileSize;
  }

  if (options.paranoidChecks != null) {
    assert(typeof options.paranoidChecks === 'boolean', '`paranoidChecks` must be a boolean.');
    this.paranoidChecks = options.paranoidChecks;
  }

  if (options.memory != null) {
    assert(typeof options.memory === 'boolean', '`memory` must be a boolean.');
    this.memory = options.memory;
  }

  if (options.sync != null) {
    assert(typeof options.sync === 'boolean', '`sync` must be a boolean.');
    this.sync = options.sync;
  }

  if (options.mapSize != null) {
    assert(typeof options.mapSize === 'number', '`mapSize` must be a number.');
    assert(options.mapSize >= 0);
    this.mapSize = options.mapSize;
  }

  if (options.writeMap != null) {
    assert(typeof options.writeMap === 'boolean', '`writeMap` must be a boolean.');
    this.writeMap = options.writeMap;
  }

  if (options.noSubdir != null) {
    assert(typeof options.noSubdir === 'boolean', '`noSubdir` must be a boolean.');
    this.noSubdir = options.noSubdir;
  }

  if (options.bufferKeys != null) {
    assert(typeof options.bufferKeys === 'boolean', '`bufferKeys` must be a boolean.');
    this.bufferKeys = options.bufferKeys;
  }

  return this;
};

/**
 * Iterator Options
 * @constructor
 * @ignore
 * @param {Object} options
 */

function IteratorOptions(options) {
  this.gte = null;
  this.lte = null;
  this.gt = null;
  this.lt = null;
  this.keys = true;
  this.values = false;
  this.fillCache = false;
  this.keyAsBuffer = true;
  this.valueAsBuffer = true;
  this.reverse = false;
  this.highWaterMark = 16 * 1024;

  // Note: do not add this property.
  // this.limit = null;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from options.
 * @private
 * @param {Object} options
 * @returns {IteratorOptions}
 */

IteratorOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Options are required.');

  if (options.gte != null) {
    assert(Buffer.isBuffer(options.gte) || typeof options.gte === 'string');
    this.gte = options.gte;
  }

  if (options.lte != null) {
    assert(Buffer.isBuffer(options.lte) || typeof options.lte === 'string');
    this.lte = options.lte;
  }

  if (options.gt != null) {
    assert(Buffer.isBuffer(options.gt) || typeof options.gt === 'string');
    this.gt = options.gt;
  }

  if (options.lt != null) {
    assert(Buffer.isBuffer(options.lt) || typeof options.lt === 'string');
    this.lt = options.lt;
  }

  if (options.keys != null) {
    assert(typeof options.keys === 'boolean');
    this.keys = options.keys;
  }

  if (options.values != null) {
    assert(typeof options.values === 'boolean');
    this.values = options.values;
  }

  if (options.fillCache != null) {
    assert(typeof options.fillCache === 'boolean');
    this.fillCache = options.fillCache;
  }

  if (options.keyAsBuffer != null) {
    assert(typeof options.keyAsBuffer === 'boolean');
    this.keyAsBuffer = options.keyAsBuffer;
  }

  if (options.reverse != null) {
    assert(typeof options.reverse === 'boolean');
    this.reverse = options.reverse;
  }

  if (options.limit != null) {
    assert(typeof options.limit === 'number');
    assert(options.limit >= 0);
    this.limit = options.limit;
  }

  if (!this.keys && !this.values) throw new Error('Keys and/or values must be chosen.');

  return this;
};

/*
 * Helpers
 */

function isNotFound(err) {
  if (!err) return false;

  return err.notFound || err.type === 'NotFoundError' || /not\s*found/i.test(err.message);
}

function wrap(resolve, reject) {
  return function (err, result) {
    if (err) {
      reject(err);
      return;
    }
    resolve(result);
  };
}

VERSION_ERROR = 'Warning:' + ' Your database does not match the current database version.' + ' This is likely because the database layout or serialization' + ' format has changed drastically. If you want to dump your' + ' data, downgrade to your previous version first. If you do' + ' not think you should be seeing this error, post an issue on' + ' the repo.';

/*
 * Expose
 */

module.exports = LowlevelUp;