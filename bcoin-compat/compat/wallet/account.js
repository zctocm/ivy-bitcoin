/*!
 * account.js - account object for bcoin
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

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var util = require('../utils/util');
var assert = require('assert');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var encoding = require('../utils/encoding');
var Path = require('./path');
var common = require('./common');
var Script = require('../script/script');
var WalletKey = require('./walletkey');
var HD = require('../hd/hd');

/**
 * Represents a BIP44 Account belonging to a {@link Wallet}.
 * Note that this object does not enforce locks. Any method
 * that does a write is internal API only and will lead
 * to race conditions if used elsewhere.
 * @alias module:wallet.Account
 * @constructor
 * @param {Object} options
 * @param {WalletDB} options.db
 * @param {HDPublicKey} options.accountKey
 * @param {Boolean?} options.witness - Whether to use witness programs.
 * @param {Number} options.accountIndex - The BIP44 account index.
 * @param {Number?} options.receiveDepth - The index of the _next_ receiving
 * address.
 * @param {Number?} options.changeDepth - The index of the _next_ change
 * address.
 * @param {String?} options.type - Type of wallet (pubkeyhash, multisig)
 * (default=pubkeyhash).
 * @param {Number?} options.m - `m` value for multisig.
 * @param {Number?} options.n - `n` value for multisig.
 * @param {String?} options.wid - Wallet ID
 * @param {String?} options.name - Account name
 */

function Account(db, options) {
  if (!(this instanceof Account)) return new Account(db, options);

  assert(db, 'Database is required.');

  this.db = db;
  this.network = db.network;
  this.wallet = null;

  this.receive = null;
  this.change = null;
  this.nested = null;

  this.wid = 0;
  this.id = null;
  this.name = null;
  this.initialized = false;
  this.witness = this.db.options.witness === true;
  this.watchOnly = false;
  this.type = Account.types.PUBKEYHASH;
  this.m = 1;
  this.n = 1;
  this.accountIndex = 0;
  this.receiveDepth = 0;
  this.changeDepth = 0;
  this.nestedDepth = 0;
  this.lookahead = 10;
  this.accountKey = null;
  this.keys = [];

  if (options) this.fromOptions(options);
}

/**
 * Account types.
 * @enum {Number}
 * @default
 */

Account.types = {
  PUBKEYHASH: 0,
  MULTISIG: 1
};

/**
 * Account types by value.
 * @const {RevMap}
 */

Account.typesByVal = {
  0: 'pubkeyhash',
  1: 'multisig'
};

/**
 * Inject properties from options object.
 * @private
 * @param {Object} options
 */

Account.prototype.fromOptions = function fromOptions(options) {
  assert(options, 'Options are required.');
  assert(util.isU32(options.wid));
  assert(common.isName(options.id), 'Bad Wallet ID.');
  assert(HD.isHD(options.accountKey), 'Account key is required.');
  assert(util.isU32(options.accountIndex), 'Account index is required.');

  this.wid = options.wid;
  this.id = options.id;

  if (options.name != null) {
    assert(common.isName(options.name), 'Bad account name.');
    this.name = options.name;
  }

  if (options.initialized != null) {
    assert(typeof options.initialized === 'boolean');
    this.initialized = options.initialized;
  }

  if (options.witness != null) {
    assert(typeof options.witness === 'boolean');
    this.witness = options.witness;
  }

  if (options.watchOnly != null) {
    assert(typeof options.watchOnly === 'boolean');
    this.watchOnly = options.watchOnly;
  }

  if (options.type != null) {
    if (typeof options.type === 'string') {
      this.type = Account.types[options.type.toUpperCase()];
      assert(this.type != null);
    } else {
      assert(typeof options.type === 'number');
      this.type = options.type;
      assert(Account.typesByVal[this.type]);
    }
  }

  if (options.m != null) {
    assert(util.isU8(options.m));
    this.m = options.m;
  }

  if (options.n != null) {
    assert(util.isU8(options.n));
    this.n = options.n;
  }

  if (options.accountIndex != null) {
    assert(util.isU32(options.accountIndex));
    this.accountIndex = options.accountIndex;
  }

  if (options.receiveDepth != null) {
    assert(util.isU32(options.receiveDepth));
    this.receiveDepth = options.receiveDepth;
  }

  if (options.changeDepth != null) {
    assert(util.isU32(options.changeDepth));
    this.changeDepth = options.changeDepth;
  }

  if (options.nestedDepth != null) {
    assert(util.isU32(options.nestedDepth));
    this.nestedDepth = options.nestedDepth;
  }

  if (options.lookahead != null) {
    assert(util.isU32(options.lookahead));
    assert(options.lookahead >= 0);
    assert(options.lookahead <= Account.MAX_LOOKAHEAD);
    this.lookahead = options.lookahead;
  }

  this.accountKey = options.accountKey;

  if (this.n > 1) this.type = Account.types.MULTISIG;

  if (!this.name) this.name = this.accountIndex.toString(10);

  if (this.m < 1 || this.m > this.n) throw new Error('m ranges between 1 and n');

  if (options.keys) {
    assert(Array.isArray(options.keys));
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = (0, _getIterator3.default)(options.keys), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var key = _step.value;

        this.pushKey(key);
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
  }

  return this;
};

/**
 * Instantiate account from options.
 * @param {WalletDB} db
 * @param {Object} options
 * @returns {Account}
 */

Account.fromOptions = function fromOptions(db, options) {
  return new Account(db).fromOptions(options);
};

/*
 * Default address lookahead.
 * @const {Number}
 */

Account.MAX_LOOKAHEAD = 40;

/**
 * Attempt to intialize the account (generating
 * the first addresses along with the lookahead
 * addresses). Called automatically from the
 * walletdb.
 * @returns {Promise}
 */

Account.prototype.init = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!(this.keys.length !== this.n - 1)) {
              _context.next = 4;
              break;
            }

            assert(!this.initialized);
            this.save();
            return _context.abrupt('return');

          case 4:

            assert(this.receiveDepth === 0);
            assert(this.changeDepth === 0);
            assert(this.nestedDepth === 0);

            this.initialized = true;

            _context.next = 10;
            return this.initDepth();

          case 10:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function init() {
    return _ref.apply(this, arguments);
  }

  return init;
}();

/**
 * Open the account (done after retrieval).
 * @returns {Promise}
 */

Account.prototype.open = function open() {
  if (!this.initialized) return _promise2.default.resolve();

  if (this.receive) return _promise2.default.resolve();

  this.receive = this.deriveReceive(this.receiveDepth - 1);
  this.change = this.deriveChange(this.changeDepth - 1);

  if (this.witness) this.nested = this.deriveNested(this.nestedDepth - 1);

  return _promise2.default.resolve();
};

/**
 * Add a public account key to the account (multisig).
 * Does not update the database.
 * @param {HDPublicKey} key - Account (bip44)
 * key (can be in base58 form).
 * @throws Error on non-hdkey/non-accountkey.
 */

Account.prototype.pushKey = function pushKey(key) {
  if (typeof key === 'string') key = HD.PublicKey.fromBase58(key, this.network);

  assert(key.network === this.network, 'Network mismatch for account key.');

  if (!HD.isPublic(key)) throw new Error('Must add HD keys to wallet.');

  if (!key.isAccount()) throw new Error('Must add HD account keys to BIP44 wallet.');

  if (this.type !== Account.types.MULTISIG) throw new Error('Cannot add keys to non-multisig wallet.');

  if (key.equals(this.accountKey)) throw new Error('Cannot add own key.');

  var index = util.binaryInsert(this.keys, key, cmp, true);

  if (index === -1) return false;

  if (this.keys.length > this.n - 1) {
    util.binaryRemove(this.keys, key, cmp);
    throw new Error('Cannot add more keys.');
  }

  return true;
};

/**
 * Remove a public account key to the account (multisig).
 * Does not update the database.
 * @param {HDPublicKey} key - Account (bip44)
 * key (can be in base58 form).
 * @throws Error on non-hdkey/non-accountkey.
 */

Account.prototype.spliceKey = function spliceKey(key) {
  if (typeof key === 'string') key = HD.PublicKey.fromBase58(key, this.network);

  assert(key.network === this.network, 'Network mismatch for account key.');

  if (!HD.isPublic(key)) throw new Error('Must add HD keys to wallet.');

  if (!key.isAccount()) throw new Error('Must add HD account keys to BIP44 wallet.');

  if (this.type !== Account.types.MULTISIG) throw new Error('Cannot remove keys from non-multisig wallet.');

  if (this.keys.length === this.n - 1) throw new Error('Cannot remove key.');

  return util.binaryRemove(this.keys, key, cmp);
};

/**
 * Add a public account key to the account (multisig).
 * Saves the key in the wallet database.
 * @param {HDPublicKey} key
 * @returns {Promise}
 */

Account.prototype.addSharedKey = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(key) {
    var result;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            result = this.pushKey(key);
            _context2.next = 3;
            return this.hasDuplicate();

          case 3:
            if (!_context2.sent) {
              _context2.next = 6;
              break;
            }

            this.spliceKey(key);
            throw new Error('Cannot add a key from another account.');

          case 6:
            _context2.next = 8;
            return this.init();

          case 8:
            return _context2.abrupt('return', result);

          case 9:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function addSharedKey(_x) {
    return _ref2.apply(this, arguments);
  }

  return addSharedKey;
}();

/**
 * Ensure accounts are not sharing keys.
 * @private
 * @returns {Promise}
 */

Account.prototype.hasDuplicate = function hasDuplicate() {
  if (this.keys.length !== this.n - 1) return false;

  var ring = this.deriveReceive(0);
  var hash = ring.getScriptHash('hex');

  return this.wallet.hasAddress(hash);
};

/**
 * Remove a public account key from the account (multisig).
 * Remove the key from the wallet database.
 * @param {HDPublicKey} key
 * @returns {Promise}
 */

Account.prototype.removeSharedKey = function removeSharedKey(key) {
  var result = this.spliceKey(key);

  if (!result) return false;

  this.save();

  return true;
};

/**
 * Create a new receiving address (increments receiveDepth).
 * @returns {WalletKey}
 */

Account.prototype.createReceive = function createReceive() {
  return this.createKey(0);
};

/**
 * Create a new change address (increments receiveDepth).
 * @returns {WalletKey}
 */

Account.prototype.createChange = function createChange() {
  return this.createKey(1);
};

/**
 * Create a new change address (increments receiveDepth).
 * @returns {WalletKey}
 */

Account.prototype.createNested = function createNested() {
  return this.createKey(2);
};

/**
 * Create a new address (increments depth).
 * @param {Boolean} change
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Account.prototype.createKey = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(branch) {
    var key, lookahead;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            key = void 0, lookahead = void 0;
            _context3.t0 = branch;
            _context3.next = _context3.t0 === 0 ? 4 : _context3.t0 === 1 ? 11 : _context3.t0 === 2 ? 18 : 25;
            break;

          case 4:
            key = this.deriveReceive(this.receiveDepth);
            lookahead = this.deriveReceive(this.receiveDepth + this.lookahead);
            _context3.next = 8;
            return this.saveKey(lookahead);

          case 8:
            this.receiveDepth++;
            this.receive = key;
            return _context3.abrupt('break', 26);

          case 11:
            key = this.deriveChange(this.changeDepth);
            lookahead = this.deriveReceive(this.changeDepth + this.lookahead);
            _context3.next = 15;
            return this.saveKey(lookahead);

          case 15:
            this.changeDepth++;
            this.change = key;
            return _context3.abrupt('break', 26);

          case 18:
            key = this.deriveNested(this.nestedDepth);
            lookahead = this.deriveNested(this.nestedDepth + this.lookahead);
            _context3.next = 22;
            return this.saveKey(lookahead);

          case 22:
            this.nestedDepth++;
            this.nested = key;
            return _context3.abrupt('break', 26);

          case 25:
            throw new Error('Bad branch: ' + branch + '.');

          case 26:

            this.save();

            return _context3.abrupt('return', key);

          case 28:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function createKey(_x2) {
    return _ref3.apply(this, arguments);
  }

  return createKey;
}();

/**
 * Derive a receiving address at `index`. Do not increment depth.
 * @param {Number} index
 * @returns {WalletKey}
 */

Account.prototype.deriveReceive = function deriveReceive(index, master) {
  return this.deriveKey(0, index, master);
};

/**
 * Derive a change address at `index`. Do not increment depth.
 * @param {Number} index
 * @returns {WalletKey}
 */

Account.prototype.deriveChange = function deriveChange(index, master) {
  return this.deriveKey(1, index, master);
};

/**
 * Derive a nested address at `index`. Do not increment depth.
 * @param {Number} index
 * @returns {WalletKey}
 */

Account.prototype.deriveNested = function deriveNested(index, master) {
  if (!this.witness) throw new Error('Cannot derive nested on non-witness account.');

  return this.deriveKey(2, index, master);
};

/**
 * Derive an address from `path` object.
 * @param {Path} path
 * @param {MasterKey} master
 * @returns {WalletKey}
 */

Account.prototype.derivePath = function derivePath(path, master) {
  switch (path.keyType) {
    case Path.types.HD:
      {
        return this.deriveKey(path.branch, path.index, master);
      }
    case Path.types.KEY:
      {
        assert(this.type === Account.types.PUBKEYHASH);

        var data = path.data;

        if (path.encrypted) {
          data = master.decipher(data, path.hash);
          if (!data) return null;
        }

        return WalletKey.fromImport(this, data);
      }
    case Path.types.ADDRESS:
      {
        return null;
      }
    default:
      {
        throw new Error('Bad key type.');
      }
  }
};

/**
 * Derive an address at `index`. Do not increment depth.
 * @param {Number} branch - Whether the address on the change branch.
 * @param {Number} index
 * @returns {WalletKey}
 */

Account.prototype.deriveKey = function deriveKey(branch, index, master) {
  assert(typeof branch === 'number');

  var keys = [];

  var key = void 0;
  if (master && master.key && !this.watchOnly) {
    key = master.key.deriveAccount(44, this.accountIndex);
    key = key.derive(branch).derive(index);
  } else {
    key = this.accountKey.derive(branch).derive(index);
  }

  var ring = WalletKey.fromHD(this, key, branch, index);

  switch (this.type) {
    case Account.types.PUBKEYHASH:
      break;
    case Account.types.MULTISIG:
      keys.push(key.publicKey);

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = (0, _getIterator3.default)(this.keys), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var shared = _step2.value;

          var _key = shared.derive(branch).derive(index);
          keys.push(_key.publicKey);
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

      ring.script = Script.fromMultisig(this.m, this.n, keys);

      break;
  }

  return ring;
};

/**
 * Save the account to the database. Necessary
 * when address depth and keys change.
 * @returns {Promise}
 */

Account.prototype.save = function save() {
  return this.db.saveAccount(this);
};

/**
 * Save addresses to path map.
 * @param {WalletKey[]} rings
 * @returns {Promise}
 */

Account.prototype.saveKey = function saveKey(ring) {
  return this.db.saveKey(this.wallet, ring);
};

/**
 * Save paths to path map.
 * @param {Path[]} rings
 * @returns {Promise}
 */

Account.prototype.savePath = function savePath(path) {
  return this.db.savePath(this.wallet, path);
};

/**
 * Initialize address depths (including lookahead).
 * @returns {Promise}
 */

Account.prototype.initDepth = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
    var i, key, _i, _key2, _i2, _key3;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            // Receive Address
            this.receive = this.deriveReceive(0);
            this.receiveDepth = 1;

            _context4.next = 4;
            return this.saveKey(this.receive);

          case 4:
            i = 0;

          case 5:
            if (!(i < this.lookahead)) {
              _context4.next = 12;
              break;
            }

            key = this.deriveReceive(i + 1);
            _context4.next = 9;
            return this.saveKey(key);

          case 9:
            i++;
            _context4.next = 5;
            break;

          case 12:

            // Change Address
            this.change = this.deriveChange(0);
            this.changeDepth = 1;

            _context4.next = 16;
            return this.saveKey(this.change);

          case 16:
            _i = 0;

          case 17:
            if (!(_i < this.lookahead)) {
              _context4.next = 24;
              break;
            }

            _key2 = this.deriveChange(_i + 1);
            _context4.next = 21;
            return this.saveKey(_key2);

          case 21:
            _i++;
            _context4.next = 17;
            break;

          case 24:
            if (!this.witness) {
              _context4.next = 37;
              break;
            }

            this.nested = this.deriveNested(0);
            this.nestedDepth = 1;

            _context4.next = 29;
            return this.saveKey(this.nested);

          case 29:
            _i2 = 0;

          case 30:
            if (!(_i2 < this.lookahead)) {
              _context4.next = 37;
              break;
            }

            _key3 = this.deriveNested(_i2 + 1);
            _context4.next = 34;
            return this.saveKey(_key3);

          case 34:
            _i2++;
            _context4.next = 30;
            break;

          case 37:

            this.save();

          case 38:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function initDepth() {
    return _ref4.apply(this, arguments);
  }

  return initDepth;
}();

/**
 * Allocate new lookahead addresses if necessary.
 * @param {Number} receiveDepth
 * @param {Number} changeDepth
 * @param {Number} nestedDepth
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Account.prototype.syncDepth = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(receive, change, nested) {
    var derived, result, depth, i, key, _depth, _i3, _key4, _depth2, _i4, _key5;

    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            derived = false;
            result = null;

            if (!(receive > this.receiveDepth)) {
              _context5.next = 17;
              break;
            }

            depth = this.receiveDepth + this.lookahead;


            assert(receive <= depth + 1);

            i = depth;

          case 6:
            if (!(i < receive + this.lookahead)) {
              _context5.next = 13;
              break;
            }

            key = this.deriveReceive(i);
            _context5.next = 10;
            return this.saveKey(key);

          case 10:
            i++;
            _context5.next = 6;
            break;

          case 13:

            this.receive = this.deriveReceive(receive - 1);
            this.receiveDepth = receive;

            derived = true;
            result = this.receive;

          case 17:
            if (!(change > this.changeDepth)) {
              _context5.next = 31;
              break;
            }

            _depth = this.changeDepth + this.lookahead;


            assert(change <= _depth + 1);

            _i3 = _depth;

          case 21:
            if (!(_i3 < change + this.lookahead)) {
              _context5.next = 28;
              break;
            }

            _key4 = this.deriveChange(_i3);
            _context5.next = 25;
            return this.saveKey(_key4);

          case 25:
            _i3++;
            _context5.next = 21;
            break;

          case 28:

            this.change = this.deriveChange(change - 1);
            this.changeDepth = change;

            derived = true;

          case 31:
            if (!(this.witness && nested > this.nestedDepth)) {
              _context5.next = 46;
              break;
            }

            _depth2 = this.nestedDepth + this.lookahead;


            assert(nested <= _depth2 + 1);

            _i4 = _depth2;

          case 35:
            if (!(_i4 < nested + this.lookahead)) {
              _context5.next = 42;
              break;
            }

            _key5 = this.deriveNested(_i4);
            _context5.next = 39;
            return this.saveKey(_key5);

          case 39:
            _i4++;
            _context5.next = 35;
            break;

          case 42:

            this.nested = this.deriveNested(nested - 1);
            this.nestedDepth = nested;

            derived = true;
            result = this.nested;

          case 46:

            if (derived) this.save();

            return _context5.abrupt('return', result);

          case 48:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function syncDepth(_x3, _x4, _x5) {
    return _ref5.apply(this, arguments);
  }

  return syncDepth;
}();

/**
 * Allocate new lookahead addresses.
 * @param {Number} lookahead
 * @returns {Promise}
 */

Account.prototype.setLookahead = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(lookahead) {
    var diff, depth, target, i, key, _depth3, _target, _i5, _key6, _depth4, _target2, _i6, _key7;

    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            if (!(lookahead === this.lookahead)) {
              _context6.next = 3;
              break;
            }

            this.db.logger.warning('Lookahead is not changing for: %s/%s.', this.id, this.name);
            return _context6.abrupt('return');

          case 3:
            if (!(lookahead < this.lookahead)) {
              _context6.next = 13;
              break;
            }

            diff = this.lookahead - lookahead;


            this.receiveDepth += diff;
            this.receive = this.deriveReceive(this.receiveDepth - 1);

            this.changeDepth += diff;
            this.change = this.deriveChange(this.changeDepth - 1);

            if (this.witness) {
              this.nestedDepth += diff;
              this.nested = this.deriveNested(this.nestedDepth - 1);
            }

            this.lookahead = lookahead;

            this.save();

            return _context6.abrupt('return');

          case 13:
            depth = this.receiveDepth + this.lookahead;
            target = this.receiveDepth + lookahead;
            i = depth;

          case 16:
            if (!(i < target)) {
              _context6.next = 23;
              break;
            }

            key = this.deriveReceive(i);
            _context6.next = 20;
            return this.saveKey(key);

          case 20:
            i++;
            _context6.next = 16;
            break;

          case 23:
            _depth3 = this.changeDepth + this.lookahead;
            _target = this.changeDepth + lookahead;
            _i5 = _depth3;

          case 26:
            if (!(_i5 < _target)) {
              _context6.next = 33;
              break;
            }

            _key6 = this.deriveChange(_i5);
            _context6.next = 30;
            return this.saveKey(_key6);

          case 30:
            _i5++;
            _context6.next = 26;
            break;

          case 33:
            if (!this.witness) {
              _context6.next = 44;
              break;
            }

            _depth4 = this.nestedDepth + this.lookahead;
            _target2 = this.nestedDepth + lookahead;
            _i6 = _depth4;

          case 37:
            if (!(_i6 < _target2)) {
              _context6.next = 44;
              break;
            }

            _key7 = this.deriveNested(_i6);
            _context6.next = 41;
            return this.saveKey(_key7);

          case 41:
            _i6++;
            _context6.next = 37;
            break;

          case 44:

            this.lookahead = lookahead;
            this.save();

          case 46:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function setLookahead(_x6) {
    return _ref6.apply(this, arguments);
  }

  return setLookahead;
}();

/**
 * Get current receive address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Account.prototype.getAddress = function getAddress(enc) {
  return this.getReceive(enc);
};

/**
 * Get current receive address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Account.prototype.getReceive = function getReceive(enc) {
  if (!this.receive) return null;
  return this.receive.getAddress(enc);
};

/**
 * Get current change address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Account.prototype.getChange = function getChange(enc) {
  if (!this.change) return null;

  return this.change.getAddress(enc);
};

/**
 * Get current nested address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Account.prototype.getNested = function getNested(enc) {
  if (!this.nested) return null;

  return this.nested.getAddress(enc);
};

/**
 * Convert the account to a more inspection-friendly object.
 * @returns {Object}
 */

Account.prototype.inspect = function inspect() {
  return {
    wid: this.wid,
    name: this.name,
    network: this.network,
    initialized: this.initialized,
    witness: this.witness,
    watchOnly: this.watchOnly,
    type: Account.typesByVal[this.type].toLowerCase(),
    m: this.m,
    n: this.n,
    accountIndex: this.accountIndex,
    receiveDepth: this.receiveDepth,
    changeDepth: this.changeDepth,
    nestedDepth: this.nestedDepth,
    lookahead: this.lookahead,
    address: this.initialized ? this.receive.getAddress() : null,
    nestedAddress: this.initialized && this.nested ? this.nested.getAddress() : null,
    accountKey: this.accountKey.toBase58(),
    keys: this.keys.map(function (key) {
      return key.toBase58();
    })
  };
};

/**
 * Convert the account to an object suitable for
 * serialization.
 * @returns {Object}
 */

Account.prototype.toJSON = function toJSON(minimal) {
  return {
    wid: minimal ? undefined : this.wid,
    id: minimal ? undefined : this.id,
    name: this.name,
    initialized: this.initialized,
    witness: this.witness,
    watchOnly: this.watchOnly,
    type: Account.typesByVal[this.type].toLowerCase(),
    m: this.m,
    n: this.n,
    accountIndex: this.accountIndex,
    receiveDepth: this.receiveDepth,
    changeDepth: this.changeDepth,
    nestedDepth: this.nestedDepth,
    lookahead: this.lookahead,
    receiveAddress: this.receive ? this.receive.getAddress('string') : null,
    nestedAddress: this.nested ? this.nested.getAddress('string') : null,
    changeAddress: this.change ? this.change.getAddress('string') : null,
    accountKey: this.accountKey.toBase58(),
    keys: this.keys.map(function (key) {
      return key.toBase58();
    })
  };
};

/**
 * Calculate serialization size.
 * @returns {Number}
 */

Account.prototype.getSize = function getSize() {
  var size = 0;
  size += encoding.sizeVarString(this.name, 'ascii');
  size += 105;
  size += this.keys.length * 82;
  return size;
};

/**
 * Serialize the account.
 * @returns {Buffer}
 */

Account.prototype.toRaw = function toRaw() {
  var size = this.getSize();
  var bw = new StaticWriter(size);

  bw.writeVarString(this.name, 'ascii');
  bw.writeU8(this.initialized ? 1 : 0);
  bw.writeU8(this.witness ? 1 : 0);
  bw.writeU8(this.type);
  bw.writeU8(this.m);
  bw.writeU8(this.n);
  bw.writeU32(this.accountIndex);
  bw.writeU32(this.receiveDepth);
  bw.writeU32(this.changeDepth);
  bw.writeU32(this.nestedDepth);
  bw.writeU8(this.lookahead);
  bw.writeBytes(this.accountKey.toRaw());
  bw.writeU8(this.keys.length);

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.keys), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var key = _step3.value;

      bw.writeBytes(key.toRaw());
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

  return bw.render();
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 * @returns {Object}
 */

Account.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);

  this.name = br.readVarString('ascii');
  this.initialized = br.readU8() === 1;
  this.witness = br.readU8() === 1;
  this.type = br.readU8();
  this.m = br.readU8();
  this.n = br.readU8();
  this.accountIndex = br.readU32();
  this.receiveDepth = br.readU32();
  this.changeDepth = br.readU32();
  this.nestedDepth = br.readU32();
  this.lookahead = br.readU8();
  this.accountKey = HD.PublicKey.fromRaw(br.readBytes(82));

  assert(Account.typesByVal[this.type]);

  var count = br.readU8();

  for (var i = 0; i < count; i++) {
    var key = HD.PublicKey.fromRaw(br.readBytes(82));
    this.pushKey(key);
  }

  return this;
};

/**
 * Instantiate a account from serialized data.
 * @param {WalletDB} data
 * @param {Buffer} data
 * @returns {Account}
 */

Account.fromRaw = function fromRaw(db, data) {
  return new Account(db).fromRaw(data);
};

/**
 * Test an object to see if it is a Account.
 * @param {Object} obj
 * @returns {Boolean}
 */

Account.isAccount = function isAccount(obj) {
  return obj instanceof Account;
};

/*
 * Helpers
 */

function cmp(a, b) {
  return a.compare(b);
}

/*
 * Expose
 */

module.exports = Account;