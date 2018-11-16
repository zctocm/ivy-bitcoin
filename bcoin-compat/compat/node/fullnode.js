/*!
 * fullnode.js - full node for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Chain = require('../blockchain/chain');
var Fees = require('../mempool/fees');
var Mempool = require('../mempool/mempool');
var Pool = require('../net/pool');
var Miner = require('../mining/miner');
var HTTPServer = require('../http/server');
var RPC = require('../http/rpc');
var Node = require('./node');

/**
 * Respresents a fullnode complete with a
 * chain, mempool, miner, etc.
 * @alias module:node.FullNode
 * @extends Node
 * @constructor
 * @param {Object?} options
 * @property {Chain} chain
 * @property {PolicyEstimator} fees
 * @property {Mempool} mempool
 * @property {Pool} pool
 * @property {Miner} miner
 * @property {HTTPServer} http
 * @emits FullNode#block
 * @emits FullNode#tx
 * @emits FullNode#connect
 * @emits FullNode#disconnect
 * @emits FullNode#reset
 * @emits FullNode#error
 */

function FullNode(options) {
  if (!(this instanceof FullNode)) return new FullNode(options);

  Node.call(this, options);

  // SPV flag.
  this.spv = false;

  // Instantiate blockchain.
  this.chain = new Chain({
    network: this.network,
    logger: this.logger,
    workers: this.workers,
    db: this.config.str('db'),
    prefix: this.config.prefix,
    maxFiles: this.config.uint('max-files'),
    cacheSize: this.config.mb('cache-size'),
    forceFlags: this.config.bool('force-flags'),
    bip91: this.config.bool('bip91'),
    bip148: this.config.bool('bip148'),
    prune: this.config.bool('prune'),
    checkpoints: this.config.bool('checkpoints'),
    coinCache: this.config.mb('coin-cache'),
    entryCache: this.config.uint('entry-cache'),
    indexTX: this.config.bool('index-tx'),
    indexAddress: this.config.bool('index-address')
  });

  // Fee estimation.
  this.fees = new Fees(this.logger);
  this.fees.init();

  // Mempool needs access to the chain.
  this.mempool = new Mempool({
    network: this.network,
    logger: this.logger,
    workers: this.workers,
    chain: this.chain,
    fees: this.fees,
    db: this.config.str('db'),
    prefix: this.config.prefix,
    persistent: this.config.bool('persistent-mempool'),
    maxSize: this.config.mb('mempool-size'),
    limitFree: this.config.bool('limit-free'),
    limitFreeRelay: this.config.uint('limit-free-relay'),
    requireStandard: this.config.bool('require-standard'),
    rejectAbsurdFees: this.config.bool('reject-absurd-fees'),
    replaceByFee: this.config.bool('replace-by-fee'),
    indexAddress: this.config.bool('index-address')
  });

  // Pool needs access to the chain and mempool.
  this.pool = new Pool({
    network: this.network,
    logger: this.logger,
    chain: this.chain,
    mempool: this.mempool,
    prefix: this.config.prefix,
    selfish: this.config.bool('selfish'),
    compact: this.config.bool('compact'),
    bip37: this.config.bool('bip37'),
    bip151: this.config.bool('bip151'),
    bip150: this.config.bool('bip150'),
    identityKey: this.config.buf('identity-key'),
    maxOutbound: this.config.uint('max-outbound'),
    maxInbound: this.config.uint('max-inbound'),
    proxy: this.config.str('proxy'),
    onion: this.config.bool('onion'),
    upnp: this.config.bool('upnp'),
    seeds: this.config.array('seeds'),
    nodes: this.config.array('nodes'),
    only: this.config.array('only'),
    publicHost: this.config.str('public-host'),
    publicPort: this.config.uint('public-port'),
    host: this.config.str('host'),
    port: this.config.uint('port'),
    listen: this.config.bool('listen'),
    persistent: this.config.bool('persistent')
  });

  // Miner needs access to the chain and mempool.
  this.miner = new Miner({
    network: this.network,
    logger: this.logger,
    workers: this.workers,
    chain: this.chain,
    mempool: this.mempool,
    address: this.config.array('coinbase-address'),
    coinbaseFlags: this.config.str('coinbase-flags'),
    preverify: this.config.bool('preverify'),
    maxWeight: this.config.uint('max-weight'),
    reservedWeight: this.config.uint('reserved-weight'),
    reservedSigops: this.config.uint('reserved-sigops')
  });

  // RPC needs access to the node.
  this.rpc = new RPC(this);

  // HTTP needs access to the node.
  if (!HTTPServer.unsupported) {
    this.http = new HTTPServer({
      network: this.network,
      logger: this.logger,
      node: this,
      prefix: this.config.prefix,
      ssl: this.config.bool('ssl'),
      keyFile: this.config.path('ssl-key'),
      certFile: this.config.path('ssl-cert'),
      host: this.config.str('http-host'),
      port: this.config.uint('http-port'),
      apiKey: this.config.str('api-key'),
      noAuth: this.config.bool('no-auth')
    });
  }

  this._init();
}

(0, _setPrototypeOf2.default)(FullNode.prototype, Node.prototype);

/**
 * Initialize the node.
 * @private
 */

FullNode.prototype._init = function _init() {
  var _this = this;

  // Bind to errors
  this.chain.on('error', function (err) {
    return _this.error(err);
  });
  this.mempool.on('error', function (err) {
    return _this.error(err);
  });
  this.pool.on('error', function (err) {
    return _this.error(err);
  });
  this.miner.on('error', function (err) {
    return _this.error(err);
  });

  if (this.http) this.http.on('error', function (err) {
    return _this.error(err);
  });

  this.mempool.on('tx', function (tx) {
    _this.miner.cpu.notifyEntry();
    _this.emit('tx', tx);
  });

  this.chain.hook('connect', function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(entry, block) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              _context.next = 3;
              return _this.mempool._addBlock(entry, block.txs);

            case 3:
              _context.next = 8;
              break;

            case 5:
              _context.prev = 5;
              _context.t0 = _context['catch'](0);

              _this.error(_context.t0);

            case 8:
              _this.emit('block', block);
              _this.emit('connect', entry, block);

            case 10:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this, [[0, 5]]);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());

  this.chain.hook('disconnect', function () {
    var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(entry, block) {
      return _regenerator2.default.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _context2.prev = 0;
              _context2.next = 3;
              return _this.mempool._removeBlock(entry, block.txs);

            case 3:
              _context2.next = 8;
              break;

            case 5:
              _context2.prev = 5;
              _context2.t0 = _context2['catch'](0);

              _this.error(_context2.t0);

            case 8:
              _this.emit('disconnect', entry, block);

            case 9:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this, [[0, 5]]);
    }));

    return function (_x3, _x4) {
      return _ref2.apply(this, arguments);
    };
  }());

  this.chain.hook('reorganize', function () {
    var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(tip, competitor) {
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.prev = 0;
              _context3.next = 3;
              return _this.mempool._handleReorg();

            case 3:
              _context3.next = 8;
              break;

            case 5:
              _context3.prev = 5;
              _context3.t0 = _context3['catch'](0);

              _this.error(_context3.t0);

            case 8:
              _this.emit('reorganize', tip, competitor);

            case 9:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this, [[0, 5]]);
    }));

    return function (_x5, _x6) {
      return _ref3.apply(this, arguments);
    };
  }());

  this.chain.hook('reset', function () {
    var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(tip) {
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.prev = 0;
              _context4.next = 3;
              return _this.mempool._reset();

            case 3:
              _context4.next = 8;
              break;

            case 5:
              _context4.prev = 5;
              _context4.t0 = _context4['catch'](0);

              _this.error(_context4.t0);

            case 8:
              _this.emit('reset', tip);

            case 9:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this, [[0, 5]]);
    }));

    return function (_x7) {
      return _ref4.apply(this, arguments);
    };
  }());

  this.loadPlugins();
};

/**
 * Open the node and all its child objects,
 * wait for the database to load.
 * @alias FullNode#open
 * @returns {Promise}
 */

FullNode.prototype._open = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return this.chain.open();

          case 2:
            _context5.next = 4;
            return this.mempool.open();

          case 4:
            _context5.next = 6;
            return this.miner.open();

          case 6:
            _context5.next = 8;
            return this.pool.open();

          case 8:
            _context5.next = 10;
            return this.openPlugins();

          case 10:
            if (!this.http) {
              _context5.next = 13;
              break;
            }

            _context5.next = 13;
            return this.http.open();

          case 13:

            this.logger.info('Node is loaded.');

          case 14:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function _open() {
    return _ref5.apply(this, arguments);
  }

  return _open;
}();

/**
 * Close the node, wait for the database to close.
 * @alias FullNode#close
 * @returns {Promise}
 */

FullNode.prototype._close = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            if (!this.http) {
              _context6.next = 3;
              break;
            }

            _context6.next = 3;
            return this.http.close();

          case 3:
            _context6.next = 5;
            return this.closePlugins();

          case 5:
            _context6.next = 7;
            return this.pool.close();

          case 7:
            _context6.next = 9;
            return this.miner.close();

          case 9:
            _context6.next = 11;
            return this.mempool.close();

          case 11:
            _context6.next = 13;
            return this.chain.close();

          case 13:

            this.logger.info('Node is closed.');

          case 14:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function _close() {
    return _ref6.apply(this, arguments);
  }

  return _close;
}();

/**
 * Rescan for any missed transactions.
 * @param {Number|Hash} start - Start block.
 * @param {Bloom} filter
 * @param {Function} iter - Iterator.
 * @returns {Promise}
 */

FullNode.prototype.scan = function scan(start, filter, iter) {
  return this.chain.scan(start, filter, iter);
};

/**
 * Broadcast a transaction (note that this will _not_ be verified
 * by the mempool - use with care, lest you get banned from
 * bitcoind nodes).
 * @param {TX|Block} item
 * @returns {Promise}
 */

FullNode.prototype.broadcast = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(item) {
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            _context7.prev = 0;
            _context7.next = 3;
            return this.pool.broadcast(item);

          case 3:
            _context7.next = 8;
            break;

          case 5:
            _context7.prev = 5;
            _context7.t0 = _context7['catch'](0);

            this.emit('error', _context7.t0);

          case 8:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this, [[0, 5]]);
  }));

  function broadcast(_x8) {
    return _ref7.apply(this, arguments);
  }

  return broadcast;
}();

/**
 * Add transaction to mempool, broadcast.
 * @param {TX} tx
 */

FullNode.prototype.sendTX = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(tx) {
    var missing;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            missing = void 0;
            _context8.prev = 1;
            _context8.next = 4;
            return this.mempool.addTX(tx);

          case 4:
            missing = _context8.sent;
            _context8.next = 16;
            break;

          case 7:
            _context8.prev = 7;
            _context8.t0 = _context8['catch'](1);

            if (!(_context8.t0.type === 'VerifyError' && _context8.t0.score === 0)) {
              _context8.next = 15;
              break;
            }

            this.error(_context8.t0);
            this.logger.warning('Verification failed for tx: %s.', tx.txid());
            this.logger.warning('Attempting to broadcast anyway...');
            this.broadcast(tx);
            return _context8.abrupt('return');

          case 15:
            throw _context8.t0;

          case 16:
            if (!missing) {
              _context8.next = 21;
              break;
            }

            this.logger.warning('TX was orphaned in mempool: %s.', tx.txid());
            this.logger.warning('Attempting to broadcast anyway...');
            this.broadcast(tx);
            return _context8.abrupt('return');

          case 21:

            // We need to announce by hand if
            // we're running in selfish mode.
            if (this.pool.options.selfish) this.pool.broadcast(tx);

          case 22:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this, [[1, 7]]);
  }));

  function sendTX(_x9) {
    return _ref8.apply(this, arguments);
  }

  return sendTX;
}();

/**
 * Add transaction to mempool, broadcast. Silence errors.
 * @param {TX} tx
 * @returns {Promise}
 */

FullNode.prototype.relay = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(tx) {
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _context9.prev = 0;
            _context9.next = 3;
            return this.sendTX(tx);

          case 3:
            _context9.next = 8;
            break;

          case 5:
            _context9.prev = 5;
            _context9.t0 = _context9['catch'](0);

            this.error(_context9.t0);

          case 8:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[0, 5]]);
  }));

  function relay(_x10) {
    return _ref9.apply(this, arguments);
  }

  return relay;
}();

/**
 * Connect to the network.
 * @returns {Promise}
 */

FullNode.prototype.connect = function connect() {
  return this.pool.connect();
};

/**
 * Disconnect from the network.
 * @returns {Promise}
 */

FullNode.prototype.disconnect = function disconnect() {
  return this.pool.disconnect();
};

/**
 * Start the blockchain sync.
 */

FullNode.prototype.startSync = function startSync() {
  return this.pool.startSync();
};

/**
 * Stop syncing the blockchain.
 */

FullNode.prototype.stopSync = function stopSync() {
  return this.pool.stopSync();
};

/**
 * Retrieve a block from the chain database.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Block}.
 */

FullNode.prototype.getBlock = function getBlock(hash) {
  return this.chain.getBlock(hash);
};

/**
 * Retrieve a coin from the mempool or chain database.
 * Takes into account spent coins in the mempool.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns {@link Coin}.
 */

FullNode.prototype.getCoin = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(hash, index) {
    var coin;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            coin = this.mempool.getCoin(hash, index);

            if (!coin) {
              _context10.next = 3;
              break;
            }

            return _context10.abrupt('return', coin);

          case 3:
            if (!this.mempool.isSpent(hash, index)) {
              _context10.next = 5;
              break;
            }

            return _context10.abrupt('return', null);

          case 5:
            _context10.next = 7;
            return this.chain.getCoin(hash, index);

          case 7:
            return _context10.abrupt('return', _context10.sent);

          case 8:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function getCoin(_x11, _x12) {
    return _ref10.apply(this, arguments);
  }

  return getCoin;
}();

/**
 * Get coins that pertain to an address from the mempool or chain database.
 * Takes into account spent coins in the mempool.
 * @param {Address} addrs
 * @returns {Promise} - Returns {@link Coin}[].
 */

FullNode.prototype.getCoinsByAddress = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(addrs) {
    var mempool, chain, out, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, coin, spent, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _coin;

    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            mempool = this.mempool.getCoinsByAddress(addrs);
            _context11.next = 3;
            return this.chain.getCoinsByAddress(addrs);

          case 3:
            chain = _context11.sent;
            out = [];
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context11.prev = 8;
            _iterator = (0, _getIterator3.default)(chain);

          case 10:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context11.next = 19;
              break;
            }

            coin = _step.value;
            spent = this.mempool.isSpent(coin.hash, coin.index);

            if (!spent) {
              _context11.next = 15;
              break;
            }

            return _context11.abrupt('continue', 16);

          case 15:

            out.push(coin);

          case 16:
            _iteratorNormalCompletion = true;
            _context11.next = 10;
            break;

          case 19:
            _context11.next = 25;
            break;

          case 21:
            _context11.prev = 21;
            _context11.t0 = _context11['catch'](8);
            _didIteratorError = true;
            _iteratorError = _context11.t0;

          case 25:
            _context11.prev = 25;
            _context11.prev = 26;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 28:
            _context11.prev = 28;

            if (!_didIteratorError) {
              _context11.next = 31;
              break;
            }

            throw _iteratorError;

          case 31:
            return _context11.finish(28);

          case 32:
            return _context11.finish(25);

          case 33:
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context11.prev = 36;


            for (_iterator2 = (0, _getIterator3.default)(mempool); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              _coin = _step2.value;

              out.push(_coin);
            }_context11.next = 44;
            break;

          case 40:
            _context11.prev = 40;
            _context11.t1 = _context11['catch'](36);
            _didIteratorError2 = true;
            _iteratorError2 = _context11.t1;

          case 44:
            _context11.prev = 44;
            _context11.prev = 45;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 47:
            _context11.prev = 47;

            if (!_didIteratorError2) {
              _context11.next = 50;
              break;
            }

            throw _iteratorError2;

          case 50:
            return _context11.finish(47);

          case 51:
            return _context11.finish(44);

          case 52:
            return _context11.abrupt('return', out);

          case 53:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this, [[8, 21, 25, 33], [26,, 28, 32], [36, 40, 44, 52], [45,, 47, 51]]);
  }));

  function getCoinsByAddress(_x13) {
    return _ref11.apply(this, arguments);
  }

  return getCoinsByAddress;
}();

/**
 * Retrieve transactions pertaining to an
 * address from the mempool or chain database.
 * @param {Address} addrs
 * @returns {Promise} - Returns {@link TXMeta}[].
 */

FullNode.prototype.getMetaByAddress = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(addrs) {
    var mempool, chain;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            mempool = this.mempool.getMetaByAddress(addrs);
            _context12.next = 3;
            return this.chain.getMetaByAddress(addrs);

          case 3:
            chain = _context12.sent;
            return _context12.abrupt('return', chain.concat(mempool));

          case 5:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function getMetaByAddress(_x14) {
    return _ref12.apply(this, arguments);
  }

  return getMetaByAddress;
}();

/**
 * Retrieve a transaction from the mempool or chain database.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TXMeta}.
 */

FullNode.prototype.getMeta = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(hash) {
    var meta;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            meta = this.mempool.getMeta(hash);

            if (!meta) {
              _context13.next = 3;
              break;
            }

            return _context13.abrupt('return', meta);

          case 3:
            _context13.next = 5;
            return this.chain.getMeta(hash);

          case 5:
            return _context13.abrupt('return', _context13.sent);

          case 6:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this);
  }));

  function getMeta(_x15) {
    return _ref13.apply(this, arguments);
  }

  return getMeta;
}();

/**
 * Retrieve a spent coin viewpoint from mempool or chain database.
 * @param {TXMeta} meta
 * @returns {Promise} - Returns {@link CoinView}.
 */

FullNode.prototype.getMetaView = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(meta) {
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            if (!(meta.height === -1)) {
              _context14.next = 2;
              break;
            }

            return _context14.abrupt('return', this.mempool.getSpentView(meta.tx));

          case 2:
            return _context14.abrupt('return', this.chain.getSpentView(meta.tx));

          case 3:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function getMetaView(_x16) {
    return _ref14.apply(this, arguments);
  }

  return getMetaView;
}();

/**
 * Retrieve transactions pertaining to an
 * address from the mempool or chain database.
 * @param {Address} addrs
 * @returns {Promise} - Returns {@link TX}[].
 */

FullNode.prototype.getTXByAddress = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(addrs) {
    var mtxs, out, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, mtx;

    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            _context15.next = 2;
            return this.getMetaByAddress(addrs);

          case 2:
            mtxs = _context15.sent;
            out = [];
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context15.prev = 7;


            for (_iterator3 = (0, _getIterator3.default)(mtxs); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              mtx = _step3.value;

              out.push(mtx.tx);
            }_context15.next = 15;
            break;

          case 11:
            _context15.prev = 11;
            _context15.t0 = _context15['catch'](7);
            _didIteratorError3 = true;
            _iteratorError3 = _context15.t0;

          case 15:
            _context15.prev = 15;
            _context15.prev = 16;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 18:
            _context15.prev = 18;

            if (!_didIteratorError3) {
              _context15.next = 21;
              break;
            }

            throw _iteratorError3;

          case 21:
            return _context15.finish(18);

          case 22:
            return _context15.finish(15);

          case 23:
            return _context15.abrupt('return', out);

          case 24:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function getTXByAddress(_x17) {
    return _ref15.apply(this, arguments);
  }

  return getTXByAddress;
}();

/**
 * Retrieve a transaction from the mempool or chain database.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TX}.
 */

FullNode.prototype.getTX = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(hash) {
    var mtx;
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            _context16.next = 2;
            return this.getMeta(hash);

          case 2:
            mtx = _context16.sent;

            if (mtx) {
              _context16.next = 5;
              break;
            }

            return _context16.abrupt('return', null);

          case 5:
            return _context16.abrupt('return', mtx.tx);

          case 6:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function getTX(_x18) {
    return _ref16.apply(this, arguments);
  }

  return getTX;
}();

/**
 * Test whether the mempool or chain contains a transaction.
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

FullNode.prototype.hasTX = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(hash) {
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            if (!this.mempool.hasEntry(hash)) {
              _context17.next = 2;
              break;
            }

            return _context17.abrupt('return', true);

          case 2:
            _context17.next = 4;
            return this.chain.hasTX(hash);

          case 4:
            return _context17.abrupt('return', _context17.sent);

          case 5:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this);
  }));

  function hasTX(_x19) {
    return _ref17.apply(this, arguments);
  }

  return hasTX;
}();

/*
 * Expose
 */

module.exports = FullNode;