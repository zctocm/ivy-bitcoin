/*!
 * walletdb.js - storage for wallets
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map2 = require('babel-runtime/core-js/map');

var _map3 = _interopRequireDefault(_map2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var path = require('path');
var AsyncObject = require('../utils/asyncobject');
var util = require('../utils/util');
var Lock = require('../utils/lock');
var MappedLock = require('../utils/mappedlock');
var LRU = require('../utils/lru');
var encoding = require('../utils/encoding');
var ccmp = require('../crypto/ccmp');
var aes = require('../crypto/aes');
var Network = require('../protocol/network');
var Path = require('./path');
var common = require('./common');
var Wallet = require('./wallet');
var Account = require('./account');
var LDB = require('../db/ldb');
var Bloom = require('../utils/bloom');
var Logger = require('../node/logger');
var Outpoint = require('../primitives/outpoint');
var layouts = require('./layout');
var records = require('./records');
var HTTPServer = require('./http');
var RPC = require('./rpc');
var layout = layouts.walletdb;
var ChainState = records.ChainState;
var BlockMapRecord = records.BlockMapRecord;
var BlockMeta = records.BlockMeta;
var PathMapRecord = records.PathMapRecord;
var OutpointMapRecord = records.OutpointMapRecord;
var TXRecord = records.TXRecord;
var U32 = encoding.U32;

/**
 * WalletDB
 * @alias module:wallet.WalletDB
 * @constructor
 * @param {Object} options
 * @param {String?} options.name - Database name.
 * @param {String?} options.location - Database file location.
 * @param {String?} options.db - Database backend (`"leveldb"` by default).
 * @param {Boolean?} options.verify - Verify transactions as they
 * come in (note that this will not happen on the worker pool).
 * @property {Boolean} loaded
 */

function WalletDB(options) {
  if (!(this instanceof WalletDB)) return new WalletDB(options);

  AsyncObject.call(this);

  this.options = new WalletOptions(options);

  this.network = this.options.network;
  this.logger = this.options.logger.context('wallet');
  this.workers = this.options.workers;

  this.client = this.options.client;
  this.feeRate = this.options.feeRate;

  this.db = LDB(this.options);
  this.rpc = new RPC(this);
  this.primary = null;
  this.http = null;

  if (!HTTPServer.unsupported) {
    this.http = new HTTPServer({
      walletdb: this,
      network: this.network,
      logger: this.logger,
      prefix: this.options.prefix,
      apiKey: this.options.apiKey,
      walletAuth: this.options.walletAuth,
      noAuth: this.options.noAuth,
      host: this.options.host,
      port: this.options.port,
      ssl: this.options.ssl
    });
  }

  this.state = new ChainState();
  this.wallets = new _map3.default();
  this.depth = 0;
  this.rescanning = false;
  this.bound = false;

  this.readLock = new MappedLock();
  this.writeLock = new Lock();
  this.txLock = new Lock();

  this.widCache = new LRU(10000);
  this.pathMapCache = new LRU(100000);

  this.filter = new Bloom();

  this._init();
}

(0, _setPrototypeOf2.default)(WalletDB.prototype, AsyncObject.prototype);

/**
 * Database layout.
 * @type {Object}
 */

WalletDB.layout = layout;

/**
 * Initialize walletdb.
 * @private
 */

WalletDB.prototype._init = function _init() {
  var items = 3000000;
  var flag = -1;

  // Highest number of items with an
  // FPR of 0.001. We have to do this
  // by hand because Bloom.fromRate's
  // policy limit enforcing is fairly
  // naive.
  if (this.options.spv) {
    items = 20000;
    flag = Bloom.flags.ALL;
  }

  this.filter = Bloom.fromRate(items, 0.001, flag);
};

/**
 * Open the walletdb, wait for the database to load.
 * @alias WalletDB#open
 * @returns {Promise}
 */

WalletDB.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var wallet;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!this.options.listen) {
              _context.next = 3;
              break;
            }

            _context.next = 3;
            return this.logger.open();

          case 3:
            _context.next = 5;
            return this.db.open();

          case 5:
            _context.next = 7;
            return this.db.checkVersion('V', 6);

          case 7:
            _context.next = 9;
            return this.getDepth();

          case 9:
            this.depth = _context.sent;

            if (!this.options.wipeNoReally) {
              _context.next = 13;
              break;
            }

            _context.next = 13;
            return this.wipe();

          case 13:
            _context.next = 15;
            return this.load();

          case 15:

            this.logger.info('WalletDB loaded (depth=%d, height=%d, start=%d).', this.depth, this.state.height, this.state.startHeight);

            _context.next = 18;
            return this.ensure({
              id: 'primary'
            });

          case 18:
            wallet = _context.sent;


            this.logger.info('Loaded primary wallet (id=%s, wid=%d, address=%s)', wallet.id, wallet.wid, wallet.getAddress());

            this.primary = wallet;
            this.rpc.wallet = wallet;

            if (!(this.http && this.options.listen)) {
              _context.next = 25;
              break;
            }

            _context.next = 25;
            return this.http.open();

          case 25:
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
 * Close the walletdb, wait for the database to close.
 * @alias WalletDB#close
 * @returns {Promise}
 */

WalletDB.prototype._close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, wallet;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.disconnect();

          case 2:
            if (!(this.http && this.options.listen)) {
              _context2.next = 5;
              break;
            }

            _context2.next = 5;
            return this.http.close();

          case 5:
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 8;
            _iterator = (0, _getIterator3.default)(this.wallets.values());

          case 10:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context2.next = 17;
              break;
            }

            wallet = _step.value;
            _context2.next = 14;
            return wallet.destroy();

          case 14:
            _iteratorNormalCompletion = true;
            _context2.next = 10;
            break;

          case 17:
            _context2.next = 23;
            break;

          case 19:
            _context2.prev = 19;
            _context2.t0 = _context2['catch'](8);
            _didIteratorError = true;
            _iteratorError = _context2.t0;

          case 23:
            _context2.prev = 23;
            _context2.prev = 24;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 26:
            _context2.prev = 26;

            if (!_didIteratorError) {
              _context2.next = 29;
              break;
            }

            throw _iteratorError;

          case 29:
            return _context2.finish(26);

          case 30:
            return _context2.finish(23);

          case 31:
            _context2.next = 33;
            return this.db.close();

          case 33:
            if (!this.options.listen) {
              _context2.next = 36;
              break;
            }

            _context2.next = 36;
            return this.logger.close();

          case 36:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[8, 19, 23, 31], [24,, 26, 30]]);
  }));

  function _close() {
    return _ref2.apply(this, arguments);
  }

  return _close;
}();

/**
 * Load the walletdb.
 * @returns {Promise}
 */

WalletDB.prototype.load = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    var unlock;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this.txLock.lock();

          case 2:
            unlock = _context3.sent;
            _context3.prev = 3;
            _context3.next = 6;
            return this.connect();

          case 6:
            _context3.next = 8;
            return this.init();

          case 8:
            _context3.next = 10;
            return this.watch();

          case 10:
            _context3.next = 12;
            return this.sync();

          case 12:
            _context3.next = 14;
            return this.resend();

          case 14:
            _context3.prev = 14;

            unlock();
            return _context3.finish(14);

          case 17:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[3,, 14, 17]]);
  }));

  function load() {
    return _ref3.apply(this, arguments);
  }

  return load;
}();

/**
 * Bind to node events.
 * @private
 */

WalletDB.prototype.bind = function bind() {
  var _this = this;

  if (!this.client) return;

  if (this.bound) return;

  this.bound = true;

  this.client.on('error', function (err) {
    _this.emit('error', err);
  });

  this.client.on('block connect', function () {
    var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(entry, txs) {
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.prev = 0;
              _context4.next = 3;
              return _this.addBlock(entry, txs);

            case 3:
              _context4.next = 8;
              break;

            case 5:
              _context4.prev = 5;
              _context4.t0 = _context4['catch'](0);

              _this.emit('error', _context4.t0);

            case 8:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this, [[0, 5]]);
    }));

    return function (_x, _x2) {
      return _ref4.apply(this, arguments);
    };
  }());

  this.client.on('block disconnect', function () {
    var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(entry) {
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.prev = 0;
              _context5.next = 3;
              return _this.removeBlock(entry);

            case 3:
              _context5.next = 8;
              break;

            case 5:
              _context5.prev = 5;
              _context5.t0 = _context5['catch'](0);

              _this.emit('error', _context5.t0);

            case 8:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this, [[0, 5]]);
    }));

    return function (_x3) {
      return _ref5.apply(this, arguments);
    };
  }());

  this.client.hook('block rescan', function () {
    var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(entry, txs) {
      return _regenerator2.default.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              _context6.prev = 0;
              _context6.next = 3;
              return _this.rescanBlock(entry, txs);

            case 3:
              _context6.next = 8;
              break;

            case 5:
              _context6.prev = 5;
              _context6.t0 = _context6['catch'](0);

              _this.emit('error', _context6.t0);

            case 8:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, _this, [[0, 5]]);
    }));

    return function (_x4, _x5) {
      return _ref6.apply(this, arguments);
    };
  }());

  this.client.on('tx', function () {
    var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(tx) {
      return _regenerator2.default.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              _context7.prev = 0;
              _context7.next = 3;
              return _this.addTX(tx);

            case 3:
              _context7.next = 8;
              break;

            case 5:
              _context7.prev = 5;
              _context7.t0 = _context7['catch'](0);

              _this.emit('error', _context7.t0);

            case 8:
            case 'end':
              return _context7.stop();
          }
        }
      }, _callee7, _this, [[0, 5]]);
    }));

    return function (_x6) {
      return _ref7.apply(this, arguments);
    };
  }());

  this.client.on('chain reset', function () {
    var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(tip) {
      return _regenerator2.default.wrap(function _callee8$(_context8) {
        while (1) {
          switch (_context8.prev = _context8.next) {
            case 0:
              _context8.prev = 0;
              _context8.next = 3;
              return _this.resetChain(tip);

            case 3:
              _context8.next = 8;
              break;

            case 5:
              _context8.prev = 5;
              _context8.t0 = _context8['catch'](0);

              _this.emit('error', _context8.t0);

            case 8:
            case 'end':
              return _context8.stop();
          }
        }
      }, _callee8, _this, [[0, 5]]);
    }));

    return function (_x7) {
      return _ref8.apply(this, arguments);
    };
  }());
};

/**
 * Connect to the node server (client required).
 * @returns {Promise}
 */

WalletDB.prototype.connect = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9() {
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            if (this.client) {
              _context9.next = 2;
              break;
            }

            return _context9.abrupt('return');

          case 2:

            this.bind();

            _context9.next = 5;
            return this.client.open();

          case 5:
            _context9.next = 7;
            return this.setFilter();

          case 7:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function connect() {
    return _ref9.apply(this, arguments);
  }

  return connect;
}();

/**
 * Disconnect from node server (client required).
 * @returns {Promise}
 */

WalletDB.prototype.disconnect = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10() {
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            if (this.client) {
              _context10.next = 2;
              break;
            }

            return _context10.abrupt('return');

          case 2:
            _context10.next = 4;
            return this.client.close();

          case 4:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function disconnect() {
    return _ref10.apply(this, arguments);
  }

  return disconnect;
}();

/**
 * Initialize and write initial sync state.
 * @returns {Promise}
 */

WalletDB.prototype.init = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11() {
    var state, startHeight, tip;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            _context11.next = 2;
            return this.getState();

          case 2:
            state = _context11.sent;
            startHeight = this.options.startHeight;

            if (!state) {
              _context11.next = 7;
              break;
            }

            this.state = state;
            return _context11.abrupt('return');

          case 7:
            tip = void 0;

            if (!this.client) {
              _context11.next = 23;
              break;
            }

            if (!(startHeight != null)) {
              _context11.next = 17;
              break;
            }

            _context11.next = 12;
            return this.client.getEntry(startHeight);

          case 12:
            tip = _context11.sent;

            if (tip) {
              _context11.next = 15;
              break;
            }

            throw new Error('WDB: Could not find start block.');

          case 15:
            _context11.next = 20;
            break;

          case 17:
            _context11.next = 19;
            return this.client.getTip();

          case 19:
            tip = _context11.sent;

          case 20:
            tip = BlockMeta.fromEntry(tip);
            _context11.next = 24;
            break;

          case 23:
            tip = BlockMeta.fromEntry(this.network.genesis);

          case 24:

            this.logger.info('Initializing WalletDB chain state at %s (%d).', util.revHex(tip.hash), tip.height);

            _context11.next = 27;
            return this.resetState(tip, false);

          case 27:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function init() {
    return _ref11.apply(this, arguments);
  }

  return init;
}();

/**
 * Watch addresses and outpoints.
 * @private
 * @returns {Promise}
 */

WalletDB.prototype.watch = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12() {
    var iter, hashes, outpoints, _iter, key, data, _iter2, _key, _layout$oo, _layout$oo2, hash, index, outpoint, _data;

    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            iter = this.db.iterator({
              gte: layout.p(encoding.NULL_HASH),
              lte: layout.p(encoding.HIGH_HASH)
            });
            hashes = 0;
            outpoints = 0;

          case 3:
            _context12.next = 5;
            return iter.next();

          case 5:
            if (!_context12.sent) {
              _context12.next = 20;
              break;
            }

            _iter = iter, key = _iter.key;
            _context12.prev = 7;
            data = layout.pp(key);

            this.filter.add(data, 'hex');
            _context12.next = 17;
            break;

          case 12:
            _context12.prev = 12;
            _context12.t0 = _context12['catch'](7);
            _context12.next = 16;
            return iter.end();

          case 16:
            throw _context12.t0;

          case 17:

            hashes++;
            _context12.next = 3;
            break;

          case 20:

            iter = this.db.iterator({
              gte: layout.o(encoding.NULL_HASH, 0),
              lte: layout.o(encoding.HIGH_HASH, 0xffffffff)
            });

          case 21:
            _context12.next = 23;
            return iter.next();

          case 23:
            if (!_context12.sent) {
              _context12.next = 40;
              break;
            }

            _iter2 = iter, _key = _iter2.key;
            _context12.prev = 25;
            _layout$oo = layout.oo(_key), _layout$oo2 = (0, _slicedToArray3.default)(_layout$oo, 2), hash = _layout$oo2[0], index = _layout$oo2[1];
            outpoint = new Outpoint(hash, index);
            _data = outpoint.toRaw();

            this.filter.add(_data);
            _context12.next = 37;
            break;

          case 32:
            _context12.prev = 32;
            _context12.t1 = _context12['catch'](25);
            _context12.next = 36;
            return iter.end();

          case 36:
            throw _context12.t1;

          case 37:

            outpoints++;
            _context12.next = 21;
            break;

          case 40:

            this.logger.info('Added %d hashes to WalletDB filter.', hashes);
            this.logger.info('Added %d outpoints to WalletDB filter.', outpoints);

            _context12.next = 44;
            return this.setFilter();

          case 44:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this, [[7, 12], [25, 32]]);
  }));

  function watch() {
    return _ref12.apply(this, arguments);
  }

  return watch;
}();

/**
 * Connect and sync with the chain server.
 * @private
 * @returns {Promise}
 */

WalletDB.prototype.sync = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13() {
    var height, entry, tip;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            if (this.client) {
              _context13.next = 2;
              break;
            }

            return _context13.abrupt('return');

          case 2:
            height = this.state.height;
            entry = void 0;

          case 4:
            if (!(height >= 0)) {
              _context13.next = 18;
              break;
            }

            _context13.next = 7;
            return this.getBlock(height);

          case 7:
            tip = _context13.sent;

            if (tip) {
              _context13.next = 10;
              break;
            }

            return _context13.abrupt('break', 18);

          case 10:
            _context13.next = 12;
            return this.client.getEntry(tip.hash);

          case 12:
            entry = _context13.sent;

            if (!entry) {
              _context13.next = 15;
              break;
            }

            return _context13.abrupt('break', 18);

          case 15:

            height--;
            _context13.next = 4;
            break;

          case 18:
            if (entry) {
              _context13.next = 24;
              break;
            }

            height = this.state.startHeight;
            _context13.next = 22;
            return this.client.getEntry(this.state.startHash);

          case 22:
            entry = _context13.sent;


            if (!entry) height = 0;

          case 24:
            _context13.next = 26;
            return this.scan(height);

          case 26:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this);
  }));

  function sync() {
    return _ref13.apply(this, arguments);
  }

  return sync;
}();

/**
 * Rescan blockchain from a given height.
 * @private
 * @param {Number?} height
 * @returns {Promise}
 */

WalletDB.prototype.scan = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(height) {
    var tip;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            if (this.client) {
              _context14.next = 2;
              break;
            }

            return _context14.abrupt('return');

          case 2:

            if (height == null) height = this.state.startHeight;

            assert(util.isU32(height), 'WDB: Must pass in a height.');

            _context14.next = 6;
            return this.rollback(height);

          case 6:

            this.logger.info('WalletDB is scanning %d blocks.', this.state.height - height + 1);

            _context14.next = 9;
            return this.getTip();

          case 9:
            tip = _context14.sent;
            _context14.prev = 10;

            this.rescanning = true;
            _context14.next = 14;
            return this.client.rescan(tip.hash);

          case 14:
            _context14.prev = 14;

            this.rescanning = false;
            return _context14.finish(14);

          case 17:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this, [[10,, 14, 17]]);
  }));

  function scan(_x8) {
    return _ref14.apply(this, arguments);
  }

  return scan;
}();

/**
 * Force a rescan.
 * @param {Number} height
 * @returns {Promise}
 */

WalletDB.prototype.rescan = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(height) {
    var unlock;
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            _context15.next = 2;
            return this.txLock.lock();

          case 2:
            unlock = _context15.sent;
            _context15.prev = 3;
            _context15.next = 6;
            return this._rescan(height);

          case 6:
            return _context15.abrupt('return', _context15.sent);

          case 7:
            _context15.prev = 7;

            unlock();
            return _context15.finish(7);

          case 10:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this, [[3,, 7, 10]]);
  }));

  function rescan(_x9) {
    return _ref15.apply(this, arguments);
  }

  return rescan;
}();

/**
 * Force a rescan (without a lock).
 * @private
 * @param {Number} height
 * @returns {Promise}
 */

WalletDB.prototype._rescan = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(height) {
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            _context16.next = 2;
            return this.scan(height);

          case 2:
            return _context16.abrupt('return', _context16.sent);

          case 3:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function _rescan(_x10) {
    return _ref16.apply(this, arguments);
  }

  return _rescan;
}();

/**
 * Broadcast a transaction via chain server.
 * @param {TX} tx
 * @returns {Promise}
 */

WalletDB.prototype.send = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(tx) {
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            if (this.client) {
              _context17.next = 3;
              break;
            }

            this.emit('send', tx);
            return _context17.abrupt('return');

          case 3:
            _context17.next = 5;
            return this.client.send(tx);

          case 5:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this);
  }));

  function send(_x11) {
    return _ref17.apply(this, arguments);
  }

  return send;
}();

/**
 * Estimate smart fee from chain server.
 * @param {Number} blocks
 * @returns {Promise}
 */

WalletDB.prototype.estimateFee = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(blocks) {
    var rate;
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            if (!(this.feeRate > 0)) {
              _context18.next = 2;
              break;
            }

            return _context18.abrupt('return', this.feeRate);

          case 2:
            if (this.client) {
              _context18.next = 4;
              break;
            }

            return _context18.abrupt('return', this.network.feeRate);

          case 4:
            _context18.next = 6;
            return this.client.estimateFee(blocks);

          case 6:
            rate = _context18.sent;

            if (!(rate < this.network.feeRate)) {
              _context18.next = 9;
              break;
            }

            return _context18.abrupt('return', this.network.feeRate);

          case 9:
            if (!(rate > this.network.maxFeeRate)) {
              _context18.next = 11;
              break;
            }

            return _context18.abrupt('return', this.network.maxFeeRate);

          case 11:
            return _context18.abrupt('return', rate);

          case 12:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this);
  }));

  function estimateFee(_x12) {
    return _ref18.apply(this, arguments);
  }

  return estimateFee;
}();

/**
 * Send filter to the remote node.
 * @private
 * @returns {Promise}
 */

WalletDB.prototype.setFilter = function setFilter() {
  if (!this.client) {
    this.emit('set filter', this.filter);
    return _promise2.default.resolve();
  }

  return this.client.setFilter(this.filter);
};

/**
 * Add data to remote filter.
 * @private
 * @param {Buffer} data
 * @returns {Promise}
 */

WalletDB.prototype.addFilter = function addFilter(data) {
  if (!this.client) {
    this.emit('add filter', data);
    return _promise2.default.resolve();
  }

  return this.client.addFilter(data);
};

/**
 * Reset remote filter.
 * @private
 * @returns {Promise}
 */

WalletDB.prototype.resetFilter = function resetFilter() {
  if (!this.client) {
    this.emit('reset filter');
    return _promise2.default.resolve();
  }

  return this.client.resetFilter();
};

/**
 * Backup the wallet db.
 * @param {String} path
 * @returns {Promise}
 */

WalletDB.prototype.backup = function backup(path) {
  return this.db.backup(path);
};

/**
 * Wipe the txdb - NEVER USE.
 * @returns {Promise}
 */

WalletDB.prototype.wipe = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19() {
    var iter, batch, total, key;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            this.logger.warning('Wiping WalletDB TXDB...');
            this.logger.warning('I hope you know what you\'re doing.');

            iter = this.db.iterator({
              gte: Buffer.from([0x00]),
              lte: Buffer.from([0xff])
            });
            batch = this.db.batch();
            total = 0;

          case 5:
            _context19.next = 7;
            return iter.next();

          case 7:
            if (!_context19.sent) {
              _context19.next = 25;
              break;
            }

            key = iter.key;
            _context19.prev = 9;
            _context19.t0 = key[0];
            _context19.next = _context19.t0 === 0x62 ? 13 : _context19.t0 === 0x63 ? 13 : _context19.t0 === 0x65 ? 13 : _context19.t0 === 0x74 ? 13 : _context19.t0 === 0x6f ? 13 : _context19.t0 === 0x68 ? 13 : _context19.t0 === 0x52 ? 13 : 16;
            break;

          case 13:
            // R
            batch.del(key);
            total++;
            return _context19.abrupt('break', 16);

          case 16:
            _context19.next = 23;
            break;

          case 18:
            _context19.prev = 18;
            _context19.t1 = _context19['catch'](9);
            _context19.next = 22;
            return iter.end();

          case 22:
            throw _context19.t1;

          case 23:
            _context19.next = 5;
            break;

          case 25:

            this.logger.warning('Wiped %d txdb records.', total);

            _context19.next = 28;
            return batch.write();

          case 28:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this, [[9, 18]]);
  }));

  function wipe() {
    return _ref19.apply(this, arguments);
  }

  return wipe;
}();

/**
 * Get current wallet wid depth.
 * @private
 * @returns {Promise}
 */

WalletDB.prototype.getDepth = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20() {
    var iter, key, depth;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            // This may seem like a strange way to do
            // this, but updating a global state when
            // creating a new wallet is actually pretty
            // damn tricky. There would be major atomicity
            // issues if updating a global state inside
            // a "scoped" state. So, we avoid all the
            // nonsense of adding a global lock to
            // walletdb.create by simply seeking to the
            // highest wallet wid.
            iter = this.db.iterator({
              gte: layout.w(0x00000000),
              lte: layout.w(0xffffffff),
              reverse: true,
              limit: 1
            });
            _context20.next = 3;
            return iter.next();

          case 3:
            if (_context20.sent) {
              _context20.next = 5;
              break;
            }

            return _context20.abrupt('return', 1);

          case 5:
            key = iter.key;
            _context20.next = 8;
            return iter.end();

          case 8:
            depth = layout.ww(key);
            return _context20.abrupt('return', depth + 1);

          case 10:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function getDepth() {
    return _ref20.apply(this, arguments);
  }

  return getDepth;
}();

/**
 * Start batch.
 * @private
 * @param {WalletID} wid
 */

WalletDB.prototype.start = function start(wallet) {
  assert(!wallet.current, 'WDB: Batch already started.');
  wallet.current = this.db.batch();
  wallet.accountCache.start();
  wallet.pathCache.start();
  return wallet.current;
};

/**
 * Drop batch.
 * @private
 * @param {WalletID} wid
 */

WalletDB.prototype.drop = function drop(wallet) {
  var batch = this.batch(wallet);
  wallet.current = null;
  wallet.accountCache.drop();
  wallet.pathCache.drop();
  batch.clear();
};

/**
 * Clear batch.
 * @private
 * @param {WalletID} wid
 */

WalletDB.prototype.clear = function clear(wallet) {
  var batch = this.batch(wallet);
  wallet.accountCache.clear();
  wallet.pathCache.clear();
  batch.clear();
};

/**
 * Get batch.
 * @private
 * @param {WalletID} wid
 * @returns {Leveldown.Batch}
 */

WalletDB.prototype.batch = function batch(wallet) {
  assert(wallet.current, 'WDB: Batch does not exist.');
  return wallet.current;
};

/**
 * Save batch.
 * @private
 * @param {WalletID} wid
 * @returns {Promise}
 */

WalletDB.prototype.commit = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(wallet) {
    var batch;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            batch = this.batch(wallet);
            _context21.prev = 1;
            _context21.next = 4;
            return batch.write();

          case 4:
            _context21.next = 12;
            break;

          case 6:
            _context21.prev = 6;
            _context21.t0 = _context21['catch'](1);

            wallet.current = null;
            wallet.accountCache.drop();
            wallet.pathCache.drop();
            throw _context21.t0;

          case 12:

            wallet.current = null;
            wallet.accountCache.commit();
            wallet.pathCache.commit();

          case 15:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this, [[1, 6]]);
  }));

  function commit(_x13) {
    return _ref21.apply(this, arguments);
  }

  return commit;
}();

/**
 * Test the bloom filter against a tx or address hash.
 * @private
 * @param {Hash} hash
 * @returns {Boolean}
 */

WalletDB.prototype.testFilter = function testFilter(data) {
  return this.filter.test(data, 'hex');
};

/**
 * Add hash to local and remote filters.
 * @private
 * @param {Hash} hash
 */

WalletDB.prototype.addHash = function addHash(hash) {
  this.filter.add(hash, 'hex');
  return this.addFilter(hash);
};

/**
 * Add outpoint to local filter.
 * @private
 * @param {Hash} hash
 * @param {Number} index
 */

WalletDB.prototype.addOutpoint = function addOutpoint(hash, index) {
  var outpoint = new Outpoint(hash, index);
  this.filter.add(outpoint.toRaw());
};

/**
 * Dump database (for debugging).
 * @returns {Promise} - Returns Object.
 */

WalletDB.prototype.dump = function dump() {
  return this.db.dump();
};

/**
 * Register an object with the walletdb.
 * @param {Object} object
 */

WalletDB.prototype.register = function register(wallet) {
  assert(!this.wallets.has(wallet.wid));
  this.wallets.set(wallet.wid, wallet);
};

/**
 * Unregister a object with the walletdb.
 * @param {Object} object
 * @returns {Boolean}
 */

WalletDB.prototype.unregister = function unregister(wallet) {
  assert(this.wallets.has(wallet.wid));
  this.wallets.delete(wallet.wid);
};

/**
 * Map wallet id to wid.
 * @param {String} id
 * @returns {Promise} - Returns {WalletID}.
 */

WalletDB.prototype.getWalletID = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(id) {
    var cache, data, wid;
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            if (id) {
              _context22.next = 2;
              break;
            }

            return _context22.abrupt('return', null);

          case 2:
            if (!(typeof id === 'number')) {
              _context22.next = 4;
              break;
            }

            return _context22.abrupt('return', id);

          case 4:
            cache = this.widCache.get(id);

            if (!cache) {
              _context22.next = 7;
              break;
            }

            return _context22.abrupt('return', cache);

          case 7:
            _context22.next = 9;
            return this.db.get(layout.l(id));

          case 9:
            data = _context22.sent;

            if (data) {
              _context22.next = 12;
              break;
            }

            return _context22.abrupt('return', null);

          case 12:
            wid = data.readUInt32LE(0, true);


            this.widCache.set(id, wid);

            return _context22.abrupt('return', wid);

          case 15:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function getWalletID(_x14) {
    return _ref22.apply(this, arguments);
  }

  return getWalletID;
}();

/**
 * Get a wallet from the database, setup watcher.
 * @param {WalletID} wid
 * @returns {Promise} - Returns {@link Wallet}.
 */

WalletDB.prototype.get = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(id) {
    var wid, unlock;
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            _context23.next = 2;
            return this.getWalletID(id);

          case 2:
            wid = _context23.sent;

            if (wid) {
              _context23.next = 5;
              break;
            }

            return _context23.abrupt('return', null);

          case 5:
            _context23.next = 7;
            return this.readLock.lock(wid);

          case 7:
            unlock = _context23.sent;
            _context23.prev = 8;
            _context23.next = 11;
            return this._get(wid);

          case 11:
            return _context23.abrupt('return', _context23.sent);

          case 12:
            _context23.prev = 12;

            unlock();
            return _context23.finish(12);

          case 15:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this, [[8,, 12, 15]]);
  }));

  function get(_x15) {
    return _ref23.apply(this, arguments);
  }

  return get;
}();

/**
 * Get a wallet from the database without a lock.
 * @private
 * @param {WalletID} wid
 * @returns {Promise} - Returns {@link Wallet}.
 */

WalletDB.prototype._get = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(wid) {
    var cache, data, wallet;
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            cache = this.wallets.get(wid);

            if (!cache) {
              _context24.next = 3;
              break;
            }

            return _context24.abrupt('return', cache);

          case 3:
            _context24.next = 5;
            return this.db.get(layout.w(wid));

          case 5:
            data = _context24.sent;

            if (data) {
              _context24.next = 8;
              break;
            }

            return _context24.abrupt('return', null);

          case 8:
            wallet = Wallet.fromRaw(this, data);
            _context24.next = 11;
            return wallet.open();

          case 11:

            this.register(wallet);

            return _context24.abrupt('return', wallet);

          case 13:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function _get(_x16) {
    return _ref24.apply(this, arguments);
  }

  return _get;
}();

/**
 * Save a wallet to the database.
 * @param {Wallet} wallet
 */

WalletDB.prototype.save = function save(wallet) {
  var wid = wallet.wid;
  var id = wallet.id;
  var batch = this.batch(wallet);

  this.widCache.set(id, wid);

  batch.put(layout.w(wid), wallet.toRaw());
  batch.put(layout.l(id), U32(wid));
};

/**
 * Rename a wallet.
 * @param {Wallet} wallet
 * @param {String} id
 * @returns {Promise}
 */

WalletDB.prototype.rename = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(wallet, id) {
    var unlock;
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            _context25.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context25.sent;
            _context25.prev = 3;
            _context25.next = 6;
            return this._rename(wallet, id);

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

  function rename(_x17, _x18) {
    return _ref25.apply(this, arguments);
  }

  return rename;
}();

/**
 * Rename a wallet without a lock.
 * @private
 * @param {Wallet} wallet
 * @param {String} id
 * @returns {Promise}
 */

WalletDB.prototype._rename = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(wallet, id) {
    var old, batch, paths, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _path;

    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            old = wallet.id;

            if (common.isName(id)) {
              _context26.next = 3;
              break;
            }

            throw new Error('WDB: Bad wallet ID.');

          case 3:
            _context26.next = 5;
            return this.has(id);

          case 5:
            if (!_context26.sent) {
              _context26.next = 7;
              break;
            }

            throw new Error('WDB: ID not available.');

          case 7:
            batch = this.start(wallet);

            batch.del(layout.l(old));

            wallet.id = id;

            this.save(wallet);

            _context26.next = 13;
            return this.commit(wallet);

          case 13:

            this.widCache.remove(old);

            paths = wallet.pathCache.values();
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context26.prev = 18;


            for (_iterator2 = (0, _getIterator3.default)(paths); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              _path = _step2.value;

              _path.id = id;
            }_context26.next = 26;
            break;

          case 22:
            _context26.prev = 22;
            _context26.t0 = _context26['catch'](18);
            _didIteratorError2 = true;
            _iteratorError2 = _context26.t0;

          case 26:
            _context26.prev = 26;
            _context26.prev = 27;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 29:
            _context26.prev = 29;

            if (!_didIteratorError2) {
              _context26.next = 32;
              break;
            }

            throw _iteratorError2;

          case 32:
            return _context26.finish(29);

          case 33:
            return _context26.finish(26);

          case 34:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this, [[18, 22, 26, 34], [27,, 29, 33]]);
  }));

  function _rename(_x19, _x20) {
    return _ref26.apply(this, arguments);
  }

  return _rename;
}();

/**
 * Rename an account.
 * @param {Account} account
 * @param {String} name
 */

WalletDB.prototype.renameAccount = function renameAccount(account, name) {
  var wallet = account.wallet;
  var batch = this.batch(wallet);

  // Remove old wid/name->account index.
  batch.del(layout.i(account.wid, account.name));

  account.name = name;

  this.saveAccount(account);
};

/**
 * Get a wallet with token auth first.
 * @param {WalletID} wid
 * @param {String|Buffer} token
 * @returns {Promise} - Returns {@link Wallet}.
 */

WalletDB.prototype.auth = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(wid, token) {
    var wallet;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            _context27.next = 2;
            return this.get(wid);

          case 2:
            wallet = _context27.sent;

            if (wallet) {
              _context27.next = 5;
              break;
            }

            return _context27.abrupt('return', null);

          case 5:
            if (!(typeof token === 'string')) {
              _context27.next = 9;
              break;
            }

            if (util.isHex256(token)) {
              _context27.next = 8;
              break;
            }

            throw new Error('WDB: Authentication error.');

          case 8:
            token = Buffer.from(token, 'hex');

          case 9:
            if (ccmp(token, wallet.token)) {
              _context27.next = 11;
              break;
            }

            throw new Error('WDB: Authentication error.');

          case 11:
            return _context27.abrupt('return', wallet);

          case 12:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function auth(_x21, _x22) {
    return _ref27.apply(this, arguments);
  }

  return auth;
}();

/**
 * Create a new wallet, save to database, setup watcher.
 * @param {Object} options - See {@link Wallet}.
 * @returns {Promise} - Returns {@link Wallet}.
 */

WalletDB.prototype.create = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(options) {
    var unlock;
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            _context28.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context28.sent;


            if (!options) options = {};

            _context28.prev = 4;
            _context28.next = 7;
            return this._create(options);

          case 7:
            return _context28.abrupt('return', _context28.sent);

          case 8:
            _context28.prev = 8;

            unlock();
            return _context28.finish(8);

          case 11:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this, [[4,, 8, 11]]);
  }));

  function create(_x23) {
    return _ref28.apply(this, arguments);
  }

  return create;
}();

/**
 * Create a new wallet, save to database without a lock.
 * @private
 * @param {Object} options - See {@link Wallet}.
 * @returns {Promise} - Returns {@link Wallet}.
 */

WalletDB.prototype._create = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(options) {
    var exists, wallet;
    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            _context29.next = 2;
            return this.has(options.id);

          case 2:
            exists = _context29.sent;

            if (!exists) {
              _context29.next = 5;
              break;
            }

            throw new Error('WDB: Wallet already exists.');

          case 5:
            wallet = Wallet.fromOptions(this, options);

            wallet.wid = this.depth++;

            _context29.next = 9;
            return wallet.init(options);

          case 9:

            this.register(wallet);

            this.logger.info('Created wallet %s in WalletDB.', wallet.id);

            return _context29.abrupt('return', wallet);

          case 12:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this);
  }));

  function _create(_x24) {
    return _ref29.apply(this, arguments);
  }

  return _create;
}();

/**
 * Test for the existence of a wallet.
 * @param {WalletID} id
 * @returns {Promise}
 */

WalletDB.prototype.has = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(id) {
    var wid;
    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            _context30.next = 2;
            return this.getWalletID(id);

          case 2:
            wid = _context30.sent;
            return _context30.abrupt('return', wid != null);

          case 4:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this);
  }));

  function has(_x25) {
    return _ref30.apply(this, arguments);
  }

  return has;
}();

/**
 * Attempt to create wallet, return wallet if already exists.
 * @param {Object} options - See {@link Wallet}.
 * @returns {Promise}
 */

WalletDB.prototype.ensure = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(options) {
    var wallet;
    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            _context31.next = 2;
            return this.get(options.id);

          case 2:
            wallet = _context31.sent;

            if (!wallet) {
              _context31.next = 5;
              break;
            }

            return _context31.abrupt('return', wallet);

          case 5:
            _context31.next = 7;
            return this.create(options);

          case 7:
            return _context31.abrupt('return', _context31.sent);

          case 8:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this);
  }));

  function ensure(_x26) {
    return _ref31.apply(this, arguments);
  }

  return ensure;
}();

/**
 * Get an account from the database by wid.
 * @private
 * @param {WalletID} wid
 * @param {Number} index - Account index.
 * @returns {Promise} - Returns {@link Wallet}.
 */

WalletDB.prototype.getAccount = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(wid, index) {
    var data;
    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            _context32.next = 2;
            return this.db.get(layout.a(wid, index));

          case 2:
            data = _context32.sent;

            if (data) {
              _context32.next = 5;
              break;
            }

            return _context32.abrupt('return', null);

          case 5:
            return _context32.abrupt('return', Account.fromRaw(this, data));

          case 6:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this);
  }));

  function getAccount(_x27, _x28) {
    return _ref32.apply(this, arguments);
  }

  return getAccount;
}();

/**
 * List account names and indexes from the db.
 * @param {WalletID} wid
 * @returns {Promise} - Returns Array.
 */

WalletDB.prototype.getAccounts = function getAccounts(wid) {
  return this.db.values({
    gte: layout.n(wid, 0x00000000),
    lte: layout.n(wid, 0xffffffff),
    parse: function parse(data) {
      return data.toString('ascii');
    }
  });
};

/**
 * Lookup the corresponding account name's index.
 * @param {WalletID} wid
 * @param {String} name - Account name/index.
 * @returns {Promise} - Returns Number.
 */

WalletDB.prototype.getAccountIndex = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(wid, name) {
    var index;
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            _context33.next = 2;
            return this.db.get(layout.i(wid, name));

          case 2:
            index = _context33.sent;

            if (index) {
              _context33.next = 5;
              break;
            }

            return _context33.abrupt('return', -1);

          case 5:
            return _context33.abrupt('return', index.readUInt32LE(0, true));

          case 6:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this);
  }));

  function getAccountIndex(_x29, _x30) {
    return _ref33.apply(this, arguments);
  }

  return getAccountIndex;
}();

/**
 * Lookup the corresponding account index's name.
 * @param {WalletID} wid
 * @param {Number} index
 * @returns {Promise} - Returns Number.
 */

WalletDB.prototype.getAccountName = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(wid, index) {
    var name;
    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            _context34.next = 2;
            return this.db.get(layout.n(wid, index));

          case 2:
            name = _context34.sent;

            if (name) {
              _context34.next = 5;
              break;
            }

            return _context34.abrupt('return', null);

          case 5:
            return _context34.abrupt('return', name.toString('ascii'));

          case 6:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this);
  }));

  function getAccountName(_x31, _x32) {
    return _ref34.apply(this, arguments);
  }

  return getAccountName;
}();

/**
 * Save an account to the database.
 * @param {Account} account
 * @returns {Promise}
 */

WalletDB.prototype.saveAccount = function saveAccount(account) {
  var wid = account.wid;
  var wallet = account.wallet;
  var index = account.accountIndex;
  var name = account.name;
  var batch = this.batch(wallet);

  // Account data
  batch.put(layout.a(wid, index), account.toRaw());

  // Name->Index lookups
  batch.put(layout.i(wid, name), U32(index));

  // Index->Name lookups
  batch.put(layout.n(wid, index), Buffer.from(name, 'ascii'));

  wallet.accountCache.push(index, account);
};

/**
 * Test for the existence of an account.
 * @param {WalletID} wid
 * @param {String|Number} acct
 * @returns {Promise} - Returns Boolean.
 */

WalletDB.prototype.hasAccount = function hasAccount(wid, index) {
  return this.db.has(layout.a(wid, index));
};

/**
 * Lookup the corresponding account name's index.
 * @param {WalletID} wid
 * @param {String|Number} name - Account name/index.
 * @returns {Promise} - Returns Number.
 */

WalletDB.prototype.getPathMap = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(hash) {
    var cache, data, map;
    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            cache = this.pathMapCache.get(hash);

            if (!cache) {
              _context35.next = 3;
              break;
            }

            return _context35.abrupt('return', cache);

          case 3:
            _context35.next = 5;
            return this.db.get(layout.p(hash));

          case 5:
            data = _context35.sent;

            if (data) {
              _context35.next = 8;
              break;
            }

            return _context35.abrupt('return', null);

          case 8:
            map = PathMapRecord.fromRaw(hash, data);


            this.pathMapCache.set(hash, map);

            return _context35.abrupt('return', map);

          case 11:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this);
  }));

  function getPathMap(_x33) {
    return _ref35.apply(this, arguments);
  }

  return getPathMap;
}();

/**
 * Save an address to the path map.
 * @param {Wallet} wallet
 * @param {WalletKey} ring
 * @returns {Promise}
 */

WalletDB.prototype.saveKey = function saveKey(wallet, ring) {
  return this.savePath(wallet, ring.toPath());
};

/**
 * Save a path to the path map.
 *
 * The path map exists in the form of:
 *   - `p[address-hash] -> wid map`
 *   - `P[wid][address-hash] -> path data`
 *   - `r[wid][account-index][address-hash] -> dummy`
 *
 * @param {Wallet} wallet
 * @param {Path} path
 * @returns {Promise}
 */

WalletDB.prototype.savePath = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(wallet, path) {
    var wid, hash, batch, map;
    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            wid = wallet.wid;
            hash = path.hash;
            batch = this.batch(wallet);
            _context36.next = 5;
            return this.addHash(hash);

          case 5:
            _context36.next = 7;
            return this.getPathMap(hash);

          case 7:
            map = _context36.sent;


            if (!map) map = new PathMapRecord(hash);

            if (map.add(wid)) {
              _context36.next = 11;
              break;
            }

            return _context36.abrupt('return');

          case 11:

            this.pathMapCache.set(hash, map);
            wallet.pathCache.push(hash, path);

            // Address Hash -> Wallet Map
            batch.put(layout.p(hash), map.toRaw());

            // Wallet ID + Address Hash -> Path Data
            batch.put(layout.P(wid, hash), path.toRaw());

            // Wallet ID + Account Index + Address Hash -> Dummy
            batch.put(layout.r(wid, path.account, hash), null);

          case 16:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this);
  }));

  function savePath(_x34, _x35) {
    return _ref36.apply(this, arguments);
  }

  return savePath;
}();

/**
 * Retrieve path by hash.
 * @param {WalletID} wid
 * @param {Hash} hash
 * @returns {Promise}
 */

WalletDB.prototype.getPath = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(wid, hash) {
    var data, path;
    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            _context37.next = 2;
            return this.db.get(layout.P(wid, hash));

          case 2:
            data = _context37.sent;

            if (data) {
              _context37.next = 5;
              break;
            }

            return _context37.abrupt('return', null);

          case 5:
            path = Path.fromRaw(data);

            path.wid = wid;
            path.hash = hash;

            return _context37.abrupt('return', path);

          case 9:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this);
  }));

  function getPath(_x36, _x37) {
    return _ref37.apply(this, arguments);
  }

  return getPath;
}();

/**
 * Test whether a wallet contains a path.
 * @param {WalletID} wid
 * @param {Hash} hash
 * @returns {Promise}
 */

WalletDB.prototype.hasPath = function hasPath(wid, hash) {
  return this.db.has(layout.P(wid, hash));
};

/**
 * Get all address hashes.
 * @returns {Promise}
 */

WalletDB.prototype.getHashes = function getHashes() {
  return this.db.keys({
    gte: layout.p(encoding.NULL_HASH),
    lte: layout.p(encoding.HIGH_HASH),
    parse: layout.pp
  });
};

/**
 * Get all outpoints.
 * @returns {Promise}
 */

WalletDB.prototype.getOutpoints = function getOutpoints() {
  return this.db.keys({
    gte: layout.o(encoding.NULL_HASH, 0),
    lte: layout.o(encoding.HIGH_HASH, 0xffffffff),
    parse: function parse(key) {
      var _layout$oo3 = layout.oo(key),
          _layout$oo4 = (0, _slicedToArray3.default)(_layout$oo3, 2),
          hash = _layout$oo4[0],
          index = _layout$oo4[1];

      return new Outpoint(hash, index);
    }
  });
};

/**
 * Get all address hashes.
 * @param {WalletID} wid
 * @returns {Promise}
 */

WalletDB.prototype.getWalletHashes = function getWalletHashes(wid) {
  return this.db.keys({
    gte: layout.P(wid, encoding.NULL_HASH),
    lte: layout.P(wid, encoding.HIGH_HASH),
    parse: layout.Pp
  });
};

/**
 * Get all account address hashes.
 * @param {WalletID} wid
 * @param {Number} account
 * @returns {Promise}
 */

WalletDB.prototype.getAccountHashes = function getAccountHashes(wid, account) {
  return this.db.keys({
    gte: layout.r(wid, account, encoding.NULL_HASH),
    lte: layout.r(wid, account, encoding.HIGH_HASH),
    parse: layout.rr
  });
};

/**
 * Get all paths for a wallet.
 * @param {WalletID} wid
 * @returns {Promise}
 */

WalletDB.prototype.getWalletPaths = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(wid) {
    var items, paths, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, item, hash, _path2;

    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            _context38.next = 2;
            return this.db.range({
              gte: layout.P(wid, encoding.NULL_HASH),
              lte: layout.P(wid, encoding.HIGH_HASH)
            });

          case 2:
            items = _context38.sent;
            paths = [];
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context38.prev = 7;


            for (_iterator3 = (0, _getIterator3.default)(items); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              item = _step3.value;
              hash = layout.Pp(item.key);
              _path2 = Path.fromRaw(item.value);


              _path2.hash = hash;
              _path2.wid = wid;

              paths.push(_path2);
            }

            _context38.next = 15;
            break;

          case 11:
            _context38.prev = 11;
            _context38.t0 = _context38['catch'](7);
            _didIteratorError3 = true;
            _iteratorError3 = _context38.t0;

          case 15:
            _context38.prev = 15;
            _context38.prev = 16;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 18:
            _context38.prev = 18;

            if (!_didIteratorError3) {
              _context38.next = 21;
              break;
            }

            throw _iteratorError3;

          case 21:
            return _context38.finish(18);

          case 22:
            return _context38.finish(15);

          case 23:
            return _context38.abrupt('return', paths);

          case 24:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getWalletPaths(_x38) {
    return _ref38.apply(this, arguments);
  }

  return getWalletPaths;
}();

/**
 * Get all wallet ids.
 * @returns {Promise}
 */

WalletDB.prototype.getWallets = function getWallets() {
  return this.db.keys({
    gte: layout.l('\x00'),
    lte: layout.l('\xff'),
    parse: layout.ll
  });
};

/**
 * Encrypt all imported keys for a wallet.
 * @param {WalletID} wid
 * @param {Buffer} key
 * @returns {Promise}
 */

WalletDB.prototype.encryptKeys = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(wallet, key) {
    var wid, paths, batch, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _path3, hash, iv;

    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            wid = wallet.wid;
            _context39.next = 3;
            return wallet.getPaths();

          case 3:
            paths = _context39.sent;
            batch = this.batch(wallet);
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context39.prev = 8;
            _iterator4 = (0, _getIterator3.default)(paths);

          case 10:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context39.next = 25;
              break;
            }

            _path3 = _step4.value;

            if (_path3.data) {
              _context39.next = 14;
              break;
            }

            return _context39.abrupt('continue', 22);

          case 14:

            assert(!_path3.encrypted);

            hash = Buffer.from(_path3.hash, 'hex');
            iv = hash.slice(0, 16);


            _path3 = _path3.clone();
            _path3.data = aes.encipher(_path3.data, key, iv);
            _path3.encrypted = true;

            wallet.pathCache.push(_path3.hash, _path3);

            batch.put(layout.P(wid, _path3.hash), _path3.toRaw());

          case 22:
            _iteratorNormalCompletion4 = true;
            _context39.next = 10;
            break;

          case 25:
            _context39.next = 31;
            break;

          case 27:
            _context39.prev = 27;
            _context39.t0 = _context39['catch'](8);
            _didIteratorError4 = true;
            _iteratorError4 = _context39.t0;

          case 31:
            _context39.prev = 31;
            _context39.prev = 32;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 34:
            _context39.prev = 34;

            if (!_didIteratorError4) {
              _context39.next = 37;
              break;
            }

            throw _iteratorError4;

          case 37:
            return _context39.finish(34);

          case 38:
            return _context39.finish(31);

          case 39:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this, [[8, 27, 31, 39], [32,, 34, 38]]);
  }));

  function encryptKeys(_x39, _x40) {
    return _ref39.apply(this, arguments);
  }

  return encryptKeys;
}();

/**
 * Decrypt all imported keys for a wallet.
 * @param {WalletID} wid
 * @param {Buffer} key
 * @returns {Promise}
 */

WalletDB.prototype.decryptKeys = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(wallet, key) {
    var wid, paths, batch, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _path4, hash, iv;

    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            wid = wallet.wid;
            _context40.next = 3;
            return wallet.getPaths();

          case 3:
            paths = _context40.sent;
            batch = this.batch(wallet);
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context40.prev = 8;
            _iterator5 = (0, _getIterator3.default)(paths);

          case 10:
            if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
              _context40.next = 25;
              break;
            }

            _path4 = _step5.value;

            if (_path4.data) {
              _context40.next = 14;
              break;
            }

            return _context40.abrupt('continue', 22);

          case 14:

            assert(_path4.encrypted);

            hash = Buffer.from(_path4.hash, 'hex');
            iv = hash.slice(0, 16);


            _path4 = _path4.clone();
            _path4.data = aes.decipher(_path4.data, key, iv);
            _path4.encrypted = false;

            wallet.pathCache.push(_path4.hash, _path4);

            batch.put(layout.P(wid, _path4.hash), _path4.toRaw());

          case 22:
            _iteratorNormalCompletion5 = true;
            _context40.next = 10;
            break;

          case 25:
            _context40.next = 31;
            break;

          case 27:
            _context40.prev = 27;
            _context40.t0 = _context40['catch'](8);
            _didIteratorError5 = true;
            _iteratorError5 = _context40.t0;

          case 31:
            _context40.prev = 31;
            _context40.prev = 32;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 34:
            _context40.prev = 34;

            if (!_didIteratorError5) {
              _context40.next = 37;
              break;
            }

            throw _iteratorError5;

          case 37:
            return _context40.finish(34);

          case 38:
            return _context40.finish(31);

          case 39:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this, [[8, 27, 31, 39], [32,, 34, 38]]);
  }));

  function decryptKeys(_x41, _x42) {
    return _ref40.apply(this, arguments);
  }

  return decryptKeys;
}();

/**
 * Resend all pending transactions.
 * @returns {Promise}
 */

WalletDB.prototype.resend = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41() {
    var keys, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, key, wid;

    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            _context41.next = 2;
            return this.db.keys({
              gte: layout.w(0x00000000),
              lte: layout.w(0xffffffff)
            });

          case 2:
            keys = _context41.sent;
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context41.prev = 6;
            _iterator6 = (0, _getIterator3.default)(keys);

          case 8:
            if (_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done) {
              _context41.next = 16;
              break;
            }

            key = _step6.value;
            wid = layout.ww(key);
            _context41.next = 13;
            return this.resendPending(wid);

          case 13:
            _iteratorNormalCompletion6 = true;
            _context41.next = 8;
            break;

          case 16:
            _context41.next = 22;
            break;

          case 18:
            _context41.prev = 18;
            _context41.t0 = _context41['catch'](6);
            _didIteratorError6 = true;
            _iteratorError6 = _context41.t0;

          case 22:
            _context41.prev = 22;
            _context41.prev = 23;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 25:
            _context41.prev = 25;

            if (!_didIteratorError6) {
              _context41.next = 28;
              break;
            }

            throw _iteratorError6;

          case 28:
            return _context41.finish(25);

          case 29:
            return _context41.finish(22);

          case 30:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this, [[6, 18, 22, 30], [23,, 25, 29]]);
  }));

  function resend() {
    return _ref41.apply(this, arguments);
  }

  return resend;
}();

/**
 * Resend all pending transactions for a specific wallet.
 * @private
 * @param {WalletID} wid
 * @returns {Promise}
 */

WalletDB.prototype.resendPending = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(wid) {
    var layout, keys, txs, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, key, hash, tkey, data, wtx, sorted, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, tx;

    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            layout = layouts.txdb;
            _context42.next = 3;
            return this.db.keys({
              gte: layout.prefix(wid, layout.p(encoding.NULL_HASH)),
              lte: layout.prefix(wid, layout.p(encoding.HIGH_HASH))
            });

          case 3:
            keys = _context42.sent;

            if (!(keys.length === 0)) {
              _context42.next = 6;
              break;
            }

            return _context42.abrupt('return');

          case 6:

            this.logger.info('Rebroadcasting %d transactions for %d.', keys.length, wid);

            txs = [];
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context42.prev = 11;
            _iterator7 = (0, _getIterator3.default)(keys);

          case 13:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context42.next = 29;
              break;
            }

            key = _step7.value;
            hash = layout.pp(key);
            tkey = layout.prefix(wid, layout.t(hash));
            _context42.next = 19;
            return this.db.get(tkey);

          case 19:
            data = _context42.sent;

            if (data) {
              _context42.next = 22;
              break;
            }

            return _context42.abrupt('continue', 26);

          case 22:
            wtx = TXRecord.fromRaw(data);

            if (!wtx.tx.isCoinbase()) {
              _context42.next = 25;
              break;
            }

            return _context42.abrupt('continue', 26);

          case 25:

            txs.push(wtx.tx);

          case 26:
            _iteratorNormalCompletion7 = true;
            _context42.next = 13;
            break;

          case 29:
            _context42.next = 35;
            break;

          case 31:
            _context42.prev = 31;
            _context42.t0 = _context42['catch'](11);
            _didIteratorError7 = true;
            _iteratorError7 = _context42.t0;

          case 35:
            _context42.prev = 35;
            _context42.prev = 36;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 38:
            _context42.prev = 38;

            if (!_didIteratorError7) {
              _context42.next = 41;
              break;
            }

            throw _iteratorError7;

          case 41:
            return _context42.finish(38);

          case 42:
            return _context42.finish(35);

          case 43:
            sorted = common.sortDeps(txs);
            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context42.prev = 47;
            _iterator8 = (0, _getIterator3.default)(sorted);

          case 49:
            if (_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done) {
              _context42.next = 56;
              break;
            }

            tx = _step8.value;
            _context42.next = 53;
            return this.send(tx);

          case 53:
            _iteratorNormalCompletion8 = true;
            _context42.next = 49;
            break;

          case 56:
            _context42.next = 62;
            break;

          case 58:
            _context42.prev = 58;
            _context42.t1 = _context42['catch'](47);
            _didIteratorError8 = true;
            _iteratorError8 = _context42.t1;

          case 62:
            _context42.prev = 62;
            _context42.prev = 63;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 65:
            _context42.prev = 65;

            if (!_didIteratorError8) {
              _context42.next = 68;
              break;
            }

            throw _iteratorError8;

          case 68:
            return _context42.finish(65);

          case 69:
            return _context42.finish(62);

          case 70:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this, [[11, 31, 35, 43], [36,, 38, 42], [47, 58, 62, 70], [63,, 65, 69]]);
  }));

  function resendPending(_x43) {
    return _ref42.apply(this, arguments);
  }

  return resendPending;
}();

/**
 * Get all wallet ids by output addresses and outpoints.
 * @param {Hash[]} hashes
 * @returns {Promise}
 */

WalletDB.prototype.getWalletsByTX = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(tx) {
    var hashes, result, _iteratorNormalCompletion9, _didIteratorError9, _iteratorError9, _iterator9, _step9, input, prevout, map, _iteratorNormalCompletion10, _didIteratorError10, _iteratorError10, _iterator10, _step10, wid, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, hash, _map, _iteratorNormalCompletion12, _didIteratorError12, _iteratorError12, _iterator12, _step12, _wid;

    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            hashes = tx.getOutputHashes('hex');
            result = new _set2.default();

            if (tx.isCoinbase()) {
              _context43.next = 54;
              break;
            }

            _iteratorNormalCompletion9 = true;
            _didIteratorError9 = false;
            _iteratorError9 = undefined;
            _context43.prev = 6;
            _iterator9 = (0, _getIterator3.default)(tx.inputs);

          case 8:
            if (_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done) {
              _context43.next = 40;
              break;
            }

            input = _step9.value;
            prevout = input.prevout;

            if (this.testFilter(prevout.toRaw())) {
              _context43.next = 13;
              break;
            }

            return _context43.abrupt('continue', 37);

          case 13:
            _context43.next = 15;
            return this.getOutpointMap(prevout.hash, prevout.index);

          case 15:
            map = _context43.sent;

            if (map) {
              _context43.next = 18;
              break;
            }

            return _context43.abrupt('continue', 37);

          case 18:
            _iteratorNormalCompletion10 = true;
            _didIteratorError10 = false;
            _iteratorError10 = undefined;
            _context43.prev = 21;


            for (_iterator10 = (0, _getIterator3.default)(map.wids); !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
              wid = _step10.value;

              result.add(wid);
            }_context43.next = 29;
            break;

          case 25:
            _context43.prev = 25;
            _context43.t0 = _context43['catch'](21);
            _didIteratorError10 = true;
            _iteratorError10 = _context43.t0;

          case 29:
            _context43.prev = 29;
            _context43.prev = 30;

            if (!_iteratorNormalCompletion10 && _iterator10.return) {
              _iterator10.return();
            }

          case 32:
            _context43.prev = 32;

            if (!_didIteratorError10) {
              _context43.next = 35;
              break;
            }

            throw _iteratorError10;

          case 35:
            return _context43.finish(32);

          case 36:
            return _context43.finish(29);

          case 37:
            _iteratorNormalCompletion9 = true;
            _context43.next = 8;
            break;

          case 40:
            _context43.next = 46;
            break;

          case 42:
            _context43.prev = 42;
            _context43.t1 = _context43['catch'](6);
            _didIteratorError9 = true;
            _iteratorError9 = _context43.t1;

          case 46:
            _context43.prev = 46;
            _context43.prev = 47;

            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }

          case 49:
            _context43.prev = 49;

            if (!_didIteratorError9) {
              _context43.next = 52;
              break;
            }

            throw _iteratorError9;

          case 52:
            return _context43.finish(49);

          case 53:
            return _context43.finish(46);

          case 54:
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context43.prev = 57;
            _iterator11 = (0, _getIterator3.default)(hashes);

          case 59:
            if (_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done) {
              _context43.next = 90;
              break;
            }

            hash = _step11.value;

            if (this.testFilter(hash)) {
              _context43.next = 63;
              break;
            }

            return _context43.abrupt('continue', 87);

          case 63:
            _context43.next = 65;
            return this.getPathMap(hash);

          case 65:
            _map = _context43.sent;

            if (_map) {
              _context43.next = 68;
              break;
            }

            return _context43.abrupt('continue', 87);

          case 68:
            _iteratorNormalCompletion12 = true;
            _didIteratorError12 = false;
            _iteratorError12 = undefined;
            _context43.prev = 71;


            for (_iterator12 = (0, _getIterator3.default)(_map.wids); !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
              _wid = _step12.value;

              result.add(_wid);
            }_context43.next = 79;
            break;

          case 75:
            _context43.prev = 75;
            _context43.t2 = _context43['catch'](71);
            _didIteratorError12 = true;
            _iteratorError12 = _context43.t2;

          case 79:
            _context43.prev = 79;
            _context43.prev = 80;

            if (!_iteratorNormalCompletion12 && _iterator12.return) {
              _iterator12.return();
            }

          case 82:
            _context43.prev = 82;

            if (!_didIteratorError12) {
              _context43.next = 85;
              break;
            }

            throw _iteratorError12;

          case 85:
            return _context43.finish(82);

          case 86:
            return _context43.finish(79);

          case 87:
            _iteratorNormalCompletion11 = true;
            _context43.next = 59;
            break;

          case 90:
            _context43.next = 96;
            break;

          case 92:
            _context43.prev = 92;
            _context43.t3 = _context43['catch'](57);
            _didIteratorError11 = true;
            _iteratorError11 = _context43.t3;

          case 96:
            _context43.prev = 96;
            _context43.prev = 97;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 99:
            _context43.prev = 99;

            if (!_didIteratorError11) {
              _context43.next = 102;
              break;
            }

            throw _iteratorError11;

          case 102:
            return _context43.finish(99);

          case 103:
            return _context43.finish(96);

          case 104:
            if (!(result.size === 0)) {
              _context43.next = 106;
              break;
            }

            return _context43.abrupt('return', null);

          case 106:
            return _context43.abrupt('return', result);

          case 107:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this, [[6, 42, 46, 54], [21, 25, 29, 37], [30,, 32, 36], [47,, 49, 53], [57, 92, 96, 104], [71, 75, 79, 87], [80,, 82, 86], [97,, 99, 103]]);
  }));

  function getWalletsByTX(_x44) {
    return _ref43.apply(this, arguments);
  }

  return getWalletsByTX;
}();

/**
 * Get the best block hash.
 * @returns {Promise}
 */

WalletDB.prototype.getState = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44() {
    var data;
    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            _context44.next = 2;
            return this.db.get(layout.R);

          case 2:
            data = _context44.sent;

            if (data) {
              _context44.next = 5;
              break;
            }

            return _context44.abrupt('return', null);

          case 5:
            return _context44.abrupt('return', ChainState.fromRaw(data));

          case 6:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this);
  }));

  function getState() {
    return _ref44.apply(this, arguments);
  }

  return getState;
}();

/**
 * Reset the chain state to a tip/start-block.
 * @param {BlockMeta} tip
 * @returns {Promise}
 */

WalletDB.prototype.resetState = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(tip, marked) {
    var batch, state, iter;
    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            batch = this.db.batch();
            state = this.state.clone();
            iter = this.db.iterator({
              gte: layout.h(0),
              lte: layout.h(0xffffffff),
              values: false
            });

          case 3:
            _context45.next = 5;
            return iter.next();

          case 5:
            if (!_context45.sent) {
              _context45.next = 17;
              break;
            }

            _context45.prev = 6;

            batch.del(iter.key);
            _context45.next = 15;
            break;

          case 10:
            _context45.prev = 10;
            _context45.t0 = _context45['catch'](6);
            _context45.next = 14;
            return iter.end();

          case 14:
            throw _context45.t0;

          case 15:
            _context45.next = 3;
            break;

          case 17:

            state.startHeight = tip.height;
            state.startHash = tip.hash;
            state.height = tip.height;
            state.marked = marked;

            batch.put(layout.h(tip.height), tip.toHash());
            batch.put(layout.R, state.toRaw());

            _context45.next = 25;
            return batch.write();

          case 25:

            this.state = state;

          case 26:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this, [[6, 10]]);
  }));

  function resetState(_x45, _x46) {
    return _ref45.apply(this, arguments);
  }

  return resetState;
}();

/**
 * Sync the current chain state to tip.
 * @param {BlockMeta} tip
 * @returns {Promise}
 */

WalletDB.prototype.syncState = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(tip) {
    var batch, state, height, blocks, i, _height;

    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            batch = this.db.batch();
            state = this.state.clone();


            if (tip.height < state.height) {
              // Hashes ahead of our new tip
              // that we need to delete.
              height = state.height;
              blocks = height - tip.height;


              if (blocks > this.options.keepBlocks) blocks = this.options.keepBlocks;

              for (i = 0; i < blocks; i++) {
                batch.del(layout.h(height));
                height--;
              }
            } else if (tip.height > state.height) {
              // Prune old hashes.
              _height = tip.height - this.options.keepBlocks;


              assert(tip.height === state.height + 1, 'Bad chain sync.');

              if (_height >= 0) batch.del(layout.h(_height));
            }

            state.height = tip.height;

            // Save tip and state.
            batch.put(layout.h(tip.height), tip.toHash());
            batch.put(layout.R, state.toRaw());

            _context46.next = 8;
            return batch.write();

          case 8:

            this.state = state;

          case 9:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this);
  }));

  function syncState(_x47) {
    return _ref46.apply(this, arguments);
  }

  return syncState;
}();

/**
 * Mark the start block once a confirmed tx is seen.
 * @param {BlockMeta} tip
 * @returns {Promise}
 */

WalletDB.prototype.maybeMark = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47(tip) {
    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            if (!this.state.marked) {
              _context47.next = 2;
              break;
            }

            return _context47.abrupt('return');

          case 2:

            this.logger.info('Marking WalletDB start block at %s (%d).', util.revHex(tip.hash), tip.height);

            _context47.next = 5;
            return this.resetState(tip, true);

          case 5:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this);
  }));

  function maybeMark(_x48) {
    return _ref47.apply(this, arguments);
  }

  return maybeMark;
}();

/**
 * Get a block->wallet map.
 * @param {Number} height
 * @returns {Promise}
 */

WalletDB.prototype.getBlockMap = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48(height) {
    var data;
    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            _context48.next = 2;
            return this.db.get(layout.b(height));

          case 2:
            data = _context48.sent;

            if (data) {
              _context48.next = 5;
              break;
            }

            return _context48.abrupt('return', null);

          case 5:
            return _context48.abrupt('return', BlockMapRecord.fromRaw(height, data));

          case 6:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this);
  }));

  function getBlockMap(_x49) {
    return _ref48.apply(this, arguments);
  }

  return getBlockMap;
}();

/**
 * Add block to the global block map.
 * @param {Wallet} wallet
 * @param {Number} height
 * @param {BlockMapRecord} block
 */

WalletDB.prototype.writeBlockMap = function writeBlockMap(wallet, height, block) {
  var batch = this.batch(wallet);
  batch.put(layout.b(height), block.toRaw());
};

/**
 * Remove a block from the global block map.
 * @param {Wallet} wallet
 * @param {Number} height
 */

WalletDB.prototype.unwriteBlockMap = function unwriteBlockMap(wallet, height) {
  var batch = this.batch(wallet);
  batch.del(layout.b(height));
};

/**
 * Get a Unspent->Wallet map.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise}
 */

WalletDB.prototype.getOutpointMap = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(hash, index) {
    var data;
    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            _context49.next = 2;
            return this.db.get(layout.o(hash, index));

          case 2:
            data = _context49.sent;

            if (data) {
              _context49.next = 5;
              break;
            }

            return _context49.abrupt('return', null);

          case 5:
            return _context49.abrupt('return', OutpointMapRecord.fromRaw(hash, index, data));

          case 6:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this);
  }));

  function getOutpointMap(_x50, _x51) {
    return _ref49.apply(this, arguments);
  }

  return getOutpointMap;
}();

/**
 * Add an outpoint to global unspent map.
 * @param {Wallet} wallet
 * @param {Hash} hash
 * @param {Number} index
 * @param {OutpointMapRecord} map
 */

WalletDB.prototype.writeOutpointMap = function writeOutpointMap(wallet, hash, index, map) {
  var batch = this.batch(wallet);

  this.addOutpoint(hash, index);

  batch.put(layout.o(hash, index), map.toRaw());
};

/**
 * Remove an outpoint from global unspent map.
 * @param {Wallet} wallet
 * @param {Hash} hash
 * @param {Number} index
 */

WalletDB.prototype.unwriteOutpointMap = function unwriteOutpointMap(wallet, hash, index) {
  var batch = this.batch(wallet);
  batch.del(layout.o(hash, index));
};

/**
 * Get a wallet block meta.
 * @param {Hash} hash
 * @returns {Promise}
 */

WalletDB.prototype.getBlock = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(height) {
    var data, block;
    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            _context50.next = 2;
            return this.db.get(layout.h(height));

          case 2:
            data = _context50.sent;

            if (data) {
              _context50.next = 5;
              break;
            }

            return _context50.abrupt('return', null);

          case 5:
            block = new BlockMeta();

            block.hash = data.toString('hex');
            block.height = height;

            return _context50.abrupt('return', block);

          case 9:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function getBlock(_x52) {
    return _ref50.apply(this, arguments);
  }

  return getBlock;
}();

/**
 * Get wallet tip.
 * @param {Hash} hash
 * @returns {Promise}
 */

WalletDB.prototype.getTip = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51() {
    var tip;
    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            _context51.next = 2;
            return this.getBlock(this.state.height);

          case 2:
            tip = _context51.sent;

            if (tip) {
              _context51.next = 5;
              break;
            }

            throw new Error('WDB: Tip not found!');

          case 5:
            return _context51.abrupt('return', tip);

          case 6:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this);
  }));

  function getTip() {
    return _ref51.apply(this, arguments);
  }

  return getTip;
}();

/**
 * Sync with chain height.
 * @param {Number} height
 * @returns {Promise}
 */

WalletDB.prototype.rollback = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(height) {
    var tip, marked;
    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            if (!(height > this.state.height)) {
              _context52.next = 2;
              break;
            }

            throw new Error('WDB: Cannot rollback to the future.');

          case 2:
            if (!(height === this.state.height)) {
              _context52.next = 5;
              break;
            }

            this.logger.debug('Rolled back to same height (%d).', height);
            return _context52.abrupt('return', true);

          case 5:

            this.logger.info('Rolling back %d WalletDB blocks to height %d.', this.state.height - height, height);

            _context52.next = 8;
            return this.getBlock(height);

          case 8:
            tip = _context52.sent;
            marked = false;

            if (!tip) {
              _context52.next = 16;
              break;
            }

            _context52.next = 13;
            return this.revert(tip.height);

          case 13:
            _context52.next = 15;
            return this.syncState(tip);

          case 15:
            return _context52.abrupt('return', true);

          case 16:

            tip = new BlockMeta();

            if (height >= this.state.startHeight) {
              tip.height = this.state.startHeight;
              tip.hash = this.state.startHash;
              marked = this.state.marked;

              this.logger.warning('Rolling back WalletDB to start block (%d).', tip.height);
            } else {
              tip.height = 0;
              tip.hash = this.network.genesis.hash;
              marked = false;

              this.logger.warning('Rolling back WalletDB to genesis block.');
            }

            _context52.next = 20;
            return this.revert(tip.height);

          case 20:
            _context52.next = 22;
            return this.resetState(tip, marked);

          case 22:
            return _context52.abrupt('return', false);

          case 23:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this);
  }));

  function rollback(_x53) {
    return _ref52.apply(this, arguments);
  }

  return rollback;
}();

/**
 * Revert TXDB to an older state.
 * @param {Number} target
 * @returns {Promise}
 */

WalletDB.prototype.revert = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(target) {
    var iter, total, key, value, height, block, txs, i, tx;
    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            iter = this.db.iterator({
              gte: layout.b(target + 1),
              lte: layout.b(0xffffffff),
              reverse: true,
              values: true
            });
            total = 0;

          case 2:
            _context53.next = 4;
            return iter.next();

          case 4:
            if (!_context53.sent) {
              _context53.next = 28;
              break;
            }

            key = iter.key, value = iter.value;
            _context53.prev = 6;
            height = layout.bb(key);
            block = BlockMapRecord.fromRaw(height, value);
            txs = block.toArray();


            total += txs.length;

            i = txs.length - 1;

          case 12:
            if (!(i >= 0)) {
              _context53.next = 19;
              break;
            }

            tx = txs[i];
            _context53.next = 16;
            return this._unconfirm(tx);

          case 16:
            i--;
            _context53.next = 12;
            break;

          case 19:
            _context53.next = 26;
            break;

          case 21:
            _context53.prev = 21;
            _context53.t0 = _context53['catch'](6);
            _context53.next = 25;
            return iter.end();

          case 25:
            throw _context53.t0;

          case 26:
            _context53.next = 2;
            break;

          case 28:

            this.logger.info('Rolled back %d WalletDB transactions.', total);

          case 29:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this, [[6, 21]]);
  }));

  function revert(_x54) {
    return _ref53.apply(this, arguments);
  }

  return revert;
}();

/**
 * Add a block's transactions and write the new best hash.
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

WalletDB.prototype.addBlock = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee54(entry, txs) {
    var unlock;
    return _regenerator2.default.wrap(function _callee54$(_context54) {
      while (1) {
        switch (_context54.prev = _context54.next) {
          case 0:
            _context54.next = 2;
            return this.txLock.lock();

          case 2:
            unlock = _context54.sent;
            _context54.prev = 3;
            _context54.next = 6;
            return this._addBlock(entry, txs);

          case 6:
            return _context54.abrupt('return', _context54.sent);

          case 7:
            _context54.prev = 7;

            unlock();
            return _context54.finish(7);

          case 10:
          case 'end':
            return _context54.stop();
        }
      }
    }, _callee54, this, [[3,, 7, 10]]);
  }));

  function addBlock(_x55, _x56) {
    return _ref54.apply(this, arguments);
  }

  return addBlock;
}();

/**
 * Add a block's transactions without a lock.
 * @private
 * @param {ChainEntry} entry
 * @param {TX[]} txs
 * @returns {Promise}
 */

WalletDB.prototype._addBlock = function () {
  var _ref55 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee55(entry, txs) {
    var tip, total, _iteratorNormalCompletion13, _didIteratorError13, _iteratorError13, _iterator13, _step13, tx;

    return _regenerator2.default.wrap(function _callee55$(_context55) {
      while (1) {
        switch (_context55.prev = _context55.next) {
          case 0:
            tip = BlockMeta.fromEntry(entry);
            total = 0;

            if (!(tip.height < this.state.height)) {
              _context55.next = 5;
              break;
            }

            this.logger.warning('WalletDB is connecting low blocks (%d).', tip.height);
            return _context55.abrupt('return', total);

          case 5:
            if (!(tip.height === this.state.height)) {
              _context55.next = 9;
              break;
            }

            // We let blocks of the same height
            // through specifically for rescans:
            // we always want to rescan the last
            // block since the state may have
            // updated before the block was fully
            // processed (in the case of a crash).
            this.logger.warning('Already saw WalletDB block (%d).', tip.height);
            _context55.next = 11;
            break;

          case 9:
            if (!(tip.height !== this.state.height + 1)) {
              _context55.next = 11;
              break;
            }

            throw new Error('WDB: Bad connection (height mismatch).');

          case 11:
            _context55.next = 13;
            return this.syncState(tip);

          case 13:
            if (!this.options.checkpoints) {
              _context55.next = 16;
              break;
            }

            if (!(tip.height <= this.network.lastCheckpoint)) {
              _context55.next = 16;
              break;
            }

            return _context55.abrupt('return', total);

          case 16:
            _iteratorNormalCompletion13 = true;
            _didIteratorError13 = false;
            _iteratorError13 = undefined;
            _context55.prev = 19;
            _iterator13 = (0, _getIterator3.default)(txs);

          case 21:
            if (_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done) {
              _context55.next = 30;
              break;
            }

            tx = _step13.value;
            _context55.next = 25;
            return this._insert(tx, tip);

          case 25:
            if (!_context55.sent) {
              _context55.next = 27;
              break;
            }

            total++;

          case 27:
            _iteratorNormalCompletion13 = true;
            _context55.next = 21;
            break;

          case 30:
            _context55.next = 36;
            break;

          case 32:
            _context55.prev = 32;
            _context55.t0 = _context55['catch'](19);
            _didIteratorError13 = true;
            _iteratorError13 = _context55.t0;

          case 36:
            _context55.prev = 36;
            _context55.prev = 37;

            if (!_iteratorNormalCompletion13 && _iterator13.return) {
              _iterator13.return();
            }

          case 39:
            _context55.prev = 39;

            if (!_didIteratorError13) {
              _context55.next = 42;
              break;
            }

            throw _iteratorError13;

          case 42:
            return _context55.finish(39);

          case 43:
            return _context55.finish(36);

          case 44:

            if (total > 0) {
              this.logger.info('Connected WalletDB block %s (tx=%d).', util.revHex(tip.hash), total);
            }

            return _context55.abrupt('return', total);

          case 46:
          case 'end':
            return _context55.stop();
        }
      }
    }, _callee55, this, [[19, 32, 36, 44], [37,, 39, 43]]);
  }));

  function _addBlock(_x57, _x58) {
    return _ref55.apply(this, arguments);
  }

  return _addBlock;
}();

/**
 * Unconfirm a block's transactions
 * and write the new best hash (SPV version).
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

WalletDB.prototype.removeBlock = function () {
  var _ref56 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee56(entry) {
    var unlock;
    return _regenerator2.default.wrap(function _callee56$(_context56) {
      while (1) {
        switch (_context56.prev = _context56.next) {
          case 0:
            _context56.next = 2;
            return this.txLock.lock();

          case 2:
            unlock = _context56.sent;
            _context56.prev = 3;
            _context56.next = 6;
            return this._removeBlock(entry);

          case 6:
            return _context56.abrupt('return', _context56.sent);

          case 7:
            _context56.prev = 7;

            unlock();
            return _context56.finish(7);

          case 10:
          case 'end':
            return _context56.stop();
        }
      }
    }, _callee56, this, [[3,, 7, 10]]);
  }));

  function removeBlock(_x59) {
    return _ref56.apply(this, arguments);
  }

  return removeBlock;
}();

/**
 * Unconfirm a block's transactions.
 * @private
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

WalletDB.prototype._removeBlock = function () {
  var _ref57 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee57(entry) {
    var tip, prev, block, txs, i, tx;
    return _regenerator2.default.wrap(function _callee57$(_context57) {
      while (1) {
        switch (_context57.prev = _context57.next) {
          case 0:
            tip = BlockMeta.fromEntry(entry);

            if (!(tip.height > this.state.height)) {
              _context57.next = 4;
              break;
            }

            this.logger.warning('WalletDB is disconnecting high blocks (%d).', tip.height);
            return _context57.abrupt('return', 0);

          case 4:
            if (!(tip.height !== this.state.height)) {
              _context57.next = 6;
              break;
            }

            throw new Error('WDB: Bad disconnection (height mismatch).');

          case 6:
            _context57.next = 8;
            return this.getBlock(tip.height - 1);

          case 8:
            prev = _context57.sent;

            if (prev) {
              _context57.next = 11;
              break;
            }

            throw new Error('WDB: Bad disconnection (no previous block).');

          case 11:
            _context57.next = 13;
            return this.getBlockMap(tip.height);

          case 13:
            block = _context57.sent;

            if (block) {
              _context57.next = 18;
              break;
            }

            _context57.next = 17;
            return this.syncState(prev);

          case 17:
            return _context57.abrupt('return', 0);

          case 18:
            txs = block.toArray();
            i = txs.length - 1;

          case 20:
            if (!(i >= 0)) {
              _context57.next = 27;
              break;
            }

            tx = txs[i];
            _context57.next = 24;
            return this._unconfirm(tx);

          case 24:
            i--;
            _context57.next = 20;
            break;

          case 27:
            _context57.next = 29;
            return this.syncState(prev);

          case 29:

            this.logger.warning('Disconnected wallet block %s (tx=%d).', util.revHex(tip.hash), block.txs.size);

            return _context57.abrupt('return', block.txs.size);

          case 31:
          case 'end':
            return _context57.stop();
        }
      }
    }, _callee57, this);
  }));

  function _removeBlock(_x60) {
    return _ref57.apply(this, arguments);
  }

  return _removeBlock;
}();

/**
 * Rescan a block.
 * @private
 * @param {ChainEntry} entry
 * @param {TX[]} txs
 * @returns {Promise}
 */

WalletDB.prototype.rescanBlock = function () {
  var _ref58 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee58(entry, txs) {
    return _regenerator2.default.wrap(function _callee58$(_context58) {
      while (1) {
        switch (_context58.prev = _context58.next) {
          case 0:
            if (this.rescanning) {
              _context58.next = 3;
              break;
            }

            this.logger.warning('Unsolicited rescan block: %s.', entry.height);
            return _context58.abrupt('return');

          case 3:
            _context58.prev = 3;
            _context58.next = 6;
            return this._addBlock(entry, txs);

          case 6:
            _context58.next = 12;
            break;

          case 8:
            _context58.prev = 8;
            _context58.t0 = _context58['catch'](3);

            this.emit('error', _context58.t0);
            throw _context58.t0;

          case 12:
          case 'end':
            return _context58.stop();
        }
      }
    }, _callee58, this, [[3, 8]]);
  }));

  function rescanBlock(_x61, _x62) {
    return _ref58.apply(this, arguments);
  }

  return rescanBlock;
}();

/**
 * Add a transaction to the database, map addresses
 * to wallet IDs, potentially store orphans, resolve
 * orphans, or confirm a transaction.
 * @param {TX} tx
 * @returns {Promise}
 */

WalletDB.prototype.addTX = function () {
  var _ref59 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee59(tx) {
    var unlock;
    return _regenerator2.default.wrap(function _callee59$(_context59) {
      while (1) {
        switch (_context59.prev = _context59.next) {
          case 0:
            _context59.next = 2;
            return this.txLock.lock();

          case 2:
            unlock = _context59.sent;
            _context59.prev = 3;
            _context59.next = 6;
            return this._insert(tx);

          case 6:
            return _context59.abrupt('return', _context59.sent);

          case 7:
            _context59.prev = 7;

            unlock();
            return _context59.finish(7);

          case 10:
          case 'end':
            return _context59.stop();
        }
      }
    }, _callee59, this, [[3,, 7, 10]]);
  }));

  function addTX(_x63) {
    return _ref59.apply(this, arguments);
  }

  return addTX;
}();

/**
 * Add a transaction to the database without a lock.
 * @private
 * @param {TX} tx
 * @param {BlockMeta} block
 * @returns {Promise}
 */

WalletDB.prototype._insert = function () {
  var _ref60 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee60(tx, block) {
    var wids, result, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, wid, wallet;

    return _regenerator2.default.wrap(function _callee60$(_context60) {
      while (1) {
        switch (_context60.prev = _context60.next) {
          case 0:
            _context60.next = 2;
            return this.getWalletsByTX(tx);

          case 2:
            wids = _context60.sent;
            result = false;


            assert(!tx.mutable, 'WDB: Cannot add mutable TX.');

            if (wids) {
              _context60.next = 7;
              break;
            }

            return _context60.abrupt('return', null);

          case 7:

            this.logger.info('Incoming transaction for %d wallets in WalletDB (%s).', wids.size, tx.txid());

            // If this is our first transaction
            // in a block, set the start block here.

            if (!block) {
              _context60.next = 11;
              break;
            }

            _context60.next = 11;
            return this.maybeMark(block);

          case 11:

            // Insert the transaction
            // into every matching wallet.
            _iteratorNormalCompletion14 = true;
            _didIteratorError14 = false;
            _iteratorError14 = undefined;
            _context60.prev = 14;
            _iterator14 = (0, _getIterator3.default)(wids);

          case 16:
            if (_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done) {
              _context60.next = 30;
              break;
            }

            wid = _step14.value;
            _context60.next = 20;
            return this.get(wid);

          case 20:
            wallet = _context60.sent;


            assert(wallet);

            _context60.next = 24;
            return wallet.add(tx, block);

          case 24:
            if (!_context60.sent) {
              _context60.next = 27;
              break;
            }

            this.logger.info('Added transaction to wallet in WalletDB: %s (%d).', wallet.id, wid);
            result = true;

          case 27:
            _iteratorNormalCompletion14 = true;
            _context60.next = 16;
            break;

          case 30:
            _context60.next = 36;
            break;

          case 32:
            _context60.prev = 32;
            _context60.t0 = _context60['catch'](14);
            _didIteratorError14 = true;
            _iteratorError14 = _context60.t0;

          case 36:
            _context60.prev = 36;
            _context60.prev = 37;

            if (!_iteratorNormalCompletion14 && _iterator14.return) {
              _iterator14.return();
            }

          case 39:
            _context60.prev = 39;

            if (!_didIteratorError14) {
              _context60.next = 42;
              break;
            }

            throw _iteratorError14;

          case 42:
            return _context60.finish(39);

          case 43:
            return _context60.finish(36);

          case 44:
            if (result) {
              _context60.next = 46;
              break;
            }

            return _context60.abrupt('return', null);

          case 46:
            return _context60.abrupt('return', wids);

          case 47:
          case 'end':
            return _context60.stop();
        }
      }
    }, _callee60, this, [[14, 32, 36, 44], [37,, 39, 43]]);
  }));

  function _insert(_x64, _x65) {
    return _ref60.apply(this, arguments);
  }

  return _insert;
}();

/**
 * Unconfirm a transaction from all
 * relevant wallets without a lock.
 * @private
 * @param {TXMapRecord} tx
 * @returns {Promise}
 */

WalletDB.prototype._unconfirm = function () {
  var _ref61 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee61(tx) {
    var _iteratorNormalCompletion15, _didIteratorError15, _iteratorError15, _iterator15, _step15, wid, wallet;

    return _regenerator2.default.wrap(function _callee61$(_context61) {
      while (1) {
        switch (_context61.prev = _context61.next) {
          case 0:
            _iteratorNormalCompletion15 = true;
            _didIteratorError15 = false;
            _iteratorError15 = undefined;
            _context61.prev = 3;
            _iterator15 = (0, _getIterator3.default)(tx.wids);

          case 5:
            if (_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done) {
              _context61.next = 16;
              break;
            }

            wid = _step15.value;
            _context61.next = 9;
            return this.get(wid);

          case 9:
            wallet = _context61.sent;

            assert(wallet);
            _context61.next = 13;
            return wallet.unconfirm(tx.hash);

          case 13:
            _iteratorNormalCompletion15 = true;
            _context61.next = 5;
            break;

          case 16:
            _context61.next = 22;
            break;

          case 18:
            _context61.prev = 18;
            _context61.t0 = _context61['catch'](3);
            _didIteratorError15 = true;
            _iteratorError15 = _context61.t0;

          case 22:
            _context61.prev = 22;
            _context61.prev = 23;

            if (!_iteratorNormalCompletion15 && _iterator15.return) {
              _iterator15.return();
            }

          case 25:
            _context61.prev = 25;

            if (!_didIteratorError15) {
              _context61.next = 28;
              break;
            }

            throw _iteratorError15;

          case 28:
            return _context61.finish(25);

          case 29:
            return _context61.finish(22);

          case 30:
          case 'end':
            return _context61.stop();
        }
      }
    }, _callee61, this, [[3, 18, 22, 30], [23,, 25, 29]]);
  }));

  function _unconfirm(_x66) {
    return _ref61.apply(this, arguments);
  }

  return _unconfirm;
}();

/**
 * Handle a chain reset.
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

WalletDB.prototype.resetChain = function () {
  var _ref62 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee62(entry) {
    var unlock;
    return _regenerator2.default.wrap(function _callee62$(_context62) {
      while (1) {
        switch (_context62.prev = _context62.next) {
          case 0:
            _context62.next = 2;
            return this.txLock.lock();

          case 2:
            unlock = _context62.sent;
            _context62.prev = 3;
            _context62.next = 6;
            return this._resetChain(entry);

          case 6:
            return _context62.abrupt('return', _context62.sent);

          case 7:
            _context62.prev = 7;

            unlock();
            return _context62.finish(7);

          case 10:
          case 'end':
            return _context62.stop();
        }
      }
    }, _callee62, this, [[3,, 7, 10]]);
  }));

  function resetChain(_x67) {
    return _ref62.apply(this, arguments);
  }

  return resetChain;
}();

/**
 * Handle a chain reset without a lock.
 * @private
 * @param {ChainEntry} entry
 * @returns {Promise}
 */

WalletDB.prototype._resetChain = function () {
  var _ref63 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee63(entry) {
    return _regenerator2.default.wrap(function _callee63$(_context63) {
      while (1) {
        switch (_context63.prev = _context63.next) {
          case 0:
            if (!(entry.height > this.state.height)) {
              _context63.next = 2;
              break;
            }

            throw new Error('WDB: Bad reset height.');

          case 2:
            _context63.next = 4;
            return this.rollback(entry.height);

          case 4:
            if (!_context63.sent) {
              _context63.next = 6;
              break;
            }

            return _context63.abrupt('return');

          case 6:
            _context63.next = 8;
            return this.scan();

          case 8:
          case 'end':
            return _context63.stop();
        }
      }
    }, _callee63, this);
  }));

  function _resetChain(_x68) {
    return _ref63.apply(this, arguments);
  }

  return _resetChain;
}();

/**
 * WalletOptions
 * @alias module:wallet.WalletOptions
 * @constructor
 * @param {Object} options
 */

function WalletOptions(options) {
  if (!(this instanceof WalletOptions)) return new WalletOptions(options);

  this.network = Network.primary;
  this.logger = Logger.global;
  this.workers = null;
  this.client = null;
  this.feeRate = 0;

  this.prefix = null;
  this.location = null;
  this.db = 'memory';
  this.maxFiles = 64;
  this.cacheSize = 16 << 20;
  this.compression = true;
  this.bufferKeys = layout.binary;

  this.spv = false;
  this.witness = false;
  this.checkpoints = false;
  this.startHeight = 0;
  this.keepBlocks = this.network.block.keepBlocks;
  this.wipeNoReally = false;
  this.apiKey = null;
  this.walletAuth = false;
  this.noAuth = false;
  this.ssl = false;
  this.host = '127.0.0.1';
  this.port = this.network.rpcPort + 2;
  this.listen = false;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {WalletOptions}
 */

WalletOptions.prototype.fromOptions = function fromOptions(options) {
  if (options.network != null) {
    this.network = Network.get(options.network);
    this.keepBlocks = this.network.block.keepBlocks;
    this.port = this.network.rpcPort + 2;
  }

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.workers != null) {
    assert((0, _typeof3.default)(options.workers) === 'object');
    this.workers = options.workers;
  }

  if (options.client != null) {
    assert((0, _typeof3.default)(options.client) === 'object');
    this.client = options.client;
  }

  if (options.feeRate != null) {
    assert(util.isU64(options.feeRate));
    this.feeRate = options.feeRate;
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
    this.location = path.join(this.prefix, 'walletdb');
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

  if (options.spv != null) {
    assert(typeof options.spv === 'boolean');
    this.spv = options.spv;
  }

  if (options.witness != null) {
    assert(typeof options.witness === 'boolean');
    this.witness = options.witness;
  }

  if (options.checkpoints != null) {
    assert(typeof options.checkpoints === 'boolean');
    this.checkpoints = options.checkpoints;
  }

  if (options.startHeight != null) {
    assert(typeof options.startHeight === 'number');
    assert(options.startHeight >= 0);
    this.startHeight = options.startHeight;
  }

  if (options.wipeNoReally != null) {
    assert(typeof options.wipeNoReally === 'boolean');
    this.wipeNoReally = options.wipeNoReally;
  }

  if (options.apiKey != null) {
    assert(typeof options.apiKey === 'string');
    this.apiKey = options.apiKey;
  }

  if (options.walletAuth != null) {
    assert(typeof options.walletAuth === 'boolean');
    this.walletAuth = options.walletAuth;
  }

  if (options.noAuth != null) {
    assert(typeof options.noAuth === 'boolean');
    this.noAuth = options.noAuth;
  }

  if (options.ssl != null) {
    assert(typeof options.ssl === 'boolean');
    this.ssl = options.ssl;
  }

  if (options.host != null) {
    assert(typeof options.host === 'string');
    this.host = options.host;
  }

  if (options.port != null) {
    assert(typeof options.port === 'number');
    this.port = options.port;
  }

  if (options.listen != null) {
    assert(typeof options.listen === 'boolean');
    this.listen = options.listen;
  }

  return this;
};

/**
 * Instantiate chain options from object.
 * @param {Object} options
 * @returns {WalletOptions}
 */

WalletOptions.fromOptions = function fromOptions(options) {
  return new WalletOptions().fromOptions(options);
};

/*
 * Expose
 */

module.exports = WalletDB;