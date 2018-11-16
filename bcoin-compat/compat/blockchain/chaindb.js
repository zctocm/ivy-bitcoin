/*!
 * chaindb.js - blockchain data management for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var util = require('../utils/util');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var Amount = require('../btc/amount');
var encoding = require('../utils/encoding');
var Network = require('../protocol/network');
var CoinView = require('../coins/coinview');
var UndoCoins = require('../coins/undocoins');
var LDB = require('../db/ldb');
var layout = require('./layout');
var LRU = require('../utils/lru');
var Block = require('../primitives/block');
var Outpoint = require('../primitives/outpoint');
var Address = require('../primitives/address');
var ChainEntry = require('./chainentry');
var TXMeta = require('../primitives/txmeta');
var CoinEntry = require('../coins/coinentry');
var U8 = encoding.U8;
var U32 = encoding.U32;

/**
 * The database backend for the {@link Chain} object.
 * @alias module:blockchain.ChainDB
 * @constructor
 * @param {Boolean?} options.prune - Whether to prune the chain.
 * @param {Boolean?} options.spv - SPV-mode, will not save block
 * data, only entries.
 * @param {String?} options.name - Database name
 * @param {String?} options.location - Database location
 * @param {String?} options.db - Database backend name
 * @property {Boolean} prune
 * @emits ChainDB#open
 * @emits ChainDB#error
 */

function ChainDB(options) {
  if (!(this instanceof ChainDB)) return new ChainDB(options);

  this.options = options;
  this.network = this.options.network;
  this.logger = this.options.logger.context('chaindb');

  this.db = LDB(this.options);
  this.stateCache = new StateCache(this.network);
  this.state = new ChainState();
  this.pending = null;
  this.current = null;

  this.coinCache = new LRU(this.options.coinCache, getSize);
  this.cacheHash = new LRU(this.options.entryCache);
  this.cacheHeight = new LRU(this.options.entryCache);
}

/**
 * Database layout.
 * @type {Object}
 */

ChainDB.layout = layout;

/**
 * Open the chain db, wait for the database to load.
 * @returns {Promise}
 */

ChainDB.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var state;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            this.logger.info('Opening ChainDB...');

            _context.next = 3;
            return this.db.open();

          case 3:
            _context.next = 5;
            return this.db.checkVersion('V', 3);

          case 5:
            _context.next = 7;
            return this.getState();

          case 7:
            state = _context.sent;

            if (!state) {
              _context.next = 20;
              break;
            }

            _context.next = 11;
            return this.verifyFlags(state);

          case 11:
            _context.next = 13;
            return this.verifyDeployments();

          case 13:
            _context.next = 15;
            return this.getStateCache();

          case 15:
            this.stateCache = _context.sent;


            // Grab the chainstate if we have one.
            this.state = state;

            this.logger.info('ChainDB successfully loaded.');
            _context.next = 27;
            break;

          case 20:
            _context.next = 22;
            return this.saveFlags();

          case 22:
            _context.next = 24;
            return this.saveDeployments();

          case 24:
            _context.next = 26;
            return this.saveGenesis();

          case 26:

            this.logger.info('ChainDB successfully initialized.');

          case 27:

            this.logger.info('Chain State: hash=%s tx=%d coin=%d value=%s.', this.state.rhash(), this.state.tx, this.state.coin, Amount.btc(this.state.value));

          case 28:
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
 * Close the chain db, wait for the database to close.
 * @returns {Promise}
 */

ChainDB.prototype.close = function close() {
  return this.db.close();
};

/**
 * Start a batch.
 * @returns {Batch}
 */

ChainDB.prototype.start = function start() {
  assert(!this.current);
  assert(!this.pending);

  this.current = this.db.batch();
  this.pending = this.state.clone();

  this.coinCache.start();
  this.cacheHash.start();
  this.cacheHeight.start();

  return this.current;
};

/**
 * Put key and value to current batch.
 * @param {String} key
 * @param {Buffer} value
 */

ChainDB.prototype.put = function put(key, value) {
  assert(this.current);
  this.current.put(key, value);
};

/**
 * Delete key from current batch.
 * @param {String} key
 */

ChainDB.prototype.del = function del(key) {
  assert(this.current);
  this.current.del(key);
};

/**
 * Get current batch.
 * @returns {Batch}
 */

ChainDB.prototype.batch = function batch() {
  assert(this.current);
  return this.current;
};

/**
 * Drop current batch.
 * @returns {Batch}
 */

ChainDB.prototype.drop = function drop() {
  var batch = this.current;

  assert(this.current);
  assert(this.pending);

  this.current = null;
  this.pending = null;

  this.coinCache.drop();
  this.cacheHash.drop();
  this.cacheHeight.drop();
  this.stateCache.drop();

  batch.clear();
};

/**
 * Commit current batch.
 * @returns {Promise}
 */

ChainDB.prototype.commit = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            assert(this.current);
            assert(this.pending);

            _context2.prev = 2;
            _context2.next = 5;
            return this.current.write();

          case 5:
            _context2.next = 15;
            break;

          case 7:
            _context2.prev = 7;
            _context2.t0 = _context2['catch'](2);

            this.current = null;
            this.pending = null;
            this.coinCache.drop();
            this.cacheHash.drop();
            this.cacheHeight.drop();
            throw _context2.t0;

          case 15:

            // Overwrite the entire state
            // with our new best state
            // only if it is committed.
            // Note that alternate chain
            // tips do not commit anything.
            if (this.pending.committed) this.state = this.pending;

            this.current = null;
            this.pending = null;

            this.coinCache.commit();
            this.cacheHash.commit();
            this.cacheHeight.commit();
            this.stateCache.commit();

          case 22:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[2, 7]]);
  }));

  function commit() {
    return _ref2.apply(this, arguments);
  }

  return commit;
}();

/**
 * Test the cache for a present entry hash or height.
 * @param {Hash|Number} block - Hash or height.
 */

ChainDB.prototype.hasCache = function hasCache(block) {
  if (typeof block === 'number') return this.cacheHeight.has(block);

  assert(typeof block === 'string');

  return this.cacheHash.has(block);
};

/**
 * Get an entry directly from the LRU cache.
 * @param {Hash|Number} block - Hash or height.
 */

ChainDB.prototype.getCache = function getCache(block) {
  if (typeof block === 'number') return this.cacheHeight.get(block);

  assert(typeof block === 'string');

  return this.cacheHash.get(block);
};

/**
 * Get the height of a block by hash.
 * @param {Hash} hash
 * @returns {Promise} - Returns Number.
 */

ChainDB.prototype.getHeight = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(hash) {
    var entry, height;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (!(typeof hash === 'number')) {
              _context3.next = 2;
              break;
            }

            return _context3.abrupt('return', hash);

          case 2:

            assert(typeof hash === 'string');

            if (!(hash === encoding.NULL_HASH)) {
              _context3.next = 5;
              break;
            }

            return _context3.abrupt('return', -1);

          case 5:
            entry = this.cacheHash.get(hash);

            if (!entry) {
              _context3.next = 8;
              break;
            }

            return _context3.abrupt('return', entry.height);

          case 8:
            _context3.next = 10;
            return this.db.get(layout.h(hash));

          case 10:
            height = _context3.sent;

            if (height) {
              _context3.next = 13;
              break;
            }

            return _context3.abrupt('return', -1);

          case 13:
            return _context3.abrupt('return', height.readUInt32LE(0, true));

          case 14:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function getHeight(_x) {
    return _ref3.apply(this, arguments);
  }

  return getHeight;
}();

/**
 * Get the hash of a block by height. Note that this
 * will only return hashes in the main chain.
 * @param {Number} height
 * @returns {Promise} - Returns {@link Hash}.
 */

ChainDB.prototype.getHash = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(height) {
    var entry, hash;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            if (!(typeof height === 'string')) {
              _context4.next = 2;
              break;
            }

            return _context4.abrupt('return', height);

          case 2:

            assert(typeof height === 'number');

            if (!(height < 0)) {
              _context4.next = 5;
              break;
            }

            return _context4.abrupt('return', null);

          case 5:
            entry = this.cacheHeight.get(height);

            if (!entry) {
              _context4.next = 8;
              break;
            }

            return _context4.abrupt('return', entry.hash);

          case 8:
            _context4.next = 10;
            return this.db.get(layout.H(height));

          case 10:
            hash = _context4.sent;

            if (hash) {
              _context4.next = 13;
              break;
            }

            return _context4.abrupt('return', null);

          case 13:
            return _context4.abrupt('return', hash.toString('hex'));

          case 14:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function getHash(_x2) {
    return _ref4.apply(this, arguments);
  }

  return getHash;
}();

/**
 * Retrieve a chain entry by height.
 * @param {Number} height
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

ChainDB.prototype.getEntryByHeight = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(height) {
    var cache, data, hash, state, entry;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            assert(typeof height === 'number');

            if (!(height < 0)) {
              _context5.next = 3;
              break;
            }

            return _context5.abrupt('return', null);

          case 3:
            cache = this.cacheHeight.get(height);

            if (!cache) {
              _context5.next = 6;
              break;
            }

            return _context5.abrupt('return', cache);

          case 6:
            _context5.next = 8;
            return this.db.get(layout.H(height));

          case 8:
            data = _context5.sent;

            if (data) {
              _context5.next = 11;
              break;
            }

            return _context5.abrupt('return', null);

          case 11:
            hash = data.toString('hex');
            state = this.state;
            _context5.next = 15;
            return this.getEntryByHash(hash);

          case 15:
            entry = _context5.sent;

            if (entry) {
              _context5.next = 18;
              break;
            }

            return _context5.abrupt('return', null);

          case 18:

            // By the time getEntry has completed,
            // a reorg may have occurred. This entry
            // may not be on the main chain anymore.
            if (this.state === state) this.cacheHeight.set(entry.height, entry);

            return _context5.abrupt('return', entry);

          case 20:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function getEntryByHeight(_x3) {
    return _ref5.apply(this, arguments);
  }

  return getEntryByHeight;
}();

/**
 * Retrieve a chain entry by hash.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

ChainDB.prototype.getEntryByHash = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(hash) {
    var cache, raw, entry;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            assert(typeof hash === 'string');

            if (!(hash === encoding.NULL_HASH)) {
              _context6.next = 3;
              break;
            }

            return _context6.abrupt('return', null);

          case 3:
            cache = this.cacheHash.get(hash);

            if (!cache) {
              _context6.next = 6;
              break;
            }

            return _context6.abrupt('return', cache);

          case 6:
            _context6.next = 8;
            return this.db.get(layout.e(hash));

          case 8:
            raw = _context6.sent;

            if (raw) {
              _context6.next = 11;
              break;
            }

            return _context6.abrupt('return', null);

          case 11:
            entry = ChainEntry.fromRaw(raw);

            // There's no efficient way to check whether
            // this is in the main chain or not, so
            // don't add it to the height cache.

            this.cacheHash.set(entry.hash, entry);

            return _context6.abrupt('return', entry);

          case 14:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function getEntryByHash(_x4) {
    return _ref6.apply(this, arguments);
  }

  return getEntryByHash;
}();

/**
 * Retrieve a chain entry.
 * @param {Number|Hash} block - Height or hash.
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

ChainDB.prototype.getEntry = function getEntry(block) {
  if (typeof block === 'number') return this.getEntryByHeight(block);
  return this.getEntryByHash(block);
};

/**
 * Test whether the chain contains a block.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

ChainDB.prototype.hasEntry = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(hash) {
    var height;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            _context7.next = 2;
            return this.getHeight(hash);

          case 2:
            height = _context7.sent;
            return _context7.abrupt('return', height !== -1);

          case 4:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function hasEntry(_x5) {
    return _ref7.apply(this, arguments);
  }

  return hasEntry;
}();

/**
 * Get ancestor by `height`.
 * @param {ChainEntry} entry
 * @param {Number} height
 * @returns {Promise} - Returns ChainEntry.
 */

ChainDB.prototype.getAncestor = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(entry, height) {
    var cache;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            if (!(height < 0)) {
              _context8.next = 2;
              break;
            }

            return _context8.abrupt('return', null);

          case 2:

            assert(height >= 0);
            assert(height <= entry.height);

            _context8.next = 6;
            return this.isMainChain(entry);

          case 6:
            if (!_context8.sent) {
              _context8.next = 10;
              break;
            }

            _context8.next = 9;
            return this.getEntryByHeight(height);

          case 9:
            return _context8.abrupt('return', _context8.sent);

          case 10:
            if (!(entry.height !== height)) {
              _context8.next = 22;
              break;
            }

            cache = this.getPrevCache(entry);

            if (!cache) {
              _context8.next = 16;
              break;
            }

            entry = cache;
            _context8.next = 19;
            break;

          case 16:
            _context8.next = 18;
            return this.getPrevious(entry);

          case 18:
            entry = _context8.sent;

          case 19:

            assert(entry);
            _context8.next = 10;
            break;

          case 22:
            return _context8.abrupt('return', entry);

          case 23:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function getAncestor(_x6, _x7) {
    return _ref8.apply(this, arguments);
  }

  return getAncestor;
}();

/**
 * Get previous entry.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns ChainEntry.
 */

ChainDB.prototype.getPrevious = function getPrevious(entry) {
  return this.getEntryByHash(entry.prevBlock);
};

/**
 * Get previous cached entry.
 * @param {ChainEntry} entry
 * @returns {ChainEntry|null}
 */

ChainDB.prototype.getPrevCache = function getPrevCache(entry) {
  return this.cacheHash.get(entry.prevBlock) || null;
};

/**
 * Get next entry.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns ChainEntry.
 */

ChainDB.prototype.getNext = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(entry) {
    var hash;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _context9.next = 2;
            return this.getNextHash(entry.hash);

          case 2:
            hash = _context9.sent;

            if (hash) {
              _context9.next = 5;
              break;
            }

            return _context9.abrupt('return', null);

          case 5:
            _context9.next = 7;
            return this.getEntryByHash(hash);

          case 7:
            return _context9.abrupt('return', _context9.sent);

          case 8:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function getNext(_x8) {
    return _ref9.apply(this, arguments);
  }

  return getNext;
}();

/**
 * Get next entry.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns ChainEntry.
 */

ChainDB.prototype.getNextEntry = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(entry) {
    var next;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            _context10.next = 2;
            return this.getEntryByHeight(entry.height + 1);

          case 2:
            next = _context10.sent;

            if (next) {
              _context10.next = 5;
              break;
            }

            return _context10.abrupt('return', null);

          case 5:
            if (!(next.prevBlock !== entry.hash)) {
              _context10.next = 7;
              break;
            }

            return _context10.abrupt('return', null);

          case 7:
            return _context10.abrupt('return', next);

          case 8:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function getNextEntry(_x9) {
    return _ref10.apply(this, arguments);
  }

  return getNextEntry;
}();

/**
 * Retrieve the tip entry from the tip record.
 * @returns {Promise} - Returns {@link ChainEntry}.
 */

ChainDB.prototype.getTip = function getTip() {
  return this.getEntryByHash(this.state.tip);
};

/**
 * Retrieve the tip entry from the tip record.
 * @returns {Promise} - Returns {@link ChainState}.
 */

ChainDB.prototype.getState = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11() {
    var data;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            _context11.next = 2;
            return this.db.get(layout.R);

          case 2:
            data = _context11.sent;

            if (data) {
              _context11.next = 5;
              break;
            }

            return _context11.abrupt('return', null);

          case 5:
            return _context11.abrupt('return', ChainState.fromRaw(data));

          case 6:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function getState() {
    return _ref11.apply(this, arguments);
  }

  return getState;
}();

/**
 * Write genesis block to database.
 * @returns {Promise}
 */

ChainDB.prototype.saveGenesis = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12() {
    var genesis, block, entry;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            genesis = this.network.genesisBlock;
            block = Block.fromRaw(genesis, 'hex');
            entry = ChainEntry.fromBlock(block);


            this.logger.info('Writing genesis block to ChainDB.');

            _context12.next = 6;
            return this.save(entry, block, new CoinView());

          case 6:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function saveGenesis() {
    return _ref12.apply(this, arguments);
  }

  return saveGenesis;
}();

/**
 * Retrieve the database flags.
 * @returns {Promise} - Returns {@link ChainFlags}.
 */

ChainDB.prototype.getFlags = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13() {
    var data;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            _context13.next = 2;
            return this.db.get(layout.O);

          case 2:
            data = _context13.sent;

            if (data) {
              _context13.next = 5;
              break;
            }

            return _context13.abrupt('return', null);

          case 5:
            return _context13.abrupt('return', ChainFlags.fromRaw(data));

          case 6:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this);
  }));

  function getFlags() {
    return _ref13.apply(this, arguments);
  }

  return getFlags;
}();

/**
 * Verify current options against db options.
 * @param {ChainState} state
 * @returns {Promise}
 */

ChainDB.prototype.verifyFlags = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(state) {
    var options, flags, needsSave, needsPrune;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            options = this.options;
            _context14.next = 3;
            return this.getFlags();

          case 3:
            flags = _context14.sent;
            needsSave = false;
            needsPrune = false;

            if (flags) {
              _context14.next = 8;
              break;
            }

            throw new Error('No flags found.');

          case 8:
            if (!(options.network !== flags.network)) {
              _context14.next = 10;
              break;
            }

            throw new Error('Network mismatch for chain.');

          case 10:
            if (!(options.spv && !flags.spv)) {
              _context14.next = 12;
              break;
            }

            throw new Error('Cannot retroactively enable SPV.');

          case 12:
            if (!(!options.spv && flags.spv)) {
              _context14.next = 14;
              break;
            }

            throw new Error('Cannot retroactively disable SPV.');

          case 14:
            if (flags.witness) {
              _context14.next = 18;
              break;
            }

            if (options.forceFlags) {
              _context14.next = 17;
              break;
            }

            throw new Error('Cannot retroactively enable witness.');

          case 17:
            needsSave = true;

          case 18:
            if (!(options.bip91 !== flags.bip91)) {
              _context14.next = 22;
              break;
            }

            if (options.forceFlags) {
              _context14.next = 21;
              break;
            }

            throw new Error('Cannot retroactively alter BIP91 flag.');

          case 21:
            needsSave = true;

          case 22:
            if (!(options.bip148 !== flags.bip148)) {
              _context14.next = 26;
              break;
            }

            if (options.forceFlags) {
              _context14.next = 25;
              break;
            }

            throw new Error('Cannot retroactively alter BIP148 flag.');

          case 25:
            needsSave = true;

          case 26:
            if (!(options.prune && !flags.prune)) {
              _context14.next = 30;
              break;
            }

            if (options.forceFlags) {
              _context14.next = 29;
              break;
            }

            throw new Error('Cannot retroactively prune.');

          case 29:
            needsPrune = true;

          case 30:
            if (!(!options.prune && flags.prune)) {
              _context14.next = 32;
              break;
            }

            throw new Error('Cannot retroactively unprune.');

          case 32:
            if (!(options.indexTX && !flags.indexTX)) {
              _context14.next = 34;
              break;
            }

            throw new Error('Cannot retroactively enable TX indexing.');

          case 34:
            if (!(!options.indexTX && flags.indexTX)) {
              _context14.next = 36;
              break;
            }

            throw new Error('Cannot retroactively disable TX indexing.');

          case 36:
            if (!(options.indexAddress && !flags.indexAddress)) {
              _context14.next = 38;
              break;
            }

            throw new Error('Cannot retroactively enable address indexing.');

          case 38:
            if (!(!options.indexAddress && flags.indexAddress)) {
              _context14.next = 40;
              break;
            }

            throw new Error('Cannot retroactively disable address indexing.');

          case 40:
            if (!needsSave) {
              _context14.next = 45;
              break;
            }

            _context14.next = 43;
            return this.logger.info('Rewriting chain flags.');

          case 43:
            _context14.next = 45;
            return this.saveFlags();

          case 45:
            if (!needsPrune) {
              _context14.next = 50;
              break;
            }

            _context14.next = 48;
            return this.logger.info('Retroactively pruning chain.');

          case 48:
            _context14.next = 50;
            return this.prune(state.tip);

          case 50:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function verifyFlags(_x10) {
    return _ref14.apply(this, arguments);
  }

  return verifyFlags;
}();

/**
 * Get state caches.
 * @returns {Promise} - Returns {@link StateCache}.
 */

ChainDB.prototype.getStateCache = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15() {
    var stateCache, items, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item, _layout$vv, _layout$vv2, bit, hash, state;

    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            stateCache = new StateCache(this.network);
            _context15.next = 3;
            return this.db.range({
              gte: layout.v(0, encoding.ZERO_HASH),
              lte: layout.v(255, encoding.MAX_HASH),
              values: true
            });

          case 3:
            items = _context15.sent;
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context15.prev = 7;


            for (_iterator = (0, _getIterator3.default)(items); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              item = _step.value;
              _layout$vv = layout.vv(item.key), _layout$vv2 = (0, _slicedToArray3.default)(_layout$vv, 2), bit = _layout$vv2[0], hash = _layout$vv2[1];
              state = item.value[0];

              stateCache.insert(bit, hash, state);
            }

            _context15.next = 15;
            break;

          case 11:
            _context15.prev = 11;
            _context15.t0 = _context15['catch'](7);
            _didIteratorError = true;
            _iteratorError = _context15.t0;

          case 15:
            _context15.prev = 15;
            _context15.prev = 16;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 18:
            _context15.prev = 18;

            if (!_didIteratorError) {
              _context15.next = 21;
              break;
            }

            throw _iteratorError;

          case 21:
            return _context15.finish(18);

          case 22:
            return _context15.finish(15);

          case 23:
            return _context15.abrupt('return', stateCache);

          case 24:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getStateCache() {
    return _ref15.apply(this, arguments);
  }

  return getStateCache;
}();

/**
 * Save deployment table.
 * @returns {Promise}
 */

ChainDB.prototype.saveDeployments = function saveDeployments() {
  var batch = this.db.batch();
  this.writeDeployments(batch);
  return batch.write();
};

/**
 * Save deployment table.
 * @returns {Promise}
 */

ChainDB.prototype.writeDeployments = function writeDeployments(batch) {
  var bw = new StaticWriter(1 + 17 * this.network.deploys.length);

  bw.writeU8(this.network.deploys.length);

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(this.network.deploys), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var deployment = _step2.value;

      bw.writeU8(deployment.bit);
      bw.writeU32(deployment.startTime);
      bw.writeU32(deployment.timeout);
      bw.writeI32(deployment.threshold);
      bw.writeI32(deployment.window);
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

  batch.put(layout.V, bw.render());
};

/**
 * Check for outdated deployments.
 * @private
 * @returns {Promise}
 */

ChainDB.prototype.checkDeployments = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16() {
    var raw, br, count, invalid, i, bit, start, timeout, threshold, window, deployment;
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            _context16.next = 2;
            return this.db.get(layout.V);

          case 2:
            raw = _context16.sent;


            assert(raw, 'No deployment table found.');

            br = new BufferReader(raw);
            count = br.readU8();
            invalid = [];
            i = 0;

          case 8:
            if (!(i < count)) {
              _context16.next = 21;
              break;
            }

            bit = br.readU8();
            start = br.readU32();
            timeout = br.readU32();
            threshold = br.readI32();
            window = br.readI32();
            deployment = this.network.byBit(bit);

            if (!(deployment && start === deployment.startTime && timeout === deployment.timeout && threshold === deployment.threshold && window === deployment.window)) {
              _context16.next = 17;
              break;
            }

            return _context16.abrupt('continue', 18);

          case 17:

            invalid.push(bit);

          case 18:
            i++;
            _context16.next = 8;
            break;

          case 21:
            return _context16.abrupt('return', invalid);

          case 22:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function checkDeployments() {
    return _ref16.apply(this, arguments);
  }

  return checkDeployments;
}();

/**
 * Potentially invalidate state cache.
 * @returns {Promise}
 */

ChainDB.prototype.verifyDeployments = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17() {
    var invalid, i, batch, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, bit;

    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            invalid = void 0;
            _context17.prev = 1;
            _context17.next = 4;
            return this.checkDeployments();

          case 4:
            invalid = _context17.sent;
            _context17.next = 13;
            break;

          case 7:
            _context17.prev = 7;
            _context17.t0 = _context17['catch'](1);

            if (!(_context17.t0.type !== 'EncodingError')) {
              _context17.next = 11;
              break;
            }

            throw _context17.t0;

          case 11:
            invalid = [];
            for (i = 0; i < 32; i++) {
              invalid.push(i);
            }

          case 13:
            if (!(invalid.length === 0)) {
              _context17.next = 15;
              break;
            }

            return _context17.abrupt('return', true);

          case 15:
            batch = this.db.batch();
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context17.prev = 19;
            _iterator3 = (0, _getIterator3.default)(invalid);

          case 21:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context17.next = 30;
              break;
            }

            bit = _step3.value;

            this.logger.warning('Versionbit deployment params modified.');
            this.logger.warning('Invalidating cache for bit %d.', bit);
            _context17.next = 27;
            return this.invalidateCache(bit, batch);

          case 27:
            _iteratorNormalCompletion3 = true;
            _context17.next = 21;
            break;

          case 30:
            _context17.next = 36;
            break;

          case 32:
            _context17.prev = 32;
            _context17.t1 = _context17['catch'](19);
            _didIteratorError3 = true;
            _iteratorError3 = _context17.t1;

          case 36:
            _context17.prev = 36;
            _context17.prev = 37;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 39:
            _context17.prev = 39;

            if (!_didIteratorError3) {
              _context17.next = 42;
              break;
            }

            throw _iteratorError3;

          case 42:
            return _context17.finish(39);

          case 43:
            return _context17.finish(36);

          case 44:

            this.writeDeployments(batch);

            _context17.next = 47;
            return batch.write();

          case 47:
            return _context17.abrupt('return', false);

          case 48:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this, [[1, 7], [19, 32, 36, 44], [37,, 39, 43]]);
  }));

  function verifyDeployments() {
    return _ref17.apply(this, arguments);
  }

  return verifyDeployments;
}();

/**
 * Invalidate state cache.
 * @private
 * @returns {Promise}
 */

ChainDB.prototype.invalidateCache = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(bit, batch) {
    var keys, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, key;

    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            _context18.next = 2;
            return this.db.keys({
              gte: layout.v(bit, encoding.ZERO_HASH),
              lte: layout.v(bit, encoding.MAX_HASH)
            });

          case 2:
            keys = _context18.sent;
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context18.prev = 6;


            for (_iterator4 = (0, _getIterator3.default)(keys); !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              key = _step4.value;

              batch.del(key);
            }_context18.next = 14;
            break;

          case 10:
            _context18.prev = 10;
            _context18.t0 = _context18['catch'](6);
            _didIteratorError4 = true;
            _iteratorError4 = _context18.t0;

          case 14:
            _context18.prev = 14;
            _context18.prev = 15;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 17:
            _context18.prev = 17;

            if (!_didIteratorError4) {
              _context18.next = 20;
              break;
            }

            throw _iteratorError4;

          case 20:
            return _context18.finish(17);

          case 21:
            return _context18.finish(14);

          case 22:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this, [[6, 10, 14, 22], [15,, 17, 21]]);
  }));

  function invalidateCache(_x11, _x12) {
    return _ref18.apply(this, arguments);
  }

  return invalidateCache;
}();

/**
 * Retroactively prune the database.
 * @returns {Promise}
 */

ChainDB.prototype.prune = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19() {
    var options, keepBlocks, pruneAfter, flags, height, start, end, batch, i, hash, _flags;

    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            options = this.options;
            keepBlocks = this.network.block.keepBlocks;
            pruneAfter = this.network.block.pruneAfterHeight;
            _context19.next = 5;
            return this.getFlags();

          case 5:
            flags = _context19.sent;

            if (!flags.prune) {
              _context19.next = 8;
              break;
            }

            throw new Error('Chain is already pruned.');

          case 8:
            _context19.next = 10;
            return this.getHeight(this.state.tip);

          case 10:
            height = _context19.sent;

            if (!(height <= pruneAfter + keepBlocks)) {
              _context19.next = 13;
              break;
            }

            return _context19.abrupt('return', false);

          case 13:
            start = pruneAfter + 1;
            end = height - keepBlocks;
            batch = this.db.batch();
            i = start;

          case 17:
            if (!(i <= end)) {
              _context19.next = 28;
              break;
            }

            _context19.next = 20;
            return this.getHash(i);

          case 20:
            hash = _context19.sent;

            if (hash) {
              _context19.next = 23;
              break;
            }

            throw new Error('Cannot find hash for ' + i + '.');

          case 23:

            batch.del(layout.b(hash));
            batch.del(layout.u(hash));

          case 25:
            i++;
            _context19.next = 17;
            break;

          case 28:
            _context19.prev = 28;

            options.prune = true;

            _flags = ChainFlags.fromOptions(options);

            assert(_flags.prune);

            batch.put(layout.O, _flags.toRaw());

            _context19.next = 35;
            return batch.write();

          case 35:
            _context19.next = 41;
            break;

          case 37:
            _context19.prev = 37;
            _context19.t0 = _context19['catch'](28);

            options.prune = false;
            throw _context19.t0;

          case 41:
            _context19.next = 43;
            return this.db.compactRange();

          case 43:
            return _context19.abrupt('return', true);

          case 44:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this, [[28, 37]]);
  }));

  function prune() {
    return _ref19.apply(this, arguments);
  }

  return prune;
}();

/**
 * Get the _next_ block hash (does not work by height).
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Hash}.
 */

ChainDB.prototype.getNextHash = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(hash) {
    var data;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            _context20.next = 2;
            return this.db.get(layout.n(hash));

          case 2:
            data = _context20.sent;

            if (data) {
              _context20.next = 5;
              break;
            }

            return _context20.abrupt('return', null);

          case 5:
            return _context20.abrupt('return', data.toString('hex'));

          case 6:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function getNextHash(_x13) {
    return _ref20.apply(this, arguments);
  }

  return getNextHash;
}();

/**
 * Check to see if a block is on the main chain.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

ChainDB.prototype.isMainHash = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(hash) {
    var cacheHash, cacheHeight;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            assert(typeof hash === 'string');

            if (!(hash === encoding.NULL_HASH)) {
              _context21.next = 3;
              break;
            }

            return _context21.abrupt('return', false);

          case 3:
            if (!(hash === this.network.genesis.hash)) {
              _context21.next = 5;
              break;
            }

            return _context21.abrupt('return', true);

          case 5:
            if (!(hash === this.state.tip)) {
              _context21.next = 7;
              break;
            }

            return _context21.abrupt('return', true);

          case 7:
            cacheHash = this.cacheHash.get(hash);

            if (!cacheHash) {
              _context21.next = 12;
              break;
            }

            cacheHeight = this.cacheHeight.get(cacheHash.height);

            if (!cacheHeight) {
              _context21.next = 12;
              break;
            }

            return _context21.abrupt('return', cacheHeight.hash === hash);

          case 12:
            _context21.next = 14;
            return this.getNextHash(hash);

          case 14:
            if (!_context21.sent) {
              _context21.next = 16;
              break;
            }

            return _context21.abrupt('return', true);

          case 16:
            return _context21.abrupt('return', false);

          case 17:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function isMainHash(_x14) {
    return _ref21.apply(this, arguments);
  }

  return isMainHash;
}();

/**
 * Test whether the entry is in the main chain.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns Boolean.
 */

ChainDB.prototype.isMainChain = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(entry) {
    var cache;
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            if (!entry.isGenesis()) {
              _context22.next = 2;
              break;
            }

            return _context22.abrupt('return', true);

          case 2:
            if (!(entry.hash === this.state.tip)) {
              _context22.next = 4;
              break;
            }

            return _context22.abrupt('return', true);

          case 4:
            cache = this.getCache(entry.height);

            if (!cache) {
              _context22.next = 7;
              break;
            }

            return _context22.abrupt('return', entry.hash === cache.hash);

          case 7:
            _context22.next = 9;
            return this.getNextHash(entry.hash);

          case 9:
            if (!_context22.sent) {
              _context22.next = 11;
              break;
            }

            return _context22.abrupt('return', true);

          case 11:
            return _context22.abrupt('return', false);

          case 12:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function isMainChain(_x15) {
    return _ref22.apply(this, arguments);
  }

  return isMainChain;
}();

/**
 * Get all entries.
 * @returns {Promise} - Returns {@link ChainEntry}[].
 */

ChainDB.prototype.getEntries = function getEntries() {
  return this.db.values({
    gte: layout.e(encoding.ZERO_HASH),
    lte: layout.e(encoding.MAX_HASH),
    parse: function parse(value) {
      return ChainEntry.fromRaw(value);
    }
  });
};

/**
 * Get all tip hashes.
 * @returns {Promise} - Returns {@link Hash}[].
 */

ChainDB.prototype.getTips = function getTips() {
  return this.db.keys({
    gte: layout.p(encoding.ZERO_HASH),
    lte: layout.p(encoding.MAX_HASH),
    parse: layout.pp
  });
};

/**
 * Get a coin (unspents only).
 * @private
 * @param {Outpoint} prevout
 * @returns {Promise} - Returns {@link CoinEntry}.
 */

ChainDB.prototype.readCoin = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(prevout) {
    var hash, index, key, state, cache, raw;
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            if (!this.options.spv) {
              _context23.next = 2;
              break;
            }

            return _context23.abrupt('return', null);

          case 2:
            hash = prevout.hash, index = prevout.index;
            key = prevout.toKey();
            state = this.state;
            cache = this.coinCache.get(key);

            if (!cache) {
              _context23.next = 8;
              break;
            }

            return _context23.abrupt('return', CoinEntry.fromRaw(cache));

          case 8:
            _context23.next = 10;
            return this.db.get(layout.c(hash, index));

          case 10:
            raw = _context23.sent;

            if (raw) {
              _context23.next = 13;
              break;
            }

            return _context23.abrupt('return', null);

          case 13:

            if (state === this.state) this.coinCache.set(key, raw);

            return _context23.abrupt('return', CoinEntry.fromRaw(raw));

          case 15:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function readCoin(_x16) {
    return _ref23.apply(this, arguments);
  }

  return readCoin;
}();

/**
 * Get a coin (unspents only).
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns {@link Coin}.
 */

ChainDB.prototype.getCoin = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(hash, index) {
    var prevout, coin;
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            prevout = new Outpoint(hash, index);
            _context24.next = 3;
            return this.readCoin(prevout);

          case 3:
            coin = _context24.sent;

            if (coin) {
              _context24.next = 6;
              break;
            }

            return _context24.abrupt('return', null);

          case 6:
            return _context24.abrupt('return', coin.toCoin(prevout));

          case 7:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function getCoin(_x17, _x18) {
    return _ref24.apply(this, arguments);
  }

  return getCoin;
}();

/**
 * Check whether coins are still unspent. Necessary for bip30.
 * @see https://bitcointalk.org/index.php?topic=67738.0
 * @param {TX} tx
 * @returns {Promise} - Returns Boolean.
 */

ChainDB.prototype.hasCoins = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(tx) {
    var i, key;
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            i = 0;

          case 1:
            if (!(i < tx.outputs.length)) {
              _context25.next = 10;
              break;
            }

            key = layout.c(tx.hash(), i);
            _context25.next = 5;
            return this.db.has(key);

          case 5:
            if (!_context25.sent) {
              _context25.next = 7;
              break;
            }

            return _context25.abrupt('return', true);

          case 7:
            i++;
            _context25.next = 1;
            break;

          case 10:
            return _context25.abrupt('return', false);

          case 11:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this);
  }));

  function hasCoins(_x19) {
    return _ref25.apply(this, arguments);
  }

  return hasCoins;
}();

/**
 * Get coin viewpoint.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

ChainDB.prototype.getCoinView = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(tx) {
    var view, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _ref27, prevout, coin;

    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            view = new CoinView();
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context26.prev = 4;
            _iterator5 = (0, _getIterator3.default)(tx.inputs);

          case 6:
            if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
              _context26.next = 16;
              break;
            }

            _ref27 = _step5.value;
            prevout = _ref27.prevout;
            _context26.next = 11;
            return this.readCoin(prevout);

          case 11:
            coin = _context26.sent;


            if (coin) view.addEntry(prevout, coin);

          case 13:
            _iteratorNormalCompletion5 = true;
            _context26.next = 6;
            break;

          case 16:
            _context26.next = 22;
            break;

          case 18:
            _context26.prev = 18;
            _context26.t0 = _context26['catch'](4);
            _didIteratorError5 = true;
            _iteratorError5 = _context26.t0;

          case 22:
            _context26.prev = 22;
            _context26.prev = 23;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 25:
            _context26.prev = 25;

            if (!_didIteratorError5) {
              _context26.next = 28;
              break;
            }

            throw _iteratorError5;

          case 28:
            return _context26.finish(25);

          case 29:
            return _context26.finish(22);

          case 30:
            return _context26.abrupt('return', view);

          case 31:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this, [[4, 18, 22, 30], [23,, 25, 29]]);
  }));

  function getCoinView(_x20) {
    return _ref26.apply(this, arguments);
  }

  return getCoinView;
}();

/**
 * Get coin viewpoint (historical).
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

ChainDB.prototype.getSpentView = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(tx) {
    var view, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, _ref29, prevout, hash, index, meta, _tx, height;

    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            _context27.next = 2;
            return this.getCoinView(tx);

          case 2:
            view = _context27.sent;
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context27.prev = 6;
            _iterator6 = (0, _getIterator3.default)(tx.inputs);

          case 8:
            if (_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done) {
              _context27.next = 24;
              break;
            }

            _ref29 = _step6.value;
            prevout = _ref29.prevout;

            if (!view.hasEntry(prevout)) {
              _context27.next = 13;
              break;
            }

            return _context27.abrupt('continue', 21);

          case 13:
            hash = prevout.hash, index = prevout.index;
            _context27.next = 16;
            return this.getMeta(hash);

          case 16:
            meta = _context27.sent;

            if (meta) {
              _context27.next = 19;
              break;
            }

            return _context27.abrupt('continue', 21);

          case 19:
            _tx = meta.tx, height = meta.height;


            if (index < _tx.outputs.length) view.addIndex(_tx, index, height);

          case 21:
            _iteratorNormalCompletion6 = true;
            _context27.next = 8;
            break;

          case 24:
            _context27.next = 30;
            break;

          case 26:
            _context27.prev = 26;
            _context27.t0 = _context27['catch'](6);
            _didIteratorError6 = true;
            _iteratorError6 = _context27.t0;

          case 30:
            _context27.prev = 30;
            _context27.prev = 31;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 33:
            _context27.prev = 33;

            if (!_didIteratorError6) {
              _context27.next = 36;
              break;
            }

            throw _iteratorError6;

          case 36:
            return _context27.finish(33);

          case 37:
            return _context27.finish(30);

          case 38:
            return _context27.abrupt('return', view);

          case 39:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this, [[6, 26, 30, 38], [31,, 33, 37]]);
  }));

  function getSpentView(_x21) {
    return _ref28.apply(this, arguments);
  }

  return getSpentView;
}();

/**
 * Get coins necessary to be resurrected during a reorg.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Coin}[].
 */

ChainDB.prototype.getUndoCoins = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(hash) {
    var data;
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            _context28.next = 2;
            return this.db.get(layout.u(hash));

          case 2:
            data = _context28.sent;

            if (data) {
              _context28.next = 5;
              break;
            }

            return _context28.abrupt('return', new UndoCoins());

          case 5:
            return _context28.abrupt('return', UndoCoins.fromRaw(data));

          case 6:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this);
  }));

  function getUndoCoins(_x22) {
    return _ref30.apply(this, arguments);
  }

  return getUndoCoins;
}();

/**
 * Retrieve a block from the database (not filled with coins).
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Block}.
 */

ChainDB.prototype.getBlock = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(hash) {
    var data;
    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            _context29.next = 2;
            return this.getRawBlock(hash);

          case 2:
            data = _context29.sent;

            if (data) {
              _context29.next = 5;
              break;
            }

            return _context29.abrupt('return', null);

          case 5:
            return _context29.abrupt('return', Block.fromRaw(data));

          case 6:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this);
  }));

  function getBlock(_x23) {
    return _ref31.apply(this, arguments);
  }

  return getBlock;
}();

/**
 * Retrieve a block from the database (not filled with coins).
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Block}.
 */

ChainDB.prototype.getRawBlock = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(block) {
    var hash;
    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            if (!this.options.spv) {
              _context30.next = 2;
              break;
            }

            return _context30.abrupt('return', null);

          case 2:
            _context30.next = 4;
            return this.getHash(block);

          case 4:
            hash = _context30.sent;

            if (hash) {
              _context30.next = 7;
              break;
            }

            return _context30.abrupt('return', null);

          case 7:
            _context30.next = 9;
            return this.db.get(layout.b(hash));

          case 9:
            return _context30.abrupt('return', _context30.sent);

          case 10:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this);
  }));

  function getRawBlock(_x24) {
    return _ref32.apply(this, arguments);
  }

  return getRawBlock;
}();

/**
 * Get a historical block coin viewpoint.
 * @param {Block} hash
 * @returns {Promise} - Returns {@link CoinView}.
 */

ChainDB.prototype.getBlockView = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(block) {
    var view, undo, i, tx, j, input;
    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            view = new CoinView();
            _context31.next = 3;
            return this.getUndoCoins(block.hash());

          case 3:
            undo = _context31.sent;

            if (!undo.isEmpty()) {
              _context31.next = 6;
              break;
            }

            return _context31.abrupt('return', view);

          case 6:

            for (i = block.txs.length - 1; i > 0; i--) {
              tx = block.txs[i];


              for (j = tx.inputs.length - 1; j >= 0; j--) {
                input = tx.inputs[j];

                undo.apply(view, input.prevout);
              }
            }

            // Undo coins should be empty.
            assert(undo.isEmpty(), 'Undo coins data inconsistency.');

            return _context31.abrupt('return', view);

          case 9:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this);
  }));

  function getBlockView(_x25) {
    return _ref33.apply(this, arguments);
  }

  return getBlockView;
}();

/**
 * Get a transaction with metadata.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TXMeta}.
 */

ChainDB.prototype.getMeta = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(hash) {
    var data;
    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            if (this.options.indexTX) {
              _context32.next = 2;
              break;
            }

            return _context32.abrupt('return', null);

          case 2:
            _context32.next = 4;
            return this.db.get(layout.t(hash));

          case 4:
            data = _context32.sent;

            if (data) {
              _context32.next = 7;
              break;
            }

            return _context32.abrupt('return', null);

          case 7:
            return _context32.abrupt('return', TXMeta.fromRaw(data));

          case 8:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this);
  }));

  function getMeta(_x26) {
    return _ref34.apply(this, arguments);
  }

  return getMeta;
}();

/**
 * Retrieve a transaction.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TX}.
 */

ChainDB.prototype.getTX = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(hash) {
    var meta;
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            _context33.next = 2;
            return this.getMeta(hash);

          case 2:
            meta = _context33.sent;

            if (meta) {
              _context33.next = 5;
              break;
            }

            return _context33.abrupt('return', null);

          case 5:
            return _context33.abrupt('return', meta.tx);

          case 6:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this);
  }));

  function getTX(_x27) {
    return _ref35.apply(this, arguments);
  }

  return getTX;
}();

/**
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

ChainDB.prototype.hasTX = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(hash) {
    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            if (this.options.indexTX) {
              _context34.next = 2;
              break;
            }

            return _context34.abrupt('return', false);

          case 2:
            _context34.next = 4;
            return this.db.has(layout.t(hash));

          case 4:
            return _context34.abrupt('return', _context34.sent);

          case 5:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this);
  }));

  function hasTX(_x28) {
    return _ref36.apply(this, arguments);
  }

  return hasTX;
}();

/**
 * Get all coins pertinent to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link Coin}[].
 */

ChainDB.prototype.getCoinsByAddress = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(addrs) {
    var coins, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, addr, hash, keys, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, _ref38, _ref39, _hash, index, coin;

    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            if (this.options.indexAddress) {
              _context35.next = 2;
              break;
            }

            return _context35.abrupt('return', []);

          case 2:

            if (!Array.isArray(addrs)) addrs = [addrs];

            coins = [];
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context35.prev = 7;
            _iterator7 = (0, _getIterator3.default)(addrs);

          case 9:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context35.next = 50;
              break;
            }

            addr = _step7.value;
            hash = Address.getHash(addr);
            _context35.next = 14;
            return this.db.keys({
              gte: layout.C(hash, encoding.ZERO_HASH, 0),
              lte: layout.C(hash, encoding.MAX_HASH, 0xffffffff),
              parse: layout.Cc
            });

          case 14:
            keys = _context35.sent;
            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context35.prev = 18;
            _iterator8 = (0, _getIterator3.default)(keys);

          case 20:
            if (_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done) {
              _context35.next = 33;
              break;
            }

            _ref38 = _step8.value;
            _ref39 = (0, _slicedToArray3.default)(_ref38, 2);
            _hash = _ref39[0];
            index = _ref39[1];
            _context35.next = 27;
            return this.getCoin(_hash, index);

          case 27:
            coin = _context35.sent;

            assert(coin);
            coins.push(coin);

          case 30:
            _iteratorNormalCompletion8 = true;
            _context35.next = 20;
            break;

          case 33:
            _context35.next = 39;
            break;

          case 35:
            _context35.prev = 35;
            _context35.t0 = _context35['catch'](18);
            _didIteratorError8 = true;
            _iteratorError8 = _context35.t0;

          case 39:
            _context35.prev = 39;
            _context35.prev = 40;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 42:
            _context35.prev = 42;

            if (!_didIteratorError8) {
              _context35.next = 45;
              break;
            }

            throw _iteratorError8;

          case 45:
            return _context35.finish(42);

          case 46:
            return _context35.finish(39);

          case 47:
            _iteratorNormalCompletion7 = true;
            _context35.next = 9;
            break;

          case 50:
            _context35.next = 56;
            break;

          case 52:
            _context35.prev = 52;
            _context35.t1 = _context35['catch'](7);
            _didIteratorError7 = true;
            _iteratorError7 = _context35.t1;

          case 56:
            _context35.prev = 56;
            _context35.prev = 57;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 59:
            _context35.prev = 59;

            if (!_didIteratorError7) {
              _context35.next = 62;
              break;
            }

            throw _iteratorError7;

          case 62:
            return _context35.finish(59);

          case 63:
            return _context35.finish(56);

          case 64:
            return _context35.abrupt('return', coins);

          case 65:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this, [[7, 52, 56, 64], [18, 35, 39, 47], [40,, 42, 46], [57,, 59, 63]]);
  }));

  function getCoinsByAddress(_x29) {
    return _ref37.apply(this, arguments);
  }

  return getCoinsByAddress;
}();

/**
 * Get all transaction hashes to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link Hash}[].
 */

ChainDB.prototype.getHashesByAddress = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(addrs) {
    var hashes, _iteratorNormalCompletion9, _didIteratorError9, _iteratorError9, _iterator9, _step9, addr, hash;

    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            if (!(!this.options.indexTX || !this.options.indexAddress)) {
              _context36.next = 2;
              break;
            }

            return _context36.abrupt('return', []);

          case 2:
            hashes = (0, _create2.default)(null);
            _iteratorNormalCompletion9 = true;
            _didIteratorError9 = false;
            _iteratorError9 = undefined;
            _context36.prev = 6;
            _iterator9 = (0, _getIterator3.default)(addrs);

          case 8:
            if (_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done) {
              _context36.next = 16;
              break;
            }

            addr = _step9.value;
            hash = Address.getHash(addr);
            _context36.next = 13;
            return this.db.keys({
              gte: layout.T(hash, encoding.ZERO_HASH),
              lte: layout.T(hash, encoding.MAX_HASH),
              parse: function parse(key) {
                var hash = layout.Tt(key);
                hashes[hash] = true;
              }
            });

          case 13:
            _iteratorNormalCompletion9 = true;
            _context36.next = 8;
            break;

          case 16:
            _context36.next = 22;
            break;

          case 18:
            _context36.prev = 18;
            _context36.t0 = _context36['catch'](6);
            _didIteratorError9 = true;
            _iteratorError9 = _context36.t0;

          case 22:
            _context36.prev = 22;
            _context36.prev = 23;

            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }

          case 25:
            _context36.prev = 25;

            if (!_didIteratorError9) {
              _context36.next = 28;
              break;
            }

            throw _iteratorError9;

          case 28:
            return _context36.finish(25);

          case 29:
            return _context36.finish(22);

          case 30:
            return _context36.abrupt('return', (0, _keys2.default)(hashes));

          case 31:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this, [[6, 18, 22, 30], [23,, 25, 29]]);
  }));

  function getHashesByAddress(_x30) {
    return _ref40.apply(this, arguments);
  }

  return getHashesByAddress;
}();

/**
 * Get all transactions pertinent to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link TX}[].
 */

ChainDB.prototype.getTXByAddress = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(addrs) {
    var mtxs, out, _iteratorNormalCompletion10, _didIteratorError10, _iteratorError10, _iterator10, _step10, mtx;

    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            _context37.next = 2;
            return this.getMetaByAddress(addrs);

          case 2:
            mtxs = _context37.sent;
            out = [];
            _iteratorNormalCompletion10 = true;
            _didIteratorError10 = false;
            _iteratorError10 = undefined;
            _context37.prev = 7;


            for (_iterator10 = (0, _getIterator3.default)(mtxs); !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
              mtx = _step10.value;

              out.push(mtx.tx);
            }_context37.next = 15;
            break;

          case 11:
            _context37.prev = 11;
            _context37.t0 = _context37['catch'](7);
            _didIteratorError10 = true;
            _iteratorError10 = _context37.t0;

          case 15:
            _context37.prev = 15;
            _context37.prev = 16;

            if (!_iteratorNormalCompletion10 && _iterator10.return) {
              _iterator10.return();
            }

          case 18:
            _context37.prev = 18;

            if (!_didIteratorError10) {
              _context37.next = 21;
              break;
            }

            throw _iteratorError10;

          case 21:
            return _context37.finish(18);

          case 22:
            return _context37.finish(15);

          case 23:
            return _context37.abrupt('return', out);

          case 24:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getTXByAddress(_x31) {
    return _ref41.apply(this, arguments);
  }

  return getTXByAddress;
}();

/**
 * Get all transactions pertinent to an address.
 * @param {Address[]} addrs
 * @returns {Promise} - Returns {@link TXMeta}[].
 */

ChainDB.prototype.getMetaByAddress = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(addrs) {
    var hashes, txs, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, hash, tx;

    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            if (!(!this.options.indexTX || !this.options.indexAddress)) {
              _context38.next = 2;
              break;
            }

            return _context38.abrupt('return', []);

          case 2:

            if (!Array.isArray(addrs)) addrs = [addrs];

            _context38.next = 5;
            return this.getHashesByAddress(addrs);

          case 5:
            hashes = _context38.sent;
            txs = [];
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context38.prev = 10;
            _iterator11 = (0, _getIterator3.default)(hashes);

          case 12:
            if (_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done) {
              _context38.next = 22;
              break;
            }

            hash = _step11.value;
            _context38.next = 16;
            return this.getMeta(hash);

          case 16:
            tx = _context38.sent;

            assert(tx);
            txs.push(tx);

          case 19:
            _iteratorNormalCompletion11 = true;
            _context38.next = 12;
            break;

          case 22:
            _context38.next = 28;
            break;

          case 24:
            _context38.prev = 24;
            _context38.t0 = _context38['catch'](10);
            _didIteratorError11 = true;
            _iteratorError11 = _context38.t0;

          case 28:
            _context38.prev = 28;
            _context38.prev = 29;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 31:
            _context38.prev = 31;

            if (!_didIteratorError11) {
              _context38.next = 34;
              break;
            }

            throw _iteratorError11;

          case 34:
            return _context38.finish(31);

          case 35:
            return _context38.finish(28);

          case 36:
            return _context38.abrupt('return', txs);

          case 37:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this, [[10, 24, 28, 36], [29,, 31, 35]]);
  }));

  function getMetaByAddress(_x32) {
    return _ref42.apply(this, arguments);
  }

  return getMetaByAddress;
}();

/**
 * Scan the blockchain for transactions containing specified address hashes.
 * @param {Hash} start - Block hash to start at.
 * @param {Bloom} filter - Bloom filter containing tx and address hashes.
 * @param {Function} iter - Iterator.
 * @returns {Promise}
 */

ChainDB.prototype.scan = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(start, filter, iter) {
    var entry, total, block, txs, i, tx, found, j, output, hash, prevout, _iteratorNormalCompletion12, _didIteratorError12, _iteratorError12, _iterator12, _step12, _ref44, _prevout;

    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            if (start == null) start = this.network.genesis.hash;

            if (typeof start === 'number') this.logger.info('Scanning from height %d.', start);else this.logger.info('Scanning from block %s.', util.revHex(start));

            _context39.next = 4;
            return this.getEntry(start);

          case 4:
            entry = _context39.sent;

            if (entry) {
              _context39.next = 7;
              break;
            }

            return _context39.abrupt('return');

          case 7:
            _context39.next = 9;
            return this.isMainChain(entry);

          case 9:
            if (_context39.sent) {
              _context39.next = 11;
              break;
            }

            throw new Error('Cannot rescan an alternate chain.');

          case 11:
            total = 0;

          case 12:
            if (!entry) {
              _context39.next = 85;
              break;
            }

            _context39.next = 15;
            return this.getBlock(entry.hash);

          case 15:
            block = _context39.sent;
            txs = [];


            total++;

            if (block) {
              _context39.next = 27;
              break;
            }

            if (!(!this.options.spv && !this.options.prune)) {
              _context39.next = 21;
              break;
            }

            throw new Error('Block not found.');

          case 21:
            _context39.next = 23;
            return iter(entry, txs);

          case 23:
            _context39.next = 25;
            return this.getNext(entry);

          case 25:
            entry = _context39.sent;
            return _context39.abrupt('continue', 12);

          case 27:

            this.logger.info('Scanning block %s (%d).', entry.rhash(), entry.height);

            i = 0;

          case 29:
            if (!(i < block.txs.length)) {
              _context39.next = 78;
              break;
            }

            tx = block.txs[i];
            found = false;
            j = 0;

          case 33:
            if (!(j < tx.outputs.length)) {
              _context39.next = 42;
              break;
            }

            output = tx.outputs[j];
            hash = output.getHash();

            if (hash) {
              _context39.next = 38;
              break;
            }

            return _context39.abrupt('continue', 39);

          case 38:

            if (filter.test(hash)) {
              prevout = Outpoint.fromTX(tx, j);

              filter.add(prevout.toRaw());
              found = true;
            }

          case 39:
            j++;
            _context39.next = 33;
            break;

          case 42:
            if (!found) {
              _context39.next = 45;
              break;
            }

            txs.push(tx);
            return _context39.abrupt('continue', 75);

          case 45:
            if (!(i === 0)) {
              _context39.next = 47;
              break;
            }

            return _context39.abrupt('continue', 75);

          case 47:
            _iteratorNormalCompletion12 = true;
            _didIteratorError12 = false;
            _iteratorError12 = undefined;
            _context39.prev = 50;
            _iterator12 = (0, _getIterator3.default)(tx.inputs);

          case 52:
            if (_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done) {
              _context39.next = 61;
              break;
            }

            _ref44 = _step12.value;
            _prevout = _ref44.prevout;

            if (!filter.test(_prevout.toRaw())) {
              _context39.next = 58;
              break;
            }

            txs.push(tx);
            return _context39.abrupt('break', 61);

          case 58:
            _iteratorNormalCompletion12 = true;
            _context39.next = 52;
            break;

          case 61:
            _context39.next = 67;
            break;

          case 63:
            _context39.prev = 63;
            _context39.t0 = _context39['catch'](50);
            _didIteratorError12 = true;
            _iteratorError12 = _context39.t0;

          case 67:
            _context39.prev = 67;
            _context39.prev = 68;

            if (!_iteratorNormalCompletion12 && _iterator12.return) {
              _iterator12.return();
            }

          case 70:
            _context39.prev = 70;

            if (!_didIteratorError12) {
              _context39.next = 73;
              break;
            }

            throw _iteratorError12;

          case 73:
            return _context39.finish(70);

          case 74:
            return _context39.finish(67);

          case 75:
            i++;
            _context39.next = 29;
            break;

          case 78:
            _context39.next = 80;
            return iter(entry, txs);

          case 80:
            _context39.next = 82;
            return this.getNext(entry);

          case 82:
            entry = _context39.sent;
            _context39.next = 12;
            break;

          case 85:

            this.logger.info('Finished scanning %d blocks.', total);

          case 86:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this, [[50, 63, 67, 75], [68,, 70, 74]]);
  }));

  function scan(_x33, _x34, _x35) {
    return _ref43.apply(this, arguments);
  }

  return scan;
}();

/**
 * Save an entry to the database and optionally
 * connect it as the tip. Note that this method
 * does _not_ perform any verification which is
 * instead performed in {@link Chain#add}.
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {CoinView?} view - Will not connect if null.
 * @returns {Promise}
 */

ChainDB.prototype.save = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(entry, block, view) {
    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            this.start();
            _context40.prev = 1;
            _context40.next = 4;
            return this._save(entry, block, view);

          case 4:
            _context40.next = 10;
            break;

          case 6:
            _context40.prev = 6;
            _context40.t0 = _context40['catch'](1);

            this.drop();
            throw _context40.t0;

          case 10:
            _context40.next = 12;
            return this.commit();

          case 12:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this, [[1, 6]]);
  }));

  function save(_x36, _x37, _x38) {
    return _ref45.apply(this, arguments);
  }

  return save;
}();

/**
 * Save an entry without a batch.
 * @private
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {CoinView?} view
 * @returns {Promise}
 */

ChainDB.prototype._save = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(entry, block, view) {
    var hash;
    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            hash = block.hash();

            // Hash->height index.

            this.put(layout.h(hash), U32(entry.height));

            // Entry data.
            this.put(layout.e(hash), entry.toRaw());
            this.cacheHash.push(entry.hash, entry);

            // Tip index.
            this.del(layout.p(entry.prevBlock));
            this.put(layout.p(hash), null);

            // Update state caches.
            this.saveUpdates();

            if (view) {
              _context41.next = 11;
              break;
            }

            _context41.next = 10;
            return this.saveBlock(entry, block);

          case 10:
            return _context41.abrupt('return');

          case 11:

            // Hash->next-block index.
            if (!entry.isGenesis()) this.put(layout.n(entry.prevBlock), hash);

            // Height->hash index.
            this.put(layout.H(entry.height), hash);
            this.cacheHeight.push(entry.height, entry);

            // Connect block and save data.
            _context41.next = 16;
            return this.saveBlock(entry, block, view);

          case 16:

            // Commit new chain state.
            this.put(layout.R, this.pending.commit(hash));

          case 17:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this);
  }));

  function _save(_x39, _x40, _x41) {
    return _ref46.apply(this, arguments);
  }

  return _save;
}();

/**
 * Reconnect the block to the chain.
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {CoinView} view
 * @returns {Promise}
 */

ChainDB.prototype.reconnect = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(entry, block, view) {
    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            this.start();
            _context42.prev = 1;
            _context42.next = 4;
            return this._reconnect(entry, block, view);

          case 4:
            _context42.next = 10;
            break;

          case 6:
            _context42.prev = 6;
            _context42.t0 = _context42['catch'](1);

            this.drop();
            throw _context42.t0;

          case 10:
            _context42.next = 12;
            return this.commit();

          case 12:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this, [[1, 6]]);
  }));

  function reconnect(_x42, _x43, _x44) {
    return _ref47.apply(this, arguments);
  }

  return reconnect;
}();

/**
 * Reconnect block without a batch.
 * @private
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {CoinView} view
 * @returns {Promise}
 */

ChainDB.prototype._reconnect = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(entry, block, view) {
    var hash;
    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            hash = block.hash();


            assert(!entry.isGenesis());

            // We can now add a hash->next-block index.
            this.put(layout.n(entry.prevBlock), hash);

            // We can now add a height->hash index.
            this.put(layout.H(entry.height), hash);
            this.cacheHeight.push(entry.height, entry);

            // Re-insert into cache.
            this.cacheHash.push(entry.hash, entry);

            // Update state caches.
            this.saveUpdates();

            // Connect inputs.
            _context43.next = 9;
            return this.connectBlock(entry, block, view);

          case 9:

            // Update chain state.
            this.put(layout.R, this.pending.commit(hash));

          case 10:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this);
  }));

  function _reconnect(_x45, _x46, _x47) {
    return _ref48.apply(this, arguments);
  }

  return _reconnect;
}();

/**
 * Disconnect block from the chain.
 * @param {ChainEntry} entry
 * @param {Block} block
 * @returns {Promise}
 */

ChainDB.prototype.disconnect = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44(entry, block) {
    var view;
    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            this.start();

            view = void 0;
            _context44.prev = 2;
            _context44.next = 5;
            return this._disconnect(entry, block);

          case 5:
            view = _context44.sent;
            _context44.next = 12;
            break;

          case 8:
            _context44.prev = 8;
            _context44.t0 = _context44['catch'](2);

            this.drop();
            throw _context44.t0;

          case 12:
            _context44.next = 14;
            return this.commit();

          case 14:
            return _context44.abrupt('return', view);

          case 15:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this, [[2, 8]]);
  }));

  function disconnect(_x48, _x49) {
    return _ref49.apply(this, arguments);
  }

  return disconnect;
}();

/**
 * Disconnect block without a batch.
 * @private
 * @param {ChainEntry} entry
 * @param {Block} block
 * @returns {Promise} - Returns {@link CoinView}.
 */

ChainDB.prototype._disconnect = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(entry, block) {
    var view;
    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            // Remove hash->next-block index.
            this.del(layout.n(entry.prevBlock));

            // Remove height->hash index.
            this.del(layout.H(entry.height));
            this.cacheHeight.unpush(entry.height);

            // Update state caches.
            this.saveUpdates();

            // Disconnect inputs.
            _context45.next = 6;
            return this.disconnectBlock(entry, block);

          case 6:
            view = _context45.sent;


            // Revert chain state to previous tip.
            this.put(layout.R, this.pending.commit(entry.prevBlock));

            return _context45.abrupt('return', view);

          case 9:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this);
  }));

  function _disconnect(_x50, _x51) {
    return _ref50.apply(this, arguments);
  }

  return _disconnect;
}();

/**
 * Save state cache updates.
 * @private
 */

ChainDB.prototype.saveUpdates = function saveUpdates() {
  var updates = this.stateCache.updates;

  if (updates.length === 0) return;

  this.logger.info('Saving %d state cache updates.', updates.length);

  var _iteratorNormalCompletion13 = true;
  var _didIteratorError13 = false;
  var _iteratorError13 = undefined;

  try {
    for (var _iterator13 = (0, _getIterator3.default)(updates), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
      var update = _step13.value;
      var bit = update.bit,
          hash = update.hash;

      this.put(layout.v(bit, hash), update.toRaw());
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
};

/**
 * Reset the chain to a height or hash. Useful for replaying
 * the blockchain download for SPV.
 * @param {Hash|Number} block - hash/height
 * @returns {Promise}
 */

ChainDB.prototype.reset = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(block) {
    var entry, tip;
    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            _context46.next = 2;
            return this.getEntry(block);

          case 2:
            entry = _context46.sent;

            if (entry) {
              _context46.next = 5;
              break;
            }

            throw new Error('Block not found.');

          case 5:
            _context46.next = 7;
            return this.isMainChain(entry);

          case 7:
            if (_context46.sent) {
              _context46.next = 9;
              break;
            }

            throw new Error('Cannot reset on alternate chain.');

          case 9:
            if (!this.options.prune) {
              _context46.next = 11;
              break;
            }

            throw new Error('Cannot reset when pruned.');

          case 11:
            _context46.next = 13;
            return this.removeChains();

          case 13:
            _context46.next = 15;
            return this.getTip();

          case 15:
            tip = _context46.sent;

            assert(tip);

            this.logger.debug('Resetting main chain to: %s', entry.rhash());

          case 18:
            this.start();

            // Stop once we hit our target tip.

            if (!(tip.hash === entry.hash)) {
              _context46.next = 24;
              break;
            }

            this.put(layout.R, this.pending.commit(tip.hash));
            _context46.next = 23;
            return this.commit();

          case 23:
            return _context46.abrupt('break', 51);

          case 24:

            assert(!tip.isGenesis());

            // Revert the tip index.
            this.del(layout.p(tip.hash));
            this.put(layout.p(tip.prevBlock), null);

            // Remove all records (including
            // main-chain-only records).
            this.del(layout.H(tip.height));
            this.del(layout.h(tip.hash));
            this.del(layout.e(tip.hash));
            this.del(layout.n(tip.prevBlock));

            // Disconnect and remove block data.
            _context46.prev = 31;
            _context46.next = 34;
            return this.removeBlock(tip);

          case 34:
            _context46.next = 40;
            break;

          case 36:
            _context46.prev = 36;
            _context46.t0 = _context46['catch'](31);

            this.drop();
            throw _context46.t0;

          case 40:

            // Revert chain state to previous tip.
            this.put(layout.R, this.pending.commit(tip.prevBlock));

            _context46.next = 43;
            return this.commit();

          case 43:

            // Update caches _after_ successful commit.
            this.cacheHeight.remove(tip.height);
            this.cacheHash.remove(tip.hash);

            _context46.next = 47;
            return this.getPrevious(tip);

          case 47:
            tip = _context46.sent;

            assert(tip);

          case 49:
            _context46.next = 18;
            break;

          case 51:
            return _context46.abrupt('return', tip);

          case 52:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this, [[31, 36]]);
  }));

  function reset(_x52) {
    return _ref51.apply(this, arguments);
  }

  return reset;
}();

/**
 * Remove all alternate chains.
 * @returns {Promise}
 */

ChainDB.prototype.removeChains = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47() {
    var tips, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, tip;

    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            _context47.next = 2;
            return this.getTips();

          case 2:
            tips = _context47.sent;


            // Note that this has to be
            // one giant atomic write!
            this.start();

            _context47.prev = 4;
            _iteratorNormalCompletion14 = true;
            _didIteratorError14 = false;
            _iteratorError14 = undefined;
            _context47.prev = 8;
            _iterator14 = (0, _getIterator3.default)(tips);

          case 10:
            if (_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done) {
              _context47.next = 17;
              break;
            }

            tip = _step14.value;
            _context47.next = 14;
            return this._removeChain(tip);

          case 14:
            _iteratorNormalCompletion14 = true;
            _context47.next = 10;
            break;

          case 17:
            _context47.next = 23;
            break;

          case 19:
            _context47.prev = 19;
            _context47.t0 = _context47['catch'](8);
            _didIteratorError14 = true;
            _iteratorError14 = _context47.t0;

          case 23:
            _context47.prev = 23;
            _context47.prev = 24;

            if (!_iteratorNormalCompletion14 && _iterator14.return) {
              _iterator14.return();
            }

          case 26:
            _context47.prev = 26;

            if (!_didIteratorError14) {
              _context47.next = 29;
              break;
            }

            throw _iteratorError14;

          case 29:
            return _context47.finish(26);

          case 30:
            return _context47.finish(23);

          case 31:
            _context47.next = 37;
            break;

          case 33:
            _context47.prev = 33;
            _context47.t1 = _context47['catch'](4);

            this.drop();
            throw _context47.t1;

          case 37:
            _context47.next = 39;
            return this.commit();

          case 39:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this, [[4, 33], [8, 19, 23, 31], [24,, 26, 30]]);
  }));

  function removeChains() {
    return _ref52.apply(this, arguments);
  }

  return removeChains;
}();

/**
 * Remove an alternate chain.
 * @private
 * @param {Hash} hash - Alternate chain tip.
 * @returns {Promise}
 */

ChainDB.prototype._removeChain = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48(hash) {
    var tip;
    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            _context48.next = 2;
            return this.getEntryByHash(hash);

          case 2:
            tip = _context48.sent;

            if (tip) {
              _context48.next = 5;
              break;
            }

            throw new Error('Alternate chain tip not found.');

          case 5:

            this.logger.debug('Removing alternate chain: %s.', tip.rhash());

          case 6:
            _context48.next = 8;
            return this.isMainChain(tip);

          case 8:
            if (!_context48.sent) {
              _context48.next = 10;
              break;
            }

            return _context48.abrupt('break', 22);

          case 10:

            assert(!tip.isGenesis());

            // Remove all non-main-chain records.
            this.del(layout.p(tip.hash));
            this.del(layout.h(tip.hash));
            this.del(layout.e(tip.hash));
            this.del(layout.b(tip.hash));

            // Queue up hash to be removed
            // on successful write.
            this.cacheHash.unpush(tip.hash);

            _context48.next = 18;
            return this.getPrevious(tip);

          case 18:
            tip = _context48.sent;

            assert(tip);

          case 20:
            _context48.next = 6;
            break;

          case 22:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this);
  }));

  function _removeChain(_x53) {
    return _ref53.apply(this, arguments);
  }

  return _removeChain;
}();

/**
 * Save a block (not an entry) to the
 * database and potentially connect the inputs.
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {CoinView?} view
 * @returns {Promise} - Returns {@link Block}.
 */

ChainDB.prototype.saveBlock = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(entry, block, view) {
    var hash;
    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            hash = block.hash();

            if (!this.options.spv) {
              _context49.next = 3;
              break;
            }

            return _context49.abrupt('return');

          case 3:

            // Write actual block data (this may be
            // better suited to flat files in the future).
            this.put(layout.b(hash), block.toRaw());

            if (view) {
              _context49.next = 6;
              break;
            }

            return _context49.abrupt('return');

          case 6:
            _context49.next = 8;
            return this.connectBlock(entry, block, view);

          case 8:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this);
  }));

  function saveBlock(_x54, _x55, _x56) {
    return _ref54.apply(this, arguments);
  }

  return saveBlock;
}();

/**
 * Remove a block (not an entry) to the database.
 * Disconnect inputs.
 * @param {ChainEntry} entry
 * @returns {Promise} - Returns {@link Block}.
 */

ChainDB.prototype.removeBlock = function () {
  var _ref55 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(entry) {
    var block;
    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            if (!this.options.spv) {
              _context50.next = 2;
              break;
            }

            return _context50.abrupt('return', new CoinView());

          case 2:
            _context50.next = 4;
            return this.getBlock(entry.hash);

          case 4:
            block = _context50.sent;

            if (block) {
              _context50.next = 7;
              break;
            }

            throw new Error('Block not found.');

          case 7:

            this.del(layout.b(block.hash()));

            _context50.next = 10;
            return this.disconnectBlock(entry, block);

          case 10:
            return _context50.abrupt('return', _context50.sent);

          case 11:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function removeBlock(_x57) {
    return _ref55.apply(this, arguments);
  }

  return removeBlock;
}();

/**
 * Commit coin view to database.
 * @private
 * @param {CoinView} view
 */

ChainDB.prototype.saveView = function saveView(view) {
  var _iteratorNormalCompletion15 = true;
  var _didIteratorError15 = false;
  var _iteratorError15 = undefined;

  try {
    for (var _iterator15 = (0, _getIterator3.default)(view.map), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
      var _ref56 = _step15.value;

      var _ref57 = (0, _slicedToArray3.default)(_ref56, 2);

      var hash = _ref57[0];
      var coins = _ref57[1];
      var _iteratorNormalCompletion16 = true;
      var _didIteratorError16 = false;
      var _iteratorError16 = undefined;

      try {
        for (var _iterator16 = (0, _getIterator3.default)(coins.outputs), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
          var _ref58 = _step16.value;

          var _ref59 = (0, _slicedToArray3.default)(_ref58, 2);

          var index = _ref59[0];
          var coin = _ref59[1];

          if (coin.spent) {
            this.del(layout.c(hash, index));
            this.coinCache.unpush(hash + index);
            continue;
          }

          var raw = coin.toRaw();

          this.put(layout.c(hash, index), raw);
          this.coinCache.push(hash + index, raw);
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
};

/**
 * Connect block inputs.
 * @param {ChainEntry} entry
 * @param {Block} block
 * @param {CoinView} view
 * @returns {Promise} - Returns {@link Block}.
 */

ChainDB.prototype.connectBlock = function () {
  var _ref60 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51(entry, block, view) {
    var hash, i, tx, _iteratorNormalCompletion17, _didIteratorError17, _iteratorError17, _iterator17, _step17, _ref61, prevout, _iteratorNormalCompletion18, _didIteratorError18, _iteratorError18, _iterator18, _step18, output;

    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            if (!this.options.spv) {
              _context51.next = 2;
              break;
            }

            return _context51.abrupt('return');

          case 2:
            hash = block.hash();


            this.pending.connect(block);

            // Genesis block's coinbase is unspendable.

            if (!entry.isGenesis()) {
              _context51.next = 6;
              break;
            }

            return _context51.abrupt('return');

          case 6:
            i = 0;

          case 7:
            if (!(i < block.txs.length)) {
              _context51.next = 60;
              break;
            }

            tx = block.txs[i];

            if (!(i > 0)) {
              _context51.next = 29;
              break;
            }

            _iteratorNormalCompletion17 = true;
            _didIteratorError17 = false;
            _iteratorError17 = undefined;
            _context51.prev = 13;

            for (_iterator17 = (0, _getIterator3.default)(tx.inputs); !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
              _ref61 = _step17.value;
              prevout = _ref61.prevout;

              this.pending.spend(view.getOutput(prevout));
            }_context51.next = 21;
            break;

          case 17:
            _context51.prev = 17;
            _context51.t0 = _context51['catch'](13);
            _didIteratorError17 = true;
            _iteratorError17 = _context51.t0;

          case 21:
            _context51.prev = 21;
            _context51.prev = 22;

            if (!_iteratorNormalCompletion17 && _iterator17.return) {
              _iterator17.return();
            }

          case 24:
            _context51.prev = 24;

            if (!_didIteratorError17) {
              _context51.next = 27;
              break;
            }

            throw _iteratorError17;

          case 27:
            return _context51.finish(24);

          case 28:
            return _context51.finish(21);

          case 29:
            _iteratorNormalCompletion18 = true;
            _didIteratorError18 = false;
            _iteratorError18 = undefined;
            _context51.prev = 32;
            _iterator18 = (0, _getIterator3.default)(tx.outputs);

          case 34:
            if (_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done) {
              _context51.next = 42;
              break;
            }

            output = _step18.value;

            if (!output.script.isUnspendable()) {
              _context51.next = 38;
              break;
            }

            return _context51.abrupt('continue', 39);

          case 38:

            this.pending.add(output);

          case 39:
            _iteratorNormalCompletion18 = true;
            _context51.next = 34;
            break;

          case 42:
            _context51.next = 48;
            break;

          case 44:
            _context51.prev = 44;
            _context51.t1 = _context51['catch'](32);
            _didIteratorError18 = true;
            _iteratorError18 = _context51.t1;

          case 48:
            _context51.prev = 48;
            _context51.prev = 49;

            if (!_iteratorNormalCompletion18 && _iterator18.return) {
              _iterator18.return();
            }

          case 51:
            _context51.prev = 51;

            if (!_didIteratorError18) {
              _context51.next = 54;
              break;
            }

            throw _iteratorError18;

          case 54:
            return _context51.finish(51);

          case 55:
            return _context51.finish(48);

          case 56:

            // Index the transaction if enabled.
            this.indexTX(tx, view, entry, i);

          case 57:
            i++;
            _context51.next = 7;
            break;

          case 60:

            // Commit new coin state.
            this.saveView(view);

            // Write undo coins (if there are any).
            if (!view.undo.isEmpty()) this.put(layout.u(hash), view.undo.commit());

            // Prune height-288 if pruning is enabled.
            _context51.next = 64;
            return this.pruneBlock(entry);

          case 64:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this, [[13, 17, 21, 29], [22,, 24, 28], [32, 44, 48, 56], [49,, 51, 55]]);
  }));

  function connectBlock(_x58, _x59, _x60) {
    return _ref60.apply(this, arguments);
  }

  return connectBlock;
}();

/**
 * Disconnect block inputs.
 * @param {ChainEntry} entry
 * @param {Block} block
 * @returns {Promise} - Returns {@link CoinView}.
 */

ChainDB.prototype.disconnectBlock = function () {
  var _ref62 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(entry, block) {
    var view, hash, undo, i, tx, j, prevout, _j, output;

    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            view = new CoinView();

            if (!this.options.spv) {
              _context52.next = 3;
              break;
            }

            return _context52.abrupt('return', view);

          case 3:
            hash = block.hash();
            _context52.next = 6;
            return this.getUndoCoins(hash);

          case 6:
            undo = _context52.sent;


            this.pending.disconnect(block);

            // Disconnect all transactions.
            i = block.txs.length - 1;

          case 9:
            if (!(i >= 0)) {
              _context52.next = 26;
              break;
            }

            tx = block.txs[i];


            if (i > 0) {
              for (j = tx.inputs.length - 1; j >= 0; j--) {
                prevout = tx.inputs[j].prevout;

                undo.apply(view, prevout);
                this.pending.add(view.getOutput(prevout));
              }
            }

            // Remove any created coins.
            view.removeTX(tx, entry.height);

            _j = tx.outputs.length - 1;

          case 14:
            if (!(_j >= 0)) {
              _context52.next = 22;
              break;
            }

            output = tx.outputs[_j];

            if (!output.script.isUnspendable()) {
              _context52.next = 18;
              break;
            }

            return _context52.abrupt('continue', 19);

          case 18:

            this.pending.spend(output);

          case 19:
            _j--;
            _context52.next = 14;
            break;

          case 22:

            // Remove from transaction index.
            this.unindexTX(tx, view);

          case 23:
            i--;
            _context52.next = 9;
            break;

          case 26:

            // Undo coins should be empty.
            assert(undo.isEmpty(), 'Undo coins data inconsistency.');

            // Commit new coin state.
            this.saveView(view);

            // Remove undo coins.
            this.del(layout.u(hash));

            return _context52.abrupt('return', view);

          case 30:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this);
  }));

  function disconnectBlock(_x61, _x62) {
    return _ref62.apply(this, arguments);
  }

  return disconnectBlock;
}();

/**
 * Prune a block from the chain and
 * add current block to the prune queue.
 * @private
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

ChainDB.prototype.pruneBlock = function () {
  var _ref63 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(entry) {
    var height, hash;
    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            if (!this.options.spv) {
              _context53.next = 2;
              break;
            }

            return _context53.abrupt('return');

          case 2:
            if (this.options.prune) {
              _context53.next = 4;
              break;
            }

            return _context53.abrupt('return');

          case 4:
            height = entry.height - this.network.block.keepBlocks;

            if (!(height <= this.network.block.pruneAfterHeight)) {
              _context53.next = 7;
              break;
            }

            return _context53.abrupt('return');

          case 7:
            _context53.next = 9;
            return this.getHash(height);

          case 9:
            hash = _context53.sent;

            if (hash) {
              _context53.next = 12;
              break;
            }

            return _context53.abrupt('return');

          case 12:

            this.del(layout.b(hash));
            this.del(layout.u(hash));

          case 14:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this);
  }));

  function pruneBlock(_x63) {
    return _ref63.apply(this, arguments);
  }

  return pruneBlock;
}();

/**
 * Save database options.
 * @returns {Promise}
 */

ChainDB.prototype.saveFlags = function saveFlags() {
  var flags = ChainFlags.fromOptions(this.options);
  var batch = this.db.batch();
  batch.put(layout.O, flags.toRaw());
  return batch.write();
};

/**
 * Index a transaction by txid and address.
 * @private
 * @param {TX} tx
 * @param {CoinView} view
 * @param {ChainEntry} entry
 * @param {Number} index
 */

ChainDB.prototype.indexTX = function indexTX(tx, view, entry, index) {
  var hash = tx.hash();

  if (this.options.indexTX) {
    var meta = TXMeta.fromTX(tx, entry, index);

    this.put(layout.t(hash), meta.toRaw());

    if (this.options.indexAddress) {
      var hashes = tx.getHashes(view);
      var _iteratorNormalCompletion19 = true;
      var _didIteratorError19 = false;
      var _iteratorError19 = undefined;

      try {
        for (var _iterator19 = (0, _getIterator3.default)(hashes), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
          var addr = _step19.value;

          this.put(layout.T(addr, hash), null);
        }
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
    }
  }

  if (!this.options.indexAddress) return;

  if (!tx.isCoinbase()) {
    var _iteratorNormalCompletion20 = true;
    var _didIteratorError20 = false;
    var _iteratorError20 = undefined;

    try {
      for (var _iterator20 = (0, _getIterator3.default)(tx.inputs), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
        var _ref64 = _step20.value;
        var prevout = _ref64.prevout;

        var _addr = view.getOutput(prevout).getHash();

        if (!_addr) continue;

        this.del(layout.C(_addr, prevout.hash, prevout.index));
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
  }

  for (var i = 0; i < tx.outputs.length; i++) {
    var output = tx.outputs[i];
    var _addr2 = output.getHash();

    if (!_addr2) continue;

    this.put(layout.C(_addr2, hash, i), null);
  }
};

/**
 * Remove transaction from index.
 * @private
 * @param {TX} tx
 * @param {CoinView} view
 */

ChainDB.prototype.unindexTX = function unindexTX(tx, view) {
  var hash = tx.hash();

  if (this.options.indexTX) {
    this.del(layout.t(hash));
    if (this.options.indexAddress) {
      var hashes = tx.getHashes(view);
      var _iteratorNormalCompletion21 = true;
      var _didIteratorError21 = false;
      var _iteratorError21 = undefined;

      try {
        for (var _iterator21 = (0, _getIterator3.default)(hashes), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
          var addr = _step21.value;

          this.del(layout.T(addr, hash));
        }
      } catch (err) {
        _didIteratorError21 = true;
        _iteratorError21 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion21 && _iterator21.return) {
            _iterator21.return();
          }
        } finally {
          if (_didIteratorError21) {
            throw _iteratorError21;
          }
        }
      }
    }
  }

  if (!this.options.indexAddress) return;

  if (!tx.isCoinbase()) {
    var _iteratorNormalCompletion22 = true;
    var _didIteratorError22 = false;
    var _iteratorError22 = undefined;

    try {
      for (var _iterator22 = (0, _getIterator3.default)(tx.inputs), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
        var _ref65 = _step22.value;
        var prevout = _ref65.prevout;

        var _addr3 = view.getOutput(prevout).getHash();

        if (!_addr3) continue;

        this.put(layout.C(_addr3, prevout.hash, prevout.index), null);
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
  }

  for (var i = 0; i < tx.outputs.length; i++) {
    var output = tx.outputs[i];
    var _addr4 = output.getHash();

    if (!_addr4) continue;

    this.del(layout.C(_addr4, hash, i));
  }
};

/**
 * Chain Flags
 * @alias module:blockchain.ChainFlags
 * @constructor
 */

function ChainFlags(options) {
  if (!(this instanceof ChainFlags)) return new ChainFlags(options);

  this.network = Network.primary;
  this.spv = false;
  this.witness = true;
  this.bip91 = false;
  this.bip148 = false;
  this.prune = false;
  this.indexTX = false;
  this.indexAddress = false;

  if (options) this.fromOptions(options);
}

ChainFlags.prototype.fromOptions = function fromOptions(options) {
  this.network = Network.get(options.network);

  if (options.spv != null) {
    assert(typeof options.spv === 'boolean');
    this.spv = options.spv;
  }

  if (options.bip91 != null) {
    assert(typeof options.bip91 === 'boolean');
    this.bip91 = options.bip91;
  }

  if (options.bip148 != null) {
    assert(typeof options.bip148 === 'boolean');
    this.bip148 = options.bip148;
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

  return this;
};

ChainFlags.fromOptions = function fromOptions(data) {
  return new ChainFlags().fromOptions(data);
};

ChainFlags.prototype.toRaw = function toRaw() {
  var bw = new StaticWriter(12);
  var flags = 0;

  if (this.spv) flags |= 1 << 0;

  if (this.witness) flags |= 1 << 1;

  if (this.prune) flags |= 1 << 2;

  if (this.indexTX) flags |= 1 << 3;

  if (this.indexAddress) flags |= 1 << 4;

  if (this.bip91) flags |= 1 << 5;

  if (this.bip148) flags |= 1 << 6;

  bw.writeU32(this.network.magic);
  bw.writeU32(flags);
  bw.writeU32(0);

  return bw.render();
};

ChainFlags.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);

  this.network = Network.fromMagic(br.readU32());

  var flags = br.readU32();

  this.spv = (flags & 1) !== 0;
  this.witness = (flags & 2) !== 0;
  this.prune = (flags & 4) !== 0;
  this.indexTX = (flags & 8) !== 0;
  this.indexAddress = (flags & 16) !== 0;
  this.bip91 = (flags & 32) !== 0;
  this.bip148 = (flags & 64) !== 0;

  return this;
};

ChainFlags.fromRaw = function fromRaw(data) {
  return new ChainFlags().fromRaw(data);
};

/**
 * Chain State
 * @alias module:blockchain.ChainState
 * @constructor
 */

function ChainState() {
  this.tip = encoding.NULL_HASH;
  this.tx = 0;
  this.coin = 0;
  this.value = 0;
  this.committed = false;
}

ChainState.prototype.rhash = function rhash() {
  return util.revHex(this.tip);
};

ChainState.prototype.clone = function clone() {
  var state = new ChainState();
  state.tip = this.tip;
  state.tx = this.tx;
  state.coin = this.coin;
  state.value = this.value;
  return state;
};

ChainState.prototype.connect = function connect(block) {
  this.tx += block.txs.length;
};

ChainState.prototype.disconnect = function disconnect(block) {
  this.tx -= block.txs.length;
};

ChainState.prototype.add = function add(coin) {
  this.coin++;
  this.value += coin.value;
};

ChainState.prototype.spend = function spend(coin) {
  this.coin--;
  this.value -= coin.value;
};

ChainState.prototype.commit = function commit(hash) {
  if (typeof hash !== 'string') hash = hash.toString('hex');
  this.tip = hash;
  this.committed = true;
  return this.toRaw();
};

ChainState.prototype.toRaw = function toRaw() {
  var bw = new StaticWriter(56);
  bw.writeHash(this.tip);
  bw.writeU64(this.tx);
  bw.writeU64(this.coin);
  bw.writeU64(this.value);
  return bw.render();
};

ChainState.fromRaw = function fromRaw(data) {
  var state = new ChainState();
  var br = new BufferReader(data);
  state.tip = br.readHash('hex');
  state.tx = br.readU64();
  state.coin = br.readU64();
  state.value = br.readU64();
  return state;
};

/**
 * StateCache
 * @alias module:blockchain.StateCache
 * @constructor
 */

function StateCache(network) {
  this.network = network;
  this.bits = [];
  this.updates = [];
  this._init();
}

StateCache.prototype._init = function _init() {
  for (var i = 0; i < 32; i++) {
    this.bits.push(null);
  }var _iteratorNormalCompletion23 = true;
  var _didIteratorError23 = false;
  var _iteratorError23 = undefined;

  try {
    for (var _iterator23 = (0, _getIterator3.default)(this.network.deploys), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
      var _ref66 = _step23.value;
      var bit = _ref66.bit;

      assert(!this.bits[bit]);
      this.bits[bit] = new _map2.default();
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
};

StateCache.prototype.set = function set(bit, entry, state) {
  var cache = this.bits[bit];

  assert(cache);

  if (cache.get(entry.hash) !== state) {
    cache.set(entry.hash, state);
    this.updates.push(new CacheUpdate(bit, entry.hash, state));
  }
};

StateCache.prototype.get = function get(bit, entry) {
  var cache = this.bits[bit];

  assert(cache);

  var state = cache.get(entry.hash);

  if (state == null) return -1;

  return state;
};

StateCache.prototype.commit = function commit() {
  this.updates.length = 0;
};

StateCache.prototype.drop = function drop() {
  var _iteratorNormalCompletion24 = true;
  var _didIteratorError24 = false;
  var _iteratorError24 = undefined;

  try {
    for (var _iterator24 = (0, _getIterator3.default)(this.updates), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
      var _ref67 = _step24.value;
      var bit = _ref67.bit;
      var hash = _ref67.hash;

      var cache = this.bits[bit];
      assert(cache);
      cache.delete(hash);
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

  this.updates.length = 0;
};

StateCache.prototype.insert = function insert(bit, hash, state) {
  var cache = this.bits[bit];
  assert(cache);
  cache.set(hash, state);
};

/**
 * CacheUpdate
 * @constructor
 * @ignore
 */

function CacheUpdate(bit, hash, state) {
  this.bit = bit;
  this.hash = hash;
  this.state = state;
}

CacheUpdate.prototype.toRaw = function toRaw() {
  return U8(this.state);
};

/*
 * Helpers
 */

function getSize(value) {
  return value.length + 80;
}

/*
 * Expose
 */

module.exports = ChainDB;