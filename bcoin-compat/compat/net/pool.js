/*!
 * pool.js - peer management for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _maxSafeInteger = require('babel-runtime/core-js/number/max-safe-integer');

var _maxSafeInteger2 = _interopRequireDefault(_maxSafeInteger);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var AsyncObject = require('../utils/asyncobject');
var util = require('../utils/util');
var IP = require('../utils/ip');
var co = require('../utils/co');
var common = require('./common');
var chainCommon = require('../blockchain/common');
var Address = require('../primitives/address');
var BIP150 = require('./bip150');
var BIP151 = require('./bip151');
var BIP152 = require('./bip152');
var Bloom = require('../utils/bloom');
var RollingFilter = require('../utils/rollingfilter');
var secp256k1 = require('../crypto/secp256k1');
var Lock = require('../utils/lock');
var Network = require('../protocol/network');
var Peer = require('./peer');
var external = require('./external');
var List = require('../utils/list');
var tcp = require('./tcp');
var dns = require('./dns');
var HostList = require('./hostlist');
var UPNP = require('./upnp');
var InvItem = require('../primitives/invitem');
var packets = require('./packets');
var services = common.services;
var invTypes = InvItem.types;
var packetTypes = packets.types;
var scores = HostList.scores;

/**
 * A pool of peers for handling all network activity.
 * @alias module:net.Pool
 * @constructor
 * @param {Object} options
 * @param {Chain} options.chain
 * @param {Mempool?} options.mempool
 * @param {Number?} [options.maxOutbound=8] - Maximum number of peers.
 * @param {Boolean?} options.spv - Do an SPV sync.
 * @param {Boolean?} options.noRelay - Whether to ask
 * for relayed transactions.
 * @param {Number?} [options.feeRate] - Fee filter rate.
 * @param {Number?} [options.invTimeout=60000] - Timeout for broadcasted
 * objects.
 * @param {Boolean?} options.listen - Whether to spin up a server socket
 * and listen for peers.
 * @param {Boolean?} options.selfish - A selfish pool. Will not serve blocks,
 * headers, hashes, utxos, or transactions to peers.
 * @param {Boolean?} options.broadcast - Whether to automatically broadcast
 * transactions accepted to our mempool.
 * @param {String[]} options.seeds
 * @param {Function?} options.createSocket - Custom function to create a socket.
 * Must accept (port, host) and return a node-like socket.
 * @param {Function?} options.createServer - Custom function to create a server.
 * Must return a node-like server.
 * @emits Pool#block
 * @emits Pool#tx
 * @emits Pool#peer
 * @emits Pool#open
 * @emits Pool#close
 * @emits Pool#error
 * @emits Pool#reject
 */

function Pool(options) {
  if (!(this instanceof Pool)) return new Pool(options);

  AsyncObject.call(this);

  this.options = new PoolOptions(options);

  this.network = this.options.network;
  this.logger = this.options.logger.context('net');
  this.chain = this.options.chain;
  this.mempool = this.options.mempool;
  this.server = this.options.createServer();
  this.nonces = this.options.nonces;

  this.locker = new Lock(true);
  this.connected = false;
  this.disconnecting = false;
  this.syncing = false;
  this.spvFilter = null;
  this.txFilter = null;
  this.blockMap = new _set2.default();
  this.txMap = new _set2.default();
  this.compactBlocks = new _set2.default();
  this.invMap = new _map2.default();
  this.pendingFilter = null;
  this.pendingRefill = null;

  this.checkpoints = false;
  this.headerChain = new List();
  this.headerNext = null;
  this.headerTip = null;

  this.peers = new PeerList();
  this.authdb = new BIP150.AuthDB(this.options);
  this.hosts = new HostList(this.options);
  this.id = 0;

  if (this.options.spv) this.spvFilter = Bloom.fromRate(20000, 0.001, Bloom.flags.ALL);

  if (!this.options.mempool) this.txFilter = new RollingFilter(50000, 0.000001);

  this._init();
};

(0, _setPrototypeOf2.default)(Pool.prototype, AsyncObject.prototype);

/**
 * Discovery interval for UPNP and DNS seeds.
 * @const {Number}
 * @default
 */

Pool.DISCOVERY_INTERVAL = 120000;

/**
 * Initialize the pool.
 * @private
 */

Pool.prototype._init = function _init() {
  var _this = this;

  this.server.on('error', function (err) {
    _this.emit('error', err);
  });

  this.server.on('connection', function (socket) {
    _this.handleSocket(socket);
    _this.emit('connection', socket);
  });

  this.server.on('listening', function () {
    var data = _this.server.address();
    _this.logger.info('Pool server listening on %s (port=%d).', data.address, data.port);
    _this.emit('listening', data);
  });

  this.chain.on('block', function (block, entry) {
    _this.emit('block', block, entry);
  });

  this.chain.on('reset', function () {
    if (_this.checkpoints) _this.resetChain();
    _this.forceSync();
  });

  this.chain.on('full', function () {
    _this.sync();
    _this.emit('full');
    _this.logger.info('Chain is fully synced (height=%d).', _this.chain.height);
  });

  this.chain.on('bad orphan', function (err, id) {
    _this.handleBadOrphan('block', err, id);
  });

  if (this.mempool) {
    this.mempool.on('tx', function (tx) {
      _this.emit('tx', tx);
    });

    this.mempool.on('bad orphan', function (err, id) {
      _this.handleBadOrphan('tx', err, id);
    });
  }

  if (!this.options.selfish && !this.options.spv) {
    if (this.mempool) {
      this.mempool.on('tx', function (tx) {
        _this.announceTX(tx);
      });
    }

    // Normally we would also broadcast
    // competing chains, but we want to
    // avoid getting banned if an evil
    // miner sends us an invalid competing
    // chain that we can't connect and
    // verify yet.
    this.chain.on('block', function (block) {
      if (!_this.chain.synced) return;
      _this.announceBlock(block);
    });
  }
};

/**
 * Open the pool, wait for the chain to load.
 * @method
 * @alias Pool#open
 * @returns {Promise}
 */

Pool.prototype._open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var key;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!this.mempool) {
              _context.next = 5;
              break;
            }

            _context.next = 3;
            return this.mempool.open();

          case 3:
            _context.next = 7;
            break;

          case 5:
            _context.next = 7;
            return this.chain.open();

          case 7:

            this.logger.info('Pool loaded (maxpeers=%d).', this.options.maxOutbound);

            if (this.options.bip150) {
              key = secp256k1.publicKeyCreate(this.options.identityKey, true);

              this.logger.info('Identity public key: %s.', key.toString('hex'));
              this.logger.info('Identity address: %s.', BIP150.address(key));
            }

            this.resetChain();

          case 10:
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
 * Reset header chain.
 */

Pool.prototype.resetChain = function resetChain() {
  if (!this.options.checkpoints) return;

  this.checkpoints = false;
  this.headerTip = null;
  this.headerChain.reset();
  this.headerNext = null;

  var tip = this.chain.tip;

  if (tip.height < this.network.lastCheckpoint) {
    this.checkpoints = true;
    this.headerTip = this.getNextTip(tip.height);
    this.headerChain.push(new HeaderEntry(tip.hash, tip.height));
    this.logger.info('Initialized header chain to height %d (checkpoint=%s).', tip.height, util.revHex(this.headerTip.hash));
  }
};

/**
 * Close and destroy the pool.
 * @method
 * @alias Pool#close
 * @returns {Promise}
 */

Pool.prototype._close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.disconnect();

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
 * Connect to the network.
 * @method
 * @returns {Promise}
 */

Pool.prototype.connect = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
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
            return this._connect();

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

  function connect() {
    return _ref3.apply(this, arguments);
  }

  return connect;
}();

/**
 * Connect to the network (no lock).
 * @method
 * @returns {Promise}
 */

Pool.prototype._connect = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            assert(this.loaded, 'Pool is not loaded.');

            if (!this.connected) {
              _context4.next = 3;
              break;
            }

            return _context4.abrupt('return');

          case 3:
            _context4.next = 5;
            return this.hosts.open();

          case 5:
            _context4.next = 7;
            return this.authdb.open();

          case 7:
            _context4.next = 9;
            return this.discoverGateway();

          case 9:
            _context4.next = 11;
            return this.discoverExternal();

          case 11:
            _context4.next = 13;
            return this.discoverSeeds();

          case 13:

            this.fillOutbound();

            _context4.next = 16;
            return this.listen();

          case 16:

            this.startTimer();

            this.connected = true;

          case 18:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function _connect() {
    return _ref4.apply(this, arguments);
  }

  return _connect;
}();

/**
 * Disconnect from the network.
 * @method
 * @returns {Promise}
 */

Pool.prototype.disconnect = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
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
            return this._disconnect();

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

  function disconnect() {
    return _ref5.apply(this, arguments);
  }

  return disconnect;
}();

/**
 * Disconnect from the network.
 * @method
 * @returns {Promise}
 */

Pool.prototype._disconnect = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, item;

    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            assert(this.loaded, 'Pool is not loaded.');

            if (this.connected) {
              _context6.next = 3;
              break;
            }

            return _context6.abrupt('return');

          case 3:

            this.disconnecting = true;

            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context6.prev = 7;
            for (_iterator = (0, _getIterator3.default)(this.invMap.values()); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              item = _step.value;

              item.resolve();
            }_context6.next = 15;
            break;

          case 11:
            _context6.prev = 11;
            _context6.t0 = _context6['catch'](7);
            _didIteratorError = true;
            _iteratorError = _context6.t0;

          case 15:
            _context6.prev = 15;
            _context6.prev = 16;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 18:
            _context6.prev = 18;

            if (!_didIteratorError) {
              _context6.next = 21;
              break;
            }

            throw _iteratorError;

          case 21:
            return _context6.finish(18);

          case 22:
            return _context6.finish(15);

          case 23:
            this.peers.destroy();

            this.blockMap.clear();
            this.txMap.clear();

            if (this.pendingFilter != null) {
              clearTimeout(this.pendingFilter);
              this.pendingFilter = null;
            }

            if (this.pendingRefill != null) {
              clearTimeout(this.pendingRefill);
              this.pendingRefill = null;
            }

            this.checkpoints = false;
            this.headerTip = null;
            this.headerChain.reset();
            this.headerNext = null;

            this.stopTimer();

            _context6.next = 35;
            return this.authdb.close();

          case 35:
            _context6.next = 37;
            return this.hosts.close();

          case 37:
            _context6.next = 39;
            return this.unlisten();

          case 39:

            this.disconnecting = false;
            this.syncing = false;
            this.connected = false;

          case 42:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[7, 11, 15, 23], [16,, 18, 22]]);
  }));

  function _disconnect() {
    return _ref6.apply(this, arguments);
  }

  return _disconnect;
}();

/**
 * Start listening on a server socket.
 * @method
 * @private
 * @returns {Promise}
 */

Pool.prototype.listen = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            assert(this.server);
            assert(!this.connected, 'Already listening.');

            if (this.options.listen) {
              _context7.next = 4;
              break;
            }

            return _context7.abrupt('return');

          case 4:

            this.server.maxConnections = this.options.maxInbound;

            _context7.next = 7;
            return this.server.listen(this.options.port, this.options.host);

          case 7:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function listen() {
    return _ref7.apply(this, arguments);
  }

  return listen;
}();

/**
 * Stop listening on server socket.
 * @method
 * @private
 * @returns {Promise}
 */

Pool.prototype.unlisten = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8() {
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            assert(this.server);
            assert(this.connected, 'Not listening.');

            if (this.options.listen) {
              _context8.next = 4;
              break;
            }

            return _context8.abrupt('return');

          case 4:
            _context8.next = 6;
            return this.server.close();

          case 6:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function unlisten() {
    return _ref8.apply(this, arguments);
  }

  return unlisten;
}();

/**
 * Start discovery timer.
 * @private
 */

Pool.prototype.startTimer = function startTimer() {
  assert(this.timer == null, 'Timer already started.');
  this.timer = co.setInterval(this.discover, Pool.DISCOVERY_INTERVAL, this);
};

/**
 * Stop discovery timer.
 * @private
 */

Pool.prototype.stopTimer = function stopTimer() {
  assert(this.timer != null, 'Timer already stopped.');
  co.clearInterval(this.timer);
  this.timer = null;
};

/**
 * Rediscover seeds and internet gateway.
 * Attempt to add port mapping once again.
 * @returns {Promise}
 */

Pool.prototype.discover = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9() {
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _context9.next = 2;
            return this.discoverGateway();

          case 2:
            _context9.next = 4;
            return this.discoverSeeds(true);

          case 4:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function discover() {
    return _ref9.apply(this, arguments);
  }

  return discover;
}();

/**
 * Attempt to add port mapping (i.e.
 * remote:8333->local:8333) via UPNP.
 * @returns {Promise}
 */

Pool.prototype.discoverGateway = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10() {
    var src, dest, wan, host;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            src = this.options.publicPort;
            dest = this.options.port;

            // Pointless if we're not listening.

            if (this.options.listen) {
              _context10.next = 4;
              break;
            }

            return _context10.abrupt('return', false);

          case 4:
            if (this.options.upnp) {
              _context10.next = 6;
              break;
            }

            return _context10.abrupt('return', false);

          case 6:
            wan = void 0;
            _context10.prev = 7;

            this.logger.debug('Discovering internet gateway (upnp).');
            _context10.next = 11;
            return UPNP.discover();

          case 11:
            wan = _context10.sent;
            _context10.next = 19;
            break;

          case 14:
            _context10.prev = 14;
            _context10.t0 = _context10['catch'](7);

            this.logger.debug('Could not discover internet gateway (upnp).');
            this.logger.debug(_context10.t0);
            return _context10.abrupt('return', false);

          case 19:
            host = void 0;
            _context10.prev = 20;
            _context10.next = 23;
            return wan.getExternalIP();

          case 23:
            host = _context10.sent;
            _context10.next = 31;
            break;

          case 26:
            _context10.prev = 26;
            _context10.t1 = _context10['catch'](20);

            this.logger.debug('Could not find external IP (upnp).');
            this.logger.debug(_context10.t1);
            return _context10.abrupt('return', false);

          case 31:

            if (this.hosts.addLocal(host, src, scores.UPNP)) this.logger.info('External IP found (upnp): %s.', host);

            this.logger.debug('Adding port mapping %d->%d.', src, dest);

            _context10.prev = 33;
            _context10.next = 36;
            return wan.addPortMapping(host, src, dest);

          case 36:
            _context10.next = 43;
            break;

          case 38:
            _context10.prev = 38;
            _context10.t2 = _context10['catch'](33);

            this.logger.debug('Could not add port mapping (upnp).');
            this.logger.debug(_context10.t2);
            return _context10.abrupt('return', false);

          case 43:
            return _context10.abrupt('return', true);

          case 44:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this, [[7, 14], [20, 26], [33, 38]]);
  }));

  function discoverGateway() {
    return _ref10.apply(this, arguments);
  }

  return discoverGateway;
}();

/**
 * Attempt to resolve DNS seeds if necessary.
 * @param {Boolean} checkPeers
 * @returns {Promise}
 */

Pool.prototype.discoverSeeds = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(checkPeers) {
    var max, size, total, peer;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            if (!(this.hosts.dnsSeeds.length === 0)) {
              _context11.next = 2;
              break;
            }

            return _context11.abrupt('return');

          case 2:
            max = Math.min(2, this.options.maxOutbound);
            size = this.hosts.size();
            total = 0;
            peer = this.peers.head();

          case 6:
            if (!peer) {
              _context11.next = 15;
              break;
            }

            if (peer.outbound) {
              _context11.next = 9;
              break;
            }

            return _context11.abrupt('continue', 12);

          case 9:
            if (!peer.connected) {
              _context11.next = 12;
              break;
            }

            if (!(++total > max)) {
              _context11.next = 12;
              break;
            }

            return _context11.abrupt('break', 15);

          case 12:
            peer = peer.next;
            _context11.next = 6;
            break;

          case 15:
            if (!(size === 0 || checkPeers && total < max)) {
              _context11.next = 22;
              break;
            }

            this.logger.warning('Could not find enough peers.');
            this.logger.warning('Hitting DNS seeds...');

            _context11.next = 20;
            return this.hosts.discoverSeeds();

          case 20:

            this.logger.info('Resolved %d hosts from DNS seeds.', this.hosts.size() - size);

            this.refill();

          case 22:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function discoverSeeds(_x) {
    return _ref11.apply(this, arguments);
  }

  return discoverSeeds;
}();

/**
 * Attempt to discover external IP via HTTP.
 * @returns {Promise}
 */

Pool.prototype.discoverExternal = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12() {
    var port, host4, host6;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            port = this.options.publicPort;

            // Pointless if we're not listening.

            if (this.options.listen) {
              _context12.next = 3;
              break;
            }

            return _context12.abrupt('return');

          case 3:
            if (!this.options.proxy) {
              _context12.next = 5;
              break;
            }

            return _context12.abrupt('return');

          case 5:
            if (!(this.hosts.local.size > 0)) {
              _context12.next = 7;
              break;
            }

            return _context12.abrupt('return');

          case 7:
            host4 = void 0;
            _context12.prev = 8;
            _context12.next = 11;
            return external.getIPv4();

          case 11:
            host4 = _context12.sent;
            _context12.next = 18;
            break;

          case 14:
            _context12.prev = 14;
            _context12.t0 = _context12['catch'](8);

            this.logger.debug('Could not find external IPv4 (http).');
            this.logger.debug(_context12.t0);

          case 18:

            if (host4 && this.hosts.addLocal(host4, port, scores.HTTP)) this.logger.info('External IPv4 found (http): %s.', host4);

            host6 = void 0;
            _context12.prev = 20;
            _context12.next = 23;
            return external.getIPv6();

          case 23:
            host6 = _context12.sent;
            _context12.next = 30;
            break;

          case 26:
            _context12.prev = 26;
            _context12.t1 = _context12['catch'](20);

            this.logger.debug('Could not find external IPv6 (http).');
            this.logger.debug(_context12.t1);

          case 30:

            if (host6 && this.hosts.addLocal(host6, port, scores.HTTP)) this.logger.info('External IPv6 found (http): %s.', host6);

          case 31:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this, [[8, 14], [20, 26]]);
  }));

  function discoverExternal() {
    return _ref12.apply(this, arguments);
  }

  return discoverExternal;
}();

/**
 * Handle incoming connection.
 * @private
 * @param {net.Socket} socket
 */

Pool.prototype.handleSocket = function handleSocket(socket) {
  if (!socket.remoteAddress) {
    this.logger.debug('Ignoring disconnected peer.');
    socket.destroy();
    return;
  }

  var ip = IP.normalize(socket.remoteAddress);

  if (this.peers.inbound >= this.options.maxInbound) {
    this.logger.debug('Ignoring peer: too many inbound (%s).', ip);
    socket.destroy();
    return;
  }

  if (this.hosts.isBanned(ip)) {
    this.logger.debug('Ignoring banned peer (%s).', ip);
    socket.destroy();
    return;
  }

  var host = IP.toHostname(ip, socket.remotePort);

  assert(!this.peers.map[host], 'Port collision.');

  this.addInbound(socket);
};

/**
 * Add a loader peer. Necessary for
 * a sync to even begin.
 * @private
 */

Pool.prototype.addLoader = function addLoader() {
  if (!this.loaded) return;

  assert(!this.peers.load);

  for (var _peer = this.peers.head(); _peer; _peer = _peer.next) {
    if (!_peer.outbound) continue;

    this.logger.info('Repurposing peer for loader (%s).', _peer.hostname());

    this.setLoader(_peer);

    return;
  }

  var addr = this.getHost();

  if (!addr) return;

  var peer = this.createOutbound(addr);

  this.logger.info('Adding loader peer (%s).', peer.hostname());

  this.peers.add(peer);

  this.setLoader(peer);
};

/**
 * Add a loader peer. Necessary for
 * a sync to even begin.
 * @private
 */

Pool.prototype.setLoader = function setLoader(peer) {
  if (!this.loaded) return;

  assert(peer.outbound);
  assert(!this.peers.load);
  assert(!peer.loader);

  peer.loader = true;
  this.peers.load = peer;

  this.sendSync(peer);

  this.emit('loader', peer);
};

/**
 * Start the blockchain sync.
 */

Pool.prototype.startSync = function startSync() {
  if (!this.loaded) return;

  assert(this.connected, 'Pool is not connected!');

  this.syncing = true;
  this.resync(false);
};

/**
 * Force sending of a sync to each peer.
 */

Pool.prototype.forceSync = function forceSync() {
  if (!this.loaded) return;

  assert(this.connected, 'Pool is not connected!');

  this.resync(true);
};

/**
 * Send a sync to each peer.
 */

Pool.prototype.sync = function sync(force) {
  this.resync(false);
};

/**
 * Stop the sync.
 * @private
 */

Pool.prototype.stopSync = function stopSync() {
  if (!this.syncing) return;

  this.syncing = false;

  for (var peer = this.peers.head(); peer; peer = peer.next) {
    if (!peer.outbound) continue;

    if (!peer.syncing) continue;

    peer.syncing = false;
    peer.merkleBlock = null;
    peer.merkleTime = -1;
    peer.merkleMatches = 0;
    peer.merkleMap = null;
    peer.blockTime = -1;
    peer.blockMap.clear();
    peer.compactBlocks.clear();
  }

  this.blockMap.clear();
  this.compactBlocks.clear();
};

/**
 * Send a sync to each peer.
 * @private
 * @param {Boolean?} force
 * @returns {Promise}
 */

Pool.prototype.resync = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(force) {
    var locator, peer;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            if (this.syncing) {
              _context13.next = 2;
              break;
            }

            return _context13.abrupt('return');

          case 2:
            locator = void 0;
            _context13.prev = 3;
            _context13.next = 6;
            return this.chain.getLocator();

          case 6:
            locator = _context13.sent;
            _context13.next = 13;
            break;

          case 9:
            _context13.prev = 9;
            _context13.t0 = _context13['catch'](3);

            this.emit('error', _context13.t0);
            return _context13.abrupt('return');

          case 13:
            peer = this.peers.head();

          case 14:
            if (!peer) {
              _context13.next = 23;
              break;
            }

            if (peer.outbound) {
              _context13.next = 17;
              break;
            }

            return _context13.abrupt('continue', 20);

          case 17:
            if (!(!force && peer.syncing)) {
              _context13.next = 19;
              break;
            }

            return _context13.abrupt('continue', 20);

          case 19:

            this.sendLocator(locator, peer);

          case 20:
            peer = peer.next;
            _context13.next = 14;
            break;

          case 23:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this, [[3, 9]]);
  }));

  function resync(_x2) {
    return _ref13.apply(this, arguments);
  }

  return resync;
}();

/**
 * Test whether a peer is sync-worthy.
 * @param {Peer} peer
 * @returns {Boolean}
 */

Pool.prototype.isSyncable = function isSyncable(peer) {
  if (!this.syncing) return false;

  if (peer.destroyed) return false;

  if (!peer.handshake) return false;

  if (!(peer.services & services.NETWORK)) return false;

  if (this.options.hasWitness() && !peer.hasWitness()) return false;

  if (!peer.loader) {
    if (!this.chain.synced) return false;
  }

  return true;
};

/**
 * Start syncing from peer.
 * @method
 * @param {Peer} peer
 * @returns {Promise}
 */

Pool.prototype.sendSync = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(peer) {
    var locator;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            if (!peer.syncing) {
              _context14.next = 2;
              break;
            }

            return _context14.abrupt('return', false);

          case 2:
            if (this.isSyncable(peer)) {
              _context14.next = 4;
              break;
            }

            return _context14.abrupt('return', false);

          case 4:

            peer.syncing = true;
            peer.blockTime = util.ms();

            locator = void 0;
            _context14.prev = 7;
            _context14.next = 10;
            return this.chain.getLocator();

          case 10:
            locator = _context14.sent;
            _context14.next = 19;
            break;

          case 13:
            _context14.prev = 13;
            _context14.t0 = _context14['catch'](7);

            peer.syncing = false;
            peer.blockTime = -1;
            this.emit('error', _context14.t0);
            return _context14.abrupt('return', false);

          case 19:
            return _context14.abrupt('return', this.sendLocator(locator, peer));

          case 20:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this, [[7, 13]]);
  }));

  function sendSync(_x3) {
    return _ref14.apply(this, arguments);
  }

  return sendSync;
}();

/**
 * Send a chain locator and start syncing from peer.
 * @method
 * @param {Hash[]} locator
 * @param {Peer} peer
 * @returns {Boolean}
 */

Pool.prototype.sendLocator = function sendLocator(locator, peer) {
  if (!this.isSyncable(peer)) return false;

  // Ask for the mempool if we're synced.
  if (this.network.requestMempool) {
    if (peer.loader && this.chain.synced) peer.sendMempool();
  }

  peer.syncing = true;
  peer.blockTime = util.ms();

  if (this.checkpoints) {
    peer.sendGetHeaders(locator, this.headerTip.hash);
    return true;
  }

  peer.sendGetBlocks(locator);

  return true;
};

/**
 * Send `mempool` to all peers.
 */

Pool.prototype.sendMempool = function sendMempool() {
  for (var peer = this.peers.head(); peer; peer = peer.next) {
    peer.sendMempool();
  }
};

/**
 * Send `getaddr` to all peers.
 */

Pool.prototype.sendGetAddr = function sendGetAddr() {
  for (var peer = this.peers.head(); peer; peer = peer.next) {
    peer.sendGetAddr();
  }
};

/**
 * Request current header chain blocks.
 * @private
 * @param {Peer} peer
 */

Pool.prototype.resolveHeaders = function resolveHeaders(peer) {
  var items = [];

  for (var node = this.headerNext; node; node = node.next) {
    this.headerNext = node.next;

    items.push(node.hash);

    if (items.length === 50000) break;
  }

  this.getBlock(peer, items);
};

/**
 * Update all peer heights by their best hash.
 * @param {Hash} hash
 * @param {Number} height
 */

Pool.prototype.resolveHeight = function resolveHeight(hash, height) {
  var total = 0;

  for (var peer = this.peers.head(); peer; peer = peer.next) {
    if (peer.bestHash !== hash) continue;

    if (peer.bestHeight !== height) {
      peer.bestHeight = height;
      total++;
    }
  }

  if (total > 0) this.logger.debug('Resolved height for %d peers.', total);
};

/**
 * Find the next checkpoint.
 * @private
 * @param {Number} height
 * @returns {Object}
 */

Pool.prototype.getNextTip = function getNextTip(height) {
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(this.network.checkpoints), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var next = _step2.value;

      if (next.height > height) return new HeaderEntry(next.hash, next.height);
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

  throw new Error('Next checkpoint not found.');
};

/**
 * Announce broadcast list to peer.
 * @param {Peer} peer
 */

Pool.prototype.announceList = function announceList(peer) {
  var blocks = [];
  var txs = [];

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.invMap.values()), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var item = _step3.value;

      switch (item.type) {
        case invTypes.BLOCK:
          blocks.push(item.msg);
          break;
        case invTypes.TX:
          txs.push(item.msg);
          break;
        default:
          assert(false, 'Bad item type.');
          break;
      }
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

  if (blocks.length > 0) peer.announceBlock(blocks);

  if (txs.length > 0) peer.announceTX(txs);
};

/**
 * Get a block/tx from the broadcast map.
 * @private
 * @param {Peer} peer
 * @param {InvItem} item
 * @returns {Promise}
 */

Pool.prototype.getBroadcasted = function getBroadcasted(peer, item) {
  var type = item.isTX() ? invTypes.TX : invTypes.BLOCK;
  var entry = this.invMap.get(item.hash);

  if (!entry) return null;

  if (type !== entry.type) {
    this.logger.debug('Peer requested item with the wrong type (%s).', peer.hostname());
    return null;
  }

  this.logger.debug('Peer requested %s %s as a %s packet (%s).', item.isTX() ? 'tx' : 'block', item.rhash(), item.hasWitness() ? 'witness' : 'normal', peer.hostname());

  entry.handleAck(peer);

  return entry.msg;
};

/**
 * Get a block/tx either from the broadcast map, mempool, or blockchain.
 * @method
 * @private
 * @param {Peer} peer
 * @param {InvItem} item
 * @returns {Promise}
 */

Pool.prototype.getItem = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(peer, item) {
    var entry;
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            entry = this.getBroadcasted(peer, item);

            if (!entry) {
              _context15.next = 3;
              break;
            }

            return _context15.abrupt('return', entry);

          case 3:
            if (!this.options.selfish) {
              _context15.next = 5;
              break;
            }

            return _context15.abrupt('return', null);

          case 5:
            if (!item.isTX()) {
              _context15.next = 9;
              break;
            }

            if (this.mempool) {
              _context15.next = 8;
              break;
            }

            return _context15.abrupt('return', null);

          case 8:
            return _context15.abrupt('return', this.mempool.getTX(item.hash));

          case 9:
            if (!this.chain.options.spv) {
              _context15.next = 11;
              break;
            }

            return _context15.abrupt('return', null);

          case 11:
            if (!this.chain.options.prune) {
              _context15.next = 13;
              break;
            }

            return _context15.abrupt('return', null);

          case 13:
            _context15.next = 15;
            return this.chain.getBlock(item.hash);

          case 15:
            return _context15.abrupt('return', _context15.sent);

          case 16:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this);
  }));

  function getItem(_x4, _x5) {
    return _ref15.apply(this, arguments);
  }

  return getItem;
}();

/**
 * Send a block from the broadcast list or chain.
 * @method
 * @private
 * @param {Peer} peer
 * @param {InvItem} item
 * @returns {Boolean}
 */

Pool.prototype.sendBlock = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(peer, item, witness) {
    var broadcasted, _block, block;

    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            broadcasted = this.getBroadcasted(peer, item);

            // Check for a broadcasted item first.

            if (!broadcasted) {
              _context16.next = 4;
              break;
            }

            peer.send(new packets.BlockPacket(broadcasted, witness));
            return _context16.abrupt('return', true);

          case 4:
            if (!(this.options.selfish || this.chain.options.spv || this.chain.options.prune)) {
              _context16.next = 6;
              break;
            }

            return _context16.abrupt('return', false);

          case 6:
            if (!(witness || !this.options.hasWitness())) {
              _context16.next = 14;
              break;
            }

            _context16.next = 9;
            return this.chain.getRawBlock(item.hash);

          case 9:
            _block = _context16.sent;

            if (!_block) {
              _context16.next = 13;
              break;
            }

            peer.sendRaw('block', _block);
            return _context16.abrupt('return', true);

          case 13:
            return _context16.abrupt('return', false);

          case 14:
            _context16.next = 16;
            return this.chain.getBlock(item.hash);

          case 16:
            block = _context16.sent;

            if (!block) {
              _context16.next = 20;
              break;
            }

            peer.send(new packets.BlockPacket(block, witness));
            return _context16.abrupt('return', true);

          case 20:
            return _context16.abrupt('return', false);

          case 21:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function sendBlock(_x6, _x7, _x8) {
    return _ref16.apply(this, arguments);
  }

  return sendBlock;
}();

/**
 * Create an outbound peer with no special purpose.
 * @private
 * @param {NetAddress} addr
 * @returns {Peer}
 */

Pool.prototype.createOutbound = function createOutbound(addr) {
  var cipher = BIP151.ciphers.CHACHAPOLY;
  var identity = this.options.identityKey;
  var peer = Peer.fromOutbound(this.options, addr);

  this.hosts.markAttempt(addr.hostname);

  if (this.options.bip151) peer.setCipher(cipher);

  if (this.options.bip150) peer.setAuth(this.authdb, identity);

  this.bindPeer(peer);

  this.logger.debug('Connecting to %s.', peer.hostname());

  peer.tryOpen();

  return peer;
};

/**
 * Accept an inbound socket.
 * @private
 * @param {net.Socket} socket
 * @returns {Peer}
 */

Pool.prototype.createInbound = function createInbound(socket) {
  var cipher = BIP151.ciphers.CHACHAPOLY;
  var identity = this.options.identityKey;
  var peer = Peer.fromInbound(this.options, socket);

  if (this.options.bip151) peer.setCipher(cipher);

  if (this.options.bip150) peer.setAuth(this.authdb, identity);

  this.bindPeer(peer);

  peer.tryOpen();

  return peer;
};

/**
 * Allocate new peer id.
 * @returns {Number}
 */

Pool.prototype.uid = function uid() {
  var MAX = _maxSafeInteger2.default;

  if (this.id >= MAX - this.peers.size() - 1) this.id = 0;

  // Once we overflow, there's a chance
  // of collisions. Unlikely to happen
  // unless we have tried to connect 9
  // quadrillion times, but still
  // account for it.
  do {
    this.id += 1;
  } while (this.peers.find(this.id));

  return this.id;
};

/**
 * Bind to peer events.
 * @private
 * @param {Peer} peer
 */

Pool.prototype.bindPeer = function bindPeer(peer) {
  var _this2 = this;

  peer.id = this.uid();

  peer.onPacket = function (packet) {
    return _this2.handlePacket(peer, packet);
  };

  peer.on('error', function (err) {
    _this2.logger.debug(err);
  });

  peer.once('connect', function () {
    _this2.handleConnect(peer);
  });

  peer.once('open', function () {
    _this2.handleOpen(peer);
  });

  peer.once('close', function (connected) {
    _this2.handleClose(peer, connected);
  });

  peer.once('ban', function () {
    _this2.handleBan(peer);
  });
};

/**
 * Handle peer packet event.
 * @method
 * @private
 * @param {Peer} peer
 * @param {Packet} packet
 * @returns {Promise}
 */

Pool.prototype.handlePacket = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(peer, packet) {
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            _context17.t0 = packet.type;
            _context17.next = _context17.t0 === packetTypes.VERSION ? 3 : _context17.t0 === packetTypes.VERACK ? 6 : _context17.t0 === packetTypes.PING ? 9 : _context17.t0 === packetTypes.PONG ? 12 : _context17.t0 === packetTypes.GETADDR ? 15 : _context17.t0 === packetTypes.ADDR ? 18 : _context17.t0 === packetTypes.INV ? 21 : _context17.t0 === packetTypes.GETDATA ? 24 : _context17.t0 === packetTypes.NOTFOUND ? 27 : _context17.t0 === packetTypes.GETBLOCKS ? 30 : _context17.t0 === packetTypes.GETHEADERS ? 33 : _context17.t0 === packetTypes.HEADERS ? 36 : _context17.t0 === packetTypes.SENDHEADERS ? 39 : _context17.t0 === packetTypes.BLOCK ? 42 : _context17.t0 === packetTypes.TX ? 45 : _context17.t0 === packetTypes.REJECT ? 48 : _context17.t0 === packetTypes.MEMPOOL ? 51 : _context17.t0 === packetTypes.FILTERLOAD ? 54 : _context17.t0 === packetTypes.FILTERADD ? 57 : _context17.t0 === packetTypes.FILTERCLEAR ? 60 : _context17.t0 === packetTypes.MERKLEBLOCK ? 63 : _context17.t0 === packetTypes.FEEFILTER ? 66 : _context17.t0 === packetTypes.SENDCMPCT ? 69 : _context17.t0 === packetTypes.CMPCTBLOCK ? 72 : _context17.t0 === packetTypes.GETBLOCKTXN ? 75 : _context17.t0 === packetTypes.BLOCKTXN ? 78 : _context17.t0 === packetTypes.ENCINIT ? 81 : _context17.t0 === packetTypes.ENCACK ? 84 : _context17.t0 === packetTypes.AUTHCHALLENGE ? 87 : _context17.t0 === packetTypes.AUTHREPLY ? 90 : _context17.t0 === packetTypes.AUTHPROPOSE ? 93 : _context17.t0 === packetTypes.UNKNOWN ? 96 : 99;
            break;

          case 3:
            _context17.next = 5;
            return this.handleVersion(peer, packet);

          case 5:
            return _context17.abrupt('break', 101);

          case 6:
            _context17.next = 8;
            return this.handleVerack(peer, packet);

          case 8:
            return _context17.abrupt('break', 101);

          case 9:
            _context17.next = 11;
            return this.handlePing(peer, packet);

          case 11:
            return _context17.abrupt('break', 101);

          case 12:
            _context17.next = 14;
            return this.handlePong(peer, packet);

          case 14:
            return _context17.abrupt('break', 101);

          case 15:
            _context17.next = 17;
            return this.handleGetAddr(peer, packet);

          case 17:
            return _context17.abrupt('break', 101);

          case 18:
            _context17.next = 20;
            return this.handleAddr(peer, packet);

          case 20:
            return _context17.abrupt('break', 101);

          case 21:
            _context17.next = 23;
            return this.handleInv(peer, packet);

          case 23:
            return _context17.abrupt('break', 101);

          case 24:
            _context17.next = 26;
            return this.handleGetData(peer, packet);

          case 26:
            return _context17.abrupt('break', 101);

          case 27:
            _context17.next = 29;
            return this.handleNotFound(peer, packet);

          case 29:
            return _context17.abrupt('break', 101);

          case 30:
            _context17.next = 32;
            return this.handleGetBlocks(peer, packet);

          case 32:
            return _context17.abrupt('break', 101);

          case 33:
            _context17.next = 35;
            return this.handleGetHeaders(peer, packet);

          case 35:
            return _context17.abrupt('break', 101);

          case 36:
            _context17.next = 38;
            return this.handleHeaders(peer, packet);

          case 38:
            return _context17.abrupt('break', 101);

          case 39:
            _context17.next = 41;
            return this.handleSendHeaders(peer, packet);

          case 41:
            return _context17.abrupt('break', 101);

          case 42:
            _context17.next = 44;
            return this.handleBlock(peer, packet);

          case 44:
            return _context17.abrupt('break', 101);

          case 45:
            _context17.next = 47;
            return this.handleTX(peer, packet);

          case 47:
            return _context17.abrupt('break', 101);

          case 48:
            _context17.next = 50;
            return this.handleReject(peer, packet);

          case 50:
            return _context17.abrupt('break', 101);

          case 51:
            _context17.next = 53;
            return this.handleMempool(peer, packet);

          case 53:
            return _context17.abrupt('break', 101);

          case 54:
            _context17.next = 56;
            return this.handleFilterLoad(peer, packet);

          case 56:
            return _context17.abrupt('break', 101);

          case 57:
            _context17.next = 59;
            return this.handleFilterAdd(peer, packet);

          case 59:
            return _context17.abrupt('break', 101);

          case 60:
            _context17.next = 62;
            return this.handleFilterClear(peer, packet);

          case 62:
            return _context17.abrupt('break', 101);

          case 63:
            _context17.next = 65;
            return this.handleMerkleBlock(peer, packet);

          case 65:
            return _context17.abrupt('break', 101);

          case 66:
            _context17.next = 68;
            return this.handleFeeFilter(peer, packet);

          case 68:
            return _context17.abrupt('break', 101);

          case 69:
            _context17.next = 71;
            return this.handleSendCmpct(peer, packet);

          case 71:
            return _context17.abrupt('break', 101);

          case 72:
            _context17.next = 74;
            return this.handleCmpctBlock(peer, packet);

          case 74:
            return _context17.abrupt('break', 101);

          case 75:
            _context17.next = 77;
            return this.handleGetBlockTxn(peer, packet);

          case 77:
            return _context17.abrupt('break', 101);

          case 78:
            _context17.next = 80;
            return this.handleBlockTxn(peer, packet);

          case 80:
            return _context17.abrupt('break', 101);

          case 81:
            _context17.next = 83;
            return this.handleEncinit(peer, packet);

          case 83:
            return _context17.abrupt('break', 101);

          case 84:
            _context17.next = 86;
            return this.handleEncack(peer, packet);

          case 86:
            return _context17.abrupt('break', 101);

          case 87:
            _context17.next = 89;
            return this.handleAuthChallenge(peer, packet);

          case 89:
            return _context17.abrupt('break', 101);

          case 90:
            _context17.next = 92;
            return this.handleAuthReply(peer, packet);

          case 92:
            return _context17.abrupt('break', 101);

          case 93:
            _context17.next = 95;
            return this.handleAuthPropose(peer, packet);

          case 95:
            return _context17.abrupt('break', 101);

          case 96:
            _context17.next = 98;
            return this.handleUnknown(peer, packet);

          case 98:
            return _context17.abrupt('break', 101);

          case 99:
            assert(false, 'Bad packet type.');
            return _context17.abrupt('break', 101);

          case 101:

            this.emit('packet', packet, peer);

          case 102:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this);
  }));

  function handlePacket(_x9, _x10) {
    return _ref17.apply(this, arguments);
  }

  return handlePacket;
}();

/**
 * Handle peer connect event.
 * @method
 * @private
 * @param {Peer} peer
 */

Pool.prototype.handleConnect = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(peer) {
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            this.logger.info('Connected to %s.', peer.hostname());

            if (peer.outbound) this.hosts.markSuccess(peer.hostname());

            this.emit('peer connect', peer);

          case 3:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this);
  }));

  function handleConnect(_x11) {
    return _ref18.apply(this, arguments);
  }

  return handleConnect;
}();

/**
 * Handle peer open event.
 * @method
 * @private
 * @param {Peer} peer
 */

Pool.prototype.handleOpen = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(peer) {
    var addr;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            // Advertise our address.
            if (!this.options.selfish && this.options.listen) {
              addr = this.hosts.getLocal(peer.address);

              if (addr) peer.send(new packets.AddrPacket([addr]));
            }

            // We want compact blocks!
            if (this.options.compact) peer.sendCompact(this.options.blockMode);

            // Find some more peers.
            if (!this.hosts.isFull()) peer.sendGetAddr();

            // Relay our spv filter if we have one.
            if (this.spvFilter) peer.sendFilterLoad(this.spvFilter);

            // Announce our currently broadcasted items.
            this.announceList(peer);

            // Set a fee rate filter.
            if (this.options.feeRate !== -1) peer.sendFeeRate(this.options.feeRate);

            // Start syncing the chain.
            if (peer.outbound) this.sendSync(peer);

            if (peer.outbound) {
              this.hosts.markAck(peer.hostname(), peer.services);

              // If we don't have an ack'd
              // loader yet consider it dead.
              if (!peer.loader) {
                if (this.peers.load && !this.peers.load.handshake) {
                  assert(this.peers.load.loader);
                  this.peers.load.loader = false;
                  this.peers.load = null;
                }
              }

              // If we do not have a loader,
              // use this peer.
              if (!this.peers.load) this.setLoader(peer);
            }

            this.emit('peer open', peer);

          case 9:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this);
  }));

  function handleOpen(_x12) {
    return _ref19.apply(this, arguments);
  }

  return handleOpen;
}();

/**
 * Handle peer close event.
 * @method
 * @private
 * @param {Peer} peer
 * @param {Boolean} connected
 */

Pool.prototype.handleClose = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(peer, connected) {
    var outbound, loader, size;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            outbound = peer.outbound;
            loader = peer.loader;
            size = peer.blockMap.size;


            this.removePeer(peer);

            if (loader) {
              this.logger.info('Removed loader peer (%s).', peer.hostname());
              if (this.checkpoints) this.resetChain();
            }

            this.nonces.remove(peer.hostname());

            this.emit('peer close', peer, connected);

            if (this.loaded) {
              _context20.next = 9;
              break;
            }

            return _context20.abrupt('return');

          case 9:
            if (!this.disconnecting) {
              _context20.next = 11;
              break;
            }

            return _context20.abrupt('return');

          case 11:

            if (this.chain.synced && size > 0) {
              this.logger.warning('Peer disconnected with requested blocks.');
              this.logger.warning('Resending sync...');
              this.forceSync();
            }

            if (outbound) {
              _context20.next = 14;
              break;
            }

            return _context20.abrupt('return');

          case 14:

            this.refill();

          case 15:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function handleClose(_x13, _x14) {
    return _ref20.apply(this, arguments);
  }

  return handleClose;
}();

/**
 * Handle ban event.
 * @method
 * @private
 * @param {Peer} peer
 */

Pool.prototype.handleBan = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(peer) {
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            this.ban(peer.address);
            this.emit('ban', peer);

          case 2:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function handleBan(_x15) {
    return _ref21.apply(this, arguments);
  }

  return handleBan;
}();

/**
 * Handle peer version event.
 * @method
 * @private
 * @param {Peer} peer
 * @param {VersionPacket} packet
 */

Pool.prototype.handleVersion = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(peer, packet) {
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            this.logger.info('Received version (%s): version=%d height=%d services=%s agent=%s', peer.hostname(), packet.version, packet.height, packet.services.toString(2), packet.agent);

            this.network.time.add(peer.hostname(), packet.time);
            this.nonces.remove(peer.hostname());

            if (!peer.outbound && packet.remote.isRoutable()) this.hosts.markLocal(packet.remote);

          case 4:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function handleVersion(_x16, _x17) {
    return _ref22.apply(this, arguments);
  }

  return handleVersion;
}();

/**
 * Handle `verack` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {VerackPacket} packet
 */

Pool.prototype.handleVerack = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(peer, packet) {
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function handleVerack(_x18, _x19) {
    return _ref23.apply(this, arguments);
  }

  return handleVerack;
}();

/**
 * Handle `ping` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {PingPacket} packet
 */

Pool.prototype.handlePing = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(peer, packet) {
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function handlePing(_x20, _x21) {
    return _ref24.apply(this, arguments);
  }

  return handlePing;
}();

/**
 * Handle `pong` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {PongPacket} packet
 */

Pool.prototype.handlePong = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(peer, packet) {
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this);
  }));

  function handlePong(_x22, _x23) {
    return _ref25.apply(this, arguments);
  }

  return handlePong;
}();

/**
 * Handle `getaddr` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {GetAddrPacket} packet
 */

Pool.prototype.handleGetAddr = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(peer, packet) {
    var addrs, items, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, addr;

    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            if (!this.options.selfish) {
              _context26.next = 2;
              break;
            }

            return _context26.abrupt('return');

          case 2:
            if (!peer.sentAddr) {
              _context26.next = 5;
              break;
            }

            this.logger.debug('Ignoring repeated getaddr (%s).', peer.hostname());
            return _context26.abrupt('return');

          case 5:

            peer.sentAddr = true;

            addrs = this.hosts.toArray();
            items = [];
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context26.prev = 11;
            _iterator4 = (0, _getIterator3.default)(addrs);

          case 13:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context26.next = 23;
              break;
            }

            addr = _step4.value;

            if (peer.addrFilter.added(addr.hostname, 'ascii')) {
              _context26.next = 17;
              break;
            }

            return _context26.abrupt('continue', 20);

          case 17:

            items.push(addr);

            if (!(items.length === 1000)) {
              _context26.next = 20;
              break;
            }

            return _context26.abrupt('break', 23);

          case 20:
            _iteratorNormalCompletion4 = true;
            _context26.next = 13;
            break;

          case 23:
            _context26.next = 29;
            break;

          case 25:
            _context26.prev = 25;
            _context26.t0 = _context26['catch'](11);
            _didIteratorError4 = true;
            _iteratorError4 = _context26.t0;

          case 29:
            _context26.prev = 29;
            _context26.prev = 30;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 32:
            _context26.prev = 32;

            if (!_didIteratorError4) {
              _context26.next = 35;
              break;
            }

            throw _iteratorError4;

          case 35:
            return _context26.finish(32);

          case 36:
            return _context26.finish(29);

          case 37:
            if (!(items.length === 0)) {
              _context26.next = 39;
              break;
            }

            return _context26.abrupt('return');

          case 39:

            this.logger.debug('Sending %d addrs to peer (%s)', items.length, peer.hostname());

            peer.send(new packets.AddrPacket(items));

          case 41:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this, [[11, 25, 29, 37], [30,, 32, 36]]);
  }));

  function handleGetAddr(_x24, _x25) {
    return _ref26.apply(this, arguments);
  }

  return handleGetAddr;
}();

/**
 * Handle peer addr event.
 * @method
 * @private
 * @param {Peer} peer
 * @param {AddrPacket} packet
 */

Pool.prototype.handleAddr = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(peer, packet) {
    var addrs, now, services, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, addr;

    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            addrs = packet.items;
            now = this.network.now();
            services = this.options.getRequiredServices();
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context27.prev = 6;
            _iterator5 = (0, _getIterator3.default)(addrs);

          case 8:
            if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
              _context27.next = 22;
              break;
            }

            addr = _step5.value;

            peer.addrFilter.add(addr.hostname, 'ascii');

            if (addr.isRoutable()) {
              _context27.next = 13;
              break;
            }

            return _context27.abrupt('continue', 19);

          case 13:
            if (addr.hasServices(services)) {
              _context27.next = 15;
              break;
            }

            return _context27.abrupt('continue', 19);

          case 15:

            if (addr.time <= 100000000 || addr.time > now + 10 * 60) addr.time = now - 5 * 24 * 60 * 60;

            if (!(addr.port === 0)) {
              _context27.next = 18;
              break;
            }

            return _context27.abrupt('continue', 19);

          case 18:

            this.hosts.add(addr, peer.address);

          case 19:
            _iteratorNormalCompletion5 = true;
            _context27.next = 8;
            break;

          case 22:
            _context27.next = 28;
            break;

          case 24:
            _context27.prev = 24;
            _context27.t0 = _context27['catch'](6);
            _didIteratorError5 = true;
            _iteratorError5 = _context27.t0;

          case 28:
            _context27.prev = 28;
            _context27.prev = 29;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 31:
            _context27.prev = 31;

            if (!_didIteratorError5) {
              _context27.next = 34;
              break;
            }

            throw _iteratorError5;

          case 34:
            return _context27.finish(31);

          case 35:
            return _context27.finish(28);

          case 36:

            this.logger.info('Received %d addrs (hosts=%d, peers=%d) (%s).', addrs.length, this.hosts.size(), this.peers.size(), peer.hostname());

            this.fillOutbound();

          case 38:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this, [[6, 24, 28, 36], [29,, 31, 35]]);
  }));

  function handleAddr(_x26, _x27) {
    return _ref27.apply(this, arguments);
  }

  return handleAddr;
}();

/**
 * Handle `inv` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {InvPacket} packet
 */

Pool.prototype.handleInv = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(peer, packet) {
    var unlock;
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            _context28.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context28.sent;
            _context28.prev = 3;
            _context28.next = 6;
            return this._handleInv(peer, packet);

          case 6:
            return _context28.abrupt('return', _context28.sent);

          case 7:
            _context28.prev = 7;

            unlock();
            return _context28.finish(7);

          case 10:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this, [[3,, 7, 10]]);
  }));

  function handleInv(_x28, _x29) {
    return _ref28.apply(this, arguments);
  }

  return handleInv;
}();

/**
 * Handle `inv` packet (without a lock).
 * @method
 * @private
 * @param {Peer} peer
 * @param {InvPacket} packet
 */

Pool.prototype._handleInv = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(peer, packet) {
    var items, blocks, txs, unknown, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, item;

    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            items = packet.items;

            if (!(items.length > 50000)) {
              _context29.next = 4;
              break;
            }

            peer.increaseBan(100);
            return _context29.abrupt('return');

          case 4:
            blocks = [];
            txs = [];
            unknown = -1;
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context29.prev = 10;
            _iterator6 = (0, _getIterator3.default)(items);

          case 12:
            if (_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done) {
              _context29.next = 27;
              break;
            }

            item = _step6.value;
            _context29.t0 = item.type;
            _context29.next = _context29.t0 === invTypes.BLOCK ? 17 : _context29.t0 === invTypes.TX ? 19 : 21;
            break;

          case 17:
            blocks.push(item.hash);
            return _context29.abrupt('break', 23);

          case 19:
            txs.push(item.hash);
            return _context29.abrupt('break', 23);

          case 21:
            unknown = item.type;
            return _context29.abrupt('continue', 24);

          case 23:
            peer.invFilter.add(item.hash, 'hex');

          case 24:
            _iteratorNormalCompletion6 = true;
            _context29.next = 12;
            break;

          case 27:
            _context29.next = 33;
            break;

          case 29:
            _context29.prev = 29;
            _context29.t1 = _context29['catch'](10);
            _didIteratorError6 = true;
            _iteratorError6 = _context29.t1;

          case 33:
            _context29.prev = 33;
            _context29.prev = 34;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 36:
            _context29.prev = 36;

            if (!_didIteratorError6) {
              _context29.next = 39;
              break;
            }

            throw _iteratorError6;

          case 39:
            return _context29.finish(36);

          case 40:
            return _context29.finish(33);

          case 41:

            this.logger.spam('Received inv packet with %d items: blocks=%d txs=%d (%s).', items.length, blocks.length, txs.length, peer.hostname());

            if (unknown !== -1) {
              this.logger.warning('Peer sent an unknown inv type: %d (%s).', unknown, peer.hostname());
            }

            if (!(blocks.length > 0)) {
              _context29.next = 46;
              break;
            }

            _context29.next = 46;
            return this.handleBlockInv(peer, blocks);

          case 46:
            if (!(txs.length > 0)) {
              _context29.next = 49;
              break;
            }

            _context29.next = 49;
            return this.handleTXInv(peer, txs);

          case 49:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this, [[10, 29, 33, 41], [34,, 36, 40]]);
  }));

  function _handleInv(_x30, _x31) {
    return _ref29.apply(this, arguments);
  }

  return _handleInv;
}();

/**
 * Handle `inv` packet from peer (containing only BLOCK types).
 * @method
 * @private
 * @param {Peer} peer
 * @param {Hash[]} hashes
 * @returns {Promise}
 */

Pool.prototype.handleBlockInv = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(peer, hashes) {
    var hash, items, exists, i, _hash, height;

    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            assert(hashes.length > 0);

            if (this.syncing) {
              _context30.next = 3;
              break;
            }

            return _context30.abrupt('return');

          case 3:

            // Always keep track of the peer's best hash.
            if (!peer.loader || this.chain.synced) {
              hash = hashes[hashes.length - 1];

              peer.bestHash = hash;
            }

            // Ignore for now if we're still syncing

            if (!(!this.chain.synced && !peer.loader)) {
              _context30.next = 6;
              break;
            }

            return _context30.abrupt('return');

          case 6:
            if (!(this.options.hasWitness() && !peer.hasWitness())) {
              _context30.next = 8;
              break;
            }

            return _context30.abrupt('return');

          case 8:
            if (!this.checkpoints) {
              _context30.next = 10;
              break;
            }

            return _context30.abrupt('return');

          case 10:

            this.logger.debug('Received %s block hashes from peer (%s).', hashes.length, peer.hostname());

            items = [];
            exists = null;
            i = 0;

          case 14:
            if (!(i < hashes.length)) {
              _context30.next = 34;
              break;
            }

            _hash = hashes[i];

            // Resolve orphan chain.

            if (!this.chain.hasOrphan(_hash)) {
              _context30.next = 21;
              break;
            }

            this.logger.debug('Received known orphan hash (%s).', peer.hostname());
            _context30.next = 20;
            return this.resolveOrphan(peer, _hash);

          case 20:
            return _context30.abrupt('continue', 31);

          case 21:
            _context30.next = 23;
            return this.hasBlock(_hash);

          case 23:
            if (_context30.sent) {
              _context30.next = 26;
              break;
            }

            items.push(_hash);
            return _context30.abrupt('continue', 31);

          case 26:

            exists = _hash;

            // Normally we request the hashContinue.
            // In the odd case where we already have
            // it, we can do one of two things: either
            // force re-downloading of the block to
            // continue the sync, or do a getblocks
            // from the last hash (this will reset
            // the hashContinue on the remote node).

            if (!(i === hashes.length - 1)) {
              _context30.next = 31;
              break;
            }

            this.logger.debug('Received existing hash (%s).', peer.hostname());
            _context30.next = 31;
            return this.getBlocks(peer, _hash);

          case 31:
            i++;
            _context30.next = 14;
            break;

          case 34:
            if (!(exists && this.chain.synced)) {
              _context30.next = 39;
              break;
            }

            _context30.next = 37;
            return this.chain.getHeight(exists);

          case 37:
            height = _context30.sent;

            if (height !== -1) peer.bestHeight = height;

          case 39:

            this.getBlock(peer, items);

          case 40:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this);
  }));

  function handleBlockInv(_x32, _x33) {
    return _ref30.apply(this, arguments);
  }

  return handleBlockInv;
}();

/**
 * Handle peer inv packet (txs).
 * @method
 * @private
 * @param {Peer} peer
 * @param {Hash[]} hashes
 */

Pool.prototype.handleTXInv = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(peer, hashes) {
    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            assert(hashes.length > 0);

            if (!(this.syncing && !this.chain.synced)) {
              _context31.next = 3;
              break;
            }

            return _context31.abrupt('return');

          case 3:

            this.ensureTX(peer, hashes);

          case 4:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this);
  }));

  function handleTXInv(_x34, _x35) {
    return _ref31.apply(this, arguments);
  }

  return handleTXInv;
}();

/**
 * Handle `getdata` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {GetDataPacket} packet
 */

Pool.prototype.handleGetData = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(peer, packet) {
    var items, notFound, txs, blocks, compact, unknown, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, item, tx, result, block, merkle, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, _tx, height, _result, _block2;

    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            items = packet.items;

            if (!(items.length > 50000)) {
              _context32.next = 6;
              break;
            }

            this.logger.warning('Peer sent inv with >50k items (%s).', peer.hostname());
            peer.increaseBan(100);
            peer.destroy();
            return _context32.abrupt('return');

          case 6:
            notFound = [];
            txs = 0;
            blocks = 0;
            compact = 0;
            unknown = -1;
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context32.prev = 14;
            _iterator7 = (0, _getIterator3.default)(items);

          case 16:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context32.next = 110;
              break;
            }

            item = _step7.value;

            if (!item.isTX()) {
              _context32.next = 32;
              break;
            }

            _context32.next = 21;
            return this.getItem(peer, item);

          case 21:
            tx = _context32.sent;

            if (tx) {
              _context32.next = 25;
              break;
            }

            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 25:
            if (!tx.isCoinbase()) {
              _context32.next = 29;
              break;
            }

            notFound.push(item);
            this.logger.warning('Failsafe: tried to relay a coinbase.');
            return _context32.abrupt('continue', 107);

          case 29:

            peer.send(new packets.TXPacket(tx, item.hasWitness()));

            txs++;

            return _context32.abrupt('continue', 107);

          case 32:
            _context32.t0 = item.type;
            _context32.next = _context32.t0 === invTypes.BLOCK ? 35 : _context32.t0 === invTypes.WITNESS_BLOCK ? 35 : _context32.t0 === invTypes.FILTERED_BLOCK ? 43 : _context32.t0 === invTypes.WITNESS_FILTERED_BLOCK ? 43 : _context32.t0 === invTypes.CMPCT_BLOCK ? 79 : 101;
            break;

          case 35:
            _context32.next = 37;
            return this.sendBlock(peer, item, item.hasWitness());

          case 37:
            result = _context32.sent;

            if (result) {
              _context32.next = 41;
              break;
            }

            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 41:
            blocks++;
            return _context32.abrupt('break', 104);

          case 43:
            if (this.options.bip37) {
              _context32.next = 47;
              break;
            }

            this.logger.debug('Peer requested a merkleblock without bip37 enabled (%s).', peer.hostname());
            peer.destroy();
            return _context32.abrupt('return');

          case 47:
            if (peer.spvFilter) {
              _context32.next = 50;
              break;
            }

            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 50:
            _context32.next = 52;
            return this.getItem(peer, item);

          case 52:
            block = _context32.sent;

            if (block) {
              _context32.next = 56;
              break;
            }

            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 56:
            merkle = block.toMerkle(peer.spvFilter);


            peer.send(new packets.MerkleBlockPacket(merkle));

            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context32.prev = 61;
            for (_iterator8 = (0, _getIterator3.default)(merkle.txs); !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
              _tx = _step8.value;

              peer.send(new packets.TXPacket(_tx, item.hasWitness()));
              txs++;
            }

            _context32.next = 69;
            break;

          case 65:
            _context32.prev = 65;
            _context32.t1 = _context32['catch'](61);
            _didIteratorError8 = true;
            _iteratorError8 = _context32.t1;

          case 69:
            _context32.prev = 69;
            _context32.prev = 70;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 72:
            _context32.prev = 72;

            if (!_didIteratorError8) {
              _context32.next = 75;
              break;
            }

            throw _iteratorError8;

          case 75:
            return _context32.finish(72);

          case 76:
            return _context32.finish(69);

          case 77:
            blocks++;

            return _context32.abrupt('break', 104);

          case 79:
            _context32.next = 81;
            return this.chain.getHeight(item.hash);

          case 81:
            height = _context32.sent;

            if (!(height < this.chain.tip.height - 10)) {
              _context32.next = 91;
              break;
            }

            _context32.next = 85;
            return this.sendBlock(peer, item, peer.compactWitness);

          case 85:
            _result = _context32.sent;

            if (_result) {
              _context32.next = 89;
              break;
            }

            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 89:
            blocks++;
            return _context32.abrupt('break', 104);

          case 91:
            _context32.next = 93;
            return this.getItem(peer, item);

          case 93:
            _block2 = _context32.sent;

            if (_block2) {
              _context32.next = 97;
              break;
            }

            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 97:

            peer.sendCompactBlock(_block2);

            blocks++;
            compact++;

            return _context32.abrupt('break', 104);

          case 101:
            unknown = item.type;
            notFound.push(item);
            return _context32.abrupt('continue', 107);

          case 104:

            if (item.hash === peer.hashContinue) {
              peer.sendInv([new InvItem(invTypes.BLOCK, this.chain.tip.hash)]);
              peer.hashContinue = null;
            }

            // Wait for the peer to read
            // before we pull more data
            // out of the database.
            _context32.next = 107;
            return peer.drain();

          case 107:
            _iteratorNormalCompletion7 = true;
            _context32.next = 16;
            break;

          case 110:
            _context32.next = 116;
            break;

          case 112:
            _context32.prev = 112;
            _context32.t2 = _context32['catch'](14);
            _didIteratorError7 = true;
            _iteratorError7 = _context32.t2;

          case 116:
            _context32.prev = 116;
            _context32.prev = 117;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 119:
            _context32.prev = 119;

            if (!_didIteratorError7) {
              _context32.next = 122;
              break;
            }

            throw _iteratorError7;

          case 122:
            return _context32.finish(119);

          case 123:
            return _context32.finish(116);

          case 124:

            if (notFound.length > 0) peer.send(new packets.NotFoundPacket(notFound));

            if (txs > 0) {
              this.logger.debug('Served %d txs with getdata (notfound=%d) (%s).', txs, notFound.length, peer.hostname());
            }

            if (blocks > 0) {
              this.logger.debug('Served %d blocks with getdata (notfound=%d, cmpct=%d) (%s).', blocks, notFound.length, compact, peer.hostname());
            }

            if (unknown !== -1) {
              this.logger.warning('Peer sent an unknown getdata type: %s (%d).', unknown, peer.hostname());
            }

          case 128:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this, [[14, 112, 116, 124], [61, 65, 69, 77], [70,, 72, 76], [117,, 119, 123]]);
  }));

  function handleGetData(_x36, _x37) {
    return _ref32.apply(this, arguments);
  }

  return handleGetData;
}();

/**
 * Handle peer notfound packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {NotFoundPacket} packet
 */

Pool.prototype.handleNotFound = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(peer, packet) {
    var items, _iteratorNormalCompletion9, _didIteratorError9, _iteratorError9, _iterator9, _step9, item;

    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            items = packet.items;
            _iteratorNormalCompletion9 = true;
            _didIteratorError9 = false;
            _iteratorError9 = undefined;
            _context33.prev = 4;
            _iterator9 = (0, _getIterator3.default)(items);

          case 6:
            if (_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done) {
              _context33.next = 15;
              break;
            }

            item = _step9.value;

            if (this.resolveItem(peer, item)) {
              _context33.next = 12;
              break;
            }

            this.logger.warning('Peer sent notfound for unrequested item: %s (%s).', item.hash, peer.hostname());
            peer.destroy();
            return _context33.abrupt('return');

          case 12:
            _iteratorNormalCompletion9 = true;
            _context33.next = 6;
            break;

          case 15:
            _context33.next = 21;
            break;

          case 17:
            _context33.prev = 17;
            _context33.t0 = _context33['catch'](4);
            _didIteratorError9 = true;
            _iteratorError9 = _context33.t0;

          case 21:
            _context33.prev = 21;
            _context33.prev = 22;

            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }

          case 24:
            _context33.prev = 24;

            if (!_didIteratorError9) {
              _context33.next = 27;
              break;
            }

            throw _iteratorError9;

          case 27:
            return _context33.finish(24);

          case 28:
            return _context33.finish(21);

          case 29:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this, [[4, 17, 21, 29], [22,, 24, 28]]);
  }));

  function handleNotFound(_x38, _x39) {
    return _ref33.apply(this, arguments);
  }

  return handleNotFound;
}();

/**
 * Handle `getblocks` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {GetBlocksPacket} packet
 */

Pool.prototype.handleGetBlocks = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(peer, packet) {
    var hash, blocks;
    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            if (this.chain.synced) {
              _context34.next = 2;
              break;
            }

            return _context34.abrupt('return');

          case 2:
            if (!this.options.selfish) {
              _context34.next = 4;
              break;
            }

            return _context34.abrupt('return');

          case 4:
            if (!this.chain.options.spv) {
              _context34.next = 6;
              break;
            }

            return _context34.abrupt('return');

          case 6:
            if (!this.chain.options.prune) {
              _context34.next = 8;
              break;
            }

            return _context34.abrupt('return');

          case 8:
            _context34.next = 10;
            return this.chain.findLocator(packet.locator);

          case 10:
            hash = _context34.sent;

            if (!hash) {
              _context34.next = 15;
              break;
            }

            _context34.next = 14;
            return this.chain.getNextHash(hash);

          case 14:
            hash = _context34.sent;

          case 15:
            blocks = [];

          case 16:
            if (!hash) {
              _context34.next = 28;
              break;
            }

            blocks.push(new InvItem(invTypes.BLOCK, hash));

            if (!(hash === packet.stop)) {
              _context34.next = 20;
              break;
            }

            return _context34.abrupt('break', 28);

          case 20:
            if (!(blocks.length === 500)) {
              _context34.next = 23;
              break;
            }

            peer.hashContinue = hash;
            return _context34.abrupt('break', 28);

          case 23:
            _context34.next = 25;
            return this.chain.getNextHash(hash);

          case 25:
            hash = _context34.sent;
            _context34.next = 16;
            break;

          case 28:

            peer.sendInv(blocks);

          case 29:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this);
  }));

  function handleGetBlocks(_x40, _x41) {
    return _ref34.apply(this, arguments);
  }

  return handleGetBlocks;
}();

/**
 * Handle `getheaders` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {GetHeadersPacket} packet
 */

Pool.prototype.handleGetHeaders = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(peer, packet) {
    var hash, entry, headers;
    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            if (this.chain.synced) {
              _context35.next = 2;
              break;
            }

            return _context35.abrupt('return');

          case 2:
            if (!this.options.selfish) {
              _context35.next = 4;
              break;
            }

            return _context35.abrupt('return');

          case 4:
            if (!this.chain.options.spv) {
              _context35.next = 6;
              break;
            }

            return _context35.abrupt('return');

          case 6:
            if (!this.chain.options.prune) {
              _context35.next = 8;
              break;
            }

            return _context35.abrupt('return');

          case 8:
            hash = void 0;

            if (!(packet.locator.length > 0)) {
              _context35.next = 19;
              break;
            }

            _context35.next = 12;
            return this.chain.findLocator(packet.locator);

          case 12:
            hash = _context35.sent;

            if (!hash) {
              _context35.next = 17;
              break;
            }

            _context35.next = 16;
            return this.chain.getNextHash(hash);

          case 16:
            hash = _context35.sent;

          case 17:
            _context35.next = 20;
            break;

          case 19:
            hash = packet.stop;

          case 20:
            entry = void 0;

            if (!hash) {
              _context35.next = 25;
              break;
            }

            _context35.next = 24;
            return this.chain.getEntry(hash);

          case 24:
            entry = _context35.sent;

          case 25:
            headers = [];

          case 26:
            if (!entry) {
              _context35.next = 37;
              break;
            }

            headers.push(entry.toHeaders());

            if (!(entry.hash === packet.stop)) {
              _context35.next = 30;
              break;
            }

            return _context35.abrupt('break', 37);

          case 30:
            if (!(headers.length === 2000)) {
              _context35.next = 32;
              break;
            }

            return _context35.abrupt('break', 37);

          case 32:
            _context35.next = 34;
            return this.chain.getNext(entry);

          case 34:
            entry = _context35.sent;
            _context35.next = 26;
            break;

          case 37:

            peer.sendHeaders(headers);

          case 38:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this);
  }));

  function handleGetHeaders(_x42, _x43) {
    return _ref35.apply(this, arguments);
  }

  return handleGetHeaders;
}();

/**
 * Handle `headers` packet from a given peer.
 * @method
 * @private
 * @param {Peer} peer
 * @param {HeadersPacket} packet
 * @returns {Promise}
 */

Pool.prototype.handleHeaders = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(peer, packet) {
    var unlock;
    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            _context36.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context36.sent;
            _context36.prev = 3;
            _context36.next = 6;
            return this._handleHeaders(peer, packet);

          case 6:
            return _context36.abrupt('return', _context36.sent);

          case 7:
            _context36.prev = 7;

            unlock();
            return _context36.finish(7);

          case 10:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this, [[3,, 7, 10]]);
  }));

  function handleHeaders(_x44, _x45) {
    return _ref36.apply(this, arguments);
  }

  return handleHeaders;
}();

/**
 * Handle `headers` packet from
 * a given peer without a lock.
 * @method
 * @private
 * @param {Peer} peer
 * @param {HeadersPacket} packet
 * @returns {Promise}
 */

Pool.prototype._handleHeaders = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(peer, packet) {
    var headers, checkpoint, node, _iteratorNormalCompletion10, _didIteratorError10, _iteratorError10, _iterator10, _step10, header, last, hash, height;

    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            headers = packet.items;

            if (this.checkpoints) {
              _context37.next = 3;
              break;
            }

            return _context37.abrupt('return');

          case 3:
            if (this.syncing) {
              _context37.next = 5;
              break;
            }

            return _context37.abrupt('return');

          case 5:
            if (peer.loader) {
              _context37.next = 7;
              break;
            }

            return _context37.abrupt('return');

          case 7:
            if (!(headers.length === 0)) {
              _context37.next = 9;
              break;
            }

            return _context37.abrupt('return');

          case 9:
            if (!(headers.length > 2000)) {
              _context37.next = 12;
              break;
            }

            peer.increaseBan(100);
            return _context37.abrupt('return');

          case 12:

            assert(this.headerChain.size > 0);

            checkpoint = false;
            node = null;
            _iteratorNormalCompletion10 = true;
            _didIteratorError10 = false;
            _iteratorError10 = undefined;
            _context37.prev = 18;
            _iterator10 = (0, _getIterator3.default)(headers);

          case 20:
            if (_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done) {
              _context37.next = 46;
              break;
            }

            header = _step10.value;
            last = this.headerChain.tail;
            hash = header.hash('hex');
            height = last.height + 1;

            if (header.verify()) {
              _context37.next = 30;
              break;
            }

            this.logger.warning('Peer sent an invalid header (%s).', peer.hostname());
            peer.increaseBan(100);
            peer.destroy();
            return _context37.abrupt('return');

          case 30:
            if (!(header.prevBlock !== last.hash)) {
              _context37.next = 34;
              break;
            }

            this.logger.warning('Peer sent a bad header chain (%s).', peer.hostname());
            peer.destroy();
            return _context37.abrupt('return');

          case 34:

            node = new HeaderEntry(hash, height);

            if (!(node.height === this.headerTip.height)) {
              _context37.next = 41;
              break;
            }

            if (!(node.hash !== this.headerTip.hash)) {
              _context37.next = 40;
              break;
            }

            this.logger.warning('Peer sent an invalid checkpoint (%s).', peer.hostname());
            peer.destroy();
            return _context37.abrupt('return');

          case 40:
            checkpoint = true;

          case 41:

            if (!this.headerNext) this.headerNext = node;

            this.headerChain.push(node);

          case 43:
            _iteratorNormalCompletion10 = true;
            _context37.next = 20;
            break;

          case 46:
            _context37.next = 52;
            break;

          case 48:
            _context37.prev = 48;
            _context37.t0 = _context37['catch'](18);
            _didIteratorError10 = true;
            _iteratorError10 = _context37.t0;

          case 52:
            _context37.prev = 52;
            _context37.prev = 53;

            if (!_iteratorNormalCompletion10 && _iterator10.return) {
              _iterator10.return();
            }

          case 55:
            _context37.prev = 55;

            if (!_didIteratorError10) {
              _context37.next = 58;
              break;
            }

            throw _iteratorError10;

          case 58:
            return _context37.finish(55);

          case 59:
            return _context37.finish(52);

          case 60:

            this.logger.debug('Received %s headers from peer (%s).', headers.length, peer.hostname());

            // If we received a valid header
            // chain, consider this a "block".
            peer.blockTime = util.ms();

            // Request the blocks we just added.

            if (!checkpoint) {
              _context37.next = 66;
              break;
            }

            this.headerChain.shift();
            this.resolveHeaders(peer);
            return _context37.abrupt('return');

          case 66:

            // Request more headers.
            peer.sendGetHeaders([node.hash], this.headerTip.hash);

          case 67:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this, [[18, 48, 52, 60], [53,, 55, 59]]);
  }));

  function _handleHeaders(_x46, _x47) {
    return _ref37.apply(this, arguments);
  }

  return _handleHeaders;
}();

/**
 * Handle `sendheaders` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {SendHeadersPacket} packet
 * @returns {Promise}
 */

Pool.prototype.handleSendHeaders = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(peer, packet) {
    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this);
  }));

  function handleSendHeaders(_x48, _x49) {
    return _ref38.apply(this, arguments);
  }

  return handleSendHeaders;
}();

/**
 * Handle `block` packet. Attempt to add to chain.
 * @method
 * @private
 * @param {Peer} peer
 * @param {BlockPacket} packet
 * @returns {Promise}
 */

Pool.prototype.handleBlock = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(peer, packet) {
    var flags;
    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            flags = chainCommon.flags.DEFAULT_FLAGS;

            if (!this.options.spv) {
              _context39.next = 4;
              break;
            }

            this.logger.warning('Peer sent unsolicited block (%s).', peer.hostname());
            return _context39.abrupt('return');

          case 4:
            _context39.next = 6;
            return this.addBlock(peer, packet.block, flags);

          case 6:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this);
  }));

  function handleBlock(_x50, _x51) {
    return _ref39.apply(this, arguments);
  }

  return handleBlock;
}();

/**
 * Attempt to add block to chain.
 * @method
 * @private
 * @param {Peer} peer
 * @param {Block} block
 * @returns {Promise}
 */

Pool.prototype.addBlock = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(peer, block, flags) {
    var hash, unlock;
    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            hash = block.hash('hex');
            _context40.next = 3;
            return this.locker.lock(hash);

          case 3:
            unlock = _context40.sent;
            _context40.prev = 4;
            _context40.next = 7;
            return this._addBlock(peer, block, flags);

          case 7:
            return _context40.abrupt('return', _context40.sent);

          case 8:
            _context40.prev = 8;

            unlock();
            return _context40.finish(8);

          case 11:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this, [[4,, 8, 11]]);
  }));

  function addBlock(_x52, _x53, _x54) {
    return _ref40.apply(this, arguments);
  }

  return addBlock;
}();

/**
 * Attempt to add block to chain (without a lock).
 * @method
 * @private
 * @param {Peer} peer
 * @param {Block} block
 * @returns {Promise}
 */

Pool.prototype._addBlock = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(peer, block, flags) {
    var hash, entry, height;
    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            if (this.syncing) {
              _context41.next = 2;
              break;
            }

            return _context41.abrupt('return');

          case 2:
            hash = block.hash('hex');

            if (this.resolveBlock(peer, hash)) {
              _context41.next = 7;
              break;
            }

            this.logger.warning('Received unrequested block: %s (%s).', block.rhash(), peer.hostname());
            peer.destroy();
            return _context41.abrupt('return');

          case 7:

            peer.blockTime = util.ms();

            entry = void 0;
            _context41.prev = 9;
            _context41.next = 12;
            return this.chain.add(block, flags, peer.id);

          case 12:
            entry = _context41.sent;
            _context41.next = 22;
            break;

          case 15:
            _context41.prev = 15;
            _context41.t0 = _context41['catch'](9);

            if (!(_context41.t0.type === 'VerifyError')) {
              _context41.next = 21;
              break;
            }

            peer.reject('block', _context41.t0);
            this.logger.warning(_context41.t0);
            return _context41.abrupt('return');

          case 21:
            throw _context41.t0;

          case 22:
            if (entry) {
              _context41.next = 32;
              break;
            }

            if (!this.checkpoints) {
              _context41.next = 26;
              break;
            }

            this.logger.warning('Peer sent orphan block with getheaders (%s).', peer.hostname());
            return _context41.abrupt('return');

          case 26:

            // During a getblocks sync, peers send
            // their best tip frequently. We can grab
            // the height commitment from the coinbase.
            height = block.getCoinbaseHeight();


            if (height !== -1) {
              peer.bestHash = hash;
              peer.bestHeight = height;
              this.resolveHeight(hash, height);
            }

            this.logger.debug('Peer sent an orphan block. Resolving.');

            _context41.next = 31;
            return this.resolveOrphan(peer, hash);

          case 31:
            return _context41.abrupt('return');

          case 32:

            if (this.chain.synced) {
              peer.bestHash = entry.hash;
              peer.bestHeight = entry.height;
              this.resolveHeight(entry.hash, entry.height);
            }

            this.logStatus(block);

            _context41.next = 36;
            return this.resolveChain(peer, hash);

          case 36:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this, [[9, 15]]);
  }));

  function _addBlock(_x55, _x56, _x57) {
    return _ref41.apply(this, arguments);
  }

  return _addBlock;
}();

/**
 * Resolve header chain.
 * @method
 * @private
 * @param {Peer} peer
 * @param {Hash} hash
 * @returns {Promise}
 */

Pool.prototype.resolveChain = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(peer, hash) {
    var node;
    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            if (this.checkpoints) {
              _context42.next = 2;
              break;
            }

            return _context42.abrupt('return');

          case 2:
            if (peer.loader) {
              _context42.next = 4;
              break;
            }

            return _context42.abrupt('return');

          case 4:
            if (!peer.destroyed) {
              _context42.next = 6;
              break;
            }

            throw new Error('Peer was destroyed (header chain resolution).');

          case 6:
            node = this.headerChain.head;


            assert(node);

            if (!(hash !== node.hash)) {
              _context42.next = 12;
              break;
            }

            this.logger.warning('Header hash mismatch %s != %s (%s).', util.revHex(hash), util.revHex(node.hash), peer.hostname());

            peer.destroy();

            return _context42.abrupt('return');

          case 12:
            if (!(node.height < this.network.lastCheckpoint)) {
              _context42.next = 21;
              break;
            }

            if (!(node.height === this.headerTip.height)) {
              _context42.next = 18;
              break;
            }

            this.logger.info('Received checkpoint %s (%d).', util.revHex(node.hash), node.height);

            this.headerTip = this.getNextTip(node.height);

            peer.sendGetHeaders([hash], this.headerTip.hash);

            return _context42.abrupt('return');

          case 18:

            this.headerChain.shift();
            this.resolveHeaders(peer);

            return _context42.abrupt('return');

          case 21:

            this.logger.info('Switching to getblocks (%s).', peer.hostname());

            _context42.next = 24;
            return this.switchSync(peer, hash);

          case 24:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this);
  }));

  function resolveChain(_x58, _x59) {
    return _ref42.apply(this, arguments);
  }

  return resolveChain;
}();

/**
 * Switch to getblocks.
 * @method
 * @private
 * @param {Peer} peer
 * @param {Hash} hash
 * @returns {Promise}
 */

Pool.prototype.switchSync = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(peer, hash) {
    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            assert(this.checkpoints);

            this.checkpoints = false;
            this.headerTip = null;
            this.headerChain.reset();
            this.headerNext = null;

            _context43.next = 7;
            return this.getBlocks(peer, hash);

          case 7:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this);
  }));

  function switchSync(_x60, _x61) {
    return _ref43.apply(this, arguments);
  }

  return switchSync;
}();

/**
 * Handle bad orphan.
 * @method
 * @private
 * @param {String} msg
 * @param {VerifyError} err
 * @param {Number} id
 */

Pool.prototype.handleBadOrphan = function handleBadOrphan(msg, err, id) {
  var peer = this.peers.find(id);

  if (!peer) {
    this.logger.warning('Could not find offending peer for orphan: %s (%d).', util.revHex(err.hash), id);
    return;
  }

  this.logger.debug('Punishing peer for sending a bad orphan (%s).', peer.hostname());

  // Punish the original peer who sent this.
  peer.reject(msg, err);
};

/**
 * Log sync status.
 * @private
 * @param {Block} block
 */

Pool.prototype.logStatus = function logStatus(block) {
  if (this.chain.height % 20 === 0) {
    this.logger.debug('Status:' + ' time=%s height=%d progress=%s' + ' orphans=%d active=%d' + ' target=%s peers=%d', util.date(block.time), this.chain.height, (this.chain.getProgress() * 100).toFixed(2) + '%', this.chain.orphanMap.size, this.blockMap.size, block.bits, this.peers.size());
  }

  if (this.chain.height % 2000 === 0) {
    this.logger.info('Received 2000 more blocks (height=%d, hash=%s).', this.chain.height, block.rhash());
  }
};

/**
 * Handle a transaction. Attempt to add to mempool.
 * @method
 * @private
 * @param {Peer} peer
 * @param {TXPacket} packet
 * @returns {Promise}
 */

Pool.prototype.handleTX = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44(peer, packet) {
    var hash, unlock;
    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            hash = packet.tx.hash('hex');
            _context44.next = 3;
            return this.locker.lock(hash);

          case 3:
            unlock = _context44.sent;
            _context44.prev = 4;
            _context44.next = 7;
            return this._handleTX(peer, packet);

          case 7:
            return _context44.abrupt('return', _context44.sent);

          case 8:
            _context44.prev = 8;

            unlock();
            return _context44.finish(8);

          case 11:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this, [[4,, 8, 11]]);
  }));

  function handleTX(_x62, _x63) {
    return _ref44.apply(this, arguments);
  }

  return handleTX;
}();

/**
 * Handle a transaction. Attempt to add to mempool (without a lock).
 * @method
 * @private
 * @param {Peer} peer
 * @param {TXPacket} packet
 * @returns {Promise}
 */

Pool.prototype._handleTX = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(peer, packet) {
    var tx, hash, flags, block, missing;
    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            tx = packet.tx;
            hash = tx.hash('hex');
            flags = chainCommon.flags.VERIFY_NONE;
            block = peer.merkleBlock;

            if (!block) {
              _context45.next = 22;
              break;
            }

            assert(peer.merkleMatches > 0);
            assert(peer.merkleMap);

            if (!block.hasTX(hash)) {
              _context45.next = 22;
              break;
            }

            if (!peer.merkleMap.has(hash)) {
              _context45.next = 12;
              break;
            }

            this.logger.warning('Peer sent duplicate merkle tx: %s (%s).', tx.txid(), peer.hostname());
            peer.increaseBan(100);
            return _context45.abrupt('return');

          case 12:

            peer.merkleMap.add(hash);

            block.txs.push(tx);

            if (!(--peer.merkleMatches === 0)) {
              _context45.next = 21;
              break;
            }

            peer.merkleBlock = null;
            peer.merkleTime = -1;
            peer.merkleMatches = 0;
            peer.merkleMap = null;
            _context45.next = 21;
            return this._addBlock(peer, block, flags);

          case 21:
            return _context45.abrupt('return');

          case 22:
            if (this.resolveTX(peer, hash)) {
              _context45.next = 26;
              break;
            }

            this.logger.warning('Peer sent unrequested tx: %s (%s).', tx.txid(), peer.hostname());
            peer.destroy();
            return _context45.abrupt('return');

          case 26:
            if (this.mempool) {
              _context45.next = 29;
              break;
            }

            this.emit('tx', tx);
            return _context45.abrupt('return');

          case 29:
            missing = void 0;
            _context45.prev = 30;
            _context45.next = 33;
            return this.mempool.addTX(tx, peer.id);

          case 33:
            missing = _context45.sent;
            _context45.next = 43;
            break;

          case 36:
            _context45.prev = 36;
            _context45.t0 = _context45['catch'](30);

            if (!(_context45.t0.type === 'VerifyError')) {
              _context45.next = 42;
              break;
            }

            peer.reject('tx', _context45.t0);
            this.logger.info(_context45.t0);
            return _context45.abrupt('return');

          case 42:
            throw _context45.t0;

          case 43:

            if (missing && missing.length > 0) {
              this.logger.debug('Requesting %d missing transactions (%s).', missing.length, peer.hostname());

              this.ensureTX(peer, missing);
            }

          case 44:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this, [[30, 36]]);
  }));

  function _handleTX(_x64, _x65) {
    return _ref45.apply(this, arguments);
  }

  return _handleTX;
}();

/**
 * Handle peer reject event.
 * @method
 * @private
 * @param {Peer} peer
 * @param {RejectPacket} packet
 */

Pool.prototype.handleReject = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(peer, packet) {
    var entry;
    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            this.logger.warning('Received reject (%s): msg=%s code=%s reason=%s hash=%s.', peer.hostname(), packet.message, packet.getCode(), packet.reason, packet.rhash());

            if (packet.hash) {
              _context46.next = 3;
              break;
            }

            return _context46.abrupt('return');

          case 3:
            entry = this.invMap.get(packet.hash);

            if (entry) {
              _context46.next = 6;
              break;
            }

            return _context46.abrupt('return');

          case 6:

            entry.handleReject(peer);

          case 7:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this);
  }));

  function handleReject(_x66, _x67) {
    return _ref46.apply(this, arguments);
  }

  return handleReject;
}();

/**
 * Handle `mempool` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {MempoolPacket} packet
 */

Pool.prototype.handleMempool = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47(peer, packet) {
    var items, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, hash;

    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            if (this.mempool) {
              _context47.next = 2;
              break;
            }

            return _context47.abrupt('return');

          case 2:
            if (this.chain.synced) {
              _context47.next = 4;
              break;
            }

            return _context47.abrupt('return');

          case 4:
            if (!this.options.selfish) {
              _context47.next = 6;
              break;
            }

            return _context47.abrupt('return');

          case 6:
            if (this.options.bip37) {
              _context47.next = 10;
              break;
            }

            this.logger.debug('Peer requested mempool without bip37 enabled (%s).', peer.hostname());
            peer.destroy();
            return _context47.abrupt('return');

          case 10:
            items = [];
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context47.prev = 14;


            for (_iterator11 = (0, _getIterator3.default)(this.mempool.map.keys()); !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
              hash = _step11.value;

              items.push(new InvItem(invTypes.TX, hash));
            }_context47.next = 22;
            break;

          case 18:
            _context47.prev = 18;
            _context47.t0 = _context47['catch'](14);
            _didIteratorError11 = true;
            _iteratorError11 = _context47.t0;

          case 22:
            _context47.prev = 22;
            _context47.prev = 23;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 25:
            _context47.prev = 25;

            if (!_didIteratorError11) {
              _context47.next = 28;
              break;
            }

            throw _iteratorError11;

          case 28:
            return _context47.finish(25);

          case 29:
            return _context47.finish(22);

          case 30:
            this.logger.debug('Sending mempool snapshot (%s).', peer.hostname());

            peer.queueInv(items);

          case 32:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this, [[14, 18, 22, 30], [23,, 25, 29]]);
  }));

  function handleMempool(_x68, _x69) {
    return _ref47.apply(this, arguments);
  }

  return handleMempool;
}();

/**
 * Handle `filterload` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {FilterLoadPacket} packet
 */

Pool.prototype.handleFilterLoad = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48(peer, packet) {
    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this);
  }));

  function handleFilterLoad(_x70, _x71) {
    return _ref48.apply(this, arguments);
  }

  return handleFilterLoad;
}();

/**
 * Handle `filteradd` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {FilterAddPacket} packet
 */

Pool.prototype.handleFilterAdd = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(peer, packet) {
    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this);
  }));

  function handleFilterAdd(_x72, _x73) {
    return _ref49.apply(this, arguments);
  }

  return handleFilterAdd;
}();

/**
 * Handle `filterclear` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {FilterClearPacket} packet
 */

Pool.prototype.handleFilterClear = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(peer, packet) {
    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function handleFilterClear(_x74, _x75) {
    return _ref50.apply(this, arguments);
  }

  return handleFilterClear;
}();

/**
 * Handle `merkleblock` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {MerkleBlockPacket} block
 */

Pool.prototype.handleMerkleBlock = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51(peer, packet) {
    var hash, unlock;
    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            hash = packet.block.hash('hex');
            _context51.next = 3;
            return this.locker.lock(hash);

          case 3:
            unlock = _context51.sent;
            _context51.prev = 4;
            _context51.next = 7;
            return this._handleMerkleBlock(peer, packet);

          case 7:
            return _context51.abrupt('return', _context51.sent);

          case 8:
            _context51.prev = 8;

            unlock();
            return _context51.finish(8);

          case 11:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this, [[4,, 8, 11]]);
  }));

  function handleMerkleBlock(_x76, _x77) {
    return _ref51.apply(this, arguments);
  }

  return handleMerkleBlock;
}();

/**
 * Handle `merkleblock` packet (without a lock).
 * @method
 * @private
 * @param {Peer} peer
 * @param {MerkleBlockPacket} block
 */

Pool.prototype._handleMerkleBlock = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(peer, packet) {
    var block, hash, tree, flags;
    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            if (this.syncing) {
              _context52.next = 2;
              break;
            }

            return _context52.abrupt('return');

          case 2:
            if (this.options.spv) {
              _context52.next = 6;
              break;
            }

            this.logger.warning('Peer sent unsolicited merkleblock (%s).', peer.hostname());
            peer.increaseBan(100);
            return _context52.abrupt('return');

          case 6:
            block = packet.block;
            hash = block.hash('hex');

            if (peer.blockMap.has(hash)) {
              _context52.next = 12;
              break;
            }

            this.logger.warning('Peer sent an unrequested merkleblock (%s).', peer.hostname());
            peer.destroy();
            return _context52.abrupt('return');

          case 12:
            if (!peer.merkleBlock) {
              _context52.next = 16;
              break;
            }

            this.logger.warning('Peer sent a merkleblock prematurely (%s).', peer.hostname());
            peer.increaseBan(100);
            return _context52.abrupt('return');

          case 16:
            if (block.verify()) {
              _context52.next = 20;
              break;
            }

            this.logger.warning('Peer sent an invalid merkleblock (%s).', peer.hostname());
            peer.increaseBan(100);
            return _context52.abrupt('return');

          case 20:
            tree = block.getTree();

            if (!(tree.matches.length === 0)) {
              _context52.next = 26;
              break;
            }

            flags = chainCommon.flags.VERIFY_NONE;
            _context52.next = 25;
            return this._addBlock(peer, block, flags);

          case 25:
            return _context52.abrupt('return');

          case 26:

            peer.merkleBlock = block;
            peer.merkleTime = util.ms();
            peer.merkleMatches = tree.matches.length;
            peer.merkleMap = new _set2.default();

          case 30:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this);
  }));

  function _handleMerkleBlock(_x78, _x79) {
    return _ref52.apply(this, arguments);
  }

  return _handleMerkleBlock;
}();

/**
 * Handle `sendcmpct` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {FeeFilterPacket} packet
 */

Pool.prototype.handleFeeFilter = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(peer, packet) {
    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this);
  }));

  function handleFeeFilter(_x80, _x81) {
    return _ref53.apply(this, arguments);
  }

  return handleFeeFilter;
}();

/**
 * Handle `sendcmpct` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {SendCmpctPacket} packet
 */

Pool.prototype.handleSendCmpct = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee54(peer, packet) {
    return _regenerator2.default.wrap(function _callee54$(_context54) {
      while (1) {
        switch (_context54.prev = _context54.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context54.stop();
        }
      }
    }, _callee54, this);
  }));

  function handleSendCmpct(_x82, _x83) {
    return _ref54.apply(this, arguments);
  }

  return handleSendCmpct;
}();

/**
 * Handle `cmpctblock` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {CompactBlockPacket} packet
 */

Pool.prototype.handleCmpctBlock = function () {
  var _ref55 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee55(peer, packet) {
    var block, hash, witness, result, full, flags;
    return _regenerator2.default.wrap(function _callee55$(_context55) {
      while (1) {
        switch (_context55.prev = _context55.next) {
          case 0:
            block = packet.block;
            hash = block.hash('hex');
            witness = peer.compactWitness;

            if (this.syncing) {
              _context55.next = 5;
              break;
            }

            return _context55.abrupt('return');

          case 5:
            if (this.options.compact) {
              _context55.next = 9;
              break;
            }

            this.logger.info('Peer sent unsolicited cmpctblock (%s).', peer.hostname());
            this.destroy();
            return _context55.abrupt('return');

          case 9:
            if (!(!peer.hasCompactSupport() || !peer.hasCompact())) {
              _context55.next = 13;
              break;
            }

            this.logger.info('Peer sent unsolicited cmpctblock (%s).', peer.hostname());
            this.destroy();
            return _context55.abrupt('return');

          case 13:
            if (!peer.compactBlocks.has(hash)) {
              _context55.next = 16;
              break;
            }

            this.logger.debug('Peer sent us a duplicate compact block (%s).', peer.hostname());
            return _context55.abrupt('return');

          case 16:
            if (!this.compactBlocks.has(hash)) {
              _context55.next = 19;
              break;
            }

            this.logger.debug('Already waiting for compact block %s (%s).', hash, peer.hostname());
            return _context55.abrupt('return');

          case 19:
            if (peer.blockMap.has(hash)) {
              _context55.next = 27;
              break;
            }

            if (!(this.options.blockMode !== 1)) {
              _context55.next = 24;
              break;
            }

            this.logger.warning('Peer sent us an unrequested compact block (%s).', peer.hostname());
            peer.destroy();
            return _context55.abrupt('return');

          case 24:
            peer.blockMap.set(hash, util.ms());
            assert(!this.blockMap.has(hash));
            this.blockMap.add(hash);

          case 27:
            if (this.mempool) {
              _context55.next = 30;
              break;
            }

            this.logger.warning('Requesting compact blocks without a mempool!');
            return _context55.abrupt('return');

          case 30:
            if (block.verify()) {
              _context55.next = 34;
              break;
            }

            this.logger.debug('Peer sent an invalid compact block (%s).', peer.hostname());
            peer.increaseBan(100);
            return _context55.abrupt('return');

          case 34:
            result = void 0;
            _context55.prev = 35;

            result = block.init();
            _context55.next = 44;
            break;

          case 39:
            _context55.prev = 39;
            _context55.t0 = _context55['catch'](35);

            this.logger.debug('Peer sent an invalid compact block (%s).', peer.hostname());
            peer.increaseBan(100);
            return _context55.abrupt('return');

          case 44:
            if (result) {
              _context55.next = 49;
              break;
            }

            this.logger.warning('Siphash collision for %s. Requesting full block (%s).', block.rhash(), peer.hostname());
            peer.getFullBlock(hash);
            peer.increaseBan(10);
            return _context55.abrupt('return');

          case 49:
            full = block.fillMempool(witness, this.mempool);

            if (!full) {
              _context55.next = 56;
              break;
            }

            this.logger.debug('Received full compact block %s (%s).', block.rhash(), peer.hostname());
            flags = chainCommon.flags.VERIFY_BODY;
            _context55.next = 55;
            return this.addBlock(peer, block.toBlock(), flags);

          case 55:
            return _context55.abrupt('return');

          case 56:
            if (!(this.options.blockMode === 1)) {
              _context55.next = 61;
              break;
            }

            if (!(peer.compactBlocks.size >= 15)) {
              _context55.next = 61;
              break;
            }

            this.logger.warning('Compact block DoS attempt (%s).', peer.hostname());
            peer.destroy();
            return _context55.abrupt('return');

          case 61:

            block.now = util.ms();

            assert(!peer.compactBlocks.has(hash));
            peer.compactBlocks.set(hash, block);

            this.compactBlocks.add(hash);

            this.logger.debug('Received non-full compact block %s tx=%d/%d (%s).', block.rhash(), block.count, block.totalTX, peer.hostname());

            peer.send(new packets.GetBlockTxnPacket(block.toRequest()));

          case 67:
          case 'end':
            return _context55.stop();
        }
      }
    }, _callee55, this, [[35, 39]]);
  }));

  function handleCmpctBlock(_x84, _x85) {
    return _ref55.apply(this, arguments);
  }

  return handleCmpctBlock;
}();

/**
 * Handle `getblocktxn` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {GetBlockTxnPacket} packet
 */

Pool.prototype.handleGetBlockTxn = function () {
  var _ref56 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee56(peer, packet) {
    var req, item, block, height, res;
    return _regenerator2.default.wrap(function _callee56$(_context56) {
      while (1) {
        switch (_context56.prev = _context56.next) {
          case 0:
            req = packet.request;

            if (!this.chain.options.spv) {
              _context56.next = 3;
              break;
            }

            return _context56.abrupt('return');

          case 3:
            if (!this.chain.options.prune) {
              _context56.next = 5;
              break;
            }

            return _context56.abrupt('return');

          case 5:
            if (!this.options.selfish) {
              _context56.next = 7;
              break;
            }

            return _context56.abrupt('return');

          case 7:
            item = new InvItem(invTypes.BLOCK, req.hash);
            _context56.next = 10;
            return this.getItem(peer, item);

          case 10:
            block = _context56.sent;

            if (block) {
              _context56.next = 15;
              break;
            }

            this.logger.debug('Peer sent getblocktxn for non-existent block (%s).', peer.hostname());
            peer.increaseBan(100);
            return _context56.abrupt('return');

          case 15:
            _context56.next = 17;
            return this.chain.getHeight(req.hash);

          case 17:
            height = _context56.sent;

            if (!(height < this.chain.tip.height - 15)) {
              _context56.next = 21;
              break;
            }

            this.logger.debug('Peer sent a getblocktxn for a block > 15 deep (%s)', peer.hostname());
            return _context56.abrupt('return');

          case 21:

            this.logger.debug('Sending blocktxn for %s to peer (%s).', block.rhash(), peer.hostname());

            res = BIP152.TXResponse.fromBlock(block, req);


            peer.send(new packets.BlockTxnPacket(res, peer.compactWitness));

          case 24:
          case 'end':
            return _context56.stop();
        }
      }
    }, _callee56, this);
  }));

  function handleGetBlockTxn(_x86, _x87) {
    return _ref56.apply(this, arguments);
  }

  return handleGetBlockTxn;
}();

/**
 * Handle `blocktxn` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {BlockTxnPacket} packet
 */

Pool.prototype.handleBlockTxn = function () {
  var _ref57 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee57(peer, packet) {
    var res, block, flags;
    return _regenerator2.default.wrap(function _callee57$(_context57) {
      while (1) {
        switch (_context57.prev = _context57.next) {
          case 0:
            res = packet.response;
            block = peer.compactBlocks.get(res.hash);
            flags = chainCommon.flags.VERIFY_BODY;

            if (block) {
              _context57.next = 6;
              break;
            }

            this.logger.debug('Peer sent unsolicited blocktxn (%s).', peer.hostname());
            return _context57.abrupt('return');

          case 6:

            peer.compactBlocks.delete(res.hash);

            assert(this.compactBlocks.has(res.hash));
            this.compactBlocks.delete(res.hash);

            if (block.fillMissing(res)) {
              _context57.next = 14;
              break;
            }

            this.logger.warning('Peer sent non-full blocktxn for %s. Requesting full block (%s).', block.rhash(), peer.hostname());
            peer.getFullBlock(res.hash);
            peer.increaseBan(10);
            return _context57.abrupt('return');

          case 14:

            this.logger.debug('Filled compact block %s (%s).', block.rhash(), peer.hostname());

            _context57.next = 17;
            return this.addBlock(peer, block.toBlock(), flags);

          case 17:
          case 'end':
            return _context57.stop();
        }
      }
    }, _callee57, this);
  }));

  function handleBlockTxn(_x88, _x89) {
    return _ref57.apply(this, arguments);
  }

  return handleBlockTxn;
}();

/**
 * Handle `encinit` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {EncinitPacket} packet
 */

Pool.prototype.handleEncinit = function () {
  var _ref58 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee58(peer, packet) {
    return _regenerator2.default.wrap(function _callee58$(_context58) {
      while (1) {
        switch (_context58.prev = _context58.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context58.stop();
        }
      }
    }, _callee58, this);
  }));

  function handleEncinit(_x90, _x91) {
    return _ref58.apply(this, arguments);
  }

  return handleEncinit;
}();

/**
 * Handle `encack` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {EncackPacket} packet
 */

Pool.prototype.handleEncack = function () {
  var _ref59 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee59(peer, packet) {
    return _regenerator2.default.wrap(function _callee59$(_context59) {
      while (1) {
        switch (_context59.prev = _context59.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context59.stop();
        }
      }
    }, _callee59, this);
  }));

  function handleEncack(_x92, _x93) {
    return _ref59.apply(this, arguments);
  }

  return handleEncack;
}();

/**
 * Handle `authchallenge` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {AuthChallengePacket} packet
 */

Pool.prototype.handleAuthChallenge = function () {
  var _ref60 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee60(peer, packet) {
    return _regenerator2.default.wrap(function _callee60$(_context60) {
      while (1) {
        switch (_context60.prev = _context60.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context60.stop();
        }
      }
    }, _callee60, this);
  }));

  function handleAuthChallenge(_x94, _x95) {
    return _ref60.apply(this, arguments);
  }

  return handleAuthChallenge;
}();

/**
 * Handle `authreply` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {AuthReplyPacket} packet
 */

Pool.prototype.handleAuthReply = function () {
  var _ref61 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee61(peer, packet) {
    return _regenerator2.default.wrap(function _callee61$(_context61) {
      while (1) {
        switch (_context61.prev = _context61.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context61.stop();
        }
      }
    }, _callee61, this);
  }));

  function handleAuthReply(_x96, _x97) {
    return _ref61.apply(this, arguments);
  }

  return handleAuthReply;
}();

/**
 * Handle `authpropose` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {AuthProposePacket} packet
 */

Pool.prototype.handleAuthPropose = function () {
  var _ref62 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee62(peer, packet) {
    return _regenerator2.default.wrap(function _callee62$(_context62) {
      while (1) {
        switch (_context62.prev = _context62.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context62.stop();
        }
      }
    }, _callee62, this);
  }));

  function handleAuthPropose(_x98, _x99) {
    return _ref62.apply(this, arguments);
  }

  return handleAuthPropose;
}();

/**
 * Handle `unknown` packet.
 * @method
 * @private
 * @param {Peer} peer
 * @param {UnknownPacket} packet
 */

Pool.prototype.handleUnknown = function () {
  var _ref63 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee63(peer, packet) {
    return _regenerator2.default.wrap(function _callee63$(_context63) {
      while (1) {
        switch (_context63.prev = _context63.next) {
          case 0:
            this.logger.warning('Unknown packet: %s (%s).', packet.cmd, peer.hostname());

          case 1:
          case 'end':
            return _context63.stop();
        }
      }
    }, _callee63, this);
  }));

  function handleUnknown(_x100, _x101) {
    return _ref63.apply(this, arguments);
  }

  return handleUnknown;
}();

/**
 * Create an inbound peer from an existing socket.
 * @private
 * @param {net.Socket} socket
 */

Pool.prototype.addInbound = function addInbound(socket) {
  if (!this.loaded) {
    socket.destroy();
    return;
  }

  var peer = this.createInbound(socket);

  this.logger.info('Added inbound peer (%s).', peer.hostname());

  this.peers.add(peer);
};

/**
 * Allocate a host from the host list.
 * @returns {NetAddress}
 */

Pool.prototype.getHost = function getHost() {
  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = (0, _getIterator3.default)(this.hosts.nodes), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var addr = _step12.value;

      if (this.peers.has(addr.hostname)) continue;

      return addr;
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

  var services = this.options.getRequiredServices();
  var now = this.network.now();

  for (var i = 0; i < 100; i++) {
    var entry = this.hosts.getHost();

    if (!entry) break;

    var _addr = entry.addr;

    if (this.peers.has(_addr.hostname)) continue;

    if (!_addr.isValid()) continue;

    if (!_addr.hasServices(services)) continue;

    if (!this.options.onion && _addr.isOnion()) continue;

    if (i < 30 && now - entry.lastAttempt < 600) continue;

    if (i < 50 && _addr.port !== this.network.port) continue;

    if (i < 95 && this.hosts.isBanned(_addr.host)) continue;

    return entry.addr;
  }

  return null;
};

/**
 * Create an outbound non-loader peer. These primarily
 * exist for transaction relaying.
 * @private
 */

Pool.prototype.addOutbound = function addOutbound() {
  if (!this.loaded) return;

  if (this.peers.outbound >= this.options.maxOutbound) return;

  // Hang back if we don't
  // have a loader peer yet.
  if (!this.peers.load) return;

  var addr = this.getHost();

  if (!addr) return;

  var peer = this.createOutbound(addr);

  this.peers.add(peer);

  this.emit('peer', peer);
};

/**
 * Attempt to refill the pool with peers (no lock).
 * @private
 */

Pool.prototype.fillOutbound = function fillOutbound() {
  var need = this.options.maxOutbound - this.peers.outbound;

  if (!this.peers.load) this.addLoader();

  if (need <= 0) return;

  this.logger.debug('Refilling peers (%d/%d).', this.peers.outbound, this.options.maxOutbound);

  for (var i = 0; i < need; i++) {
    this.addOutbound();
  }
};

/**
 * Attempt to refill the pool with peers (no lock).
 * @private
 */

Pool.prototype.refill = function refill() {
  var _this3 = this;

  if (this.pendingRefill != null) return;

  this.pendingRefill = setTimeout(function () {
    _this3.pendingRefill = null;
    _this3.fillOutbound();
  }, 3000);
};

/**
 * Remove a peer from any list. Drop all load requests.
 * @private
 * @param {Peer} peer
 */

Pool.prototype.removePeer = function removePeer(peer) {
  this.peers.remove(peer);

  var _iteratorNormalCompletion13 = true;
  var _didIteratorError13 = false;
  var _iteratorError13 = undefined;

  try {
    for (var _iterator13 = (0, _getIterator3.default)(peer.blockMap.keys()), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
      var hash = _step13.value;

      this.resolveBlock(peer, hash);
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

  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = (0, _getIterator3.default)(peer.txMap.keys()), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var _hash2 = _step14.value;

      this.resolveTX(peer, _hash2);
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

  var _iteratorNormalCompletion15 = true;
  var _didIteratorError15 = false;
  var _iteratorError15 = undefined;

  try {
    for (var _iterator15 = (0, _getIterator3.default)(peer.compactBlocks.keys()), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
      var _hash3 = _step15.value;

      assert(this.compactBlocks.has(_hash3));
      this.compactBlocks.delete(_hash3);
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

  peer.compactBlocks.clear();
};

/**
 * Ban peer.
 * @param {NetAddress} addr
 */

Pool.prototype.ban = function ban(addr) {
  var peer = this.peers.get(addr.hostname);

  this.logger.debug('Banning peer (%s).', addr.hostname);

  this.hosts.ban(addr.host);
  this.hosts.remove(addr.hostname);

  if (peer) peer.destroy();
};

/**
 * Unban peer.
 * @param {NetAddress} addr
 */

Pool.prototype.unban = function unban(addr) {
  this.hosts.unban(addr.host);
};

/**
 * Set the spv filter.
 * @param {Bloom} filter
 * @param {String?} enc
 */

Pool.prototype.setFilter = function setFilter(filter) {
  if (!this.options.spv) return;

  this.spvFilter = filter;
  this.queueFilterLoad();
};

/**
 * Watch a an address hash (filterload, SPV-only).
 * @param {Buffer|Hash} data
 * @param {String?} enc
 */

Pool.prototype.watch = function watch(data, enc) {
  if (!this.options.spv) return;

  this.spvFilter.add(data, enc);
  this.queueFilterLoad();
};

/**
 * Reset the spv filter (filterload, SPV-only).
 */

Pool.prototype.unwatch = function unwatch() {
  if (!this.options.spv) return;

  this.spvFilter.reset();
  this.queueFilterLoad();
};

/**
 * Queue a resend of the bloom filter.
 */

Pool.prototype.queueFilterLoad = function queueFilterLoad() {
  var _this4 = this;

  if (!this.options.spv) return;

  if (this.pendingFilter != null) return;

  this.pendingFilter = setTimeout(function () {
    _this4.pendingFilter = null;
    _this4.sendFilterLoad();
  }, 100);
};

/**
 * Resend the bloom filter to peers.
 */

Pool.prototype.sendFilterLoad = function sendFilterLoad() {
  if (!this.options.spv) return;

  assert(this.spvFilter);

  for (var peer = this.peers.head(); peer; peer = peer.next) {
    peer.sendFilterLoad(this.spvFilter);
  }
};

/**
 * Add an address to the bloom filter (SPV-only).
 * @param {Address|Base58Address} address
 */

Pool.prototype.watchAddress = function watchAddress(address) {
  var hash = Address.getHash(address);
  this.watch(hash);
};

/**
 * Add an outpoint to the bloom filter (SPV-only).
 * @param {Outpoint} outpoint
 */

Pool.prototype.watchOutpoint = function watchOutpoint(outpoint) {
  this.watch(outpoint.toRaw());
};

/**
 * Send `getblocks` to peer after building
 * locator and resolving orphan root.
 * @method
 * @param {Peer} peer
 * @param {Hash} orphan - Orphan hash to resolve.
 * @returns {Promise}
 */

Pool.prototype.resolveOrphan = function () {
  var _ref64 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee64(peer, orphan) {
    var locator, root;
    return _regenerator2.default.wrap(function _callee64$(_context64) {
      while (1) {
        switch (_context64.prev = _context64.next) {
          case 0:
            _context64.next = 2;
            return this.chain.getLocator();

          case 2:
            locator = _context64.sent;
            root = this.chain.getOrphanRoot(orphan);


            assert(root);

            peer.sendGetBlocks(locator, root);

          case 6:
          case 'end':
            return _context64.stop();
        }
      }
    }, _callee64, this);
  }));

  function resolveOrphan(_x102, _x103) {
    return _ref64.apply(this, arguments);
  }

  return resolveOrphan;
}();

/**
 * Send `getheaders` to peer after building locator.
 * @method
 * @param {Peer} peer
 * @param {Hash} tip - Tip to build chain locator from.
 * @param {Hash?} stop
 * @returns {Promise}
 */

Pool.prototype.getHeaders = function () {
  var _ref65 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee65(peer, tip, stop) {
    var locator;
    return _regenerator2.default.wrap(function _callee65$(_context65) {
      while (1) {
        switch (_context65.prev = _context65.next) {
          case 0:
            _context65.next = 2;
            return this.chain.getLocator(tip);

          case 2:
            locator = _context65.sent;

            peer.sendGetHeaders(locator, stop);

          case 4:
          case 'end':
            return _context65.stop();
        }
      }
    }, _callee65, this);
  }));

  function getHeaders(_x104, _x105, _x106) {
    return _ref65.apply(this, arguments);
  }

  return getHeaders;
}();

/**
 * Send `getblocks` to peer after building locator.
 * @method
 * @param {Peer} peer
 * @param {Hash} tip - Tip hash to build chain locator from.
 * @param {Hash?} stop
 * @returns {Promise}
 */

Pool.prototype.getBlocks = function () {
  var _ref66 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee66(peer, tip, stop) {
    var locator;
    return _regenerator2.default.wrap(function _callee66$(_context66) {
      while (1) {
        switch (_context66.prev = _context66.next) {
          case 0:
            _context66.next = 2;
            return this.chain.getLocator(tip);

          case 2:
            locator = _context66.sent;

            peer.sendGetBlocks(locator, stop);

          case 4:
          case 'end':
            return _context66.stop();
        }
      }
    }, _callee66, this);
  }));

  function getBlocks(_x107, _x108, _x109) {
    return _ref66.apply(this, arguments);
  }

  return getBlocks;
}();

/**
 * Queue a `getdata` request to be sent.
 * @param {Peer} peer
 * @param {Hash[]} hashes
 */

Pool.prototype.getBlock = function getBlock(peer, hashes) {
  if (!this.loaded) return;

  if (!peer.handshake) throw new Error('Peer handshake not complete (getdata).');

  if (peer.destroyed) throw new Error('Peer is destroyed (getdata).');

  var now = util.ms();
  var items = [];

  var _iteratorNormalCompletion16 = true;
  var _didIteratorError16 = false;
  var _iteratorError16 = undefined;

  try {
    for (var _iterator16 = (0, _getIterator3.default)(hashes), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
      var hash = _step16.value;

      if (this.blockMap.has(hash)) continue;

      this.blockMap.add(hash);
      peer.blockMap.set(hash, now);

      if (this.chain.synced) now += 100;

      items.push(hash);
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

  if (items.length === 0) return;

  this.logger.debug('Requesting %d/%d blocks from peer with getdata (%s).', items.length, this.blockMap.size, peer.hostname());

  peer.getBlock(items);
};

/**
 * Queue a `getdata` request to be sent.
 * @param {Peer} peer
 * @param {Hash[]} hashes
 */

Pool.prototype.getTX = function getTX(peer, hashes) {
  if (!this.loaded) return;

  if (!peer.handshake) throw new Error('Peer handshake not complete (getdata).');

  if (peer.destroyed) throw new Error('Peer is destroyed (getdata).');

  var now = util.ms();

  var items = [];

  var _iteratorNormalCompletion17 = true;
  var _didIteratorError17 = false;
  var _iteratorError17 = undefined;

  try {
    for (var _iterator17 = (0, _getIterator3.default)(hashes), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
      var hash = _step17.value;

      if (this.txMap.has(hash)) continue;

      this.txMap.add(hash);
      peer.txMap.set(hash, now);

      now += 50;

      items.push(hash);
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

  if (items.length === 0) return;

  this.logger.debug('Requesting %d/%d txs from peer with getdata (%s).', items.length, this.txMap.size, peer.hostname());

  peer.getTX(items);
};

/**
 * Test whether the chain has or has seen an item.
 * @method
 * @param {Hash} hash
 * @returns {Promise} - Returns Boolean.
 */

Pool.prototype.hasBlock = function () {
  var _ref67 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee67(hash) {
    return _regenerator2.default.wrap(function _callee67$(_context67) {
      while (1) {
        switch (_context67.prev = _context67.next) {
          case 0:
            if (!this.locker.has(hash)) {
              _context67.next = 2;
              break;
            }

            return _context67.abrupt('return', true);

          case 2:
            _context67.next = 4;
            return this.chain.has(hash);

          case 4:
            if (!_context67.sent) {
              _context67.next = 6;
              break;
            }

            return _context67.abrupt('return', true);

          case 6:
            return _context67.abrupt('return', false);

          case 7:
          case 'end':
            return _context67.stop();
        }
      }
    }, _callee67, this);
  }));

  function hasBlock(_x110) {
    return _ref67.apply(this, arguments);
  }

  return hasBlock;
}();

/**
 * Test whether the mempool has or has seen an item.
 * @param {Hash} hash
 * @returns {Boolean}
 */

Pool.prototype.hasTX = function hasTX(hash) {
  // Check the lock queue.
  if (this.locker.has(hash)) return true;

  if (!this.mempool) {
    // Check the TX filter if
    // we don't have a mempool.
    if (!this.txFilter.added(hash, 'hex')) return true;
  } else {
    // Check the mempool.
    if (this.mempool.has(hash)) return true;

    // If we recently rejected this item. Ignore.
    if (this.mempool.hasReject(hash)) {
      this.logger.spam('Saw known reject of %s.', util.revHex(hash));
      return true;
    }
  }

  return false;
};

/**
 * Queue a `getdata` request to be sent.
 * Check tx existence before requesting.
 * @param {Peer} peer
 * @param {Hash[]} hashes
 */

Pool.prototype.ensureTX = function ensureTX(peer, hashes) {
  var items = [];

  var _iteratorNormalCompletion18 = true;
  var _didIteratorError18 = false;
  var _iteratorError18 = undefined;

  try {
    for (var _iterator18 = (0, _getIterator3.default)(hashes), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
      var hash = _step18.value;

      if (this.hasTX(hash)) continue;

      items.push(hash);
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

  this.getTX(peer, items);
};

/**
 * Fulfill a requested tx.
 * @param {Peer} peer
 * @param {Hash} hash
 * @returns {Boolean}
 */

Pool.prototype.resolveTX = function resolveTX(peer, hash) {
  if (!peer.txMap.has(hash)) return false;

  peer.txMap.delete(hash);

  assert(this.txMap.has(hash));
  this.txMap.delete(hash);

  return true;
};

/**
 * Fulfill a requested block.
 * @param {Peer} peer
 * @param {Hash} hash
 * @returns {Boolean}
 */

Pool.prototype.resolveBlock = function resolveBlock(peer, hash) {
  if (!peer.blockMap.has(hash)) return false;

  peer.blockMap.delete(hash);

  assert(this.blockMap.has(hash));
  this.blockMap.delete(hash);

  return true;
};

/**
 * Fulfill a requested item.
 * @param {Peer} peer
 * @param {InvItem} item
 * @returns {Boolean}
 */

Pool.prototype.resolveItem = function resolveItem(peer, item) {
  if (item.isBlock()) return this.resolveBlock(peer, item.hash);

  if (item.isTX()) return this.resolveTX(peer, item.hash);

  return false;
};

/**
 * Broadcast a transaction or block.
 * @param {TX|Block} msg
 * @returns {Promise}
 */

Pool.prototype.broadcast = function broadcast(msg) {
  var hash = msg.hash('hex');

  var item = this.invMap.get(hash);

  if (item) {
    item.refresh();
    item.announce();
  } else {
    item = new BroadcastItem(this, msg);
    item.start();
    item.announce();
  }

  return new _promise2.default(function (resolve, reject) {
    item.addJob(resolve, reject);
  });
};

/**
 * Announce a block to all peers.
 * @param {Block} tx
 */

Pool.prototype.announceBlock = function announceBlock(msg) {
  for (var peer = this.peers.head(); peer; peer = peer.next) {
    peer.announceBlock(msg);
  }
};

/**
 * Announce a transaction to all peers.
 * @param {TX} tx
 */

Pool.prototype.announceTX = function announceTX(msg) {
  for (var peer = this.peers.head(); peer; peer = peer.next) {
    peer.announceTX(msg);
  }
};

/**
 * PoolOptions
 * @alias module:net.PoolOptions
 * @constructor
 */

function PoolOptions(options) {
  if (!(this instanceof PoolOptions)) return new PoolOptions(options);

  this.network = Network.primary;
  this.logger = null;
  this.chain = null;
  this.mempool = null;

  this.nonces = new NonceList();

  this.prefix = null;
  this.checkpoints = true;
  this.spv = false;
  this.bip37 = false;
  this.listen = false;
  this.compact = true;
  this.noRelay = false;
  this.host = '0.0.0.0';
  this.port = this.network.port;
  this.publicHost = '0.0.0.0';
  this.publicPort = this.network.port;
  this.maxOutbound = 8;
  this.maxInbound = 8;
  this.createSocket = this._createSocket.bind(this);
  this.createServer = tcp.createServer;
  this.resolve = this._resolve.bind(this);
  this.proxy = null;
  this.onion = false;
  this.upnp = false;
  this.selfish = false;
  this.version = common.PROTOCOL_VERSION;
  this.agent = common.USER_AGENT;
  this.bip151 = false;
  this.bip150 = false;
  this.authPeers = [];
  this.knownPeers = {};
  this.identityKey = secp256k1.generatePrivateKey();
  this.banScore = common.BAN_SCORE;
  this.banTime = common.BAN_TIME;
  this.feeRate = -1;
  this.seeds = this.network.seeds;
  this.nodes = [];
  this.invTimeout = 60000;
  this.blockMode = 0;
  this.services = common.LOCAL_SERVICES;
  this.requiredServices = common.REQUIRED_SERVICES;
  this.persistent = false;

  this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {PoolOptions}
 */

PoolOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Pool requires options.');
  assert(options.chain && (0, _typeof3.default)(options.chain) === 'object', 'Pool options require a blockchain.');

  this.chain = options.chain;
  this.network = options.chain.network;
  this.logger = options.chain.logger;

  this.port = this.network.port;
  this.seeds = this.network.seeds;
  this.port = this.network.port;
  this.publicPort = this.network.port;

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.mempool != null) {
    assert((0, _typeof3.default)(options.mempool) === 'object');
    this.mempool = options.mempool;
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
  }

  if (options.checkpoints != null) {
    assert(typeof options.checkpoints === 'boolean');
    assert(options.checkpoints === this.chain.options.checkpoints);
    this.checkpoints = options.checkpoints;
  } else {
    this.checkpoints = this.chain.options.checkpoints;
  }

  if (options.spv != null) {
    assert(typeof options.spv === 'boolean');
    assert(options.spv === this.chain.options.spv);
    this.spv = options.spv;
  } else {
    this.spv = this.chain.options.spv;
  }

  if (options.bip37 != null) {
    assert(typeof options.bip37 === 'boolean');
    this.bip37 = options.bip37;
  }

  if (options.listen != null) {
    assert(typeof options.listen === 'boolean');
    this.listen = options.listen;
  }

  if (options.compact != null) {
    assert(typeof options.compact === 'boolean');
    this.compact = options.compact;
  }

  if (options.noRelay != null) {
    assert(typeof options.noRelay === 'boolean');
    this.noRelay = options.noRelay;
  }

  if (options.host != null) {
    assert(typeof options.host === 'string');
    var raw = IP.toBuffer(options.host);
    this.host = IP.toString(raw);
    if (IP.isRoutable(raw)) this.publicHost = this.host;
  }

  if (options.port != null) {
    assert(util.isU16(options.port));
    this.port = options.port;
    this.publicPort = options.port;
  }

  if (options.publicHost != null) {
    assert(typeof options.publicHost === 'string');
    this.publicHost = IP.normalize(options.publicHost);
  }

  if (options.publicPort != null) {
    assert(util.isU16(options.publicPort));
    this.publicPort = options.publicPort;
  }

  if (options.maxOutbound != null) {
    assert(typeof options.maxOutbound === 'number');
    assert(options.maxOutbound > 0);
    this.maxOutbound = options.maxOutbound;
  }

  if (options.maxInbound != null) {
    assert(typeof options.maxInbound === 'number');
    this.maxInbound = options.maxInbound;
  }

  if (options.createSocket) {
    assert(typeof options.createSocket === 'function');
    this.createSocket = options.createSocket;
  }

  if (options.createServer) {
    assert(typeof options.createServer === 'function');
    this.createServer = options.createServer;
  }

  if (options.resolve) {
    assert(typeof options.resolve === 'function');
    this.resolve = options.resolve;
  }

  if (options.proxy) {
    assert(typeof options.proxy === 'string');
    this.proxy = options.proxy;
  }

  if (options.onion != null) {
    assert(typeof options.onion === 'boolean');
    this.onion = options.onion;
  }

  if (options.upnp != null) {
    assert(typeof options.upnp === 'boolean');
    this.upnp = options.upnp;
  }

  if (options.selfish) {
    assert(typeof options.selfish === 'boolean');
    this.selfish = options.selfish;
  }

  if (options.version) {
    assert(typeof options.version === 'number');
    this.version = options.version;
  }

  if (options.agent) {
    assert(typeof options.agent === 'string');
    assert(options.agent.length <= 255);
    this.agent = options.agent;
  }

  if (options.bip151 != null) {
    assert(typeof options.bip151 === 'boolean');
    this.bip151 = options.bip151;
  }

  if (options.bip150 != null) {
    assert(typeof options.bip150 === 'boolean');
    assert(!options.bip150 || this.bip151, 'Cannot enable bip150 without bip151.');

    if (options.knownPeers) {
      assert((0, _typeof3.default)(options.knownPeers) === 'object');
      assert(!Array.isArray(options.knownPeers));
      this.knownPeers = options.knownPeers;
    }

    if (options.authPeers) {
      assert(Array.isArray(options.authPeers));
      this.authPeers = options.authPeers;
    }

    if (options.identityKey) {
      assert(Buffer.isBuffer(options.identityKey), 'Identity key must be a buffer.');
      assert(secp256k1.privateKeyVerify(options.identityKey), 'Invalid identity key.');
      this.identityKey = options.identityKey;
    }
  }

  if (options.banScore != null) {
    assert(typeof this.options.banScore === 'number');
    this.banScore = this.options.banScore;
  }

  if (options.banTime != null) {
    assert(typeof this.options.banTime === 'number');
    this.banTime = this.options.banTime;
  }

  if (options.feeRate != null) {
    assert(typeof this.options.feeRate === 'number');
    this.feeRate = this.options.feeRate;
  }

  if (options.seeds) {
    assert(Array.isArray(options.seeds));
    this.seeds = options.seeds;
  }

  if (options.nodes) {
    assert(Array.isArray(options.nodes));
    this.nodes = options.nodes;
  }

  if (options.only != null) {
    assert(Array.isArray(options.only));
    if (options.only.length > 0) {
      this.nodes = options.only;
      this.maxOutbound = options.only.length;
    }
  }

  if (options.invTimeout != null) {
    assert(typeof options.invTimeout === 'number');
    this.invTimeout = options.invTimeout;
  }

  if (options.blockMode != null) {
    assert(typeof options.blockMode === 'number');
    this.blockMode = options.blockMode;
  }

  if (options.persistent != null) {
    assert(typeof options.persistent === 'boolean');
    this.persistent = options.persistent;
  }

  if (this.spv) {
    this.requiredServices |= common.services.BLOOM;
    this.services &= ~common.services.NETWORK;
    this.noRelay = true;
    this.checkpoints = true;
    this.compact = false;
    this.bip37 = false;
    this.listen = false;
  }

  if (this.selfish) {
    this.services &= ~common.services.NETWORK;
    this.bip37 = false;
  }

  if (this.bip37) this.services |= common.services.BLOOM;

  if (this.proxy) this.listen = false;

  if (options.services != null) {
    assert(util.isU32(options.services));
    this.services = options.services;
  }

  if (options.requiredServices != null) {
    assert(util.isU32(options.requiredServices));
    this.requiredServices = options.requiredServices;
  }

  return this;
};

/**
 * Instantiate options from object.
 * @param {Object} options
 * @returns {PoolOptions}
 */

PoolOptions.fromOptions = function fromOptions(options) {
  return new PoolOptions().fromOptions(options);
};

/**
 * Get the chain height.
 * @private
 * @returns {Number}
 */

PoolOptions.prototype.getHeight = function getHeight() {
  return this.chain.height;
};

/**
 * Test whether the chain is synced.
 * @private
 * @returns {Boolean}
 */

PoolOptions.prototype.isFull = function isFull() {
  return this.chain.synced;
};

/**
 * Get required services for outbound peers.
 * @private
 * @returns {Number}
 */

PoolOptions.prototype.getRequiredServices = function getRequiredServices() {
  var services = this.requiredServices;
  if (this.hasWitness()) services |= common.services.WITNESS;
  return services;
};

/**
 * Whether segwit is enabled.
 * @private
 * @returns {Boolean}
 */

PoolOptions.prototype.hasWitness = function hasWitness() {
  return this.chain.state.hasWitness();
};

/**
 * Create a version packet nonce.
 * @private
 * @param {String} hostname
 * @returns {Buffer}
 */

PoolOptions.prototype.createNonce = function createNonce(hostname) {
  return this.nonces.alloc(hostname);
};

/**
 * Test whether version nonce is ours.
 * @private
 * @param {Buffer} nonce
 * @returns {Boolean}
 */

PoolOptions.prototype.hasNonce = function hasNonce(nonce) {
  return this.nonces.has(nonce);
};

/**
 * Get fee rate for txid.
 * @private
 * @param {Hash} hash
 * @returns {Rate}
 */

PoolOptions.prototype.getRate = function getRate(hash) {
  if (!this.mempool) return -1;

  var entry = this.mempool.getEntry(hash);

  if (!entry) return -1;

  return entry.getRate();
};

/**
 * Default createSocket call.
 * @private
 * @param {Number} port
 * @param {String} host
 * @returns {net.Socket}
 */

PoolOptions.prototype._createSocket = function _createSocket(port, host) {
  return tcp.createSocket(port, host, this.proxy);
};

/**
 * Default resolve call.
 * @private
 * @param {String} name
 * @returns {String[]}
 */

PoolOptions.prototype._resolve = function _resolve(name) {
  if (this.onion) return dns.lookup(name, this.proxy);

  return dns.lookup(name);
};

/**
 * Peer List
 * @alias module:net.PeerList
 * @constructor
 * @param {Object} options
 */

function PeerList() {
  this.map = new _map2.default();
  this.ids = new _map2.default();
  this.list = new List();
  this.load = null;
  this.inbound = 0;
  this.outbound = 0;
}

/**
 * Get the list head.
 * @returns {Peer}
 */

PeerList.prototype.head = function head() {
  return this.list.head;
};

/**
 * Get the list tail.
 * @returns {Peer}
 */

PeerList.prototype.tail = function tail() {
  return this.list.tail;
};

/**
 * Get list size.
 * @returns {Number}
 */

PeerList.prototype.size = function size() {
  return this.list.size;
};

/**
 * Add peer to list.
 * @param {Peer} peer
 */

PeerList.prototype.add = function add(peer) {
  assert(this.list.push(peer));

  assert(!this.map.has(peer.hostname()));
  this.map.set(peer.hostname(), peer);

  assert(!this.ids.has(peer.id));
  this.ids.set(peer.id, peer);

  if (peer.outbound) this.outbound++;else this.inbound++;
};

/**
 * Remove peer from list.
 * @param {Peer} peer
 */

PeerList.prototype.remove = function remove(peer) {
  assert(this.list.remove(peer));

  assert(this.ids.has(peer.id));
  this.ids.delete(peer.id);

  assert(this.map.has(peer.hostname()));
  this.map.delete(peer.hostname());

  if (peer === this.load) {
    assert(peer.loader);
    peer.loader = false;
    this.load = null;
  }

  if (peer.outbound) this.outbound--;else this.inbound--;
};

/**
 * Get peer by hostname.
 * @param {String} hostname
 * @returns {Peer}
 */

PeerList.prototype.get = function get(hostname) {
  return this.map.get(hostname);
};

/**
 * Test whether a peer exists.
 * @param {String} hostname
 * @returns {Boolean}
 */

PeerList.prototype.has = function has(hostname) {
  return this.map.has(hostname);
};

/**
 * Get peer by ID.
 * @param {Number} id
 * @returns {Peer}
 */

PeerList.prototype.find = function find(id) {
  return this.ids.get(id);
};

/**
 * Destroy peer list (kills peers).
 */

PeerList.prototype.destroy = function destroy() {
  var next = void 0;

  for (var peer = this.list.head; peer; peer = next) {
    next = peer.next;
    peer.destroy();
  }
};

/**
 * Represents an item that is broadcasted via an inv/getdata cycle.
 * @alias module:net.BroadcastItem
 * @constructor
 * @private
 * @param {Pool} pool
 * @param {TX|Block} msg
 * @emits BroadcastItem#ack
 * @emits BroadcastItem#reject
 * @emits BroadcastItem#timeout
 */

function BroadcastItem(pool, msg) {
  if (!(this instanceof BroadcastItem)) return new BroadcastItem(pool, msg);

  assert(!msg.mutable, 'Cannot broadcast mutable item.');

  var item = msg.toInv();

  this.pool = pool;
  this.hash = item.hash;
  this.type = item.type;
  this.msg = msg;
  this.jobs = [];
}

(0, _setPrototypeOf2.default)(BroadcastItem.prototype, EventEmitter.prototype);

/**
 * Add a job to be executed on ack, timeout, or reject.
 * @returns {Promise}
 */

BroadcastItem.prototype.addJob = function addJob(resolve, reject) {
  this.jobs.push(co.job(resolve, reject));
};

/**
 * Start the broadcast.
 */

BroadcastItem.prototype.start = function start() {
  assert(!this.timeout, 'Already started.');
  assert(!this.pool.invMap.has(this.hash), 'Already started.');

  this.pool.invMap.set(this.hash, this);

  this.refresh();

  return this;
};

/**
 * Refresh the timeout on the broadcast.
 */

BroadcastItem.prototype.refresh = function refresh() {
  var _this5 = this;

  if (this.timeout != null) {
    clearTimeout(this.timeout);
    this.timeout = null;
  }

  this.timeout = setTimeout(function () {
    _this5.emit('timeout');
    _this5.reject(new Error('Timed out.'));
  }, this.pool.options.invTimeout);
};

/**
 * Announce the item.
 */

BroadcastItem.prototype.announce = function announce() {
  switch (this.type) {
    case invTypes.TX:
      this.pool.announceTX(this.msg);
      break;
    case invTypes.BLOCK:
      this.pool.announceBlock(this.msg);
      break;
    default:
      assert(false, 'Bad type.');
      break;
  }
};

/**
 * Finish the broadcast.
 */

BroadcastItem.prototype.cleanup = function cleanup() {
  assert(this.timeout != null, 'Already finished.');
  assert(this.pool.invMap.has(this.hash), 'Already finished.');

  clearTimeout(this.timeout);
  this.timeout = null;

  this.pool.invMap.delete(this.hash);
};

/**
 * Finish the broadcast, return with an error.
 * @param {Error} err
 */

BroadcastItem.prototype.reject = function reject(err) {
  this.cleanup();

  var _iteratorNormalCompletion19 = true;
  var _didIteratorError19 = false;
  var _iteratorError19 = undefined;

  try {
    for (var _iterator19 = (0, _getIterator3.default)(this.jobs), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
      var job = _step19.value;

      job.reject(err);
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

  this.jobs.length = 0;
};

/**
 * Finish the broadcast successfully.
 */

BroadcastItem.prototype.resolve = function resolve() {
  this.cleanup();

  var _iteratorNormalCompletion20 = true;
  var _didIteratorError20 = false;
  var _iteratorError20 = undefined;

  try {
    for (var _iterator20 = (0, _getIterator3.default)(this.jobs), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
      var job = _step20.value;

      job.resolve(false);
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

  this.jobs.length = 0;
};

/**
 * Handle an ack from a peer.
 * @param {Peer} peer
 */

BroadcastItem.prototype.handleAck = function handleAck(peer) {
  var _this6 = this;

  setTimeout(function () {
    _this6.emit('ack', peer);

    var _iteratorNormalCompletion21 = true;
    var _didIteratorError21 = false;
    var _iteratorError21 = undefined;

    try {
      for (var _iterator21 = (0, _getIterator3.default)(_this6.jobs), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
        var job = _step21.value;

        job.resolve(true);
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

    _this6.jobs.length = 0;
  }, 1000);
};

/**
 * Handle a reject from a peer.
 * @param {Peer} peer
 */

BroadcastItem.prototype.handleReject = function handleReject(peer) {
  this.emit('reject', peer);

  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = (0, _getIterator3.default)(this.jobs), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var job = _step22.value;

      job.resolve(false);
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

  this.jobs.length = 0;
};

/**
 * Inspect the broadcast item.
 * @returns {String}
 */

BroadcastItem.prototype.inspect = function inspect() {
  var type = this.type === invTypes.TX ? 'tx' : 'block';
  var hash = util.revHex(this.hash);
  return '<BroadcastItem: type=' + type + ' hash=' + hash + '>';
};

/**
 * NonceList
 * @constructor
 * @ignore
 */

function NonceList() {
  this.map = new _map2.default();
  this.hosts = new _map2.default();
}

NonceList.prototype.alloc = function alloc(hostname) {
  for (;;) {
    var nonce = util.nonce();
    var key = nonce.toString('hex');

    if (this.map.has(key)) continue;

    this.map.set(key, hostname);

    assert(!this.hosts.has(hostname));
    this.hosts.set(hostname, key);

    return nonce;
  }
};

NonceList.prototype.has = function has(nonce) {
  var key = nonce.toString('hex');
  return this.map.has(key);
};

NonceList.prototype.remove = function remove(hostname) {
  var key = this.hosts.get(hostname);

  if (!key) return false;

  this.hosts.delete(hostname);

  assert(this.map.has(key));
  this.map.delete(key);

  return true;
};

/**
 * HeaderEntry
 * @constructor
 * @ignore
 */

function HeaderEntry(hash, height) {
  this.hash = hash;
  this.height = height;
  this.prev = null;
  this.next = null;
}

/*
 * Expose
 */

module.exports = Pool;