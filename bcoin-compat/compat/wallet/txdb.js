/*!
 * txdb.js - persistent transaction pool
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var util = require('../utils/util');
var LRU = require('../utils/lru');
var assert = require('assert');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var Amount = require('../btc/amount');
var CoinView = require('../coins/coinview');
var Coin = require('../primitives/coin');
var Outpoint = require('../primitives/outpoint');
var records = require('./records');
var layout = require('./layout').txdb;
var encoding = require('../utils/encoding');
var policy = require('../protocol/policy');
var Script = require('../script/script');
var BlockMapRecord = records.BlockMapRecord;
var OutpointMapRecord = records.OutpointMapRecord;
var TXRecord = records.TXRecord;

/**
 * TXDB
 * @alias module:wallet.TXDB
 * @constructor
 * @param {Wallet} wallet
 */

function TXDB(wallet) {
  if (!(this instanceof TXDB)) return new TXDB(wallet);

  this.wallet = wallet;
  this.walletdb = wallet.db;
  this.db = wallet.db.db;
  this.logger = wallet.db.logger;
  this.network = wallet.db.network;
  this.options = wallet.db.options;
  this.coinCache = new LRU(10000);

  this.locked = new _set2.default();
  this.state = null;
  this.pending = null;
  this.events = [];
}

/**
 * Database layout.
 * @type {Object}
 */

TXDB.layout = layout;

/**
 * Open TXDB.
 * @returns {Promise}
 */

TXDB.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var state;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.getState();

          case 2:
            state = _context.sent;


            if (state) {
              this.state = state;
              this.logger.info('TXDB loaded for %s.', this.wallet.id);
            } else {
              this.state = new TXDBState(this.wallet.wid, this.wallet.id);
              this.logger.info('TXDB created for %s.', this.wallet.id);
            }

            this.logger.info('TXDB State: tx=%d coin=%s.', this.state.tx, this.state.coin);

            this.logger.info('Balance: unconfirmed=%s confirmed=%s.', Amount.btc(this.state.unconfirmed), Amount.btc(this.state.confirmed));

          case 6:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function open() {
    return _ref.apply(this, arguments);
  }

  return open;
}();

/**
 * Start batch.
 * @private
 */

TXDB.prototype.start = function start() {
  this.pending = this.state.clone();
  this.coinCache.start();
  return this.wallet.start();
};

/**
 * Drop batch.
 * @private
 */

TXDB.prototype.drop = function drop() {
  this.pending = null;
  this.events.length = 0;
  this.coinCache.drop();
  return this.wallet.drop();
};

/**
 * Clear batch.
 * @private
 */

TXDB.prototype.clear = function clear() {
  this.pending = this.state.clone();
  this.events.length = 0;
  this.coinCache.clear();
  return this.wallet.clear();
};

/**
 * Save batch.
 * @returns {Promise}
 */

TXDB.prototype.commit = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _ref3, _ref4, event, data, details;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.prev = 0;
            _context2.next = 3;
            return this.wallet.commit();

          case 3:
            _context2.next = 11;
            break;

          case 5:
            _context2.prev = 5;
            _context2.t0 = _context2['catch'](0);

            this.pending = null;
            this.events.length = 0;
            this.coinCache.drop();
            throw _context2.t0;

          case 11:
            if (!this.pending.committed) {
              _context2.next = 32;
              break;
            }

            this.state = this.pending;

            // Emit buffered events now that
            // we know everything is written.
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 16;
            for (_iterator = (0, _getIterator3.default)(this.events); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              _ref3 = _step.value;
              _ref4 = (0, _slicedToArray3.default)(_ref3, 3);
              event = _ref4[0];
              data = _ref4[1];
              details = _ref4[2];

              this.walletdb.emit(event, this.wallet.id, data, details);
              this.wallet.emit(event, data, details);
            }
            _context2.next = 24;
            break;

          case 20:
            _context2.prev = 20;
            _context2.t1 = _context2['catch'](16);
            _didIteratorError = true;
            _iteratorError = _context2.t1;

          case 24:
            _context2.prev = 24;
            _context2.prev = 25;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 27:
            _context2.prev = 27;

            if (!_didIteratorError) {
              _context2.next = 30;
              break;
            }

            throw _iteratorError;

          case 30:
            return _context2.finish(27);

          case 31:
            return _context2.finish(24);

          case 32:

            this.pending = null;
            this.events.length = 0;
            this.coinCache.commit();

          case 35:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[0, 5], [16, 20, 24, 32], [25,, 27, 31]]);
  }));

  function commit() {
    return _ref2.apply(this, arguments);
  }

  return commit;
}();

/**
 * Emit transaction event.
 * @private
 * @param {String} event
 * @param {Object} data
 * @param {Details} details
 */

TXDB.prototype.emit = function emit(event, data, details) {
  this.events.push([event, data, details]);
};

/**
 * Prefix a key.
 * @param {Buffer} key
 * @returns {Buffer} Prefixed key.
 */

TXDB.prototype.prefix = function prefix(key) {
  assert(this.wallet.wid);
  return layout.prefix(this.wallet.wid, key);
};

/**
 * Put key and value to current batch.
 * @param {String} key
 * @param {Buffer} value
 */

TXDB.prototype.put = function put(key, value) {
  assert(this.wallet.current);
  this.wallet.current.put(this.prefix(key), value);
};

/**
 * Delete key from current batch.
 * @param {String} key
 */

TXDB.prototype.del = function del(key) {
  assert(this.wallet.current);
  this.wallet.current.del(this.prefix(key));
};

/**
 * Get.
 * @param {String} key
 */

TXDB.prototype.get = function get(key) {
  return this.db.get(this.prefix(key));
};

/**
 * Has.
 * @param {String} key
 */

TXDB.prototype.has = function has(key) {
  return this.db.has(this.prefix(key));
};

/**
 * Iterate.
 * @param {Object} options
 * @returns {Promise}
 */

TXDB.prototype.range = function range(options) {
  if (options.gte) options.gte = this.prefix(options.gte);

  if (options.lte) options.lte = this.prefix(options.lte);

  return this.db.range(options);
};

/**
 * Iterate.
 * @param {Object} options
 * @returns {Promise}
 */

TXDB.prototype.keys = function keys(options) {
  if (options.gte) options.gte = this.prefix(options.gte);

  if (options.lte) options.lte = this.prefix(options.lte);

  return this.db.keys(options);
};

/**
 * Iterate.
 * @param {Object} options
 * @returns {Promise}
 */

TXDB.prototype.values = function values(options) {
  if (options.gte) options.gte = this.prefix(options.gte);

  if (options.lte) options.lte = this.prefix(options.lte);

  return this.db.values(options);
};

/**
 * Get wallet path for output.
 * @param {Output} output
 * @returns {Promise} - Returns {@link Path}.
 */

TXDB.prototype.getPath = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(output) {
    var addr;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            addr = output.getAddress();

            if (addr) {
              _context3.next = 3;
              break;
            }

            return _context3.abrupt('return', null);

          case 3:
            _context3.next = 5;
            return this.wallet.getPath(addr);

          case 5:
            return _context3.abrupt('return', _context3.sent);

          case 6:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function getPath(_x) {
    return _ref5.apply(this, arguments);
  }

  return getPath;
}();

/**
 * Test whether path exists for output.
 * @param {Output} output
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.hasPath = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(output) {
    var addr;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            addr = output.getAddress();

            if (addr) {
              _context4.next = 3;
              break;
            }

            return _context4.abrupt('return', false);

          case 3:
            _context4.next = 5;
            return this.wallet.hasPath(addr);

          case 5:
            return _context4.abrupt('return', _context4.sent);

          case 6:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function hasPath(_x2) {
    return _ref6.apply(this, arguments);
  }

  return hasPath;
}();

/**
 * Save credit.
 * @param {Credit} credit
 * @param {Path} path
 */

TXDB.prototype.saveCredit = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(credit, path) {
    var coin, key, raw;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            coin = credit.coin;
            key = coin.toKey();
            raw = credit.toRaw();
            _context5.next = 5;
            return this.addOutpointMap(coin.hash, coin.index);

          case 5:

            this.put(layout.c(coin.hash, coin.index), raw);
            this.put(layout.C(path.account, coin.hash, coin.index), null);

            this.coinCache.push(key, raw);

          case 8:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function saveCredit(_x3, _x4) {
    return _ref7.apply(this, arguments);
  }

  return saveCredit;
}();

/**
 * Remove credit.
 * @param {Credit} credit
 * @param {Path} path
 */

TXDB.prototype.removeCredit = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(credit, path) {
    var coin, key;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            coin = credit.coin;
            key = coin.toKey();
            _context6.next = 4;
            return this.removeOutpointMap(coin.hash, coin.index);

          case 4:

            this.del(layout.c(coin.hash, coin.index));
            this.del(layout.C(path.account, coin.hash, coin.index));

            this.coinCache.unpush(key);

          case 7:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function removeCredit(_x5, _x6) {
    return _ref8.apply(this, arguments);
  }

  return removeCredit;
}();

/**
 * Spend credit.
 * @param {Credit} credit
 * @param {TX} tx
 * @param {Number} index
 */

TXDB.prototype.spendCredit = function spendCredit(credit, tx, index) {
  var prevout = tx.inputs[index].prevout;
  var spender = Outpoint.fromTX(tx, index);
  this.put(layout.s(prevout.hash, prevout.index), spender.toRaw());
  this.put(layout.d(spender.hash, spender.index), credit.coin.toRaw());
};

/**
 * Unspend credit.
 * @param {TX} tx
 * @param {Number} index
 */

TXDB.prototype.unspendCredit = function unspendCredit(tx, index) {
  var prevout = tx.inputs[index].prevout;
  var spender = Outpoint.fromTX(tx, index);
  this.del(layout.s(prevout.hash, prevout.index));
  this.del(layout.d(spender.hash, spender.index));
};

/**
 * Write input record.
 * @param {TX} tx
 * @param {Number} index
 */

TXDB.prototype.writeInput = function writeInput(tx, index) {
  var prevout = tx.inputs[index].prevout;
  var spender = Outpoint.fromTX(tx, index);
  this.put(layout.s(prevout.hash, prevout.index), spender.toRaw());
};

/**
 * Remove input record.
 * @param {TX} tx
 * @param {Number} index
 */

TXDB.prototype.removeInput = function removeInput(tx, index) {
  var prevout = tx.inputs[index].prevout;
  this.del(layout.s(prevout.hash, prevout.index));
};

/**
 * Resolve orphan input.
 * @param {TX} tx
 * @param {Number} index
 * @param {Number} height
 * @param {Path} path
 * @returns {Boolean}
 */

TXDB.prototype.resolveInput = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(tx, index, height, path, own) {
    var hash, spent, stx, credit;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            hash = tx.hash('hex');
            _context7.next = 3;
            return this.getSpent(hash, index);

          case 3:
            spent = _context7.sent;

            if (spent) {
              _context7.next = 6;
              break;
            }

            return _context7.abrupt('return', false);

          case 6:
            _context7.next = 8;
            return this.hasSpentCoin(spent);

          case 8:
            if (!_context7.sent) {
              _context7.next = 10;
              break;
            }

            return _context7.abrupt('return', false);

          case 10:
            _context7.next = 12;
            return this.getTX(spent.hash);

          case 12:
            stx = _context7.sent;

            assert(stx);

            // Crete the credit and add the undo coin.
            credit = Credit.fromTX(tx, index, height);

            credit.own = own;

            this.spendCredit(credit, stx.tx, spent.index);

            // If the spender is unconfirmed, save
            // the credit as well, and mark it as
            // unspent in the mempool. This is the
            // same behavior `insert` would have
            // done for inputs. We're just doing
            // it retroactively.

            if (!(stx.height === -1)) {
              _context7.next = 22;
              break;
            }

            credit.spent = true;
            _context7.next = 21;
            return this.saveCredit(credit, path);

          case 21:
            if (height !== -1) this.pending.confirmed += credit.coin.value;

          case 22:
            return _context7.abrupt('return', true);

          case 23:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function resolveInput(_x7, _x8, _x9, _x10, _x11) {
    return _ref9.apply(this, arguments);
  }

  return resolveInput;
}();

/**
 * Test an entire transaction to see
 * if any of its outpoints are a double-spend.
 * @param {TX} tx
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.isDoubleSpend = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(tx) {
    var _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _ref11, prevout, spent;

    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context8.prev = 3;
            _iterator2 = (0, _getIterator3.default)(tx.inputs);

          case 5:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context8.next = 16;
              break;
            }

            _ref11 = _step2.value;
            prevout = _ref11.prevout;
            _context8.next = 10;
            return this.isSpent(prevout.hash, prevout.index);

          case 10:
            spent = _context8.sent;

            if (!spent) {
              _context8.next = 13;
              break;
            }

            return _context8.abrupt('return', true);

          case 13:
            _iteratorNormalCompletion2 = true;
            _context8.next = 5;
            break;

          case 16:
            _context8.next = 22;
            break;

          case 18:
            _context8.prev = 18;
            _context8.t0 = _context8['catch'](3);
            _didIteratorError2 = true;
            _iteratorError2 = _context8.t0;

          case 22:
            _context8.prev = 22;
            _context8.prev = 23;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 25:
            _context8.prev = 25;

            if (!_didIteratorError2) {
              _context8.next = 28;
              break;
            }

            throw _iteratorError2;

          case 28:
            return _context8.finish(25);

          case 29:
            return _context8.finish(22);

          case 30:
            return _context8.abrupt('return', false);

          case 31:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this, [[3, 18, 22, 30], [23,, 25, 29]]);
  }));

  function isDoubleSpend(_x12) {
    return _ref10.apply(this, arguments);
  }

  return isDoubleSpend;
}();

/**
 * Test an entire transaction to see
 * if any of its outpoints are replace by fee.
 * @param {TX} tx
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.isRBF = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(tx) {
    var _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _ref13, prevout, key;

    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            if (!tx.isRBF()) {
              _context9.next = 2;
              break;
            }

            return _context9.abrupt('return', true);

          case 2:
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context9.prev = 5;
            _iterator3 = (0, _getIterator3.default)(tx.inputs);

          case 7:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context9.next = 18;
              break;
            }

            _ref13 = _step3.value;
            prevout = _ref13.prevout;
            key = layout.r(prevout.hash);
            _context9.next = 13;
            return this.has(key);

          case 13:
            if (!_context9.sent) {
              _context9.next = 15;
              break;
            }

            return _context9.abrupt('return', true);

          case 15:
            _iteratorNormalCompletion3 = true;
            _context9.next = 7;
            break;

          case 18:
            _context9.next = 24;
            break;

          case 20:
            _context9.prev = 20;
            _context9.t0 = _context9['catch'](5);
            _didIteratorError3 = true;
            _iteratorError3 = _context9.t0;

          case 24:
            _context9.prev = 24;
            _context9.prev = 25;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 27:
            _context9.prev = 27;

            if (!_didIteratorError3) {
              _context9.next = 30;
              break;
            }

            throw _iteratorError3;

          case 30:
            return _context9.finish(27);

          case 31:
            return _context9.finish(24);

          case 32:
            return _context9.abrupt('return', false);

          case 33:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[5, 20, 24, 32], [25,, 27, 31]]);
  }));

  function isRBF(_x13) {
    return _ref12.apply(this, arguments);
  }

  return isRBF;
}();

/**
 * Test a whether a coin has been spent.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.getSpent = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(hash, index) {
    var data;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            _context10.next = 2;
            return this.get(layout.s(hash, index));

          case 2:
            data = _context10.sent;

            if (data) {
              _context10.next = 5;
              break;
            }

            return _context10.abrupt('return', null);

          case 5:
            return _context10.abrupt('return', Outpoint.fromRaw(data));

          case 6:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function getSpent(_x14, _x15) {
    return _ref14.apply(this, arguments);
  }

  return getSpent;
}();

/**
 * Test a whether a coin has been spent.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.isSpent = function isSpent(hash, index) {
  return this.has(layout.s(hash, index));
};

/**
 * Append to the global unspent record.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise}
 */

TXDB.prototype.addOutpointMap = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(hash, i) {
    var map;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            _context11.next = 2;
            return this.walletdb.getOutpointMap(hash, i);

          case 2:
            map = _context11.sent;


            if (!map) map = new OutpointMapRecord(hash, i);

            if (map.add(this.wallet.wid)) {
              _context11.next = 6;
              break;
            }

            return _context11.abrupt('return');

          case 6:

            this.walletdb.writeOutpointMap(this.wallet, hash, i, map);

          case 7:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function addOutpointMap(_x16, _x17) {
    return _ref15.apply(this, arguments);
  }

  return addOutpointMap;
}();

/**
 * Remove from the global unspent record.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise}
 */

TXDB.prototype.removeOutpointMap = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(hash, i) {
    var map;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            _context12.next = 2;
            return this.walletdb.getOutpointMap(hash, i);

          case 2:
            map = _context12.sent;

            if (map) {
              _context12.next = 5;
              break;
            }

            return _context12.abrupt('return');

          case 5:
            if (map.remove(this.wallet.wid)) {
              _context12.next = 7;
              break;
            }

            return _context12.abrupt('return');

          case 7:
            if (!(map.wids.size === 0)) {
              _context12.next = 10;
              break;
            }

            this.walletdb.unwriteOutpointMap(this.wallet, hash, i);
            return _context12.abrupt('return');

          case 10:

            this.walletdb.writeOutpointMap(this.wallet, hash, i, map);

          case 11:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function removeOutpointMap(_x18, _x19) {
    return _ref16.apply(this, arguments);
  }

  return removeOutpointMap;
}();

/**
 * Append to the global block record.
 * @param {Hash} hash
 * @param {Number} height
 * @returns {Promise}
 */

TXDB.prototype.addBlockMap = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(hash, height) {
    var block;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            _context13.next = 2;
            return this.walletdb.getBlockMap(height);

          case 2:
            block = _context13.sent;


            if (!block) block = new BlockMapRecord(height);

            if (block.add(hash, this.wallet.wid)) {
              _context13.next = 6;
              break;
            }

            return _context13.abrupt('return');

          case 6:

            this.walletdb.writeBlockMap(this.wallet, height, block);

          case 7:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this);
  }));

  function addBlockMap(_x20, _x21) {
    return _ref17.apply(this, arguments);
  }

  return addBlockMap;
}();

/**
 * Remove from the global block record.
 * @param {Hash} hash
 * @param {Number} height
 * @returns {Promise}
 */

TXDB.prototype.removeBlockMap = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(hash, height) {
    var block;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            _context14.next = 2;
            return this.walletdb.getBlockMap(height);

          case 2:
            block = _context14.sent;

            if (block) {
              _context14.next = 5;
              break;
            }

            return _context14.abrupt('return');

          case 5:
            if (block.remove(hash, this.wallet.wid)) {
              _context14.next = 7;
              break;
            }

            return _context14.abrupt('return');

          case 7:
            if (!(block.txs.size === 0)) {
              _context14.next = 10;
              break;
            }

            this.walletdb.unwriteBlockMap(this.wallet, height);
            return _context14.abrupt('return');

          case 10:

            this.walletdb.writeBlockMap(this.wallet, height, block);

          case 11:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function removeBlockMap(_x22, _x23) {
    return _ref18.apply(this, arguments);
  }

  return removeBlockMap;
}();

/**
 * List block records.
 * @returns {Promise}
 */

TXDB.prototype.getBlocks = function getBlocks() {
  return this.keys({
    gte: layout.b(0),
    lte: layout.b(0xffffffff),
    parse: function parse(key) {
      return layout.bb(key);
    }
  });
};

/**
 * Get block record.
 * @param {Number} height
 * @returns {Promise}
 */

TXDB.prototype.getBlock = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(height) {
    var data;
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            _context15.next = 2;
            return this.get(layout.b(height));

          case 2:
            data = _context15.sent;

            if (data) {
              _context15.next = 5;
              break;
            }

            return _context15.abrupt('return', null);

          case 5:
            return _context15.abrupt('return', BlockRecord.fromRaw(data));

          case 6:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this);
  }));

  function getBlock(_x24) {
    return _ref19.apply(this, arguments);
  }

  return getBlock;
}();

/**
 * Append to the global block record.
 * @param {Hash} hash
 * @param {BlockMeta} meta
 * @returns {Promise}
 */

TXDB.prototype.addBlock = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(hash, meta) {
    var key, data, block, size;
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            key = layout.b(meta.height);
            _context16.next = 3;
            return this.get(key);

          case 3:
            data = _context16.sent;
            block = void 0;


            if (!data) {
              block = BlockRecord.fromMeta(meta);
              data = block.toRaw();
            }

            block = Buffer.allocUnsafe(data.length + 32);
            data.copy(block, 0);

            size = block.readUInt32LE(40, true);

            block.writeUInt32LE(size + 1, 40, true);
            hash.copy(block, data.length);

            this.put(key, block);

          case 12:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function addBlock(_x25, _x26) {
    return _ref20.apply(this, arguments);
  }

  return addBlock;
}();

/**
 * Remove from the global block record.
 * @param {Hash} hash
 * @param {Number} height
 * @returns {Promise}
 */

TXDB.prototype.removeBlock = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(hash, height) {
    var key, data, size, block;
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            key = layout.b(height);
            _context17.next = 3;
            return this.get(key);

          case 3:
            data = _context17.sent;

            if (data) {
              _context17.next = 6;
              break;
            }

            return _context17.abrupt('return');

          case 6:
            size = data.readUInt32LE(40, true);


            assert(size > 0);
            assert(data.slice(-32).equals(hash));

            if (!(size === 1)) {
              _context17.next = 12;
              break;
            }

            this.del(key);
            return _context17.abrupt('return');

          case 12:
            block = data.slice(0, -32);

            block.writeUInt32LE(size - 1, 40, true);

            this.put(key, block);

          case 15:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this);
  }));

  function removeBlock(_x27, _x28) {
    return _ref21.apply(this, arguments);
  }

  return removeBlock;
}();

/**
 * Append to the global block record.
 * @param {Hash} hash
 * @param {BlockMeta} meta
 * @returns {Promise}
 */

TXDB.prototype.addBlockSlow = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(hash, meta) {
    var block;
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            _context18.next = 2;
            return this.getBlock(meta.height);

          case 2:
            block = _context18.sent;


            if (!block) block = BlockRecord.fromMeta(meta);

            if (block.add(hash)) {
              _context18.next = 6;
              break;
            }

            return _context18.abrupt('return');

          case 6:

            this.put(layout.b(meta.height), block.toRaw());

          case 7:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this);
  }));

  function addBlockSlow(_x29, _x30) {
    return _ref22.apply(this, arguments);
  }

  return addBlockSlow;
}();

/**
 * Remove from the global block record.
 * @param {Hash} hash
 * @param {Number} height
 * @returns {Promise}
 */

TXDB.prototype.removeBlockSlow = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(hash, height) {
    var block;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            _context19.next = 2;
            return this.getBlock(height);

          case 2:
            block = _context19.sent;

            if (block) {
              _context19.next = 5;
              break;
            }

            return _context19.abrupt('return');

          case 5:
            if (block.remove(hash)) {
              _context19.next = 7;
              break;
            }

            return _context19.abrupt('return');

          case 7:
            if (!(block.hashes.length === 0)) {
              _context19.next = 10;
              break;
            }

            this.del(layout.b(height));
            return _context19.abrupt('return');

          case 10:

            this.put(layout.b(height), block.toRaw());

          case 11:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this);
  }));

  function removeBlockSlow(_x31, _x32) {
    return _ref23.apply(this, arguments);
  }

  return removeBlockSlow;
}();

/**
 * Add transaction, potentially runs
 * `confirm()` and `removeConflicts()`.
 * @param {TX} tx
 * @param {BlockMeta} block
 * @returns {Promise}
 */

TXDB.prototype.add = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(tx, block) {
    var result;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            this.start();

            result = void 0;
            _context20.prev = 2;
            _context20.next = 5;
            return this._add(tx, block);

          case 5:
            result = _context20.sent;
            _context20.next = 12;
            break;

          case 8:
            _context20.prev = 8;
            _context20.t0 = _context20['catch'](2);

            this.drop();
            throw _context20.t0;

          case 12:
            _context20.next = 14;
            return this.commit();

          case 14:
            return _context20.abrupt('return', result);

          case 15:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this, [[2, 8]]);
  }));

  function add(_x33, _x34) {
    return _ref24.apply(this, arguments);
  }

  return add;
}();

/**
 * Add transaction without a batch.
 * @private
 * @param {TX} tx
 * @returns {Promise}
 */

TXDB.prototype._add = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(tx, block) {
    var hash, existing, wtx;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            hash = tx.hash('hex');
            _context21.next = 3;
            return this.getTX(hash);

          case 3:
            existing = _context21.sent;


            assert(!tx.mutable, 'Cannot add mutable TX to wallet.');

            if (!existing) {
              _context21.next = 13;
              break;
            }

            if (!(existing.height !== -1)) {
              _context21.next = 8;
              break;
            }

            return _context21.abrupt('return', null);

          case 8:
            if (block) {
              _context21.next = 10;
              break;
            }

            return _context21.abrupt('return', null);

          case 10:
            _context21.next = 12;
            return this._confirm(existing, block);

          case 12:
            return _context21.abrupt('return', _context21.sent);

          case 13:
            wtx = TXRecord.fromTX(tx, block);

            if (block) {
              _context21.next = 26;
              break;
            }

            _context21.next = 17;
            return this.isRBF(tx);

          case 17:
            if (!_context21.sent) {
              _context21.next = 20;
              break;
            }

            // We need to index every spender
            // hash to detect "passive"
            // replace-by-fee.
            this.put(layout.r(hash), null);
            return _context21.abrupt('return', null);

          case 20:
            _context21.next = 22;
            return this.removeConflicts(tx, true);

          case 22:
            if (_context21.sent) {
              _context21.next = 24;
              break;
            }

            return _context21.abrupt('return', null);

          case 24:
            _context21.next = 29;
            break;

          case 26:
            _context21.next = 28;
            return this.removeConflicts(tx, false);

          case 28:

            // Delete the replace-by-fee record.
            this.del(layout.r(hash));

          case 29:
            _context21.next = 31;
            return this.insert(wtx, block);

          case 31:
            return _context21.abrupt('return', _context21.sent);

          case 32:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function _add(_x35, _x36) {
    return _ref25.apply(this, arguments);
  }

  return _add;
}();

/**
 * Insert transaction.
 * @private
 * @param {TXRecord} wtx
 * @param {BlockMeta} block
 * @returns {Promise}
 */

TXDB.prototype.insert = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(wtx, block) {
    var tx, hash, height, details, accounts, own, updated, i, input, prevout, credit, coin, path, _i, output, _path, _credit, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, account;

    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            tx = wtx.tx;
            hash = wtx.hash;
            height = block ? block.height : -1;
            details = new Details(this, wtx, block);
            accounts = new _set2.default();
            own = false;
            updated = false;

            if (tx.isCoinbase()) {
              _context22.next = 48;
              break;
            }

            i = 0;

          case 9:
            if (!(i < tx.inputs.length)) {
              _context22.next = 48;
              break;
            }

            input = tx.inputs[i];
            prevout = input.prevout;
            _context22.next = 14;
            return this.getCredit(prevout.hash, prevout.index);

          case 14:
            credit = _context22.sent;

            if (credit) {
              _context22.next = 18;
              break;
            }

            // Maintain an stxo list for every
            // spent input (even ones we don't
            // recognize). This is used for
            // detecting double-spends (as best
            // we can), as well as resolving
            // inputs we didn't know were ours
            // at the time. This built-in error
            // correction is not technically
            // necessary assuming no messages
            // are ever missed from the mempool,
            // but shit happens.
            this.writeInput(tx, i);
            return _context22.abrupt('continue', 45);

          case 18:
            coin = credit.coin;

            // Do some verification.

            if (block) {
              _context22.next = 25;
              break;
            }

            _context22.next = 22;
            return this.verifyInput(tx, i, coin);

          case 22:
            if (_context22.sent) {
              _context22.next = 25;
              break;
            }

            this.clear();
            return _context22.abrupt('return', null);

          case 25:
            _context22.next = 27;
            return this.getPath(coin);

          case 27:
            path = _context22.sent;

            assert(path);

            // Build the tx details object
            // as we go, for speed.
            details.setInput(i, path, coin);
            accounts.add(path.account);

            // Write an undo coin for the credit
            // and add it to the stxo set.
            this.spendCredit(credit, tx, i);

            // Unconfirmed balance should always
            // be updated as it reflects the on-chain
            // balance _and_ mempool balance assuming
            // everything in the mempool were to confirm.
            this.pending.coin--;
            this.pending.unconfirmed -= coin.value;

            if (block) {
              _context22.next = 40;
              break;
            }

            // If the tx is not mined, we do not
            // disconnect the coin, we simply mark
            // a `spent` flag on the credit. This
            // effectively prevents the mempool
            // from altering our utxo state
            // permanently. It also makes it
            // possible to compare the on-chain
            // state vs. the mempool state.
            credit.spent = true;
            _context22.next = 38;
            return this.saveCredit(credit, path);

          case 38:
            _context22.next = 43;
            break;

          case 40:
            // If the tx is mined, we can safely
            // remove the coin being spent. This
            // coin will be indexed as an undo
            // coin so it can be reconnected
            // later during a reorg.
            this.pending.confirmed -= coin.value;
            _context22.next = 43;
            return this.removeCredit(credit, path);

          case 43:

            updated = true;
            own = true;

          case 45:
            i++;
            _context22.next = 9;
            break;

          case 48:
            _i = 0;

          case 49:
            if (!(_i < tx.outputs.length)) {
              _context22.next = 74;
              break;
            }

            output = tx.outputs[_i];
            _context22.next = 53;
            return this.getPath(output);

          case 53:
            _path = _context22.sent;

            if (_path) {
              _context22.next = 56;
              break;
            }

            return _context22.abrupt('continue', 71);

          case 56:

            details.setOutput(_i, _path);
            accounts.add(_path.account);

            // Attempt to resolve an input we
            // did not know was ours at the time.
            _context22.next = 60;
            return this.resolveInput(tx, _i, height, _path, own);

          case 60:
            if (!_context22.sent) {
              _context22.next = 63;
              break;
            }

            updated = true;
            return _context22.abrupt('continue', 71);

          case 63:
            _credit = Credit.fromTX(tx, _i, height);

            _credit.own = own;

            this.pending.coin++;
            this.pending.unconfirmed += output.value;

            if (block) this.pending.confirmed += output.value;

            _context22.next = 70;
            return this.saveCredit(_credit, _path);

          case 70:

            updated = true;

          case 71:
            _i++;
            _context22.next = 49;
            break;

          case 74:
            if (updated) {
              _context22.next = 77;
              break;
            }

            // Clear the spent list inserts.
            this.clear();
            return _context22.abrupt('return', null);

          case 77:

            // Save and index the transaction record.
            this.put(layout.t(hash), wtx.toRaw());
            this.put(layout.m(wtx.mtime, hash), null);

            if (!block) this.put(layout.p(hash), null);else this.put(layout.h(height, hash), null);

            // Do some secondary indexing for account-based
            // queries. This saves us a lot of time for
            // queries later.
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context22.prev = 83;
            for (_iterator4 = (0, _getIterator3.default)(accounts); !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              account = _step4.value;

              this.put(layout.T(account, hash), null);
              this.put(layout.M(account, wtx.mtime, hash), null);

              if (!block) this.put(layout.P(account, hash), null);else this.put(layout.H(account, height, hash), null);
            }

            // Update block records.
            _context22.next = 91;
            break;

          case 87:
            _context22.prev = 87;
            _context22.t0 = _context22['catch'](83);
            _didIteratorError4 = true;
            _iteratorError4 = _context22.t0;

          case 91:
            _context22.prev = 91;
            _context22.prev = 92;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 94:
            _context22.prev = 94;

            if (!_didIteratorError4) {
              _context22.next = 97;
              break;
            }

            throw _iteratorError4;

          case 97:
            return _context22.finish(94);

          case 98:
            return _context22.finish(91);

          case 99:
            if (!block) {
              _context22.next = 104;
              break;
            }

            _context22.next = 102;
            return this.addBlockMap(hash, height);

          case 102:
            _context22.next = 104;
            return this.addBlock(tx.hash(), block);

          case 104:

            // Update the transaction counter and
            // commit the new state. This state will
            // only overwrite the best state once
            // the batch has actually been written
            // to disk.
            this.pending.tx++;
            this.put(layout.R, this.pending.commit());

            // This transaction may unlock some
            // coins now that we've seen it.
            this.unlockTX(tx);

            // Emit events for potential local and
            // websocket listeners. Note that these
            // will only be emitted if the batch is
            // successfully written to disk.
            this.emit('tx', tx, details);
            this.emit('balance', this.pending.toBalance(), details);

            return _context22.abrupt('return', details);

          case 110:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this, [[83, 87, 91, 99], [92,, 94, 98]]);
  }));

  function insert(_x37, _x38) {
    return _ref26.apply(this, arguments);
  }

  return insert;
}();

/**
 * Attempt to confirm a transaction.
 * @private
 * @param {TX} tx
 * @param {BlockMeta} block
 * @returns {Promise}
 */

TXDB.prototype.confirm = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(hash, block) {
    var wtx, details;
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            _context23.next = 2;
            return this.getTX(hash);

          case 2:
            wtx = _context23.sent;

            if (wtx) {
              _context23.next = 5;
              break;
            }

            return _context23.abrupt('return', null);

          case 5:
            if (!(wtx.height !== -1)) {
              _context23.next = 7;
              break;
            }

            throw new Error('TX is already confirmed.');

          case 7:

            assert(block);

            this.start();

            details = void 0;
            _context23.prev = 10;
            _context23.next = 13;
            return this._confirm(wtx, block);

          case 13:
            details = _context23.sent;
            _context23.next = 20;
            break;

          case 16:
            _context23.prev = 16;
            _context23.t0 = _context23['catch'](10);

            this.drop();
            throw _context23.t0;

          case 20:
            _context23.next = 22;
            return this.commit();

          case 22:
            return _context23.abrupt('return', details);

          case 23:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this, [[10, 16]]);
  }));

  function confirm(_x39, _x40) {
    return _ref27.apply(this, arguments);
  }

  return confirm;
}();

/**
 * Attempt to confirm a transaction.
 * @private
 * @param {TXRecord} wtx
 * @param {BlockMeta} block
 * @returns {Promise}
 */

TXDB.prototype._confirm = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(wtx, block) {
    var tx, hash, height, details, accounts, credits, i, input, prevout, credit, coin, path, _i2, output, _path2, _credit2, _coin, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, account;

    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            tx = wtx.tx;
            hash = wtx.hash;
            height = block.height;
            details = new Details(this, wtx, block);
            accounts = new _set2.default();


            wtx.setBlock(block);

            if (tx.isCoinbase()) {
              _context24.next = 38;
              break;
            }

            _context24.next = 9;
            return this.getSpentCredits(tx);

          case 9:
            credits = _context24.sent;
            i = 0;

          case 11:
            if (!(i < tx.inputs.length)) {
              _context24.next = 38;
              break;
            }

            input = tx.inputs[i];
            prevout = input.prevout;
            credit = credits[i];

            // There may be new credits available
            // that we haven't seen yet.

            if (credit) {
              _context24.next = 24;
              break;
            }

            _context24.next = 18;
            return this.getCredit(prevout.hash, prevout.index);

          case 18:
            credit = _context24.sent;

            if (credit) {
              _context24.next = 21;
              break;
            }

            return _context24.abrupt('continue', 35);

          case 21:

            // Add a spend record and undo coin
            // for the coin we now know is ours.
            // We don't need to remove the coin
            // since it was never added in the
            // first place.
            this.spendCredit(credit, tx, i);

            this.pending.coin--;
            this.pending.unconfirmed -= credit.coin.value;

          case 24:
            coin = credit.coin;


            assert(coin.height !== -1);

            _context24.next = 28;
            return this.getPath(coin);

          case 28:
            path = _context24.sent;

            assert(path);

            details.setInput(i, path, coin);
            accounts.add(path.account);

            // We can now safely remove the credit
            // entirely, now that we know it's also
            // been removed on-chain.
            this.pending.confirmed -= coin.value;

            _context24.next = 35;
            return this.removeCredit(credit, path);

          case 35:
            i++;
            _context24.next = 11;
            break;

          case 38:
            _i2 = 0;

          case 39:
            if (!(_i2 < tx.outputs.length)) {
              _context24.next = 63;
              break;
            }

            output = tx.outputs[_i2];
            _context24.next = 43;
            return this.getPath(output);

          case 43:
            _path2 = _context24.sent;

            if (_path2) {
              _context24.next = 46;
              break;
            }

            return _context24.abrupt('continue', 60);

          case 46:

            details.setOutput(_i2, _path2);
            accounts.add(_path2.account);

            _context24.next = 50;
            return this.getCredit(hash, _i2);

          case 50:
            _credit2 = _context24.sent;

            assert(_credit2);

            // Credits spent in the mempool add an
            // undo coin for ease. If this credit is
            // spent in the mempool, we need to
            // update the undo coin's height.

            if (!_credit2.spent) {
              _context24.next = 55;
              break;
            }

            _context24.next = 55;
            return this.updateSpentCoin(tx, _i2, height);

          case 55:

            // Update coin height and confirmed
            // balance. Save once again.
            _coin = _credit2.coin;

            _coin.height = height;

            this.pending.confirmed += output.value;

            _context24.next = 60;
            return this.saveCredit(_credit2, _path2);

          case 60:
            _i2++;
            _context24.next = 39;
            break;

          case 63:

            // Remove the RBF index if we have one.
            this.del(layout.r(hash));

            // Save the new serialized transaction as
            // the block-related properties have been
            // updated. Also reindex for height.
            this.put(layout.t(hash), wtx.toRaw());
            this.del(layout.p(hash));
            this.put(layout.h(height, hash), null);

            // Secondary indexing also needs to change.
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context24.prev = 70;
            for (_iterator5 = (0, _getIterator3.default)(accounts); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              account = _step5.value;

              this.del(layout.P(account, hash));
              this.put(layout.H(account, height, hash), null);
            }

            _context24.next = 78;
            break;

          case 74:
            _context24.prev = 74;
            _context24.t0 = _context24['catch'](70);
            _didIteratorError5 = true;
            _iteratorError5 = _context24.t0;

          case 78:
            _context24.prev = 78;
            _context24.prev = 79;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 81:
            _context24.prev = 81;

            if (!_didIteratorError5) {
              _context24.next = 84;
              break;
            }

            throw _iteratorError5;

          case 84:
            return _context24.finish(81);

          case 85:
            return _context24.finish(78);

          case 86:
            if (!block) {
              _context24.next = 91;
              break;
            }

            _context24.next = 89;
            return this.addBlockMap(hash, height);

          case 89:
            _context24.next = 91;
            return this.addBlock(tx.hash(), block);

          case 91:

            // Commit the new state. The balance has updated.
            this.put(layout.R, this.pending.commit());

            this.unlockTX(tx);

            this.emit('confirmed', tx, details);
            this.emit('balance', this.pending.toBalance(), details);

            return _context24.abrupt('return', details);

          case 96:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this, [[70, 74, 78, 86], [79,, 81, 85]]);
  }));

  function _confirm(_x41, _x42) {
    return _ref28.apply(this, arguments);
  }

  return _confirm;
}();

/**
 * Recursively remove a transaction
 * from the database.
 * @param {Hash} hash
 * @returns {Promise}
 */

TXDB.prototype.remove = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(hash) {
    var wtx;
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            _context25.next = 2;
            return this.getTX(hash);

          case 2:
            wtx = _context25.sent;

            if (wtx) {
              _context25.next = 5;
              break;
            }

            return _context25.abrupt('return', null);

          case 5:
            _context25.next = 7;
            return this.removeRecursive(wtx);

          case 7:
            return _context25.abrupt('return', _context25.sent);

          case 8:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this);
  }));

  function remove(_x43) {
    return _ref29.apply(this, arguments);
  }

  return remove;
}();

/**
 * Remove a transaction from the
 * database. Disconnect inputs.
 * @private
 * @param {TXRecord} wtx
 * @returns {Promise}
 */

TXDB.prototype.erase = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(wtx, block) {
    var tx, hash, height, details, accounts, credits, i, credit, coin, path, _i3, output, _path3, _credit3, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, account;

    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            tx = wtx.tx;
            hash = wtx.hash;
            height = block ? block.height : -1;
            details = new Details(this, wtx, block);
            accounts = new _set2.default();

            if (tx.isCoinbase()) {
              _context26.next = 31;
              break;
            }

            _context26.next = 8;
            return this.getSpentCredits(tx);

          case 8:
            credits = _context26.sent;
            i = 0;

          case 10:
            if (!(i < tx.inputs.length)) {
              _context26.next = 31;
              break;
            }

            credit = credits[i];

            if (credit) {
              _context26.next = 15;
              break;
            }

            // This input never had an undo
            // coin, but remove it from the
            // stxo set.
            this.removeInput(tx, i);
            return _context26.abrupt('continue', 28);

          case 15:
            coin = credit.coin;
            _context26.next = 18;
            return this.getPath(coin);

          case 18:
            path = _context26.sent;

            assert(path);

            details.setInput(i, path, coin);
            accounts.add(path.account);

            // Recalculate the balance, remove
            // from stxo set, remove the undo
            // coin, and resave the credit.
            this.pending.coin++;
            this.pending.unconfirmed += coin.value;

            if (block) this.pending.confirmed += coin.value;

            this.unspendCredit(tx, i);
            _context26.next = 28;
            return this.saveCredit(credit, path);

          case 28:
            i++;
            _context26.next = 10;
            break;

          case 31:
            _i3 = 0;

          case 32:
            if (!(_i3 < tx.outputs.length)) {
              _context26.next = 50;
              break;
            }

            output = tx.outputs[_i3];
            _context26.next = 36;
            return this.getPath(output);

          case 36:
            _path3 = _context26.sent;

            if (_path3) {
              _context26.next = 39;
              break;
            }

            return _context26.abrupt('continue', 47);

          case 39:

            details.setOutput(_i3, _path3);
            accounts.add(_path3.account);

            _credit3 = Credit.fromTX(tx, _i3, height);


            this.pending.coin--;
            this.pending.unconfirmed -= output.value;

            if (block) this.pending.confirmed -= output.value;

            _context26.next = 47;
            return this.removeCredit(_credit3, _path3);

          case 47:
            _i3++;
            _context26.next = 32;
            break;

          case 50:

            // Remove the RBF index if we have one.
            this.del(layout.r(hash));

            // Remove the transaction data
            // itself as well as unindex.
            this.del(layout.t(hash));
            this.del(layout.m(wtx.mtime, hash));

            if (!block) this.del(layout.p(hash));else this.del(layout.h(height, hash));

            // Remove all secondary indexing.
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context26.prev = 57;
            for (_iterator6 = (0, _getIterator3.default)(accounts); !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              account = _step6.value;

              this.del(layout.T(account, hash));
              this.del(layout.M(account, wtx.mtime, hash));

              if (!block) this.del(layout.P(account, hash));else this.del(layout.H(account, height, hash));
            }

            // Update block records.
            _context26.next = 65;
            break;

          case 61:
            _context26.prev = 61;
            _context26.t0 = _context26['catch'](57);
            _didIteratorError6 = true;
            _iteratorError6 = _context26.t0;

          case 65:
            _context26.prev = 65;
            _context26.prev = 66;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 68:
            _context26.prev = 68;

            if (!_didIteratorError6) {
              _context26.next = 71;
              break;
            }

            throw _iteratorError6;

          case 71:
            return _context26.finish(68);

          case 72:
            return _context26.finish(65);

          case 73:
            if (!block) {
              _context26.next = 78;
              break;
            }

            _context26.next = 76;
            return this.removeBlockMap(hash, height);

          case 76:
            _context26.next = 78;
            return this.removeBlockSlow(hash, height);

          case 78:

            // Update the transaction counter
            // and commit new state due to
            // balance change.
            this.pending.tx--;
            this.put(layout.R, this.pending.commit());

            this.emit('remove tx', tx, details);
            this.emit('balance', this.pending.toBalance(), details);

            return _context26.abrupt('return', details);

          case 83:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this, [[57, 61, 65, 73], [66,, 68, 72]]);
  }));

  function erase(_x44, _x45) {
    return _ref30.apply(this, arguments);
  }

  return erase;
}();

/**
 * Remove a transaction and recursively
 * remove all of its spenders.
 * @private
 * @param {TXRecord} wtx
 * @returns {Promise}
 */

TXDB.prototype.removeRecursive = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(wtx) {
    var tx, hash, i, spent, stx, details;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            tx = wtx.tx;
            hash = wtx.hash;
            i = 0;

          case 3:
            if (!(i < tx.outputs.length)) {
              _context27.next = 18;
              break;
            }

            _context27.next = 6;
            return this.getSpent(hash, i);

          case 6:
            spent = _context27.sent;

            if (spent) {
              _context27.next = 9;
              break;
            }

            return _context27.abrupt('continue', 15);

          case 9:
            _context27.next = 11;
            return this.getTX(spent.hash);

          case 11:
            stx = _context27.sent;


            assert(stx);

            _context27.next = 15;
            return this.removeRecursive(stx);

          case 15:
            i++;
            _context27.next = 3;
            break;

          case 18:

            this.start();

            // Remove the spender.
            _context27.next = 21;
            return this.erase(wtx, wtx.getBlock());

          case 21:
            details = _context27.sent;


            assert(details);

            _context27.next = 25;
            return this.commit();

          case 25:
            return _context27.abrupt('return', details);

          case 26:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function removeRecursive(_x46) {
    return _ref31.apply(this, arguments);
  }

  return removeRecursive;
}();

/**
 * Unconfirm a transaction. Necessary after a reorg.
 * @param {Hash} hash
 * @returns {Promise}
 */

TXDB.prototype.unconfirm = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(hash) {
    var details;
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            this.start();

            details = void 0;
            _context28.prev = 2;
            _context28.next = 5;
            return this._unconfirm(hash);

          case 5:
            details = _context28.sent;
            _context28.next = 12;
            break;

          case 8:
            _context28.prev = 8;
            _context28.t0 = _context28['catch'](2);

            this.drop();
            throw _context28.t0;

          case 12:
            _context28.next = 14;
            return this.commit();

          case 14:
            return _context28.abrupt('return', details);

          case 15:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this, [[2, 8]]);
  }));

  function unconfirm(_x47) {
    return _ref32.apply(this, arguments);
  }

  return unconfirm;
}();

/**
 * Unconfirm a transaction without a batch.
 * @private
 * @param {Hash} hash
 * @returns {Promise}
 */

TXDB.prototype._unconfirm = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(hash) {
    var wtx;
    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            _context29.next = 2;
            return this.getTX(hash);

          case 2:
            wtx = _context29.sent;

            if (wtx) {
              _context29.next = 5;
              break;
            }

            return _context29.abrupt('return', null);

          case 5:
            if (!(wtx.height === -1)) {
              _context29.next = 7;
              break;
            }

            return _context29.abrupt('return', null);

          case 7:
            _context29.next = 9;
            return this.disconnect(wtx, wtx.getBlock());

          case 9:
            return _context29.abrupt('return', _context29.sent);

          case 10:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this);
  }));

  function _unconfirm(_x48) {
    return _ref33.apply(this, arguments);
  }

  return _unconfirm;
}();

/**
 * Unconfirm a transaction. Necessary after a reorg.
 * @param {TXRecord} wtx
 * @returns {Promise}
 */

TXDB.prototype.disconnect = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(wtx, block) {
    var tx, hash, height, details, accounts, credits, i, credit, coin, path, _i4, output, _path4, _credit4, _coin2, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, account;

    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            tx = wtx.tx;
            hash = wtx.hash;
            height = block.height;
            details = new Details(this, wtx, block);
            accounts = new _set2.default();


            assert(block);

            wtx.unsetBlock();

            if (tx.isCoinbase()) {
              _context30.next = 31;
              break;
            }

            _context30.next = 10;
            return this.getSpentCredits(tx);

          case 10:
            credits = _context30.sent;
            i = 0;

          case 12:
            if (!(i < tx.inputs.length)) {
              _context30.next = 31;
              break;
            }

            credit = credits[i];

            if (credit) {
              _context30.next = 16;
              break;
            }

            return _context30.abrupt('continue', 28);

          case 16:
            coin = credit.coin;


            assert(coin.height !== -1);

            _context30.next = 20;
            return this.getPath(coin);

          case 20:
            path = _context30.sent;

            assert(path);

            details.setInput(i, path, coin);
            accounts.add(path.account);

            this.pending.confirmed += coin.value;

            // Resave the credit and mark it
            // as spent in the mempool instead.
            credit.spent = true;
            _context30.next = 28;
            return this.saveCredit(credit, path);

          case 28:
            i++;
            _context30.next = 12;
            break;

          case 31:
            _i4 = 0;

          case 32:
            if (!(_i4 < tx.outputs.length)) {
              _context30.next = 59;
              break;
            }

            output = tx.outputs[_i4];
            _context30.next = 36;
            return this.getPath(output);

          case 36:
            _path4 = _context30.sent;

            if (_path4) {
              _context30.next = 39;
              break;
            }

            return _context30.abrupt('continue', 56);

          case 39:
            _context30.next = 41;
            return this.getCredit(hash, _i4);

          case 41:
            _credit4 = _context30.sent;

            if (_credit4) {
              _context30.next = 46;
              break;
            }

            _context30.next = 45;
            return this.updateSpentCoin(tx, _i4, height);

          case 45:
            return _context30.abrupt('continue', 56);

          case 46:
            if (!_credit4.spent) {
              _context30.next = 49;
              break;
            }

            _context30.next = 49;
            return this.updateSpentCoin(tx, _i4, height);

          case 49:

            details.setOutput(_i4, _path4);
            accounts.add(_path4.account);

            // Update coin height and confirmed
            // balance. Save once again.
            _coin2 = _credit4.coin;

            _coin2.height = -1;

            this.pending.confirmed -= output.value;

            _context30.next = 56;
            return this.saveCredit(_credit4, _path4);

          case 56:
            _i4++;
            _context30.next = 32;
            break;

          case 59:
            _context30.next = 61;
            return this.removeBlockMap(hash, height);

          case 61:
            _context30.next = 63;
            return this.removeBlock(tx.hash(), height);

          case 63:

            // We need to update the now-removed
            // block properties and reindex due
            // to the height change.
            this.put(layout.t(hash), wtx.toRaw());
            this.put(layout.p(hash), null);
            this.del(layout.h(height, hash));

            // Secondary indexing also needs to change.
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context30.prev = 69;
            for (_iterator7 = (0, _getIterator3.default)(accounts); !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
              account = _step7.value;

              this.put(layout.P(account, hash), null);
              this.del(layout.H(account, height, hash));
            }

            // Commit state due to unconfirmed
            // vs. confirmed balance change.
            _context30.next = 77;
            break;

          case 73:
            _context30.prev = 73;
            _context30.t0 = _context30['catch'](69);
            _didIteratorError7 = true;
            _iteratorError7 = _context30.t0;

          case 77:
            _context30.prev = 77;
            _context30.prev = 78;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 80:
            _context30.prev = 80;

            if (!_didIteratorError7) {
              _context30.next = 83;
              break;
            }

            throw _iteratorError7;

          case 83:
            return _context30.finish(80);

          case 84:
            return _context30.finish(77);

          case 85:
            this.put(layout.R, this.pending.commit());

            this.emit('unconfirmed', tx, details);
            this.emit('balance', this.pending.toBalance(), details);

            return _context30.abrupt('return', details);

          case 89:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this, [[69, 73, 77, 85], [78,, 80, 84]]);
  }));

  function disconnect(_x49, _x50) {
    return _ref34.apply(this, arguments);
  }

  return disconnect;
}();

/**
 * Remove spenders that have not been confirmed. We do this in the
 * odd case of stuck transactions or when a coin is double-spent
 * by a newer transaction. All previously-spending transactions
 * of that coin that are _not_ confirmed will be removed from
 * the database.
 * @private
 * @param {Hash} hash
 * @param {TX} ref - Reference tx, the tx that double-spent.
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.removeConflict = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(wtx) {
    var tx, details;
    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            tx = wtx.tx;


            this.logger.warning('Handling conflicting tx: %s.', tx.txid());

            this.drop();

            _context31.next = 5;
            return this.removeRecursive(wtx);

          case 5:
            details = _context31.sent;


            this.start();

            this.logger.warning('Removed conflict: %s.', tx.txid());

            // Emit the _removed_ transaction.
            this.emit('conflict', tx, details);

            return _context31.abrupt('return', details);

          case 10:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this);
  }));

  function removeConflict(_x51) {
    return _ref35.apply(this, arguments);
  }

  return removeConflict;
}();

/**
 * Retrieve coins for own inputs, remove
 * double spenders, and verify inputs.
 * @private
 * @param {TX} tx
 * @returns {Promise}
 */

TXDB.prototype.removeConflicts = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(tx, conf) {
    var hash, spends, i, input, prevout, spent, spender, block, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, _spender;

    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            hash = tx.hash('hex');
            spends = [];

            if (!tx.isCoinbase()) {
              _context32.next = 4;
              break;
            }

            return _context32.abrupt('return', true);

          case 4:
            i = 0;

          case 5:
            if (!(i < tx.inputs.length)) {
              _context32.next = 26;
              break;
            }

            input = tx.inputs[i];
            prevout = input.prevout;

            // Is it already spent?

            _context32.next = 10;
            return this.getSpent(prevout.hash, prevout.index);

          case 10:
            spent = _context32.sent;

            if (spent) {
              _context32.next = 13;
              break;
            }

            return _context32.abrupt('continue', 23);

          case 13:
            if (!(spent.hash === hash)) {
              _context32.next = 15;
              break;
            }

            return _context32.abrupt('continue', 23);

          case 15:
            _context32.next = 17;
            return this.getTX(spent.hash);

          case 17:
            spender = _context32.sent;

            assert(spender);

            block = spender.getBlock();

            if (!(conf && block)) {
              _context32.next = 22;
              break;
            }

            return _context32.abrupt('return', false);

          case 22:

            spends[i] = spender;

          case 23:
            i++;
            _context32.next = 5;
            break;

          case 26:

            // Once we know we're not going to
            // screw things up, remove the double
            // spenders.
            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context32.prev = 29;
            _iterator8 = (0, _getIterator3.default)(spends);

          case 31:
            if (_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done) {
              _context32.next = 40;
              break;
            }

            _spender = _step8.value;

            if (_spender) {
              _context32.next = 35;
              break;
            }

            return _context32.abrupt('continue', 37);

          case 35:
            _context32.next = 37;
            return this.removeConflict(_spender);

          case 37:
            _iteratorNormalCompletion8 = true;
            _context32.next = 31;
            break;

          case 40:
            _context32.next = 46;
            break;

          case 42:
            _context32.prev = 42;
            _context32.t0 = _context32['catch'](29);
            _didIteratorError8 = true;
            _iteratorError8 = _context32.t0;

          case 46:
            _context32.prev = 46;
            _context32.prev = 47;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 49:
            _context32.prev = 49;

            if (!_didIteratorError8) {
              _context32.next = 52;
              break;
            }

            throw _iteratorError8;

          case 52:
            return _context32.finish(49);

          case 53:
            return _context32.finish(46);

          case 54:
            return _context32.abrupt('return', true);

          case 55:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this, [[29, 42, 46, 54], [47,, 49, 53]]);
  }));

  function removeConflicts(_x52, _x53) {
    return _ref36.apply(this, arguments);
  }

  return removeConflicts;
}();

/**
 * Attempt to verify an input.
 * @private
 * @param {TX} tx
 * @param {Number} index
 * @param {Coin} coin
 * @returns {Promise}
 */

TXDB.prototype.verifyInput = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(tx, index, coin) {
    var flags;
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            flags = Script.flags.MANDATORY_VERIFY_FLAGS;

            if (this.options.verify) {
              _context33.next = 3;
              break;
            }

            return _context33.abrupt('return', true);

          case 3:
            _context33.next = 5;
            return tx.verifyInputAsync(index, coin, flags);

          case 5:
            return _context33.abrupt('return', _context33.sent);

          case 6:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this);
  }));

  function verifyInput(_x54, _x55, _x56) {
    return _ref37.apply(this, arguments);
  }

  return verifyInput;
}();

/**
 * Lock all coins in a transaction.
 * @param {TX} tx
 */

TXDB.prototype.lockTX = function lockTX(tx) {
  if (tx.isCoinbase()) return;

  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = (0, _getIterator3.default)(tx.inputs), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var input = _step9.value;

      this.lockCoin(input.prevout);
    }
  } catch (err) {
    _didIteratorError9 = true;
    _iteratorError9 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion9 && _iterator9.return) {
        _iterator9.return();
      }
    } finally {
      if (_didIteratorError9) {
        throw _iteratorError9;
      }
    }
  }
};

/**
 * Unlock all coins in a transaction.
 * @param {TX} tx
 */

TXDB.prototype.unlockTX = function unlockTX(tx) {
  if (tx.isCoinbase()) return;

  var _iteratorNormalCompletion10 = true;
  var _didIteratorError10 = false;
  var _iteratorError10 = undefined;

  try {
    for (var _iterator10 = (0, _getIterator3.default)(tx.inputs), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
      var input = _step10.value;

      this.unlockCoin(input.prevout);
    }
  } catch (err) {
    _didIteratorError10 = true;
    _iteratorError10 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion10 && _iterator10.return) {
        _iterator10.return();
      }
    } finally {
      if (_didIteratorError10) {
        throw _iteratorError10;
      }
    }
  }
};

/**
 * Lock a single coin.
 * @param {Coin|Outpoint} coin
 */

TXDB.prototype.lockCoin = function lockCoin(coin) {
  var key = coin.toKey();
  this.locked.add(key);
};

/**
 * Unlock a single coin.
 * @param {Coin|Outpoint} coin
 */

TXDB.prototype.unlockCoin = function unlockCoin(coin) {
  var key = coin.toKey();
  return this.locked.delete(key);
};

/**
 * Test locked status of a single coin.
 * @param {Coin|Outpoint} coin
 */

TXDB.prototype.isLocked = function isLocked(coin) {
  var key = coin.toKey();
  return this.locked.has(key);
};

/**
 * Filter array of coins or outpoints
 * for only unlocked ones.
 * @param {Coin[]|Outpoint[]}
 * @returns {Array}
 */

TXDB.prototype.filterLocked = function filterLocked(coins) {
  var out = [];

  var _iteratorNormalCompletion11 = true;
  var _didIteratorError11 = false;
  var _iteratorError11 = undefined;

  try {
    for (var _iterator11 = (0, _getIterator3.default)(coins), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
      var coin = _step11.value;

      if (!this.isLocked(coin)) out.push(coin);
    }
  } catch (err) {
    _didIteratorError11 = true;
    _iteratorError11 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion11 && _iterator11.return) {
        _iterator11.return();
      }
    } finally {
      if (_didIteratorError11) {
        throw _iteratorError11;
      }
    }
  }

  return out;
};

/**
 * Return an array of all locked outpoints.
 * @returns {Outpoint[]}
 */

TXDB.prototype.getLocked = function getLocked() {
  var outpoints = [];

  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = (0, _getIterator3.default)(this.locked.keys()), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var key = _step12.value;

      outpoints.push(Outpoint.fromKey(key));
    }
  } catch (err) {
    _didIteratorError12 = true;
    _iteratorError12 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion12 && _iterator12.return) {
        _iterator12.return();
      }
    } finally {
      if (_didIteratorError12) {
        throw _iteratorError12;
      }
    }
  }

  return outpoints;
};

/**
 * Get hashes of all transactions in the database.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getAccountHistoryHashes = function getAccountHistoryHashes(account) {
  return this.keys({
    gte: layout.T(account, encoding.NULL_HASH),
    lte: layout.T(account, encoding.HIGH_HASH),
    parse: function parse(key) {
      var _layout$Tt = layout.Tt(key),
          _layout$Tt2 = (0, _slicedToArray3.default)(_layout$Tt, 2),
          hash = _layout$Tt2[1];

      return hash;
    }
  });
};

/**
 * Get hashes of all transactions in the database.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getHistoryHashes = function getHistoryHashes(account) {
  if (account != null) return this.getAccountHistoryHashes(account);

  return this.keys({
    gte: layout.t(encoding.NULL_HASH),
    lte: layout.t(encoding.HIGH_HASH),
    parse: function parse(key) {
      return layout.tt(key);
    }
  });
};

/**
 * Get hashes of all unconfirmed transactions in the database.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getAccountPendingHashes = function getAccountPendingHashes(account) {
  return this.keys({
    gte: layout.P(account, encoding.NULL_HASH),
    lte: layout.P(account, encoding.HIGH_HASH),
    parse: function parse(key) {
      var _layout$Pp = layout.Pp(key),
          _layout$Pp2 = (0, _slicedToArray3.default)(_layout$Pp, 2),
          hash = _layout$Pp2[1];

      return hash;
    }
  });
};

/**
 * Get hashes of all unconfirmed transactions in the database.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getPendingHashes = function getPendingHashes(account) {
  if (account != null) return this.getAccountPendingHashes(account);

  return this.keys({
    gte: layout.p(encoding.NULL_HASH),
    lte: layout.p(encoding.HIGH_HASH),
    parse: function parse(key) {
      return layout.pp(key);
    }
  });
};

/**
 * Get all coin hashes in the database.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getAccountOutpoints = function getAccountOutpoints(account) {
  return this.keys({
    gte: layout.C(account, encoding.NULL_HASH, 0),
    lte: layout.C(account, encoding.HIGH_HASH, 0xffffffff),
    parse: function parse(key) {
      var _layout$Cc = layout.Cc(key),
          _layout$Cc2 = (0, _slicedToArray3.default)(_layout$Cc, 3),
          hash = _layout$Cc2[1],
          index = _layout$Cc2[2];

      return new Outpoint(hash, index);
    }
  });
};

/**
 * Get all coin hashes in the database.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getOutpoints = function getOutpoints(account) {
  if (account != null) return this.getAccountOutpoints(account);

  return this.keys({
    gte: layout.c(encoding.NULL_HASH, 0),
    lte: layout.c(encoding.HIGH_HASH, 0xffffffff),
    parse: function parse(key) {
      var _layout$cc = layout.cc(key),
          _layout$cc2 = (0, _slicedToArray3.default)(_layout$cc, 2),
          hash = _layout$cc2[0],
          index = _layout$cc2[1];

      return new Outpoint(hash, index);
    }
  });
};

/**
 * Get TX hashes by height range.
 * @param {Number?} account
 * @param {Object} options
 * @param {Number} options.start - Start height.
 * @param {Number} options.end - End height.
 * @param {Number?} options.limit - Max number of records.
 * @param {Boolean?} options.reverse - Reverse order.
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getAccountHeightRangeHashes = function getAccountHeightRangeHashes(account, options) {
  var start = options.start || 0;
  var end = options.end || 0xffffffff;

  return this.keys({
    gte: layout.H(account, start, encoding.NULL_HASH),
    lte: layout.H(account, end, encoding.HIGH_HASH),
    limit: options.limit,
    reverse: options.reverse,
    parse: function parse(key) {
      var _layout$Hh = layout.Hh(key),
          _layout$Hh2 = (0, _slicedToArray3.default)(_layout$Hh, 3),
          hash = _layout$Hh2[2];

      return hash;
    }
  });
};

/**
 * Get TX hashes by height range.
 * @param {Number?} account
 * @param {Object} options
 * @param {Number} options.start - Start height.
 * @param {Number} options.end - End height.
 * @param {Number?} options.limit - Max number of records.
 * @param {Boolean?} options.reverse - Reverse order.
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getHeightRangeHashes = function getHeightRangeHashes(account, options) {
  if (account && (typeof account === 'undefined' ? 'undefined' : (0, _typeof3.default)(account)) === 'object') {
    options = account;
    account = null;
  }

  if (account != null) return this.getAccountHeightRangeHashes(account, options);

  var start = options.start || 0;
  var end = options.end || 0xffffffff;

  return this.keys({
    gte: layout.h(start, encoding.NULL_HASH),
    lte: layout.h(end, encoding.HIGH_HASH),
    limit: options.limit,
    reverse: options.reverse,
    parse: function parse(key) {
      var _layout$hh = layout.hh(key),
          _layout$hh2 = (0, _slicedToArray3.default)(_layout$hh, 2),
          hash = _layout$hh2[1];

      return hash;
    }
  });
};

/**
 * Get TX hashes by height.
 * @param {Number} height
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getHeightHashes = function getHeightHashes(height) {
  return this.getHeightRangeHashes({ start: height, end: height });
};

/**
 * Get TX hashes by timestamp range.
 * @param {Number?} account
 * @param {Object} options
 * @param {Number} options.start - Start height.
 * @param {Number} options.end - End height.
 * @param {Number?} options.limit - Max number of records.
 * @param {Boolean?} options.reverse - Reverse order.
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getAccountRangeHashes = function getAccountRangeHashes(account, options) {
  var start = options.start || 0;
  var end = options.end || 0xffffffff;

  return this.keys({
    gte: layout.M(account, start, encoding.NULL_HASH),
    lte: layout.M(account, end, encoding.HIGH_HASH),
    limit: options.limit,
    reverse: options.reverse,
    parse: function parse(key) {
      var _layout$Mm = layout.Mm(key),
          _layout$Mm2 = (0, _slicedToArray3.default)(_layout$Mm, 3),
          hash = _layout$Mm2[2];

      return hash;
    }
  });
};

/**
 * Get TX hashes by timestamp range.
 * @param {Number?} account
 * @param {Object} options
 * @param {Number} options.start - Start height.
 * @param {Number} options.end - End height.
 * @param {Number?} options.limit - Max number of records.
 * @param {Boolean?} options.reverse - Reverse order.
 * @returns {Promise} - Returns {@link Hash}[].
 */

TXDB.prototype.getRangeHashes = function getRangeHashes(account, options) {
  if (account && (typeof account === 'undefined' ? 'undefined' : (0, _typeof3.default)(account)) === 'object') {
    options = account;
    account = null;
  }

  if (account != null) return this.getAccountRangeHashes(account, options);

  var start = options.start || 0;
  var end = options.end || 0xffffffff;

  return this.keys({
    gte: layout.m(start, encoding.NULL_HASH),
    lte: layout.m(end, encoding.HIGH_HASH),
    limit: options.limit,
    reverse: options.reverse,
    parse: function parse(key) {
      var _layout$mm = layout.mm(key),
          _layout$mm2 = (0, _slicedToArray3.default)(_layout$mm, 2),
          hash = _layout$mm2[1];

      return hash;
    }
  });
};

/**
 * Get transactions by timestamp range.
 * @param {Number?} account
 * @param {Object} options
 * @param {Number} options.start - Start time.
 * @param {Number} options.end - End time.
 * @param {Number?} options.limit - Max number of records.
 * @param {Boolean?} options.reverse - Reverse order.
 * @returns {Promise} - Returns {@link TX}[].
 */

TXDB.prototype.getRange = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(account, options) {
    var txs, hashes, _iteratorNormalCompletion13, _didIteratorError13, _iteratorError13, _iterator13, _step13, hash, tx;

    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            txs = [];


            if (account && (typeof account === 'undefined' ? 'undefined' : (0, _typeof3.default)(account)) === 'object') {
              options = account;
              account = null;
            }

            _context34.next = 4;
            return this.getRangeHashes(account, options);

          case 4:
            hashes = _context34.sent;
            _iteratorNormalCompletion13 = true;
            _didIteratorError13 = false;
            _iteratorError13 = undefined;
            _context34.prev = 8;
            _iterator13 = (0, _getIterator3.default)(hashes);

          case 10:
            if (_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done) {
              _context34.next = 20;
              break;
            }

            hash = _step13.value;
            _context34.next = 14;
            return this.getTX(hash);

          case 14:
            tx = _context34.sent;

            assert(tx);
            txs.push(tx);

          case 17:
            _iteratorNormalCompletion13 = true;
            _context34.next = 10;
            break;

          case 20:
            _context34.next = 26;
            break;

          case 22:
            _context34.prev = 22;
            _context34.t0 = _context34['catch'](8);
            _didIteratorError13 = true;
            _iteratorError13 = _context34.t0;

          case 26:
            _context34.prev = 26;
            _context34.prev = 27;

            if (!_iteratorNormalCompletion13 && _iterator13.return) {
              _iterator13.return();
            }

          case 29:
            _context34.prev = 29;

            if (!_didIteratorError13) {
              _context34.next = 32;
              break;
            }

            throw _iteratorError13;

          case 32:
            return _context34.finish(29);

          case 33:
            return _context34.finish(26);

          case 34:
            return _context34.abrupt('return', txs);

          case 35:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this, [[8, 22, 26, 34], [27,, 29, 33]]);
  }));

  function getRange(_x57, _x58) {
    return _ref38.apply(this, arguments);
  }

  return getRange;
}();

/**
 * Get last N transactions.
 * @param {Number?} account
 * @param {Number} limit - Max number of transactions.
 * @returns {Promise} - Returns {@link TX}[].
 */

TXDB.prototype.getLast = function getLast(account, limit) {
  return this.getRange(account, {
    start: 0,
    end: 0xffffffff,
    reverse: true,
    limit: limit || 10
  });
};

/**
 * Get all transactions.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link TX}[].
 */

TXDB.prototype.getHistory = function getHistory(account) {
  // Slow case
  if (account != null) return this.getAccountHistory(account);

  // Fast case
  return this.values({
    gte: layout.t(encoding.NULL_HASH),
    lte: layout.t(encoding.HIGH_HASH),
    parse: TXRecord.fromRaw
  });
};

/**
 * Get all account transactions.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link TX}[].
 */

TXDB.prototype.getAccountHistory = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(account) {
    var hashes, txs, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, hash, tx;

    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            _context35.next = 2;
            return this.getHistoryHashes(account);

          case 2:
            hashes = _context35.sent;
            txs = [];
            _iteratorNormalCompletion14 = true;
            _didIteratorError14 = false;
            _iteratorError14 = undefined;
            _context35.prev = 7;
            _iterator14 = (0, _getIterator3.default)(hashes);

          case 9:
            if (_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done) {
              _context35.next = 19;
              break;
            }

            hash = _step14.value;
            _context35.next = 13;
            return this.getTX(hash);

          case 13:
            tx = _context35.sent;

            assert(tx);
            txs.push(tx);

          case 16:
            _iteratorNormalCompletion14 = true;
            _context35.next = 9;
            break;

          case 19:
            _context35.next = 25;
            break;

          case 21:
            _context35.prev = 21;
            _context35.t0 = _context35['catch'](7);
            _didIteratorError14 = true;
            _iteratorError14 = _context35.t0;

          case 25:
            _context35.prev = 25;
            _context35.prev = 26;

            if (!_iteratorNormalCompletion14 && _iterator14.return) {
              _iterator14.return();
            }

          case 28:
            _context35.prev = 28;

            if (!_didIteratorError14) {
              _context35.next = 31;
              break;
            }

            throw _iteratorError14;

          case 31:
            return _context35.finish(28);

          case 32:
            return _context35.finish(25);

          case 33:
            return _context35.abrupt('return', txs);

          case 34:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this, [[7, 21, 25, 33], [26,, 28, 32]]);
  }));

  function getAccountHistory(_x59) {
    return _ref39.apply(this, arguments);
  }

  return getAccountHistory;
}();

/**
 * Get unconfirmed transactions.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link TX}[].
 */

TXDB.prototype.getPending = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(account) {
    var hashes, txs, _iteratorNormalCompletion15, _didIteratorError15, _iteratorError15, _iterator15, _step15, hash, tx;

    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            _context36.next = 2;
            return this.getPendingHashes(account);

          case 2:
            hashes = _context36.sent;
            txs = [];
            _iteratorNormalCompletion15 = true;
            _didIteratorError15 = false;
            _iteratorError15 = undefined;
            _context36.prev = 7;
            _iterator15 = (0, _getIterator3.default)(hashes);

          case 9:
            if (_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done) {
              _context36.next = 19;
              break;
            }

            hash = _step15.value;
            _context36.next = 13;
            return this.getTX(hash);

          case 13:
            tx = _context36.sent;

            assert(tx);
            txs.push(tx);

          case 16:
            _iteratorNormalCompletion15 = true;
            _context36.next = 9;
            break;

          case 19:
            _context36.next = 25;
            break;

          case 21:
            _context36.prev = 21;
            _context36.t0 = _context36['catch'](7);
            _didIteratorError15 = true;
            _iteratorError15 = _context36.t0;

          case 25:
            _context36.prev = 25;
            _context36.prev = 26;

            if (!_iteratorNormalCompletion15 && _iterator15.return) {
              _iterator15.return();
            }

          case 28:
            _context36.prev = 28;

            if (!_didIteratorError15) {
              _context36.next = 31;
              break;
            }

            throw _iteratorError15;

          case 31:
            return _context36.finish(28);

          case 32:
            return _context36.finish(25);

          case 33:
            return _context36.abrupt('return', txs);

          case 34:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this, [[7, 21, 25, 33], [26,, 28, 32]]);
  }));

  function getPending(_x60) {
    return _ref40.apply(this, arguments);
  }

  return getPending;
}();

/**
 * Get coins.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Coin}[].
 */

TXDB.prototype.getCredits = function getCredits(account) {
  var _this = this;

  // Slow case
  if (account != null) return this.getAccountCredits(account);

  // Fast case
  return this.range({
    gte: layout.c(encoding.NULL_HASH, 0x00000000),
    lte: layout.c(encoding.HIGH_HASH, 0xffffffff),
    parse: function parse(key, value) {
      var _layout$cc3 = layout.cc(key),
          _layout$cc4 = (0, _slicedToArray3.default)(_layout$cc3, 2),
          hash = _layout$cc4[0],
          index = _layout$cc4[1];

      var credit = Credit.fromRaw(value);
      var ckey = Outpoint.toKey(hash, index);
      credit.coin.hash = hash;
      credit.coin.index = index;
      _this.coinCache.set(ckey, value);
      return credit;
    }
  });
};

/**
 * Get coins by account.
 * @param {Number} account
 * @returns {Promise} - Returns {@link Coin}[].
 */

TXDB.prototype.getAccountCredits = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(account) {
    var outpoints, credits, _iteratorNormalCompletion16, _didIteratorError16, _iteratorError16, _iterator16, _step16, prevout, credit;

    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            _context37.next = 2;
            return this.getOutpoints(account);

          case 2:
            outpoints = _context37.sent;
            credits = [];
            _iteratorNormalCompletion16 = true;
            _didIteratorError16 = false;
            _iteratorError16 = undefined;
            _context37.prev = 7;
            _iterator16 = (0, _getIterator3.default)(outpoints);

          case 9:
            if (_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done) {
              _context37.next = 19;
              break;
            }

            prevout = _step16.value;
            _context37.next = 13;
            return this.getCredit(prevout.hash, prevout.index);

          case 13:
            credit = _context37.sent;

            assert(credit);
            credits.push(credit);

          case 16:
            _iteratorNormalCompletion16 = true;
            _context37.next = 9;
            break;

          case 19:
            _context37.next = 25;
            break;

          case 21:
            _context37.prev = 21;
            _context37.t0 = _context37['catch'](7);
            _didIteratorError16 = true;
            _iteratorError16 = _context37.t0;

          case 25:
            _context37.prev = 25;
            _context37.prev = 26;

            if (!_iteratorNormalCompletion16 && _iterator16.return) {
              _iterator16.return();
            }

          case 28:
            _context37.prev = 28;

            if (!_didIteratorError16) {
              _context37.next = 31;
              break;
            }

            throw _iteratorError16;

          case 31:
            return _context37.finish(28);

          case 32:
            return _context37.finish(25);

          case 33:
            return _context37.abrupt('return', credits);

          case 34:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this, [[7, 21, 25, 33], [26,, 28, 32]]);
  }));

  function getAccountCredits(_x61) {
    return _ref41.apply(this, arguments);
  }

  return getAccountCredits;
}();

/**
 * Fill a transaction with coins (all historical coins).
 * @param {TX} tx
 * @returns {Promise} - Returns {@link TX}.
 */

TXDB.prototype.getSpentCredits = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(tx) {
    var hash, credits, i;
    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            if (!tx.isCoinbase()) {
              _context38.next = 2;
              break;
            }

            return _context38.abrupt('return', []);

          case 2:
            hash = tx.hash('hex');
            credits = [];


            for (i = 0; i < tx.inputs.length; i++) {
              credits.push(null);
            }_context38.next = 7;
            return this.range({
              gte: layout.d(hash, 0x00000000),
              lte: layout.d(hash, 0xffffffff),
              parse: function parse(key, value) {
                var _layout$dd = layout.dd(key),
                    _layout$dd2 = (0, _slicedToArray3.default)(_layout$dd, 2),
                    index = _layout$dd2[1];

                var coin = Coin.fromRaw(value);
                var input = tx.inputs[index];
                assert(input);
                coin.hash = input.prevout.hash;
                coin.index = input.prevout.index;
                credits[index] = new Credit(coin);
              }
            });

          case 7:
            return _context38.abrupt('return', credits);

          case 8:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this);
  }));

  function getSpentCredits(_x62) {
    return _ref42.apply(this, arguments);
  }

  return getSpentCredits;
}();

/**
 * Get coins.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Coin}[].
 */

TXDB.prototype.getCoins = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(account) {
    var credits, coins, _iteratorNormalCompletion17, _didIteratorError17, _iteratorError17, _iterator17, _step17, credit;

    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            _context39.next = 2;
            return this.getCredits(account);

          case 2:
            credits = _context39.sent;
            coins = [];
            _iteratorNormalCompletion17 = true;
            _didIteratorError17 = false;
            _iteratorError17 = undefined;
            _context39.prev = 7;
            _iterator17 = (0, _getIterator3.default)(credits);

          case 9:
            if (_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done) {
              _context39.next = 17;
              break;
            }

            credit = _step17.value;

            if (!credit.spent) {
              _context39.next = 13;
              break;
            }

            return _context39.abrupt('continue', 14);

          case 13:

            coins.push(credit.coin);

          case 14:
            _iteratorNormalCompletion17 = true;
            _context39.next = 9;
            break;

          case 17:
            _context39.next = 23;
            break;

          case 19:
            _context39.prev = 19;
            _context39.t0 = _context39['catch'](7);
            _didIteratorError17 = true;
            _iteratorError17 = _context39.t0;

          case 23:
            _context39.prev = 23;
            _context39.prev = 24;

            if (!_iteratorNormalCompletion17 && _iterator17.return) {
              _iterator17.return();
            }

          case 26:
            _context39.prev = 26;

            if (!_didIteratorError17) {
              _context39.next = 29;
              break;
            }

            throw _iteratorError17;

          case 29:
            return _context39.finish(26);

          case 30:
            return _context39.finish(23);

          case 31:
            return _context39.abrupt('return', coins);

          case 32:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this, [[7, 19, 23, 31], [24,, 26, 30]]);
  }));

  function getCoins(_x63) {
    return _ref43.apply(this, arguments);
  }

  return getCoins;
}();

/**
 * Get coins by account.
 * @param {Number} account
 * @returns {Promise} - Returns {@link Coin}[].
 */

TXDB.prototype.getAccountCoins = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(account) {
    var credits, coins, _iteratorNormalCompletion18, _didIteratorError18, _iteratorError18, _iterator18, _step18, credit;

    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            _context40.next = 2;
            return this.getAccountCredits(account);

          case 2:
            credits = _context40.sent;
            coins = [];
            _iteratorNormalCompletion18 = true;
            _didIteratorError18 = false;
            _iteratorError18 = undefined;
            _context40.prev = 7;
            _iterator18 = (0, _getIterator3.default)(credits);

          case 9:
            if (_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done) {
              _context40.next = 17;
              break;
            }

            credit = _step18.value;

            if (!credit.spent) {
              _context40.next = 13;
              break;
            }

            return _context40.abrupt('continue', 14);

          case 13:

            coins.push(credit.coin);

          case 14:
            _iteratorNormalCompletion18 = true;
            _context40.next = 9;
            break;

          case 17:
            _context40.next = 23;
            break;

          case 19:
            _context40.prev = 19;
            _context40.t0 = _context40['catch'](7);
            _didIteratorError18 = true;
            _iteratorError18 = _context40.t0;

          case 23:
            _context40.prev = 23;
            _context40.prev = 24;

            if (!_iteratorNormalCompletion18 && _iterator18.return) {
              _iterator18.return();
            }

          case 26:
            _context40.prev = 26;

            if (!_didIteratorError18) {
              _context40.next = 29;
              break;
            }

            throw _iteratorError18;

          case 29:
            return _context40.finish(26);

          case 30:
            return _context40.finish(23);

          case 31:
            return _context40.abrupt('return', coins);

          case 32:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this, [[7, 19, 23, 31], [24,, 26, 30]]);
  }));

  function getAccountCoins(_x64) {
    return _ref44.apply(this, arguments);
  }

  return getAccountCoins;
}();

/**
 * Get historical coins for a transaction.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link TX}.
 */

TXDB.prototype.getSpentCoins = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(tx) {
    var credits, coins, _iteratorNormalCompletion19, _didIteratorError19, _iteratorError19, _iterator19, _step19, credit;

    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            if (!tx.isCoinbase()) {
              _context41.next = 2;
              break;
            }

            return _context41.abrupt('return', []);

          case 2:
            _context41.next = 4;
            return this.getSpentCredits(tx);

          case 4:
            credits = _context41.sent;
            coins = [];
            _iteratorNormalCompletion19 = true;
            _didIteratorError19 = false;
            _iteratorError19 = undefined;
            _context41.prev = 9;
            _iterator19 = (0, _getIterator3.default)(credits);

          case 11:
            if (_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done) {
              _context41.next = 20;
              break;
            }

            credit = _step19.value;

            if (credit) {
              _context41.next = 16;
              break;
            }

            coins.push(null);
            return _context41.abrupt('continue', 17);

          case 16:

            coins.push(credit.coin);

          case 17:
            _iteratorNormalCompletion19 = true;
            _context41.next = 11;
            break;

          case 20:
            _context41.next = 26;
            break;

          case 22:
            _context41.prev = 22;
            _context41.t0 = _context41['catch'](9);
            _didIteratorError19 = true;
            _iteratorError19 = _context41.t0;

          case 26:
            _context41.prev = 26;
            _context41.prev = 27;

            if (!_iteratorNormalCompletion19 && _iterator19.return) {
              _iterator19.return();
            }

          case 29:
            _context41.prev = 29;

            if (!_didIteratorError19) {
              _context41.next = 32;
              break;
            }

            throw _iteratorError19;

          case 32:
            return _context41.finish(29);

          case 33:
            return _context41.finish(26);

          case 34:
            return _context41.abrupt('return', coins);

          case 35:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this, [[9, 22, 26, 34], [27,, 29, 33]]);
  }));

  function getSpentCoins(_x65) {
    return _ref45.apply(this, arguments);
  }

  return getSpentCoins;
}();

/**
 * Get a coin viewpoint.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

TXDB.prototype.getCoinView = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(tx) {
    var view, _iteratorNormalCompletion20, _didIteratorError20, _iteratorError20, _iterator20, _step20, input, prevout, coin;

    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            view = new CoinView();

            if (!tx.isCoinbase()) {
              _context42.next = 3;
              break;
            }

            return _context42.abrupt('return', view);

          case 3:
            _iteratorNormalCompletion20 = true;
            _didIteratorError20 = false;
            _iteratorError20 = undefined;
            _context42.prev = 6;
            _iterator20 = (0, _getIterator3.default)(tx.inputs);

          case 8:
            if (_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done) {
              _context42.next = 20;
              break;
            }

            input = _step20.value;
            prevout = input.prevout;
            _context42.next = 13;
            return this.getCoin(prevout.hash, prevout.index);

          case 13:
            coin = _context42.sent;

            if (coin) {
              _context42.next = 16;
              break;
            }

            return _context42.abrupt('continue', 17);

          case 16:

            view.addCoin(coin);

          case 17:
            _iteratorNormalCompletion20 = true;
            _context42.next = 8;
            break;

          case 20:
            _context42.next = 26;
            break;

          case 22:
            _context42.prev = 22;
            _context42.t0 = _context42['catch'](6);
            _didIteratorError20 = true;
            _iteratorError20 = _context42.t0;

          case 26:
            _context42.prev = 26;
            _context42.prev = 27;

            if (!_iteratorNormalCompletion20 && _iterator20.return) {
              _iterator20.return();
            }

          case 29:
            _context42.prev = 29;

            if (!_didIteratorError20) {
              _context42.next = 32;
              break;
            }

            throw _iteratorError20;

          case 32:
            return _context42.finish(29);

          case 33:
            return _context42.finish(26);

          case 34:
            return _context42.abrupt('return', view);

          case 35:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this, [[6, 22, 26, 34], [27,, 29, 33]]);
  }));

  function getCoinView(_x66) {
    return _ref46.apply(this, arguments);
  }

  return getCoinView;
}();

/**
 * Get historical coin viewpoint.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

TXDB.prototype.getSpentView = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(tx) {
    var view, coins, _iteratorNormalCompletion21, _didIteratorError21, _iteratorError21, _iterator21, _step21, coin;

    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            view = new CoinView();

            if (!tx.isCoinbase()) {
              _context43.next = 3;
              break;
            }

            return _context43.abrupt('return', view);

          case 3:
            _context43.next = 5;
            return this.getSpentCoins(tx);

          case 5:
            coins = _context43.sent;
            _iteratorNormalCompletion21 = true;
            _didIteratorError21 = false;
            _iteratorError21 = undefined;
            _context43.prev = 9;
            _iterator21 = (0, _getIterator3.default)(coins);

          case 11:
            if (_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done) {
              _context43.next = 19;
              break;
            }

            coin = _step21.value;

            if (coin) {
              _context43.next = 15;
              break;
            }

            return _context43.abrupt('continue', 16);

          case 15:

            view.addCoin(coin);

          case 16:
            _iteratorNormalCompletion21 = true;
            _context43.next = 11;
            break;

          case 19:
            _context43.next = 25;
            break;

          case 21:
            _context43.prev = 21;
            _context43.t0 = _context43['catch'](9);
            _didIteratorError21 = true;
            _iteratorError21 = _context43.t0;

          case 25:
            _context43.prev = 25;
            _context43.prev = 26;

            if (!_iteratorNormalCompletion21 && _iterator21.return) {
              _iterator21.return();
            }

          case 28:
            _context43.prev = 28;

            if (!_didIteratorError21) {
              _context43.next = 31;
              break;
            }

            throw _iteratorError21;

          case 31:
            return _context43.finish(28);

          case 32:
            return _context43.finish(25);

          case 33:
            return _context43.abrupt('return', view);

          case 34:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this, [[9, 21, 25, 33], [26,, 28, 32]]);
  }));

  function getSpentView(_x67) {
    return _ref47.apply(this, arguments);
  }

  return getSpentView;
}();

/**
 * Get TXDB state.
 * @returns {Promise}
 */

TXDB.prototype.getState = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44() {
    var data;
    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            _context44.next = 2;
            return this.get(layout.R);

          case 2:
            data = _context44.sent;

            if (data) {
              _context44.next = 5;
              break;
            }

            return _context44.abrupt('return', null);

          case 5:
            return _context44.abrupt('return', TXDBState.fromRaw(this.wallet.wid, this.wallet.id, data));

          case 6:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this);
  }));

  function getState() {
    return _ref48.apply(this, arguments);
  }

  return getState;
}();

/**
 * Get transaction.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TX}.
 */

TXDB.prototype.getTX = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(hash) {
    var raw;
    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            _context45.next = 2;
            return this.get(layout.t(hash));

          case 2:
            raw = _context45.sent;

            if (raw) {
              _context45.next = 5;
              break;
            }

            return _context45.abrupt('return', null);

          case 5:
            return _context45.abrupt('return', TXRecord.fromRaw(raw));

          case 6:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this);
  }));

  function getTX(_x68) {
    return _ref49.apply(this, arguments);
  }

  return getTX;
}();

/**
 * Get transaction details.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TXDetails}.
 */

TXDB.prototype.getDetails = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(hash) {
    var wtx;
    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            _context46.next = 2;
            return this.getTX(hash);

          case 2:
            wtx = _context46.sent;

            if (wtx) {
              _context46.next = 5;
              break;
            }

            return _context46.abrupt('return', null);

          case 5:
            _context46.next = 7;
            return this.toDetails(wtx);

          case 7:
            return _context46.abrupt('return', _context46.sent);

          case 8:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this);
  }));

  function getDetails(_x69) {
    return _ref50.apply(this, arguments);
  }

  return getDetails;
}();

/**
 * Convert transaction to transaction details.
 * @param {TXRecord[]} wtxs
 * @returns {Promise}
 */

TXDB.prototype.toDetails = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47(wtxs) {
    var out, _iteratorNormalCompletion22, _didIteratorError22, _iteratorError22, _iterator22, _step22, wtx, details;

    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            out = [];

            if (Array.isArray(wtxs)) {
              _context47.next = 5;
              break;
            }

            _context47.next = 4;
            return this._toDetails(wtxs);

          case 4:
            return _context47.abrupt('return', _context47.sent);

          case 5:
            _iteratorNormalCompletion22 = true;
            _didIteratorError22 = false;
            _iteratorError22 = undefined;
            _context47.prev = 8;
            _iterator22 = (0, _getIterator3.default)(wtxs);

          case 10:
            if (_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done) {
              _context47.next = 21;
              break;
            }

            wtx = _step22.value;
            _context47.next = 14;
            return this._toDetails(wtx);

          case 14:
            details = _context47.sent;

            if (details) {
              _context47.next = 17;
              break;
            }

            return _context47.abrupt('continue', 18);

          case 17:

            out.push(details);

          case 18:
            _iteratorNormalCompletion22 = true;
            _context47.next = 10;
            break;

          case 21:
            _context47.next = 27;
            break;

          case 23:
            _context47.prev = 23;
            _context47.t0 = _context47['catch'](8);
            _didIteratorError22 = true;
            _iteratorError22 = _context47.t0;

          case 27:
            _context47.prev = 27;
            _context47.prev = 28;

            if (!_iteratorNormalCompletion22 && _iterator22.return) {
              _iterator22.return();
            }

          case 30:
            _context47.prev = 30;

            if (!_didIteratorError22) {
              _context47.next = 33;
              break;
            }

            throw _iteratorError22;

          case 33:
            return _context47.finish(30);

          case 34:
            return _context47.finish(27);

          case 35:
            return _context47.abrupt('return', out);

          case 36:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this, [[8, 23, 27, 35], [28,, 30, 34]]);
  }));

  function toDetails(_x70) {
    return _ref51.apply(this, arguments);
  }

  return toDetails;
}();

/**
 * Convert transaction to transaction details.
 * @private
 * @param {TXRecord} wtx
 * @returns {Promise}
 */

TXDB.prototype._toDetails = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48(wtx) {
    var tx, block, details, coins, i, coin, path, _i5, output, _path5;

    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            tx = wtx.tx;
            block = wtx.getBlock();
            details = new Details(this, wtx, block);
            _context48.next = 5;
            return this.getSpentCoins(tx);

          case 5:
            coins = _context48.sent;
            i = 0;

          case 7:
            if (!(i < tx.inputs.length)) {
              _context48.next = 18;
              break;
            }

            coin = coins[i];
            path = null;

            if (!coin) {
              _context48.next = 14;
              break;
            }

            _context48.next = 13;
            return this.getPath(coin);

          case 13:
            path = _context48.sent;

          case 14:

            details.setInput(i, path, coin);

          case 15:
            i++;
            _context48.next = 7;
            break;

          case 18:
            _i5 = 0;

          case 19:
            if (!(_i5 < tx.outputs.length)) {
              _context48.next = 28;
              break;
            }

            output = tx.outputs[_i5];
            _context48.next = 23;
            return this.getPath(output);

          case 23:
            _path5 = _context48.sent;

            details.setOutput(_i5, _path5);

          case 25:
            _i5++;
            _context48.next = 19;
            break;

          case 28:
            return _context48.abrupt('return', details);

          case 29:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this);
  }));

  function _toDetails(_x71) {
    return _ref52.apply(this, arguments);
  }

  return _toDetails;
}();

/**
 * Test whether the database has a transaction.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.hasTX = function hasTX(hash) {
  return this.has(layout.t(hash));
};

/**
 * Get coin.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns {@link Coin}.
 */

TXDB.prototype.getCoin = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(hash, index) {
    var credit;
    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            _context49.next = 2;
            return this.getCredit(hash, index);

          case 2:
            credit = _context49.sent;

            if (credit) {
              _context49.next = 5;
              break;
            }

            return _context49.abrupt('return', null);

          case 5:
            return _context49.abrupt('return', credit.coin);

          case 6:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this);
  }));

  function getCoin(_x72, _x73) {
    return _ref53.apply(this, arguments);
  }

  return getCoin;
}();

/**
 * Get coin.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns {@link Coin}.
 */

TXDB.prototype.getCredit = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(hash, index) {
    var state, key, cache, _credit5, data, credit;

    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            state = this.state;
            key = Outpoint.toKey(hash, index);
            cache = this.coinCache.get(key);

            if (!cache) {
              _context50.next = 8;
              break;
            }

            _credit5 = Credit.fromRaw(cache);

            _credit5.coin.hash = hash;
            _credit5.coin.index = index;
            return _context50.abrupt('return', _credit5);

          case 8:
            _context50.next = 10;
            return this.get(layout.c(hash, index));

          case 10:
            data = _context50.sent;

            if (data) {
              _context50.next = 13;
              break;
            }

            return _context50.abrupt('return', null);

          case 13:
            credit = Credit.fromRaw(data);

            credit.coin.hash = hash;
            credit.coin.index = index;

            if (state === this.state) this.coinCache.set(key, data);

            return _context50.abrupt('return', credit);

          case 18:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function getCredit(_x74, _x75) {
    return _ref54.apply(this, arguments);
  }

  return getCredit;
}();

/**
 * Get spender coin.
 * @param {Outpoint} spent
 * @param {Outpoint} prevout
 * @returns {Promise} - Returns {@link Coin}.
 */

TXDB.prototype.getSpentCoin = function () {
  var _ref55 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51(spent, prevout) {
    var data, coin;
    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            _context51.next = 2;
            return this.get(layout.d(spent.hash, spent.index));

          case 2:
            data = _context51.sent;

            if (data) {
              _context51.next = 5;
              break;
            }

            return _context51.abrupt('return', null);

          case 5:
            coin = Coin.fromRaw(data);

            coin.hash = prevout.hash;
            coin.index = prevout.index;

            return _context51.abrupt('return', coin);

          case 9:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this);
  }));

  function getSpentCoin(_x76, _x77) {
    return _ref55.apply(this, arguments);
  }

  return getSpentCoin;
}();

/**
 * Test whether the database has a spent coin.
 * @param {Outpoint} spent
 * @returns {Promise} - Returns {@link Coin}.
 */

TXDB.prototype.hasSpentCoin = function hasSpentCoin(spent) {
  return this.has(layout.d(spent.hash, spent.index));
};

/**
 * Update spent coin height in storage.
 * @param {TX} tx - Sending transaction.
 * @param {Number} index
 * @param {Number} height
 * @returns {Promise}
 */

TXDB.prototype.updateSpentCoin = function () {
  var _ref56 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(tx, index, height) {
    var prevout, spent, coin;
    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            prevout = Outpoint.fromTX(tx, index);
            _context52.next = 3;
            return this.getSpent(prevout.hash, prevout.index);

          case 3:
            spent = _context52.sent;

            if (spent) {
              _context52.next = 6;
              break;
            }

            return _context52.abrupt('return');

          case 6:
            _context52.next = 8;
            return this.getSpentCoin(spent, prevout);

          case 8:
            coin = _context52.sent;

            if (coin) {
              _context52.next = 11;
              break;
            }

            return _context52.abrupt('return');

          case 11:

            coin.height = height;

            this.put(layout.d(spent.hash, spent.index), coin.toRaw());

          case 13:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this);
  }));

  function updateSpentCoin(_x78, _x79, _x80) {
    return _ref56.apply(this, arguments);
  }

  return updateSpentCoin;
}();

/**
 * Test whether the database has a transaction.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

TXDB.prototype.hasCoin = function () {
  var _ref57 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(hash, index) {
    var key;
    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            key = Outpoint.toKey(hash, index);

            if (!this.coinCache.has(key)) {
              _context53.next = 3;
              break;
            }

            return _context53.abrupt('return', true);

          case 3:
            _context53.next = 5;
            return this.has(layout.c(hash, index));

          case 5:
            return _context53.abrupt('return', _context53.sent);

          case 6:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this);
  }));

  function hasCoin(_x81, _x82) {
    return _ref57.apply(this, arguments);
  }

  return hasCoin;
}();

/**
 * Calculate balance.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Balance}.
 */

TXDB.prototype.getBalance = function () {
  var _ref58 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee54(account) {
    return _regenerator2.default.wrap(function _callee54$(_context54) {
      while (1) {
        switch (_context54.prev = _context54.next) {
          case 0:
            if (!(account != null)) {
              _context54.next = 4;
              break;
            }

            _context54.next = 3;
            return this.getAccountBalance(account);

          case 3:
            return _context54.abrupt('return', _context54.sent);

          case 4:
            return _context54.abrupt('return', this.state.toBalance());

          case 5:
          case 'end':
            return _context54.stop();
        }
      }
    }, _callee54, this);
  }));

  function getBalance(_x83) {
    return _ref58.apply(this, arguments);
  }

  return getBalance;
}();

/**
 * Calculate balance.
 * @param {Number?} account
 * @returns {Promise} - Returns {@link Balance}.
 */

TXDB.prototype.getWalletBalance = function () {
  var _ref59 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee55() {
    var credits, balance, _iteratorNormalCompletion23, _didIteratorError23, _iteratorError23, _iterator23, _step23, credit, coin;

    return _regenerator2.default.wrap(function _callee55$(_context55) {
      while (1) {
        switch (_context55.prev = _context55.next) {
          case 0:
            _context55.next = 2;
            return this.getCredits();

          case 2:
            credits = _context55.sent;
            balance = new Balance(this.wallet.wid, this.wallet.id, -1);
            _iteratorNormalCompletion23 = true;
            _didIteratorError23 = false;
            _iteratorError23 = undefined;
            _context55.prev = 7;


            for (_iterator23 = (0, _getIterator3.default)(credits); !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
              credit = _step23.value;
              coin = credit.coin;


              if (coin.height !== -1) balance.confirmed += coin.value;

              if (!credit.spent) balance.unconfirmed += coin.value;
            }

            _context55.next = 15;
            break;

          case 11:
            _context55.prev = 11;
            _context55.t0 = _context55['catch'](7);
            _didIteratorError23 = true;
            _iteratorError23 = _context55.t0;

          case 15:
            _context55.prev = 15;
            _context55.prev = 16;

            if (!_iteratorNormalCompletion23 && _iterator23.return) {
              _iterator23.return();
            }

          case 18:
            _context55.prev = 18;

            if (!_didIteratorError23) {
              _context55.next = 21;
              break;
            }

            throw _iteratorError23;

          case 21:
            return _context55.finish(18);

          case 22:
            return _context55.finish(15);

          case 23:
            return _context55.abrupt('return', balance);

          case 24:
          case 'end':
            return _context55.stop();
        }
      }
    }, _callee55, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getWalletBalance() {
    return _ref59.apply(this, arguments);
  }

  return getWalletBalance;
}();

/**
 * Calculate balance by account.
 * @param {Number} account
 * @returns {Promise} - Returns {@link Balance}.
 */

TXDB.prototype.getAccountBalance = function () {
  var _ref60 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee56(account) {
    var credits, balance, _iteratorNormalCompletion24, _didIteratorError24, _iteratorError24, _iterator24, _step24, credit, coin;

    return _regenerator2.default.wrap(function _callee56$(_context56) {
      while (1) {
        switch (_context56.prev = _context56.next) {
          case 0:
            _context56.next = 2;
            return this.getAccountCredits(account);

          case 2:
            credits = _context56.sent;
            balance = new Balance(this.wallet.wid, this.wallet.id, account);
            _iteratorNormalCompletion24 = true;
            _didIteratorError24 = false;
            _iteratorError24 = undefined;
            _context56.prev = 7;


            for (_iterator24 = (0, _getIterator3.default)(credits); !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
              credit = _step24.value;
              coin = credit.coin;


              if (coin.height !== -1) balance.confirmed += coin.value;

              if (!credit.spent) balance.unconfirmed += coin.value;
            }

            _context56.next = 15;
            break;

          case 11:
            _context56.prev = 11;
            _context56.t0 = _context56['catch'](7);
            _didIteratorError24 = true;
            _iteratorError24 = _context56.t0;

          case 15:
            _context56.prev = 15;
            _context56.prev = 16;

            if (!_iteratorNormalCompletion24 && _iterator24.return) {
              _iterator24.return();
            }

          case 18:
            _context56.prev = 18;

            if (!_didIteratorError24) {
              _context56.next = 21;
              break;
            }

            throw _iteratorError24;

          case 21:
            return _context56.finish(18);

          case 22:
            return _context56.finish(15);

          case 23:
            return _context56.abrupt('return', balance);

          case 24:
          case 'end':
            return _context56.stop();
        }
      }
    }, _callee56, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getAccountBalance(_x84) {
    return _ref60.apply(this, arguments);
  }

  return getAccountBalance;
}();

/**
 * Zap pending transactions older than `age`.
 * @param {Number?} account
 * @param {Number} age - Age delta (delete transactions older than `now - age`).
 * @returns {Promise}
 */

TXDB.prototype.zap = function () {
  var _ref61 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee57(account, age) {
    var now, txs, hashes, _iteratorNormalCompletion25, _didIteratorError25, _iteratorError25, _iterator25, _step25, wtx;

    return _regenerator2.default.wrap(function _callee57$(_context57) {
      while (1) {
        switch (_context57.prev = _context57.next) {
          case 0:
            assert(util.isU32(age));

            now = util.now();
            _context57.next = 4;
            return this.getRange(account, {
              start: 0,
              end: now - age
            });

          case 4:
            txs = _context57.sent;
            hashes = [];
            _iteratorNormalCompletion25 = true;
            _didIteratorError25 = false;
            _iteratorError25 = undefined;
            _context57.prev = 9;
            _iterator25 = (0, _getIterator3.default)(txs);

          case 11:
            if (_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done) {
              _context57.next = 23;
              break;
            }

            wtx = _step25.value;

            if (!(wtx.height !== -1)) {
              _context57.next = 15;
              break;
            }

            return _context57.abrupt('continue', 20);

          case 15:

            assert(now - wtx.mtime >= age);

            this.logger.debug('Zapping TX: %s (%s)', wtx.tx.txid(), this.wallet.id);

            _context57.next = 19;
            return this.remove(wtx.hash);

          case 19:

            hashes.push(wtx.hash);

          case 20:
            _iteratorNormalCompletion25 = true;
            _context57.next = 11;
            break;

          case 23:
            _context57.next = 29;
            break;

          case 25:
            _context57.prev = 25;
            _context57.t0 = _context57['catch'](9);
            _didIteratorError25 = true;
            _iteratorError25 = _context57.t0;

          case 29:
            _context57.prev = 29;
            _context57.prev = 30;

            if (!_iteratorNormalCompletion25 && _iterator25.return) {
              _iterator25.return();
            }

          case 32:
            _context57.prev = 32;

            if (!_didIteratorError25) {
              _context57.next = 35;
              break;
            }

            throw _iteratorError25;

          case 35:
            return _context57.finish(32);

          case 36:
            return _context57.finish(29);

          case 37:
            return _context57.abrupt('return', hashes);

          case 38:
          case 'end':
            return _context57.stop();
        }
      }
    }, _callee57, this, [[9, 25, 29, 37], [30,, 32, 36]]);
  }));

  function zap(_x85, _x86) {
    return _ref61.apply(this, arguments);
  }

  return zap;
}();

/**
 * Abandon transaction.
 * @param {Hash} hash
 * @returns {Promise}
 */

TXDB.prototype.abandon = function () {
  var _ref62 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee58(hash) {
    var result;
    return _regenerator2.default.wrap(function _callee58$(_context58) {
      while (1) {
        switch (_context58.prev = _context58.next) {
          case 0:
            _context58.next = 2;
            return this.has(layout.p(hash));

          case 2:
            result = _context58.sent;

            if (result) {
              _context58.next = 5;
              break;
            }

            throw new Error('TX not eligible.');

          case 5:
            _context58.next = 7;
            return this.remove(hash);

          case 7:
            return _context58.abrupt('return', _context58.sent);

          case 8:
          case 'end':
            return _context58.stop();
        }
      }
    }, _callee58, this);
  }));

  function abandon(_x87) {
    return _ref62.apply(this, arguments);
  }

  return abandon;
}();

/**
 * Balance
 * @alias module:wallet.Balance
 * @constructor
 * @param {WalletID} wid
 * @param {String} id
 * @param {Number} account
 */

function Balance(wid, id, account) {
  if (!(this instanceof Balance)) return new Balance(wid, id, account);

  this.wid = wid;
  this.id = id;
  this.account = account;
  this.unconfirmed = 0;
  this.confirmed = 0;
}

/**
 * Test whether a balance is equal.
 * @param {Balance} balance
 * @returns {Boolean}
 */

Balance.prototype.equal = function equal(balance) {
  return this.wid === balance.wid && this.confirmed === balance.confirmed && this.unconfirmed === balance.unconfirmed;
};

/**
 * Convert balance to a more json-friendly object.
 * @param {Boolean?} minimal
 * @returns {Object}
 */

Balance.prototype.toJSON = function toJSON(minimal) {
  return {
    wid: !minimal ? this.wid : undefined,
    id: !minimal ? this.id : undefined,
    account: !minimal ? this.account : undefined,
    unconfirmed: this.unconfirmed,
    confirmed: this.confirmed
  };
};

/**
 * Convert balance to human-readable string.
 * @returns {String}
 */

Balance.prototype.toString = function toString() {
  return '<Balance' + (' unconfirmed=' + Amount.btc(this.unconfirmed)) + (' confirmed=' + Amount.btc(this.confirmed)) + '>';
};

/**
 * Inspect balance.
 * @param {String}
 */

Balance.prototype.inspect = function inspect() {
  return this.toString();
};

/**
 * Chain State
 * @alias module:wallet.ChainState
 * @constructor
 * @param {WalletID} wid
 * @param {String} id
 */

function TXDBState(wid, id) {
  this.wid = wid;
  this.id = id;
  this.tx = 0;
  this.coin = 0;
  this.unconfirmed = 0;
  this.confirmed = 0;
  this.committed = false;
}

/**
 * Clone the state.
 * @returns {TXDBState}
 */

TXDBState.prototype.clone = function clone() {
  var state = new TXDBState(this.wid, this.id);
  state.tx = this.tx;
  state.coin = this.coin;
  state.unconfirmed = this.unconfirmed;
  state.confirmed = this.confirmed;
  return state;
};

/**
 * Commit and serialize state.
 * @returns {Buffer}
 */

TXDBState.prototype.commit = function commit() {
  this.committed = true;
  return this.toRaw();
};

/**
 * Convert state to a balance object.
 * @returns {Balance}
 */

TXDBState.prototype.toBalance = function toBalance() {
  var balance = new Balance(this.wid, this.id, -1);
  balance.unconfirmed = this.unconfirmed;
  balance.confirmed = this.confirmed;
  return balance;
};

/**
 * Serialize state.
 * @returns {Buffer}
 */

TXDBState.prototype.toRaw = function toRaw() {
  var bw = new StaticWriter(32);

  bw.writeU64(this.tx);
  bw.writeU64(this.coin);
  bw.writeU64(this.unconfirmed);
  bw.writeU64(this.confirmed);

  return bw.render();
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {TXDBState}
 */

TXDBState.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);
  this.tx = br.readU64();
  this.coin = br.readU64();
  this.unconfirmed = br.readU64();
  this.confirmed = br.readU64();
  return this;
};

/**
 * Instantiate txdb state from serialized data.
 * @param {Buffer} data
 * @returns {TXDBState}
 */

TXDBState.fromRaw = function fromRaw(wid, id, data) {
  return new TXDBState(wid, id).fromRaw(data);
};

/**
 * Convert state to a more json-friendly object.
 * @param {Boolean?} minimal
 * @returns {Object}
 */

TXDBState.prototype.toJSON = function toJSON(minimal) {
  return {
    wid: !minimal ? this.wid : undefined,
    id: !minimal ? this.id : undefined,
    tx: this.tx,
    coin: this.coin,
    unconfirmed: this.unconfirmed,
    confirmed: this.confirmed
  };
};

/**
 * Inspect the state.
 * @returns {Object}
 */

TXDBState.prototype.inspect = function inspect() {
  return this.toJSON();
};

/**
 * Credit (wrapped coin)
 * @alias module:wallet.Credit
 * @constructor
 * @param {Coin} coin
 * @param {Boolean?} spent
 * @property {Coin} coin
 * @property {Boolean} spent
 */

function Credit(coin, spent) {
  if (!(this instanceof Credit)) return new Credit(coin, spent);

  this.coin = coin || new Coin();
  this.spent = spent || false;
  this.own = false;
}

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 */

Credit.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);
  this.coin.fromReader(br);
  this.spent = br.readU8() === 1;
  this.own = true;

  // Note: soft-fork
  if (br.left() > 0) this.own = br.readU8() === 1;

  return this;
};

/**
 * Instantiate credit from serialized data.
 * @param {Buffer} data
 * @returns {Credit}
 */

Credit.fromRaw = function fromRaw(data) {
  return new Credit().fromRaw(data);
};

/**
 * Get serialization size.
 * @returns {Number}
 */

Credit.prototype.getSize = function getSize() {
  return this.coin.getSize() + 2;
};

/**
 * Serialize credit.
 * @returns {Buffer}
 */

Credit.prototype.toRaw = function toRaw() {
  var size = this.getSize();
  var bw = new StaticWriter(size);
  this.coin.toWriter(bw);
  bw.writeU8(this.spent ? 1 : 0);
  bw.writeU8(this.own ? 1 : 0);
  return bw.render();
};

/**
 * Inject properties from tx object.
 * @private
 * @param {TX} tx
 * @param {Number} index
 * @returns {Credit}
 */

Credit.prototype.fromTX = function fromTX(tx, index, height) {
  this.coin.fromTX(tx, index, height);
  this.spent = false;
  this.own = false;
  return this;
};

/**
 * Instantiate credit from transaction.
 * @param {TX} tx
 * @param {Number} index
 * @returns {Credit}
 */

Credit.fromTX = function fromTX(tx, index, height) {
  return new Credit().fromTX(tx, index, height);
};

/**
 * Transaction Details
 * @alias module:wallet.Details
 * @constructor
 * @param {TXDB} txdb
 * @param {TX} tx
 */

function Details(txdb, wtx, block) {
  if (!(this instanceof Details)) return new Details(txdb, wtx, block);

  this.wallet = txdb.wallet;
  this.network = this.wallet.network;
  this.wid = this.wallet.wid;
  this.id = this.wallet.id;

  this.chainHeight = txdb.walletdb.state.height;

  this.hash = wtx.hash;
  this.tx = wtx.tx;
  this.mtime = wtx.mtime;
  this.size = this.tx.getSize();
  this.vsize = this.tx.getVirtualSize();

  this.block = null;
  this.height = -1;
  this.time = 0;

  if (block) {
    this.block = block.hash;
    this.height = block.height;
    this.time = block.time;
  }

  this.inputs = [];
  this.outputs = [];

  this.init();
}

/**
 * Initialize transaction details.
 * @private
 */

Details.prototype.init = function init() {
  var _iteratorNormalCompletion26 = true;
  var _didIteratorError26 = false;
  var _iteratorError26 = undefined;

  try {
    for (var _iterator26 = (0, _getIterator3.default)(this.tx.inputs), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
      var input = _step26.value;

      var member = new DetailsMember();
      member.address = input.getAddress();
      this.inputs.push(member);
    }
  } catch (err) {
    _didIteratorError26 = true;
    _iteratorError26 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion26 && _iterator26.return) {
        _iterator26.return();
      }
    } finally {
      if (_didIteratorError26) {
        throw _iteratorError26;
      }
    }
  }

  var _iteratorNormalCompletion27 = true;
  var _didIteratorError27 = false;
  var _iteratorError27 = undefined;

  try {
    for (var _iterator27 = (0, _getIterator3.default)(this.tx.outputs), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
      var output = _step27.value;

      var member = new DetailsMember();
      member.value = output.value;
      member.address = output.getAddress();
      this.outputs.push(member);
    }
  } catch (err) {
    _didIteratorError27 = true;
    _iteratorError27 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion27 && _iterator27.return) {
        _iterator27.return();
      }
    } finally {
      if (_didIteratorError27) {
        throw _iteratorError27;
      }
    }
  }
};

/**
 * Add necessary info to input member.
 * @param {Number} i
 * @param {Path} path
 * @param {Coin} coin
 */

Details.prototype.setInput = function setInput(i, path, coin) {
  var member = this.inputs[i];

  if (coin) {
    member.value = coin.value;
    member.address = coin.getAddress();
  }

  if (path) member.path = path;
};

/**
 * Add necessary info to output member.
 * @param {Number} i
 * @param {Path} path
 */

Details.prototype.setOutput = function setOutput(i, path) {
  var member = this.outputs[i];

  if (path) member.path = path;
};

/**
 * Calculate confirmations.
 * @returns {Number}
 */

Details.prototype.getDepth = function getDepth() {
  if (this.height === -1) return 0;

  var depth = this.chainHeight - this.height;

  if (depth < 0) return 0;

  return depth + 1;
};

/**
 * Calculate fee. Only works if wallet
 * owns all inputs. Returns 0 otherwise.
 * @returns {Amount}
 */

Details.prototype.getFee = function getFee() {
  var inputValue = 0;
  var outputValue = 0;

  var _iteratorNormalCompletion28 = true;
  var _didIteratorError28 = false;
  var _iteratorError28 = undefined;

  try {
    for (var _iterator28 = (0, _getIterator3.default)(this.inputs), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
      var input = _step28.value;

      if (!input.path) return 0;

      inputValue += input.value;
    }
  } catch (err) {
    _didIteratorError28 = true;
    _iteratorError28 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion28 && _iterator28.return) {
        _iterator28.return();
      }
    } finally {
      if (_didIteratorError28) {
        throw _iteratorError28;
      }
    }
  }

  var _iteratorNormalCompletion29 = true;
  var _didIteratorError29 = false;
  var _iteratorError29 = undefined;

  try {
    for (var _iterator29 = (0, _getIterator3.default)(this.outputs), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
      var output = _step29.value;

      outputValue += output.value;
    }
  } catch (err) {
    _didIteratorError29 = true;
    _iteratorError29 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion29 && _iterator29.return) {
        _iterator29.return();
      }
    } finally {
      if (_didIteratorError29) {
        throw _iteratorError29;
      }
    }
  }

  return inputValue - outputValue;
};

/**
 * Calculate fee rate. Only works if wallet
 * owns all inputs. Returns 0 otherwise.
 * @param {Amount} fee
 * @returns {Rate}
 */

Details.prototype.getRate = function getRate(fee) {
  return policy.getRate(this.vsize, fee);
};

/**
 * Convert details to a more json-friendly object.
 * @returns {Object}
 */

Details.prototype.toJSON = function toJSON() {
  var _this2 = this;

  var fee = this.getFee();
  var rate = this.getRate(fee);

  // Rate can exceed 53 bits in testing.
  if (!(0, _isSafeInteger2.default)(rate)) rate = 0;

  return {
    wid: this.wid,
    id: this.id,
    hash: util.revHex(this.hash),
    height: this.height,
    block: this.block ? util.revHex(this.block) : null,
    time: this.time,
    mtime: this.mtime,
    date: util.date(this.time || this.mtime),
    size: this.size,
    virtualSize: this.vsize,
    fee: fee,
    rate: rate,
    confirmations: this.getDepth(),
    inputs: this.inputs.map(function (input) {
      return input.getJSON(_this2.network);
    }),
    outputs: this.outputs.map(function (output) {
      return output.getJSON(_this2.network);
    }),
    tx: this.tx.toRaw().toString('hex')
  };
};

/**
 * Transaction Details Member
 * @alias module:wallet.DetailsMember
 * @constructor
 * @property {Number} value
 * @property {Address} address
 * @property {Path} path
 */

function DetailsMember() {
  if (!(this instanceof DetailsMember)) return new DetailsMember();

  this.value = 0;
  this.address = null;
  this.path = null;
}

/**
 * Convert the member to a more json-friendly object.
 * @returns {Object}
 */

DetailsMember.prototype.toJSON = function toJSON() {
  return this.getJSON();
};

/**
 * Convert the member to a more json-friendly object.
 * @param {Network} network
 * @returns {Object}
 */

DetailsMember.prototype.getJSON = function getJSON(network) {
  return {
    value: this.value,
    address: this.address ? this.address.toString(network) : null,
    path: this.path ? this.path.toJSON() : null
  };
};

/**
 * Block Record
 * @alias module:wallet.BlockRecord
 * @constructor
 * @param {Hash} hash
 * @param {Number} height
 * @param {Number} time
 */

function BlockRecord(hash, height, time) {
  if (!(this instanceof BlockRecord)) return new BlockRecord(hash, height, time);

  this.hash = hash || encoding.NULL_HASH;
  this.height = height != null ? height : -1;
  this.time = time || 0;
  this.hashes = [];
  this.index = new _set2.default();
}

/**
 * Add transaction to block record.
 * @param {Hash} hash
 * @returns {Boolean}
 */

BlockRecord.prototype.add = function add(hash) {
  if (this.index.has(hash)) return false;

  this.index.add(hash);
  this.hashes.push(hash);

  return true;
};

/**
 * Remove transaction from block record.
 * @param {Hash} hash
 * @returns {Boolean}
 */

BlockRecord.prototype.remove = function remove(hash) {
  if (!this.index.has(hash)) return false;

  this.index.delete(hash);

  // Fast case
  if (this.hashes[this.hashes.length - 1] === hash) {
    this.hashes.pop();
    return true;
  }

  var index = this.hashes.indexOf(hash);

  assert(index !== -1);

  this.hashes.splice(index, 1);

  return true;
};

/**
 * Instantiate wallet block from serialized tip data.
 * @private
 * @param {Buffer} data
 */

BlockRecord.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);

  this.hash = br.readHash('hex');
  this.height = br.readU32();
  this.time = br.readU32();

  var count = br.readU32();

  for (var i = 0; i < count; i++) {
    var hash = br.readHash('hex');
    this.index.add(hash);
    this.hashes.push(hash);
  }

  return this;
};

/**
 * Instantiate wallet block from serialized data.
 * @param {Buffer} data
 * @returns {BlockRecord}
 */

BlockRecord.fromRaw = function fromRaw(data) {
  return new BlockRecord().fromRaw(data);
};

/**
 * Get serialization size.
 * @returns {Number}
 */

BlockRecord.prototype.getSize = function getSize() {
  return 44 + this.hashes.length * 32;
};

/**
 * Serialize the wallet block as a tip (hash and height).
 * @returns {Buffer}
 */

BlockRecord.prototype.toRaw = function toRaw() {
  var size = this.getSize();
  var bw = new StaticWriter(size);

  bw.writeHash(this.hash);
  bw.writeU32(this.height);
  bw.writeU32(this.time);

  bw.writeU32(this.hashes.length);

  var _iteratorNormalCompletion30 = true;
  var _didIteratorError30 = false;
  var _iteratorError30 = undefined;

  try {
    for (var _iterator30 = (0, _getIterator3.default)(this.hashes), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
      var hash = _step30.value;

      bw.writeHash(hash);
    }
  } catch (err) {
    _didIteratorError30 = true;
    _iteratorError30 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion30 && _iterator30.return) {
        _iterator30.return();
      }
    } finally {
      if (_didIteratorError30) {
        throw _iteratorError30;
      }
    }
  }

  return bw.render();
};

/**
 * Convert the block to a more json-friendly object.
 * @returns {Object}
 */

BlockRecord.prototype.toJSON = function toJSON() {
  return {
    hash: util.revHex(this.hash),
    height: this.height,
    time: this.time,
    hashes: this.hashes.map(util.revHex)
  };
};

/**
 * Instantiate wallet block from block meta.
 * @private
 * @param {BlockMeta} block
 */

BlockRecord.prototype.fromMeta = function fromMeta(block) {
  this.hash = block.hash;
  this.height = block.height;
  this.time = block.time;
  return this;
};

/**
 * Instantiate wallet block from block meta.
 * @param {BlockMeta} block
 * @returns {BlockRecord}
 */

BlockRecord.fromMeta = function fromMeta(block) {
  return new BlockRecord().fromMeta(block);
};

/*
 * Expose
 */

module.exports = TXDB;