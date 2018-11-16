/*!
 * wallet.js - wallet object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var Network = require('../protocol/network');
var util = require('../utils/util');
var encoding = require('../utils/encoding');
var Lock = require('../utils/lock');
var MappedLock = require('../utils/mappedlock');
var digest = require('../crypto/digest');
var cleanse = require('../crypto/cleanse');
var BufferReader = require('../utils/reader');
var StaticWriter = require('../utils/staticwriter');
var base58 = require('../utils/base58');
var TXDB = require('./txdb');
var Path = require('./path');
var common = require('./common');
var Address = require('../primitives/address');
var MTX = require('../primitives/mtx');
var Script = require('../script/script');
var WalletKey = require('./walletkey');
var HD = require('../hd/hd');
var Output = require('../primitives/output');
var Account = require('./account');
var MasterKey = require('./masterkey');
var LRU = require('../utils/lru');
var policy = require('../protocol/policy');
var consensus = require('../protocol/consensus');
var Mnemonic = HD.Mnemonic;

/**
 * BIP44 Wallet
 * @alias module:wallet.Wallet
 * @constructor
 * @param {Object} options
 * @param {WalletDB} options.db
 * present, no coins will be available.
 * @param {(HDPrivateKey|HDPublicKey)?} options.master - Master HD key. If not
 * present, it will be generated.
 * @param {Boolean?} options.witness - Whether to use witness programs.
 * @param {Number?} options.accountIndex - The BIP44 account index (default=0).
 * @param {Number?} options.receiveDepth - The index of the _next_ receiving
 * address.
 * @param {Number?} options.changeDepth - The index of the _next_ change
 * address.
 * @param {String?} options.type - Type of wallet (pubkeyhash, multisig)
 * (default=pubkeyhash).
 * @param {Boolean?} options.compressed - Whether to use compressed
 * public keys (default=true).
 * @param {Number?} options.m - `m` value for multisig.
 * @param {Number?} options.n - `n` value for multisig.
 * @param {String?} options.id - Wallet ID (used for storage)
 * @param {String?} options.mnemonic - mnemonic phrase to use to instantiate an
 * hd private key for wallet
 * (default=account key "address").
 */

function Wallet(db, options) {
  if (!(this instanceof Wallet)) return new Wallet(db, options);

  EventEmitter.call(this);

  assert(db, 'DB required.');

  this.db = db;
  this.network = db.network;
  this.logger = db.logger;
  this.readLock = new MappedLock();
  this.writeLock = new Lock();
  this.fundLock = new Lock();
  this.indexCache = new LRU(10000);
  this.accountCache = new LRU(10000);
  this.pathCache = new LRU(100000);
  this.current = null;

  this.wid = 0;
  this.id = null;
  this.initialized = false;
  this.watchOnly = false;
  this.accountDepth = 0;
  this.token = encoding.ZERO_HASH;
  this.tokenDepth = 0;
  this.master = new MasterKey();

  this.txdb = new TXDB(this);
  this.account = null;

  if (options) this.fromOptions(options);
}

(0, _setPrototypeOf2.default)(Wallet.prototype, EventEmitter.prototype);

/**
 * Inject properties from options object.
 * @private
 * @param {Object} options
 */

Wallet.prototype.fromOptions = function fromOptions(options) {
  var key = options.master;
  var id = void 0,
      token = void 0,
      mnemonic = void 0;

  if (key) {
    if (typeof key === 'string') key = HD.PrivateKey.fromBase58(key, this.network);

    assert(HD.isPrivate(key), 'Must create wallet with hd private key.');
  } else {
    mnemonic = new Mnemonic(options.mnemonic);
    key = HD.fromMnemonic(mnemonic, this.network);
  }

  assert(key.network === this.network, 'Network mismatch for master key.');

  this.master.fromKey(key, mnemonic);

  if (options.wid != null) {
    assert(util.isU32(options.wid));
    this.wid = options.wid;
  }

  if (options.id) {
    assert(common.isName(options.id), 'Bad wallet ID.');
    id = options.id;
  }

  if (options.initialized != null) {
    assert(typeof options.initialized === 'boolean');
    this.initialized = options.initialized;
  }

  if (options.watchOnly != null) {
    assert(typeof options.watchOnly === 'boolean');
    this.watchOnly = options.watchOnly;
  }

  if (options.accountDepth != null) {
    assert(util.isU32(options.accountDepth));
    this.accountDepth = options.accountDepth;
  }

  if (options.token) {
    assert(Buffer.isBuffer(options.token));
    assert(options.token.length === 32);
    token = options.token;
  }

  if (options.tokenDepth != null) {
    assert(util.isU32(options.tokenDepth));
    this.tokenDepth = options.tokenDepth;
  }

  if (!id) id = this.getID();

  if (!token) token = this.getToken(this.tokenDepth);

  this.id = id;
  this.token = token;

  return this;
};

/**
 * Instantiate wallet from options.
 * @param {WalletDB} db
 * @param {Object} options
 * @returns {Wallet}
 */

Wallet.fromOptions = function fromOptions(db, options) {
  return new Wallet(db).fromOptions(options);
};

/**
 * Attempt to intialize the wallet (generating
 * the first addresses along with the lookahead
 * addresses). Called automatically from the
 * walletdb.
 * @returns {Promise}
 */

Wallet.prototype.init = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(options) {
    var passphrase, account;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            passphrase = options.passphrase;


            assert(!this.initialized);
            this.initialized = true;

            if (!passphrase) {
              _context.next = 6;
              break;
            }

            _context.next = 6;
            return this.master.encrypt(passphrase);

          case 6:
            _context.next = 8;
            return this._createAccount(options, passphrase);

          case 8:
            account = _context.sent;

            assert(account);

            this.account = account;

            this.logger.info('Wallet initialized (%s).', this.id);

            _context.next = 14;
            return this.txdb.open();

          case 14:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function init(_x) {
    return _ref.apply(this, arguments);
  }

  return init;
}();

/**
 * Open wallet (done after retrieval).
 * @returns {Promise}
 */

Wallet.prototype.open = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    var account;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            assert(this.initialized);

            _context2.next = 3;
            return this.getAccount(0);

          case 3:
            account = _context2.sent;

            if (account) {
              _context2.next = 6;
              break;
            }

            throw new Error('Default account not found.');

          case 6:

            this.account = account;

            this.logger.info('Wallet opened (%s).', this.id);

            _context2.next = 10;
            return this.txdb.open();

          case 10:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function open() {
    return _ref2.apply(this, arguments);
  }

  return open;
}();

/**
 * Close the wallet, unregister with the database.
 * @returns {Promise}
 */

Wallet.prototype.destroy = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    var unlock1, unlock2;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock1 = _context3.sent;
            _context3.next = 5;
            return this.fundLock.lock();

          case 5:
            unlock2 = _context3.sent;
            _context3.prev = 6;

            this.db.unregister(this);
            _context3.next = 10;
            return this.master.destroy();

          case 10:
            this.readLock.destroy();
            this.writeLock.destroy();
            this.fundLock.destroy();

          case 13:
            _context3.prev = 13;

            unlock2();
            unlock1();
            return _context3.finish(13);

          case 17:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[6,, 13, 17]]);
  }));

  function destroy() {
    return _ref3.apply(this, arguments);
  }

  return destroy;
}();

/**
 * Add a public account key to the wallet (multisig).
 * Saves the key in the wallet database.
 * @param {(Number|String)} acct
 * @param {HDPublicKey} key
 * @returns {Promise}
 */

Wallet.prototype.addSharedKey = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(acct, key) {
    var unlock;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context4.sent;
            _context4.prev = 3;
            _context4.next = 6;
            return this._addSharedKey(acct, key);

          case 6:
            return _context4.abrupt('return', _context4.sent);

          case 7:
            _context4.prev = 7;

            unlock();
            return _context4.finish(7);

          case 10:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[3,, 7, 10]]);
  }));

  function addSharedKey(_x2, _x3) {
    return _ref4.apply(this, arguments);
  }

  return addSharedKey;
}();

/**
 * Add a public account key to the wallet without a lock.
 * @private
 * @param {(Number|String)} acct
 * @param {HDPublicKey} key
 * @returns {Promise}
 */

Wallet.prototype._addSharedKey = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(acct, key) {
    var account, result;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            if (!key) {
              key = acct;
              acct = null;
            }

            if (acct == null) acct = 0;

            _context5.next = 4;
            return this.getAccount(acct);

          case 4:
            account = _context5.sent;

            if (account) {
              _context5.next = 7;
              break;
            }

            throw new Error('Account not found.');

          case 7:

            this.start();

            result = void 0;
            _context5.prev = 9;
            _context5.next = 12;
            return account.addSharedKey(key);

          case 12:
            result = _context5.sent;
            _context5.next = 19;
            break;

          case 15:
            _context5.prev = 15;
            _context5.t0 = _context5['catch'](9);

            this.drop();
            throw _context5.t0;

          case 19:
            _context5.next = 21;
            return this.commit();

          case 21:
            return _context5.abrupt('return', result);

          case 22:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[9, 15]]);
  }));

  function _addSharedKey(_x4, _x5) {
    return _ref5.apply(this, arguments);
  }

  return _addSharedKey;
}();

/**
 * Remove a public account key from the wallet (multisig).
 * @param {(Number|String)} acct
 * @param {HDPublicKey} key
 * @returns {Promise}
 */

Wallet.prototype.removeSharedKey = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(acct, key) {
    var unlock;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _context6.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context6.sent;
            _context6.prev = 3;
            _context6.next = 6;
            return this._removeSharedKey(acct, key);

          case 6:
            return _context6.abrupt('return', _context6.sent);

          case 7:
            _context6.prev = 7;

            unlock();
            return _context6.finish(7);

          case 10:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[3,, 7, 10]]);
  }));

  function removeSharedKey(_x6, _x7) {
    return _ref6.apply(this, arguments);
  }

  return removeSharedKey;
}();

/**
 * Remove a public account key from the wallet (multisig).
 * @private
 * @param {(Number|String)} acct
 * @param {HDPublicKey} key
 * @returns {Promise}
 */

Wallet.prototype._removeSharedKey = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(acct, key) {
    var account, result;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            if (!key) {
              key = acct;
              acct = null;
            }

            if (acct == null) acct = 0;

            _context7.next = 4;
            return this.getAccount(acct);

          case 4:
            account = _context7.sent;

            if (account) {
              _context7.next = 7;
              break;
            }

            throw new Error('Account not found.');

          case 7:

            this.start();

            result = void 0;
            _context7.prev = 9;
            _context7.next = 12;
            return account.removeSharedKey(key);

          case 12:
            result = _context7.sent;
            _context7.next = 19;
            break;

          case 15:
            _context7.prev = 15;
            _context7.t0 = _context7['catch'](9);

            this.drop();
            throw _context7.t0;

          case 19:
            _context7.next = 21;
            return this.commit();

          case 21:
            return _context7.abrupt('return', result);

          case 22:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this, [[9, 15]]);
  }));

  function _removeSharedKey(_x8, _x9) {
    return _ref7.apply(this, arguments);
  }

  return _removeSharedKey;
}();

/**
 * Change or set master key's passphrase.
 * @param {(String|Buffer)?} old
 * @param {String|Buffer} new_
 * @returns {Promise}
 */

Wallet.prototype.setPassphrase = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(old, new_) {
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            if (!old) {
              _context8.next = 3;
              break;
            }

            _context8.next = 3;
            return this.decrypt(old);

          case 3:
            if (!new_) {
              _context8.next = 6;
              break;
            }

            _context8.next = 6;
            return this.encrypt(new_);

          case 6:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function setPassphrase(_x10, _x11) {
    return _ref8.apply(this, arguments);
  }

  return setPassphrase;
}();

/**
 * Encrypt the wallet permanently.
 * @param {String|Buffer} passphrase
 * @returns {Promise}
 */

Wallet.prototype.encrypt = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(passphrase) {
    var unlock;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _context9.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context9.sent;
            _context9.prev = 3;
            _context9.next = 6;
            return this._encrypt(passphrase);

          case 6:
            return _context9.abrupt('return', _context9.sent);

          case 7:
            _context9.prev = 7;

            unlock();
            return _context9.finish(7);

          case 10:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[3,, 7, 10]]);
  }));

  function encrypt(_x12) {
    return _ref9.apply(this, arguments);
  }

  return encrypt;
}();

/**
 * Encrypt the wallet permanently, without a lock.
 * @private
 * @param {String|Buffer} passphrase
 * @returns {Promise}
 */

Wallet.prototype._encrypt = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(passphrase) {
    var key;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            _context10.next = 2;
            return this.master.encrypt(passphrase, true);

          case 2:
            key = _context10.sent;


            this.start();

            _context10.prev = 4;
            _context10.next = 7;
            return this.db.encryptKeys(this, key);

          case 7:
            _context10.next = 14;
            break;

          case 9:
            _context10.prev = 9;
            _context10.t0 = _context10['catch'](4);

            cleanse(key);
            this.drop();
            throw _context10.t0;

          case 14:

            cleanse(key);

            this.save();

            _context10.next = 18;
            return this.commit();

          case 18:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this, [[4, 9]]);
  }));

  function _encrypt(_x13) {
    return _ref10.apply(this, arguments);
  }

  return _encrypt;
}();

/**
 * Decrypt the wallet permanently.
 * @param {String|Buffer} passphrase
 * @returns {Promise}
 */

Wallet.prototype.decrypt = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(passphrase) {
    var unlock;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            _context11.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context11.sent;
            _context11.prev = 3;
            _context11.next = 6;
            return this._decrypt(passphrase);

          case 6:
            return _context11.abrupt('return', _context11.sent);

          case 7:
            _context11.prev = 7;

            unlock();
            return _context11.finish(7);

          case 10:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this, [[3,, 7, 10]]);
  }));

  function decrypt(_x14) {
    return _ref11.apply(this, arguments);
  }

  return decrypt;
}();

/**
 * Decrypt the wallet permanently, without a lock.
 * @private
 * @param {String|Buffer} passphrase
 * @returns {Promise}
 */

Wallet.prototype._decrypt = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(passphrase) {
    var key;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            _context12.next = 2;
            return this.master.decrypt(passphrase, true);

          case 2:
            key = _context12.sent;


            this.start();

            _context12.prev = 4;
            _context12.next = 7;
            return this.db.decryptKeys(this, key);

          case 7:
            _context12.next = 14;
            break;

          case 9:
            _context12.prev = 9;
            _context12.t0 = _context12['catch'](4);

            cleanse(key);
            this.drop();
            throw _context12.t0;

          case 14:

            cleanse(key);

            this.save();

            _context12.next = 18;
            return this.commit();

          case 18:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this, [[4, 9]]);
  }));

  function _decrypt(_x15) {
    return _ref12.apply(this, arguments);
  }

  return _decrypt;
}();

/**
 * Generate a new token.
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype.retoken = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(passphrase) {
    var unlock;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            _context13.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context13.sent;
            _context13.prev = 3;
            _context13.next = 6;
            return this._retoken(passphrase);

          case 6:
            return _context13.abrupt('return', _context13.sent);

          case 7:
            _context13.prev = 7;

            unlock();
            return _context13.finish(7);

          case 10:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this, [[3,, 7, 10]]);
  }));

  function retoken(_x16) {
    return _ref13.apply(this, arguments);
  }

  return retoken;
}();

/**
 * Generate a new token without a lock.
 * @private
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype._retoken = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(passphrase) {
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            _context14.next = 2;
            return this.unlock(passphrase);

          case 2:

            this.tokenDepth++;
            this.token = this.getToken(this.tokenDepth);

            this.start();
            this.save();

            _context14.next = 8;
            return this.commit();

          case 8:
            return _context14.abrupt('return', this.token);

          case 9:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function _retoken(_x17) {
    return _ref14.apply(this, arguments);
  }

  return _retoken;
}();

/**
 * Rename the wallet.
 * @param {String} id
 * @returns {Promise}
 */

Wallet.prototype.rename = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(id) {
    var unlock;
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            _context15.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context15.sent;
            _context15.prev = 3;
            _context15.next = 6;
            return this.db.rename(this, id);

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

  function rename(_x18) {
    return _ref15.apply(this, arguments);
  }

  return rename;
}();

/**
 * Rename account.
 * @param {(String|Number)?} acct
 * @param {String} name
 * @returns {Promise}
 */

Wallet.prototype.renameAccount = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(acct, name) {
    var unlock;
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            _context16.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context16.sent;
            _context16.prev = 3;
            _context16.next = 6;
            return this._renameAccount(acct, name);

          case 6:
            return _context16.abrupt('return', _context16.sent);

          case 7:
            _context16.prev = 7;

            unlock();
            return _context16.finish(7);

          case 10:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this, [[3,, 7, 10]]);
  }));

  function renameAccount(_x19, _x20) {
    return _ref16.apply(this, arguments);
  }

  return renameAccount;
}();

/**
 * Rename account without a lock.
 * @private
 * @param {(String|Number)?} acct
 * @param {String} name
 * @returns {Promise}
 */

Wallet.prototype._renameAccount = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(acct, name) {
    var account, old, paths, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, path;

    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            if (common.isName(name)) {
              _context17.next = 2;
              break;
            }

            throw new Error('Bad account name.');

          case 2:
            _context17.next = 4;
            return this.getAccount(acct);

          case 4:
            account = _context17.sent;

            if (account) {
              _context17.next = 7;
              break;
            }

            throw new Error('Account not found.');

          case 7:
            if (!(account.accountIndex === 0)) {
              _context17.next = 9;
              break;
            }

            throw new Error('Cannot rename default account.');

          case 9:
            _context17.next = 11;
            return this.hasAccount(name);

          case 11:
            if (!_context17.sent) {
              _context17.next = 13;
              break;
            }

            throw new Error('Account name not available.');

          case 13:
            old = account.name;


            this.start();

            this.db.renameAccount(account, name);

            _context17.next = 18;
            return this.commit();

          case 18:

            this.indexCache.remove(old);

            paths = this.pathCache.values();
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context17.prev = 23;
            _iterator = (0, _getIterator3.default)(paths);

          case 25:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context17.next = 33;
              break;
            }

            path = _step.value;

            if (!(path.account !== account.accountIndex)) {
              _context17.next = 29;
              break;
            }

            return _context17.abrupt('continue', 30);

          case 29:

            path.name = name;

          case 30:
            _iteratorNormalCompletion = true;
            _context17.next = 25;
            break;

          case 33:
            _context17.next = 39;
            break;

          case 35:
            _context17.prev = 35;
            _context17.t0 = _context17['catch'](23);
            _didIteratorError = true;
            _iteratorError = _context17.t0;

          case 39:
            _context17.prev = 39;
            _context17.prev = 40;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 42:
            _context17.prev = 42;

            if (!_didIteratorError) {
              _context17.next = 45;
              break;
            }

            throw _iteratorError;

          case 45:
            return _context17.finish(42);

          case 46:
            return _context17.finish(39);

          case 47:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this, [[23, 35, 39, 47], [40,, 42, 46]]);
  }));

  function _renameAccount(_x21, _x22) {
    return _ref17.apply(this, arguments);
  }

  return _renameAccount;
}();

/**
 * Lock the wallet, destroy decrypted key.
 */

Wallet.prototype.lock = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18() {
    var unlock1, unlock2;
    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            _context18.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock1 = _context18.sent;
            _context18.next = 5;
            return this.fundLock.lock();

          case 5:
            unlock2 = _context18.sent;
            _context18.prev = 6;
            _context18.next = 9;
            return this.master.lock();

          case 9:
            _context18.prev = 9;

            unlock2();
            unlock1();
            return _context18.finish(9);

          case 13:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this, [[6,, 9, 13]]);
  }));

  function lock() {
    return _ref18.apply(this, arguments);
  }

  return lock;
}();

/**
 * Unlock the key for `timeout` seconds.
 * @param {Buffer|String} passphrase
 * @param {Number?} [timeout=60]
 */

Wallet.prototype.unlock = function unlock(passphrase, timeout) {
  return this.master.unlock(passphrase, timeout);
};

/**
 * Generate the wallet ID if none was passed in.
 * It is represented as HASH160(m/44->public|magic)
 * converted to an "address" with a prefix
 * of `0x03be04` (`WLT` in base58).
 * @private
 * @returns {Base58String}
 */

Wallet.prototype.getID = function getID() {
  assert(this.master.key, 'Cannot derive id.');

  var key = this.master.key.derive(44);

  var bw = new StaticWriter(37);
  bw.writeBytes(key.publicKey);
  bw.writeU32(this.network.magic);

  var hash = digest.hash160(bw.render());

  var b58 = new StaticWriter(27);
  b58.writeU8(0x03);
  b58.writeU8(0xbe);
  b58.writeU8(0x04);
  b58.writeBytes(hash);
  b58.writeChecksum();

  return base58.encode(b58.render());
};

/**
 * Generate the wallet api key if none was passed in.
 * It is represented as HASH256(m/44'->private|nonce).
 * @private
 * @param {HDPrivateKey} master
 * @param {Number} nonce
 * @returns {Buffer}
 */

Wallet.prototype.getToken = function getToken(nonce) {
  assert(this.master.key, 'Cannot derive token.');

  var key = this.master.key.derive(44, true);

  var bw = new StaticWriter(36);
  bw.writeBytes(key.privateKey);
  bw.writeU32(nonce);

  return digest.hash256(bw.render());
};

/**
 * Create an account. Requires passphrase if master key is encrypted.
 * @param {Object} options - See {@link Account} options.
 * @returns {Promise} - Returns {@link Account}.
 */

Wallet.prototype.createAccount = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(options, passphrase) {
    var unlock;
    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            _context19.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context19.sent;
            _context19.prev = 3;
            _context19.next = 6;
            return this._createAccount(options, passphrase);

          case 6:
            return _context19.abrupt('return', _context19.sent);

          case 7:
            _context19.prev = 7;

            unlock();
            return _context19.finish(7);

          case 10:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this, [[3,, 7, 10]]);
  }));

  function createAccount(_x23, _x24) {
    return _ref19.apply(this, arguments);
  }

  return createAccount;
}();

/**
 * Create an account without a lock.
 * @param {Object} options - See {@link Account} options.
 * @returns {Promise} - Returns {@link Account}.
 */

Wallet.prototype._createAccount = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(options, passphrase) {
    var name, key, opt, account;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            name = options.name;


            if (!name) name = this.accountDepth.toString(10);

            _context20.next = 4;
            return this.hasAccount(name);

          case 4:
            if (!_context20.sent) {
              _context20.next = 6;
              break;
            }

            throw new Error('Account already exists.');

          case 6:
            _context20.next = 8;
            return this.unlock(passphrase);

          case 8:
            key = void 0;

            if (!(this.watchOnly && options.accountKey)) {
              _context20.next = 17;
              break;
            }

            key = options.accountKey;

            if (typeof key === 'string') key = HD.PublicKey.fromBase58(key, this.network);

            if (HD.isPublic(key)) {
              _context20.next = 14;
              break;
            }

            throw new Error('Must add HD public keys to watch only wallet.');

          case 14:

            assert(key.network === this.network, 'Network mismatch for watch only key.');
            _context20.next = 20;
            break;

          case 17:
            assert(this.master.key);
            key = this.master.key.deriveAccount(44, this.accountDepth);
            key = key.toPublic();

          case 20:
            opt = {
              wid: this.wid,
              id: this.id,
              name: this.accountDepth === 0 ? 'default' : name,
              witness: options.witness,
              watchOnly: this.watchOnly,
              accountKey: key,
              accountIndex: this.accountDepth,
              type: options.type,
              m: options.m,
              n: options.n,
              keys: options.keys
            };


            this.start();

            account = void 0;
            _context20.prev = 23;

            account = Account.fromOptions(this.db, opt);
            account.wallet = this;
            _context20.next = 28;
            return account.init();

          case 28:
            _context20.next = 34;
            break;

          case 30:
            _context20.prev = 30;
            _context20.t0 = _context20['catch'](23);

            this.drop();
            throw _context20.t0;

          case 34:

            this.logger.info('Created account %s/%s/%d.', account.id, account.name, account.accountIndex);

            this.accountDepth++;
            this.save();

            _context20.next = 39;
            return this.commit();

          case 39:
            return _context20.abrupt('return', account);

          case 40:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this, [[23, 30]]);
  }));

  function _createAccount(_x25, _x26) {
    return _ref20.apply(this, arguments);
  }

  return _createAccount;
}();

/**
 * Ensure an account. Requires passphrase if master key is encrypted.
 * @param {Object} options - See {@link Account} options.
 * @returns {Promise} - Returns {@link Account}.
 */

Wallet.prototype.ensureAccount = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(options, passphrase) {
    var name, account;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            name = options.name;
            _context21.next = 3;
            return this.getAccount(name);

          case 3:
            account = _context21.sent;

            if (!account) {
              _context21.next = 6;
              break;
            }

            return _context21.abrupt('return', account);

          case 6:
            _context21.next = 8;
            return this.createAccount(options, passphrase);

          case 8:
            return _context21.abrupt('return', _context21.sent);

          case 9:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function ensureAccount(_x27, _x28) {
    return _ref21.apply(this, arguments);
  }

  return ensureAccount;
}();

/**
 * List account names and indexes from the db.
 * @returns {Promise} - Returns Array.
 */

Wallet.prototype.getAccounts = function getAccounts() {
  return this.db.getAccounts(this.wid);
};

/**
 * Get all wallet address hashes.
 * @param {(String|Number)?} acct
 * @returns {Promise} - Returns Array.
 */

Wallet.prototype.getAddressHashes = function getAddressHashes(acct) {
  if (acct != null) return this.getAccountHashes(acct);
  return this.db.getWalletHashes(this.wid);
};

/**
 * Get all account address hashes.
 * @param {String|Number} acct
 * @returns {Promise} - Returns Array.
 */

Wallet.prototype.getAccountHashes = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(acct) {
    var index;
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            _context22.next = 2;
            return this.ensureIndex(acct, true);

          case 2:
            index = _context22.sent;
            _context22.next = 5;
            return this.db.getAccountHashes(this.wid, index);

          case 5:
            return _context22.abrupt('return', _context22.sent);

          case 6:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function getAccountHashes(_x29) {
    return _ref22.apply(this, arguments);
  }

  return getAccountHashes;
}();

/**
 * Retrieve an account from the database.
 * @param {Number|String} acct
 * @returns {Promise} - Returns {@link Account}.
 */

Wallet.prototype.getAccount = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(acct) {
    var index, unlock;
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            if (!this.account) {
              _context23.next = 3;
              break;
            }

            if (!(acct === 0 || acct === 'default')) {
              _context23.next = 3;
              break;
            }

            return _context23.abrupt('return', this.account);

          case 3:
            _context23.next = 5;
            return this.getAccountIndex(acct);

          case 5:
            index = _context23.sent;

            if (!(index === -1)) {
              _context23.next = 8;
              break;
            }

            return _context23.abrupt('return', null);

          case 8:
            _context23.next = 10;
            return this.readLock.lock(index);

          case 10:
            unlock = _context23.sent;
            _context23.prev = 11;
            _context23.next = 14;
            return this._getAccount(index);

          case 14:
            return _context23.abrupt('return', _context23.sent);

          case 15:
            _context23.prev = 15;

            unlock();
            return _context23.finish(15);

          case 18:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this, [[11,, 15, 18]]);
  }));

  function getAccount(_x30) {
    return _ref23.apply(this, arguments);
  }

  return getAccount;
}();

/**
 * Retrieve an account from the database without a lock.
 * @param {Number} index
 * @returns {Promise} - Returns {@link Account}.
 */

Wallet.prototype._getAccount = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(index) {
    var cache, account;
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            cache = this.accountCache.get(index);

            if (!cache) {
              _context24.next = 3;
              break;
            }

            return _context24.abrupt('return', cache);

          case 3:
            _context24.next = 5;
            return this.db.getAccount(this.wid, index);

          case 5:
            account = _context24.sent;

            if (account) {
              _context24.next = 8;
              break;
            }

            return _context24.abrupt('return', null);

          case 8:

            account.wallet = this;
            account.wid = this.wid;
            account.id = this.id;
            account.watchOnly = this.watchOnly;

            _context24.next = 14;
            return account.open();

          case 14:

            this.accountCache.set(index, account);

            return _context24.abrupt('return', account);

          case 16:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function _getAccount(_x31) {
    return _ref24.apply(this, arguments);
  }

  return _getAccount;
}();

/**
 * Lookup the corresponding account name's index.
 * @param {WalletID} wid
 * @param {String|Number} name - Account name/index.
 * @returns {Promise} - Returns Number.
 */

Wallet.prototype.getAccountIndex = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(name) {
    var cache, index;
    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            if (!(name == null)) {
              _context25.next = 2;
              break;
            }

            return _context25.abrupt('return', -1);

          case 2:
            if (!(typeof name === 'number')) {
              _context25.next = 4;
              break;
            }

            return _context25.abrupt('return', name);

          case 4:
            cache = this.indexCache.get(name);

            if (!(cache != null)) {
              _context25.next = 7;
              break;
            }

            return _context25.abrupt('return', cache);

          case 7:
            _context25.next = 9;
            return this.db.getAccountIndex(this.wid, name);

          case 9:
            index = _context25.sent;

            if (!(index === -1)) {
              _context25.next = 12;
              break;
            }

            return _context25.abrupt('return', -1);

          case 12:

            this.indexCache.set(name, index);

            return _context25.abrupt('return', index);

          case 14:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this);
  }));

  function getAccountIndex(_x32) {
    return _ref25.apply(this, arguments);
  }

  return getAccountIndex;
}();

/**
 * Lookup the corresponding account index's name.
 * @param {WalletID} wid
 * @param {Number} index - Account index.
 * @returns {Promise} - Returns String.
 */

Wallet.prototype.getAccountName = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(index) {
    var account;
    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            if (!(typeof index === 'string')) {
              _context26.next = 2;
              break;
            }

            return _context26.abrupt('return', index);

          case 2:
            account = this.accountCache.get(index);

            if (!account) {
              _context26.next = 5;
              break;
            }

            return _context26.abrupt('return', account.name);

          case 5:
            _context26.next = 7;
            return this.db.getAccountName(this.wid, index);

          case 7:
            return _context26.abrupt('return', _context26.sent);

          case 8:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this);
  }));

  function getAccountName(_x33) {
    return _ref26.apply(this, arguments);
  }

  return getAccountName;
}();

/**
 * Test whether an account exists.
 * @param {Number|String} acct
 * @returns {Promise} - Returns {@link Boolean}.
 */

Wallet.prototype.hasAccount = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(acct) {
    var index;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            _context27.next = 2;
            return this.getAccountIndex(acct);

          case 2:
            index = _context27.sent;

            if (!(index === -1)) {
              _context27.next = 5;
              break;
            }

            return _context27.abrupt('return', false);

          case 5:
            if (!this.accountCache.has(index)) {
              _context27.next = 7;
              break;
            }

            return _context27.abrupt('return', true);

          case 7:
            _context27.next = 9;
            return this.db.hasAccount(this.wid, index);

          case 9:
            return _context27.abrupt('return', _context27.sent);

          case 10:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function hasAccount(_x34) {
    return _ref27.apply(this, arguments);
  }

  return hasAccount;
}();

/**
 * Create a new receiving address (increments receiveDepth).
 * @param {(Number|String)?} acct
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Wallet.prototype.createReceive = function createReceive(acct) {
  return this.createKey(acct, 0);
};

/**
 * Create a new change address (increments receiveDepth).
 * @param {(Number|String)?} acct
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Wallet.prototype.createChange = function createChange(acct) {
  return this.createKey(acct, 1);
};

/**
 * Create a new nested address (increments receiveDepth).
 * @param {(Number|String)?} acct
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Wallet.prototype.createNested = function createNested(acct) {
  return this.createKey(acct, 2);
};

/**
 * Create a new address (increments depth).
 * @param {(Number|String)?} acct
 * @param {Number} branch
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Wallet.prototype.createKey = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(acct, branch) {
    var unlock;
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            _context28.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context28.sent;
            _context28.prev = 3;
            _context28.next = 6;
            return this._createKey(acct, branch);

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

  function createKey(_x35, _x36) {
    return _ref28.apply(this, arguments);
  }

  return createKey;
}();

/**
 * Create a new address (increments depth) without a lock.
 * @private
 * @param {(Number|String)?} acct
 * @param {Number} branche
 * @returns {Promise} - Returns {@link WalletKey}.
 */

Wallet.prototype._createKey = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(acct, branch) {
    var account, result;
    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            if (branch == null) {
              branch = acct;
              acct = null;
            }

            if (acct == null) acct = 0;

            _context29.next = 4;
            return this.getAccount(acct);

          case 4:
            account = _context29.sent;

            if (account) {
              _context29.next = 7;
              break;
            }

            throw new Error('Account not found.');

          case 7:

            this.start();

            result = void 0;
            _context29.prev = 9;
            _context29.next = 12;
            return account.createKey(branch);

          case 12:
            result = _context29.sent;
            _context29.next = 19;
            break;

          case 15:
            _context29.prev = 15;
            _context29.t0 = _context29['catch'](9);

            this.drop();
            throw _context29.t0;

          case 19:
            _context29.next = 21;
            return this.commit();

          case 21:
            return _context29.abrupt('return', result);

          case 22:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this, [[9, 15]]);
  }));

  function _createKey(_x37, _x38) {
    return _ref29.apply(this, arguments);
  }

  return _createKey;
}();

/**
 * Save the wallet to the database. Necessary
 * when address depth and keys change.
 * @returns {Promise}
 */

Wallet.prototype.save = function save() {
  return this.db.save(this);
};

/**
 * Start batch.
 * @private
 */

Wallet.prototype.start = function start() {
  return this.db.start(this);
};

/**
 * Drop batch.
 * @private
 */

Wallet.prototype.drop = function drop() {
  return this.db.drop(this);
};

/**
 * Clear batch.
 * @private
 */

Wallet.prototype.clear = function clear() {
  return this.db.clear(this);
};

/**
 * Save batch.
 * @returns {Promise}
 */

Wallet.prototype.commit = function commit() {
  return this.db.commit(this);
};

/**
 * Test whether the wallet possesses an address.
 * @param {Address|Hash} address
 * @returns {Promise} - Returns Boolean.
 */

Wallet.prototype.hasAddress = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(address) {
    var hash, path;
    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            hash = Address.getHash(address, 'hex');
            _context30.next = 3;
            return this.getPath(hash);

          case 3:
            path = _context30.sent;
            return _context30.abrupt('return', path != null);

          case 5:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this);
  }));

  function hasAddress(_x39) {
    return _ref30.apply(this, arguments);
  }

  return hasAddress;
}();

/**
 * Get path by address hash.
 * @param {Address|Hash} address
 * @returns {Promise} - Returns {@link Path}.
 */

Wallet.prototype.getPath = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(address) {
    var path;
    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            _context31.next = 2;
            return this.readPath(address);

          case 2:
            path = _context31.sent;

            if (path) {
              _context31.next = 5;
              break;
            }

            return _context31.abrupt('return', null);

          case 5:
            _context31.next = 7;
            return this.getAccountName(path.account);

          case 7:
            path.name = _context31.sent;


            assert(path.name);

            this.pathCache.set(path.hash, path);

            return _context31.abrupt('return', path);

          case 11:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this);
  }));

  function getPath(_x40) {
    return _ref31.apply(this, arguments);
  }

  return getPath;
}();

/**
 * Get path by address hash (without account name).
 * @private
 * @param {Address|Hash} address
 * @returns {Promise} - Returns {@link Path}.
 */

Wallet.prototype.readPath = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(address) {
    var hash, cache, path;
    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            hash = Address.getHash(address, 'hex');
            cache = this.pathCache.get(hash);

            if (!cache) {
              _context32.next = 4;
              break;
            }

            return _context32.abrupt('return', cache);

          case 4:
            _context32.next = 6;
            return this.db.getPath(this.wid, hash);

          case 6:
            path = _context32.sent;

            if (path) {
              _context32.next = 9;
              break;
            }

            return _context32.abrupt('return', null);

          case 9:

            path.id = this.id;

            return _context32.abrupt('return', path);

          case 11:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this);
  }));

  function readPath(_x41) {
    return _ref32.apply(this, arguments);
  }

  return readPath;
}();

/**
 * Test whether the wallet contains a path.
 * @param {Address|Hash} address
 * @returns {Promise} - Returns {Boolean}.
 */

Wallet.prototype.hasPath = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(address) {
    var hash;
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            hash = Address.getHash(address, 'hex');

            if (!this.pathCache.has(hash)) {
              _context33.next = 3;
              break;
            }

            return _context33.abrupt('return', true);

          case 3:
            _context33.next = 5;
            return this.db.hasPath(this.wid, hash);

          case 5:
            return _context33.abrupt('return', _context33.sent);

          case 6:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this);
  }));

  function hasPath(_x42) {
    return _ref33.apply(this, arguments);
  }

  return hasPath;
}();

/**
 * Get all wallet paths.
 * @param {(String|Number)?} acct
 * @returns {Promise} - Returns {@link Path}.
 */

Wallet.prototype.getPaths = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(acct) {
    var paths, result, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, path;

    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            if (!(acct != null)) {
              _context34.next = 4;
              break;
            }

            _context34.next = 3;
            return this.getAccountPaths(acct);

          case 3:
            return _context34.abrupt('return', _context34.sent);

          case 4:
            _context34.next = 6;
            return this.db.getWalletPaths(this.wid);

          case 6:
            paths = _context34.sent;
            result = [];
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context34.prev = 11;
            _iterator2 = (0, _getIterator3.default)(paths);

          case 13:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context34.next = 25;
              break;
            }

            path = _step2.value;

            path.id = this.id;
            _context34.next = 18;
            return this.getAccountName(path.account);

          case 18:
            path.name = _context34.sent;


            assert(path.name);

            this.pathCache.set(path.hash, path);

            result.push(path);

          case 22:
            _iteratorNormalCompletion2 = true;
            _context34.next = 13;
            break;

          case 25:
            _context34.next = 31;
            break;

          case 27:
            _context34.prev = 27;
            _context34.t0 = _context34['catch'](11);
            _didIteratorError2 = true;
            _iteratorError2 = _context34.t0;

          case 31:
            _context34.prev = 31;
            _context34.prev = 32;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 34:
            _context34.prev = 34;

            if (!_didIteratorError2) {
              _context34.next = 37;
              break;
            }

            throw _iteratorError2;

          case 37:
            return _context34.finish(34);

          case 38:
            return _context34.finish(31);

          case 39:
            return _context34.abrupt('return', result);

          case 40:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this, [[11, 27, 31, 39], [32,, 34, 38]]);
  }));

  function getPaths(_x43) {
    return _ref34.apply(this, arguments);
  }

  return getPaths;
}();

/**
 * Get all account paths.
 * @param {String|Number} acct
 * @returns {Promise} - Returns {@link Path}.
 */

Wallet.prototype.getAccountPaths = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(acct) {
    var index, hashes, name, result, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, hash, path;

    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            _context35.next = 2;
            return this.ensureIndex(acct, true);

          case 2:
            index = _context35.sent;
            _context35.next = 5;
            return this.getAccountHashes(index);

          case 5:
            hashes = _context35.sent;
            _context35.next = 8;
            return this.getAccountName(acct);

          case 8:
            name = _context35.sent;


            assert(name);

            result = [];
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context35.prev = 14;
            _iterator3 = (0, _getIterator3.default)(hashes);

          case 16:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context35.next = 29;
              break;
            }

            hash = _step3.value;
            _context35.next = 20;
            return this.readPath(hash);

          case 20:
            path = _context35.sent;


            assert(path);
            assert(path.account === index);

            path.name = name;

            this.pathCache.set(path.hash, path);

            result.push(path);

          case 26:
            _iteratorNormalCompletion3 = true;
            _context35.next = 16;
            break;

          case 29:
            _context35.next = 35;
            break;

          case 31:
            _context35.prev = 31;
            _context35.t0 = _context35['catch'](14);
            _didIteratorError3 = true;
            _iteratorError3 = _context35.t0;

          case 35:
            _context35.prev = 35;
            _context35.prev = 36;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 38:
            _context35.prev = 38;

            if (!_didIteratorError3) {
              _context35.next = 41;
              break;
            }

            throw _iteratorError3;

          case 41:
            return _context35.finish(38);

          case 42:
            return _context35.finish(35);

          case 43:
            return _context35.abrupt('return', result);

          case 44:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this, [[14, 31, 35, 43], [36,, 38, 42]]);
  }));

  function getAccountPaths(_x44) {
    return _ref35.apply(this, arguments);
  }

  return getAccountPaths;
}();

/**
 * Import a keyring (will not exist on derivation chain).
 * Rescanning must be invoked manually.
 * @param {(String|Number)?} acct
 * @param {WalletKey} ring
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype.importKey = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(acct, ring, passphrase) {
    var unlock;
    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            _context36.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context36.sent;
            _context36.prev = 3;
            _context36.next = 6;
            return this._importKey(acct, ring, passphrase);

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

  function importKey(_x45, _x46, _x47) {
    return _ref36.apply(this, arguments);
  }

  return importKey;
}();

/**
 * Import a keyring (will not exist on derivation chain) without a lock.
 * @private
 * @param {(String|Number)?} acct
 * @param {WalletKey} ring
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype._importKey = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(acct, ring, passphrase) {
    var hash, account, key, path;
    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            if (acct && (typeof acct === 'undefined' ? 'undefined' : (0, _typeof3.default)(acct)) === 'object') {
              passphrase = ring;
              ring = acct;
              acct = null;
            }

            if (acct == null) acct = 0;

            assert(ring.network === this.network, 'Network mismatch for key.');

            if (this.watchOnly) {
              _context37.next = 8;
              break;
            }

            if (ring.privateKey) {
              _context37.next = 6;
              break;
            }

            throw new Error('Cannot import pubkey into non watch-only wallet.');

          case 6:
            _context37.next = 10;
            break;

          case 8:
            if (!ring.privateKey) {
              _context37.next = 10;
              break;
            }

            throw new Error('Cannot import privkey into watch-only wallet.');

          case 10:
            hash = ring.getHash('hex');
            _context37.next = 13;
            return this.getPath(hash);

          case 13:
            if (!_context37.sent) {
              _context37.next = 15;
              break;
            }

            throw new Error('Key already exists.');

          case 15:
            _context37.next = 17;
            return this.getAccount(acct);

          case 17:
            account = _context37.sent;

            if (account) {
              _context37.next = 20;
              break;
            }

            throw new Error('Account not found.');

          case 20:
            if (!(account.type !== Account.types.PUBKEYHASH)) {
              _context37.next = 22;
              break;
            }

            throw new Error('Cannot import into non-pkh account.');

          case 22:
            _context37.next = 24;
            return this.unlock(passphrase);

          case 24:
            key = WalletKey.fromRing(account, ring);
            path = key.toPath();


            if (this.master.encrypted) {
              path.data = this.master.encipher(path.data, path.hash);
              assert(path.data);
              path.encrypted = true;
            }

            this.start();

            _context37.prev = 28;
            _context37.next = 31;
            return account.savePath(path);

          case 31:
            _context37.next = 37;
            break;

          case 33:
            _context37.prev = 33;
            _context37.t0 = _context37['catch'](28);

            this.drop();
            throw _context37.t0;

          case 37:
            _context37.next = 39;
            return this.commit();

          case 39:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this, [[28, 33]]);
  }));

  function _importKey(_x48, _x49, _x50) {
    return _ref37.apply(this, arguments);
  }

  return _importKey;
}();

/**
 * Import a keyring (will not exist on derivation chain).
 * Rescanning must be invoked manually.
 * @param {(String|Number)?} acct
 * @param {WalletKey} ring
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype.importAddress = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(acct, address) {
    var unlock;
    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            _context38.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context38.sent;
            _context38.prev = 3;
            _context38.next = 6;
            return this._importAddress(acct, address);

          case 6:
            return _context38.abrupt('return', _context38.sent);

          case 7:
            _context38.prev = 7;

            unlock();
            return _context38.finish(7);

          case 10:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this, [[3,, 7, 10]]);
  }));

  function importAddress(_x51, _x52) {
    return _ref38.apply(this, arguments);
  }

  return importAddress;
}();

/**
 * Import a keyring (will not exist on derivation chain) without a lock.
 * @private
 * @param {(String|Number)?} acct
 * @param {WalletKey} ring
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype._importAddress = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(acct, address) {
    var account, path;
    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            if (!address) {
              address = acct;
              acct = null;
            }

            if (acct == null) acct = 0;

            assert(address.network === this.network, 'Network mismatch for address.');

            if (this.watchOnly) {
              _context39.next = 5;
              break;
            }

            throw new Error('Cannot import address into non watch-only wallet.');

          case 5:
            _context39.next = 7;
            return this.getPath(address);

          case 7:
            if (!_context39.sent) {
              _context39.next = 9;
              break;
            }

            throw new Error('Address already exists.');

          case 9:
            _context39.next = 11;
            return this.getAccount(acct);

          case 11:
            account = _context39.sent;

            if (account) {
              _context39.next = 14;
              break;
            }

            throw new Error('Account not found.');

          case 14:
            if (!(account.type !== Account.types.PUBKEYHASH)) {
              _context39.next = 16;
              break;
            }

            throw new Error('Cannot import into non-pkh account.');

          case 16:
            path = Path.fromAddress(account, address);


            this.start();

            _context39.prev = 18;
            _context39.next = 21;
            return account.savePath(path);

          case 21:
            _context39.next = 27;
            break;

          case 23:
            _context39.prev = 23;
            _context39.t0 = _context39['catch'](18);

            this.drop();
            throw _context39.t0;

          case 27:
            _context39.next = 29;
            return this.commit();

          case 29:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this, [[18, 23]]);
  }));

  function _importAddress(_x53, _x54) {
    return _ref39.apply(this, arguments);
  }

  return _importAddress;
}();

/**
 * Fill a transaction with inputs, estimate
 * transaction size, calculate fee, and add a change output.
 * @see MTX#selectCoins
 * @see MTX#fill
 * @param {MTX} mtx - _Must_ be a mutable transaction.
 * @param {Object?} options
 * @param {(String|Number)?} options.account - If no account is
 * specified, coins from the entire wallet will be filled.
 * @param {String?} options.selection - Coin selection priority. Can
 * be `age`, `random`, or `all`. (default=age).
 * @param {Boolean} options.round - Whether to round to the nearest
 * kilobyte for fee calculation.
 * See {@link TX#getMinFee} vs. {@link TX#getRoundFee}.
 * @param {Rate} options.rate - Rate used for fee calculation.
 * @param {Boolean} options.confirmed - Select only confirmed coins.
 * @param {Boolean} options.free - Do not apply a fee if the
 * transaction priority is high enough to be considered free.
 * @param {Amount?} options.hardFee - Use a hard fee rather than
 * calculating one.
 * @param {Number|Boolean} options.subtractFee - Whether to subtract the
 * fee from existing outputs rather than adding more inputs.
 */

Wallet.prototype.fund = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(mtx, options, force) {
    var unlock;
    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            _context40.next = 2;
            return this.fundLock.lock(force);

          case 2:
            unlock = _context40.sent;
            _context40.prev = 3;
            _context40.next = 6;
            return this._fund(mtx, options);

          case 6:
            return _context40.abrupt('return', _context40.sent);

          case 7:
            _context40.prev = 7;

            unlock();
            return _context40.finish(7);

          case 10:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this, [[3,, 7, 10]]);
  }));

  function fund(_x55, _x56, _x57) {
    return _ref40.apply(this, arguments);
  }

  return fund;
}();

/**
 * Fill a transaction with inputs without a lock.
 * @private
 * @see MTX#selectCoins
 * @see MTX#fill
 */

Wallet.prototype._fund = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(mtx, options) {
    var _this = this;

    var account, rate, coins;
    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            if (!options) options = {};

            if (this.initialized) {
              _context41.next = 3;
              break;
            }

            throw new Error('Wallet is not initialized.');

          case 3:
            if (!this.watchOnly) {
              _context41.next = 5;
              break;
            }

            throw new Error('Cannot fund from watch-only wallet.');

          case 5:
            account = void 0;

            if (!(options.account != null)) {
              _context41.next = 14;
              break;
            }

            _context41.next = 9;
            return this.getAccount(options.account);

          case 9:
            account = _context41.sent;

            if (account) {
              _context41.next = 12;
              break;
            }

            throw new Error('Account not found.');

          case 12:
            _context41.next = 15;
            break;

          case 14:
            account = this.account;

          case 15:
            if (account.initialized) {
              _context41.next = 17;
              break;
            }

            throw new Error('Account is not initialized.');

          case 17:
            rate = options.rate;

            if (!(rate == null)) {
              _context41.next = 22;
              break;
            }

            _context41.next = 21;
            return this.db.estimateFee(options.blocks);

          case 21:
            rate = _context41.sent;

          case 22:
            coins = void 0;

            if (!options.smart) {
              _context41.next = 29;
              break;
            }

            _context41.next = 26;
            return this.getSmartCoins(options.account);

          case 26:
            coins = _context41.sent;
            _context41.next = 33;
            break;

          case 29:
            _context41.next = 31;
            return this.getCoins(options.account);

          case 31:
            coins = _context41.sent;

            coins = this.txdb.filterLocked(coins);

          case 33:
            _context41.next = 35;
            return mtx.fund(coins, {
              selection: options.selection,
              round: options.round,
              depth: options.depth,
              hardFee: options.hardFee,
              subtractFee: options.subtractFee,
              subtractIndex: options.subtractIndex,
              changeAddress: account.change.getAddress(),
              height: this.db.state.height,
              rate: rate,
              maxFee: options.maxFee,
              estimate: function estimate(prev) {
                return _this.estimateSize(prev);
              }
            });

          case 35:

            assert(mtx.getFee() <= MTX.Selector.MAX_FEE, 'TX exceeds MAX_FEE.');

          case 36:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this);
  }));

  function _fund(_x58, _x59) {
    return _ref41.apply(this, arguments);
  }

  return _fund;
}();

/**
 * Get account by address.
 * @param {Address} address
 * @returns {Account}
 */

Wallet.prototype.getAccountByAddress = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(address) {
    var hash, path;
    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            hash = Address.getHash(address, 'hex');
            _context42.next = 3;
            return this.getPath(hash);

          case 3:
            path = _context42.sent;

            if (path) {
              _context42.next = 6;
              break;
            }

            return _context42.abrupt('return', null);

          case 6:
            _context42.next = 8;
            return this.getAccount(path.account);

          case 8:
            return _context42.abrupt('return', _context42.sent);

          case 9:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this);
  }));

  function getAccountByAddress(_x60) {
    return _ref42.apply(this, arguments);
  }

  return getAccountByAddress;
}();

/**
 * Input size estimator for max possible tx size.
 * @param {Script} prev
 * @returns {Number}
 */

Wallet.prototype.estimateSize = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(prev) {
    var scale, address, account, size;
    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            scale = consensus.WITNESS_SCALE_FACTOR;
            address = prev.getAddress();

            if (address) {
              _context43.next = 4;
              break;
            }

            return _context43.abrupt('return', -1);

          case 4:
            _context43.next = 6;
            return this.getAccountByAddress(address);

          case 6:
            account = _context43.sent;

            if (account) {
              _context43.next = 9;
              break;
            }

            return _context43.abrupt('return', -1);

          case 9:
            size = 0;

            if (!prev.isScripthash()) {
              _context43.next = 21;
              break;
            }

            if (!account.witness) {
              _context43.next = 21;
              break;
            }

            _context43.t0 = account.type;
            _context43.next = _context43.t0 === Account.types.PUBKEYHASH ? 15 : _context43.t0 === Account.types.MULTISIG ? 18 : 21;
            break;

          case 15:
            size += 23; // redeem script
            size *= 4; // vsize
            return _context43.abrupt('break', 21);

          case 18:
            size += 35; // redeem script
            size *= 4; // vsize
            return _context43.abrupt('break', 21);

          case 21:
            _context43.t1 = account.type;
            _context43.next = _context43.t1 === Account.types.PUBKEYHASH ? 24 : _context43.t1 === Account.types.MULTISIG ? 27 : 35;
            break;

          case 24:
            // P2PKH
            // OP_PUSHDATA0 [signature]
            size += 1 + 73;
            // OP_PUSHDATA0 [key]
            size += 1 + 33;
            return _context43.abrupt('break', 35);

          case 27:
            // P2SH Multisig
            // OP_0
            size += 1;
            // OP_PUSHDATA0 [signature] ...
            size += (1 + 73) * account.m;
            // OP_PUSHDATA2 [redeem]
            size += 3;
            // m value
            size += 1;
            // OP_PUSHDATA0 [key] ...
            size += (1 + 33) * account.n;
            // n value
            size += 1;
            // OP_CHECKMULTISIG
            size += 1;
            return _context43.abrupt('break', 35);

          case 35:

            if (account.witness) {
              // Varint witness items length.
              size += 1;
              // Calculate vsize if
              // we're a witness program.
              size = (size + scale - 1) / scale | 0;
            } else {
              // Byte for varint
              // size of input script.
              size += encoding.sizeVarint(size);
            }

            return _context43.abrupt('return', size);

          case 37:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this);
  }));

  function estimateSize(_x61) {
    return _ref43.apply(this, arguments);
  }

  return estimateSize;
}();

/**
 * Build a transaction, fill it with outputs and inputs,
 * sort the members according to BIP69 (set options.sort=false
 * to avoid sorting), set locktime, and template it.
 * @param {Object} options - See {@link Wallet#fund options}.
 * @param {Object[]} options.outputs - See {@link MTX#addOutput}.
 * @returns {Promise} - Returns {@link MTX}.
 */

Wallet.prototype.createTX = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44(options, force) {
    var outputs, mtx, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, obj, output, addr, total;

    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            outputs = options.outputs;
            mtx = new MTX();


            assert(Array.isArray(outputs), 'Outputs must be an array.');
            assert(outputs.length > 0, 'No outputs available.');

            // Add the outputs
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context44.prev = 7;
            _iterator4 = (0, _getIterator3.default)(outputs);

          case 9:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context44.next = 24;
              break;
            }

            obj = _step4.value;
            output = new Output(obj);
            addr = output.getAddress();

            if (!output.isDust()) {
              _context44.next = 15;
              break;
            }

            throw new Error('Output is dust.');

          case 15:
            if (!(output.value > 0)) {
              _context44.next = 20;
              break;
            }

            if (addr) {
              _context44.next = 18;
              break;
            }

            throw new Error('Cannot send to unknown address.');

          case 18:
            if (!addr.isNull()) {
              _context44.next = 20;
              break;
            }

            throw new Error('Cannot send to null address.');

          case 20:

            mtx.outputs.push(output);

          case 21:
            _iteratorNormalCompletion4 = true;
            _context44.next = 9;
            break;

          case 24:
            _context44.next = 30;
            break;

          case 26:
            _context44.prev = 26;
            _context44.t0 = _context44['catch'](7);
            _didIteratorError4 = true;
            _iteratorError4 = _context44.t0;

          case 30:
            _context44.prev = 30;
            _context44.prev = 31;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 33:
            _context44.prev = 33;

            if (!_didIteratorError4) {
              _context44.next = 36;
              break;
            }

            throw _iteratorError4;

          case 36:
            return _context44.finish(33);

          case 37:
            return _context44.finish(30);

          case 38:
            _context44.next = 40;
            return this.fund(mtx, options, force);

          case 40:

            // Sort members a la BIP69
            if (options.sort !== false) mtx.sortMembers();

            // Set the locktime to target value.
            if (options.locktime != null) mtx.setLocktime(options.locktime);

            // Consensus sanity checks.
            assert(mtx.isSane(), 'TX failed sanity check.');
            assert(mtx.verifyInputs(this.db.state.height + 1), 'TX failed context check.');

            _context44.next = 46;
            return this.template(mtx);

          case 46:
            total = _context44.sent;

            if (!(total === 0)) {
              _context44.next = 49;
              break;
            }

            throw new Error('Templating failed.');

          case 49:
            return _context44.abrupt('return', mtx);

          case 50:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this, [[7, 26, 30, 38], [31,, 33, 37]]);
  }));

  function createTX(_x62, _x63) {
    return _ref44.apply(this, arguments);
  }

  return createTX;
}();

/**
 * Build a transaction, fill it with outputs and inputs,
 * sort the members according to BIP69, set locktime,
 * sign and broadcast. Doing this all in one go prevents
 * coins from being double spent.
 * @param {Object} options - See {@link Wallet#fund options}.
 * @param {Object[]} options.outputs - See {@link MTX#addOutput}.
 * @returns {Promise} - Returns {@link TX}.
 */

Wallet.prototype.send = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(options, passphrase) {
    var unlock;
    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            _context45.next = 2;
            return this.fundLock.lock();

          case 2:
            unlock = _context45.sent;
            _context45.prev = 3;
            _context45.next = 6;
            return this._send(options, passphrase);

          case 6:
            return _context45.abrupt('return', _context45.sent);

          case 7:
            _context45.prev = 7;

            unlock();
            return _context45.finish(7);

          case 10:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this, [[3,, 7, 10]]);
  }));

  function send(_x64, _x65) {
    return _ref45.apply(this, arguments);
  }

  return send;
}();

/**
 * Build and send a transaction without a lock.
 * @private
 * @param {Object} options - See {@link Wallet#fund options}.
 * @param {Object[]} options.outputs - See {@link MTX#addOutput}.
 * @returns {Promise} - Returns {@link TX}.
 */

Wallet.prototype._send = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(options, passphrase) {
    var mtx, tx;
    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            _context46.next = 2;
            return this.createTX(options, true);

          case 2:
            mtx = _context46.sent;
            _context46.next = 5;
            return this.sign(mtx, passphrase);

          case 5:
            if (mtx.isSigned()) {
              _context46.next = 7;
              break;
            }

            throw new Error('TX could not be fully signed.');

          case 7:
            tx = mtx.toTX();

            // Policy sanity checks.

            if (!(tx.getSigopsCost(mtx.view) > policy.MAX_TX_SIGOPS_COST)) {
              _context46.next = 10;
              break;
            }

            throw new Error('TX exceeds policy sigops.');

          case 10:
            if (!(tx.getWeight() > policy.MAX_TX_WEIGHT)) {
              _context46.next = 12;
              break;
            }

            throw new Error('TX exceeds policy weight.');

          case 12:
            _context46.next = 14;
            return this.db.addTX(tx);

          case 14:

            this.logger.debug('Sending wallet tx (%s): %s', this.id, tx.txid());

            _context46.next = 17;
            return this.db.send(tx);

          case 17:
            return _context46.abrupt('return', tx);

          case 18:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this);
  }));

  function _send(_x66, _x67) {
    return _ref46.apply(this, arguments);
  }

  return _send;
}();

/**
 * Intentionally double-spend outputs by
 * increasing fee for an existing transaction.
 * @param {Hash} hash
 * @param {Rate} rate
 * @param {(String|Buffer)?} passphrase
 * @returns {Promise} - Returns {@link TX}.
 */

Wallet.prototype.increaseFee = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47(hash, rate, passphrase) {
    var wtx, tx, view, oldFee, fee, mtx, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, input, change, i, output, addr, path, ntx;

    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            assert(util.isU32(rate), 'Rate must be a number.');

            _context47.next = 3;
            return this.getTX(hash);

          case 3:
            wtx = _context47.sent;

            if (wtx) {
              _context47.next = 6;
              break;
            }

            throw new Error('Transaction not found.');

          case 6:
            if (!(wtx.height !== -1)) {
              _context47.next = 8;
              break;
            }

            throw new Error('Transaction is confirmed.');

          case 8:
            tx = wtx.tx;

            if (!tx.isCoinbase()) {
              _context47.next = 11;
              break;
            }

            throw new Error('Transaction is a coinbase.');

          case 11:
            _context47.next = 13;
            return this.getSpentView(tx);

          case 13:
            view = _context47.sent;

            if (tx.hasCoins(view)) {
              _context47.next = 16;
              break;
            }

            throw new Error('Not all coins available.');

          case 16:
            oldFee = tx.getFee(view);
            fee = tx.getMinFee(null, rate);


            if (fee > MTX.Selector.MAX_FEE) fee = MTX.Selector.MAX_FEE;

            if (!(oldFee >= fee)) {
              _context47.next = 21;
              break;
            }

            throw new Error('Fee is not increasing.');

          case 21:
            mtx = MTX.fromTX(tx);

            mtx.view = view;

            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context47.prev = 26;
            for (_iterator5 = (0, _getIterator3.default)(mtx.inputs); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              input = _step5.value;

              input.script.clear();
              input.witness.clear();
            }

            _context47.next = 34;
            break;

          case 30:
            _context47.prev = 30;
            _context47.t0 = _context47['catch'](26);
            _didIteratorError5 = true;
            _iteratorError5 = _context47.t0;

          case 34:
            _context47.prev = 34;
            _context47.prev = 35;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 37:
            _context47.prev = 37;

            if (!_didIteratorError5) {
              _context47.next = 40;
              break;
            }

            throw _iteratorError5;

          case 40:
            return _context47.finish(37);

          case 41:
            return _context47.finish(34);

          case 42:
            change = void 0;
            i = 0;

          case 44:
            if (!(i < mtx.outputs.length)) {
              _context47.next = 61;
              break;
            }

            output = mtx.outputs[i];
            addr = output.getAddress();

            if (addr) {
              _context47.next = 49;
              break;
            }

            return _context47.abrupt('continue', 58);

          case 49:
            _context47.next = 51;
            return this.getPath(addr);

          case 51:
            path = _context47.sent;

            if (path) {
              _context47.next = 54;
              break;
            }

            return _context47.abrupt('continue', 58);

          case 54:
            if (!(path.branch === 1)) {
              _context47.next = 58;
              break;
            }

            change = output;
            mtx.changeIndex = i;
            return _context47.abrupt('break', 61);

          case 58:
            i++;
            _context47.next = 44;
            break;

          case 61:
            if (change) {
              _context47.next = 63;
              break;
            }

            throw new Error('No change output.');

          case 63:

            change.value += oldFee;

            if (!(mtx.getFee() !== 0)) {
              _context47.next = 66;
              break;
            }

            throw new Error('Arithmetic error for change.');

          case 66:

            change.value -= fee;

            if (!(change.value < 0)) {
              _context47.next = 69;
              break;
            }

            throw new Error('Fee is too high.');

          case 69:

            if (change.isDust()) {
              mtx.outputs.splice(mtx.changeIndex, 1);
              mtx.changeIndex = -1;
            }

            _context47.next = 72;
            return this.sign(mtx, passphrase);

          case 72:
            if (mtx.isSigned()) {
              _context47.next = 74;
              break;
            }

            throw new Error('TX could not be fully signed.');

          case 74:
            ntx = mtx.toTX();


            this.logger.debug('Increasing fee for wallet tx (%s): %s', this.id, ntx.txid());

            _context47.next = 78;
            return this.db.addTX(ntx);

          case 78:
            _context47.next = 80;
            return this.db.send(ntx);

          case 80:
            return _context47.abrupt('return', ntx);

          case 81:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this, [[26, 30, 34, 42], [35,, 37, 41]]);
  }));

  function increaseFee(_x68, _x69, _x70) {
    return _ref47.apply(this, arguments);
  }

  return increaseFee;
}();

/**
 * Resend pending wallet transactions.
 * @returns {Promise}
 */

Wallet.prototype.resend = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48() {
    var wtxs, txs, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, wtx, sorted, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, tx;

    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            _context48.next = 2;
            return this.getPending();

          case 2:
            wtxs = _context48.sent;


            if (wtxs.length > 0) this.logger.info('Rebroadcasting %d transactions.', wtxs.length);

            txs = [];
            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context48.prev = 8;


            for (_iterator6 = (0, _getIterator3.default)(wtxs); !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              wtx = _step6.value;

              txs.push(wtx.tx);
            }_context48.next = 16;
            break;

          case 12:
            _context48.prev = 12;
            _context48.t0 = _context48['catch'](8);
            _didIteratorError6 = true;
            _iteratorError6 = _context48.t0;

          case 16:
            _context48.prev = 16;
            _context48.prev = 17;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 19:
            _context48.prev = 19;

            if (!_didIteratorError6) {
              _context48.next = 22;
              break;
            }

            throw _iteratorError6;

          case 22:
            return _context48.finish(19);

          case 23:
            return _context48.finish(16);

          case 24:
            sorted = common.sortDeps(txs);
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context48.prev = 28;
            _iterator7 = (0, _getIterator3.default)(sorted);

          case 30:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context48.next = 37;
              break;
            }

            tx = _step7.value;
            _context48.next = 34;
            return this.db.send(tx);

          case 34:
            _iteratorNormalCompletion7 = true;
            _context48.next = 30;
            break;

          case 37:
            _context48.next = 43;
            break;

          case 39:
            _context48.prev = 39;
            _context48.t1 = _context48['catch'](28);
            _didIteratorError7 = true;
            _iteratorError7 = _context48.t1;

          case 43:
            _context48.prev = 43;
            _context48.prev = 44;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 46:
            _context48.prev = 46;

            if (!_didIteratorError7) {
              _context48.next = 49;
              break;
            }

            throw _iteratorError7;

          case 49:
            return _context48.finish(46);

          case 50:
            return _context48.finish(43);

          case 51:
            return _context48.abrupt('return', txs);

          case 52:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this, [[8, 12, 16, 24], [17,, 19, 23], [28, 39, 43, 51], [44,, 46, 50]]);
  }));

  function resend() {
    return _ref48.apply(this, arguments);
  }

  return resend;
}();

/**
 * Derive necessary addresses for signing a transaction.
 * @param {MTX} mtx
 * @param {Number?} index - Input index.
 * @returns {Promise} - Returns {@link WalletKey}[].
 */

Wallet.prototype.deriveInputs = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(mtx) {
    var paths, rings, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, path, account, ring;

    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            assert(mtx.mutable);

            _context49.next = 3;
            return this.getInputPaths(mtx);

          case 3:
            paths = _context49.sent;
            rings = [];
            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context49.prev = 8;
            _iterator8 = (0, _getIterator3.default)(paths);

          case 10:
            if (_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done) {
              _context49.next = 22;
              break;
            }

            path = _step8.value;
            _context49.next = 14;
            return this.getAccount(path.account);

          case 14:
            account = _context49.sent;

            if (account) {
              _context49.next = 17;
              break;
            }

            return _context49.abrupt('continue', 19);

          case 17:
            ring = account.derivePath(path, this.master);


            if (ring) rings.push(ring);

          case 19:
            _iteratorNormalCompletion8 = true;
            _context49.next = 10;
            break;

          case 22:
            _context49.next = 28;
            break;

          case 24:
            _context49.prev = 24;
            _context49.t0 = _context49['catch'](8);
            _didIteratorError8 = true;
            _iteratorError8 = _context49.t0;

          case 28:
            _context49.prev = 28;
            _context49.prev = 29;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 31:
            _context49.prev = 31;

            if (!_didIteratorError8) {
              _context49.next = 34;
              break;
            }

            throw _iteratorError8;

          case 34:
            return _context49.finish(31);

          case 35:
            return _context49.finish(28);

          case 36:
            return _context49.abrupt('return', rings);

          case 37:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this, [[8, 24, 28, 36], [29,, 31, 35]]);
  }));

  function deriveInputs(_x71) {
    return _ref49.apply(this, arguments);
  }

  return deriveInputs;
}();

/**
 * Retrieve a single keyring by address.
 * @param {Address|Hash} hash
 * @returns {Promise}
 */

Wallet.prototype.getKey = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(address) {
    var hash, path, account;
    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            hash = Address.getHash(address, 'hex');
            _context50.next = 3;
            return this.getPath(hash);

          case 3:
            path = _context50.sent;

            if (path) {
              _context50.next = 6;
              break;
            }

            return _context50.abrupt('return', null);

          case 6:
            _context50.next = 8;
            return this.getAccount(path.account);

          case 8:
            account = _context50.sent;

            if (account) {
              _context50.next = 11;
              break;
            }

            return _context50.abrupt('return', null);

          case 11:
            return _context50.abrupt('return', account.derivePath(path, this.master));

          case 12:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function getKey(_x72) {
    return _ref50.apply(this, arguments);
  }

  return getKey;
}();

/**
 * Retrieve a single keyring by address
 * (with the private key reference).
 * @param {Address|Hash} hash
 * @param {(Buffer|String)?} passphrase
 * @returns {Promise}
 */

Wallet.prototype.getPrivateKey = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51(address, passphrase) {
    var hash, path, account, key;
    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            hash = Address.getHash(address, 'hex');
            _context51.next = 3;
            return this.getPath(hash);

          case 3:
            path = _context51.sent;

            if (path) {
              _context51.next = 6;
              break;
            }

            return _context51.abrupt('return', null);

          case 6:
            _context51.next = 8;
            return this.getAccount(path.account);

          case 8:
            account = _context51.sent;

            if (account) {
              _context51.next = 11;
              break;
            }

            return _context51.abrupt('return', null);

          case 11:
            _context51.next = 13;
            return this.unlock(passphrase);

          case 13:
            key = account.derivePath(path, this.master);

            if (key.privateKey) {
              _context51.next = 16;
              break;
            }

            return _context51.abrupt('return', null);

          case 16:
            return _context51.abrupt('return', key);

          case 17:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this);
  }));

  function getPrivateKey(_x73, _x74) {
    return _ref51.apply(this, arguments);
  }

  return getPrivateKey;
}();

/**
 * Map input addresses to paths.
 * @param {MTX} mtx
 * @returns {Promise} - Returns {@link Path}[].
 */

Wallet.prototype.getInputPaths = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(mtx) {
    var hashes, paths, _iteratorNormalCompletion9, _didIteratorError9, _iteratorError9, _iterator9, _step9, hash, path;

    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            assert(mtx.mutable);

            if (mtx.hasCoins()) {
              _context52.next = 3;
              break;
            }

            throw new Error('Not all coins available.');

          case 3:
            hashes = mtx.getInputHashes('hex');
            paths = [];
            _iteratorNormalCompletion9 = true;
            _didIteratorError9 = false;
            _iteratorError9 = undefined;
            _context52.prev = 8;
            _iterator9 = (0, _getIterator3.default)(hashes);

          case 10:
            if (_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done) {
              _context52.next = 19;
              break;
            }

            hash = _step9.value;
            _context52.next = 14;
            return this.getPath(hash);

          case 14:
            path = _context52.sent;

            if (path) paths.push(path);

          case 16:
            _iteratorNormalCompletion9 = true;
            _context52.next = 10;
            break;

          case 19:
            _context52.next = 25;
            break;

          case 21:
            _context52.prev = 21;
            _context52.t0 = _context52['catch'](8);
            _didIteratorError9 = true;
            _iteratorError9 = _context52.t0;

          case 25:
            _context52.prev = 25;
            _context52.prev = 26;

            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }

          case 28:
            _context52.prev = 28;

            if (!_didIteratorError9) {
              _context52.next = 31;
              break;
            }

            throw _iteratorError9;

          case 31:
            return _context52.finish(28);

          case 32:
            return _context52.finish(25);

          case 33:
            return _context52.abrupt('return', paths);

          case 34:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this, [[8, 21, 25, 33], [26,, 28, 32]]);
  }));

  function getInputPaths(_x75) {
    return _ref52.apply(this, arguments);
  }

  return getInputPaths;
}();

/**
 * Map output addresses to paths.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link Path}[].
 */

Wallet.prototype.getOutputPaths = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(tx) {
    var paths, hashes, _iteratorNormalCompletion10, _didIteratorError10, _iteratorError10, _iterator10, _step10, hash, path;

    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            paths = [];
            hashes = tx.getOutputHashes('hex');
            _iteratorNormalCompletion10 = true;
            _didIteratorError10 = false;
            _iteratorError10 = undefined;
            _context53.prev = 5;
            _iterator10 = (0, _getIterator3.default)(hashes);

          case 7:
            if (_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done) {
              _context53.next = 16;
              break;
            }

            hash = _step10.value;
            _context53.next = 11;
            return this.getPath(hash);

          case 11:
            path = _context53.sent;

            if (path) paths.push(path);

          case 13:
            _iteratorNormalCompletion10 = true;
            _context53.next = 7;
            break;

          case 16:
            _context53.next = 22;
            break;

          case 18:
            _context53.prev = 18;
            _context53.t0 = _context53['catch'](5);
            _didIteratorError10 = true;
            _iteratorError10 = _context53.t0;

          case 22:
            _context53.prev = 22;
            _context53.prev = 23;

            if (!_iteratorNormalCompletion10 && _iterator10.return) {
              _iterator10.return();
            }

          case 25:
            _context53.prev = 25;

            if (!_didIteratorError10) {
              _context53.next = 28;
              break;
            }

            throw _iteratorError10;

          case 28:
            return _context53.finish(25);

          case 29:
            return _context53.finish(22);

          case 30:
            return _context53.abrupt('return', paths);

          case 31:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this, [[5, 18, 22, 30], [23,, 25, 29]]);
  }));

  function getOutputPaths(_x76) {
    return _ref53.apply(this, arguments);
  }

  return getOutputPaths;
}();

/**
 * Increase lookahead for account.
 * @param {(Number|String)?} account
 * @param {Number} lookahead
 * @returns {Promise}
 */

Wallet.prototype.setLookahead = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee54(acct, lookahead) {
    var unlock;
    return _regenerator2.default.wrap(function _callee54$(_context54) {
      while (1) {
        switch (_context54.prev = _context54.next) {
          case 0:
            _context54.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context54.sent;
            _context54.prev = 3;
            return _context54.abrupt('return', this._setLookahead(acct, lookahead));

          case 5:
            _context54.prev = 5;

            unlock();
            return _context54.finish(5);

          case 8:
          case 'end':
            return _context54.stop();
        }
      }
    }, _callee54, this, [[3,, 5, 8]]);
  }));

  function setLookahead(_x77, _x78) {
    return _ref54.apply(this, arguments);
  }

  return setLookahead;
}();

/**
 * Increase lookahead for account (without a lock).
 * @private
 * @param {(Number|String)?} account
 * @param {Number} lookahead
 * @returns {Promise}
 */

Wallet.prototype._setLookahead = function () {
  var _ref55 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee55(acct, lookahead) {
    var account;
    return _regenerator2.default.wrap(function _callee55$(_context55) {
      while (1) {
        switch (_context55.prev = _context55.next) {
          case 0:
            if (lookahead == null) {
              lookahead = acct;
              acct = null;
            }

            if (acct == null) acct = 0;

            _context55.next = 4;
            return this.getAccount(acct);

          case 4:
            account = _context55.sent;

            if (account) {
              _context55.next = 7;
              break;
            }

            throw new Error('Account not found.');

          case 7:

            this.start();

            _context55.prev = 8;
            _context55.next = 11;
            return account.setLookahead(lookahead);

          case 11:
            _context55.next = 17;
            break;

          case 13:
            _context55.prev = 13;
            _context55.t0 = _context55['catch'](8);

            this.drop();
            throw _context55.t0;

          case 17:
            _context55.next = 19;
            return this.commit();

          case 19:
          case 'end':
            return _context55.stop();
        }
      }
    }, _callee55, this, [[8, 13]]);
  }));

  function _setLookahead(_x79, _x80) {
    return _ref55.apply(this, arguments);
  }

  return _setLookahead;
}();

/**
 * Sync address depths based on a transaction's outputs.
 * This is used for deriving new addresses when
 * a confirmed transaction is seen.
 * @param {Details} details
 * @returns {Promise}
 */

Wallet.prototype.syncOutputDepth = function () {
  var _ref56 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee56(details) {
    var map, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, output, path, derived, _iteratorNormalCompletion12, _didIteratorError12, _iteratorError12, _iterator12, _step12, _ref57, _ref58, acct, paths, receive, change, nested, _iteratorNormalCompletion13, _didIteratorError13, _iteratorError13, _iterator13, _step13, _path, account, ring;

    return _regenerator2.default.wrap(function _callee56$(_context56) {
      while (1) {
        switch (_context56.prev = _context56.next) {
          case 0:
            map = new _map2.default();
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context56.prev = 4;
            _iterator11 = (0, _getIterator3.default)(details.outputs);

          case 6:
            if (_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done) {
              _context56.next = 18;
              break;
            }

            output = _step11.value;
            path = output.path;

            if (path) {
              _context56.next = 11;
              break;
            }

            return _context56.abrupt('continue', 15);

          case 11:
            if (!(path.index === -1)) {
              _context56.next = 13;
              break;
            }

            return _context56.abrupt('continue', 15);

          case 13:

            if (!map.has(path.account)) map.set(path.account, []);

            map.get(path.account).push(path);

          case 15:
            _iteratorNormalCompletion11 = true;
            _context56.next = 6;
            break;

          case 18:
            _context56.next = 24;
            break;

          case 20:
            _context56.prev = 20;
            _context56.t0 = _context56['catch'](4);
            _didIteratorError11 = true;
            _iteratorError11 = _context56.t0;

          case 24:
            _context56.prev = 24;
            _context56.prev = 25;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 27:
            _context56.prev = 27;

            if (!_didIteratorError11) {
              _context56.next = 30;
              break;
            }

            throw _iteratorError11;

          case 30:
            return _context56.finish(27);

          case 31:
            return _context56.finish(24);

          case 32:
            derived = [];
            _iteratorNormalCompletion12 = true;
            _didIteratorError12 = false;
            _iteratorError12 = undefined;
            _context56.prev = 36;
            _iterator12 = (0, _getIterator3.default)(map);

          case 38:
            if (_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done) {
              _context56.next = 93;
              break;
            }

            _ref57 = _step12.value;
            _ref58 = (0, _slicedToArray3.default)(_ref57, 2);
            acct = _ref58[0];
            paths = _ref58[1];
            receive = -1;
            change = -1;
            nested = -1;
            _iteratorNormalCompletion13 = true;
            _didIteratorError13 = false;
            _iteratorError13 = undefined;
            _context56.prev = 49;
            _iterator13 = (0, _getIterator3.default)(paths);

          case 51:
            if (_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done) {
              _context56.next = 65;
              break;
            }

            _path = _step13.value;
            _context56.t1 = _path.branch;
            _context56.next = _context56.t1 === 0 ? 56 : _context56.t1 === 1 ? 58 : _context56.t1 === 2 ? 60 : 62;
            break;

          case 56:
            if (_path.index > receive) receive = _path.index;
            return _context56.abrupt('break', 62);

          case 58:
            if (_path.index > change) change = _path.index;
            return _context56.abrupt('break', 62);

          case 60:
            if (_path.index > nested) nested = _path.index;
            return _context56.abrupt('break', 62);

          case 62:
            _iteratorNormalCompletion13 = true;
            _context56.next = 51;
            break;

          case 65:
            _context56.next = 71;
            break;

          case 67:
            _context56.prev = 67;
            _context56.t2 = _context56['catch'](49);
            _didIteratorError13 = true;
            _iteratorError13 = _context56.t2;

          case 71:
            _context56.prev = 71;
            _context56.prev = 72;

            if (!_iteratorNormalCompletion13 && _iterator13.return) {
              _iterator13.return();
            }

          case 74:
            _context56.prev = 74;

            if (!_didIteratorError13) {
              _context56.next = 77;
              break;
            }

            throw _iteratorError13;

          case 77:
            return _context56.finish(74);

          case 78:
            return _context56.finish(71);

          case 79:

            receive += 2;
            change += 2;
            nested += 2;

            _context56.next = 84;
            return this.getAccount(acct);

          case 84:
            account = _context56.sent;

            assert(account);

            _context56.next = 88;
            return account.syncDepth(receive, change, nested);

          case 88:
            ring = _context56.sent;


            if (ring) derived.push(ring);

          case 90:
            _iteratorNormalCompletion12 = true;
            _context56.next = 38;
            break;

          case 93:
            _context56.next = 99;
            break;

          case 95:
            _context56.prev = 95;
            _context56.t3 = _context56['catch'](36);
            _didIteratorError12 = true;
            _iteratorError12 = _context56.t3;

          case 99:
            _context56.prev = 99;
            _context56.prev = 100;

            if (!_iteratorNormalCompletion12 && _iterator12.return) {
              _iterator12.return();
            }

          case 102:
            _context56.prev = 102;

            if (!_didIteratorError12) {
              _context56.next = 105;
              break;
            }

            throw _iteratorError12;

          case 105:
            return _context56.finish(102);

          case 106:
            return _context56.finish(99);

          case 107:
            return _context56.abrupt('return', derived);

          case 108:
          case 'end':
            return _context56.stop();
        }
      }
    }, _callee56, this, [[4, 20, 24, 32], [25,, 27, 31], [36, 95, 99, 107], [49, 67, 71, 79], [72,, 74, 78], [100,, 102, 106]]);
  }));

  function syncOutputDepth(_x81) {
    return _ref56.apply(this, arguments);
  }

  return syncOutputDepth;
}();

/**
 * Get a redeem script or witness script by hash.
 * @param {Hash} hash - Can be a ripemd160 or a sha256.
 * @returns {Script}
 */

Wallet.prototype.getRedeem = function () {
  var _ref59 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee57(hash) {
    var ring;
    return _regenerator2.default.wrap(function _callee57$(_context57) {
      while (1) {
        switch (_context57.prev = _context57.next) {
          case 0:
            if (typeof hash === 'string') hash = Buffer.from(hash, 'hex');

            _context57.next = 3;
            return this.getKey(hash.toString('hex'));

          case 3:
            ring = _context57.sent;

            if (ring) {
              _context57.next = 6;
              break;
            }

            return _context57.abrupt('return', null);

          case 6:
            return _context57.abrupt('return', ring.getRedeem(hash));

          case 7:
          case 'end':
            return _context57.stop();
        }
      }
    }, _callee57, this);
  }));

  function getRedeem(_x82) {
    return _ref59.apply(this, arguments);
  }

  return getRedeem;
}();

/**
 * Build input scripts templates for a transaction (does not
 * sign, only creates signature slots). Only builds scripts
 * for inputs that are redeemable by this wallet.
 * @param {MTX} mtx
 * @returns {Promise} - Returns Number
 * (total number of scripts built).
 */

Wallet.prototype.template = function () {
  var _ref60 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee58(mtx) {
    var rings;
    return _regenerator2.default.wrap(function _callee58$(_context58) {
      while (1) {
        switch (_context58.prev = _context58.next) {
          case 0:
            _context58.next = 2;
            return this.deriveInputs(mtx);

          case 2:
            rings = _context58.sent;
            return _context58.abrupt('return', mtx.template(rings));

          case 4:
          case 'end':
            return _context58.stop();
        }
      }
    }, _callee58, this);
  }));

  function template(_x83) {
    return _ref60.apply(this, arguments);
  }

  return template;
}();

/**
 * Build input scripts and sign inputs for a transaction. Only attempts
 * to build/sign inputs that are redeemable by this wallet.
 * @param {MTX} tx
 * @param {Object|String|Buffer} options - Options or passphrase.
 * @returns {Promise} - Returns Number (total number
 * of inputs scripts built and signed).
 */

Wallet.prototype.sign = function () {
  var _ref61 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee59(mtx, passphrase) {
    var rings;
    return _regenerator2.default.wrap(function _callee59$(_context59) {
      while (1) {
        switch (_context59.prev = _context59.next) {
          case 0:
            if (!this.watchOnly) {
              _context59.next = 2;
              break;
            }

            throw new Error('Cannot sign from a watch-only wallet.');

          case 2:
            _context59.next = 4;
            return this.unlock(passphrase);

          case 4:
            _context59.next = 6;
            return this.deriveInputs(mtx);

          case 6:
            rings = _context59.sent;
            _context59.next = 9;
            return mtx.signAsync(rings, Script.hashType.ALL, this.db.workers);

          case 9:
            return _context59.abrupt('return', _context59.sent);

          case 10:
          case 'end':
            return _context59.stop();
        }
      }
    }, _callee59, this);
  }));

  function sign(_x84, _x85) {
    return _ref61.apply(this, arguments);
  }

  return sign;
}();

/**
 * Get a coin viewpoint.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

Wallet.prototype.getCoinView = function getCoinView(tx) {
  return this.txdb.getCoinView(tx);
};

/**
 * Get a historical coin viewpoint.
 * @param {TX} tx
 * @returns {Promise} - Returns {@link CoinView}.
 */

Wallet.prototype.getSpentView = function getSpentView(tx) {
  return this.txdb.getSpentView(tx);
};

/**
 * Convert transaction to transaction details.
 * @param {TXRecord} wtx
 * @returns {Promise} - Returns {@link Details}.
 */

Wallet.prototype.toDetails = function toDetails(wtx) {
  return this.txdb.toDetails(wtx);
};

/**
 * Get transaction details.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link Details}.
 */

Wallet.prototype.getDetails = function getDetails(hash) {
  return this.txdb.getDetails(hash);
};

/**
 * Get a coin from the wallet.
 * @param {Hash} hash
 * @param {Number} index
 * @returns {Promise} - Returns {@link Coin}.
 */

Wallet.prototype.getCoin = function getCoin(hash, index) {
  return this.txdb.getCoin(hash, index);
};

/**
 * Get a transaction from the wallet.
 * @param {Hash} hash
 * @returns {Promise} - Returns {@link TX}.
 */

Wallet.prototype.getTX = function getTX(hash) {
  return this.txdb.getTX(hash);
};

/**
 * List blocks for the wallet.
 * @returns {Promise} - Returns {@link BlockRecord}.
 */

Wallet.prototype.getBlocks = function getBlocks() {
  return this.txdb.getBlocks();
};

/**
 * Get a block from the wallet.
 * @param {Number} height
 * @returns {Promise} - Returns {@link BlockRecord}.
 */

Wallet.prototype.getBlock = function getBlock(height) {
  return this.txdb.getBlock(height);
};

/**
 * Add a transaction to the wallets TX history.
 * @param {TX} tx
 * @returns {Promise}
 */

Wallet.prototype.add = function () {
  var _ref62 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee60(tx, block) {
    var unlock;
    return _regenerator2.default.wrap(function _callee60$(_context60) {
      while (1) {
        switch (_context60.prev = _context60.next) {
          case 0:
            _context60.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context60.sent;
            _context60.prev = 3;
            _context60.next = 6;
            return this._add(tx, block);

          case 6:
            return _context60.abrupt('return', _context60.sent);

          case 7:
            _context60.prev = 7;

            unlock();
            return _context60.finish(7);

          case 10:
          case 'end':
            return _context60.stop();
        }
      }
    }, _callee60, this, [[3,, 7, 10]]);
  }));

  function add(_x86, _x87) {
    return _ref62.apply(this, arguments);
  }

  return add;
}();

/**
 * Add a transaction to the wallet without a lock.
 * Potentially resolves orphans.
 * @private
 * @param {TX} tx
 * @returns {Promise}
 */

Wallet.prototype._add = function () {
  var _ref63 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee61(tx, block) {
    var details, derived;
    return _regenerator2.default.wrap(function _callee61$(_context61) {
      while (1) {
        switch (_context61.prev = _context61.next) {
          case 0:
            this.txdb.start();

            details = void 0, derived = void 0;
            _context61.prev = 2;
            _context61.next = 5;
            return this.txdb._add(tx, block);

          case 5:
            details = _context61.sent;

            if (!details) {
              _context61.next = 10;
              break;
            }

            _context61.next = 9;
            return this.syncOutputDepth(details);

          case 9:
            derived = _context61.sent;

          case 10:
            _context61.next = 16;
            break;

          case 12:
            _context61.prev = 12;
            _context61.t0 = _context61['catch'](2);

            this.txdb.drop();
            throw _context61.t0;

          case 16:
            _context61.next = 18;
            return this.txdb.commit();

          case 18:

            if (derived && derived.length > 0) {
              this.db.emit('address', this.id, derived);
              this.emit('address', derived);
            }

            return _context61.abrupt('return', details);

          case 20:
          case 'end':
            return _context61.stop();
        }
      }
    }, _callee61, this, [[2, 12]]);
  }));

  function _add(_x88, _x89) {
    return _ref63.apply(this, arguments);
  }

  return _add;
}();

/**
 * Unconfirm a wallet transcation.
 * @param {Hash} hash
 * @returns {Promise}
 */

Wallet.prototype.unconfirm = function () {
  var _ref64 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee62(hash) {
    var unlock;
    return _regenerator2.default.wrap(function _callee62$(_context62) {
      while (1) {
        switch (_context62.prev = _context62.next) {
          case 0:
            _context62.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context62.sent;
            _context62.prev = 3;
            _context62.next = 6;
            return this.txdb.unconfirm(hash);

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

  function unconfirm(_x90) {
    return _ref64.apply(this, arguments);
  }

  return unconfirm;
}();

/**
 * Remove a wallet transaction.
 * @param {Hash} hash
 * @returns {Promise}
 */

Wallet.prototype.remove = function () {
  var _ref65 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee63(hash) {
    var unlock;
    return _regenerator2.default.wrap(function _callee63$(_context63) {
      while (1) {
        switch (_context63.prev = _context63.next) {
          case 0:
            _context63.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context63.sent;
            _context63.prev = 3;
            _context63.next = 6;
            return this.txdb.remove(hash);

          case 6:
            return _context63.abrupt('return', _context63.sent);

          case 7:
            _context63.prev = 7;

            unlock();
            return _context63.finish(7);

          case 10:
          case 'end':
            return _context63.stop();
        }
      }
    }, _callee63, this, [[3,, 7, 10]]);
  }));

  function remove(_x91) {
    return _ref65.apply(this, arguments);
  }

  return remove;
}();

/**
 * Zap stale TXs from wallet.
 * @param {(Number|String)?} acct
 * @param {Number} age - Age threshold (unix time, default=72 hours).
 * @returns {Promise}
 */

Wallet.prototype.zap = function () {
  var _ref66 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee64(acct, age) {
    var unlock;
    return _regenerator2.default.wrap(function _callee64$(_context64) {
      while (1) {
        switch (_context64.prev = _context64.next) {
          case 0:
            _context64.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context64.sent;
            _context64.prev = 3;
            _context64.next = 6;
            return this._zap(acct, age);

          case 6:
            return _context64.abrupt('return', _context64.sent);

          case 7:
            _context64.prev = 7;

            unlock();
            return _context64.finish(7);

          case 10:
          case 'end':
            return _context64.stop();
        }
      }
    }, _callee64, this, [[3,, 7, 10]]);
  }));

  function zap(_x92, _x93) {
    return _ref66.apply(this, arguments);
  }

  return zap;
}();

/**
 * Zap stale TXs from wallet without a lock.
 * @private
 * @param {(Number|String)?} acct
 * @param {Number} age
 * @returns {Promise}
 */

Wallet.prototype._zap = function () {
  var _ref67 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee65(acct, age) {
    var account;
    return _regenerator2.default.wrap(function _callee65$(_context65) {
      while (1) {
        switch (_context65.prev = _context65.next) {
          case 0:
            _context65.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context65.sent;
            _context65.next = 5;
            return this.txdb.zap(account, age);

          case 5:
            return _context65.abrupt('return', _context65.sent);

          case 6:
          case 'end':
            return _context65.stop();
        }
      }
    }, _callee65, this);
  }));

  function _zap(_x94, _x95) {
    return _ref67.apply(this, arguments);
  }

  return _zap;
}();

/**
 * Abandon transaction.
 * @param {Hash} hash
 * @returns {Promise}
 */

Wallet.prototype.abandon = function () {
  var _ref68 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee66(hash) {
    var unlock;
    return _regenerator2.default.wrap(function _callee66$(_context66) {
      while (1) {
        switch (_context66.prev = _context66.next) {
          case 0:
            _context66.next = 2;
            return this.writeLock.lock();

          case 2:
            unlock = _context66.sent;
            _context66.prev = 3;
            _context66.next = 6;
            return this._abandon(hash);

          case 6:
            return _context66.abrupt('return', _context66.sent);

          case 7:
            _context66.prev = 7;

            unlock();
            return _context66.finish(7);

          case 10:
          case 'end':
            return _context66.stop();
        }
      }
    }, _callee66, this, [[3,, 7, 10]]);
  }));

  function abandon(_x96) {
    return _ref68.apply(this, arguments);
  }

  return abandon;
}();

/**
 * Abandon transaction without a lock.
 * @private
 * @param {Hash} hash
 * @returns {Promise}
 */

Wallet.prototype._abandon = function _abandon(hash) {
  return this.txdb.abandon(hash);
};

/**
 * Lock a single coin.
 * @param {Coin|Outpoint} coin
 */

Wallet.prototype.lockCoin = function lockCoin(coin) {
  return this.txdb.lockCoin(coin);
};

/**
 * Unlock a single coin.
 * @param {Coin|Outpoint} coin
 */

Wallet.prototype.unlockCoin = function unlockCoin(coin) {
  return this.txdb.unlockCoin(coin);
};

/**
 * Test locked status of a single coin.
 * @param {Coin|Outpoint} coin
 */

Wallet.prototype.isLocked = function isLocked(coin) {
  return this.txdb.isLocked(coin);
};

/**
 * Return an array of all locked outpoints.
 * @returns {Outpoint[]}
 */

Wallet.prototype.getLocked = function getLocked() {
  return this.txdb.getLocked();
};

/**
 * Get all transactions in transaction history.
 * @param {(String|Number)?} acct
 * @returns {Promise} - Returns {@link TX}[].
 */

Wallet.prototype.getHistory = function () {
  var _ref69 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee67(acct) {
    var account;
    return _regenerator2.default.wrap(function _callee67$(_context67) {
      while (1) {
        switch (_context67.prev = _context67.next) {
          case 0:
            _context67.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context67.sent;
            return _context67.abrupt('return', this.txdb.getHistory(account));

          case 4:
          case 'end':
            return _context67.stop();
        }
      }
    }, _callee67, this);
  }));

  function getHistory(_x97) {
    return _ref69.apply(this, arguments);
  }

  return getHistory;
}();

/**
 * Get all available coins.
 * @param {(String|Number)?} account
 * @returns {Promise} - Returns {@link Coin}[].
 */

Wallet.prototype.getCoins = function () {
  var _ref70 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee68(acct) {
    var account;
    return _regenerator2.default.wrap(function _callee68$(_context68) {
      while (1) {
        switch (_context68.prev = _context68.next) {
          case 0:
            _context68.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context68.sent;
            _context68.next = 5;
            return this.txdb.getCoins(account);

          case 5:
            return _context68.abrupt('return', _context68.sent);

          case 6:
          case 'end':
            return _context68.stop();
        }
      }
    }, _callee68, this);
  }));

  function getCoins(_x98) {
    return _ref70.apply(this, arguments);
  }

  return getCoins;
}();

/**
 * Get all available credits.
 * @param {(String|Number)?} account
 * @returns {Promise} - Returns {@link Credit}[].
 */

Wallet.prototype.getCredits = function () {
  var _ref71 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee69(acct) {
    var account;
    return _regenerator2.default.wrap(function _callee69$(_context69) {
      while (1) {
        switch (_context69.prev = _context69.next) {
          case 0:
            _context69.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context69.sent;
            _context69.next = 5;
            return this.txdb.getCredits(account);

          case 5:
            return _context69.abrupt('return', _context69.sent);

          case 6:
          case 'end':
            return _context69.stop();
        }
      }
    }, _callee69, this);
  }));

  function getCredits(_x99) {
    return _ref71.apply(this, arguments);
  }

  return getCredits;
}();

/**
 * Get "smart" coins.
 * @param {(String|Number)?} account
 * @returns {Promise} - Returns {@link Coin}[].
 */

Wallet.prototype.getSmartCoins = function () {
  var _ref72 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee70(acct) {
    var credits, coins, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, credit, coin;

    return _regenerator2.default.wrap(function _callee70$(_context70) {
      while (1) {
        switch (_context70.prev = _context70.next) {
          case 0:
            _context70.next = 2;
            return this.getCredits(acct);

          case 2:
            credits = _context70.sent;
            coins = [];
            _iteratorNormalCompletion14 = true;
            _didIteratorError14 = false;
            _iteratorError14 = undefined;
            _context70.prev = 7;
            _iterator14 = (0, _getIterator3.default)(credits);

          case 9:
            if (_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done) {
              _context70.next = 25;
              break;
            }

            credit = _step14.value;
            coin = credit.coin;

            if (!credit.spent) {
              _context70.next = 14;
              break;
            }

            return _context70.abrupt('continue', 22);

          case 14:
            if (!this.txdb.isLocked(coin)) {
              _context70.next = 16;
              break;
            }

            return _context70.abrupt('continue', 22);

          case 16:
            if (!(coin.height !== -1)) {
              _context70.next = 19;
              break;
            }

            coins.push(coin);
            return _context70.abrupt('continue', 22);

          case 19:
            if (credit.own) {
              _context70.next = 21;
              break;
            }

            return _context70.abrupt('continue', 22);

          case 21:

            coins.push(coin);

          case 22:
            _iteratorNormalCompletion14 = true;
            _context70.next = 9;
            break;

          case 25:
            _context70.next = 31;
            break;

          case 27:
            _context70.prev = 27;
            _context70.t0 = _context70['catch'](7);
            _didIteratorError14 = true;
            _iteratorError14 = _context70.t0;

          case 31:
            _context70.prev = 31;
            _context70.prev = 32;

            if (!_iteratorNormalCompletion14 && _iterator14.return) {
              _iterator14.return();
            }

          case 34:
            _context70.prev = 34;

            if (!_didIteratorError14) {
              _context70.next = 37;
              break;
            }

            throw _iteratorError14;

          case 37:
            return _context70.finish(34);

          case 38:
            return _context70.finish(31);

          case 39:
            return _context70.abrupt('return', coins);

          case 40:
          case 'end':
            return _context70.stop();
        }
      }
    }, _callee70, this, [[7, 27, 31, 39], [32,, 34, 38]]);
  }));

  function getSmartCoins(_x100) {
    return _ref72.apply(this, arguments);
  }

  return getSmartCoins;
}();

/**
 * Get all pending/unconfirmed transactions.
 * @param {(String|Number)?} acct
 * @returns {Promise} - Returns {@link TX}[].
 */

Wallet.prototype.getPending = function () {
  var _ref73 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee71(acct) {
    var account;
    return _regenerator2.default.wrap(function _callee71$(_context71) {
      while (1) {
        switch (_context71.prev = _context71.next) {
          case 0:
            _context71.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context71.sent;
            _context71.next = 5;
            return this.txdb.getPending(account);

          case 5:
            return _context71.abrupt('return', _context71.sent);

          case 6:
          case 'end':
            return _context71.stop();
        }
      }
    }, _callee71, this);
  }));

  function getPending(_x101) {
    return _ref73.apply(this, arguments);
  }

  return getPending;
}();

/**
 * Get wallet balance.
 * @param {(String|Number)?} acct
 * @returns {Promise} - Returns {@link Balance}.
 */

Wallet.prototype.getBalance = function () {
  var _ref74 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee72(acct) {
    var account;
    return _regenerator2.default.wrap(function _callee72$(_context72) {
      while (1) {
        switch (_context72.prev = _context72.next) {
          case 0:
            _context72.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context72.sent;
            _context72.next = 5;
            return this.txdb.getBalance(account);

          case 5:
            return _context72.abrupt('return', _context72.sent);

          case 6:
          case 'end':
            return _context72.stop();
        }
      }
    }, _callee72, this);
  }));

  function getBalance(_x102) {
    return _ref74.apply(this, arguments);
  }

  return getBalance;
}();

/**
 * Get a range of transactions between two timestamps.
 * @param {(String|Number)?} acct
 * @param {Object} options
 * @param {Number} options.start
 * @param {Number} options.end
 * @returns {Promise} - Returns {@link TX}[].
 */

Wallet.prototype.getRange = function () {
  var _ref75 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee73(acct, options) {
    var account;
    return _regenerator2.default.wrap(function _callee73$(_context73) {
      while (1) {
        switch (_context73.prev = _context73.next) {
          case 0:
            if (acct && (typeof acct === 'undefined' ? 'undefined' : (0, _typeof3.default)(acct)) === 'object') {
              options = acct;
              acct = null;
            }
            _context73.next = 3;
            return this.ensureIndex(acct);

          case 3:
            account = _context73.sent;
            _context73.next = 6;
            return this.txdb.getRange(account, options);

          case 6:
            return _context73.abrupt('return', _context73.sent);

          case 7:
          case 'end':
            return _context73.stop();
        }
      }
    }, _callee73, this);
  }));

  function getRange(_x103, _x104) {
    return _ref75.apply(this, arguments);
  }

  return getRange;
}();

/**
 * Get the last N transactions.
 * @param {(String|Number)?} acct
 * @param {Number} limit
 * @returns {Promise} - Returns {@link TX}[].
 */

Wallet.prototype.getLast = function () {
  var _ref76 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee74(acct, limit) {
    var account;
    return _regenerator2.default.wrap(function _callee74$(_context74) {
      while (1) {
        switch (_context74.prev = _context74.next) {
          case 0:
            _context74.next = 2;
            return this.ensureIndex(acct);

          case 2:
            account = _context74.sent;
            _context74.next = 5;
            return this.txdb.getLast(account, limit);

          case 5:
            return _context74.abrupt('return', _context74.sent);

          case 6:
          case 'end':
            return _context74.stop();
        }
      }
    }, _callee74, this);
  }));

  function getLast(_x105, _x106) {
    return _ref76.apply(this, arguments);
  }

  return getLast;
}();

/**
 * Resolve account index.
 * @private
 * @param {(Number|String)?} acct
 * @param {Function} errback - Returns [Error].
 * @returns {Promise}
 */

Wallet.prototype.ensureIndex = function () {
  var _ref77 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee75(acct, enforce) {
    var index;
    return _regenerator2.default.wrap(function _callee75$(_context75) {
      while (1) {
        switch (_context75.prev = _context75.next) {
          case 0:
            if (!(acct == null)) {
              _context75.next = 4;
              break;
            }

            if (!enforce) {
              _context75.next = 3;
              break;
            }

            throw new Error('No account provided.');

          case 3:
            return _context75.abrupt('return', null);

          case 4:
            _context75.next = 6;
            return this.getAccountIndex(acct);

          case 6:
            index = _context75.sent;

            if (!(index === -1)) {
              _context75.next = 9;
              break;
            }

            throw new Error('Account not found.');

          case 9:
            return _context75.abrupt('return', index);

          case 10:
          case 'end':
            return _context75.stop();
        }
      }
    }, _callee75, this);
  }));

  function ensureIndex(_x107, _x108) {
    return _ref77.apply(this, arguments);
  }

  return ensureIndex;
}();

/**
 * Get current receive address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Wallet.prototype.getAddress = function getAddress(enc) {
  return this.account.getAddress(enc);
};

/**
 * Get current receive address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Wallet.prototype.getReceive = function getReceive(enc) {
  return this.account.getReceive(enc);
};

/**
 * Get current change address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Wallet.prototype.getChange = function getChange(enc) {
  return this.account.getChange(enc);
};

/**
 * Get current nested address.
 * @param {String?} enc - `"base58"` or `null`.
 * @returns {Address|Base58Address}
 */

Wallet.prototype.getNested = function getNested(enc) {
  return this.account.getNested(enc);
};

/**
 * Convert the wallet to a more inspection-friendly object.
 * @returns {Object}
 */

Wallet.prototype.inspect = function inspect() {
  return {
    wid: this.wid,
    id: this.id,
    network: this.network.type,
    initialized: this.initialized,
    accountDepth: this.accountDepth,
    token: this.token.toString('hex'),
    tokenDepth: this.tokenDepth,
    state: this.txdb.state ? this.txdb.state.toJSON(true) : null,
    master: this.master,
    account: this.account
  };
};

/**
 * Convert the wallet to an object suitable for
 * serialization.
 * @param {Boolean?} unsafe - Whether to include
 * the master key in the JSON.
 * @returns {Object}
 */

Wallet.prototype.toJSON = function toJSON(unsafe) {
  return {
    network: this.network.type,
    wid: this.wid,
    id: this.id,
    initialized: this.initialized,
    watchOnly: this.watchOnly,
    accountDepth: this.accountDepth,
    token: this.token.toString('hex'),
    tokenDepth: this.tokenDepth,
    state: this.txdb.state.toJSON(true),
    master: this.master.toJSON(unsafe),
    account: this.account.toJSON(true)
  };
};

/**
 * Calculate serialization size.
 * @returns {Number}
 */

Wallet.prototype.getSize = function getSize() {
  var size = 0;
  size += 50;
  size += encoding.sizeVarString(this.id, 'ascii');
  size += encoding.sizeVarlen(this.master.getSize());
  return size;
};

/**
 * Serialize the wallet.
 * @returns {Buffer}
 */

Wallet.prototype.toRaw = function toRaw() {
  var size = this.getSize();
  var bw = new StaticWriter(size);

  bw.writeU32(this.network.magic);
  bw.writeU32(this.wid);
  bw.writeVarString(this.id, 'ascii');
  bw.writeU8(this.initialized ? 1 : 0);
  bw.writeU8(this.watchOnly ? 1 : 0);
  bw.writeU32(this.accountDepth);
  bw.writeBytes(this.token);
  bw.writeU32(this.tokenDepth);
  bw.writeVarBytes(this.master.toRaw());

  return bw.render();
};

/**
 * Inject properties from serialized data.
 * @private
 * @param {Buffer} data
 */

Wallet.prototype.fromRaw = function fromRaw(data) {
  var br = new BufferReader(data);
  var network = Network.fromMagic(br.readU32());

  this.wid = br.readU32();
  this.id = br.readVarString('ascii');
  this.initialized = br.readU8() === 1;
  this.watchOnly = br.readU8() === 1;
  this.accountDepth = br.readU32();
  this.token = br.readBytes(32);
  this.tokenDepth = br.readU32();
  this.master.fromRaw(br.readVarBytes());

  assert(network === this.db.network, 'Wallet network mismatch.');

  return this;
};

/**
 * Instantiate a wallet from serialized data.
 * @param {Buffer} data
 * @returns {Wallet}
 */

Wallet.fromRaw = function fromRaw(db, data) {
  return new Wallet(db).fromRaw(data);
};

/**
 * Test an object to see if it is a Wallet.
 * @param {Object} obj
 * @returns {Boolean}
 */

Wallet.isWallet = function isWallet(obj) {
  return obj instanceof Wallet;
};

/*
 * Expose
 */

module.exports = Wallet;