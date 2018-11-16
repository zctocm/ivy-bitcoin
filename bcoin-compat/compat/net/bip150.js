/*!
 * bip150.js - peer auth.
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 * Resources:
 *   https://github.com/bitcoin/bips/blob/master/bip-0150.mediawiki
 */

'use strict';

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var path = require('path');
var EventEmitter = require('events');
var co = require('../utils/co');
var digest = require('../crypto/digest');
var random = require('../crypto/random');
var ccmp = require('../crypto/ccmp');
var packets = require('./packets');
var secp256k1 = require('../crypto/secp256k1');
var StaticWriter = require('../utils/staticwriter');
var base58 = require('../utils/base58');
var encoding = require('../utils/encoding');
var IP = require('../utils/ip');
var dns = require('./dns');
var fs = require('../utils/fs');
var Logger = require('../node/logger');

/**
 * Represents a BIP150 input/output stream.
 * @alias module:net.BIP150
 * @constructor
 * @param {BIP151} bip151
 * @param {String} host
 * @param {Boolean} outbound
 * @param {AuthDB} db
 * @param {Buffer} key - Identity key.
 * @property {BIP151} bip151
 * @property {BIP151Stream} input
 * @property {BIP151Stream} output
 * @property {String} hostname
 * @property {Boolean} outbound
 * @property {AuthDB} db
 * @property {Buffer} privateKey
 * @property {Buffer} publicKey
 * @property {Buffer} peerIdentity
 * @property {Boolean} challengeReceived
 * @property {Boolean} replyReceived
 * @property {Boolean} proposeReceived
 * @property {Boolean} challengeSent
 * @property {Boolean} auth
 * @property {Boolean} completed
 */

function BIP150(bip151, host, outbound, db, key) {
  if (!(this instanceof BIP150)) return new BIP150(bip151, host, outbound, db, key);

  EventEmitter.call(this);

  assert(bip151, 'BIP150 requires BIP151.');
  assert(typeof host === 'string', 'Hostname required.');
  assert(typeof outbound === 'boolean', 'Outbound flag required.');
  assert(db instanceof AuthDB, 'Auth DB required.');
  assert(Buffer.isBuffer(key), 'Identity key required.');

  this.bip151 = bip151;
  this.input = bip151.input;
  this.output = bip151.output;
  this.hostname = host;
  this.outbound = outbound;
  this.db = db;
  this.privateKey = key;
  this.publicKey = secp256k1.publicKeyCreate(key, true);

  this.peerIdentity = null;
  this.challengeReceived = false;
  this.replyReceived = false;
  this.proposeReceived = false;
  this.challengeSent = false;
  this.auth = false;
  this.completed = false;
  this.job = null;
  this.timeout = null;
  this.onAuth = null;

  this._init();
}

(0, _setPrototypeOf2.default)(BIP150.prototype, EventEmitter.prototype);

/**
 * Initialize BIP150.
 * @private
 */

BIP150.prototype._init = function _init() {
  if (this.outbound) this.peerIdentity = this.db.getKnown(this.hostname);
};

/**
 * Test whether the state should be
 * considered authed. This differs
 * for inbound vs. outbound.
 * @returns {Boolean}
 */

BIP150.prototype.isAuthed = function isAuthed() {
  if (this.outbound) return this.challengeSent && this.challengeReceived;
  return this.challengeReceived && this.replyReceived;
};

/**
 * Handle a received challenge hash.
 * Returns an authreply signature.
 * @param {Buffer} hash
 * @returns {Buffer}
 * @throws on auth failure
 */

BIP150.prototype.challenge = function challenge(hash) {
  var type = this.outbound ? 'r' : 'i';

  assert(this.bip151.handshake, 'No BIP151 handshake before challenge.');
  assert(!this.challengeReceived, 'Peer challenged twice.');
  this.challengeReceived = true;

  if (hash.equals(encoding.ZERO_HASH)) throw new Error('Auth failure.');

  var msg = this.hash(this.input.sid, type, this.publicKey);

  if (!ccmp(hash, msg)) return encoding.ZERO_SIG64;

  if (this.isAuthed()) {
    this.auth = true;
    this.emit('auth');
  }

  var sig = secp256k1.sign(msg, this.privateKey);

  // authreply
  return secp256k1.fromDER(sig);
};

/**
 * Handle a received reply signature.
 * Returns an authpropose hash.
 * @param {Buffer} data
 * @returns {Buffer}
 * @throws on auth failure
 */

BIP150.prototype.reply = function reply(data) {
  var type = this.outbound ? 'i' : 'r';

  assert(this.challengeSent, 'Unsolicited reply.');
  assert(!this.replyReceived, 'Peer replied twice.');
  this.replyReceived = true;

  if (data.equals(encoding.ZERO_SIG64)) throw new Error('Auth failure.');

  if (!this.peerIdentity) return random.randomBytes(32);

  var sig = secp256k1.toDER(data);
  var msg = this.hash(this.output.sid, type, this.peerIdentity);

  var result = secp256k1.verify(msg, sig, this.peerIdentity);

  if (!result) return random.randomBytes(32);

  if (this.isAuthed()) {
    this.auth = true;
    this.emit('auth');
    return null;
  }

  assert(this.outbound, 'No challenge received before reply on inbound.');

  // authpropose
  return this.hash(this.input.sid, 'p', this.publicKey);
};

/**
 * Handle a received propose hash.
 * Returns an authchallenge hash.
 * @param {Buffer} hash
 * @returns {Buffer}
 */

BIP150.prototype.propose = function propose(hash) {
  assert(!this.outbound, 'Outbound peer tried to propose.');
  assert(!this.challengeSent, 'Unsolicited propose.');
  assert(!this.proposeReceived, 'Peer proposed twice.');
  this.proposeReceived = true;

  var match = this.findAuthorized(hash);

  if (!match) return encoding.ZERO_HASH;

  this.peerIdentity = match;

  // Add them in case we ever connect to them.
  this.db.addKnown(this.hostname, this.peerIdentity);

  this.challengeSent = true;

  // authchallenge
  return this.hash(this.output.sid, 'r', this.peerIdentity);
};

/**
 * Create initial authchallenge hash
 * for the peer. The peer's identity
 * key must be known.
 * @returns {AuthChallengePacket}
 */

BIP150.prototype.toChallenge = function toChallenge() {
  assert(this.bip151.handshake, 'No BIP151 handshake before challenge.');
  assert(this.outbound, 'Cannot challenge an inbound connection.');
  assert(this.peerIdentity, 'Cannot challenge without a peer identity.');

  var msg = this.hash(this.output.sid, 'i', this.peerIdentity);

  assert(!this.challengeSent, 'Cannot initiate challenge twice.');
  this.challengeSent = true;

  return new packets.AuthChallengePacket(msg);
};

/**
 * Derive new cipher keys based on
 * BIP150 data. This differs from
 * the regular key derivation of BIP151.
 * @param {Buffer} sid - Sesson ID
 * @param {Buffer} key - `k1` or `k2`
 * @param {Buffer} req - Requesting Identity Key
 * @param {Buffer} res - Response Identity Key
 * @returns {Buffer}
 */

BIP150.prototype.rekey = function rekey(sid, key, req, res) {
  var seed = Buffer.allocUnsafe(130);
  sid.copy(seed, 0);
  key.copy(seed, 32);
  req.copy(seed, 64);
  res.copy(seed, 97);
  return digest.hash256(seed);
};

/**
 * Rekey the BIP151 input stream
 * using BIP150-style derivation.
 */

BIP150.prototype.rekeyInput = function rekeyInput() {
  var stream = this.input;
  var req = this.peerIdentity;
  var res = this.publicKey;
  var k1 = this.rekey(stream.sid, stream.k1, req, res);
  var k2 = this.rekey(stream.sid, stream.k2, req, res);
  stream.rekey(k1, k2);
};

/**
 * Rekey the BIP151 output stream
 * using BIP150-style derivation.
 */

BIP150.prototype.rekeyOutput = function rekeyOutput() {
  var stream = this.output;
  var req = this.publicKey;
  var res = this.peerIdentity;
  var k1 = this.rekey(stream.sid, stream.k1, req, res);
  var k2 = this.rekey(stream.sid, stream.k2, req, res);
  stream.rekey(k1, k2);
};

/**
 * Create a hash using the session ID.
 * @param {Buffer} sid
 * @param {String} ch
 * @param {Buffer} key
 * @returns {Buffer}
 */

BIP150.prototype.hash = function hash(sid, ch, key) {
  var data = Buffer.allocUnsafe(66);
  sid.copy(data, 0);
  data[32] = ch.charCodeAt(0);
  key.copy(data, 33);
  return digest.hash256(data);
};

/**
 * Find an authorized peer in the Auth
 * DB based on a proposal hash. Note
 * that the hash to find is specific
 * to the state of BIP151. This results
 * in an O(n) search.
 * @param {Buffer} hash
 * @returns {Buffer|null}
 */

BIP150.prototype.findAuthorized = function findAuthorized(hash) {
  // Scary O(n) stuff.
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(this.db.authorized), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      var msg = this.hash(this.output.sid, 'p', key);

      // XXX Do we really need a constant
      // time compare here? Do it just to
      // be safe I guess.
      if (ccmp(msg, hash)) return key;
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

  return null;
};

/**
 * Destroy the BIP150 stream and
 * any current running wait job.
 */

BIP150.prototype.destroy = function destroy() {
  if (!this.job) return;

  this.reject(new Error('BIP150 stream was destroyed.'));
};

/**
 * Cleanup wait job.
 * @private
 * @returns {Job}
 */

BIP150.prototype.cleanup = function cleanup() {
  var job = this.job;

  assert(!this.completed, 'Already completed.');
  assert(job, 'No completion job.');

  this.completed = true;
  this.job = null;

  if (this.timeout != null) {
    clearTimeout(this.timeout);
    this.timeout = null;
  }

  if (this.onAuth) {
    this.removeListener('auth', this.onAuth);
    this.onAuth = null;
  }

  return job;
};

/**
 * Resolve the current wait job.
 * @private
 * @param {Object} result
 */

BIP150.prototype.resolve = function resolve(result) {
  var job = this.cleanup();
  job.resolve(result);
};

/**
 * Reject the current wait job.
 * @private
 * @param {Error} err
 */

BIP150.prototype.reject = function reject(err) {
  var job = this.cleanup();
  job.reject(err);
};

/**
 * Wait for handshake to complete.
 * @param {Number} timeout
 * @returns {Promise}
 */

BIP150.prototype.wait = function wait(timeout) {
  var _this = this;

  return new _promise2.default(function (resolve, reject) {
    _this._wait(timeout, resolve, reject);
  });
};

/**
 * Wait for handshake to complete.
 * @private
 * @param {Number} timeout
 * @param {Function} resolve
 * @param {Function} reject
 */

BIP150.prototype._wait = function _wait(timeout, resolve, reject) {
  var _this2 = this;

  assert(!this.auth, 'Cannot wait for init after handshake.');

  this.job = co.job(resolve, reject);

  if (this.outbound && !this.peerIdentity) {
    this.reject(new Error('No identity for ' + this.hostname + '.'));
    return;
  }

  this.timeout = setTimeout(function () {
    _this2.reject(new Error('BIP150 handshake timed out.'));
  }, timeout);

  this.onAuth = this.resolve.bind(this);
  this.once('auth', this.onAuth);
};

/**
 * Serialize the peer's identity
 * key as a BIP150 "address".
 * @returns {Base58String}
 */

BIP150.prototype.getAddress = function getAddress() {
  assert(this.peerIdentity, 'Cannot serialize address.');
  return BIP150.address(this.peerIdentity);
};

/**
 * Serialize an identity key as a
 * BIP150 "address".
 * @returns {Base58String}
 */

BIP150.address = function address(key) {
  var bw = new StaticWriter(27);
  bw.writeU8(0x0f);
  bw.writeU16BE(0xff01);
  bw.writeBytes(digest.hash160(key));
  bw.writeChecksum();
  return base58.encode(bw.render());
};

/**
 * AuthDB
 * @alias module:net.AuthDB
 * @constructor
 */

function AuthDB(options) {
  if (!(this instanceof AuthDB)) return new AuthDB(options);

  this.logger = Logger.global;
  this.resolve = dns.lookup;
  this.prefix = null;
  this.dnsKnown = [];

  this.known = new _map2.default();
  this.authorized = [];

  this._init(options);
}

/**
 * Initialize authdb with options.
 * @param {Object} options
 */

AuthDB.prototype._init = function _init(options) {
  if (!options) return;

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger.context('authdb');
  }

  if (options.resolve != null) {
    assert(typeof options.resolve === 'function');
    this.resolve = options.resolve;
  }

  if (options.knownPeers != null) {
    assert((0, _typeof3.default)(options.knownPeers) === 'object');
    this.setKnown(options.knownPeers);
  }

  if (options.authPeers != null) {
    assert(Array.isArray(options.authPeers));
    this.setAuthorized(options.authPeers);
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
  }
};

/**
 * Open auth database (lookup known peers).
 * @method
 * @returns {Promise}
 */

AuthDB.prototype.open = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.readKnown();

          case 2:
            _context.next = 4;
            return this.readAuth();

          case 4:
            _context.next = 6;
            return this.lookup();

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
 * Close auth database.
 * @method
 * @returns {Promise}
 */

AuthDB.prototype.close = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function close() {
    return _ref2.apply(this, arguments);
  }

  return close;
}();

/**
 * Add a known peer.
 * @param {String} host - Peer Hostname
 * @param {Buffer} key - Identity Key
 */

AuthDB.prototype.addKnown = function addKnown(host, key) {
  assert(typeof host === 'string', 'Known host must be a string.');

  assert(Buffer.isBuffer(key) && key.length === 33, 'Invalid public key for known peer.');

  var addr = IP.fromHostname(host);

  if (addr.type === IP.types.DNS) {
    // Defer this for resolution.
    this.dnsKnown.push([addr, key]);
    return;
  }

  this.known.set(host, key);
};

/**
 * Add an authorized peer.
 * @param {Buffer} key - Identity Key
 */

AuthDB.prototype.addAuthorized = function addAuthorized(key) {
  assert(Buffer.isBuffer(key) && key.length === 33, 'Invalid public key for authorized peer.');
  this.authorized.push(key);
};

/**
 * Initialize known peers with a host->key map.
 * @param {Object} map
 */

AuthDB.prototype.setKnown = function setKnown(map) {
  this.known.clear();

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)((0, _keys2.default)(map)), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var host = _step2.value;

      var key = map[host];
      this.addKnown(host, key);
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
};

/**
 * Initialize authorized peers with a list of keys.
 * @param {Buffer[]} keys
 */

AuthDB.prototype.setAuthorized = function setAuthorized(keys) {
  this.authorized.length = 0;

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(keys), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var key = _step3.value;

      this.addAuthorized(key);
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
};

/**
 * Get a known peer key by hostname.
 * @param {String} hostname
 * @returns {Buffer|null}
 */

AuthDB.prototype.getKnown = function getKnown(hostname) {
  var known = this.known.get(hostname);

  if (known) return known;

  var addr = IP.fromHostname(hostname);

  return this.known.get(addr.host);
};

/**
 * Lookup known peers.
 * @method
 * @returns {Promise}
 */

AuthDB.prototype.lookup = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    var jobs, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _ref4, _ref5, addr, key;

    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            jobs = [];
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context3.prev = 4;


            for (_iterator4 = (0, _getIterator3.default)(this.dnsKnown); !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              _ref4 = _step4.value;
              _ref5 = (0, _slicedToArray3.default)(_ref4, 2);
              addr = _ref5[0];
              key = _ref5[1];

              jobs.push(this.populate(addr, key));
            }_context3.next = 12;
            break;

          case 8:
            _context3.prev = 8;
            _context3.t0 = _context3['catch'](4);
            _didIteratorError4 = true;
            _iteratorError4 = _context3.t0;

          case 12:
            _context3.prev = 12;
            _context3.prev = 13;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 15:
            _context3.prev = 15;

            if (!_didIteratorError4) {
              _context3.next = 18;
              break;
            }

            throw _iteratorError4;

          case 18:
            return _context3.finish(15);

          case 19:
            return _context3.finish(12);

          case 20:
            _context3.next = 22;
            return _promise2.default.all(jobs);

          case 22:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[4, 8, 12, 20], [13,, 15, 19]]);
  }));

  function lookup() {
    return _ref3.apply(this, arguments);
  }

  return lookup;
}();

/**
 * Populate known peers with hosts.
 * @method
 * @private
 * @param {Object} addr
 * @param {Buffer} key
 * @returns {Promise}
 */

AuthDB.prototype.populate = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(addr, key) {
    var hosts, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, host;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            assert(addr.type === IP.types.DNS, 'Resolved host passed.');

            this.logger.info('Resolving authorized hosts from: %s.', addr.host);

            hosts = void 0;
            _context4.prev = 3;
            _context4.next = 6;
            return this.resolve(addr.host);

          case 6:
            hosts = _context4.sent;
            _context4.next = 13;
            break;

          case 9:
            _context4.prev = 9;
            _context4.t0 = _context4['catch'](3);

            this.logger.error(_context4.t0);
            return _context4.abrupt('return');

          case 13:
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context4.prev = 16;


            for (_iterator5 = (0, _getIterator3.default)(hosts); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              host = _step5.value;

              if (addr.port !== 0) host = IP.toHostname(host, addr.port);

              this.known.set(host, key);
            }
            _context4.next = 24;
            break;

          case 20:
            _context4.prev = 20;
            _context4.t1 = _context4['catch'](16);
            _didIteratorError5 = true;
            _iteratorError5 = _context4.t1;

          case 24:
            _context4.prev = 24;
            _context4.prev = 25;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 27:
            _context4.prev = 27;

            if (!_didIteratorError5) {
              _context4.next = 30;
              break;
            }

            throw _iteratorError5;

          case 30:
            return _context4.finish(27);

          case 31:
            return _context4.finish(24);

          case 32:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[3, 9], [16, 20, 24, 32], [25,, 27, 31]]);
  }));

  function populate(_x, _x2) {
    return _ref6.apply(this, arguments);
  }

  return populate;
}();

/**
 * Parse known peers.
 * @param {String} text
 * @returns {Object}
 */

AuthDB.prototype.readKnown = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    var file, text;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            if (!fs.unsupported) {
              _context5.next = 2;
              break;
            }

            return _context5.abrupt('return');

          case 2:
            if (this.prefix) {
              _context5.next = 4;
              break;
            }

            return _context5.abrupt('return');

          case 4:
            file = path.join(this.prefix, 'known-peers');
            text = void 0;
            _context5.prev = 6;
            _context5.next = 9;
            return fs.readFile(file, 'utf8');

          case 9:
            text = _context5.sent;
            _context5.next = 17;
            break;

          case 12:
            _context5.prev = 12;
            _context5.t0 = _context5['catch'](6);

            if (!(_context5.t0.code === 'ENOENT')) {
              _context5.next = 16;
              break;
            }

            return _context5.abrupt('return');

          case 16:
            throw _context5.t0;

          case 17:

            this.parseKnown(text);

          case 18:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[6, 12]]);
  }));

  function readKnown() {
    return _ref7.apply(this, arguments);
  }

  return readKnown;
}();

/**
 * Parse known peers.
 * @param {String} text
 * @returns {Object}
 */

AuthDB.prototype.parseKnown = function parseKnown(text) {
  assert(typeof text === 'string');

  if (text.charCodeAt(0) === 0xfeff) text = text.substring(1);

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');

  var num = 0;

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(text.split('\n')), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var chunk = _step6.value;

      var line = chunk.trim();

      num += 1;

      if (line.length === 0) continue;

      if (line[0] === '#') continue;

      var parts = line.split(/\s+/);

      if (parts.length < 2) throw new Error('No key present on line ' + num + ': "' + line + '".');

      var hosts = parts[0].split(',');

      var host = void 0,
          addr = void 0;
      if (hosts.length >= 2) {
        host = hosts[0];
        addr = hosts[1];
      } else {
        host = null;
        addr = hosts[0];
      }

      var key = Buffer.from(parts[1], 'hex');

      if (key.length !== 33) throw new Error('Invalid key on line ' + num + ': "' + parts[1] + '".');

      if (host && host.length > 0) this.addKnown(host, key);

      if (addr.length === 0) continue;

      this.addKnown(addr, key);
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
};

/**
 * Parse known peers.
 * @param {String} text
 * @returns {Object}
 */

AuthDB.prototype.readAuth = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
    var file, text;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            if (!fs.unsupported) {
              _context6.next = 2;
              break;
            }

            return _context6.abrupt('return');

          case 2:
            if (this.prefix) {
              _context6.next = 4;
              break;
            }

            return _context6.abrupt('return');

          case 4:
            file = path.join(this.prefix, 'authorized-peers');
            text = void 0;
            _context6.prev = 6;
            _context6.next = 9;
            return fs.readFile(file, 'utf8');

          case 9:
            text = _context6.sent;
            _context6.next = 17;
            break;

          case 12:
            _context6.prev = 12;
            _context6.t0 = _context6['catch'](6);

            if (!(_context6.t0.code === 'ENOENT')) {
              _context6.next = 16;
              break;
            }

            return _context6.abrupt('return');

          case 16:
            throw _context6.t0;

          case 17:

            this.parseAuth(text);

          case 18:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[6, 12]]);
  }));

  function readAuth() {
    return _ref8.apply(this, arguments);
  }

  return readAuth;
}();

/**
 * Parse authorized peers.
 * @param {String} text
 * @returns {Buffer[]} keys
 */

AuthDB.prototype.parseAuth = function parseAuth(text) {
  assert(typeof text === 'string');

  if (text.charCodeAt(0) === 0xfeff) text = text.substring(1);

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');

  var num = 0;

  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(text.split('\n')), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var chunk = _step7.value;

      var line = chunk.trim();

      num += 1;

      if (line.length === 0) continue;

      if (line[0] === '#') continue;

      var key = Buffer.from(line, 'hex');

      if (key.length !== 33) throw new Error('Invalid key on line ' + num + ': "' + line + '".');

      this.addAuthorized(key);
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
};

/*
 * Expose
 */

exports = BIP150;

exports.BIP150 = BIP150;
exports.AuthDB = AuthDB;

module.exports = exports;