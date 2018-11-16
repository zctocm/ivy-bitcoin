/*!
 * mempool.js - mempool for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var path = require('path');
var AsyncObject = require('../utils/asyncobject');
var common = require('../blockchain/common');
var consensus = require('../protocol/consensus');
var policy = require('../protocol/policy');
var util = require('../utils/util');
var random = require('../crypto/random');

var _require = require('../protocol/errors'),
    VerifyError = _require.VerifyError;

var RollingFilter = require('../utils/rollingfilter');
var Address = require('../primitives/address');
var Script = require('../script/script');
var Outpoint = require('../primitives/outpoint');
var TX = require('../primitives/tx');
var Coin = require('../primitives/coin');
var TXMeta = require('../primitives/txmeta');
var MempoolEntry = require('./mempoolentry');
var Network = require('../protocol/network');
var encoding = require('../utils/encoding');
var layout = require('./layout');
var LDB = require('../db/ldb');
var Fees = require('./fees');
var CoinView = require('../coins/coinview');
var Heap = require('../utils/heap');

/**
 * Represents a mempool.
 * @alias module:mempool.Mempool
 * @constructor
 * @param {Object} options
 * @param {String?} options.name - Database name.
 * @param {String?} options.location - Database file location.
 * @param {String?} options.db - Database backend (`"memory"` by default).
 * @param {Boolean?} options.limitFree
 * @param {Number?} options.limitFreeRelay
 * @param {Number?} options.maxSize - Max pool size (default ~300mb).
 * @param {Boolean?} options.relayPriority
 * @param {Boolean?} options.requireStandard
 * @param {Boolean?} options.rejectAbsurdFees
 * @param {Boolean?} options.relay
 * @property {Boolean} loaded
 * @property {Object} db
 * @property {Number} size
 * @property {Lock} locker
 * @property {Number} freeCount
 * @property {Number} lastTime
 * @property {Number} maxSize
 * @property {Rate} minRelayFee
 * @emits Mempool#open
 * @emits Mempool#error
 * @emits Mempool#tx
 * @emits Mempool#add tx
 * @emits Mempool#remove tx
 */

function Mempool(options) {
  if (!(this instanceof Mempool)) return new Mempool(options);

  AsyncObject.call(this);

  this.options = new MempoolOptions(options);

  this.network = this.options.network;
  this.logger = this.options.logger.context('mempool');
  this.workers = this.options.workers;
  this.chain = this.options.chain;
  this.fees = this.options.fees;

  this.locker = this.chain.locker;

  this.cache = new MempoolCache(this.options);

  this.size = 0;
  this.freeCount = 0;
  this.lastTime = 0;
  this.lastFlush = 0;
  this.tip = this.network.genesis.hash;

  this.waiting = new _map2.default();
  this.orphans = new _map2.default();
  this.map = new _map2.default();
  this.spents = new _map2.default();
  this.rejects = new RollingFilter(120000, 0.000001);

  this.coinIndex = new CoinIndex();
  this.txIndex = new TXIndex();
}

(0, _setPrototypeOf2.default)(Mempool.prototype, AsyncObject.prototype);

/**
 * Open the chain, wait for the database to load.
 * @method
 * @alias Mempool#open
 * @returns {Promise}
 */

Mempool.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var entries, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, entry, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _entry, view, fees, size;

    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.chain.open();

          case 2:
            _context.next = 4;
            return this.cache.open();

          case 4:
            if (!this.options.persistent) {
              _context.next = 63;
              break;
            }

            _context.next = 7;
            return this.cache.getEntries();

          case 7:
            entries = _context.sent;
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 11;


            for (_iterator = (0, _getIterator3.default)(entries); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              entry = _step.value;

              this.trackEntry(entry);
            }_context.next = 19;
            break;

          case 15:
            _context.prev = 15;
            _context.t0 = _context['catch'](11);
            _didIteratorError = true;
            _iteratorError = _context.t0;

          case 19:
            _context.prev = 19;
            _context.prev = 20;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 22:
            _context.prev = 22;

            if (!_didIteratorError) {
              _context.next = 25;
              break;
            }

            throw _iteratorError;

          case 25:
            return _context.finish(22);

          case 26:
            return _context.finish(19);

          case 27:
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context.prev = 30;
            _iterator2 = (0, _getIterator3.default)(entries);

          case 32:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context.next = 43;
              break;
            }

            _entry = _step2.value;

            this.updateAncestors(_entry, addFee);

            if (!this.options.indexAddress) {
              _context.next = 40;
              break;
            }

            _context.next = 38;
            return this.getCoinView(_entry.tx);

          case 38:
            view = _context.sent;

            this.indexEntry(_entry, view);

          case 40:
            _iteratorNormalCompletion2 = true;
            _context.next = 32;
            break;

          case 43:
            _context.next = 49;
            break;

          case 45:
            _context.prev = 45;
            _context.t1 = _context['catch'](30);
            _didIteratorError2 = true;
            _iteratorError2 = _context.t1;

          case 49:
            _context.prev = 49;
            _context.prev = 50;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 52:
            _context.prev = 52;

            if (!_didIteratorError2) {
              _context.next = 55;
              break;
            }

            throw _iteratorError2;

          case 55:
            return _context.finish(52);

          case 56:
            return _context.finish(49);

          case 57:

            this.logger.info('Loaded mempool from disk (%d entries).', entries.length);

            if (!this.fees) {
              _context.next = 63;
              break;
            }

            _context.next = 61;
            return this.cache.getFees();

          case 61:
            fees = _context.sent;


            if (fees) {
              this.fees.inject(fees);
              this.logger.info('Loaded mempool fee data (rate=%d).', this.fees.estimateFee());
            }

          case 63:

            this.tip = this.chain.tip.hash;

            size = (this.options.maxSize / 1024).toFixed(2);


            this.logger.info('Mempool loaded (maxsize=%dkb).', size);

          case 66:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[11, 15, 19, 27], [20,, 22, 26], [30, 45, 49, 57], [50,, 52, 56]]);
  }));

  function _open() {
    return _ref.apply(this, arguments);
  }

  return _open;
}();

/**
 * Close the chain, wait for the database to close.
 * @alias Mempool#close
 * @returns {Promise}
 */

Mempool.prototype._close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.cache.close();

          case 2:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function _close() {
    return _ref2.apply(this, arguments);
  }

  return _close;
}();

/**
 * Notify the mempool that a new block has come
 * in (removes all transactions contained in the
 * block from the mempool).
 * @method
 * @param {ChainEntry} block
 * @param {TX[]} txs
 * @returns {Promise}
 */

Mempool.prototype.addBlock = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(block, txs) {
    var unlock;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context3.sent;
            _context3.prev = 3;
            _context3.next = 6;
            return this._addBlock(block, txs);

          case 6:
            return _context3.abrupt('return', _context3.sent);

          case 7:
            _context3.prev = 7;

            unlock();
            return _context3.finish(7);

          case 10:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[3,, 7, 10]]);
  }));

  function addBlock(_x, _x2) {
    return _ref3.apply(this, arguments);
  }

  return addBlock;
}();

/**
 * Notify the mempool that a new block
 * has come without a lock.
 * @private
 * @param {ChainEntry} block
 * @param {TX[]} txs
 * @returns {Promise}
 */

Mempool.prototype._addBlock = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(block, txs) {
    var entries, i, tx, hash, entry;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            if (!(this.map.size === 0)) {
              _context4.next = 3;
              break;
            }

            this.tip = block.hash;
            return _context4.abrupt('return');

          case 3:
            entries = [];
            i = txs.length - 1;

          case 5:
            if (!(i >= 1)) {
              _context4.next = 22;
              break;
            }

            tx = txs[i];
            hash = tx.hash('hex');
            entry = this.getEntry(hash);

            if (entry) {
              _context4.next = 16;
              break;
            }

            this.removeOrphan(hash);
            this.removeDoubleSpends(tx);

            if (!this.waiting.has(hash)) {
              _context4.next = 15;
              break;
            }

            _context4.next = 15;
            return this.handleOrphans(tx);

          case 15:
            return _context4.abrupt('continue', 19);

          case 16:

            this.removeEntry(entry);

            this.emit('confirmed', tx, block);

            entries.push(entry);

          case 19:
            i--;
            _context4.next = 5;
            break;

          case 22:

            // We need to reset the rejects filter periodically.
            // There may be a locktime in a TX that is now valid.
            this.rejects.reset();

            if (this.fees) {
              this.fees.processBlock(block.height, entries, this.chain.synced);
              this.cache.writeFees(this.fees);
            }

            this.cache.sync(block.hash);

            _context4.next = 27;
            return this.cache.flush();

          case 27:

            this.tip = block.hash;

            if (!(entries.length === 0)) {
              _context4.next = 30;
              break;
            }

            return _context4.abrupt('return');

          case 30:

            this.logger.debug('Removed %d txs from mempool for block %d.', entries.length, block.height);

          case 31:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function _addBlock(_x3, _x4) {
    return _ref4.apply(this, arguments);
  }

  return _addBlock;
}();

/**
 * Notify the mempool that a block has been disconnected
 * from the main chain (reinserts transactions into the mempool).
 * @method
 * @param {ChainEntry} block
 * @param {TX[]} txs
 * @returns {Promise}
 */

Mempool.prototype.removeBlock = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(block, txs) {
    var unlock;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context5.sent;
            _context5.prev = 3;
            _context5.next = 6;
            return this._removeBlock(block, txs);

          case 6:
            return _context5.abrupt('return', _context5.sent);

          case 7:
            _context5.prev = 7;

            unlock();
            return _context5.finish(7);

          case 10:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[3,, 7, 10]]);
  }));

  function removeBlock(_x5, _x6) {
    return _ref5.apply(this, arguments);
  }

  return removeBlock;
}();

/**
 * Notify the mempool that a block
 * has been disconnected without a lock.
 * @method
 * @private
 * @param {ChainEntry} block
 * @param {TX[]} txs
 * @returns {Promise}
 */

Mempool.prototype._removeBlock = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(block, txs) {
    var total, i, tx, hash;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            if (!(this.map.size === 0)) {
              _context6.next = 3;
              break;
            }

            this.tip = block.prevBlock;
            return _context6.abrupt('return');

          case 3:
            total = 0;
            i = 1;

          case 5:
            if (!(i < txs.length)) {
              _context6.next = 24;
              break;
            }

            tx = txs[i];
            hash = tx.hash('hex');

            if (!this.hasEntry(hash)) {
              _context6.next = 10;
              break;
            }

            return _context6.abrupt('continue', 21);

          case 10:
            _context6.prev = 10;
            _context6.next = 13;
            return this.insertTX(tx, -1);

          case 13:
            total++;
            _context6.next = 20;
            break;

          case 16:
            _context6.prev = 16;
            _context6.t0 = _context6['catch'](10);

            this.emit('error', _context6.t0);
            return _context6.abrupt('continue', 21);

          case 20:

            this.emit('unconfirmed', tx, block);

          case 21:
            i++;
            _context6.next = 5;
            break;

          case 24:

            this.rejects.reset();

            this.cache.sync(block.prevBlock);

            _context6.next = 28;
            return this.cache.flush();

          case 28:

            this.tip = block.prevBlock;

            if (!(total === 0)) {
              _context6.next = 31;
              break;
            }

            return _context6.abrupt('return');

          case 31:

            this.logger.debug('Added %d txs back into the mempool for block %d.', total, block.height);

          case 32:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[10, 16]]);
  }));

  function _removeBlock(_x7, _x8) {
    return _ref6.apply(this, arguments);
  }

  return _removeBlock;
}();

/**
 * Sanitize the mempool after a reorg.
 * @private
 * @returns {Promise}
 */

Mempool.prototype._handleReorg = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
    var height, mtp, remove, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _ref8, _ref9, hash, entry, tx, hasLocks, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _ref10, sequence, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _hash, _entry2;

    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            height = this.chain.height + 1;
            _context7.next = 3;
            return this.chain.getMedianTime(this.chain.tip);

          case 3:
            mtp = _context7.sent;
            remove = [];
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context7.prev = 8;
            _iterator3 = (0, _getIterator3.default)(this.map);

          case 10:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context7.next = 56;
              break;
            }

            _ref8 = _step3.value;
            _ref9 = (0, _slicedToArray3.default)(_ref8, 2);
            hash = _ref9[0];
            entry = _ref9[1];
            tx = entry.tx;

            if (tx.isFinal(height, mtp)) {
              _context7.next = 19;
              break;
            }

            remove.push(hash);
            return _context7.abrupt('continue', 53);

          case 19:
            if (!(tx.version > 1)) {
              _context7.next = 52;
              break;
            }

            hasLocks = false;
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context7.prev = 24;
            _iterator5 = (0, _getIterator3.default)(tx.inputs);

          case 26:
            if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
              _context7.next = 35;
              break;
            }

            _ref10 = _step5.value;
            sequence = _ref10.sequence;

            if (sequence & consensus.SEQUENCE_DISABLE_FLAG) {
              _context7.next = 32;
              break;
            }

            hasLocks = true;
            return _context7.abrupt('break', 35);

          case 32:
            _iteratorNormalCompletion5 = true;
            _context7.next = 26;
            break;

          case 35:
            _context7.next = 41;
            break;

          case 37:
            _context7.prev = 37;
            _context7.t0 = _context7['catch'](24);
            _didIteratorError5 = true;
            _iteratorError5 = _context7.t0;

          case 41:
            _context7.prev = 41;
            _context7.prev = 42;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 44:
            _context7.prev = 44;

            if (!_didIteratorError5) {
              _context7.next = 47;
              break;
            }

            throw _iteratorError5;

          case 47:
            return _context7.finish(44);

          case 48:
            return _context7.finish(41);

          case 49:
            if (!hasLocks) {
              _context7.next = 52;
              break;
            }

            remove.push(hash);
            return _context7.abrupt('continue', 53);

          case 52:

            if (entry.coinbase) remove.push(hash);

          case 53:
            _iteratorNormalCompletion3 = true;
            _context7.next = 10;
            break;

          case 56:
            _context7.next = 62;
            break;

          case 58:
            _context7.prev = 58;
            _context7.t1 = _context7['catch'](8);
            _didIteratorError3 = true;
            _iteratorError3 = _context7.t1;

          case 62:
            _context7.prev = 62;
            _context7.prev = 63;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 65:
            _context7.prev = 65;

            if (!_didIteratorError3) {
              _context7.next = 68;
              break;
            }

            throw _iteratorError3;

          case 68:
            return _context7.finish(65);

          case 69:
            return _context7.finish(62);

          case 70:
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context7.prev = 73;
            _iterator4 = (0, _getIterator3.default)(remove);

          case 75:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context7.next = 84;
              break;
            }

            _hash = _step4.value;
            _entry2 = this.getEntry(_hash);

            if (_entry2) {
              _context7.next = 80;
              break;
            }

            return _context7.abrupt('continue', 81);

          case 80:

            this.evictEntry(_entry2);

          case 81:
            _iteratorNormalCompletion4 = true;
            _context7.next = 75;
            break;

          case 84:
            _context7.next = 90;
            break;

          case 86:
            _context7.prev = 86;
            _context7.t2 = _context7['catch'](73);
            _didIteratorError4 = true;
            _iteratorError4 = _context7.t2;

          case 90:
            _context7.prev = 90;
            _context7.prev = 91;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 93:
            _context7.prev = 93;

            if (!_didIteratorError4) {
              _context7.next = 96;
              break;
            }

            throw _iteratorError4;

          case 96:
            return _context7.finish(93);

          case 97:
            return _context7.finish(90);

          case 98:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this, [[8, 58, 62, 70], [24, 37, 41, 49], [42,, 44, 48], [63,, 65, 69], [73, 86, 90, 98], [91,, 93, 97]]);
  }));

  function _handleReorg() {
    return _ref7.apply(this, arguments);
  }

  return _handleReorg;
}();

/**
 * Reset the mempool.
 * @method
 * @returns {Promise}
 */

Mempool.prototype.reset = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8() {
    var unlock;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _context8.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context8.sent;
            _context8.prev = 3;
            _context8.next = 6;
            return this._reset();

          case 6:
            return _context8.abrupt('return', _context8.sent);

          case 7:
            _context8.prev = 7;

            unlock();
            return _context8.finish(7);

          case 10:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this, [[3,, 7, 10]]);
  }));

  function reset() {
    return _ref11.apply(this, arguments);
  }

  return reset;
}();

/**
 * Reset the mempool without a lock.
 * @private
 */

Mempool.prototype._reset = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9() {
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            this.logger.info('Mempool reset (%d txs removed).', this.map.size);

            this.size = 0;

            this.waiting.clear();
            this.orphans.clear();
            this.map.clear();
            this.spents.clear();
            this.coinIndex.reset();
            this.txIndex.reset();

            this.freeCount = 0;
            this.lastTime = 0;

            if (this.fees) this.fees.reset();

            this.rejects.reset();

            if (!this.options.persistent) {
              _context9.next = 16;
              break;
            }

            _context9.next = 15;
            return this.cache.wipe();

          case 15:
            this.cache.clear();

          case 16:

            this.tip = this.chain.tip.hash;

          case 17:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function _reset() {
    return _ref12.apply(this, arguments);
  }

  return _reset;
}();

/**
 * Ensure the size of the mempool stays below `maxSize`.
 * Evicts entries by timestamp and cumulative fee rate.
 * @param {MempoolEntry} added
 * @returns {Promise}
 */

Mempool.prototype.limitSize = function limitSize(added) {
  var maxSize = this.options.maxSize;

  if (this.size <= maxSize) return false;

  var threshold = maxSize - maxSize / 10;
  var expiryTime = this.options.expiryTime;

  var now = util.now();
  var start = util.hrtime();
  var queue = new Heap(cmpRate);

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(this.map.values()), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var entry = _step6.value;

      if (this.hasDepends(entry.tx)) continue;

      if (now < entry.time + expiryTime) {
        queue.insert(entry);
        continue;
      }

      this.logger.debug('Removing package %s from mempool (too old).', entry.txid());

      this.evictEntry(entry);
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

  if (this.size <= threshold) return !this.hasEntry(added);

  this.logger.debug('(bench) Heap mempool traversal: %d.', util.hrtime(start));

  start = util.hrtime();

  this.logger.debug('(bench) Heap mempool queue size: %d.', queue.size());

  while (queue.size() > 0) {
    var _entry3 = queue.shift();
    var hash = _entry3.hash('hex');

    assert(this.hasEntry(hash));

    this.logger.debug('Removing package %s from mempool (low fee).', _entry3.txid());

    this.evictEntry(_entry3);

    if (this.size <= threshold) break;
  }

  this.logger.debug('(bench) Heap mempool map removal: %d.', util.hrtime(start));

  return !this.hasEntry(added);
};

/**
 * Retrieve a transaction from the mempool.
 * @param {Hash} hash
 * @returns {TX}
 */

Mempool.prototype.getTX = function getTX(hash) {
  var entry = this.map.get(hash);

  if (!entry) return null;

  return entry.tx;
};

/**
 * Retrieve a transaction from the mempool.
 * @param {Hash} hash
 * @returns {MempoolEntry}
 */

Mempool.prototype.getEntry = function getEntry(hash) {
  return this.map.get(hash);
};

/**
 * Retrieve a coin from the mempool (unspents only).
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Coin}
 */

Mempool.prototype.getCoin = function getCoin(hash, index) {
  var entry = this.map.get(hash);

  if (!entry) return null;

  if (this.isSpent(hash, index)) return null;

  if (index >= entry.tx.outputs.length) return null;

  return Coin.fromTX(entry.tx, index, -1);
};

/**
 * Check to see if a coin has been spent. This differs from
 * {@link ChainDB#isSpent} in that it actually maintains a
 * map of spent coins, whereas ChainDB may return `true`
 * for transaction outputs that never existed.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Boolean}
 */

Mempool.prototype.isSpent = function isSpent(hash, index) {
  var key = Outpoint.toKey(hash, index);
  return this.spents.has(key);
};

/**
 * Get an output's spender entry.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {MempoolEntry}
 */

Mempool.prototype.getSpent = function getSpent(hash, index) {
  var key = Outpoint.toKey(hash, index);
  return this.spents.get(key);
};

/**
 * Get an output's spender transaction.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {MempoolEntry}
 */

Mempool.prototype.getSpentTX = function getSpentTX(hash, index) {
  var key = Outpoint.toKey(hash, index);
  var entry = this.spents.get(key);

  if (!entry) return null;

  return entry.tx;
};

/**
 * Find all coins pertaining to a certain address.
 * @param {Address[]} addrs
 * @returns {Coin[]}
 */

Mempool.prototype.getCoinsByAddress = function getCoinsByAddress(addrs) {
  if (!Array.isArray(addrs)) addrs = [addrs];

  var out = [];

  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(addrs), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var addr = _step7.value;

      var hash = Address.getHash(addr, 'hex');
      var coins = this.coinIndex.get(hash);

      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = (0, _getIterator3.default)(coins), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var coin = _step8.value;

          out.push(coin);
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

  return out;
};

/**
 * Find all transactions pertaining to a certain address.
 * @param {Address[]} addrs
 * @returns {TX[]}
 */

Mempool.prototype.getTXByAddress = function getTXByAddress(addrs) {
  if (!Array.isArray(addrs)) addrs = [addrs];

  var out = [];

  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = (0, _getIterator3.default)(addrs), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var addr = _step9.value;

      var hash = Address.getHash(addr, 'hex');
      var txs = this.txIndex.get(hash);

      var _iteratorNormalCompletion10 = true;
      var _didIteratorError10 = false;
      var _iteratorError10 = undefined;

      try {
        for (var _iterator10 = (0, _getIterator3.default)(txs), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
          var tx = _step10.value;

          out.push(tx);
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

  return out;
};

/**
 * Find all transactions pertaining to a certain address.
 * @param {Address[]} addrs
 * @returns {TXMeta[]}
 */

Mempool.prototype.getMetaByAddress = function getMetaByAddress(addrs) {
  if (!Array.isArray(addrs)) addrs = [addrs];

  var out = [];

  var _iteratorNormalCompletion11 = true;
  var _didIteratorError11 = false;
  var _iteratorError11 = undefined;

  try {
    for (var _iterator11 = (0, _getIterator3.default)(addrs), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
      var addr = _step11.value;

      var hash = Address.getHash(addr, 'hex');
      var txs = this.txIndex.getMeta(hash);

      var _iteratorNormalCompletion12 = true;
      var _didIteratorError12 = false;
      var _iteratorError12 = undefined;

      try {
        for (var _iterator12 = (0, _getIterator3.default)(txs), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
          var tx = _step12.value;

          out.push(tx);
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
 * Retrieve a transaction from the mempool.
 * @param {Hash} hash
 * @returns {TXMeta}
 */

Mempool.prototype.getMeta = function getMeta(hash) {
  var entry = this.getEntry(hash);

  if (!entry) return null;

  var meta = TXMeta.fromTX(entry.tx);
  meta.mtime = entry.time;

  return meta;
};

/**
 * Test the mempool to see if it contains a transaction.
 * @param {Hash} hash
 * @returns {Boolean}
 */

Mempool.prototype.hasEntry = function hasEntry(hash) {
  return this.map.has(hash);
};

/**
 * Test the mempool to see if it
 * contains a transaction or an orphan.
 * @param {Hash} hash
 * @returns {Boolean}
 */

Mempool.prototype.has = function has(hash) {
  if (this.locker.has(hash)) return true;

  if (this.hasOrphan(hash)) return true;

  return this.hasEntry(hash);
};

/**
 * Test the mempool to see if it
 * contains a transaction or an orphan.
 * @private
 * @param {Hash} hash
 * @returns {Boolean}
 */

Mempool.prototype.exists = function exists(hash) {
  if (this.locker.hasPending(hash)) return true;

  if (this.hasOrphan(hash)) return true;

  return this.hasEntry(hash);
};

/**
 * Test the mempool to see if it
 * contains a recent reject.
 * @param {Hash} hash
 * @returns {Boolean}
 */

Mempool.prototype.hasReject = function hasReject(hash) {
  return this.rejects.test(hash, 'hex');
};

/**
 * Add a transaction to the mempool. Note that this
 * will lock the mempool until the transaction is
 * fully processed.
 * @method
 * @param {TX} tx
 * @param {Number?} id
 * @returns {Promise}
 */

Mempool.prototype.addTX = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(tx, id) {
    var hash, unlock;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            hash = tx.hash('hex');
            _context10.next = 3;
            return this.locker.lock(hash);

          case 3:
            unlock = _context10.sent;
            _context10.prev = 4;
            _context10.next = 7;
            return this._addTX(tx, id);

          case 7:
            return _context10.abrupt('return', _context10.sent);

          case 8:
            _context10.prev = 8;

            unlock();
            return _context10.finish(8);

          case 11:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this, [[4,, 8, 11]]);
  }));

  function addTX(_x9, _x10) {
    return _ref13.apply(this, arguments);
  }

  return addTX;
}();

/**
 * Add a transaction to the mempool without a lock.
 * @method
 * @private
 * @param {TX} tx
 * @param {Number?} id
 * @returns {Promise}
 */

Mempool.prototype._addTX = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(tx, id) {
    var missing;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            if (id == null) id = -1;

            missing = void 0;
            _context11.prev = 2;
            _context11.next = 5;
            return this.insertTX(tx, id);

          case 5:
            missing = _context11.sent;
            _context11.next = 12;
            break;

          case 8:
            _context11.prev = 8;
            _context11.t0 = _context11['catch'](2);

            if (_context11.t0.type === 'VerifyError') {
              if (!tx.hasWitness() && !_context11.t0.malleated) this.rejects.add(tx.hash());
            }
            throw _context11.t0;

          case 12:
            if (!(util.now() - this.lastFlush > 10)) {
              _context11.next = 16;
              break;
            }

            _context11.next = 15;
            return this.cache.flush();

          case 15:
            this.lastFlush = util.now();

          case 16:
            return _context11.abrupt('return', missing);

          case 17:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this, [[2, 8]]);
  }));

  function _addTX(_x11, _x12) {
    return _ref14.apply(this, arguments);
  }

  return _addTX;
}();

/**
 * Add a transaction to the mempool without a lock.
 * @method
 * @private
 * @param {TX} tx
 * @param {Number?} id
 * @returns {Promise}
 */

Mempool.prototype.insertTX = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(tx, id) {
    var lockFlags, height, hash, _tx$checkSanity, _tx$checkSanity2, valid, reason, score, _tx$checkStandard, _tx$checkStandard2, _valid, _reason, _score, view, missing, entry;

    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            assert(!tx.mutable, 'Cannot add mutable TX to mempool.');

            lockFlags = common.lockFlags.STANDARD_LOCKTIME_FLAGS;
            height = this.chain.height;
            hash = tx.hash('hex');

            // Basic sanity checks.
            // This is important because it ensures
            // other functions will be overflow safe.

            _tx$checkSanity = tx.checkSanity(), _tx$checkSanity2 = (0, _slicedToArray3.default)(_tx$checkSanity, 3), valid = _tx$checkSanity2[0], reason = _tx$checkSanity2[1], score = _tx$checkSanity2[2];

            if (valid) {
              _context12.next = 7;
              break;
            }

            throw new VerifyError(tx, 'invalid', reason, score);

          case 7:
            if (!tx.isCoinbase()) {
              _context12.next = 9;
              break;
            }

            throw new VerifyError(tx, 'invalid', 'coinbase', 100);

          case 9:
            if (!this.options.requireStandard) {
              _context12.next = 12;
              break;
            }

            if (!(!this.chain.state.hasCSV() && tx.version >= 2)) {
              _context12.next = 12;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'premature-version2-tx', 0);

          case 12:
            if (!(!this.chain.state.hasWitness() && !this.options.prematureWitness)) {
              _context12.next = 15;
              break;
            }

            if (!tx.hasWitness()) {
              _context12.next = 15;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'no-witness-yet', 0, true);

          case 15:
            if (!this.options.requireStandard) {
              _context12.next = 22;
              break;
            }

            _tx$checkStandard = tx.checkStandard(), _tx$checkStandard2 = (0, _slicedToArray3.default)(_tx$checkStandard, 3), _valid = _tx$checkStandard2[0], _reason = _tx$checkStandard2[1], _score = _tx$checkStandard2[2];

            if (_valid) {
              _context12.next = 19;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', _reason, _score);

          case 19:
            if (this.options.replaceByFee) {
              _context12.next = 22;
              break;
            }

            if (!tx.isRBF()) {
              _context12.next = 22;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'replace-by-fee', 0);

          case 22:
            _context12.next = 24;
            return this.verifyFinal(tx, lockFlags);

          case 24:
            if (_context12.sent) {
              _context12.next = 26;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'non-final', 0);

          case 26:
            if (!this.exists(hash)) {
              _context12.next = 28;
              break;
            }

            throw new VerifyError(tx, 'alreadyknown', 'txn-already-in-mempool', 0);

          case 28:
            _context12.next = 30;
            return this.chain.hasCoins(tx);

          case 30:
            if (!_context12.sent) {
              _context12.next = 32;
              break;
            }

            throw new VerifyError(tx, 'alreadyknown', 'txn-already-known', 0);

          case 32:
            if (!this.isDoubleSpend(tx)) {
              _context12.next = 35;
              break;
            }

            this.emit('conflict', tx);
            throw new VerifyError(tx, 'duplicate', 'bad-txns-inputs-spent', 0);

          case 35:
            _context12.next = 37;
            return this.getCoinView(tx);

          case 37:
            view = _context12.sent;


            // Maybe store as an orphan.
            missing = this.maybeOrphan(tx, view, id);

            // Return missing outpoint hashes.

            if (!missing) {
              _context12.next = 41;
              break;
            }

            return _context12.abrupt('return', missing);

          case 41:

            // Create a new mempool entry
            // at current chain height.
            entry = MempoolEntry.fromTX(tx, view, height);

            // Contextual verification.

            _context12.next = 44;
            return this.verify(entry, view);

          case 44:
            _context12.next = 46;
            return this.addEntry(entry, view);

          case 46:
            if (!this.limitSize(hash)) {
              _context12.next = 48;
              break;
            }

            throw new VerifyError(tx, 'insufficientfee', 'mempool full', 0);

          case 48:
            return _context12.abrupt('return', null);

          case 49:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function insertTX(_x13, _x14) {
    return _ref15.apply(this, arguments);
  }

  return insertTX;
}();

/**
 * Verify a transaction with mempool standards.
 * @method
 * @param {TX} tx
 * @param {CoinView} view
 * @returns {Promise}
 */

Mempool.prototype.verify = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(entry, view) {
    var height, lockFlags, tx, minFee, now, _tx$checkInputs, _tx$checkInputs2, fee, reason, score, flags, _flags;

    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            height = this.chain.height + 1;
            lockFlags = common.lockFlags.STANDARD_LOCKTIME_FLAGS;
            tx = entry.tx;

            // Verify sequence locks.

            _context13.next = 5;
            return this.verifyLocks(tx, view, lockFlags);

          case 5:
            if (_context13.sent) {
              _context13.next = 7;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'non-BIP68-final', 0);

          case 7:
            if (!this.options.requireStandard) {
              _context13.next = 13;
              break;
            }

            if (tx.hasStandardInputs(view)) {
              _context13.next = 10;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'bad-txns-nonstandard-inputs', 0);

          case 10:
            if (!this.chain.state.hasWitness()) {
              _context13.next = 13;
              break;
            }

            if (tx.hasStandardWitness(view)) {
              _context13.next = 13;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'bad-witness-nonstandard', 0, true);

          case 13:
            if (!(entry.sigops > policy.MAX_TX_SIGOPS_COST)) {
              _context13.next = 15;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'bad-txns-too-many-sigops', 0);

          case 15:

            // Make sure this guy gave a decent fee.
            minFee = policy.getMinFee(entry.size, this.options.minRelay);

            if (!(this.options.relayPriority && entry.fee < minFee)) {
              _context13.next = 19;
              break;
            }

            if (entry.isFree(height)) {
              _context13.next = 19;
              break;
            }

            throw new VerifyError(tx, 'insufficientfee', 'insufficient priority', 0);

          case 19:
            if (!(this.options.limitFree && entry.fee < minFee)) {
              _context13.next = 26;
              break;
            }

            now = util.now();

            // Use an exponentially decaying ~10-minute window.

            this.freeCount *= Math.pow(1 - 1 / 600, now - this.lastTime);
            this.lastTime = now;

            // The limitFreeRelay unit is thousand-bytes-per-minute
            // At default rate it would take over a month to fill 1GB.

            if (!(this.freeCount > this.options.limitFreeRelay * 10 * 1000)) {
              _context13.next = 25;
              break;
            }

            throw new VerifyError(tx, 'insufficientfee', 'rate limited free transaction', 0);

          case 25:

            this.freeCount += entry.size;

          case 26:
            if (!(this.options.rejectAbsurdFees && entry.fee > minFee * 10000)) {
              _context13.next = 28;
              break;
            }

            throw new VerifyError(tx, 'highfee', 'absurdly-high-fee', 0);

          case 28:
            if (!(this.countAncestors(entry) + 1 > this.options.maxAncestors)) {
              _context13.next = 30;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'too-long-mempool-chain', 0);

          case 30:

            // Contextual sanity checks.
            _tx$checkInputs = tx.checkInputs(view, height), _tx$checkInputs2 = (0, _slicedToArray3.default)(_tx$checkInputs, 3), fee = _tx$checkInputs2[0], reason = _tx$checkInputs2[1], score = _tx$checkInputs2[2];

            if (!(fee === -1)) {
              _context13.next = 33;
              break;
            }

            throw new VerifyError(tx, 'invalid', reason, score);

          case 33:

            // Script verification.
            flags = Script.flags.STANDARD_VERIFY_FLAGS;
            _context13.prev = 34;
            _context13.next = 37;
            return this.verifyInputs(tx, view, flags);

          case 37:
            _context13.next = 56;
            break;

          case 39:
            _context13.prev = 39;
            _context13.t0 = _context13['catch'](34);

            if (!tx.hasWitness()) {
              _context13.next = 43;
              break;
            }

            throw _context13.t0;

          case 43:

            // Try without segwit and cleanstack.
            flags &= ~Script.flags.VERIFY_WITNESS;
            flags &= ~Script.flags.VERIFY_CLEANSTACK;

            // If it failed, the first verification
            // was the only result we needed.
            _context13.next = 47;
            return this.verifyResult(tx, view, flags);

          case 47:
            if (_context13.sent) {
              _context13.next = 49;
              break;
            }

            throw _context13.t0;

          case 49:

            // If it succeeded, segwit may be causing the
            // failure. Try with segwit but without cleanstack.
            flags |= Script.flags.VERIFY_CLEANSTACK;

            // Cleanstack was causing the failure.
            _context13.next = 52;
            return this.verifyResult(tx, view, flags);

          case 52:
            if (!_context13.sent) {
              _context13.next = 54;
              break;
            }

            throw _context13.t0;

          case 54:

            // Do not insert into reject cache.
            _context13.t0.malleated = true;
            throw _context13.t0;

          case 56:
            if (!this.options.paranoidChecks) {
              _context13.next = 63;
              break;
            }

            _flags = Script.flags.MANDATORY_VERIFY_FLAGS;
            _context13.t1 = assert;
            _context13.next = 61;
            return this.verifyResult(tx, view, _flags);

          case 61:
            _context13.t2 = _context13.sent;
            (0, _context13.t1)(_context13.t2, 'BUG: Verify failed for mandatory but not standard.');

          case 63:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this, [[34, 39]]);
  }));

  function verify(_x15, _x16) {
    return _ref16.apply(this, arguments);
  }

  return verify;
}();

/**
 * Verify inputs, return a boolean
 * instead of an error based on success.
 * @method
 * @param {TX} tx
 * @param {CoinView} view
 * @param {VerifyFlags} flags
 * @returns {Promise}
 */

Mempool.prototype.verifyResult = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(tx, view, flags) {
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            _context14.prev = 0;
            _context14.next = 3;
            return this.verifyInputs(tx, view, flags);

          case 3:
            _context14.next = 10;
            break;

          case 5:
            _context14.prev = 5;
            _context14.t0 = _context14['catch'](0);

            if (!(_context14.t0.type === 'VerifyError')) {
              _context14.next = 9;
              break;
            }

            return _context14.abrupt('return', false);

          case 9:
            throw _context14.t0;

          case 10:
            return _context14.abrupt('return', true);

          case 11:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this, [[0, 5]]);
  }));

  function verifyResult(_x17, _x18, _x19) {
    return _ref17.apply(this, arguments);
  }

  return verifyResult;
}();

/**
 * Verify inputs for standard
 * _and_ mandatory flags on failure.
 * @method
 * @param {TX} tx
 * @param {CoinView} view
 * @param {VerifyFlags} flags
 * @returns {Promise}
 */

Mempool.prototype.verifyInputs = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(tx, view, flags) {
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            _context15.next = 2;
            return tx.verifyAsync(view, flags, this.workers);

          case 2:
            if (!_context15.sent) {
              _context15.next = 4;
              break;
            }

            return _context15.abrupt('return');

          case 4:
            if (!(flags & Script.flags.ONLY_STANDARD_VERIFY_FLAGS)) {
              _context15.next = 10;
              break;
            }

            flags &= ~Script.flags.ONLY_STANDARD_VERIFY_FLAGS;

            _context15.next = 8;
            return tx.verifyAsync(view, flags, this.workers);

          case 8:
            if (!_context15.sent) {
              _context15.next = 10;
              break;
            }

            throw new VerifyError(tx, 'nonstandard', 'non-mandatory-script-verify-flag', 0);

          case 10:
            throw new VerifyError(tx, 'nonstandard', 'mandatory-script-verify-flag', 100);

          case 11:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this);
  }));

  function verifyInputs(_x20, _x21, _x22) {
    return _ref18.apply(this, arguments);
  }

  return verifyInputs;
}();

/**
 * Add a transaction to the mempool without performing any
 * validation. Note that this method does not lock the mempool
 * and may lend itself to race conditions if used unwisely.
 * This function will also resolve orphans if possible (the
 * resolved orphans _will_ be validated).
 * @method
 * @param {MempoolEntry} entry
 * @param {CoinView} view
 * @returns {Promise}
 */

Mempool.prototype.addEntry = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(entry, view) {
    var tx;
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            tx = entry.tx;


            this.trackEntry(entry, view);

            this.updateAncestors(entry, addFee);

            this.emit('tx', tx, view);
            this.emit('add entry', entry);

            if (this.fees) this.fees.processTX(entry, this.chain.synced);

            this.logger.debug('Added %s to mempool (txs=%d).', tx.txid(), this.map.size);

            this.cache.save(entry);

            _context16.next = 10;
            return this.handleOrphans(tx);

          case 10:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function addEntry(_x23, _x24) {
    return _ref19.apply(this, arguments);
  }

  return addEntry;
}();

/**
 * Remove a transaction from the mempool.
 * Generally only called when a new block
 * is added to the main chain.
 * @param {MempoolEntry} entry
 */

Mempool.prototype.removeEntry = function removeEntry(entry) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  this.untrackEntry(entry);

  if (this.fees) this.fees.removeTX(hash);

  this.cache.remove(tx.hash());

  this.emit('remove entry', entry);
};

/**
 * Remove a transaction from the mempool.
 * Recursively remove its spenders.
 * @param {MempoolEntry} entry
 */

Mempool.prototype.evictEntry = function evictEntry(entry) {
  this.removeSpenders(entry);
  this.updateAncestors(entry, removeFee);
  this.removeEntry(entry);
};

/**
 * Recursively remove spenders of a transaction.
 * @private
 * @param {MempoolEntry} entry
 */

Mempool.prototype.removeSpenders = function removeSpenders(entry) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  for (var i = 0; i < tx.outputs.length; i++) {
    var spender = this.getSpent(hash, i);

    if (!spender) continue;

    this.removeSpenders(spender);
    this.removeEntry(spender);
  }
};

/**
 * Count the highest number of
 * ancestors a transaction may have.
 * @param {MempoolEntry} entry
 * @returns {Number}
 */

Mempool.prototype.countAncestors = function countAncestors(entry) {
  return this._countAncestors(entry, new _set2.default(), entry, nop);
};

/**
 * Count the highest number of
 * ancestors a transaction may have.
 * Update descendant fees and size.
 * @param {MempoolEntry} entry
 * @param {Function} map
 * @returns {Number}
 */

Mempool.prototype.updateAncestors = function updateAncestors(entry, map) {
  return this._countAncestors(entry, new _set2.default(), entry, map);
};

/**
 * Traverse ancestors and count.
 * @private
 * @param {MempoolEntry} entry
 * @param {Object} set
 * @param {MempoolEntry} child
 * @param {Function} map
 * @returns {Number}
 */

Mempool.prototype._countAncestors = function _countAncestors(entry, set, child, map) {
  var tx = entry.tx;

  var _iteratorNormalCompletion13 = true;
  var _didIteratorError13 = false;
  var _iteratorError13 = undefined;

  try {
    for (var _iterator13 = (0, _getIterator3.default)(tx.inputs), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
      var _ref20 = _step13.value;
      var prevout = _ref20.prevout;

      var hash = prevout.hash;
      var parent = this.getEntry(hash);

      if (!parent) continue;

      if (set.has(hash)) continue;

      set.add(hash);

      map(parent, child);

      if (set.size > this.options.maxAncestors) break;

      this._countAncestors(parent, set, child, map);

      if (set.size > this.options.maxAncestors) break;
    }
  } catch (err) {
    _didIteratorError13 = true;
    _iteratorError13 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion13 && _iterator13.return) {
        _iterator13.return();
      }
    } finally {
      if (_didIteratorError13) {
        throw _iteratorError13;
      }
    }
  }

  return set.size;
};

/**
 * Count the highest number of
 * descendants a transaction may have.
 * @param {MempoolEntry} entry
 * @returns {Number}
 */

Mempool.prototype.countDescendants = function countDescendants(entry) {
  return this._countDescendants(entry, new _set2.default());
};

/**
 * Count the highest number of
 * descendants a transaction may have.
 * @private
 * @param {MempoolEntry} entry
 * @param {Object} set
 * @returns {Number}
 */

Mempool.prototype._countDescendants = function _countDescendants(entry, set) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  for (var i = 0; i < tx.outputs.length; i++) {
    var child = this.getSpent(hash, i);

    if (!child) continue;

    var next = child.hash('hex');

    if (set.has(next)) continue;

    set.add(next);

    this._countDescendants(child, set);
  }

  return set.size;
};

/**
 * Get all transaction ancestors.
 * @param {MempoolEntry} entry
 * @returns {MempoolEntry[]}
 */

Mempool.prototype.getAncestors = function getAncestors(entry) {
  return this._getAncestors(entry, [], new _set2.default());
};

/**
 * Get all transaction ancestors.
 * @private
 * @param {MempoolEntry} entry
 * @param {MempoolEntry[]} entries
 * @param {Object} set
 * @returns {MempoolEntry[]}
 */

Mempool.prototype._getAncestors = function _getAncestors(entry, entries, set) {
  var tx = entry.tx;

  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = (0, _getIterator3.default)(tx.inputs), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var _ref21 = _step14.value;
      var prevout = _ref21.prevout;

      var hash = prevout.hash;
      var parent = this.getEntry(hash);

      if (!parent) continue;

      if (set.has(hash)) continue;

      set.add(hash);
      entries.push(parent);

      this._getAncestors(parent, entries, set);
    }
  } catch (err) {
    _didIteratorError14 = true;
    _iteratorError14 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion14 && _iterator14.return) {
        _iterator14.return();
      }
    } finally {
      if (_didIteratorError14) {
        throw _iteratorError14;
      }
    }
  }

  return entries;
};

/**
 * Get all a transaction descendants.
 * @param {MempoolEntry} entry
 * @returns {MempoolEntry[]}
 */

Mempool.prototype.getDescendants = function getDescendants(entry) {
  return this._getDescendants(entry, [], new _set2.default());
};

/**
 * Get all a transaction descendants.
 * @param {MempoolEntry} entry
 * @param {MempoolEntry[]} entries
 * @param {Object} set
 * @returns {MempoolEntry[]}
 */

Mempool.prototype._getDescendants = function _getDescendants(entry, entries, set) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  for (var i = 0; i < tx.outputs.length; i++) {
    var child = this.getSpent(hash, i);

    if (!child) continue;

    var next = child.hash('hex');

    if (set.has(next)) continue;

    set.add(next);
    entries.push(child);

    this._getDescendants(child, entries, set);
  }

  return entries;
};

/**
 * Find a unconfirmed transactions that
 * this transaction depends on.
 * @param {TX} tx
 * @returns {Hash[]}
 */

Mempool.prototype.getDepends = function getDepends(tx) {
  var prevout = tx.getPrevout();
  var depends = [];

  var _iteratorNormalCompletion15 = true;
  var _didIteratorError15 = false;
  var _iteratorError15 = undefined;

  try {
    for (var _iterator15 = (0, _getIterator3.default)(prevout), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
      var hash = _step15.value;

      if (this.hasEntry(hash)) depends.push(hash);
    }
  } catch (err) {
    _didIteratorError15 = true;
    _iteratorError15 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion15 && _iterator15.return) {
        _iterator15.return();
      }
    } finally {
      if (_didIteratorError15) {
        throw _iteratorError15;
      }
    }
  }

  return depends;
};

/**
 * Test whether a transaction has dependencies.
 * @param {TX} tx
 * @returns {Boolean}
 */

Mempool.prototype.hasDepends = function hasDepends(tx) {
  var _iteratorNormalCompletion16 = true;
  var _didIteratorError16 = false;
  var _iteratorError16 = undefined;

  try {
    for (var _iterator16 = (0, _getIterator3.default)(tx.inputs), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
      var _ref22 = _step16.value;
      var prevout = _ref22.prevout;

      if (this.hasEntry(prevout.hash)) return true;
    }
  } catch (err) {
    _didIteratorError16 = true;
    _iteratorError16 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion16 && _iterator16.return) {
        _iterator16.return();
      }
    } finally {
      if (_didIteratorError16) {
        throw _iteratorError16;
      }
    }
  }

  return false;
};

/**
 * Return the full balance of all unspents in the mempool
 * (not very useful in practice, only used for testing).
 * @returns {Amount}
 */

Mempool.prototype.getBalance = function getBalance() {
  var total = 0;

  var _iteratorNormalCompletion17 = true;
  var _didIteratorError17 = false;
  var _iteratorError17 = undefined;

  try {
    for (var _iterator17 = (0, _getIterator3.default)(this.map), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
      var _ref23 = _step17.value;

      var _ref24 = (0, _slicedToArray3.default)(_ref23, 2);

      var hash = _ref24[0];
      var entry = _ref24[1];

      var tx = entry.tx;
      for (var i = 0; i < tx.outputs.length; i++) {
        var coin = this.getCoin(hash, i);
        if (coin) total += coin.value;
      }
    }
  } catch (err) {
    _didIteratorError17 = true;
    _iteratorError17 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion17 && _iterator17.return) {
        _iterator17.return();
      }
    } finally {
      if (_didIteratorError17) {
        throw _iteratorError17;
      }
    }
  }

  return total;
};

/**
 * Retrieve _all_ transactions from the mempool.
 * @returns {TX[]}
 */

Mempool.prototype.getHistory = function getHistory() {
  var txs = [];

  var _iteratorNormalCompletion18 = true;
  var _didIteratorError18 = false;
  var _iteratorError18 = undefined;

  try {
    for (var _iterator18 = (0, _getIterator3.default)(this.map.values()), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
      var entry = _step18.value;

      txs.push(entry.tx);
    }
  } catch (err) {
    _didIteratorError18 = true;
    _iteratorError18 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion18 && _iterator18.return) {
        _iterator18.return();
      }
    } finally {
      if (_didIteratorError18) {
        throw _iteratorError18;
      }
    }
  }

  return txs;
};

/**
 * Retrieve an orphan transaction.
 * @param {Hash} hash
 * @returns {TX}
 */

Mempool.prototype.getOrphan = function getOrphan(hash) {
  return this.orphans.get(hash);
};

/**
 * @param {Hash} hash
 * @returns {Boolean}
 */

Mempool.prototype.hasOrphan = function hasOrphan(hash) {
  return this.orphans.has(hash);
};

/**
 * Maybe store an orphaned transaction.
 * @param {TX} tx
 * @param {CoinView} view
 * @param {Number} id
 */

Mempool.prototype.maybeOrphan = function maybeOrphan(tx, view, id) {
  var hashes = new _set2.default();
  var missing = [];

  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = (0, _getIterator3.default)(tx.inputs), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var _ref25 = _step19.value;
      var prevout = _ref25.prevout;

      if (view.hasEntry(prevout)) continue;

      if (this.hasReject(prevout.hash)) {
        this.logger.debug('Not storing orphan %s (rejected parents).', tx.txid());
        this.rejects.add(tx.hash());
        return missing;
      }

      if (this.hasEntry(prevout.hash)) {
        this.logger.debug('Not storing orphan %s (non-existent output).', tx.txid());
        this.rejects.add(tx.hash());
        return missing;
      }

      hashes.add(prevout.hash);
    }

    // Not an orphan.
  } catch (err) {
    _didIteratorError19 = true;
    _iteratorError19 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion19 && _iterator19.return) {
        _iterator19.return();
      }
    } finally {
      if (_didIteratorError19) {
        throw _iteratorError19;
      }
    }
  }

  if (hashes.size === 0) return null;

  // Weight limit for orphans.
  if (tx.getWeight() > policy.MAX_TX_WEIGHT) {
    this.logger.debug('Ignoring large orphan: %s', tx.txid());
    if (!tx.hasWitness()) this.rejects.add(tx.hash());
    return missing;
  }

  if (this.options.maxOrphans === 0) return missing;

  this.limitOrphans();

  var hash = tx.hash('hex');

  var _iteratorNormalCompletion20 = true;
  var _didIteratorError20 = false;
  var _iteratorError20 = undefined;

  try {
    for (var _iterator20 = (0, _getIterator3.default)(hashes.keys()), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
      var prev = _step20.value;

      if (!this.waiting.has(prev)) this.waiting.set(prev, new _set2.default());

      this.waiting.get(prev).add(hash);

      missing.push(prev);
    }
  } catch (err) {
    _didIteratorError20 = true;
    _iteratorError20 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion20 && _iterator20.return) {
        _iterator20.return();
      }
    } finally {
      if (_didIteratorError20) {
        throw _iteratorError20;
      }
    }
  }

  this.orphans.set(hash, new Orphan(tx, missing.length, id));

  this.logger.debug('Added orphan %s to mempool.', tx.txid());

  this.emit('add orphan', tx);

  return missing;
};

/**
 * Resolve orphans and attempt to add to mempool.
 * @method
 * @param {TX} parent
 * @returns {Promise} - Returns {@link TX}[].
 */

Mempool.prototype.handleOrphans = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(parent) {
    var resolved, _iteratorNormalCompletion21, _didIteratorError21, _iteratorError21, _iterator21, _step21, orphan, tx, missing;

    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            resolved = this.resolveOrphans(parent);
            _iteratorNormalCompletion21 = true;
            _didIteratorError21 = false;
            _iteratorError21 = undefined;
            _context17.prev = 4;
            _iterator21 = (0, _getIterator3.default)(resolved);

          case 6:
            if (_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done) {
              _context17.next = 39;
              break;
            }

            orphan = _step21.value;
            tx = void 0, missing = void 0;
            _context17.prev = 9;

            tx = orphan.toTX();
            _context17.next = 17;
            break;

          case 13:
            _context17.prev = 13;
            _context17.t0 = _context17['catch'](9);

            this.logger.warning('%s %s', 'Warning: possible memory corruption.', 'Orphan failed deserialization.');
            return _context17.abrupt('continue', 36);

          case 17:
            _context17.prev = 17;
            _context17.next = 20;
            return this.insertTX(tx, orphan.id);

          case 20:
            missing = _context17.sent;
            _context17.next = 31;
            break;

          case 23:
            _context17.prev = 23;
            _context17.t1 = _context17['catch'](17);

            if (!(_context17.t1.type === 'VerifyError')) {
              _context17.next = 30;
              break;
            }

            this.logger.debug('Could not resolve orphan %s: %s.', tx.txid(), _context17.t1.message);

            if (!tx.hasWitness() && !_context17.t1.malleated) this.rejects.add(tx.hash());

            this.emit('bad orphan', _context17.t1, orphan.id);

            return _context17.abrupt('continue', 36);

          case 30:
            throw _context17.t1;

          case 31:
            if (!(missing && missing.length > 0)) {
              _context17.next = 35;
              break;
            }

            this.logger.debug('Transaction %s was double-orphaned in mempool.', tx.txid());
            this.removeOrphan(tx.hash('hex'));
            return _context17.abrupt('continue', 36);

          case 35:

            this.logger.debug('Resolved orphan %s in mempool.', tx.txid());

          case 36:
            _iteratorNormalCompletion21 = true;
            _context17.next = 6;
            break;

          case 39:
            _context17.next = 45;
            break;

          case 41:
            _context17.prev = 41;
            _context17.t2 = _context17['catch'](4);
            _didIteratorError21 = true;
            _iteratorError21 = _context17.t2;

          case 45:
            _context17.prev = 45;
            _context17.prev = 46;

            if (!_iteratorNormalCompletion21 && _iterator21.return) {
              _iterator21.return();
            }

          case 48:
            _context17.prev = 48;

            if (!_didIteratorError21) {
              _context17.next = 51;
              break;
            }

            throw _iteratorError21;

          case 51:
            return _context17.finish(48);

          case 52:
            return _context17.finish(45);

          case 53:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this, [[4, 41, 45, 53], [9, 13], [17, 23], [46,, 48, 52]]);
  }));

  function handleOrphans(_x25) {
    return _ref26.apply(this, arguments);
  }

  return handleOrphans;
}();

/**
 * Potentially resolve any transactions
 * that redeem the passed-in transaction.
 * Deletes all orphan entries and
 * returns orphan objects.
 * @param {TX} parent
 * @returns {Orphan[]}
 */

Mempool.prototype.resolveOrphans = function resolveOrphans(parent) {
  var hash = parent.hash('hex');
  var set = this.waiting.get(hash);

  if (!set) return [];

  assert(set.size > 0);

  var resolved = [];

  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = (0, _getIterator3.default)(set.keys()), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var _hash2 = _step22.value;

      var orphan = this.getOrphan(_hash2);

      assert(orphan);

      if (--orphan.missing === 0) {
        this.orphans.delete(_hash2);
        resolved.push(orphan);
      }
    }
  } catch (err) {
    _didIteratorError22 = true;
    _iteratorError22 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion22 && _iterator22.return) {
        _iterator22.return();
      }
    } finally {
      if (_didIteratorError22) {
        throw _iteratorError22;
      }
    }
  }

  this.waiting.delete(hash);

  return resolved;
};

/**
 * Remove a transaction from the mempool.
 * @param {Hash} tx
 * @returns {Boolean}
 */

Mempool.prototype.removeOrphan = function removeOrphan(hash) {
  var orphan = this.getOrphan(hash);

  if (!orphan) return false;

  var tx = void 0;
  try {
    tx = orphan.toTX();
  } catch (e) {
    this.orphans.delete(hash);
    this.logger.warning('%s %s', 'Warning: possible memory corruption.', 'Orphan failed deserialization.');
    return false;
  }

  var _iteratorNormalCompletion23 = true;
  var _didIteratorError23 = false;
  var _iteratorError23 = undefined;

  try {
    for (var _iterator23 = (0, _getIterator3.default)(tx.getPrevout()), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
      var prev = _step23.value;

      var set = this.waiting.get(prev);

      if (!set) continue;

      assert(set.has(hash));

      set.delete(hash);

      if (set.size === 0) this.waiting.delete(prev);
    }
  } catch (err) {
    _didIteratorError23 = true;
    _iteratorError23 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion23 && _iterator23.return) {
        _iterator23.return();
      }
    } finally {
      if (_didIteratorError23) {
        throw _iteratorError23;
      }
    }
  }

  this.orphans.delete(hash);

  this.emit('remove orphan', tx);

  return true;
};

/**
 * Remove a random orphan transaction from the mempool.
 * @returns {Boolean}
 */

Mempool.prototype.limitOrphans = function limitOrphans() {
  if (this.orphans.size < this.options.maxOrphans) return false;

  var index = random.randomRange(0, this.orphans.size);

  var hash = void 0;
  var _iteratorNormalCompletion24 = true;
  var _didIteratorError24 = false;
  var _iteratorError24 = undefined;

  try {
    for (var _iterator24 = (0, _getIterator3.default)(this.orphans.keys()), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
      hash = _step24.value;

      if (index === 0) break;
      index--;
    }
  } catch (err) {
    _didIteratorError24 = true;
    _iteratorError24 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion24 && _iterator24.return) {
        _iterator24.return();
      }
    } finally {
      if (_didIteratorError24) {
        throw _iteratorError24;
      }
    }
  }

  assert(hash);

  this.logger.debug('Removing orphan %s from mempool.', util.revHex(hash));

  this.removeOrphan(hash);

  return true;
};

/**
 * Test all of a transactions outpoints to see if they are doublespends.
 * Note that this will only test against the mempool spents, not the
 * blockchain's. The blockchain spents are not checked against because
 * the blockchain does not maintain a spent list. The transaction will
 * be seen as an orphan rather than a double spend.
 * @param {TX} tx
 * @returns {Promise} - Returns Boolean.
 */

Mempool.prototype.isDoubleSpend = function isDoubleSpend(tx) {
  var _iteratorNormalCompletion25 = true;
  var _didIteratorError25 = false;
  var _iteratorError25 = undefined;

  try {
    for (var _iterator25 = (0, _getIterator3.default)(tx.inputs), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
      var _ref27 = _step25.value;
      var prevout = _ref27.prevout;
      var hash = prevout.hash,
          index = prevout.index;

      if (this.isSpent(hash, index)) return true;
    }
  } catch (err) {
    _didIteratorError25 = true;
    _iteratorError25 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion25 && _iterator25.return) {
        _iterator25.return();
      }
    } finally {
      if (_didIteratorError25) {
        throw _iteratorError25;
      }
    }
  }

  return false;
};

/**
 * Get coin viewpoint (lock).
 * @method
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

Mempool.prototype.getSpentView = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(tx) {
    var unlock;
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            _context18.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context18.sent;
            _context18.prev = 3;
            _context18.next = 6;
            return this.getCoinView(tx);

          case 6:
            return _context18.abrupt('return', _context18.sent);

          case 7:
            _context18.prev = 7;

            unlock();
            return _context18.finish(7);

          case 10:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this, [[3,, 7, 10]]);
  }));

  function getSpentView(_x26) {
    return _ref28.apply(this, arguments);
  }

  return getSpentView;
}();

/**
 * Get coin viewpoint (no lock).
 * @method
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

Mempool.prototype.getCoinView = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(tx) {
    var view, _iteratorNormalCompletion26, _didIteratorError26, _iteratorError26, _iterator26, _step26, _ref30, prevout, hash, index, _tx, coin;

    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            view = new CoinView();
            _iteratorNormalCompletion26 = true;
            _didIteratorError26 = false;
            _iteratorError26 = undefined;
            _context19.prev = 4;
            _iterator26 = (0, _getIterator3.default)(tx.inputs);

          case 6:
            if (_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done) {
              _context19.next = 21;
              break;
            }

            _ref30 = _step26.value;
            prevout = _ref30.prevout;
            hash = prevout.hash, index = prevout.index;
            _tx = this.getTX(hash);

            if (!_tx) {
              _context19.next = 14;
              break;
            }

            if (index < _tx.outputs.length) view.addIndex(_tx, index, -1);
            return _context19.abrupt('continue', 18);

          case 14:
            _context19.next = 16;
            return this.chain.readCoin(prevout);

          case 16:
            coin = _context19.sent;


            if (coin) view.addEntry(prevout, coin);

          case 18:
            _iteratorNormalCompletion26 = true;
            _context19.next = 6;
            break;

          case 21:
            _context19.next = 27;
            break;

          case 23:
            _context19.prev = 23;
            _context19.t0 = _context19['catch'](4);
            _didIteratorError26 = true;
            _iteratorError26 = _context19.t0;

          case 27:
            _context19.prev = 27;
            _context19.prev = 28;

            if (!_iteratorNormalCompletion26 && _iterator26.return) {
              _iterator26.return();
            }

          case 30:
            _context19.prev = 30;

            if (!_didIteratorError26) {
              _context19.next = 33;
              break;
            }

            throw _iteratorError26;

          case 33:
            return _context19.finish(30);

          case 34:
            return _context19.finish(27);

          case 35:
            return _context19.abrupt('return', view);

          case 36:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this, [[4, 23, 27, 35], [28,, 30, 34]]);
  }));

  function getCoinView(_x27) {
    return _ref29.apply(this, arguments);
  }

  return getCoinView;
}();

/**
 * Get a snapshot of all transaction hashes in the mempool. Used
 * for generating INV packets in response to MEMPOOL packets.
 * @returns {Hash[]}
 */

Mempool.prototype.getSnapshot = function getSnapshot() {
  var keys = [];

  var _iteratorNormalCompletion27 = true;
  var _didIteratorError27 = false;
  var _iteratorError27 = undefined;

  try {
    for (var _iterator27 = (0, _getIterator3.default)(this.map.keys()), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
      var hash = _step27.value;

      keys.push(hash);
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

  return keys;
};

/**
 * Check sequence locks on a transaction against the current tip.
 * @param {TX} tx
 * @param {CoinView} view
 * @param {LockFlags} flags
 * @returns {Promise} - Returns Boolean.
 */

Mempool.prototype.verifyLocks = function verifyLocks(tx, view, flags) {
  return this.chain.verifyLocks(this.chain.tip, tx, view, flags);
};

/**
 * Check locktime on a transaction against the current tip.
 * @param {TX} tx
 * @param {LockFlags} flags
 * @returns {Promise} - Returns Boolean.
 */

Mempool.prototype.verifyFinal = function verifyFinal(tx, flags) {
  return this.chain.verifyFinal(this.chain.tip, tx, flags);
};

/**
 * Map a transaction to the mempool.
 * @private
 * @param {MempoolEntry} entry
 * @param {CoinView} view
 */

Mempool.prototype.trackEntry = function trackEntry(entry, view) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  assert(!this.map.has(hash));
  this.map.set(hash, entry);

  assert(!tx.isCoinbase());

  var _iteratorNormalCompletion28 = true;
  var _didIteratorError28 = false;
  var _iteratorError28 = undefined;

  try {
    for (var _iterator28 = (0, _getIterator3.default)(tx.inputs), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
      var _ref31 = _step28.value;
      var prevout = _ref31.prevout;

      var key = prevout.toKey();
      this.spents.set(key, entry);
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

  if (this.options.indexAddress && view) this.indexEntry(entry, view);

  this.size += entry.memUsage();
};

/**
 * Unmap a transaction from the mempool.
 * @private
 * @param {MempoolEntry} entry
 */

Mempool.prototype.untrackEntry = function untrackEntry(entry) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  assert(this.map.has(hash));
  this.map.delete(hash);

  assert(!tx.isCoinbase());

  var _iteratorNormalCompletion29 = true;
  var _didIteratorError29 = false;
  var _iteratorError29 = undefined;

  try {
    for (var _iterator29 = (0, _getIterator3.default)(tx.inputs), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
      var _ref32 = _step29.value;
      var prevout = _ref32.prevout;

      var key = prevout.toKey();
      this.spents.delete(key);
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

  if (this.options.indexAddress) this.unindexEntry(entry);

  this.size -= entry.memUsage();
};

/**
 * Index an entry by address.
 * @private
 * @param {MempoolEntry} entry
 * @param {CoinView} view
 */

Mempool.prototype.indexEntry = function indexEntry(entry, view) {
  var tx = entry.tx;

  this.txIndex.insert(entry, view);

  var _iteratorNormalCompletion30 = true;
  var _didIteratorError30 = false;
  var _iteratorError30 = undefined;

  try {
    for (var _iterator30 = (0, _getIterator3.default)(tx.inputs), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
      var _ref33 = _step30.value;
      var prevout = _ref33.prevout;
      var hash = prevout.hash,
          index = prevout.index;

      this.coinIndex.remove(hash, index);
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

  for (var i = 0; i < tx.outputs.length; i++) {
    this.coinIndex.insert(tx, i);
  }
};

/**
 * Unindex an entry by address.
 * @private
 * @param {MempoolEntry} entry
 */

Mempool.prototype.unindexEntry = function unindexEntry(entry) {
  var tx = entry.tx;
  var hash = tx.hash('hex');

  this.txIndex.remove(hash);

  var _iteratorNormalCompletion31 = true;
  var _didIteratorError31 = false;
  var _iteratorError31 = undefined;

  try {
    for (var _iterator31 = (0, _getIterator3.default)(tx.inputs), _step31; !(_iteratorNormalCompletion31 = (_step31 = _iterator31.next()).done); _iteratorNormalCompletion31 = true) {
      var _ref34 = _step31.value;
      var prevout = _ref34.prevout;
      var _hash3 = prevout.hash,
          index = prevout.index;

      var prev = this.getTX(_hash3);

      if (!prev) continue;

      this.coinIndex.insert(prev, index);
    }
  } catch (err) {
    _didIteratorError31 = true;
    _iteratorError31 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion31 && _iterator31.return) {
        _iterator31.return();
      }
    } finally {
      if (_didIteratorError31) {
        throw _iteratorError31;
      }
    }
  }

  for (var i = 0; i < tx.outputs.length; i++) {
    this.coinIndex.remove(hash, i);
  }
};

/**
 * Recursively remove double spenders
 * of a mined transaction's outpoints.
 * @private
 * @param {TX} tx
 */

Mempool.prototype.removeDoubleSpends = function removeDoubleSpends(tx) {
  var _iteratorNormalCompletion32 = true;
  var _didIteratorError32 = false;
  var _iteratorError32 = undefined;

  try {
    for (var _iterator32 = (0, _getIterator3.default)(tx.inputs), _step32; !(_iteratorNormalCompletion32 = (_step32 = _iterator32.next()).done); _iteratorNormalCompletion32 = true) {
      var _ref35 = _step32.value;
      var prevout = _ref35.prevout;
      var hash = prevout.hash,
          index = prevout.index;

      var spent = this.getSpent(hash, index);

      if (!spent) continue;

      this.logger.debug('Removing double spender from mempool: %s.', spent.txid());

      this.evictEntry(spent);

      this.emit('double spend', spent);
    }
  } catch (err) {
    _didIteratorError32 = true;
    _iteratorError32 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion32 && _iterator32.return) {
        _iterator32.return();
      }
    } finally {
      if (_didIteratorError32) {
        throw _iteratorError32;
      }
    }
  }
};

/**
 * Calculate the memory usage of the entire mempool.
 * @see DynamicMemoryUsage()
 * @returns {Number} Usage in bytes.
 */

Mempool.prototype.getSize = function getSize() {
  return this.size;
};

/**
 * Prioritise transaction.
 * @param {MempoolEntry} entry
 * @param {Number} pri
 * @param {Amount} fee
 */

Mempool.prototype.prioritise = function prioritise(entry, pri, fee) {
  if (-pri > entry.priority) pri = -entry.priority;

  entry.priority += pri;

  if (-fee > entry.deltaFee) fee = -entry.deltaFee;

  if (fee === 0) return;

  this.updateAncestors(entry, prePrioritise);

  entry.deltaFee += fee;
  entry.descFee += fee;

  this.updateAncestors(entry, postPrioritise);
};

/**
 * MempoolOptions
 * @alias module:mempool.MempoolOptions
 * @constructor
 * @param {Object}
 */

function MempoolOptions(options) {
  if (!(this instanceof MempoolOptions)) return new MempoolOptions(options);

  this.network = Network.primary;
  this.chain = null;
  this.logger = null;
  this.workers = null;
  this.fees = null;

  this.limitFree = true;
  this.limitFreeRelay = 15;
  this.relayPriority = true;
  this.requireStandard = this.network.requireStandard;
  this.rejectAbsurdFees = true;
  this.prematureWitness = false;
  this.paranoidChecks = false;
  this.replaceByFee = false;

  this.maxSize = policy.MEMPOOL_MAX_SIZE;
  this.maxOrphans = policy.MEMPOOL_MAX_ORPHANS;
  this.maxAncestors = policy.MEMPOOL_MAX_ANCESTORS;
  this.expiryTime = policy.MEMPOOL_EXPIRY_TIME;
  this.minRelay = this.network.minRelay;

  this.prefix = null;
  this.location = null;
  this.db = 'memory';
  this.maxFiles = 64;
  this.cacheSize = 32 << 20;
  this.compression = true;
  this.bufferKeys = layout.binary;

  this.persistent = false;

  this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {MempoolOptions}
 */

MempoolOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Mempool requires options.');
  assert(options.chain && (0, _typeof3.default)(options.chain) === 'object', 'Mempool requires a blockchain.');

  this.chain = options.chain;
  this.network = options.chain.network;
  this.logger = options.chain.logger;
  this.workers = options.chain.workers;

  this.requireStandard = this.network.requireStandard;
  this.minRelay = this.network.minRelay;

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.workers != null) {
    assert((0, _typeof3.default)(options.workers) === 'object');
    this.workers = options.workers;
  }

  if (options.fees != null) {
    assert((0, _typeof3.default)(options.fees) === 'object');
    this.fees = options.fees;
  }

  if (options.limitFree != null) {
    assert(typeof options.limitFree === 'boolean');
    this.limitFree = options.limitFree;
  }

  if (options.limitFreeRelay != null) {
    assert(util.isU32(options.limitFreeRelay));
    this.limitFreeRelay = options.limitFreeRelay;
  }

  if (options.relayPriority != null) {
    assert(typeof options.relayPriority === 'boolean');
    this.relayPriority = options.relayPriority;
  }

  if (options.requireStandard != null) {
    assert(typeof options.requireStandard === 'boolean');
    this.requireStandard = options.requireStandard;
  }

  if (options.rejectAbsurdFees != null) {
    assert(typeof options.rejectAbsurdFees === 'boolean');
    this.rejectAbsurdFees = options.rejectAbsurdFees;
  }

  if (options.prematureWitness != null) {
    assert(typeof options.prematureWitness === 'boolean');
    this.prematureWitness = options.prematureWitness;
  }

  if (options.paranoidChecks != null) {
    assert(typeof options.paranoidChecks === 'boolean');
    this.paranoidChecks = options.paranoidChecks;
  }

  if (options.replaceByFee != null) {
    assert(typeof options.replaceByFee === 'boolean');
    this.replaceByFee = options.replaceByFee;
  }

  if (options.maxSize != null) {
    assert(util.isU64(options.maxSize));
    this.maxSize = options.maxSize;
  }

  if (options.maxOrphans != null) {
    assert(util.isU32(options.maxOrphans));
    this.maxOrphans = options.maxOrphans;
  }

  if (options.maxAncestors != null) {
    assert(util.isU32(options.maxAncestors));
    this.maxAncestors = options.maxAncestors;
  }

  if (options.expiryTime != null) {
    assert(util.isU32(options.expiryTime));
    this.expiryTime = options.expiryTime;
  }

  if (options.minRelay != null) {
    assert(util.isU64(options.minRelay));
    this.minRelay = options.minRelay;
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
    this.location = path.join(this.prefix, 'mempool');
  }

  if (options.location != null) {
    assert(typeof options.location === 'string');
    this.location = options.location;
  }

  if (options.db != null) {
    assert(typeof options.db === 'string');
    this.db = options.db;
  }

  if (options.maxFiles != null) {
    assert(util.isU32(options.maxFiles));
    this.maxFiles = options.maxFiles;
  }

  if (options.cacheSize != null) {
    assert(util.isU64(options.cacheSize));
    this.cacheSize = options.cacheSize;
  }

  if (options.compression != null) {
    assert(typeof options.compression === 'boolean');
    this.compression = options.compression;
  }

  if (options.persistent != null) {
    assert(typeof options.persistent === 'boolean');
    this.persistent = options.persistent;
  }

  if (options.indexAddress != null) {
    assert(typeof options.indexAddress === 'boolean');
    this.indexAddress = options.indexAddress;
  }

  return this;
};

/**
 * Instantiate mempool options from object.
 * @param {Object} options
 * @returns {MempoolOptions}
 */

MempoolOptions.fromOptions = function fromOptions(options) {
  return new MempoolOptions().fromOptions(options);
};

/**
 * TX Address Index
 * @constructor
 * @ignore
 */

function TXIndex() {
  // Map of addr->entries.
  this.index = new _map2.default();

  // Map of txid->addrs.
  this.map = new _map2.default();
}

TXIndex.prototype.reset = function reset() {
  this.index.clear();
  this.map.clear();
};

TXIndex.prototype.get = function get(addr) {
  var items = this.index.get(addr);

  if (!items) return [];

  var out = [];

  var _iteratorNormalCompletion33 = true;
  var _didIteratorError33 = false;
  var _iteratorError33 = undefined;

  try {
    for (var _iterator33 = (0, _getIterator3.default)(items.values()), _step33; !(_iteratorNormalCompletion33 = (_step33 = _iterator33.next()).done); _iteratorNormalCompletion33 = true) {
      var entry = _step33.value;

      out.push(entry.tx);
    }
  } catch (err) {
    _didIteratorError33 = true;
    _iteratorError33 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion33 && _iterator33.return) {
        _iterator33.return();
      }
    } finally {
      if (_didIteratorError33) {
        throw _iteratorError33;
      }
    }
  }

  return out;
};

TXIndex.prototype.getMeta = function getMeta(addr) {
  var items = this.index.get(addr);

  if (!items) return [];

  var out = [];

  var _iteratorNormalCompletion34 = true;
  var _didIteratorError34 = false;
  var _iteratorError34 = undefined;

  try {
    for (var _iterator34 = (0, _getIterator3.default)(items.values()), _step34; !(_iteratorNormalCompletion34 = (_step34 = _iterator34.next()).done); _iteratorNormalCompletion34 = true) {
      var entry = _step34.value;

      var meta = TXMeta.fromTX(entry.tx);
      meta.mtime = entry.time;
      out.push(meta);
    }
  } catch (err) {
    _didIteratorError34 = true;
    _iteratorError34 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion34 && _iterator34.return) {
        _iterator34.return();
      }
    } finally {
      if (_didIteratorError34) {
        throw _iteratorError34;
      }
    }
  }

  return out;
};

TXIndex.prototype.insert = function insert(entry, view) {
  var tx = entry.tx;
  var hash = tx.hash('hex');
  var addrs = tx.getHashes(view, 'hex');

  if (addrs.length === 0) return;

  var _iteratorNormalCompletion35 = true;
  var _didIteratorError35 = false;
  var _iteratorError35 = undefined;

  try {
    for (var _iterator35 = (0, _getIterator3.default)(addrs), _step35; !(_iteratorNormalCompletion35 = (_step35 = _iterator35.next()).done); _iteratorNormalCompletion35 = true) {
      var addr = _step35.value;

      var items = this.index.get(addr);

      if (!items) {
        items = new _map2.default();
        this.index.set(addr, items);
      }

      assert(!items.has(hash));
      items.set(hash, entry);
    }
  } catch (err) {
    _didIteratorError35 = true;
    _iteratorError35 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion35 && _iterator35.return) {
        _iterator35.return();
      }
    } finally {
      if (_didIteratorError35) {
        throw _iteratorError35;
      }
    }
  }

  this.map.set(hash, addrs);
};

TXIndex.prototype.remove = function remove(hash) {
  var addrs = this.map.get(hash);

  if (!addrs) return;

  var _iteratorNormalCompletion36 = true;
  var _didIteratorError36 = false;
  var _iteratorError36 = undefined;

  try {
    for (var _iterator36 = (0, _getIterator3.default)(addrs), _step36; !(_iteratorNormalCompletion36 = (_step36 = _iterator36.next()).done); _iteratorNormalCompletion36 = true) {
      var addr = _step36.value;

      var items = this.index.get(addr);

      assert(items);
      assert(items.has(hash));

      items.delete(hash);

      if (items.size === 0) this.index.delete(addr);
    }
  } catch (err) {
    _didIteratorError36 = true;
    _iteratorError36 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion36 && _iterator36.return) {
        _iterator36.return();
      }
    } finally {
      if (_didIteratorError36) {
        throw _iteratorError36;
      }
    }
  }

  this.map.delete(hash);
};

/**
 * Coin Address Index
 * @constructor
 * @ignore
 */

function CoinIndex() {
  // Map of addr->coins.
  this.index = new _map2.default();

  // Map of outpoint->addr.
  this.map = new _map2.default();
}

CoinIndex.prototype.reset = function reset() {
  this.index.clear();
  this.map.clear();
};

CoinIndex.prototype.get = function get(addr) {
  var items = this.index.get(addr);

  if (!items) return [];

  var out = [];

  var _iteratorNormalCompletion37 = true;
  var _didIteratorError37 = false;
  var _iteratorError37 = undefined;

  try {
    for (var _iterator37 = (0, _getIterator3.default)(items.values()), _step37; !(_iteratorNormalCompletion37 = (_step37 = _iterator37.next()).done); _iteratorNormalCompletion37 = true) {
      var coin = _step37.value;

      out.push(coin.toCoin());
    }
  } catch (err) {
    _didIteratorError37 = true;
    _iteratorError37 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion37 && _iterator37.return) {
        _iterator37.return();
      }
    } finally {
      if (_didIteratorError37) {
        throw _iteratorError37;
      }
    }
  }

  return out;
};

CoinIndex.prototype.insert = function insert(tx, index) {
  var output = tx.outputs[index];
  var hash = tx.hash('hex');
  var addr = output.getHash('hex');

  if (!addr) return;

  var items = this.index.get(addr);

  if (!items) {
    items = new _map2.default();
    this.index.set(addr, items);
  }

  var key = Outpoint.toKey(hash, index);

  assert(!items.has(key));
  items.set(key, new IndexedCoin(tx, index));

  this.map.set(key, addr);
};

CoinIndex.prototype.remove = function remove(hash, index) {
  var key = Outpoint.toKey(hash, index);
  var addr = this.map.get(key);

  if (!addr) return;

  var items = this.index.get(addr);

  assert(items);
  assert(items.has(key));
  items.delete(key);

  if (items.size === 0) this.index.delete(addr);

  this.map.delete(key);
};

/**
 * IndexedCoin
 * @constructor
 * @ignore
 * @param {TX} tx
 * @param {Number} index
 */

function IndexedCoin(tx, index) {
  this.tx = tx;
  this.index = index;
}

IndexedCoin.prototype.toCoin = function toCoin() {
  return Coin.fromTX(this.tx, this.index, -1);
};

/**
 * Orphan
 * @constructor
 * @ignore
 * @param {TX} tx
 * @param {Hash[]} missing
 * @param {Number} id
 */

function Orphan(tx, missing, id) {
  this.raw = tx.toRaw();
  this.missing = missing;
  this.id = id;
}

Orphan.prototype.toTX = function toTX() {
  return TX.fromRaw(this.raw);
};

/**
 * Mempool Cache
 * @ignore
 * @constructor
 * @param {Object} options
 */

function MempoolCache(options) {
  if (!(this instanceof MempoolCache)) return new MempoolCache(options);

  this.logger = options.logger;
  this.chain = options.chain;
  this.network = options.network;
  this.db = null;
  this.batch = null;

  if (options.persistent) this.db = LDB(options);
}

MempoolCache.VERSION = 2;

MempoolCache.prototype.getVersion = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20() {
    var data;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            _context20.next = 2;
            return this.db.get(layout.V);

          case 2:
            data = _context20.sent;

            if (data) {
              _context20.next = 5;
              break;
            }

            return _context20.abrupt('return', -1);

          case 5:
            return _context20.abrupt('return', data.readUInt32LE(0, true));

          case 6:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function getVersion() {
    return _ref36.apply(this, arguments);
  }

  return getVersion;
}();

MempoolCache.prototype.getTip = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21() {
    var hash;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            _context21.next = 2;
            return this.db.get(layout.R);

          case 2:
            hash = _context21.sent;

            if (hash) {
              _context21.next = 5;
              break;
            }

            return _context21.abrupt('return', null);

          case 5:
            return _context21.abrupt('return', hash.toString('hex'));

          case 6:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function getTip() {
    return _ref37.apply(this, arguments);
  }

  return getTip;
}();

MempoolCache.prototype.getFees = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22() {
    var data, fees;
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            _context22.next = 2;
            return this.db.get(layout.F);

          case 2:
            data = _context22.sent;

            if (data) {
              _context22.next = 5;
              break;
            }

            return _context22.abrupt('return', null);

          case 5:
            fees = void 0;

            try {
              fees = Fees.fromRaw(data);
            } catch (e) {
              this.logger.warning('Fee data failed deserialization: %s.', e.message);
            }

            return _context22.abrupt('return', fees);

          case 8:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function getFees() {
    return _ref38.apply(this, arguments);
  }

  return getFees;
}();

MempoolCache.prototype.getEntries = function getEntries() {
  return this.db.values({
    gte: layout.e(encoding.ZERO_HASH),
    lte: layout.e(encoding.MAX_HASH),
    parse: MempoolEntry.fromRaw
  });
};

MempoolCache.prototype.getKeys = function getKeys() {
  return this.db.keys({
    gte: layout.e(encoding.ZERO_HASH),
    lte: layout.e(encoding.MAX_HASH)
  });
};

MempoolCache.prototype.open = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23() {
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            if (this.db) {
              _context23.next = 2;
              break;
            }

            return _context23.abrupt('return');

          case 2:
            _context23.next = 4;
            return this.db.open();

          case 4:
            _context23.next = 6;
            return this.verify();

          case 6:

            this.batch = this.db.batch();

          case 7:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function open() {
    return _ref39.apply(this, arguments);
  }

  return open;
}();

MempoolCache.prototype.close = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24() {
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            if (this.db) {
              _context24.next = 2;
              break;
            }

            return _context24.abrupt('return');

          case 2:
            _context24.next = 4;
            return this.db.close();

          case 4:

            this.batch = null;

          case 5:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function close() {
    return _ref40.apply(this, arguments);
  }

  return close;
}();

MempoolCache.prototype.save = function save(entry) {
  if (!this.db) return;

  this.batch.put(layout.e(entry.tx.hash()), entry.toRaw());
};

MempoolCache.prototype.remove = function remove(hash) {
  if (!this.db) return;

  this.batch.del(layout.e(hash));
};

MempoolCache.prototype.sync = function sync(hash) {
  if (!this.db) return;

  this.batch.put(layout.R, Buffer.from(hash, 'hex'));
};

MempoolCache.prototype.writeFees = function writeFees(fees) {
  if (!this.db) return;

  this.batch.put(layout.F, fees.toRaw());
};

MempoolCache.prototype.clear = function clear() {
  this.batch.clear();
  this.batch = this.db.batch();
};

MempoolCache.prototype.flush = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25() {
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            if (this.db) {
              _context25.next = 2;
              break;
            }

            return _context25.abrupt('return');

          case 2:
            _context25.next = 4;
            return this.batch.write();

          case 4:

            this.batch = this.db.batch();

          case 5:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this);
  }));

  function flush() {
    return _ref41.apply(this, arguments);
  }

  return flush;
}();

MempoolCache.prototype.init = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(hash) {
    var batch;
    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            batch = this.db.batch();

            batch.put(layout.V, encoding.U32(MempoolCache.VERSION));
            batch.put(layout.R, Buffer.from(hash, 'hex'));
            _context26.next = 5;
            return batch.write();

          case 5:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this);
  }));

  function init(_x28) {
    return _ref42.apply(this, arguments);
  }

  return init;
}();

MempoolCache.prototype.verify = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27() {
    var version, tip;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            _context27.next = 2;
            return this.getVersion();

          case 2:
            version = _context27.sent;
            tip = void 0;

            if (!(version === -1)) {
              _context27.next = 10;
              break;
            }

            version = MempoolCache.VERSION;
            tip = this.chain.tip.hash;

            this.logger.info('Mempool cache is empty. Writing tip %s.', util.revHex(tip));

            _context27.next = 10;
            return this.init(tip);

          case 10:
            if (!(version !== MempoolCache.VERSION)) {
              _context27.next = 16;
              break;
            }

            this.logger.warning('Mempool cache version mismatch (%d != %d)!', version, MempoolCache.VERSION);
            this.logger.warning('Invalidating mempool cache.');
            _context27.next = 15;
            return this.wipe();

          case 15:
            return _context27.abrupt('return', false);

          case 16:
            _context27.next = 18;
            return this.getTip();

          case 18:
            tip = _context27.sent;

            if (!(tip !== this.chain.tip.hash)) {
              _context27.next = 25;
              break;
            }

            this.logger.warning('Mempool tip not consistent with chain tip (%s != %s)!', util.revHex(tip), this.chain.tip.rhash());
            this.logger.warning('Invalidating mempool cache.');
            _context27.next = 24;
            return this.wipe();

          case 24:
            return _context27.abrupt('return', false);

          case 25:
            return _context27.abrupt('return', true);

          case 26:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function verify() {
    return _ref43.apply(this, arguments);
  }

  return verify;
}();

MempoolCache.prototype.wipe = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28() {
    var batch, keys, _iteratorNormalCompletion38, _didIteratorError38, _iteratorError38, _iterator38, _step38, key;

    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            batch = this.db.batch();
            _context28.next = 3;
            return this.getKeys();

          case 3:
            keys = _context28.sent;
            _iteratorNormalCompletion38 = true;
            _didIteratorError38 = false;
            _iteratorError38 = undefined;
            _context28.prev = 7;


            for (_iterator38 = (0, _getIterator3.default)(keys); !(_iteratorNormalCompletion38 = (_step38 = _iterator38.next()).done); _iteratorNormalCompletion38 = true) {
              key = _step38.value;

              batch.del(key);
            }_context28.next = 15;
            break;

          case 11:
            _context28.prev = 11;
            _context28.t0 = _context28['catch'](7);
            _didIteratorError38 = true;
            _iteratorError38 = _context28.t0;

          case 15:
            _context28.prev = 15;
            _context28.prev = 16;

            if (!_iteratorNormalCompletion38 && _iterator38.return) {
              _iterator38.return();
            }

          case 18:
            _context28.prev = 18;

            if (!_didIteratorError38) {
              _context28.next = 21;
              break;
            }

            throw _iteratorError38;

          case 21:
            return _context28.finish(18);

          case 22:
            return _context28.finish(15);

          case 23:
            batch.put(layout.V, encoding.U32(MempoolCache.VERSION));
            batch.put(layout.R, Buffer.from(this.chain.tip.hash, 'hex'));
            batch.del(layout.F);

            _context28.next = 28;
            return batch.write();

          case 28:

            this.logger.info('Removed %d mempool entries from disk.', keys.length);

          case 29:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function wipe() {
    return _ref44.apply(this, arguments);
  }

  return wipe;
}();

/*
 * Helpers
 */

function nop(parent, child) {
  ;
}

function addFee(parent, child) {
  parent.descFee += child.deltaFee;
  parent.descSize += child.size;
}

function removeFee(parent, child) {
  parent.descFee -= child.descFee;
  parent.descSize -= child.descSize;
}

function prePrioritise(parent, child) {
  parent.descFee -= child.deltaFee;
}

function postPrioritise(parent, child) {
  parent.descFee += child.deltaFee;
}

function cmpRate(a, b) {
  var xf = a.deltaFee;
  var xs = a.size;
  var yf = b.deltaFee;
  var ys = b.size;
  var x = void 0,
      y = void 0;

  if (useDesc(a)) {
    xf = a.descFee;
    xs = a.descSize;
  }

  if (useDesc(b)) {
    yf = b.descFee;
    ys = b.descSize;
  }

  x = xf * ys;
  y = xs * yf;

  if (x === y) {
    x = a.time;
    y = b.time;
  }

  return x - y;
}

function useDesc(a) {
  var x = a.deltaFee * a.descSize;
  var y = a.descFee * a.size;
  return y > x;
}

/*
 * Expose
 */

module.exports = Mempool;