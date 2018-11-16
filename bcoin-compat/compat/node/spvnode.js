/*!
 * spvnode.js - spv node for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Lock = require('../utils/lock');
var Chain = require('../blockchain/chain');
var Pool = require('../net/pool');
var HTTPServer = require('../http/server');
var RPC = require('../http/rpc');
var Node = require('./node');

/**
 * Create an spv node which only maintains
 * a chain, a pool, and an http server.
 * @alias module:node.SPVNode
 * @extends Node
 * @constructor
 * @param {Object?} options
 * @param {Buffer?} options.sslKey
 * @param {Buffer?} options.sslCert
 * @param {Number?} options.httpPort
 * @param {String?} options.httpHost
 * @property {Boolean} loaded
 * @property {Chain} chain
 * @property {Pool} pool
 * @property {HTTPServer} http
 * @emits SPVNode#block
 * @emits SPVNode#tx
 * @emits SPVNode#error
 */

function SPVNode(options) {
  if (!(this instanceof SPVNode)) return new SPVNode(options);

  Node.call(this, options);

  // SPV flag.
  this.spv = true;

  this.chain = new Chain({
    network: this.network,
    logger: this.logger,
    db: this.config.str('db'),
    prefix: this.config.prefix,
    maxFiles: this.config.uint('max-files'),
    cacheSize: this.config.mb('cache-size'),
    entryCache: this.config.uint('entry-cache'),
    forceFlags: this.config.bool('force-flags'),
    checkpoints: this.config.bool('checkpoints'),
    bip91: this.config.bool('bip91'),
    bip148: this.config.bool('bip148'),
    spv: true
  });

  this.pool = new Pool({
    network: this.network,
    logger: this.logger,
    chain: this.chain,
    prefix: this.config.prefix,
    proxy: this.config.str('proxy'),
    onion: this.config.bool('onion'),
    upnp: this.config.bool('upnp'),
    seeds: this.config.array('seeds'),
    nodes: this.config.array('nodes'),
    only: this.config.array('only'),
    bip151: this.config.bool('bip151'),
    bip150: this.config.bool('bip150'),
    identityKey: this.config.buf('identity-key'),
    maxOutbound: this.config.uint('max-outbound'),
    persistent: this.config.bool('persistent'),
    selfish: true,
    listen: false
  });

  this.rpc = new RPC(this);

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

  this.rescanJob = null;
  this.scanLock = new Lock();
  this.watchLock = new Lock();

  this._init();
}

(0, _setPrototypeOf2.default)(SPVNode.prototype, Node.prototype);

/**
 * Initialize the node.
 * @private
 */

SPVNode.prototype._init = function _init() {
  var _this = this;

  // Bind to errors
  this.chain.on('error', function (err) {
    return _this.error(err);
  });
  this.pool.on('error', function (err) {
    return _this.error(err);
  });

  if (this.http) this.http.on('error', function (err) {
    return _this.error(err);
  });

  this.pool.on('tx', function (tx) {
    if (_this.rescanJob) return;

    _this.emit('tx', tx);
  });

  this.chain.on('block', function (block) {
    _this.emit('block', block);
  });

  this.chain.on('connect', function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(entry, block) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              if (!_this.rescanJob) {
                _context.next = 10;
                break;
              }

              _context.prev = 1;
              _context.next = 4;
              return _this.watchBlock(entry, block);

            case 4:
              _context.next = 9;
              break;

            case 6:
              _context.prev = 6;
              _context.t0 = _context['catch'](1);

              _this.error(_context.t0);

            case 9:
              return _context.abrupt('return');

            case 10:

              _this.emit('connect', entry, block);

            case 11:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this, [[1, 6]]);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());

  this.chain.on('disconnect', function (entry, block) {
    _this.emit('disconnect', entry, block);
  });

  this.chain.on('reorganize', function (tip, competitor) {
    _this.emit('reorganize', tip, competitor);
  });

  this.chain.on('reset', function (tip) {
    _this.emit('reset', tip);
  });

  this.loadPlugins();
};

/**
 * Open the node and all its child objects,
 * wait for the database to load.
 * @alias SPVNode#open
 * @returns {Promise}
 */

SPVNode.prototype._open = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(callback) {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.chain.open();

          case 2:
            _context2.next = 4;
            return this.pool.open();

          case 4:
            _context2.next = 6;
            return this.openPlugins();

          case 6:
            if (!this.http) {
              _context2.next = 9;
              break;
            }

            _context2.next = 9;
            return this.http.open();

          case 9:

            this.logger.info('Node is loaded.');

          case 10:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function _open(_x3) {
    return _ref2.apply(this, arguments);
  }

  return _open;
}();

/**
 * Close the node, wait for the database to close.
 * @alias SPVNode#close
 * @returns {Promise}
 */

SPVNode.prototype._close = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (!this.http) {
              _context3.next = 3;
              break;
            }

            _context3.next = 3;
            return this.http.close();

          case 3:
            _context3.next = 5;
            return this.closePlugins();

          case 5:
            _context3.next = 7;
            return this.pool.close();

          case 7:
            _context3.next = 9;
            return this.chain.close();

          case 9:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function _close() {
    return _ref3.apply(this, arguments);
  }

  return _close;
}();

/**
 * Scan for any missed transactions.
 * Note that this will replay the blockchain sync.
 * @param {Number|Hash} start - Start block.
 * @param {Bloom} filter
 * @param {Function} iter - Iterator.
 * @returns {Promise}
 */

SPVNode.prototype.scan = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(start, filter, iter) {
    var unlock, height;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.next = 2;
            return this.scanLock.lock();

          case 2:
            unlock = _context4.sent;
            height = this.chain.height;
            _context4.prev = 4;
            _context4.next = 7;
            return this.chain.replay(start);

          case 7:

            if (this.chain.height < height) {
              // We need to somehow defer this.
              // await this.connect();
              // this.startSync();
              // await this.watchUntil(height, iter);
            }

          case 8:
            _context4.prev = 8;

            unlock();
            return _context4.finish(8);

          case 11:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[4,, 8, 11]]);
  }));

  function scan(_x4, _x5, _x6) {
    return _ref4.apply(this, arguments);
  }

  return scan;
}();

/**
 * Watch the blockchain until a certain height.
 * @param {Number} height
 * @param {Function} iter
 * @returns {Promise}
 */

SPVNode.prototype.watchUntil = function watchUntil(height, iter) {
  var _this2 = this;

  return new _promise2.default(function (resolve, reject) {
    _this2.rescanJob = new RescanJob(resolve, reject, height, iter);
  });
};

/**
 * Handled watched block.
 * @param {ChainEntry} entry
 * @param {MerkleBlock} block
 * @returns {Promise}
 */

SPVNode.prototype.watchBlock = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(entry, block) {
    var unlock;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return this.watchLock.lock();

          case 2:
            unlock = _context5.sent;
            _context5.prev = 3;

            if (!(entry.height < this.rescanJob.height)) {
              _context5.next = 8;
              break;
            }

            _context5.next = 7;
            return this.rescanJob.iter(entry, block.txs);

          case 7:
            return _context5.abrupt('return');

          case 8:
            this.rescanJob.resolve();
            this.rescanJob = null;
            _context5.next = 16;
            break;

          case 12:
            _context5.prev = 12;
            _context5.t0 = _context5['catch'](3);

            this.rescanJob.reject(_context5.t0);
            this.rescanJob = null;

          case 16:
            _context5.prev = 16;

            unlock();
            return _context5.finish(16);

          case 19:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[3, 12, 16, 19]]);
  }));

  function watchBlock(_x7, _x8) {
    return _ref5.apply(this, arguments);
  }

  return watchBlock;
}();

/**
 * Broadcast a transaction (note that this will _not_ be verified
 * by the mempool - use with care, lest you get banned from
 * bitcoind nodes).
 * @param {TX|Block} item
 * @returns {Promise}
 */

SPVNode.prototype.broadcast = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(item) {
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _context6.prev = 0;
            _context6.next = 3;
            return this.pool.broadcast(item);

          case 3:
            _context6.next = 8;
            break;

          case 5:
            _context6.prev = 5;
            _context6.t0 = _context6['catch'](0);

            this.emit('error', _context6.t0);

          case 8:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[0, 5]]);
  }));

  function broadcast(_x9) {
    return _ref6.apply(this, arguments);
  }

  return broadcast;
}();

/**
 * Broadcast a transaction (note that this will _not_ be verified
 * by the mempool - use with care, lest you get banned from
 * bitcoind nodes).
 * @param {TX} tx
 * @returns {Promise}
 */

SPVNode.prototype.sendTX = function sendTX(tx) {
  return this.broadcast(tx);
};

/**
 * Broadcast a transaction. Silence errors.
 * @param {TX} tx
 * @returns {Promise}
 */

SPVNode.prototype.relay = function relay(tx) {
  return this.broadcast(tx);
};

/**
 * Connect to the network.
 * @returns {Promise}
 */

SPVNode.prototype.connect = function connect() {
  return this.pool.connect();
};

/**
 * Disconnect from the network.
 * @returns {Promise}
 */

SPVNode.prototype.disconnect = function disconnect() {
  return this.pool.disconnect();
};

/**
 * Start the blockchain sync.
 */

SPVNode.prototype.startSync = function startSync() {
  return this.pool.startSync();
};

/**
 * Stop syncing the blockchain.
 */

SPVNode.prototype.stopSync = function stopSync() {
  return this.pool.stopSync();
};

/*
 * Helpers
 */

function RescanJob(resolve, reject, height, iter) {
  this.resolve = resolve;
  this.reject = reject;
  this.height = height;
  this.iter = iter;
}

/*
 * Expose
 */

module.exports = SPVNode;