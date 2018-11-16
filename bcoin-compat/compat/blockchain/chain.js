/*!
 * chain.js - blockchain management for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _maxSafeInteger = require('babel-runtime/core-js/number/max-safe-integer');

var _maxSafeInteger2 = _interopRequireDefault(_maxSafeInteger);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

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
var Network = require('../protocol/network');
var Logger = require('../node/logger');
var ChainDB = require('./chaindb');
var common = require('./common');
var consensus = require('../protocol/consensus');
var util = require('../utils/util');
var Lock = require('../utils/lock');
var LRU = require('../utils/lru');
var ChainEntry = require('./chainentry');
var CoinView = require('../coins/coinview');
var Script = require('../script/script');

var _require = require('../protocol/errors'),
    VerifyError = _require.VerifyError;

var co = require('../utils/co');
var thresholdStates = common.thresholdStates;

/**
 * Represents a blockchain.
 * @alias module:blockchain.Chain
 * @constructor
 * @param {Object} options
 * @param {String?} options.name - Database name.
 * @param {String?} options.location - Database file location.
 * @param {String?} options.db - Database backend (`"leveldb"` by default).
 * @param {Number?} options.maxOrphans
 * @param {Boolean?} options.spv
 * @property {Boolean} loaded
 * @property {ChainDB} db - Note that Chain `options` will be passed
 * to the instantiated ChainDB.
 * @property {Lock} locker
 * @property {Object} invalid
 * @property {ChainEntry?} tip
 * @property {Number} height
 * @property {DeploymentState} state
 * @property {Object} orphan - Orphan map.
 * @emits Chain#open
 * @emits Chain#error
 * @emits Chain#block
 * @emits Chain#competitor
 * @emits Chain#resolved
 * @emits Chain#checkpoint
 * @emits Chain#fork
 * @emits Chain#reorganize
 * @emits Chain#invalid
 * @emits Chain#exists
 * @emits Chain#purge
 * @emits Chain#connect
 * @emits Chain#reconnect
 * @emits Chain#disconnect
 */

function Chain(options) {
  if (!(this instanceof Chain)) return new Chain(options);

  AsyncObject.call(this);

  this.options = new ChainOptions(options);

  this.network = this.options.network;
  this.logger = this.options.logger.context('chain');
  this.workers = this.options.workers;

  this.db = new ChainDB(this.options);

  this.locker = new Lock(true);
  this.invalid = new LRU(100);
  this.state = new DeploymentState();

  this.tip = new ChainEntry();
  this.height = -1;
  this.synced = false;

  this.orphanMap = new _map2.default();
  this.orphanPrev = new _map2.default();
}

(0, _setPrototypeOf2.default)(Chain.prototype, AsyncObject.prototype);

/**
 * Size of set to pick median time from.
 * @const {Number}
 * @default
 */

Chain.MEDIAN_TIMESPAN = 11;

/**
 * Open the chain, wait for the database to load.
 * @alias Chain#open
 * @returns {Promise}
 */

Chain.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var tip, state;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            this.logger.info('Chain is loading.');

            if (this.options.checkpoints) this.logger.info('Checkpoints are enabled.');

            if (this.options.coinCache) this.logger.info('Coin cache is enabled.');

            if (this.options.bip91) this.logger.warning('BIP91 enabled. Segsignal will be enforced.');

            if (this.options.bip148) this.logger.warning('BIP148 enabled. UASF will be enforced.');

            _context.next = 7;
            return this.db.open();

          case 7:
            _context.next = 9;
            return this.db.getTip();

          case 9:
            tip = _context.sent;


            assert(tip);

            this.tip = tip;
            this.height = tip.height;

            this.logger.info('Chain Height: %d', tip.height);

            this.logger.memory();

            _context.next = 17;
            return this.getDeploymentState();

          case 17:
            state = _context.sent;


            this.setDeploymentState(state);

            this.logger.memory();

            this.emit('tip', tip);

            this.maybeSync();

          case 22:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function _open() {
    return _ref.apply(this, arguments);
  }

  return _open;
}();

/**
 * Close the chain, wait for the database to close.
 * @alias Chain#close
 * @returns {Promise}
 */

Chain.prototype._close = function _close() {
  return this.db.close();
};

/**
 * Perform all necessary contextual verification on a block.
 * @private
 * @param {Block} block
 * @param {ChainEntry} prev
 * @param {Number} flags
 * @returns {Promise} - Returns {@link ContextResult}.
 */

Chain.prototype.verifyContext = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(block, prev, flags) {
    var state, _view, _view2, view;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.verify(block, prev, flags);

          case 2:
            state = _context2.sent;

            if (!this.options.spv) {
              _context2.next = 6;
              break;
            }

            _view = new CoinView();
            return _context2.abrupt('return', [_view, state]);

          case 6:
            if (!this.isHistorical(prev)) {
              _context2.next = 11;
              break;
            }

            _context2.next = 9;
            return this.updateInputs(block, prev);

          case 9:
            _view2 = _context2.sent;
            return _context2.abrupt('return', [_view2, state]);

          case 11:
            if (state.hasBIP34()) {
              _context2.next = 14;
              break;
            }

            _context2.next = 14;
            return this.verifyDuplicates(block, prev);

          case 14:
            _context2.next = 16;
            return this.verifyInputs(block, prev, state);

          case 16:
            view = _context2.sent;
            return _context2.abrupt('return', [view, state]);

          case 18:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function verifyContext(_x, _x2, _x3) {
    return _ref2.apply(this, arguments);
  }

  return verifyContext;
}();

/**
 * Perform all necessary contextual verification
 * on a block, without POW check.
 * @param {Block} block
 * @returns {Promise}
 */

Chain.prototype.verifyBlock = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(block) {
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
            return this._verifyBlock(block);

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

  function verifyBlock(_x4) {
    return _ref3.apply(this, arguments);
  }

  return verifyBlock;
}();

/**
 * Perform all necessary contextual verification
 * on a block, without POW check (no lock).
 * @private
 * @param {Block} block
 * @returns {Promise}
 */

Chain.prototype._verifyBlock = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(block) {
    var flags;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            flags = common.flags.DEFAULT_FLAGS & ~common.flags.VERIFY_POW;
            _context4.next = 3;
            return this.verifyContext(block, this.tip, flags);

          case 3:
            return _context4.abrupt('return', _context4.sent);

          case 4:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function _verifyBlock(_x5) {
    return _ref4.apply(this, arguments);
  }

  return _verifyBlock;
}();

/**
 * Test whether the hash is in the main chain.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.isMainHash = function isMainHash(hash) {
  return this.db.isMainHash(hash);
};

/**
 * Test whether the entry is in the main chain.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.isMainChain = function isMainChain(entry) {
  return this.db.isMainChain(entry);
};

/**
 * Get ancestor by `height`.
 * @param {ChainEntry} entry
 * @param {Number} height
 * @returns {Promise} - Returns ChainEntry.
 */

Chain.prototype.getAncestor = function getAncestor(entry, height) {
  return this.db.getAncestor(entry, height);
};

/**
 * Get previous entry.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns ChainEntry.
 */

Chain.prototype.getPrevious = function getPrevious(entry) {
  return this.db.getPrevious(entry);
};

/**
 * Get previous cached entry.
 * @param {ChainEntry} entry
 * @returns {ChainEntry|null}
 */

Chain.prototype.getPrevCache = function getPrevCache(entry) {
  return this.db.getPrevCache(entry);
};

/**
 * Get next entry.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns ChainEntry.
 */

Chain.prototype.getNext = function getNext(entry) {
  return this.db.getNext(entry);
};

/**
 * Get next entry.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns ChainEntry.
 */

Chain.prototype.getNextEntry = function getNextEntry(entry) {
  return this.db.getNextEntry(entry);
};

/**
 * Calculate median time past.
 * @param {ChainEntry} prev
 * @param {Number?} time
 * @returns {Promise} - Returns Number.
 */

Chain.prototype.getMedianTime = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(prev, time) {
    var timespan, median, entry, i, cache;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            timespan = Chain.MEDIAN_TIMESPAN;
            median = [];

            // In case we ever want to check
            // the MTP of the _current_ block
            // (necessary for BIP148).

            if (time != null) {
              median.push(time);
              timespan -= 1;
            }

            entry = prev;
            i = 0;

          case 5:
            if (!(i < timespan && entry)) {
              _context5.next = 18;
              break;
            }

            median.push(entry.time);

            cache = this.getPrevCache(entry);

            if (!cache) {
              _context5.next = 12;
              break;
            }

            entry = cache;
            _context5.next = 15;
            break;

          case 12:
            _context5.next = 14;
            return this.getPrevious(entry);

          case 14:
            entry = _context5.sent;

          case 15:
            i++;
            _context5.next = 5;
            break;

          case 18:

            median.sort(cmp);

            return _context5.abrupt('return', median[median.length >>> 1]);

          case 20:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function getMedianTime(_x6, _x7) {
    return _ref5.apply(this, arguments);
  }

  return getMedianTime;
}();

/**
 * Test whether the entry is potentially
 * an ancestor of a checkpoint.
 * @param {ChainEntry} prev
 * @returns {Boolean}
 */

Chain.prototype.isHistorical = function isHistorical(prev) {
  if (this.options.checkpoints) {
    if (prev.height + 1 <= this.network.lastCheckpoint) return true;
  }
  return false;
};

/**
 * Contextual verification for a block, including
 * version deployments (IsSuperMajority), versionbits,
 * coinbase height, finality checks.
 * @private
 * @param {Block} block
 * @param {ChainEntry} prev
 * @param {Number} flags
 * @returns {Promise} - Returns {@link DeploymentState}.
 */

Chain.prototype.verify = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(block, prev, flags) {
    var hash, _block$checkBody, _block$checkBody2, valid, reason, score, bits, mtp, height, state, segwit, time, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, tx, commit;

    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            assert(typeof flags === 'number');

            // Extra sanity check.

            if (!(block.prevBlock !== prev.hash)) {
              _context6.next = 3;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-prevblk', 0);

          case 3:

            // Verify a checkpoint if there is one.
            hash = block.hash('hex');

            if (this.verifyCheckpoint(prev, hash)) {
              _context6.next = 6;
              break;
            }

            throw new VerifyError(block, 'checkpoint', 'checkpoint mismatch', 100);

          case 6:
            if (!this.isHistorical(prev)) {
              _context6.next = 12;
              break;
            }

            if (!this.options.spv) {
              _context6.next = 9;
              break;
            }

            return _context6.abrupt('return', this.state);

          case 9:
            if (!(!block.hasWitness() && !block.getCommitmentHash())) {
              _context6.next = 11;
              break;
            }

            return _context6.abrupt('return', new DeploymentState());

          case 11:

            flags &= ~common.flags.VERIFY_BODY;

          case 12:
            if (!(flags & common.flags.VERIFY_BODY)) {
              _context6.next = 16;
              break;
            }

            _block$checkBody = block.checkBody(), _block$checkBody2 = (0, _slicedToArray3.default)(_block$checkBody, 3), valid = _block$checkBody2[0], reason = _block$checkBody2[1], score = _block$checkBody2[2];

            if (valid) {
              _context6.next = 16;
              break;
            }

            throw new VerifyError(block, 'invalid', reason, score, true);

          case 16:
            _context6.next = 18;
            return this.getTarget(block.time, prev);

          case 18:
            bits = _context6.sent;

            if (!(block.bits !== bits)) {
              _context6.next = 21;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-diffbits', 100);

          case 21:
            if (!this.options.spv) {
              _context6.next = 23;
              break;
            }

            return _context6.abrupt('return', this.state);

          case 23:
            _context6.next = 25;
            return this.getMedianTime(prev);

          case 25:
            mtp = _context6.sent;

            if (!(block.time <= mtp)) {
              _context6.next = 28;
              break;
            }

            throw new VerifyError(block, 'invalid', 'time-too-old', 0);

          case 28:
            if (!(block.time > this.network.now() + 2 * 60 * 60)) {
              _context6.next = 30;
              break;
            }

            throw new VerifyError(block, 'invalid', 'time-too-new', 0, true);

          case 30:

            // Calculate height of current block.
            height = prev.height + 1;

            // Only allow version 2 blocks (coinbase height)
            // once the majority of blocks are using it.

            if (!(block.version < 2 && height >= this.network.block.bip34height)) {
              _context6.next = 33;
              break;
            }

            throw new VerifyError(block, 'obsolete', 'bad-version', 0);

          case 33:
            if (!(block.version < 3 && height >= this.network.block.bip66height)) {
              _context6.next = 35;
              break;
            }

            throw new VerifyError(block, 'obsolete', 'bad-version', 0);

          case 35:
            if (!(block.version < 4 && height >= this.network.block.bip65height)) {
              _context6.next = 37;
              break;
            }

            throw new VerifyError(block, 'obsolete', 'bad-version', 0);

          case 37:
            _context6.next = 39;
            return this.getDeployments(block.time, prev);

          case 39:
            state = _context6.sent;

            if (!(state.hasBIP91() || state.hasBIP148())) {
              _context6.next = 44;
              break;
            }

            segwit = this.network.deployments.segwit;

            if (consensus.hasBit(block.version, segwit.bit)) {
              _context6.next = 44;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-no-segwit', 0);

          case 44:

            // Get timestamp for tx.isFinal().
            time = state.hasMTP() ? mtp : block.time;

            // Transactions must be finalized with
            // regards to nSequence and nLockTime.

            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context6.prev = 48;
            _iterator = (0, _getIterator3.default)(block.txs);

          case 50:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context6.next = 57;
              break;
            }

            tx = _step.value;

            if (tx.isFinal(height, time)) {
              _context6.next = 54;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-txns-nonfinal', 10);

          case 54:
            _iteratorNormalCompletion = true;
            _context6.next = 50;
            break;

          case 57:
            _context6.next = 63;
            break;

          case 59:
            _context6.prev = 59;
            _context6.t0 = _context6['catch'](48);
            _didIteratorError = true;
            _iteratorError = _context6.t0;

          case 63:
            _context6.prev = 63;
            _context6.prev = 64;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 66:
            _context6.prev = 66;

            if (!_didIteratorError) {
              _context6.next = 69;
              break;
            }

            throw _iteratorError;

          case 69:
            return _context6.finish(66);

          case 70:
            return _context6.finish(63);

          case 71:
            if (!state.hasBIP34()) {
              _context6.next = 74;
              break;
            }

            if (!(block.getCoinbaseHeight() !== height)) {
              _context6.next = 74;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-cb-height', 100);

          case 74:

            // Check the commitment hash for segwit.
            commit = null;

            if (!state.hasWitness()) {
              _context6.next = 82;
              break;
            }

            commit = block.getCommitmentHash();

            if (!commit) {
              _context6.next = 82;
              break;
            }

            if (block.getWitnessNonce()) {
              _context6.next = 80;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-witness-nonce-size', 100, true);

          case 80:
            if (commit.equals(block.createCommitmentHash())) {
              _context6.next = 82;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-witness-merkle-match', 100, true);

          case 82:
            if (commit) {
              _context6.next = 85;
              break;
            }

            if (!block.hasWitness()) {
              _context6.next = 85;
              break;
            }

            throw new VerifyError(block, 'invalid', 'unexpected-witness', 100, true);

          case 85:
            if (!(block.getWeight() > consensus.MAX_BLOCK_WEIGHT)) {
              _context6.next = 87;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-blk-weight', 100);

          case 87:
            return _context6.abrupt('return', state);

          case 88:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[48, 59, 63, 71], [64,, 66, 70]]);
  }));

  function verify(_x8, _x9, _x10) {
    return _ref6.apply(this, arguments);
  }

  return verify;
}();

/**
 * Check all deployments on a chain, ranging from p2sh to segwit.
 * @param {Number} time
 * @param {ChainEntry} prev
 * @returns {Promise} - Returns {@link DeploymentState}.
 */

Chain.prototype.getDeployments = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(time, prev) {
    var deployments, height, state, witness, mtp;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            deployments = this.network.deployments;
            height = prev.height + 1;
            state = new DeploymentState();

            // For some reason bitcoind has p2sh in the
            // mandatory flags by default, when in reality
            // it wasn't activated until march 30th 2012.
            // The first p2sh output and redeem script
            // appeared on march 7th 2012, only it did
            // not have a signature. See:
            // 6a26d2ecb67f27d1fa5524763b49029d7106e91e3cc05743073461a719776192
            // 9c08a4d78931342b37fd5f72900fb9983087e6f46c4a097d8a1f52c74e28eaf6

            if (time >= consensus.BIP16_TIME) state.flags |= Script.flags.VERIFY_P2SH;

            // Coinbase heights are now enforced (bip34).
            if (height >= this.network.block.bip34height) state.bip34 = true;

            // Signature validation is now enforced (bip66).
            if (height >= this.network.block.bip66height) state.flags |= Script.flags.VERIFY_DERSIG;

            // CHECKLOCKTIMEVERIFY is now usable (bip65).
            if (height >= this.network.block.bip65height) state.flags |= Script.flags.VERIFY_CHECKLOCKTIMEVERIFY;

            // CHECKSEQUENCEVERIFY and median time
            // past locktimes are now usable (bip9 & bip113).
            _context7.next = 9;
            return this.isActive(prev, deployments.csv);

          case 9:
            if (!_context7.sent) {
              _context7.next = 13;
              break;
            }

            state.flags |= Script.flags.VERIFY_CHECKSEQUENCEVERIFY;
            state.lockFlags |= common.lockFlags.VERIFY_SEQUENCE;
            state.lockFlags |= common.lockFlags.MEDIAN_TIME_PAST;

          case 13:
            _context7.next = 15;
            return this.getState(prev, deployments.segwit);

          case 15:
            witness = _context7.sent;


            // Segregrated witness (bip141) is now usable
            // along with SCRIPT_VERIFY_NULLDUMMY (bip147).
            if (witness === thresholdStates.ACTIVE) {
              state.flags |= Script.flags.VERIFY_WITNESS;
              state.flags |= Script.flags.VERIFY_NULLDUMMY;
            }

            // Segsignal is now enforced (bip91).

            if (!this.options.bip91) {
              _context7.next = 23;
              break;
            }

            if (!(witness === thresholdStates.STARTED)) {
              _context7.next = 23;
              break;
            }

            _context7.next = 21;
            return this.isActive(prev, deployments.segsignal);

          case 21:
            if (!_context7.sent) {
              _context7.next = 23;
              break;
            }

            state.bip91 = true;

          case 23:
            if (!(this.options.bip148 && this.network === Network.main)) {
              _context7.next = 29;
              break;
            }

            if (!(witness !== thresholdStates.LOCKED_IN && witness !== thresholdStates.ACTIVE)) {
              _context7.next = 29;
              break;
            }

            _context7.next = 27;
            return this.getMedianTime(prev, time);

          case 27:
            mtp = _context7.sent;

            if (mtp >= 1501545600 && mtp <= 1510704000) state.bip148 = true;

          case 29:
            return _context7.abrupt('return', state);

          case 30:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function getDeployments(_x11, _x12) {
    return _ref7.apply(this, arguments);
  }

  return getDeployments;
}();

/**
 * Set a new deployment state.
 * @param {DeploymentState} state
 */

Chain.prototype.setDeploymentState = function setDeploymentState(state) {
  if (this.options.checkpoints && this.height < this.network.lastCheckpoint) {
    this.state = state;
    return;
  }

  if (!this.state.hasP2SH() && state.hasP2SH()) this.logger.warning('P2SH has been activated.');

  if (!this.state.hasBIP34() && state.hasBIP34()) this.logger.warning('BIP34 has been activated.');

  if (!this.state.hasBIP66() && state.hasBIP66()) this.logger.warning('BIP66 has been activated.');

  if (!this.state.hasCLTV() && state.hasCLTV()) this.logger.warning('BIP65 has been activated.');

  if (!this.state.hasCSV() && state.hasCSV()) this.logger.warning('CSV has been activated.');

  if (!this.state.hasWitness() && state.hasWitness()) this.logger.warning('Segwit has been activated.');

  if (!this.state.hasBIP91() && state.hasBIP91()) this.logger.warning('BIP91 has been activated.');

  if (!this.state.hasBIP148() && state.hasBIP148()) this.logger.warning('BIP148 has been activated.');

  this.state = state;
};

/**
 * Determine whether to check block for duplicate txids in blockchain
 * history (BIP30). If we're on a chain that has bip34 activated, we
 * can skip this.
 * @private
 * @see https://github.com/bitcoin/bips/blob/master/bip-0030.mediawiki
 * @param {Block} block
 * @param {ChainEntry} prev
 * @returns {Promise}
 */

Chain.prototype.verifyDuplicates = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(block, prev) {
    var _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, tx, height, hash;

    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context8.prev = 3;
            _iterator2 = (0, _getIterator3.default)(block.txs);

          case 5:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context8.next = 18;
              break;
            }

            tx = _step2.value;
            _context8.next = 9;
            return this.hasCoins(tx);

          case 9:
            if (_context8.sent) {
              _context8.next = 11;
              break;
            }

            return _context8.abrupt('continue', 15);

          case 11:
            height = prev.height + 1;
            hash = this.network.bip30[height];

            // Blocks 91842 and 91880 created duplicate
            // txids by using the same exact output script
            // and extraNonce.

            if (!(!hash || block.hash('hex') !== hash)) {
              _context8.next = 15;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-txns-BIP30', 100);

          case 15:
            _iteratorNormalCompletion2 = true;
            _context8.next = 5;
            break;

          case 18:
            _context8.next = 24;
            break;

          case 20:
            _context8.prev = 20;
            _context8.t0 = _context8['catch'](3);
            _didIteratorError2 = true;
            _iteratorError2 = _context8.t0;

          case 24:
            _context8.prev = 24;
            _context8.prev = 25;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 27:
            _context8.prev = 27;

            if (!_didIteratorError2) {
              _context8.next = 30;
              break;
            }

            throw _iteratorError2;

          case 30:
            return _context8.finish(27);

          case 31:
            return _context8.finish(24);

          case 32:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this, [[3, 20, 24, 32], [25,, 27, 31]]);
  }));

  function verifyDuplicates(_x13, _x14) {
    return _ref8.apply(this, arguments);
  }

  return verifyDuplicates;
}();

/**
 * Spend and update inputs (checkpoints only).
 * @private
 * @param {Block} block
 * @param {ChainEntry} prev
 * @returns {Promise} - Returns {@link CoinView}.
 */

Chain.prototype.updateInputs = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(block, prev) {
    var view, height, cb, i, tx;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            view = new CoinView();
            height = prev.height + 1;
            cb = block.txs[0];


            view.addTX(cb, height);

            i = 1;

          case 5:
            if (!(i < block.txs.length)) {
              _context9.next = 16;
              break;
            }

            tx = block.txs[i];
            _context9.t0 = assert;
            _context9.next = 10;
            return view.spendInputs(this.db, tx);

          case 10:
            _context9.t1 = _context9.sent;
            (0, _context9.t0)(_context9.t1, 'BUG: Spent inputs in historical data!');


            view.addTX(tx, height);

          case 13:
            i++;
            _context9.next = 5;
            break;

          case 16:
            return _context9.abrupt('return', view);

          case 17:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function updateInputs(_x15, _x16) {
    return _ref9.apply(this, arguments);
  }

  return updateInputs;
}();

/**
 * Check block transactions for all things pertaining
 * to inputs. This function is important because it is
 * what actually fills the coins into the block. This
 * function will check the block reward, the sigops,
 * the tx values, and execute and verify the scripts (it
 * will attempt to do this on the worker pool). If
 * `checkpoints` is enabled, it will skip verification
 * for historical data.
 * @private
 * @see TX#verifyInputs
 * @see TX#verify
 * @param {Block} block
 * @param {ChainEntry} prev
 * @param {DeploymentState} state
 * @returns {Promise} - Returns {@link CoinView}.
 */

Chain.prototype.verifyInputs = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(block, prev, state) {
    var view, height, interval, sigops, reward, i, tx, valid, _tx$checkInputs, _tx$checkInputs2, fee, reason, score, jobs, _i, _tx;

    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            view = new CoinView();
            height = prev.height + 1;
            interval = this.network.halvingInterval;
            sigops = 0;
            reward = 0;

            // Check all transactions

            i = 0;

          case 6:
            if (!(i < block.txs.length)) {
              _context10.next = 33;
              break;
            }

            tx = block.txs[i];

            // Ensure tx is not double spending an output.

            if (!(i > 0)) {
              _context10.next = 13;
              break;
            }

            _context10.next = 11;
            return view.spendInputs(this.db, tx);

          case 11:
            if (_context10.sent) {
              _context10.next = 13;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-txns-inputs-missingorspent', 100);

          case 13:
            if (!(i > 0 && tx.version >= 2)) {
              _context10.next = 19;
              break;
            }

            _context10.next = 16;
            return this.verifyLocks(prev, tx, view, state.lockFlags);

          case 16:
            valid = _context10.sent;

            if (valid) {
              _context10.next = 19;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-txns-nonfinal', 100);

          case 19:

            // Count sigops (legacy + scripthash? + witness?)
            sigops += tx.getSigopsCost(view, state.flags);

            if (!(sigops > consensus.MAX_BLOCK_SIGOPS_COST)) {
              _context10.next = 22;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-blk-sigops', 100);

          case 22:
            if (!(i > 0)) {
              _context10.next = 29;
              break;
            }

            _tx$checkInputs = tx.checkInputs(view, height), _tx$checkInputs2 = (0, _slicedToArray3.default)(_tx$checkInputs, 3), fee = _tx$checkInputs2[0], reason = _tx$checkInputs2[1], score = _tx$checkInputs2[2];

            if (!(fee === -1)) {
              _context10.next = 26;
              break;
            }

            throw new VerifyError(block, 'invalid', reason, score);

          case 26:

            reward += fee;

            if (!(reward > consensus.MAX_MONEY)) {
              _context10.next = 29;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-cb-amount', 100);

          case 29:

            // Add new coins.
            view.addTX(tx, height);

          case 30:
            i++;
            _context10.next = 6;
            break;

          case 33:

            // Make sure the miner isn't trying to conjure more coins.
            reward += consensus.getReward(height, interval);

            if (!(block.getClaimed() > reward)) {
              _context10.next = 36;
              break;
            }

            throw new VerifyError(block, 'invalid', 'bad-cb-amount', 100);

          case 36:

            // Push onto verification queue.
            jobs = [];

            for (_i = 1; _i < block.txs.length; _i++) {
              _tx = block.txs[_i];

              jobs.push(_tx.verifyAsync(view, state.flags, this.workers));
            }

            // Verify all txs in parallel.
            _context10.next = 40;
            return co.every(jobs);

          case 40:
            if (_context10.sent) {
              _context10.next = 42;
              break;
            }

            throw new VerifyError(block, 'invalid', 'mandatory-script-verify-flag-failed', 100);

          case 42:
            return _context10.abrupt('return', view);

          case 43:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function verifyInputs(_x17, _x18, _x19) {
    return _ref10.apply(this, arguments);
  }

  return verifyInputs;
}();

/**
 * Find the block at which a fork ocurred.
 * @private
 * @param {ChainEntry} fork - The current chain.
 * @param {ChainEntry} longer - The competing chain.
 * @returns {Promise}
 */

Chain.prototype.findFork = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(fork, longer) {
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            if (!(fork.hash !== longer.hash)) {
              _context11.next = 18;
              break;
            }

          case 1:
            if (!(longer.height > fork.height)) {
              _context11.next = 9;
              break;
            }

            _context11.next = 4;
            return this.getPrevious(longer);

          case 4:
            longer = _context11.sent;

            if (longer) {
              _context11.next = 7;
              break;
            }

            throw new Error('No previous entry for new tip.');

          case 7:
            _context11.next = 1;
            break;

          case 9:
            if (!(fork.hash === longer.hash)) {
              _context11.next = 11;
              break;
            }

            return _context11.abrupt('return', fork);

          case 11:
            _context11.next = 13;
            return this.getPrevious(fork);

          case 13:
            fork = _context11.sent;

            if (fork) {
              _context11.next = 16;
              break;
            }

            throw new Error('No previous entry for old tip.');

          case 16:
            _context11.next = 0;
            break;

          case 18:
            return _context11.abrupt('return', fork);

          case 19:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function findFork(_x20, _x21) {
    return _ref11.apply(this, arguments);
  }

  return findFork;
}();

/**
 * Reorganize the blockchain (connect and disconnect inputs).
 * Called when a competing chain with a higher chainwork
 * is received.
 * @private
 * @param {ChainEntry} competitor - The competing chain's tip.
 * @returns {Promise}
 */

Chain.prototype.reorganize = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(competitor) {
    var tip, fork, disconnect, entry, connect, i, _entry, _i2, _entry2;

    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            tip = this.tip;
            _context12.next = 3;
            return this.findFork(tip, competitor);

          case 3:
            fork = _context12.sent;


            assert(fork, 'No free space or data corruption.');

            // Blocks to disconnect.
            disconnect = [];
            entry = tip;

          case 7:
            if (!(entry.hash !== fork.hash)) {
              _context12.next = 15;
              break;
            }

            disconnect.push(entry);
            _context12.next = 11;
            return this.getPrevious(entry);

          case 11:
            entry = _context12.sent;

            assert(entry);
            _context12.next = 7;
            break;

          case 15:

            // Blocks to connect.
            connect = [];

            entry = competitor;

          case 17:
            if (!(entry.hash !== fork.hash)) {
              _context12.next = 25;
              break;
            }

            connect.push(entry);
            _context12.next = 21;
            return this.getPrevious(entry);

          case 21:
            entry = _context12.sent;

            assert(entry);
            _context12.next = 17;
            break;

          case 25:
            i = 0;

          case 26:
            if (!(i < disconnect.length)) {
              _context12.next = 33;
              break;
            }

            _entry = disconnect[i];
            _context12.next = 30;
            return this.disconnect(_entry);

          case 30:
            i++;
            _context12.next = 26;
            break;

          case 33:
            _i2 = connect.length - 1;

          case 34:
            if (!(_i2 >= 1)) {
              _context12.next = 41;
              break;
            }

            _entry2 = connect[_i2];
            _context12.next = 38;
            return this.reconnect(_entry2);

          case 38:
            _i2--;
            _context12.next = 34;
            break;

          case 41:

            this.logger.warning('Chain reorganization: old=%s(%d) new=%s(%d)', tip.rhash(), tip.height, competitor.rhash(), competitor.height);

            _context12.next = 44;
            return this.fire('reorganize', tip, competitor);

          case 44:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function reorganize(_x22) {
    return _ref12.apply(this, arguments);
  }

  return reorganize;
}();

/**
 * Reorganize the blockchain for SPV. This
 * will reset the chain to the fork block.
 * @private
 * @param {ChainEntry} competitor - The competing chain's tip.
 * @returns {Promise}
 */

Chain.prototype.reorganizeSPV = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(competitor) {
    var tip, fork, disconnect, entry, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _entry3, headers, view;

    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            tip = this.tip;
            _context13.next = 3;
            return this.findFork(tip, competitor);

          case 3:
            fork = _context13.sent;


            assert(fork, 'No free space or data corruption.');

            // Buffer disconnected blocks.
            disconnect = [];
            entry = tip;

          case 7:
            if (!(entry.hash !== fork.hash)) {
              _context13.next = 15;
              break;
            }

            disconnect.push(entry);
            _context13.next = 11;
            return this.getPrevious(entry);

          case 11:
            entry = _context13.sent;

            assert(entry);
            _context13.next = 7;
            break;

          case 15:
            _context13.next = 17;
            return this._reset(fork.hash, true);

          case 17:

            // Emit disconnection events now that
            // the chain has successfully reset.
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context13.prev = 20;
            _iterator3 = (0, _getIterator3.default)(disconnect);

          case 22:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context13.next = 31;
              break;
            }

            _entry3 = _step3.value;
            headers = _entry3.toHeaders();
            view = new CoinView();
            _context13.next = 28;
            return this.fire('disconnect', _entry3, headers, view);

          case 28:
            _iteratorNormalCompletion3 = true;
            _context13.next = 22;
            break;

          case 31:
            _context13.next = 37;
            break;

          case 33:
            _context13.prev = 33;
            _context13.t0 = _context13['catch'](20);
            _didIteratorError3 = true;
            _iteratorError3 = _context13.t0;

          case 37:
            _context13.prev = 37;
            _context13.prev = 38;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 40:
            _context13.prev = 40;

            if (!_didIteratorError3) {
              _context13.next = 43;
              break;
            }

            throw _iteratorError3;

          case 43:
            return _context13.finish(40);

          case 44:
            return _context13.finish(37);

          case 45:

            this.logger.warning('SPV reorganization: old=%s(%d) new=%s(%d)', tip.rhash(), tip.height, competitor.rhash(), competitor.height);

            this.logger.warning('Chain replay from height %d necessary.', fork.height);

            _context13.next = 49;
            return this.fire('reorganize', tip, competitor);

          case 49:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this, [[20, 33, 37, 45], [38,, 40, 44]]);
  }));

  function reorganizeSPV(_x23) {
    return _ref13.apply(this, arguments);
  }

  return reorganizeSPV;
}();

/**
 * Disconnect an entry from the chain (updates the tip).
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

Chain.prototype.disconnect = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(entry) {
    var block, prev, view;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            _context14.next = 2;
            return this.getBlock(entry.hash);

          case 2:
            block = _context14.sent;

            if (block) {
              _context14.next = 7;
              break;
            }

            if (this.options.spv) {
              _context14.next = 6;
              break;
            }

            throw new Error('Block not found.');

          case 6:
            block = entry.toHeaders();

          case 7:
            _context14.next = 9;
            return this.getPrevious(entry);

          case 9:
            prev = _context14.sent;
            _context14.next = 12;
            return this.db.disconnect(entry, block);

          case 12:
            view = _context14.sent;


            assert(prev);

            this.tip = prev;
            this.height = prev.height;

            this.emit('tip', prev);

            _context14.next = 19;
            return this.fire('disconnect', entry, block, view);

          case 19:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function disconnect(_x24) {
    return _ref14.apply(this, arguments);
  }

  return disconnect;
}();

/**
 * Reconnect an entry to the chain (updates the tip).
 * This will do contextual-verification on the block
 * (necessary because we cannot validate the inputs
 * in alternate chains when they come in).
 * @param {ChainEntry} entry
 * @param {Number} flags
 * @returns {Promise}
 */

Chain.prototype.reconnect = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(entry) {
    var flags, block, prev, view, state, _ref16, _ref17;

    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            flags = common.flags.VERIFY_NONE;
            _context15.next = 3;
            return this.getBlock(entry.hash);

          case 3:
            block = _context15.sent;

            if (block) {
              _context15.next = 8;
              break;
            }

            if (this.options.spv) {
              _context15.next = 7;
              break;
            }

            throw new Error('Block not found.');

          case 7:
            block = entry.toHeaders();

          case 8:
            _context15.next = 10;
            return this.getPrevious(entry);

          case 10:
            prev = _context15.sent;

            assert(prev);

            view = void 0, state = void 0;
            _context15.prev = 13;
            _context15.next = 16;
            return this.verifyContext(block, prev, flags);

          case 16:
            _ref16 = _context15.sent;
            _ref17 = (0, _slicedToArray3.default)(_ref16, 2);
            view = _ref17[0];
            state = _ref17[1];
            _context15.next = 26;
            break;

          case 22:
            _context15.prev = 22;
            _context15.t0 = _context15['catch'](13);

            if (_context15.t0.type === 'VerifyError') {
              if (!_context15.t0.malleated) this.setInvalid(entry.hash);
              this.logger.warning('Tried to reconnect invalid block: %s (%d).', entry.rhash(), entry.height);
            }
            throw _context15.t0;

          case 26:
            _context15.next = 28;
            return this.db.reconnect(entry, block, view);

          case 28:

            this.tip = entry;
            this.height = entry.height;
            this.setDeploymentState(state);

            this.emit('tip', entry);
            this.emit('reconnect', entry, block);

            _context15.next = 35;
            return this.fire('connect', entry, block, view);

          case 35:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this, [[13, 22]]);
  }));

  function reconnect(_x25) {
    return _ref15.apply(this, arguments);
  }

  return reconnect;
}();

/**
 * Set the best chain. This is called on every valid block
 * that comes in. It may add and connect the block (main chain),
 * save the block without connection (alternate chain), or
 * reorganize the chain (a higher fork).
 * @private
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {ChainEntry} prev
 * @param {Number} flags
 * @returns {Promise}
 */

Chain.prototype.setBestChain = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(entry, block, prev, flags) {
    var view, state, _ref19, _ref20;

    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            if (!(entry.prevBlock !== this.tip.hash)) {
              _context16.next = 8;
              break;
            }

            this.logger.warning('WARNING: Reorganizing chain.');

            // In spv-mode, we reset the
            // chain and redownload the blocks.

            if (!this.options.spv) {
              _context16.next = 6;
              break;
            }

            _context16.next = 5;
            return this.reorganizeSPV(entry);

          case 5:
            return _context16.abrupt('return');

          case 6:
            _context16.next = 8;
            return this.reorganize(entry);

          case 8:

            // Warn of unknown versionbits.
            if (entry.hasUnknown(this.network)) {
              this.logger.warning('Unknown version bits in block %d: %s.', entry.height, util.hex32(entry.version));
            }

            // Otherwise, everything is in order.
            // Do "contextual" verification on our block
            // now that we're certain its previous
            // block is in the chain.
            view = void 0, state = void 0;
            _context16.prev = 10;
            _context16.next = 13;
            return this.verifyContext(block, prev, flags);

          case 13:
            _ref19 = _context16.sent;
            _ref20 = (0, _slicedToArray3.default)(_ref19, 2);
            view = _ref20[0];
            state = _ref20[1];
            _context16.next = 23;
            break;

          case 19:
            _context16.prev = 19;
            _context16.t0 = _context16['catch'](10);

            if (_context16.t0.type === 'VerifyError') {
              if (!_context16.t0.malleated) this.setInvalid(entry.hash);
              this.logger.warning('Tried to connect invalid block: %s (%d).', entry.rhash(), entry.height);
            }
            throw _context16.t0;

          case 23:
            _context16.next = 25;
            return this.db.save(entry, block, view);

          case 25:

            // Expose the new state.
            this.tip = entry;
            this.height = entry.height;
            this.setDeploymentState(state);

            this.emit('tip', entry);
            this.emit('block', block, entry);

            _context16.next = 32;
            return this.fire('connect', entry, block, view);

          case 32:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this, [[10, 19]]);
  }));

  function setBestChain(_x26, _x27, _x28, _x29) {
    return _ref18.apply(this, arguments);
  }

  return setBestChain;
}();

/**
 * Save block on an alternate chain.
 * @private
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {ChainEntry} prev
 * @param {Number} flags
 * @returns {Promise}
 */

Chain.prototype.saveAlternate = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(entry, block, prev, flags) {
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            _context17.prev = 0;
            _context17.next = 3;
            return this.verify(block, prev, flags);

          case 3:
            _context17.next = 9;
            break;

          case 5:
            _context17.prev = 5;
            _context17.t0 = _context17['catch'](0);

            if (_context17.t0.type === 'VerifyError') {
              if (!_context17.t0.malleated) this.setInvalid(entry.hash);
              this.logger.warning('Invalid block on alternate chain: %s (%d).', entry.rhash(), entry.height);
            }
            throw _context17.t0;

          case 9:

            // Warn of unknown versionbits.
            if (entry.hasUnknown(this.network)) {
              this.logger.warning('Unknown version bits in block %d: %s.', entry.height, util.hex32(entry.version));
            }

            _context17.next = 12;
            return this.db.save(entry, block);

          case 12:

            this.logger.warning('Heads up: Competing chain at height %d:' + ' tip-height=%d competitor-height=%d' + ' tip-hash=%s competitor-hash=%s' + ' tip-chainwork=%s competitor-chainwork=%s' + ' chainwork-diff=%s', entry.height, this.tip.height, entry.height, this.tip.rhash(), entry.rhash(), this.tip.chainwork.toString(), entry.chainwork.toString(), this.tip.chainwork.sub(entry.chainwork).toString());

            // Emit as a "competitor" block.
            this.emit('competitor', block, entry);

          case 14:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this, [[0, 5]]);
  }));

  function saveAlternate(_x30, _x31, _x32, _x33) {
    return _ref21.apply(this, arguments);
  }

  return saveAlternate;
}();

/**
 * Reset the chain to the desired block. This
 * is useful for replaying the blockchain download
 * for SPV.
 * @param {Hash|Number} block
 * @returns {Promise}
 */

Chain.prototype.reset = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(block) {
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
            return this._reset(block, false);

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

  function reset(_x34) {
    return _ref22.apply(this, arguments);
  }

  return reset;
}();

/**
 * Reset the chain to the desired block without a lock.
 * @private
 * @param {Hash|Number} block
 * @returns {Promise}
 */

Chain.prototype._reset = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(block, silent) {
    var tip, state;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            _context19.next = 2;
            return this.db.reset(block);

          case 2:
            tip = _context19.sent;


            // Reset state.
            this.tip = tip;
            this.height = tip.height;
            this.synced = false;

            _context19.next = 8;
            return this.getDeploymentState();

          case 8:
            state = _context19.sent;


            this.setDeploymentState(state);

            this.emit('tip', tip);

            if (silent) {
              _context19.next = 14;
              break;
            }

            _context19.next = 14;
            return this.fire('reset', tip);

          case 14:

            // Reset the orphan map completely. There may
            // have been some orphans on a forked chain we
            // no longer need.
            this.purgeOrphans();

            this.maybeSync();

          case 16:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this);
  }));

  function _reset(_x35, _x36) {
    return _ref23.apply(this, arguments);
  }

  return _reset;
}();

/**
 * Reset the chain to a height or hash. Useful for replaying
 * the blockchain download for SPV.
 * @param {Hash|Number} block - hash/height
 * @returns {Promise}
 */

Chain.prototype.replay = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(block) {
    var unlock;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            _context20.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context20.sent;
            _context20.prev = 3;
            _context20.next = 6;
            return this._replay(block, true);

          case 6:
            return _context20.abrupt('return', _context20.sent);

          case 7:
            _context20.prev = 7;

            unlock();
            return _context20.finish(7);

          case 10:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this, [[3,, 7, 10]]);
  }));

  function replay(_x37) {
    return _ref24.apply(this, arguments);
  }

  return replay;
}();

/**
 * Reset the chain without a lock.
 * @private
 * @param {Hash|Number} block - hash/height
 * @param {Boolean?} silent
 * @returns {Promise}
 */

Chain.prototype._replay = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(block, silent) {
    var entry;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            _context21.next = 2;
            return this.getEntry(block);

          case 2:
            entry = _context21.sent;

            if (entry) {
              _context21.next = 5;
              break;
            }

            throw new Error('Block not found.');

          case 5:
            _context21.next = 7;
            return this.isMainChain(entry);

          case 7:
            if (_context21.sent) {
              _context21.next = 9;
              break;
            }

            throw new Error('Cannot reset on alternate chain.');

          case 9:
            if (!entry.isGenesis()) {
              _context21.next = 13;
              break;
            }

            _context21.next = 12;
            return this._reset(entry.hash, silent);

          case 12:
            return _context21.abrupt('return');

          case 13:
            _context21.next = 15;
            return this._reset(entry.prevBlock, silent);

          case 15:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function _replay(_x38, _x39) {
    return _ref25.apply(this, arguments);
  }

  return _replay;
}();

/**
 * Invalidate block.
 * @param {Hash} hash
 * @returns {Promise}
 */

Chain.prototype.invalidate = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(hash) {
    var unlock;
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            _context22.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context22.sent;
            _context22.prev = 3;
            _context22.next = 6;
            return this._invalidate(hash);

          case 6:
            return _context22.abrupt('return', _context22.sent);

          case 7:
            _context22.prev = 7;

            unlock();
            return _context22.finish(7);

          case 10:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this, [[3,, 7, 10]]);
  }));

  function invalidate(_x40) {
    return _ref26.apply(this, arguments);
  }

  return invalidate;
}();

/**
 * Invalidate block (no lock).
 * @param {Hash} hash
 * @returns {Promise}
 */

Chain.prototype._invalidate = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(hash) {
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            _context23.next = 2;
            return this._replay(hash, false);

          case 2:
            this.setInvalid(hash);

          case 3:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function _invalidate(_x41) {
    return _ref27.apply(this, arguments);
  }

  return _invalidate;
}();

/**
 * Retroactively prune the database.
 * @returns {Promise}
 */

Chain.prototype.prune = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24() {
    var unlock;
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            _context24.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context24.sent;
            _context24.prev = 3;
            _context24.next = 6;
            return this.db.prune();

          case 6:
            return _context24.abrupt('return', _context24.sent);

          case 7:
            _context24.prev = 7;

            unlock();
            return _context24.finish(7);

          case 10:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this, [[3,, 7, 10]]);
  }));

  function prune() {
    return _ref28.apply(this, arguments);
  }

  return prune;
}();

/**
 * Scan the blockchain for transactions containing specified address hashes.
 * @param {Hash} start - Block hash to start at.
 * @param {Bloom} filter - Bloom filter containing tx and address hashes.
 * @param {Function} iter - Iterator.
 * @returns {Promise}
 */

Chain.prototype.scan = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(start, filter, iter) {
    var unlock;
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            _context25.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context25.sent;
            _context25.prev = 3;
            _context25.next = 6;
            return this.db.scan(start, filter, iter);

          case 6:
            return _context25.abrupt('return', _context25.sent);

          case 7:
            _context25.prev = 7;

            unlock();
            return _context25.finish(7);

          case 10:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this, [[3,, 7, 10]]);
  }));

  function scan(_x42, _x43, _x44) {
    return _ref29.apply(this, arguments);
  }

  return scan;
}();

/**
 * Add a block to the chain, perform all necessary verification.
 * @param {Block} block
 * @param {Number?} flags
 * @param {Number?} id
 * @returns {Promise}
 */

Chain.prototype.add = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(block, flags, id) {
    var hash, unlock;
    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            hash = block.hash('hex');
            _context26.next = 3;
            return this.locker.lock(hash);

          case 3:
            unlock = _context26.sent;
            _context26.prev = 4;
            _context26.next = 7;
            return this._add(block, flags, id);

          case 7:
            return _context26.abrupt('return', _context26.sent);

          case 8:
            _context26.prev = 8;

            unlock();
            return _context26.finish(8);

          case 11:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this, [[4,, 8, 11]]);
  }));

  function add(_x45, _x46, _x47) {
    return _ref30.apply(this, arguments);
  }

  return add;
}();

/**
 * Add a block to the chain without a lock.
 * @private
 * @param {Block} block
 * @param {Number?} flags
 * @param {Number?} id
 * @returns {Promise}
 */

Chain.prototype._add = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(block, flags, id) {
    var hash, prev, entry;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            hash = block.hash('hex');


            if (flags == null) flags = common.flags.DEFAULT_FLAGS;

            if (id == null) id = -1;

            // Special case for genesis block.

            if (!(hash === this.network.genesis.hash)) {
              _context27.next = 6;
              break;
            }

            this.logger.debug('Saw genesis block: %s.', block.rhash());
            throw new VerifyError(block, 'duplicate', 'duplicate', 0);

          case 6:
            if (!this.hasPending(hash)) {
              _context27.next = 9;
              break;
            }

            this.logger.debug('Already have pending block: %s.', block.rhash());
            throw new VerifyError(block, 'duplicate', 'duplicate', 0);

          case 9:
            if (!this.hasOrphan(hash)) {
              _context27.next = 12;
              break;
            }

            this.logger.debug('Already have orphan block: %s.', block.rhash());
            throw new VerifyError(block, 'duplicate', 'duplicate', 0);

          case 12:
            if (!this.hasInvalid(block)) {
              _context27.next = 15;
              break;
            }

            this.logger.debug('Invalid ancestors for block: %s.', block.rhash());
            throw new VerifyError(block, 'duplicate', 'duplicate', 100);

          case 15:
            if (!(flags & common.flags.VERIFY_POW)) {
              _context27.next = 18;
              break;
            }

            if (block.verifyPOW()) {
              _context27.next = 18;
              break;
            }

            throw new VerifyError(block, 'invalid', 'high-hash', 50);

          case 18:
            _context27.next = 20;
            return this.hasEntry(hash);

          case 20:
            if (!_context27.sent) {
              _context27.next = 23;
              break;
            }

            this.logger.debug('Already have block: %s.', block.rhash());
            throw new VerifyError(block, 'duplicate', 'duplicate', 0);

          case 23:
            _context27.next = 25;
            return this.getEntry(block.prevBlock);

          case 25:
            prev = _context27.sent;

            if (prev) {
              _context27.next = 29;
              break;
            }

            this.storeOrphan(block, flags, id);
            return _context27.abrupt('return', null);

          case 29:
            _context27.next = 31;
            return this.connect(prev, block, flags);

          case 31:
            entry = _context27.sent;

            if (!this.hasNextOrphan(hash)) {
              _context27.next = 35;
              break;
            }

            _context27.next = 35;
            return this.handleOrphans(entry);

          case 35:
            return _context27.abrupt('return', entry);

          case 36:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function _add(_x48, _x49, _x50) {
    return _ref31.apply(this, arguments);
  }

  return _add;
}();

/**
 * Connect block to chain.
 * @private
 * @param {ChainEntry} prev
 * @param {Block} block
 * @param {Number} flags
 * @returns {Promise}
 */

Chain.prototype.connect = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(prev, block, flags) {
    var start, entry;
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            start = util.hrtime();

            // Sanity check.

            assert(block.prevBlock === prev.hash);

            // Explanation: we try to keep as much data
            // off the javascript heap as possible. Blocks
            // in the future may be 8mb or 20mb, who knows.
            // In fullnode-mode we store the blocks in
            // "compact" form (the headers plus the raw
            // Buffer object) until they're ready to be
            // fully validated here. They are deserialized,
            // validated, and connected. Hopefully the
            // deserialized blocks get cleaned up by the
            // GC quickly.

            if (!block.isMemory()) {
              _context28.next = 11;
              break;
            }

            _context28.prev = 3;

            block = block.toBlock();
            _context28.next = 11;
            break;

          case 7:
            _context28.prev = 7;
            _context28.t0 = _context28['catch'](3);

            this.logger.error(_context28.t0);
            throw new VerifyError(block, 'malformed', 'error parsing message', 10, true);

          case 11:

            // Create a new chain entry.
            entry = ChainEntry.fromBlock(block, prev);

            // The block is on a alternate chain if the
            // chainwork is less than or equal to
            // our tip's. Add the block but do _not_
            // connect the inputs.

            if (!entry.chainwork.lte(this.tip.chainwork)) {
              _context28.next = 17;
              break;
            }

            _context28.next = 15;
            return this.saveAlternate(entry, block, prev, flags);

          case 15:
            _context28.next = 19;
            break;

          case 17:
            _context28.next = 19;
            return this.setBestChain(entry, block, prev, flags);

          case 19:

            // Keep track of stats.
            this.logStatus(start, block, entry);

            // Check sync state.
            this.maybeSync();

            return _context28.abrupt('return', entry);

          case 22:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this, [[3, 7]]);
  }));

  function connect(_x51, _x52, _x53) {
    return _ref32.apply(this, arguments);
  }

  return connect;
}();

/**
 * Handle orphans.
 * @private
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

Chain.prototype.handleOrphans = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(entry) {
    var orphan, _orphan, block, flags, id;

    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            orphan = this.resolveOrphan(entry.hash);

          case 1:
            if (!orphan) {
              _context29.next = 21;
              break;
            }

            _orphan = orphan, block = _orphan.block, flags = _orphan.flags, id = _orphan.id;
            _context29.prev = 3;
            _context29.next = 6;
            return this.connect(entry, block, flags);

          case 6:
            entry = _context29.sent;
            _context29.next = 16;
            break;

          case 9:
            _context29.prev = 9;
            _context29.t0 = _context29['catch'](3);

            if (!(_context29.t0.type === 'VerifyError')) {
              _context29.next = 15;
              break;
            }

            this.logger.warning('Could not resolve orphan block %s: %s.', block.rhash(), _context29.t0.message);

            this.emit('bad orphan', _context29.t0, id);

            return _context29.abrupt('break', 21);

          case 15:
            throw _context29.t0;

          case 16:

            this.logger.debug('Orphan block was resolved: %s (%d).', block.rhash(), entry.height);

            this.emit('resolved', block, entry);

            orphan = this.resolveOrphan(entry.hash);
            _context29.next = 1;
            break;

          case 21:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this, [[3, 9]]);
  }));

  function handleOrphans(_x54) {
    return _ref33.apply(this, arguments);
  }

  return handleOrphans;
}();

/**
 * Test whether the chain has reached its slow height.
 * @private
 * @returns {Boolean}
 */

Chain.prototype.isSlow = function isSlow() {
  if (this.options.spv) return false;

  if (this.synced) return true;

  if (this.height === 1 || this.height % 20 === 0) return true;

  if (this.height >= this.network.block.slowHeight) return true;

  return false;
};

/**
 * Calculate the time difference from
 * start time and log block.
 * @private
 * @param {Array} start
 * @param {Block} block
 * @param {ChainEntry} entry
 */

Chain.prototype.logStatus = function logStatus(start, block, entry) {
  if (!this.isSlow()) return;

  // Report memory for debugging.
  this.logger.memory();

  var elapsed = util.hrtime(start);

  this.logger.info('Block %s (%d) added to chain (size=%d txs=%d time=%d).', entry.rhash(), entry.height, block.getSize(), block.txs.length, elapsed);

  if (this.db.coinCache.capacity > 0) {
    this.logger.debug('Coin Cache: size=%dmb, items=%d.', util.mb(this.db.coinCache.size), this.db.coinCache.items);
  }
};

/**
 * Verify a block hash and height against the checkpoints.
 * @private
 * @param {ChainEntry} prev
 * @param {Hash} hash
 * @returns {Boolean}
 */

Chain.prototype.verifyCheckpoint = function verifyCheckpoint(prev, hash) {
  if (!this.options.checkpoints) return true;

  var height = prev.height + 1;
  var checkpoint = this.network.checkpointMap[height];

  if (!checkpoint) return true;

  if (hash === checkpoint) {
    this.logger.debug('Hit checkpoint block %s (%d).', util.revHex(hash), height);
    this.emit('checkpoint', hash, height);
    return true;
  }

  // Someone is either mining on top of
  // an old block for no reason, or the
  // consensus protocol is broken and
  // there was a 20k+ block reorg.
  this.logger.warning('Checkpoint mismatch at height %d: expected=%s received=%s', height, util.revHex(checkpoint), util.revHex(hash));

  this.purgeOrphans();

  return false;
};

/**
 * Store an orphan.
 * @private
 * @param {Block} block
 * @param {Number?} flags
 * @param {Number?} id
 */

Chain.prototype.storeOrphan = function storeOrphan(block, flags, id) {
  var height = block.getCoinbaseHeight();
  var orphan = this.orphanPrev.get(block.prevBlock);

  // The orphan chain forked.
  if (orphan) {
    assert(orphan.block.hash('hex') !== block.hash('hex'));
    assert(orphan.block.prevBlock === block.prevBlock);

    this.logger.warning('Removing forked orphan block: %s (%d).', orphan.block.rhash(), height);

    this.removeOrphan(orphan);
  }

  this.limitOrphans();
  this.addOrphan(new Orphan(block, flags, id));

  this.logger.debug('Storing orphan block: %s (%d).', block.rhash(), height);

  this.emit('orphan', block);
};

/**
 * Add an orphan.
 * @private
 * @param {Orphan} orphan
 * @returns {Orphan}
 */

Chain.prototype.addOrphan = function addOrphan(orphan) {
  var block = orphan.block;
  var hash = block.hash('hex');

  assert(!this.orphanMap.has(hash));
  assert(!this.orphanPrev.has(block.prevBlock));
  assert(this.orphanMap.size >= 0);

  this.orphanMap.set(hash, orphan);
  this.orphanPrev.set(block.prevBlock, orphan);

  return orphan;
};

/**
 * Remove an orphan.
 * @private
 * @param {Orphan} orphan
 * @returns {Orphan}
 */

Chain.prototype.removeOrphan = function removeOrphan(orphan) {
  var block = orphan.block;
  var hash = block.hash('hex');

  assert(this.orphanMap.has(hash));
  assert(this.orphanPrev.has(block.prevBlock));
  assert(this.orphanMap.size > 0);

  this.orphanMap.delete(hash);
  this.orphanPrev.delete(block.prevBlock);

  return orphan;
};

/**
 * Test whether a hash would resolve the next orphan.
 * @private
 * @param {Hash} hash - Previous block hash.
 * @returns {Boolean}
 */

Chain.prototype.hasNextOrphan = function hasNextOrphan(hash) {
  return this.orphanPrev.has(hash);
};

/**
 * Resolve an orphan.
 * @private
 * @param {Hash} hash - Previous block hash.
 * @returns {Orphan}
 */

Chain.prototype.resolveOrphan = function resolveOrphan(hash) {
  var orphan = this.orphanPrev.get(hash);

  if (!orphan) return null;

  return this.removeOrphan(orphan);
};

/**
 * Purge any waiting orphans.
 */

Chain.prototype.purgeOrphans = function purgeOrphans() {
  var count = this.orphanMap.size;

  if (count === 0) return;

  this.orphanMap.clear();
  this.orphanPrev.clear();

  this.logger.debug('Purged %d orphans.', count);
};

/**
 * Prune orphans, only keep the orphan with the highest
 * coinbase height (likely to be the peer's tip).
 */

Chain.prototype.limitOrphans = function limitOrphans() {
  var now = util.now();

  var oldest = null;
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(this.orphanMap.values()), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var orphan = _step4.value;

      if (now < orphan.time + 60 * 60) {
        if (!oldest || orphan.time < oldest.time) oldest = orphan;
        continue;
      }

      this.removeOrphan(orphan);
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

  if (this.orphanMap.size < this.options.maxOrphans) return;

  if (!oldest) return;

  this.removeOrphan(oldest);
};

/**
 * Test whether an invalid block hash has been seen.
 * @private
 * @param {Block} block
 * @returns {Boolean}
 */

Chain.prototype.hasInvalid = function hasInvalid(block) {
  var hash = block.hash('hex');

  if (this.invalid.has(hash)) return true;

  if (this.invalid.has(block.prevBlock)) {
    this.setInvalid(hash);
    return true;
  }

  return false;
};

/**
 * Mark a block as invalid.
 * @private
 * @param {Hash} hash
 */

Chain.prototype.setInvalid = function setInvalid(hash) {
  this.invalid.set(hash, true);
};

/**
 * Forget an invalid block hash.
 * @private
 * @param {Hash} hash
 */

Chain.prototype.removeInvalid = function removeInvalid(hash) {
  this.invalid.remove(hash);
};

/**
 * Test the chain to see if it contains
 * a block, or has recently seen a block.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.has = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(hash) {
    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            if (!this.hasOrphan(hash)) {
              _context30.next = 2;
              break;
            }

            return _context30.abrupt('return', true);

          case 2:
            if (!this.locker.has(hash)) {
              _context30.next = 4;
              break;
            }

            return _context30.abrupt('return', true);

          case 4:
            if (!this.invalid.has(hash)) {
              _context30.next = 6;
              break;
            }

            return _context30.abrupt('return', true);

          case 6:
            _context30.next = 8;
            return this.hasEntry(hash);

          case 8:
            return _context30.abrupt('return', _context30.sent);

          case 9:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this);
  }));

  function has(_x55) {
    return _ref34.apply(this, arguments);
  }

  return has;
}();

/**
 * Find the corresponding block entry by hash or height.
 * @param {Hash|Number} hash/height
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

Chain.prototype.getEntry = function getEntry(hash) {
  return this.db.getEntry(hash);
};

/**
 * Retrieve a chain entry by height.
 * @param {Number} height
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

Chain.prototype.getEntryByHeight = function getEntryByHeight(height) {
  return this.db.getEntryByHeight(height);
};

/**
 * Retrieve a chain entry by hash.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

Chain.prototype.getEntryByHash = function getEntryByHash(hash) {
  return this.db.getEntryByHash(hash);
};

/**
 * Get the hash of a block by height. Note that this
 * will only return hashes in the main chain.
 * @param {Number} height
 * @returns {Promise} - Returns {@link Hash}.
 */

Chain.prototype.getHash = function getHash(height) {
  return this.db.getHash(height);
};

/**
 * Get the height of a block by hash.
 * @param {Hash} hash
 * @returns {Promise} - Returns Number.
 */

Chain.prototype.getHeight = function getHeight(hash) {
  return this.db.getHeight(hash);
};

/**
 * Test the chain to see if it contains a block.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.hasEntry = function hasEntry(hash) {
  return this.db.hasEntry(hash);
};

/**
 * Get the _next_ block hash (does not work by height).
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Hash}.
 */

Chain.prototype.getNextHash = function getNextHash(hash) {
  return this.db.getNextHash(hash);
};

/**
 * Check whether coins are still unspent. Necessary for bip30.
 * @see https://bitcointalk.org/index.php?topic=67738.0
 * @param {TX} tx
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.hasCoins = function hasCoins(tx) {
  return this.db.hasCoins(tx);
};

/**
 * Get all tip hashes.
 * @returns {Promise} - Returns {@link Hash}[].
 */

Chain.prototype.getTips = function getTips() {
  return this.db.getTips();
};

/**
 * Get a coin (unspents only).
 * @private
 * @param {Outpoint} prevout
 * @returns {Promise} - Returns {@link CoinEntry}.
 */

Chain.prototype.readCoin = function readCoin(prevout) {
  return this.db.readCoin(prevout);
};

/**
 * Get a coin (unspents only).
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns {@link Coin}.
 */

Chain.prototype.getCoin = function getCoin(hash, index) {
  return this.db.getCoin(hash, index);
};

/**
 * Retrieve a block from the database (not filled with coins).
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Block}.
 */

Chain.prototype.getBlock = function getBlock(hash) {
  return this.db.getBlock(hash);
};

/**
 * Retrieve a block from the database (not filled with coins).
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Block}.
 */

Chain.prototype.getRawBlock = function getRawBlock(block) {
  return this.db.getRawBlock(block);
};

/**
 * Get a historical block coin viewpoint.
 * @param {Block} hash
 * @returns {Promise} - Returns {@link CoinView}.
 */

Chain.prototype.getBlockView = function getBlockView(block) {
  return this.db.getBlockView(block);
};

/**
 * Get a transaction with metadata.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TXMeta}.
 */

Chain.prototype.getMeta = function getMeta(hash) {
  return this.db.getMeta(hash);
};

/**
 * Retrieve a transaction.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TX}.
 */

Chain.prototype.getTX = function getTX(hash) {
  return this.db.getTX(hash);
};

/**
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.hasTX = function hasTX(hash) {
  return this.db.hasTX(hash);
};

/**
 * Get all coins pertinent to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link Coin}[].
 */

Chain.prototype.getCoinsByAddress = function getCoinsByAddress(addrs) {
  return this.db.getCoinsByAddress(addrs);
};

/**
 * Get all transaction hashes to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link Hash}[].
 */

Chain.prototype.getHashesByAddress = function getHashesByAddress(addrs) {
  return this.db.getHashesByAddress(addrs);
};

/**
 * Get all transactions pertinent to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link TX}[].
 */

Chain.prototype.getTXByAddress = function getTXByAddress(addrs) {
  return this.db.getTXByAddress(addrs);
};

/**
 * Get all transactions pertinent to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link TXMeta}[].
 */

Chain.prototype.getMetaByAddress = function getMetaByAddress(addrs) {
  return this.db.getMetaByAddress(addrs);
};

/**
 * Get an orphan block.
 * @param {Hash} hash
 * @returns {Block}
 */

Chain.prototype.getOrphan = function getOrphan(hash) {
  return this.orphanMap.get(hash) || null;
};

/**
 * Test the chain to see if it contains an orphan.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.hasOrphan = function hasOrphan(hash) {
  return this.orphanMap.has(hash);
};

/**
 * Test the chain to see if it contains a pending block in its queue.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.hasPending = function hasPending(hash) {
  return this.locker.hasPending(hash);
};

/**
 * Get coin viewpoint.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

Chain.prototype.getCoinView = function getCoinView(tx) {
  return this.db.getCoinView(tx);
};

/**
 * Get coin viewpoint (spent).
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

Chain.prototype.getSpentView = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(tx) {
    var unlock;
    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            _context31.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context31.sent;
            _context31.prev = 3;
            _context31.next = 6;
            return this.db.getSpentView(tx);

          case 6:
            return _context31.abrupt('return', _context31.sent);

          case 7:
            _context31.prev = 7;

            unlock();
            return _context31.finish(7);

          case 10:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this, [[3,, 7, 10]]);
  }));

  function getSpentView(_x56) {
    return _ref35.apply(this, arguments);
  }

  return getSpentView;
}();

/**
 * Test the chain to see if it is synced.
 * @returns {Boolean}
 */

Chain.prototype.isFull = function isFull() {
  return this.synced;
};

/**
 * Potentially emit a `full` event.
 * @private
 */

Chain.prototype.maybeSync = function maybeSync() {
  if (this.synced) return;

  if (this.options.checkpoints) {
    if (this.height < this.network.lastCheckpoint) return;
  }

  if (this.tip.time < util.now() - this.network.block.maxTipAge) return;

  if (!this.hasChainwork()) return;

  this.synced = true;
  this.emit('full');
};

/**
 * Test the chain to see if it has the
 * minimum required chainwork for the
 * network.
 * @returns {Boolean}
 */

Chain.prototype.hasChainwork = function hasChainwork() {
  return this.tip.chainwork.gte(this.network.pow.chainwork);
};

/**
 * Get the fill percentage.
 * @returns {Number} percent - Ranges from 0.0 to 1.0.
 */

Chain.prototype.getProgress = function getProgress() {
  var start = this.network.genesis.time;
  var current = this.tip.time - start;
  var end = util.now() - start - 40 * 60;
  return Math.min(1, current / end);
};

/**
 * Calculate chain locator (an array of hashes).
 * @param {Hash?} start - Height or hash to treat as the tip.
 * The current tip will be used if not present. Note that this can be a
 * non-existent hash, which is useful for headers-first locators.
 * @returns {Promise} - Returns {@link Hash}[].
 */

Chain.prototype.getLocator = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(start) {
    var unlock;
    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            _context32.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context32.sent;
            _context32.prev = 3;
            _context32.next = 6;
            return this._getLocator(start);

          case 6:
            return _context32.abrupt('return', _context32.sent);

          case 7:
            _context32.prev = 7;

            unlock();
            return _context32.finish(7);

          case 10:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this, [[3,, 7, 10]]);
  }));

  function getLocator(_x57) {
    return _ref36.apply(this, arguments);
  }

  return getLocator;
}();

/**
 * Calculate chain locator without a lock.
 * @private
 * @param {Hash?} start
 * @returns {Promise}
 */

Chain.prototype._getLocator = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(start) {
    var entry, hashes, main, hash, height, step, ancestor;
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            if (start == null) start = this.tip.hash;

            assert(typeof start === 'string');

            _context33.next = 4;
            return this.getEntry(start);

          case 4:
            entry = _context33.sent;
            hashes = [];


            if (!entry) {
              entry = this.tip;
              hashes.push(start);
            }

            _context33.next = 9;
            return this.isMainChain(entry);

          case 9:
            main = _context33.sent;
            hash = entry.hash;
            height = entry.height;
            step = 1;


            hashes.push(hash);

          case 14:
            if (!(height > 0)) {
              _context33.next = 36;
              break;
            }

            height -= step;

            if (height < 0) height = 0;

            if (hashes.length > 10) step *= 2;

            if (!main) {
              _context33.next = 25;
              break;
            }

            _context33.next = 21;
            return this.getHash(height);

          case 21:
            hash = _context33.sent;

            assert(hash);
            _context33.next = 33;
            break;

          case 25:
            _context33.next = 27;
            return this.getAncestor(entry, height);

          case 27:
            ancestor = _context33.sent;

            assert(ancestor);
            _context33.next = 31;
            return this.isMainChain(ancestor);

          case 31:
            main = _context33.sent;

            hash = ancestor.hash;

          case 33:

            hashes.push(hash);
            _context33.next = 14;
            break;

          case 36:
            return _context33.abrupt('return', hashes);

          case 37:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this);
  }));

  function _getLocator(_x58) {
    return _ref37.apply(this, arguments);
  }

  return _getLocator;
}();

/**
 * Calculate the orphan root of the hash (if it is an orphan).
 * @param {Hash} hash
 * @returns {Hash}
 */

Chain.prototype.getOrphanRoot = function getOrphanRoot(hash) {
  var root = null;

  assert(hash);

  for (;;) {
    var orphan = this.orphanMap.get(hash);

    if (!orphan) break;

    root = hash;
    hash = orphan.block.prevBlock;
  }

  return root;
};

/**
 * Calculate the time difference (in seconds)
 * between two blocks by examining chainworks.
 * @param {ChainEntry} to
 * @param {ChainEntry} from
 * @returns {Number}
 */

Chain.prototype.getProofTime = function getProofTime(to, from) {
  var pow = this.network.pow;
  var sign = void 0,
      work = void 0;

  if (to.chainwork.gt(from.chainwork)) {
    work = to.chainwork.sub(from.chainwork);
    sign = 1;
  } else {
    work = from.chainwork.sub(to.chainwork);
    sign = -1;
  }

  work = work.imuln(pow.targetSpacing);
  work = work.div(this.tip.getProof());

  if (work.bitLength() > 53) return sign * _maxSafeInteger2.default;

  return sign * work.toNumber();
};

/**
 * Calculate the next target based on the chain tip.
 * @returns {Promise} - returns Number
 * (target is in compact/mantissa form).
 */

Chain.prototype.getCurrentTarget = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34() {
    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            _context34.next = 2;
            return this.getTarget(this.network.now(), this.tip);

          case 2:
            return _context34.abrupt('return', _context34.sent);

          case 3:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this);
  }));

  function getCurrentTarget() {
    return _ref38.apply(this, arguments);
  }

  return getCurrentTarget;
}();

/**
 * Calculate the next target.
 * @param {Number} time - Next block timestamp.
 * @param {ChainEntry} prev - Previous entry.
 * @returns {Promise} - returns Number
 * (target is in compact/mantissa form).
 */

Chain.prototype.getTarget = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(time, prev) {
    var pow, cache, height, first;
    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            pow = this.network.pow;

            // Genesis

            if (prev) {
              _context35.next = 4;
              break;
            }

            assert(time === this.network.genesis.time);
            return _context35.abrupt('return', pow.bits);

          case 4:
            if (!((prev.height + 1) % pow.retargetInterval !== 0)) {
              _context35.next = 21;
              break;
            }

            if (!pow.targetReset) {
              _context35.next = 20;
              break;
            }

            if (!(time > prev.time + pow.targetSpacing * 2)) {
              _context35.next = 8;
              break;
            }

            return _context35.abrupt('return', pow.bits);

          case 8:
            if (!(prev.height !== 0 && prev.height % pow.retargetInterval !== 0 && prev.bits === pow.bits)) {
              _context35.next = 20;
              break;
            }

            cache = this.getPrevCache(prev);

            if (!cache) {
              _context35.next = 14;
              break;
            }

            prev = cache;
            _context35.next = 17;
            break;

          case 14:
            _context35.next = 16;
            return this.getPrevious(prev);

          case 16:
            prev = _context35.sent;

          case 17:

            assert(prev);
            _context35.next = 8;
            break;

          case 20:
            return _context35.abrupt('return', prev.bits);

          case 21:

            // Back 2 weeks
            height = prev.height - (pow.retargetInterval - 1);

            assert(height >= 0);

            _context35.next = 25;
            return this.getAncestor(prev, height);

          case 25:
            first = _context35.sent;

            assert(first);

            return _context35.abrupt('return', this.retarget(prev, first));

          case 28:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this);
  }));

  function getTarget(_x59, _x60) {
    return _ref39.apply(this, arguments);
  }

  return getTarget;
}();

/**
 * Retarget. This is called when the chain height
 * hits a retarget diff interval.
 * @param {ChainEntry} prev - Previous entry.
 * @param {ChainEntry} first - Chain entry from 2 weeks prior.
 * @returns {Number} target - Target in compact/mantissa form.
 */

Chain.prototype.retarget = function retarget(prev, first) {
  var pow = this.network.pow;
  var targetTimespan = pow.targetTimespan;

  if (pow.noRetargeting) return prev.bits;

  var target = consensus.fromCompact(prev.bits);

  var actualTimespan = prev.time - first.time;

  if (actualTimespan < targetTimespan / 4 | 0) actualTimespan = targetTimespan / 4 | 0;

  if (actualTimespan > targetTimespan * 4) actualTimespan = targetTimespan * 4;

  target.imuln(actualTimespan);
  target.idivn(targetTimespan);

  if (target.gt(pow.limit)) return pow.bits;

  return consensus.toCompact(target);
};

/**
 * Find a locator. Analagous to bitcoind's `FindForkInGlobalIndex()`.
 * @param {Hash[]} locator - Hashes.
 * @returns {Promise} - Returns {@link Hash} (the
 * hash of the latest known block).
 */

Chain.prototype.findLocator = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(locator) {
    var _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, hash;

    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context36.prev = 3;
            _iterator5 = (0, _getIterator3.default)(locator);

          case 5:
            if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
              _context36.next = 14;
              break;
            }

            hash = _step5.value;
            _context36.next = 9;
            return this.isMainHash(hash);

          case 9:
            if (!_context36.sent) {
              _context36.next = 11;
              break;
            }

            return _context36.abrupt('return', hash);

          case 11:
            _iteratorNormalCompletion5 = true;
            _context36.next = 5;
            break;

          case 14:
            _context36.next = 20;
            break;

          case 16:
            _context36.prev = 16;
            _context36.t0 = _context36['catch'](3);
            _didIteratorError5 = true;
            _iteratorError5 = _context36.t0;

          case 20:
            _context36.prev = 20;
            _context36.prev = 21;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 23:
            _context36.prev = 23;

            if (!_didIteratorError5) {
              _context36.next = 26;
              break;
            }

            throw _iteratorError5;

          case 26:
            return _context36.finish(23);

          case 27:
            return _context36.finish(20);

          case 28:
            return _context36.abrupt('return', this.network.genesis.hash);

          case 29:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this, [[3, 16, 20, 28], [21,, 23, 27]]);
  }));

  function findLocator(_x61) {
    return _ref40.apply(this, arguments);
  }

  return findLocator;
}();

/**
 * Check whether a versionbits deployment is active (BIP9: versionbits).
 * @example
 * await chain.isActive(tip, deployments.segwit);
 * @see https://github.com/bitcoin/bips/blob/master/bip-0009.mediawiki
 * @param {ChainEntry} prev - Previous chain entry.
 * @param {String} id - Deployment id.
 * @returns {Promise} - Returns Number.
 */

Chain.prototype.isActive = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(prev, deployment) {
    var state;
    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            _context37.next = 2;
            return this.getState(prev, deployment);

          case 2:
            state = _context37.sent;
            return _context37.abrupt('return', state === thresholdStates.ACTIVE);

          case 4:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this);
  }));

  function isActive(_x62, _x63) {
    return _ref41.apply(this, arguments);
  }

  return isActive;
}();

/**
 * Get chain entry state for a deployment (BIP9: versionbits).
 * @example
 * await chain.getState(tip, deployments.segwit);
 * @see https://github.com/bitcoin/bips/blob/master/bip-0009.mediawiki
 * @param {ChainEntry} prev - Previous chain entry.
 * @param {String} id - Deployment id.
 * @returns {Promise} - Returns Number.
 */

Chain.prototype.getState = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(prev, deployment) {
    var bit, window, threshold, height, entry, state, compute, cached, time, _height, _entry4, _time, _time2, block, count, i;

    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            bit = deployment.bit;
            window = this.network.minerWindow;
            threshold = this.network.activationThreshold;


            if (deployment.threshold !== -1) threshold = deployment.threshold;

            if (deployment.window !== -1) window = deployment.window;

            if (!((prev.height + 1) % window !== 0)) {
              _context38.next = 14;
              break;
            }

            height = prev.height - (prev.height + 1) % window;
            _context38.next = 9;
            return this.getAncestor(prev, height);

          case 9:
            prev = _context38.sent;

            if (prev) {
              _context38.next = 12;
              break;
            }

            return _context38.abrupt('return', thresholdStates.DEFINED);

          case 12:

            assert(prev.height === height);
            assert((prev.height + 1) % window === 0);

          case 14:
            entry = prev;
            state = thresholdStates.DEFINED;
            compute = [];

          case 17:
            if (!entry) {
              _context38.next = 36;
              break;
            }

            cached = this.db.stateCache.get(bit, entry);

            if (!(cached !== -1)) {
              _context38.next = 22;
              break;
            }

            state = cached;
            return _context38.abrupt('break', 36);

          case 22:
            _context38.next = 24;
            return this.getMedianTime(entry);

          case 24:
            time = _context38.sent;

            if (!(time < deployment.startTime)) {
              _context38.next = 29;
              break;
            }

            state = thresholdStates.DEFINED;
            this.db.stateCache.set(bit, entry, state);
            return _context38.abrupt('break', 36);

          case 29:

            compute.push(entry);

            _height = entry.height - window;
            _context38.next = 33;
            return this.getAncestor(entry, _height);

          case 33:
            entry = _context38.sent;
            _context38.next = 17;
            break;

          case 36:
            if (!compute.length) {
              _context38.next = 81;
              break;
            }

            _entry4 = compute.pop();
            _context38.t0 = state;
            _context38.next = _context38.t0 === thresholdStates.DEFINED ? 41 : _context38.t0 === thresholdStates.STARTED ? 51 : _context38.t0 === thresholdStates.LOCKED_IN ? 73 : _context38.t0 === thresholdStates.FAILED ? 75 : _context38.t0 === thresholdStates.ACTIVE ? 75 : 76;
            break;

          case 41:
            _context38.next = 43;
            return this.getMedianTime(_entry4);

          case 43:
            _time = _context38.sent;

            if (!(_time >= deployment.timeout)) {
              _context38.next = 47;
              break;
            }

            state = thresholdStates.FAILED;
            return _context38.abrupt('break', 78);

          case 47:
            if (!(_time >= deployment.startTime)) {
              _context38.next = 50;
              break;
            }

            state = thresholdStates.STARTED;
            return _context38.abrupt('break', 78);

          case 50:
            return _context38.abrupt('break', 78);

          case 51:
            _context38.next = 53;
            return this.getMedianTime(_entry4);

          case 53:
            _time2 = _context38.sent;

            if (!(_time2 >= deployment.timeout)) {
              _context38.next = 57;
              break;
            }

            state = thresholdStates.FAILED;
            return _context38.abrupt('break', 78);

          case 57:
            block = _entry4;
            count = 0;
            i = 0;

          case 60:
            if (!(i < window)) {
              _context38.next = 72;
              break;
            }

            if (block.hasBit(bit)) count++;

            if (!(count >= threshold)) {
              _context38.next = 65;
              break;
            }

            state = thresholdStates.LOCKED_IN;
            return _context38.abrupt('break', 72);

          case 65:
            _context38.next = 67;
            return this.getPrevious(block);

          case 67:
            block = _context38.sent;

            assert(block);

          case 69:
            i++;
            _context38.next = 60;
            break;

          case 72:
            return _context38.abrupt('break', 78);

          case 73:
            state = thresholdStates.ACTIVE;
            return _context38.abrupt('break', 78);

          case 75:
            return _context38.abrupt('break', 78);

          case 76:
            assert(false, 'Bad state.');
            return _context38.abrupt('break', 78);

          case 78:

            this.db.stateCache.set(bit, _entry4, state);
            _context38.next = 36;
            break;

          case 81:
            return _context38.abrupt('return', state);

          case 82:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this);
  }));

  function getState(_x64, _x65) {
    return _ref42.apply(this, arguments);
  }

  return getState;
}();

/**
 * Compute the version for a new block (BIP9: versionbits).
 * @see https://github.com/bitcoin/bips/blob/master/bip-0009.mediawiki
 * @param {ChainEntry} prev - Previous chain entry (usually the tip).
 * @returns {Promise} - Returns Number.
 */

Chain.prototype.computeBlockVersion = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(prev) {
    var version, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, deployment, state;

    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            version = 0;
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context39.prev = 4;
            _iterator6 = (0, _getIterator3.default)(this.network.deploys);

          case 6:
            if (_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done) {
              _context39.next = 15;
              break;
            }

            deployment = _step6.value;
            _context39.next = 10;
            return this.getState(prev, deployment);

          case 10:
            state = _context39.sent;


            if (state === thresholdStates.LOCKED_IN || state === thresholdStates.STARTED) {
              version |= 1 << deployment.bit;
            }

          case 12:
            _iteratorNormalCompletion6 = true;
            _context39.next = 6;
            break;

          case 15:
            _context39.next = 21;
            break;

          case 17:
            _context39.prev = 17;
            _context39.t0 = _context39['catch'](4);
            _didIteratorError6 = true;
            _iteratorError6 = _context39.t0;

          case 21:
            _context39.prev = 21;
            _context39.prev = 22;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 24:
            _context39.prev = 24;

            if (!_didIteratorError6) {
              _context39.next = 27;
              break;
            }

            throw _iteratorError6;

          case 27:
            return _context39.finish(24);

          case 28:
            return _context39.finish(21);

          case 29:

            version |= consensus.VERSION_TOP_BITS;
            version >>>= 0;

            return _context39.abrupt('return', version);

          case 32:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this, [[4, 17, 21, 29], [22,, 24, 28]]);
  }));

  function computeBlockVersion(_x66) {
    return _ref43.apply(this, arguments);
  }

  return computeBlockVersion;
}();

/**
 * Get the current deployment state of the chain. Called on load.
 * @private
 * @returns {Promise} - Returns {@link DeploymentState}.
 */

Chain.prototype.getDeploymentState = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40() {
    var prev;
    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            _context40.next = 2;
            return this.getPrevious(this.tip);

          case 2:
            prev = _context40.sent;

            if (prev) {
              _context40.next = 6;
              break;
            }

            assert(this.tip.isGenesis());
            return _context40.abrupt('return', this.state);

          case 6:
            if (!this.options.spv) {
              _context40.next = 8;
              break;
            }

            return _context40.abrupt('return', this.state);

          case 8:
            _context40.next = 10;
            return this.getDeployments(this.tip.time, prev);

          case 10:
            return _context40.abrupt('return', _context40.sent);

          case 11:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this);
  }));

  function getDeploymentState() {
    return _ref44.apply(this, arguments);
  }

  return getDeploymentState;
}();

/**
 * Check transaction finality, taking into account MEDIAN_TIME_PAST
 * if it is present in the lock flags.
 * @param {ChainEntry} prev - Previous chain entry.
 * @param {TX} tx
 * @param {LockFlags} flags
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.verifyFinal = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(prev, tx, flags) {
    var height, time;
    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            height = prev.height + 1;

            // We can skip MTP if the locktime is height.

            if (!(tx.locktime < consensus.LOCKTIME_THRESHOLD)) {
              _context41.next = 3;
              break;
            }

            return _context41.abrupt('return', tx.isFinal(height, -1));

          case 3:
            if (!(flags & common.lockFlags.MEDIAN_TIME_PAST)) {
              _context41.next = 8;
              break;
            }

            _context41.next = 6;
            return this.getMedianTime(prev);

          case 6:
            time = _context41.sent;
            return _context41.abrupt('return', tx.isFinal(height, time));

          case 8:
            return _context41.abrupt('return', tx.isFinal(height, this.network.now()));

          case 9:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this);
  }));

  function verifyFinal(_x67, _x68, _x69) {
    return _ref45.apply(this, arguments);
  }

  return verifyFinal;
}();

/**
 * Get the necessary minimum time and height sequence locks for a transaction.
 * @param {ChainEntry} prev
 * @param {TX} tx
 * @param {CoinView} view
 * @param {LockFlags} flags
 * @returns {Promise}
 */

Chain.prototype.getLocks = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(prev, tx, view, flags) {
    var GRANULARITY, DISABLE_FLAG, TYPE_FLAG, MASK, minHeight, minTime, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, _ref47, prevout, sequence, height, entry, time;

    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            GRANULARITY = consensus.SEQUENCE_GRANULARITY;
            DISABLE_FLAG = consensus.SEQUENCE_DISABLE_FLAG;
            TYPE_FLAG = consensus.SEQUENCE_TYPE_FLAG;
            MASK = consensus.SEQUENCE_MASK;

            if (flags & common.lockFlags.VERIFY_SEQUENCE) {
              _context42.next = 6;
              break;
            }

            return _context42.abrupt('return', [-1, -1]);

          case 6:
            if (!(tx.isCoinbase() || tx.version < 2)) {
              _context42.next = 8;
              break;
            }

            return _context42.abrupt('return', [-1, -1]);

          case 8:
            minHeight = -1;
            minTime = -1;
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context42.prev = 13;
            _iterator7 = (0, _getIterator3.default)(tx.inputs);

          case 15:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context42.next = 40;
              break;
            }

            _ref47 = _step7.value;
            prevout = _ref47.prevout;
            sequence = _ref47.sequence;

            if (!(sequence & DISABLE_FLAG)) {
              _context42.next = 21;
              break;
            }

            return _context42.abrupt('continue', 37);

          case 21:
            height = view.getHeight(prevout);


            if (height === -1) height = this.height + 1;

            if (sequence & TYPE_FLAG) {
              _context42.next = 27;
              break;
            }

            height += (sequence & MASK) - 1;
            minHeight = Math.max(minHeight, height);
            return _context42.abrupt('continue', 37);

          case 27:

            height = Math.max(height - 1, 0);

            _context42.next = 30;
            return this.getAncestor(prev, height);

          case 30:
            entry = _context42.sent;

            assert(entry, 'Database is corrupt.');

            _context42.next = 34;
            return this.getMedianTime(entry);

          case 34:
            time = _context42.sent;

            time += ((sequence & MASK) << GRANULARITY) - 1;
            minTime = Math.max(minTime, time);

          case 37:
            _iteratorNormalCompletion7 = true;
            _context42.next = 15;
            break;

          case 40:
            _context42.next = 46;
            break;

          case 42:
            _context42.prev = 42;
            _context42.t0 = _context42['catch'](13);
            _didIteratorError7 = true;
            _iteratorError7 = _context42.t0;

          case 46:
            _context42.prev = 46;
            _context42.prev = 47;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 49:
            _context42.prev = 49;

            if (!_didIteratorError7) {
              _context42.next = 52;
              break;
            }

            throw _iteratorError7;

          case 52:
            return _context42.finish(49);

          case 53:
            return _context42.finish(46);

          case 54:
            return _context42.abrupt('return', [minHeight, minTime]);

          case 55:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this, [[13, 42, 46, 54], [47,, 49, 53]]);
  }));

  function getLocks(_x70, _x71, _x72, _x73) {
    return _ref46.apply(this, arguments);
  }

  return getLocks;
}();

/**
 * Verify sequence locks.
 * @param {ChainEntry} prev
 * @param {TX} tx
 * @param {CoinView} view
 * @param {LockFlags} flags
 * @returns {Promise} - Returns Boolean.
 */

Chain.prototype.verifyLocks = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(prev, tx, view, flags) {
    var _ref49, _ref50, height, time, mtp;

    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            _context43.next = 2;
            return this.getLocks(prev, tx, view, flags);

          case 2:
            _ref49 = _context43.sent;
            _ref50 = (0, _slicedToArray3.default)(_ref49, 2);
            height = _ref50[0];
            time = _ref50[1];

            if (!(height !== -1)) {
              _context43.next = 9;
              break;
            }

            if (!(height >= prev.height + 1)) {
              _context43.next = 9;
              break;
            }

            return _context43.abrupt('return', false);

          case 9:
            if (!(time !== -1)) {
              _context43.next = 15;
              break;
            }

            _context43.next = 12;
            return this.getMedianTime(prev);

          case 12:
            mtp = _context43.sent;

            if (!(time >= mtp)) {
              _context43.next = 15;
              break;
            }

            return _context43.abrupt('return', false);

          case 15:
            return _context43.abrupt('return', true);

          case 16:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this);
  }));

  function verifyLocks(_x74, _x75, _x76, _x77) {
    return _ref48.apply(this, arguments);
  }

  return verifyLocks;
}();

/**
 * ChainOptions
 * @alias module:blockchain.ChainOptions
 * @constructor
 * @param {Object} options
 */

function ChainOptions(options) {
  if (!(this instanceof ChainOptions)) return new ChainOptions(options);

  this.network = Network.primary;
  this.logger = Logger.global;
  this.workers = null;

  this.prefix = null;
  this.location = null;
  this.db = 'memory';
  this.maxFiles = 64;
  this.cacheSize = 32 << 20;
  this.compression = true;
  this.bufferKeys = ChainDB.layout.binary;

  this.spv = false;
  this.bip91 = false;
  this.bip148 = false;
  this.prune = false;
  this.indexTX = false;
  this.indexAddress = false;
  this.forceFlags = false;

  this.coinCache = 0;
  this.entryCache = 5000;
  this.maxOrphans = 20;
  this.checkpoints = true;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {ChainOptions}
 */

ChainOptions.prototype.fromOptions = function fromOptions(options) {
  if (options.network != null) this.network = Network.get(options.network);

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.workers != null) {
    assert((0, _typeof3.default)(options.workers) === 'object');
    this.workers = options.workers;
  }

  if (options.spv != null) {
    assert(typeof options.spv === 'boolean');
    this.spv = options.spv;
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
    this.location = this.spv ? path.join(this.prefix, 'spvchain') : path.join(this.prefix, 'chain');
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

  if (options.prune != null) {
    assert(typeof options.prune === 'boolean');
    this.prune = options.prune;
  }

  if (options.indexTX != null) {
    assert(typeof options.indexTX === 'boolean');
    this.indexTX = options.indexTX;
  }

  if (options.indexAddress != null) {
    assert(typeof options.indexAddress === 'boolean');
    this.indexAddress = options.indexAddress;
  }

  if (options.forceFlags != null) {
    assert(typeof options.forceFlags === 'boolean');
    this.forceFlags = options.forceFlags;
  }

  if (options.bip91 != null) {
    assert(typeof options.bip91 === 'boolean');
    this.bip91 = options.bip91;
  }

  if (options.bip148 != null) {
    assert(typeof options.bip148 === 'boolean');
    this.bip148 = options.bip148;
  }

  if (options.coinCache != null) {
    assert(util.isU64(options.coinCache));
    this.coinCache = options.coinCache;
  }

  if (options.entryCache != null) {
    assert(util.isU32(options.entryCache));
    this.entryCache = options.entryCache;
  }

  if (options.maxOrphans != null) {
    assert(util.isU32(options.maxOrphans));
    this.maxOrphans = options.maxOrphans;
  }

  if (options.checkpoints != null) {
    assert(typeof options.checkpoints === 'boolean');
    this.checkpoints = options.checkpoints;
  }

  return this;
};

/**
 * Instantiate chain options from object.
 * @param {Object} options
 * @returns {ChainOptions}
 */

ChainOptions.fromOptions = function fromOptions(options) {
  return new ChainOptions().fromOptions(options);
};

/**
 * Represents the deployment state of the chain.
 * @alias module:blockchain.DeploymentState
 * @constructor
 * @property {VerifyFlags} flags
 * @property {LockFlags} lockFlags
 * @property {Boolean} bip34
 */

function DeploymentState() {
  if (!(this instanceof DeploymentState)) return new DeploymentState();

  this.flags = Script.flags.MANDATORY_VERIFY_FLAGS;
  this.flags &= ~Script.flags.VERIFY_P2SH;
  this.lockFlags = common.lockFlags.MANDATORY_LOCKTIME_FLAGS;
  this.bip34 = false;
  this.bip91 = false;
  this.bip148 = false;
}

/**
 * Test whether p2sh is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasP2SH = function hasP2SH() {
  return (this.flags & Script.flags.VERIFY_P2SH) !== 0;
};

/**
 * Test whether bip34 (coinbase height) is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasBIP34 = function hasBIP34() {
  return this.bip34;
};

/**
 * Test whether bip66 (VERIFY_DERSIG) is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasBIP66 = function hasBIP66() {
  return (this.flags & Script.flags.VERIFY_DERSIG) !== 0;
};

/**
 * Test whether cltv is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasCLTV = function hasCLTV() {
  return (this.flags & Script.flags.VERIFY_CHECKLOCKTIMEVERIFY) !== 0;
};

/**
 * Test whether median time past locktime is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasMTP = function hasMTP() {
  return (this.lockFlags & common.lockFlags.MEDIAN_TIME_PAST) !== 0;
};

/**
 * Test whether csv is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasCSV = function hasCSV() {
  return (this.flags & Script.flags.VERIFY_CHECKSEQUENCEVERIFY) !== 0;
};

/**
 * Test whether segwit is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasWitness = function hasWitness() {
  return (this.flags & Script.flags.VERIFY_WITNESS) !== 0;
};

/**
 * Test whether bip91 is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasBIP91 = function hasBIP91() {
  return this.bip91;
};

/**
 * Test whether bip148 is active.
 * @returns {Boolean}
 */

DeploymentState.prototype.hasBIP148 = function hasBIP148() {
  return this.bip148;
};

/**
 * Orphan
 * @constructor
 * @ignore
 */

function Orphan(block, flags, id) {
  this.block = block;
  this.flags = flags;
  this.id = id;
  this.time = util.now();
}

/*
 * Helpers
 */

function cmp(a, b) {
  return a - b;
}

/*
 * Expose
 */

module.exports = Chain;