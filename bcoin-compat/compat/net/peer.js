/*!
 * peer.js - peer object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

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
var EventEmitter = require('events');
var util = require('../utils/util');
var co = require('../utils/co');
var Parser = require('./parser');
var Framer = require('./framer');
var packets = require('./packets');
var consensus = require('../protocol/consensus');
var common = require('./common');
var InvItem = require('../primitives/invitem');
var Lock = require('../utils/lock');
var RollingFilter = require('../utils/rollingfilter');
var BIP151 = require('./bip151');
var BIP150 = require('./bip150');
var BIP152 = require('./bip152');
var Block = require('../primitives/block');
var TX = require('../primitives/tx');
var encoding = require('../utils/encoding');
var NetAddress = require('../primitives/netaddress');
var Network = require('../protocol/network');
var Logger = require('../node/logger');
var tcp = require('./tcp');
var services = common.services;
var invTypes = InvItem.types;
var packetTypes = packets.types;

/**
 * Represents a remote peer.
 * @alias module:net.Peer
 * @constructor
 * @param {PeerOptions} options
 * @property {net.Socket} socket
 * @property {NetAddress} address
 * @property {Parser} parser
 * @property {Framer} framer
 * @property {Number} version
 * @property {Boolean} destroyed
 * @property {Boolean} ack - Whether verack has been received.
 * @property {Boolean} connected
 * @property {Number} time
 * @property {Boolean} preferHeaders - Whether the peer has
 * requested getheaders.
 * @property {Hash?} hashContinue - The block hash at which to continue
 * the sync for the peer.
 * @property {Bloom?} spvFilter - The _peer's_ bloom spvFilter.
 * @property {Boolean} noRelay - Whether to relay transactions
 * immediately to the peer.
 * @property {BN} challenge - Local nonce.
 * @property {Number} lastPong - Timestamp for last `pong`
 * received (unix time).
 * @property {Number} lastPing - Timestamp for last `ping`
 * sent (unix time).
 * @property {Number} minPing - Lowest ping time seen.
 * @property {Number} banScore
 * @emits Peer#ack
 */

function Peer(options) {
  if (!(this instanceof Peer)) return new Peer(options);

  EventEmitter.call(this);

  this.options = options;
  this.network = this.options.network;
  this.logger = this.options.logger.context('peer');
  this.locker = new Lock();

  this.parser = new Parser(this.network);
  this.framer = new Framer(this.network);

  this.id = -1;
  this.socket = null;
  this.opened = false;
  this.outbound = false;
  this.loader = false;
  this.address = new NetAddress();
  this.local = new NetAddress();
  this.connected = false;
  this.destroyed = false;
  this.ack = false;
  this.handshake = false;
  this.time = 0;
  this.lastSend = 0;
  this.lastRecv = 0;
  this.drainSize = 0;
  this.drainQueue = [];
  this.banScore = 0;
  this.invQueue = [];
  this.onPacket = null;

  this.next = null;
  this.prev = null;

  this.version = -1;
  this.services = 0;
  this.height = -1;
  this.agent = null;
  this.noRelay = false;
  this.preferHeaders = false;
  this.hashContinue = null;
  this.spvFilter = null;
  this.feeRate = -1;
  this.bip151 = null;
  this.bip150 = null;
  this.compactMode = -1;
  this.compactWitness = false;
  this.merkleBlock = null;
  this.merkleTime = -1;
  this.merkleMatches = 0;
  this.merkleMap = null;
  this.syncing = false;
  this.sentAddr = false;
  this.sentGetAddr = false;
  this.challenge = null;
  this.lastPong = -1;
  this.lastPing = -1;
  this.minPing = -1;
  this.blockTime = -1;

  this.bestHash = null;
  this.bestHeight = -1;

  this.connectTimeout = null;
  this.pingTimer = null;
  this.invTimer = null;
  this.stallTimer = null;

  this.addrFilter = new RollingFilter(5000, 0.001);
  this.invFilter = new RollingFilter(50000, 0.000001);

  this.blockMap = new _map2.default();
  this.txMap = new _map2.default();
  this.responseMap = new _map2.default();
  this.compactBlocks = new _map2.default();

  this._init();
}

(0, _setPrototypeOf2.default)(Peer.prototype, EventEmitter.prototype);

/**
 * Max output bytes buffered before
 * invoking stall behavior for peer.
 * @const {Number}
 * @default
 */

Peer.DRAIN_MAX = 10 << 20;

/**
 * Interval to check for drainage
 * and required responses from peer.
 * @const {Number}
 * @default
 */

Peer.STALL_INTERVAL = 5000;

/**
 * Interval for pinging peers.
 * @const {Number}
 * @default
 */

Peer.PING_INTERVAL = 30000;

/**
 * Interval to flush invs.
 * Higher means more invs (usually
 * txs) will be accumulated before
 * flushing.
 * @const {Number}
 * @default
 */

Peer.INV_INTERVAL = 5000;

/**
 * Required time for peers to
 * respond to messages (i.e.
 * getblocks/getdata).
 * @const {Number}
 * @default
 */

Peer.RESPONSE_TIMEOUT = 30000;

/**
 * Required time for loader to
 * respond with block/merkleblock.
 * @const {Number}
 * @default
 */

Peer.BLOCK_TIMEOUT = 120000;

/**
 * Required time for loader to
 * respond with a tx.
 * @const {Number}
 * @default
 */

Peer.TX_TIMEOUT = 120000;

/**
 * Generic timeout interval.
 * @const {Number}
 * @default
 */

Peer.TIMEOUT_INTERVAL = 20 * 60000;

/**
 * Create inbound peer from socket.
 * @param {PeerOptions} options
 * @param {net.Socket} socket
 * @returns {Peer}
 */

Peer.fromInbound = function fromInbound(options, socket) {
  var peer = new Peer(options);
  peer.accept(socket);
  return peer;
};

/**
 * Create outbound peer from net address.
 * @param {PeerOptions} options
 * @param {NetAddress} addr
 * @returns {Peer}
 */

Peer.fromOutbound = function fromOutbound(options, addr) {
  var peer = new Peer(options);
  peer.connect(addr);
  return peer;
};

/**
 * Create a peer from options.
 * @param {Object} options
 * @returns {Peer}
 */

Peer.fromOptions = function fromOptions(options) {
  return new Peer(new PeerOptions(options));
};

/**
 * Begin peer initialization.
 * @private
 */

Peer.prototype._init = function _init() {
  var _this = this;

  this.parser.on('packet', function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(packet) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              _context.next = 3;
              return _this.readPacket(packet);

            case 3:
              _context.next = 9;
              break;

            case 5:
              _context.prev = 5;
              _context.t0 = _context['catch'](0);

              _this.error(_context.t0);
              _this.destroy();

            case 9:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this, [[0, 5]]);
    }));

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }());

  this.parser.on('error', function (err) {
    if (_this.destroyed) return;

    _this.error(err);
    _this.sendReject('malformed', 'error parsing message');
    _this.increaseBan(10);
  });
};

/**
 * Getter to retrieve hostname.
 * @returns {String}
 */

Peer.prototype.hostname = function hostname() {
  return this.address.hostname;
};

/**
 * Frame a payload with a header.
 * @param {String} cmd - Packet type.
 * @param {Buffer} payload
 * @returns {Buffer} Payload with header prepended.
 */

Peer.prototype.framePacket = function framePacket(cmd, payload, checksum) {
  if (this.bip151 && this.bip151.handshake) return this.bip151.packet(cmd, payload);
  return this.framer.packet(cmd, payload, checksum);
};

/**
 * Feed data to the parser.
 * @param {Buffer} data
 */

Peer.prototype.feedParser = function feedParser(data) {
  if (this.bip151 && this.bip151.handshake) return this.bip151.feed(data);
  return this.parser.feed(data);
};

/**
 * Set BIP151 cipher type.
 * @param {Number} cipher
 */

Peer.prototype.setCipher = function setCipher(cipher) {
  var _this2 = this;

  assert(!this.bip151, 'BIP151 already set.');
  assert(this.socket, 'Peer must be initialized with a socket.');
  assert(!this.opened, 'Cannot set cipher after open.');

  this.bip151 = new BIP151(cipher);

  this.bip151.on('error', function (err) {
    _this2.error(err);
    _this2.destroy();
  });

  this.bip151.on('rekey', function () {
    if (_this2.destroyed) return;

    _this2.logger.debug('Rekeying with peer (%s).', _this2.hostname());
    _this2.send(_this2.bip151.toRekey());
  });

  this.bip151.on('packet', function (cmd, body) {
    var payload = null;
    try {
      payload = _this2.parser.parsePayload(cmd, body);
    } catch (e) {
      _this2.parser.error(e);
      return;
    }
    _this2.parser.emit('packet', payload);
  });
};

/**
 * Set BIP150 auth.
 * @param {AuthDB} db
 * @param {Buffer} key
 */

Peer.prototype.setAuth = function setAuth(db, key) {
  var bip151 = this.bip151;
  var hostname = this.hostname();
  var outbound = this.outbound;

  assert(this.bip151, 'BIP151 not set.');
  assert(!this.bip150, 'BIP150 already set.');
  assert(this.socket, 'Peer must be initialized with a socket.');
  assert(!this.opened, 'Cannot set auth after open.');

  this.bip150 = new BIP150(bip151, hostname, outbound, db, key);
  this.bip151.bip150 = this.bip150;
};

/**
 * Bind to socket.
 * @param {net.Socket} socket
 */

Peer.prototype.bind = function bind(socket) {
  var _this3 = this;

  assert(!this.socket);

  this.socket = socket;

  this.socket.once('error', function (err) {
    if (!_this3.connected) return;

    _this3.error(err);
    _this3.destroy();
  });

  this.socket.once('close', function () {
    _this3.error('Socket hangup.');
    _this3.destroy();
  });

  this.socket.on('drain', function () {
    _this3.handleDrain();
  });

  this.socket.on('data', function (chunk) {
    _this3.lastRecv = util.ms();
    _this3.feedParser(chunk);
  });

  this.socket.setNoDelay(true);
};

/**
 * Accept an inbound socket.
 * @param {net.Socket} socket
 * @returns {net.Socket}
 */

Peer.prototype.accept = function accept(socket) {
  assert(!this.socket);

  this.address = NetAddress.fromSocket(socket, this.network);
  this.address.services = 0;
  this.time = util.ms();
  this.outbound = false;
  this.connected = true;

  this.bind(socket);

  return socket;
};

/**
 * Create the socket and begin connecting. This method
 * will use `options.createSocket` if provided.
 * @param {NetAddress} addr
 * @returns {net.Socket}
 */

Peer.prototype.connect = function connect(addr) {
  assert(!this.socket);

  var socket = this.options.createSocket(addr.port, addr.host);

  this.address = addr;
  this.outbound = true;
  this.connected = false;

  this.bind(socket);

  return socket;
};

/**
 * Open and perform initial handshake (without rejection).
 * @method
 * @returns {Promise}
 */

Peer.prototype.tryOpen = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.prev = 0;
            _context2.next = 3;
            return this.open();

          case 3:
            _context2.next = 8;
            break;

          case 5:
            _context2.prev = 5;
            _context2.t0 = _context2['catch'](0);

            ;

          case 8:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[0, 5]]);
  }));

  function tryOpen() {
    return _ref2.apply(this, arguments);
  }

  return tryOpen;
}();

/**
 * Open and perform initial handshake.
 * @method
 * @returns {Promise}
 */

Peer.prototype.open = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.prev = 0;
            _context3.next = 3;
            return this._open();

          case 3:
            _context3.next = 10;
            break;

          case 5:
            _context3.prev = 5;
            _context3.t0 = _context3['catch'](0);

            this.error(_context3.t0);
            this.destroy();
            throw _context3.t0;

          case 10:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[0, 5]]);
  }));

  function open() {
    return _ref3.apply(this, arguments);
  }

  return open;
}();

/**
 * Open and perform initial handshake.
 * @method
 * @returns {Promise}
 */

Peer.prototype._open = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            this.opened = true;

            // Connect to peer.
            _context4.next = 3;
            return this.initConnect();

          case 3:
            _context4.next = 5;
            return this.initStall();

          case 5:
            _context4.next = 7;
            return this.initBIP151();

          case 7:
            _context4.next = 9;
            return this.initBIP150();

          case 9:
            _context4.next = 11;
            return this.initVersion();

          case 11:
            _context4.next = 13;
            return this.finalize();

          case 13:

            assert(!this.destroyed);

            // Finally we can let the pool know
            // that this peer is ready to go.
            this.emit('open');

          case 15:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function _open() {
    return _ref4.apply(this, arguments);
  }

  return _open;
}();

/**
 * Wait for connection.
 * @private
 * @returns {Promise}
 */

Peer.prototype.initConnect = function initConnect() {
  var _this4 = this;

  if (this.connected) {
    assert(!this.outbound);
    return _promise2.default.resolve();
  }

  return new _promise2.default(function (resolve, reject) {
    var cleanup = function cleanup() {
      if (_this4.connectTimeout != null) {
        clearTimeout(_this4.connectTimeout);
        _this4.connectTimeout = null;
      }
      // eslint-disable-next-line no-use-before-define
      _this4.socket.removeListener('error', onError);
    };

    var onError = function onError(err) {
      cleanup();
      reject(err);
    };

    _this4.socket.once('connect', function () {
      _this4.time = util.ms();
      _this4.connected = true;
      _this4.emit('connect');

      cleanup();
      resolve();
    });

    _this4.socket.once('error', onError);

    _this4.connectTimeout = setTimeout(function () {
      _this4.connectTimeout = null;
      cleanup();
      reject(new Error('Connection timed out.'));
    }, 10000);
  });
};

/**
 * Setup stall timer.
 * @private
 * @returns {Promise}
 */

Peer.prototype.initStall = function initStall() {
  var _this5 = this;

  assert(!this.stallTimer);
  assert(!this.destroyed);
  this.stallTimer = setInterval(function () {
    _this5.maybeTimeout();
  }, Peer.STALL_INTERVAL);
  return _promise2.default.resolve();
};

/**
 * Handle `connect` event (called immediately
 * if a socket was passed into peer).
 * @method
 * @private
 * @returns {Promise}
 */

Peer.prototype.initBIP151 = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            assert(!this.destroyed);

            // Send encinit. Wait for handshake to complete.

            if (this.bip151) {
              _context5.next = 3;
              break;
            }

            return _context5.abrupt('return');

          case 3:

            assert(!this.bip151.completed);

            this.logger.info('Attempting BIP151 handshake (%s).', this.hostname());

            this.send(this.bip151.toEncinit());

            _context5.prev = 6;
            _context5.next = 9;
            return this.bip151.wait(3000);

          case 9:
            _context5.next = 14;
            break;

          case 11:
            _context5.prev = 11;
            _context5.t0 = _context5['catch'](6);

            this.error(_context5.t0);

          case 14:
            if (!this.destroyed) {
              _context5.next = 16;
              break;
            }

            throw new Error('Peer was destroyed during BIP151 handshake.');

          case 16:

            assert(this.bip151.completed);

            if (this.bip151.handshake) {
              this.logger.info('BIP151 handshake complete (%s).', this.hostname());
              this.logger.info('Connection is encrypted (%s).', this.hostname());
            }

          case 18:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[6, 11]]);
  }));

  function initBIP151() {
    return _ref5.apply(this, arguments);
  }

  return initBIP151;
}();

/**
 * Handle post bip151-handshake.
 * @method
 * @private
 * @returns {Promise}
 */

Peer.prototype.initBIP150 = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            assert(!this.destroyed);

            if (this.bip150) {
              _context6.next = 3;
              break;
            }

            return _context6.abrupt('return');

          case 3:

            assert(this.bip151);
            assert(!this.bip150.completed);

            if (this.bip151.handshake) {
              _context6.next = 7;
              break;
            }

            throw new Error('BIP151 handshake was not completed for BIP150.');

          case 7:

            this.logger.info('Attempting BIP150 handshake (%s).', this.hostname());

            if (!this.bip150.outbound) {
              _context6.next = 12;
              break;
            }

            if (this.bip150.peerIdentity) {
              _context6.next = 11;
              break;
            }

            throw new Error('No known identity for peer.');

          case 11:
            this.send(this.bip150.toChallenge());

          case 12:
            _context6.next = 14;
            return this.bip150.wait(3000);

          case 14:

            assert(!this.destroyed);
            assert(this.bip150.completed);

            if (this.bip150.auth) {
              this.logger.info('BIP150 handshake complete (%s).', this.hostname());
              this.logger.info('Peer is authed (%s): %s.', this.hostname(), this.bip150.getAddress());
            }

          case 17:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function initBIP150() {
    return _ref6.apply(this, arguments);
  }

  return initBIP150;
}();

/**
 * Handle post handshake.
 * @method
 * @private
 * @returns {Promise}
 */

Peer.prototype.initVersion = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            assert(!this.destroyed);

            // Say hello.
            this.sendVersion();

            if (this.ack) {
              _context7.next = 6;
              break;
            }

            _context7.next = 5;
            return this.wait(packetTypes.VERACK, 10000);

          case 5:
            assert(this.ack);

          case 6:
            if (!(this.version === -1)) {
              _context7.next = 11;
              break;
            }

            this.logger.debug('Peer sent a verack without a version (%s).', this.hostname());

            _context7.next = 10;
            return this.wait(packetTypes.VERSION, 10000);

          case 10:

            assert(this.version !== -1);

          case 11:
            if (!this.destroyed) {
              _context7.next = 13;
              break;
            }

            throw new Error('Peer was destroyed during handshake.');

          case 13:

            this.handshake = true;

            this.logger.debug('Version handshake complete (%s).', this.hostname());

          case 15:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function initVersion() {
    return _ref7.apply(this, arguments);
  }

  return initVersion;
}();

/**
 * Finalize peer after handshake.
 * @method
 * @private
 * @returns {Promise}
 */

Peer.prototype.finalize = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8() {
    var _this6 = this;

    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            assert(!this.destroyed);

            // Setup the ping interval.
            this.pingTimer = setInterval(function () {
              _this6.sendPing();
            }, Peer.PING_INTERVAL);

            // Setup the inv flusher.
            this.invTimer = setInterval(function () {
              _this6.flushInv();
            }, Peer.INV_INTERVAL);

          case 3:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function finalize() {
    return _ref8.apply(this, arguments);
  }

  return finalize;
}();

/**
 * Broadcast blocks to peer.
 * @param {Block[]} blocks
 */

Peer.prototype.announceBlock = function announceBlock(blocks) {
  if (!this.handshake) return;

  if (this.destroyed) return;

  if (!Array.isArray(blocks)) blocks = [blocks];

  var inv = [];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(blocks), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var block = _step.value;

      assert(block instanceof Block);

      // Don't send if they already have it.
      if (this.invFilter.test(block.hash())) continue;

      // Send them the block immediately if
      // they're using compact block mode 1.
      if (this.compactMode === 1) {
        this.invFilter.add(block.hash());
        this.sendCompactBlock(block);
        continue;
      }

      // Convert item to block headers
      // for peers that request it.
      if (this.preferHeaders) {
        inv.push(block.toHeaders());
        continue;
      }

      inv.push(block.toInv());
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

  if (this.preferHeaders) {
    this.sendHeaders(inv);
    return;
  }

  this.queueInv(inv);
};

/**
 * Broadcast transactions to peer.
 * @param {TX[]} txs
 */

Peer.prototype.announceTX = function announceTX(txs) {
  if (!this.handshake) return;

  if (this.destroyed) return;

  // Do not send txs to spv clients
  // that have relay unset.
  if (this.noRelay) return;

  if (!Array.isArray(txs)) txs = [txs];

  var inv = [];

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(txs), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var tx = _step2.value;

      assert(tx instanceof TX);

      // Don't send if they already have it.
      if (this.invFilter.test(tx.hash())) continue;

      // Check the peer's bloom
      // filter if they're using spv.
      if (this.spvFilter) {
        if (!tx.isWatched(this.spvFilter)) continue;
      }

      // Check the fee filter.
      if (this.feeRate !== -1) {
        var hash = tx.hash('hex');
        var rate = this.options.getRate(hash);
        if (rate !== -1 && rate < this.feeRate) continue;
      }

      inv.push(tx.toInv());
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

  this.queueInv(inv);
};

/**
 * Send inv to a peer.
 * @param {InvItem[]} items
 */

Peer.prototype.queueInv = function queueInv(items) {
  if (!this.handshake) return;

  if (this.destroyed) return;

  if (!Array.isArray(items)) items = [items];

  var hasBlock = false;

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(items), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var item = _step3.value;

      if (item.type === invTypes.BLOCK) hasBlock = true;
      this.invQueue.push(item);
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

  if (this.invQueue.length >= 500 || hasBlock) this.flushInv();
};

/**
 * Flush inv queue.
 * @private
 */

Peer.prototype.flushInv = function flushInv() {
  if (this.destroyed) return;

  var queue = this.invQueue;

  if (queue.length === 0) return;

  this.invQueue = [];

  this.logger.spam('Serving %d inv items to %s.', queue.length, this.hostname());

  var items = [];

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(queue), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var item = _step4.value;

      if (!this.invFilter.added(item.hash, 'hex')) continue;

      items.push(item);
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

  for (var i = 0; i < items.length; i += 1000) {
    var chunk = items.slice(i, i + 1000);
    this.send(new packets.InvPacket(chunk));
  }
};

/**
 * Force send an inv (no filter check).
 * @param {InvItem[]} items
 */

Peer.prototype.sendInv = function sendInv(items) {
  if (!this.handshake) return;

  if (this.destroyed) return;

  if (!Array.isArray(items)) items = [items];

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(items), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var item = _step5.value;

      this.invFilter.add(item.hash, 'hex');
    }
  } catch (err) {
    _didIteratorError5 = true;
    _iteratorError5 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion5 && _iterator5.return) {
        _iterator5.return();
      }
    } finally {
      if (_didIteratorError5) {
        throw _iteratorError5;
      }
    }
  }

  if (items.length === 0) return;

  this.logger.spam('Serving %d inv items to %s.', items.length, this.hostname());

  for (var i = 0; i < items.length; i += 1000) {
    var chunk = items.slice(i, i + 1000);
    this.send(new packets.InvPacket(chunk));
  }
};

/**
 * Send headers to a peer.
 * @param {Headers[]} items
 */

Peer.prototype.sendHeaders = function sendHeaders(items) {
  if (!this.handshake) return;

  if (this.destroyed) return;

  if (!Array.isArray(items)) items = [items];

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(items), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var item = _step6.value;

      this.invFilter.add(item.hash());
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

  if (items.length === 0) return;

  this.logger.spam('Serving %d headers to %s.', items.length, this.hostname());

  for (var i = 0; i < items.length; i += 2000) {
    var chunk = items.slice(i, i + 2000);
    this.send(new packets.HeadersPacket(chunk));
  }
};

/**
 * Send a compact block.
 * @private
 * @param {Block} block
 * @returns {Boolean}
 */

Peer.prototype.sendCompactBlock = function sendCompactBlock(block) {
  var witness = this.compactWitness;
  var compact = BIP152.CompactBlock.fromBlock(block, witness);
  this.send(new packets.CmpctBlockPacket(compact, witness));
};

/**
 * Send a `version` packet.
 */

Peer.prototype.sendVersion = function sendVersion() {
  var packet = new packets.VersionPacket();
  packet.version = this.options.version;
  packet.services = this.options.services;
  packet.time = this.network.now();
  packet.remote = this.address;
  packet.local.setNull();
  packet.local.services = this.options.services;
  packet.nonce = this.options.createNonce(this.hostname());
  packet.agent = this.options.agent;
  packet.height = this.options.getHeight();
  packet.noRelay = this.options.noRelay;
  this.send(packet);
};

/**
 * Send a `getaddr` packet.
 */

Peer.prototype.sendGetAddr = function sendGetAddr() {
  if (this.sentGetAddr) return;

  this.sentGetAddr = true;
  this.send(new packets.GetAddrPacket());
};

/**
 * Send a `ping` packet.
 */

Peer.prototype.sendPing = function sendPing() {
  if (!this.handshake) return;

  if (this.version <= common.PONG_VERSION) {
    this.send(new packets.PingPacket());
    return;
  }

  if (this.challenge) {
    this.logger.debug('Peer has not responded to ping (%s).', this.hostname());
    return;
  }

  this.lastPing = util.ms();
  this.challenge = util.nonce();

  this.send(new packets.PingPacket(this.challenge));
};

/**
 * Send `filterload` to update the local bloom filter.
 */

Peer.prototype.sendFilterLoad = function sendFilterLoad(filter) {
  if (!this.handshake) return;

  if (!this.options.spv) return;

  if (!(this.services & services.BLOOM)) return;

  this.send(new packets.FilterLoadPacket(filter));
};

/**
 * Set a fee rate filter for the peer.
 * @param {Rate} rate
 */

Peer.prototype.sendFeeRate = function sendFeeRate(rate) {
  if (!this.handshake) return;

  this.send(new packets.FeeFilterPacket(rate));
};

/**
 * Disconnect from and destroy the peer.
 */

Peer.prototype.destroy = function destroy() {
  var connected = this.connected;

  if (this.destroyed) return;

  this.destroyed = true;
  this.connected = false;

  this.socket.destroy();
  this.socket = null;

  if (this.bip151) this.bip151.destroy();

  if (this.bip150) this.bip150.destroy();

  if (this.pingTimer != null) {
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  if (this.invTimer != null) {
    clearInterval(this.invTimer);
    this.invTimer = null;
  }

  if (this.stallTimer != null) {
    clearInterval(this.stallTimer);
    this.stallTimer = null;
  }

  if (this.connectTimeout != null) {
    clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }

  var jobs = this.drainQueue;

  this.drainSize = 0;
  this.drainQueue = [];

  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(jobs), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var job = _step7.value;

      job.reject(new Error('Peer was destroyed.'));
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

  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = (0, _getIterator3.default)(this.responseMap), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var _ref9 = _step8.value;

      var _ref10 = (0, _slicedToArray3.default)(_ref9, 2);

      var cmd = _ref10[0];
      var entry = _ref10[1];

      this.responseMap.delete(cmd);
      entry.reject(new Error('Peer was destroyed.'));
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

  this.locker.destroy();

  this.emit('close', connected);
};

/**
 * Write data to the peer's socket.
 * @param {Buffer} data
 */

Peer.prototype.write = function write(data) {
  if (this.destroyed) throw new Error('Peer is destroyed (write).');

  this.lastSend = util.ms();

  if (this.socket.write(data) === false) this.needsDrain(data.length);
};

/**
 * Send a packet.
 * @param {Packet} packet
 */

Peer.prototype.send = function send(packet) {
  if (this.destroyed) throw new Error('Peer is destroyed (send).');

  // Used cached hashes as the
  // packet checksum for speed.
  var checksum = null;
  if (packet.type === packetTypes.TX) {
    var tx = packet.tx;
    if (packet.witness) {
      if (!tx.isCoinbase()) checksum = tx.witnessHash();
    } else {
      checksum = tx.hash();
    }
  }

  this.sendRaw(packet.cmd, packet.toRaw(), checksum);

  this.addTimeout(packet);
};

/**
 * Send a packet.
 * @param {Packet} packet
 */

Peer.prototype.sendRaw = function sendRaw(cmd, body, checksum) {
  var payload = this.framePacket(cmd, body, checksum);
  this.write(payload);
};

/**
 * Wait for a drain event.
 * @returns {Promise}
 */

Peer.prototype.drain = function drain() {
  var _this7 = this;

  if (this.destroyed) return _promise2.default.reject(new Error('Peer is destroyed.'));

  if (this.drainSize === 0) return _promise2.default.resolve();

  return new _promise2.default(function (resolve, reject) {
    _this7.drainQueue.push(co.job(resolve, reject));
  });
};

/**
 * Handle drain event.
 * @private
 */

Peer.prototype.handleDrain = function handleDrain() {
  var jobs = this.drainQueue;

  this.drainSize = 0;

  if (jobs.length === 0) return;

  this.drainQueue = [];

  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = (0, _getIterator3.default)(jobs), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var job = _step9.value;

      job.resolve();
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
 * Add to drain counter.
 * @private
 * @param {Number} size
 */

Peer.prototype.needsDrain = function needsDrain(size) {
  this.drainSize += size;

  if (this.drainSize >= Peer.DRAIN_MAX) {
    this.logger.warning('Peer is not reading: %dmb buffered (%s).', util.mb(this.drainSize), this.hostname());
    this.error('Peer stalled (drain).');
    this.destroy();
  }
};

/**
 * Potentially add response timeout.
 * @private
 * @param {Packet} packet
 */

Peer.prototype.addTimeout = function addTimeout(packet) {
  var timeout = Peer.RESPONSE_TIMEOUT;

  if (!this.outbound) return;

  switch (packet.type) {
    case packetTypes.MEMPOOL:
      this.request(packetTypes.INV, timeout);
      break;
    case packetTypes.GETBLOCKS:
      if (!this.options.isFull()) this.request(packetTypes.INV, timeout);
      break;
    case packetTypes.GETHEADERS:
      this.request(packetTypes.HEADERS, timeout * 2);
      break;
    case packetTypes.GETDATA:
      this.request(packetTypes.DATA, timeout * 2);
      break;
    case packetTypes.GETBLOCKTXN:
      this.request(packetTypes.BLOCKTXN, timeout);
      break;
  }
};

/**
 * Potentially finish response timeout.
 * @private
 * @param {Packet} packet
 */

Peer.prototype.fulfill = function fulfill(packet) {
  switch (packet.type) {
    case packetTypes.BLOCK:
    case packetTypes.CMPCTBLOCK:
    case packetTypes.MERKLEBLOCK:
    case packetTypes.TX:
    case packetTypes.NOTFOUND:
      {
        var entry = this.response(packetTypes.DATA, packet);
        assert(!entry || entry.jobs.length === 0);
        break;
      }
  }

  return this.response(packet.type, packet);
};

/**
 * Potentially timeout peer if it hasn't responded.
 * @private
 */

Peer.prototype.maybeTimeout = function maybeTimeout() {
  var now = util.ms();

  var _iteratorNormalCompletion10 = true;
  var _didIteratorError10 = false;
  var _iteratorError10 = undefined;

  try {
    for (var _iterator10 = (0, _getIterator3.default)(this.responseMap), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
      var _ref11 = _step10.value;

      var _ref12 = (0, _slicedToArray3.default)(_ref11, 2);

      var key = _ref12[0];
      var entry = _ref12[1];

      if (now > entry.timeout) {
        var name = packets.typesByVal[key];
        this.error('Peer is stalling (%s).', name.toLowerCase());
        this.destroy();
        return;
      }
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

  if (this.merkleBlock) {
    assert(this.merkleTime !== -1);
    if (now > this.merkleTime + Peer.BLOCK_TIMEOUT) {
      this.error('Peer is stalling (merkleblock).');
      this.destroy();
      return;
    }
  }

  if (this.syncing && this.loader && !this.options.isFull()) {
    if (now > this.blockTime + Peer.BLOCK_TIMEOUT) {
      this.error('Peer is stalling (block).');
      this.destroy();
      return;
    }
  }

  if (this.options.isFull() || !this.syncing) {
    var _iteratorNormalCompletion11 = true;
    var _didIteratorError11 = false;
    var _iteratorError11 = undefined;

    try {
      for (var _iterator11 = (0, _getIterator3.default)(this.blockMap.values()), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
        var time = _step11.value;

        if (now > time + Peer.BLOCK_TIMEOUT) {
          this.error('Peer is stalling (block).');
          this.destroy();
          return;
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

    var _iteratorNormalCompletion12 = true;
    var _didIteratorError12 = false;
    var _iteratorError12 = undefined;

    try {
      for (var _iterator12 = (0, _getIterator3.default)(this.txMap.values()), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
        var _time = _step12.value;

        if (now > _time + Peer.TX_TIMEOUT) {
          this.error('Peer is stalling (tx).');
          this.destroy();
          return;
        }
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

    var _iteratorNormalCompletion13 = true;
    var _didIteratorError13 = false;
    var _iteratorError13 = undefined;

    try {
      for (var _iterator13 = (0, _getIterator3.default)(this.compactBlocks.values()), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
        var block = _step13.value;

        if (now > block.now + Peer.RESPONSE_TIMEOUT) {
          this.error('Peer is stalling (blocktxn).');
          this.destroy();
          return;
        }
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
  }

  if (now > this.time + 60000) {
    assert(this.time !== 0);

    if (this.lastRecv === 0 || this.lastSend === 0) {
      this.error('Peer is stalling (no message).');
      this.destroy();
      return;
    }

    if (now > this.lastSend + Peer.TIMEOUT_INTERVAL) {
      this.error('Peer is stalling (send).');
      this.destroy();
      return;
    }

    var mult = this.version <= common.PONG_VERSION ? 4 : 1;

    if (now > this.lastRecv + Peer.TIMEOUT_INTERVAL * mult) {
      this.error('Peer is stalling (recv).');
      this.destroy();
      return;
    }

    if (this.challenge && now > this.lastPing + Peer.TIMEOUT_INTERVAL) {
      this.error('Peer is stalling (ping).');
      this.destroy();
      return;
    }
  }
};

/**
 * Wait for a packet to be received from peer.
 * @private
 * @param {Number} type - Packet type.
 * @param {Number} timeout
 * @returns {RequestEntry}
 */

Peer.prototype.request = function request(type, timeout) {
  if (this.destroyed) return null;

  var entry = this.responseMap.get(type);

  if (!entry) {
    entry = new RequestEntry();
    this.responseMap.set(type, entry);
  }

  entry.setTimeout(timeout);

  return entry;
};

/**
 * Fulfill awaiting requests created with {@link Peer#request}.
 * @private
 * @param {Number} type - Packet type.
 * @param {Object} payload
 */

Peer.prototype.response = function response(type, payload) {
  var entry = this.responseMap.get(type);

  if (!entry) return null;

  this.responseMap.delete(type);

  return entry;
};

/**
 * Wait for a packet to be received from peer.
 * @private
 * @param {Number} type - Packet type.
 * @returns {Promise} - Returns Object(payload).
 * Executed on timeout or once packet is received.
 */

Peer.prototype.wait = function wait(type, timeout) {
  var _this8 = this;

  return new _promise2.default(function (resolve, reject) {
    if (_this8.destroyed) {
      reject(new Error('Peer is destroyed (request).'));
      return;
    }

    var entry = _this8.request(type);

    entry.setTimeout(timeout);
    entry.addJob(resolve, reject);
  });
};

/**
 * Emit an error and destroy the peer.
 * @private
 * @param {...String|Error} err
 */

Peer.prototype.error = function error(err) {
  if (this.destroyed) return;

  if (typeof err === 'string') {
    var msg = util.fmt.apply(util, arguments);
    err = new Error(msg);
  }

  if (typeof err.code === 'string' && err.code[0] === 'E') {
    var _msg = err.code;
    err = new Error(_msg);
    err.code = _msg;
    err.message = 'Socket Error: ' + _msg;
  }

  err.message += ' (' + this.hostname() + ')';

  this.emit('error', err);
};

/**
 * Calculate peer block inv type (filtered,
 * compact, witness, or non-witness).
 * @returns {Number}
 */

Peer.prototype.blockType = function blockType() {
  if (this.options.spv) return invTypes.FILTERED_BLOCK;

  if (this.options.compact && this.hasCompactSupport() && this.hasCompact()) {
    return invTypes.CMPCT_BLOCK;
  }

  if (this.hasWitness()) return invTypes.WITNESS_BLOCK;

  return invTypes.BLOCK;
};

/**
 * Calculate peer tx inv type (witness or non-witness).
 * @returns {Number}
 */

Peer.prototype.txType = function txType() {
  if (this.hasWitness()) return invTypes.WITNESS_TX;

  return invTypes.TX;
};

/**
 * Send `getdata` to peer.
 * @param {InvItem[]} items
 */

Peer.prototype.getData = function getData(items) {
  this.send(new packets.GetDataPacket(items));
};

/**
 * Send batched `getdata` to peer.
 * @param {InvType} type
 * @param {Hash[]} hashes
 */

Peer.prototype.getItems = function getItems(type, hashes) {
  var items = [];

  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = (0, _getIterator3.default)(hashes), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var hash = _step14.value;

      items.push(new InvItem(type, hash));
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

  if (items.length === 0) return;

  this.getData(items);
};

/**
 * Send batched `getdata` to peer (blocks).
 * @param {Hash[]} hashes
 */

Peer.prototype.getBlock = function getBlock(hashes) {
  this.getItems(this.blockType(), hashes);
};

/**
 * Send batched `getdata` to peer (txs).
 * @param {Hash[]} hashes
 */

Peer.prototype.getTX = function getTX(hashes) {
  this.getItems(this.txType(), hashes);
};

/**
 * Send `getdata` to peer for a single block.
 * @param {Hash} hash
 */

Peer.prototype.getFullBlock = function getFullBlock(hash) {
  assert(!this.options.spv);

  var type = invTypes.BLOCK;

  if (this.hasWitness()) type |= InvItem.WITNESS_FLAG;

  this.getItems(type, [hash]);
};

/**
 * Handle a packet payload.
 * @method
 * @private
 * @param {Packet} packet
 */

Peer.prototype.readPacket = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(packet) {
    var unlock;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            if (!this.destroyed) {
              _context9.next = 2;
              break;
            }

            return _context9.abrupt('return');

          case 2:
            _context9.t0 = packet.type;
            _context9.next = _context9.t0 === packetTypes.ENCINIT ? 5 : _context9.t0 === packetTypes.ENCACK ? 5 : _context9.t0 === packetTypes.AUTHCHALLENGE ? 5 : _context9.t0 === packetTypes.AUTHREPLY ? 5 : _context9.t0 === packetTypes.AUTHPROPOSE ? 5 : _context9.t0 === packetTypes.PONG ? 5 : 13;
            break;

          case 5:
            _context9.prev = 5;

            this.socket.pause();
            _context9.next = 9;
            return this.handlePacket(packet);

          case 9:
            _context9.prev = 9;

            if (!this.destroyed) this.socket.resume();
            return _context9.finish(9);

          case 12:
            return _context9.abrupt('break', 25);

          case 13:
            _context9.next = 15;
            return this.locker.lock();

          case 15:
            unlock = _context9.sent;
            _context9.prev = 16;

            this.socket.pause();
            _context9.next = 20;
            return this.handlePacket(packet);

          case 20:
            _context9.prev = 20;

            if (!this.destroyed) this.socket.resume();
            unlock();
            return _context9.finish(20);

          case 24:
            return _context9.abrupt('break', 25);

          case 25:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[5,, 9, 12], [16,, 20, 24]]);
  }));

  function readPacket(_x2) {
    return _ref13.apply(this, arguments);
  }

  return readPacket;
}();

/**
 * Handle a packet payload without a lock.
 * @method
 * @private
 * @param {Packet} packet
 */

Peer.prototype.handlePacket = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(packet) {
    var entry;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            if (!this.destroyed) {
              _context10.next = 2;
              break;
            }

            throw new Error('Destroyed peer sent a packet.');

          case 2:

            if (this.bip151 && this.bip151.job && !this.bip151.completed && packet.type !== packetTypes.ENCINIT && packet.type !== packetTypes.ENCACK) {
              this.bip151.reject(new Error('Message before BIP151 handshake.'));
            }

            if (this.bip150 && this.bip150.job && !this.bip150.completed && packet.type !== packetTypes.AUTHCHALLENGE && packet.type !== packetTypes.AUTHREPLY && packet.type !== packetTypes.AUTHPROPOSE) {
              this.bip150.reject(new Error('Message before BIP150 auth.'));
            }

            entry = this.fulfill(packet);
            _context10.t0 = packet.type;
            _context10.next = _context10.t0 === packetTypes.VERSION ? 8 : _context10.t0 === packetTypes.VERACK ? 11 : _context10.t0 === packetTypes.PING ? 14 : _context10.t0 === packetTypes.PONG ? 17 : _context10.t0 === packetTypes.SENDHEADERS ? 20 : _context10.t0 === packetTypes.FILTERLOAD ? 23 : _context10.t0 === packetTypes.FILTERADD ? 26 : _context10.t0 === packetTypes.FILTERCLEAR ? 29 : _context10.t0 === packetTypes.FEEFILTER ? 32 : _context10.t0 === packetTypes.SENDCMPCT ? 35 : _context10.t0 === packetTypes.ENCINIT ? 38 : _context10.t0 === packetTypes.ENCACK ? 41 : _context10.t0 === packetTypes.AUTHCHALLENGE ? 44 : _context10.t0 === packetTypes.AUTHREPLY ? 47 : _context10.t0 === packetTypes.AUTHPROPOSE ? 50 : 53;
            break;

          case 8:
            _context10.next = 10;
            return this.handleVersion(packet);

          case 10:
            return _context10.abrupt('break', 53);

          case 11:
            _context10.next = 13;
            return this.handleVerack(packet);

          case 13:
            return _context10.abrupt('break', 53);

          case 14:
            _context10.next = 16;
            return this.handlePing(packet);

          case 16:
            return _context10.abrupt('break', 53);

          case 17:
            _context10.next = 19;
            return this.handlePong(packet);

          case 19:
            return _context10.abrupt('break', 53);

          case 20:
            _context10.next = 22;
            return this.handleSendHeaders(packet);

          case 22:
            return _context10.abrupt('break', 53);

          case 23:
            _context10.next = 25;
            return this.handleFilterLoad(packet);

          case 25:
            return _context10.abrupt('break', 53);

          case 26:
            _context10.next = 28;
            return this.handleFilterAdd(packet);

          case 28:
            return _context10.abrupt('break', 53);

          case 29:
            _context10.next = 31;
            return this.handleFilterClear(packet);

          case 31:
            return _context10.abrupt('break', 53);

          case 32:
            _context10.next = 34;
            return this.handleFeeFilter(packet);

          case 34:
            return _context10.abrupt('break', 53);

          case 35:
            _context10.next = 37;
            return this.handleSendCmpct(packet);

          case 37:
            return _context10.abrupt('break', 53);

          case 38:
            _context10.next = 40;
            return this.handleEncinit(packet);

          case 40:
            return _context10.abrupt('break', 53);

          case 41:
            _context10.next = 43;
            return this.handleEncack(packet);

          case 43:
            return _context10.abrupt('break', 53);

          case 44:
            _context10.next = 46;
            return this.handleAuthChallenge(packet);

          case 46:
            return _context10.abrupt('break', 53);

          case 47:
            _context10.next = 49;
            return this.handleAuthReply(packet);

          case 49:
            return _context10.abrupt('break', 53);

          case 50:
            _context10.next = 52;
            return this.handleAuthPropose(packet);

          case 52:
            return _context10.abrupt('break', 53);

          case 53:
            if (!this.onPacket) {
              _context10.next = 56;
              break;
            }

            _context10.next = 56;
            return this.onPacket(packet);

          case 56:

            this.emit('packet', packet);

            if (entry) entry.resolve(packet);

          case 58:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this);
  }));

  function handlePacket(_x3) {
    return _ref14.apply(this, arguments);
  }

  return handlePacket;
}();

/**
 * Handle `version` packet.
 * @method
 * @private
 * @param {VersionPacket} packet
 */

Peer.prototype.handleVersion = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(packet) {
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            if (!(this.version !== -1)) {
              _context11.next = 2;
              break;
            }

            throw new Error('Peer sent a duplicate version.');

          case 2:

            this.version = packet.version;
            this.services = packet.services;
            this.height = packet.height;
            this.agent = packet.agent;
            this.noRelay = packet.noRelay;
            this.local = packet.remote;

            if (this.network.selfConnect) {
              _context11.next = 11;
              break;
            }

            if (!this.options.hasNonce(packet.nonce)) {
              _context11.next = 11;
              break;
            }

            throw new Error('We connected to ourself. Oops.');

          case 11:
            if (!(this.version < common.MIN_VERSION)) {
              _context11.next = 13;
              break;
            }

            throw new Error('Peer does not support required protocol version.');

          case 13:
            if (!this.outbound) {
              _context11.next = 28;
              break;
            }

            if (this.services & services.NETWORK) {
              _context11.next = 16;
              break;
            }

            throw new Error('Peer does not support network services.');

          case 16:
            if (!this.options.headers) {
              _context11.next = 19;
              break;
            }

            if (!(this.version < common.HEADERS_VERSION)) {
              _context11.next = 19;
              break;
            }

            throw new Error('Peer does not support getheaders.');

          case 19:
            if (!this.options.spv) {
              _context11.next = 24;
              break;
            }

            if (this.services & services.BLOOM) {
              _context11.next = 22;
              break;
            }

            throw new Error('Peer does not support BIP37.');

          case 22:
            if (!(this.version < common.BLOOM_VERSION)) {
              _context11.next = 24;
              break;
            }

            throw new Error('Peer does not support BIP37.');

          case 24:
            if (!this.options.hasWitness()) {
              _context11.next = 27;
              break;
            }

            if (this.services & services.WITNESS) {
              _context11.next = 27;
              break;
            }

            throw new Error('Peer does not support segregated witness.');

          case 27:

            if (this.options.compact) {
              if (!this.hasCompactSupport()) {
                this.logger.debug('Peer does not support compact blocks (%s).', this.hostname());
              }
            }

          case 28:

            this.send(new packets.VerackPacket());

          case 29:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function handleVersion(_x4) {
    return _ref15.apply(this, arguments);
  }

  return handleVersion;
}();

/**
 * Handle `verack` packet.
 * @method
 * @private
 * @param {VerackPacket} packet
 */

Peer.prototype.handleVerack = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(packet) {
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            if (!this.ack) {
              _context12.next = 3;
              break;
            }

            this.logger.debug('Peer sent duplicate ack (%s).', this.hostname());
            return _context12.abrupt('return');

          case 3:

            this.ack = true;
            this.logger.debug('Received verack (%s).', this.hostname());

          case 5:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function handleVerack(_x5) {
    return _ref16.apply(this, arguments);
  }

  return handleVerack;
}();

/**
 * Handle `ping` packet.
 * @method
 * @private
 * @param {PingPacket} packet
 */

Peer.prototype.handlePing = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(packet) {
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            if (packet.nonce) {
              _context13.next = 2;
              break;
            }

            return _context13.abrupt('return');

          case 2:

            this.send(new packets.PongPacket(packet.nonce));

          case 3:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this);
  }));

  function handlePing(_x6) {
    return _ref17.apply(this, arguments);
  }

  return handlePing;
}();

/**
 * Handle `pong` packet.
 * @method
 * @private
 * @param {PongPacket} packet
 */

Peer.prototype.handlePong = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(packet) {
    var nonce, now;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            nonce = packet.nonce;
            now = util.ms();

            if (this.challenge) {
              _context14.next = 5;
              break;
            }

            this.logger.debug('Peer sent an unsolicited pong (%s).', this.hostname());
            return _context14.abrupt('return');

          case 5:
            if (nonce.equals(this.challenge)) {
              _context14.next = 12;
              break;
            }

            if (!nonce.equals(encoding.ZERO_U64)) {
              _context14.next = 10;
              break;
            }

            this.logger.debug('Peer sent a zero nonce (%s).', this.hostname());
            this.challenge = null;
            return _context14.abrupt('return');

          case 10:
            this.logger.debug('Peer sent the wrong nonce (%s).', this.hostname());
            return _context14.abrupt('return');

          case 12:

            if (now >= this.lastPing) {
              this.lastPong = now;
              if (this.minPing === -1) this.minPing = now - this.lastPing;
              this.minPing = Math.min(this.minPing, now - this.lastPing);
            } else {
              this.logger.debug('Timing mismatch (what?) (%s).', this.hostname());
            }

            this.challenge = null;

          case 14:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function handlePong(_x7) {
    return _ref18.apply(this, arguments);
  }

  return handlePong;
}();

/**
 * Handle `sendheaders` packet.
 * @method
 * @private
 * @param {SendHeadersPacket} packet
 */

Peer.prototype.handleSendHeaders = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(packet) {
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            if (!this.preferHeaders) {
              _context15.next = 3;
              break;
            }

            this.logger.debug('Peer sent a duplicate sendheaders (%s).', this.hostname());
            return _context15.abrupt('return');

          case 3:

            this.preferHeaders = true;

          case 4:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this);
  }));

  function handleSendHeaders(_x8) {
    return _ref19.apply(this, arguments);
  }

  return handleSendHeaders;
}();

/**
 * Handle `filterload` packet.
 * @method
 * @private
 * @param {FilterLoadPacket} packet
 */

Peer.prototype.handleFilterLoad = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(packet) {
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            if (packet.isWithinConstraints()) {
              _context16.next = 3;
              break;
            }

            this.increaseBan(100);
            return _context16.abrupt('return');

          case 3:

            this.spvFilter = packet.filter;
            this.noRelay = false;

          case 5:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function handleFilterLoad(_x9) {
    return _ref20.apply(this, arguments);
  }

  return handleFilterLoad;
}();

/**
 * Handle `filteradd` packet.
 * @method
 * @private
 * @param {FilterAddPacket} packet
 */

Peer.prototype.handleFilterAdd = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(packet) {
    var data;
    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            data = packet.data;

            if (!(data.length > consensus.MAX_SCRIPT_PUSH)) {
              _context17.next = 4;
              break;
            }

            this.increaseBan(100);
            return _context17.abrupt('return');

          case 4:

            if (this.spvFilter) this.spvFilter.add(data);

            this.noRelay = false;

          case 6:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this);
  }));

  function handleFilterAdd(_x10) {
    return _ref21.apply(this, arguments);
  }

  return handleFilterAdd;
}();

/**
 * Handle `filterclear` packet.
 * @method
 * @private
 * @param {FilterClearPacket} packet
 */

Peer.prototype.handleFilterClear = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(packet) {
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            if (this.spvFilter) this.spvFilter.reset();

            this.noRelay = false;

          case 2:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this);
  }));

  function handleFilterClear(_x11) {
    return _ref22.apply(this, arguments);
  }

  return handleFilterClear;
}();

/**
 * Handle `feefilter` packet.
 * @method
 * @private
 * @param {FeeFilterPacket} packet
 */

Peer.prototype.handleFeeFilter = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(packet) {
    var rate;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            rate = packet.rate;

            if (!(rate < 0 || rate > consensus.MAX_MONEY)) {
              _context19.next = 4;
              break;
            }

            this.increaseBan(100);
            return _context19.abrupt('return');

          case 4:

            this.feeRate = rate;

          case 5:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this);
  }));

  function handleFeeFilter(_x12) {
    return _ref23.apply(this, arguments);
  }

  return handleFeeFilter;
}();

/**
 * Handle `sendcmpct` packet.
 * @method
 * @private
 * @param {SendCmpctPacket}
 */

Peer.prototype.handleSendCmpct = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(packet) {
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            if (!(this.compactMode !== -1)) {
              _context20.next = 3;
              break;
            }

            this.logger.debug('Peer sent a duplicate sendcmpct (%s).', this.hostname());
            return _context20.abrupt('return');

          case 3:
            if (!(packet.version > 2)) {
              _context20.next = 6;
              break;
            }

            // Ignore
            this.logger.info('Peer request compact blocks version %d (%s).', packet.version, this.hostname());
            return _context20.abrupt('return');

          case 6:
            if (!(packet.mode > 1)) {
              _context20.next = 9;
              break;
            }

            this.logger.info('Peer request compact blocks mode %d (%s).', packet.mode, this.hostname());
            return _context20.abrupt('return');

          case 9:

            this.logger.info('Peer initialized compact blocks (mode=%d, version=%d) (%s).', packet.mode, packet.version, this.hostname());

            this.compactMode = packet.mode;
            this.compactWitness = packet.version === 2;

          case 12:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function handleSendCmpct(_x13) {
    return _ref24.apply(this, arguments);
  }

  return handleSendCmpct;
}();

/**
 * Handle `encinit` packet.
 * @method
 * @private
 * @param {EncinitPacket} packet
 */

Peer.prototype.handleEncinit = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(packet) {
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            if (this.bip151) {
              _context21.next = 2;
              break;
            }

            return _context21.abrupt('return');

          case 2:

            this.bip151.encinit(packet.publicKey, packet.cipher);

            this.send(this.bip151.toEncack());

          case 4:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function handleEncinit(_x14) {
    return _ref25.apply(this, arguments);
  }

  return handleEncinit;
}();

/**
 * Handle `encack` packet.
 * @method
 * @private
 * @param {EncackPacket} packet
 */

Peer.prototype.handleEncack = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(packet) {
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            if (this.bip151) {
              _context22.next = 2;
              break;
            }

            return _context22.abrupt('return');

          case 2:

            this.bip151.encack(packet.publicKey);

          case 3:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function handleEncack(_x15) {
    return _ref26.apply(this, arguments);
  }

  return handleEncack;
}();

/**
 * Handle `authchallenge` packet.
 * @method
 * @private
 * @param {AuthChallengePacket} packet
 */

Peer.prototype.handleAuthChallenge = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(packet) {
    var sig;
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            if (this.bip150) {
              _context23.next = 2;
              break;
            }

            return _context23.abrupt('return');

          case 2:
            sig = this.bip150.challenge(packet.hash);


            this.send(new packets.AuthReplyPacket(sig));

          case 4:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function handleAuthChallenge(_x16) {
    return _ref27.apply(this, arguments);
  }

  return handleAuthChallenge;
}();

/**
 * Handle `authreply` packet.
 * @method
 * @private
 * @param {AuthReplyPacket} packet
 */

Peer.prototype.handleAuthReply = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(packet) {
    var hash;
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            if (this.bip150) {
              _context24.next = 2;
              break;
            }

            return _context24.abrupt('return');

          case 2:
            hash = this.bip150.reply(packet.signature);


            if (hash) this.send(new packets.AuthProposePacket(hash));

          case 4:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function handleAuthReply(_x17) {
    return _ref28.apply(this, arguments);
  }

  return handleAuthReply;
}();

/**
 * Handle `authpropose` packet.
 * @method
 * @private
 * @param {AuthProposePacket} packet
 */

Peer.prototype.handleAuthPropose = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(packet) {
    var hash;
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            if (this.bip150) {
              _context25.next = 2;
              break;
            }

            return _context25.abrupt('return');

          case 2:
            hash = this.bip150.propose(packet.hash);


            this.send(new packets.AuthChallengePacket(hash));

          case 4:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this);
  }));

  function handleAuthPropose(_x18) {
    return _ref29.apply(this, arguments);
  }

  return handleAuthPropose;
}();

/**
 * Send `getheaders` to peer. Note that unlike
 * `getblocks`, `getheaders` can have a null locator.
 * @param {Hash[]?} locator - Chain locator.
 * @param {Hash?} stop - Hash to stop at.
 */

Peer.prototype.sendGetHeaders = function sendGetHeaders(locator, stop) {
  var packet = new packets.GetHeadersPacket(locator, stop);

  var hash = null;
  if (packet.locator.length > 0) hash = util.revHex(packet.locator[0]);

  var end = null;
  if (stop) end = util.revHex(stop);

  this.logger.debug('Requesting headers packet from peer with getheaders (%s).', this.hostname());

  this.logger.debug('Sending getheaders (hash=%s, stop=%s).', hash, end);

  this.send(packet);
};

/**
 * Send `getblocks` to peer.
 * @param {Hash[]} locator - Chain locator.
 * @param {Hash?} stop - Hash to stop at.
 */

Peer.prototype.sendGetBlocks = function sendGetBlocks(locator, stop) {
  var packet = new packets.GetBlocksPacket(locator, stop);

  var hash = null;
  if (packet.locator.length > 0) hash = util.revHex(packet.locator[0]);

  var end = null;
  if (stop) end = util.revHex(stop);

  this.logger.debug('Requesting inv packet from peer with getblocks (%s).', this.hostname());

  this.logger.debug('Sending getblocks (hash=%s, stop=%s).', hash, end);

  this.send(packet);
};

/**
 * Send `mempool` to peer.
 */

Peer.prototype.sendMempool = function sendMempool() {
  if (!this.handshake) return;

  if (!(this.services & services.BLOOM)) {
    this.logger.debug('Cannot request mempool for non-bloom peer (%s).', this.hostname());
    return;
  }

  this.logger.debug('Requesting inv packet from peer with mempool (%s).', this.hostname());

  this.send(new packets.MempoolPacket());
};

/**
 * Send `reject` to peer.
 * @param {Number} code
 * @param {String} reason
 * @param {String} msg
 * @param {Hash} hash
 */

Peer.prototype.sendReject = function sendReject(code, reason, msg, hash) {
  var reject = packets.RejectPacket.fromReason(code, reason, msg, hash);

  if (msg) {
    this.logger.debug('Rejecting %s %s (%s): code=%s reason=%s.', msg, util.revHex(hash), this.hostname(), code, reason);
  } else {
    this.logger.debug('Rejecting packet from %s: code=%s reason=%s.', this.hostname(), code, reason);
  }

  this.logger.debug('Sending reject packet to peer (%s).', this.hostname());

  this.send(reject);
};

/**
 * Send a `sendcmpct` packet.
 * @param {Number} mode
 */

Peer.prototype.sendCompact = function sendCompact(mode) {
  if (this.services & common.services.WITNESS) {
    if (this.version >= common.COMPACT_WITNESS_VERSION) {
      this.logger.info('Initializing witness compact blocks (%s).', this.hostname());
      this.send(new packets.SendCmpctPacket(mode, 2));
      return;
    }
  }

  if (this.version >= common.COMPACT_VERSION) {
    this.logger.info('Initializing normal compact blocks (%s).', this.hostname());

    this.send(new packets.SendCmpctPacket(mode, 1));
  }
};

/**
 * Increase banscore on peer.
 * @param {Number} score
 * @returns {Boolean}
 */

Peer.prototype.increaseBan = function increaseBan(score) {
  this.banScore += score;

  if (this.banScore >= this.options.banScore) {
    this.logger.debug('Ban threshold exceeded (%s).', this.hostname());
    this.ban();
    return true;
  }

  return false;
};

/**
 * Ban peer.
 */

Peer.prototype.ban = function ban() {
  this.emit('ban');
};

/**
 * Send a `reject` packet to peer.
 * @param {String} msg
 * @param {VerifyError} err
 * @returns {Boolean}
 */

Peer.prototype.reject = function reject(msg, err) {
  this.sendReject(err.code, err.reason, msg, err.hash);
  return this.increaseBan(err.score);
};

/**
 * Test whether required services are available.
 * @param {Number} services
 * @returns {Boolean}
 */

Peer.prototype.hasServices = function hasServices(services) {
  return (this.services & services) === services;
};

/**
 * Test whether the WITNESS service bit is set.
 * @returns {Boolean}
 */

Peer.prototype.hasWitness = function hasWitness() {
  return (this.services & services.WITNESS) !== 0;
};

/**
 * Test whether the peer supports compact blocks.
 * @returns {Boolean}
 */

Peer.prototype.hasCompactSupport = function hasCompactSupport() {
  if (this.version < common.COMPACT_VERSION) return false;

  if (!this.options.hasWitness()) return true;

  if (!(this.services & services.WITNESS)) return false;

  return this.version >= common.COMPACT_WITNESS_VERSION;
};

/**
 * Test whether the peer sent us a
 * compatible compact block handshake.
 * @returns {Boolean}
 */

Peer.prototype.hasCompact = function hasCompact() {
  if (this.compactMode === -1) return false;

  if (!this.options.hasWitness()) return true;

  if (!this.compactWitness) return false;

  return true;
};

/**
 * Inspect the peer.
 * @returns {String}
 */

Peer.prototype.inspect = function inspect() {
  return '<Peer:' + (' handshake=' + this.handshake) + (' host=' + this.hostname()) + (' outbound=' + this.outbound) + (' ping=' + this.minPing) + '>';
};

/**
 * PeerOptions
 * @alias module:net.PeerOptions
 * @constructor
 */

function PeerOptions(options) {
  if (!(this instanceof PeerOptions)) return new PeerOptions(options);

  this.network = Network.primary;
  this.logger = Logger.global;

  this.createSocket = tcp.createSocket;
  this.version = common.PROTOCOL_VERSION;
  this.services = common.LOCAL_SERVICES;
  this.agent = common.USER_AGENT;
  this.noRelay = false;
  this.spv = false;
  this.compact = false;
  this.headers = false;
  this.banScore = common.BAN_SCORE;

  this.getHeight = PeerOptions.getHeight;
  this.isFull = PeerOptions.isFull;
  this.hasWitness = PeerOptions.hasWitness;
  this.createNonce = PeerOptions.createNonce;
  this.hasNonce = PeerOptions.hasNonce;
  this.getRate = PeerOptions.getRate;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {PeerOptions}
 */

PeerOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Options are required.');

  if (options.network != null) this.network = Network.get(options.network);

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.createSocket != null) {
    assert(typeof options.createSocket === 'function');
    this.createSocket = options.createSocket;
  }

  if (options.version != null) {
    assert(typeof options.version === 'number');
    this.version = options.version;
  }

  if (options.services != null) {
    assert(typeof options.services === 'number');
    this.services = options.services;
  }

  if (options.agent != null) {
    assert(typeof options.agent === 'string');
    this.agent = options.agent;
  }

  if (options.noRelay != null) {
    assert(typeof options.noRelay === 'boolean');
    this.noRelay = options.noRelay;
  }

  if (options.spv != null) {
    assert(typeof options.spv === 'boolean');
    this.spv = options.spv;
  }

  if (options.compact != null) {
    assert(typeof options.compact === 'boolean');
    this.compact = options.compact;
  }

  if (options.headers != null) {
    assert(typeof options.headers === 'boolean');
    this.headers = options.headers;
  }

  if (options.banScore != null) {
    assert(typeof options.banScore === 'number');
    this.banScore = options.banScore;
  }

  if (options.getHeight != null) {
    assert(typeof options.getHeight === 'function');
    this.getHeight = options.getHeight;
  }

  if (options.isFull != null) {
    assert(typeof options.isFull === 'function');
    this.isFull = options.isFull;
  }

  if (options.hasWitness != null) {
    assert(typeof options.hasWitness === 'function');
    this.hasWitness = options.hasWitness;
  }

  if (options.createNonce != null) {
    assert(typeof options.createNonce === 'function');
    this.createNonce = options.createNonce;
  }

  if (options.hasNonce != null) {
    assert(typeof options.hasNonce === 'function');
    this.hasNonce = options.hasNonce;
  }

  if (options.getRate != null) {
    assert(typeof options.getRate === 'function');
    this.getRate = options.getRate;
  }

  return this;
};

/**
 * Instantiate options from object.
 * @param {Object} options
 * @returns {PeerOptions}
 */

PeerOptions.fromOptions = function fromOptions(options) {
  return new PeerOptions().fromOptions(options);
};

/**
 * Get the chain height.
 * @private
 * @returns {Number}
 */

PeerOptions.getHeight = function getHeight() {
  return 0;
};

/**
 * Test whether the chain is synced.
 * @private
 * @returns {Boolean}
 */

PeerOptions.isFull = function isFull() {
  return false;
};

/**
 * Whether segwit is enabled.
 * @private
 * @returns {Boolean}
 */

PeerOptions.hasWitness = function hasWitness() {
  return true;
};

/**
 * Create a version packet nonce.
 * @private
 * @param {String} hostname
 * @returns {Buffer}
 */

PeerOptions.createNonce = function createNonce(hostname) {
  return util.nonce();
};

/**
 * Test whether version nonce is ours.
 * @private
 * @param {Buffer} nonce
 * @returns {Boolean}
 */

PeerOptions.hasNonce = function hasNonce(nonce) {
  return false;
};

/**
 * Get fee rate for txid.
 * @private
 * @param {Hash} hash
 * @returns {Rate}
 */

PeerOptions.getRate = function getRate(hash) {
  return -1;
};

/**
 * RequestEntry
 * @constructor
 * @ignore
 */

function RequestEntry() {
  this.timeout = 0;
  this.jobs = [];
}

RequestEntry.prototype.addJob = function addJob(resolve, reject) {
  this.jobs.push(co.job(resolve, reject));
};

RequestEntry.prototype.setTimeout = function setTimeout(timeout) {
  this.timeout = util.ms() + timeout;
};

RequestEntry.prototype.reject = function reject(err) {
  var _iteratorNormalCompletion15 = true;
  var _didIteratorError15 = false;
  var _iteratorError15 = undefined;

  try {
    for (var _iterator15 = (0, _getIterator3.default)(this.jobs), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
      var job = _step15.value;

      job.reject(err);
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

  this.jobs.length = 0;
};

RequestEntry.prototype.resolve = function resolve(result) {
  var _iteratorNormalCompletion16 = true;
  var _didIteratorError16 = false;
  var _iteratorError16 = undefined;

  try {
    for (var _iterator16 = (0, _getIterator3.default)(this.jobs), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
      var job = _step16.value;

      job.resolve(result);
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

  this.jobs.length = 0;
};

/*
 * Expose
 */

module.exports = Peer;