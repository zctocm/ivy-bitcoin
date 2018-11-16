/*!
 * rpc.js - bitcoind-compatible json rpc for bcoin.
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _map2 = require('babel-runtime/core-js/map');

var _map3 = _interopRequireDefault(_map2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

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
var fs = require('../utils/fs');
var util = require('../utils/util');
var digest = require('../crypto/digest');
var Amount = require('../btc/amount');
var Script = require('../script/script');
var Address = require('../primitives/address');
var KeyRing = require('../primitives/keyring');
var MerkleBlock = require('../primitives/merkleblock');
var MTX = require('../primitives/mtx');
var Outpoint = require('../primitives/outpoint');
var Output = require('../primitives/output');
var TX = require('../primitives/tx');
var encoding = require('../utils/encoding');
var RPCBase = require('../http/rpcbase');
var pkg = require('../pkg');
var Validator = require('../utils/validator');
var common = require('./common');
var RPCError = RPCBase.RPCError;
var errs = RPCBase.errors;
var MAGIC_STRING = RPCBase.MAGIC_STRING;

/**
 * Bitcoin Core RPC
 * @alias module:wallet.RPC
 * @constructor
 * @param {WalletDB} wdb
 */

function RPC(wdb) {
  if (!(this instanceof RPC)) return new RPC(wdb);

  RPCBase.call(this);

  assert(wdb, 'RPC requires a WalletDB.');

  this.wdb = wdb;
  this.network = wdb.network;
  this.logger = wdb.logger.context('rpc');
  this.client = wdb.client;

  this.wallet = null;

  this.init();
}

(0, _setPrototypeOf2.default)(RPC.prototype, RPCBase.prototype);

RPC.prototype.init = function init() {
  this.add('help', this.help);
  this.add('stop', this.stop);
  this.add('fundrawtransaction', this.fundRawTransaction);
  this.add('resendwallettransactions', this.resendWalletTransactions);
  this.add('abandontransaction', this.abandonTransaction);
  this.add('addmultisigaddress', this.addMultisigAddress);
  this.add('addwitnessaddress', this.addWitnessAddress);
  this.add('backupwallet', this.backupWallet);
  this.add('dumpprivkey', this.dumpPrivKey);
  this.add('dumpwallet', this.dumpWallet);
  this.add('encryptwallet', this.encryptWallet);
  this.add('getaccountaddress', this.getAccountAddress);
  this.add('getaccount', this.getAccount);
  this.add('getaddressesbyaccount', this.getAddressesByAccount);
  this.add('getbalance', this.getBalance);
  this.add('getnewaddress', this.getNewAddress);
  this.add('getrawchangeaddress', this.getRawChangeAddress);
  this.add('getreceivedbyaccount', this.getReceivedByAccount);
  this.add('getreceivedbyaddress', this.getReceivedByAddress);
  this.add('gettransaction', this.getTransaction);
  this.add('getunconfirmedbalance', this.getUnconfirmedBalance);
  this.add('getwalletinfo', this.getWalletInfo);
  this.add('importprivkey', this.importPrivKey);
  this.add('importwallet', this.importWallet);
  this.add('importaddress', this.importAddress);
  this.add('importprunedfunds', this.importPrunedFunds);
  this.add('importpubkey', this.importPubkey);
  this.add('keypoolrefill', this.keyPoolRefill);
  this.add('listaccounts', this.listAccounts);
  this.add('listaddressgroupings', this.listAddressGroupings);
  this.add('listlockunspent', this.listLockUnspent);
  this.add('listreceivedbyaccount', this.listReceivedByAccount);
  this.add('listreceivedbyaddress', this.listReceivedByAddress);
  this.add('listsinceblock', this.listSinceBlock);
  this.add('listtransactions', this.listTransactions);
  this.add('listunspent', this.listUnspent);
  this.add('lockunspent', this.lockUnspent);
  this.add('move', this.move);
  this.add('sendfrom', this.sendFrom);
  this.add('sendmany', this.sendMany);
  this.add('sendtoaddress', this.sendToAddress);
  this.add('setaccount', this.setAccount);
  this.add('settxfee', this.setTXFee);
  this.add('signmessage', this.signMessage);
  this.add('walletlock', this.walletLock);
  this.add('walletpassphrasechange', this.walletPassphraseChange);
  this.add('walletpassphrase', this.walletPassphrase);
  this.add('removeprunedfunds', this.removePrunedFunds);
  this.add('selectwallet', this.selectWallet);
  this.add('getmemoryinfo', this.getMemoryInfo);
  this.add('setloglevel', this.setLogLevel);
};

RPC.prototype.help = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(args, _help) {
    var json;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!(args.length === 0)) {
              _context.next = 2;
              break;
            }

            return _context.abrupt('return', 'Select a command.');

          case 2:
            json = {
              method: args[0],
              params: []
            };
            _context.next = 5;
            return this.execute(json, true);

          case 5:
            return _context.abrupt('return', _context.sent);

          case 6:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function help(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return help;
}();

RPC.prototype.stop = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(args, help) {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context2.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'stop');

          case 2:

            this.wdb.close();

            return _context2.abrupt('return', 'Stopping.');

          case 4:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function stop(_x3, _x4) {
    return _ref2.apply(this, arguments);
  }

  return stop;
}();

RPC.prototype.fundRawTransaction = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(args, help) {
    var wallet, valid, data, options, tx, rate, change, _valid;

    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context3.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'fundrawtransaction "hexstring" ( options )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            data = valid.buf(0);
            options = valid.obj(1);

            if (data) {
              _context3.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid hex string.');

          case 8:
            tx = MTX.fromRaw(data);

            if (!(tx.outputs.length === 0)) {
              _context3.next = 11;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'TX must have at least one output.');

          case 11:
            rate = null;
            change = null;


            if (options) {
              _valid = new Validator([options]);


              rate = _valid.ufixed('feeRate', 8);
              change = _valid.str('changeAddress');

              if (change) change = parseAddress(change, this.network);
            }

            _context3.next = 16;
            return wallet.fund(tx, {
              rate: rate,
              changeAddress: change
            });

          case 16:
            return _context3.abrupt('return', {
              hex: tx.toRaw().toString('hex'),
              changepos: tx.changeIndex,
              fee: Amount.btc(tx.getFee(), true)
            });

          case 17:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function fundRawTransaction(_x5, _x6) {
    return _ref3.apply(this, arguments);
  }

  return fundRawTransaction;
}();

/*
 * Wallet
 */

RPC.prototype.resendWalletTransactions = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(args, help) {
    var wallet, txs, hashes, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, tx;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context4.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'resendwallettransactions');

          case 2:
            wallet = this.wallet;
            _context4.next = 5;
            return wallet.resend();

          case 5:
            txs = _context4.sent;
            hashes = [];
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context4.prev = 10;


            for (_iterator = (0, _getIterator3.default)(txs); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              tx = _step.value;

              hashes.push(tx.txid());
            }_context4.next = 18;
            break;

          case 14:
            _context4.prev = 14;
            _context4.t0 = _context4['catch'](10);
            _didIteratorError = true;
            _iteratorError = _context4.t0;

          case 18:
            _context4.prev = 18;
            _context4.prev = 19;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 21:
            _context4.prev = 21;

            if (!_didIteratorError) {
              _context4.next = 24;
              break;
            }

            throw _iteratorError;

          case 24:
            return _context4.finish(21);

          case 25:
            return _context4.finish(18);

          case 26:
            return _context4.abrupt('return', hashes);

          case 27:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[10, 14, 18, 26], [19,, 21, 25]]);
  }));

  function resendWalletTransactions(_x7, _x8) {
    return _ref4.apply(this, arguments);
  }

  return resendWalletTransactions;
}();

RPC.prototype.addMultisigAddress = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(args, help) {
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 3)) {
              _context5.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'addmultisigaddress nrequired ["key",...] ( "account" )');

          case 2:
            throw new Error('Not implemented.');

          case 3:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function addMultisigAddress(_x9, _x10) {
    return _ref5.apply(this, arguments);
  }

  return addMultisigAddress;
}();

RPC.prototype.addWitnessAddress = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(args, help) {
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 1)) {
              _context6.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'addwitnessaddress "address"');

          case 2:
            throw new Error('Not implemented.');

          case 3:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function addWitnessAddress(_x11, _x12) {
    return _ref6.apply(this, arguments);
  }

  return addWitnessAddress;
}();

RPC.prototype.backupWallet = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(args, help) {
    var valid, dest;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            valid = new Validator([args]);
            dest = valid.str(0);

            if (!(help || args.length !== 1 || !dest)) {
              _context7.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'backupwallet "destination"');

          case 4:
            _context7.next = 6;
            return this.wdb.backup(dest);

          case 6:
            return _context7.abrupt('return', null);

          case 7:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function backupWallet(_x13, _x14) {
    return _ref7.apply(this, arguments);
  }

  return backupWallet;
}();

RPC.prototype.dumpPrivKey = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(args, help) {
    var wallet, valid, addr, hash, ring;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context8.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'dumpprivkey "bitcoinaddress"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            addr = valid.str(0, '');
            hash = parseHash(addr, this.network);
            _context8.next = 8;
            return wallet.getPrivateKey(hash);

          case 8:
            ring = _context8.sent;

            if (ring) {
              _context8.next = 11;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'Key not found.');

          case 11:
            return _context8.abrupt('return', ring.toSecret());

          case 12:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function dumpPrivKey(_x15, _x16) {
    return _ref8.apply(this, arguments);
  }

  return dumpPrivKey;
}();

RPC.prototype.dumpWallet = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(args, help) {
    var wallet, valid, file, tip, time, out, hashes, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, hash, ring, addr, fmt, str, dump;

    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context9.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'dumpwallet "filename"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            file = valid.str(0);

            if (file) {
              _context9.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 7:
            _context9.next = 9;
            return this.wdb.getTip();

          case 9:
            tip = _context9.sent;
            time = util.date();
            out = [util.fmt('# Wallet Dump created by Bcoin %s', pkg.version), util.fmt('# * Created on %s', time), util.fmt('# * Best block at time of backup was %d (%s).', tip.height, util.revHex(tip.hash)), util.fmt('# * File: %s', file), ''];
            _context9.next = 14;
            return wallet.getAddressHashes();

          case 14:
            hashes = _context9.sent;
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context9.prev = 18;
            _iterator2 = (0, _getIterator3.default)(hashes);

          case 20:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context9.next = 35;
              break;
            }

            hash = _step2.value;
            _context9.next = 24;
            return wallet.getPrivateKey(hash);

          case 24:
            ring = _context9.sent;

            if (ring) {
              _context9.next = 27;
              break;
            }

            return _context9.abrupt('continue', 32);

          case 27:
            addr = ring.getAddress('string');
            fmt = '%s %s label= addr=%s';


            if (ring.branch === 1) fmt = '%s %s change=1 addr=%s';

            str = util.fmt(fmt, ring.toSecret(), time, addr);


            out.push(str);

          case 32:
            _iteratorNormalCompletion2 = true;
            _context9.next = 20;
            break;

          case 35:
            _context9.next = 41;
            break;

          case 37:
            _context9.prev = 37;
            _context9.t0 = _context9['catch'](18);
            _didIteratorError2 = true;
            _iteratorError2 = _context9.t0;

          case 41:
            _context9.prev = 41;
            _context9.prev = 42;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 44:
            _context9.prev = 44;

            if (!_didIteratorError2) {
              _context9.next = 47;
              break;
            }

            throw _iteratorError2;

          case 47:
            return _context9.finish(44);

          case 48:
            return _context9.finish(41);

          case 49:

            out.push('');
            out.push('# End of dump');
            out.push('');

            dump = out.join('\n');

            if (!fs.unsupported) {
              _context9.next = 55;
              break;
            }

            return _context9.abrupt('return', dump);

          case 55:
            _context9.next = 57;
            return fs.writeFile(file, dump, 'utf8');

          case 57:
            return _context9.abrupt('return', null);

          case 58:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[18, 37, 41, 49], [42,, 44, 48]]);
  }));

  function dumpWallet(_x17, _x18) {
    return _ref9.apply(this, arguments);
  }

  return dumpWallet;
}();

RPC.prototype.encryptWallet = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(args, help) {
    var wallet, valid, passphrase;
    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            wallet = this.wallet;

            if (!(!wallet.master.encrypted && (help || args.length !== 1))) {
              _context10.next = 3;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'encryptwallet "passphrase"');

          case 3:
            valid = new Validator([args]);
            passphrase = valid.str(0, '');

            if (!wallet.master.encrypted) {
              _context10.next = 7;
              break;
            }

            throw new RPCError(errs.WALLET_WRONG_ENC_STATE, 'Already running with an encrypted wallet.');

          case 7:
            if (!(passphrase.length < 1)) {
              _context10.next = 9;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'encryptwallet "passphrase"');

          case 9:
            _context10.prev = 9;
            _context10.next = 12;
            return wallet.setPassphrase(passphrase);

          case 12:
            _context10.next = 17;
            break;

          case 14:
            _context10.prev = 14;
            _context10.t0 = _context10['catch'](9);
            throw new RPCError(errs.WALLET_ENCRYPTION_FAILED, 'Encryption failed.');

          case 17:
            return _context10.abrupt('return', 'wallet encrypted; we do not need to stop!');

          case 18:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this, [[9, 14]]);
  }));

  function encryptWallet(_x19, _x20) {
    return _ref10.apply(this, arguments);
  }

  return encryptWallet;
}();

RPC.prototype.getAccountAddress = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(args, help) {
    var wallet, valid, name, account;
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context11.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getaccountaddress "account"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0, '');


            if (!name) name = 'default';

            _context11.next = 8;
            return wallet.getAccount(name);

          case 8:
            account = _context11.sent;

            if (account) {
              _context11.next = 11;
              break;
            }

            return _context11.abrupt('return', '');

          case 11:
            return _context11.abrupt('return', account.receive.getAddress('string'));

          case 12:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function getAccountAddress(_x21, _x22) {
    return _ref11.apply(this, arguments);
  }

  return getAccountAddress;
}();

RPC.prototype.getAccount = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(args, help) {
    var wallet, valid, addr, hash, path;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context12.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getaccount "bitcoinaddress"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            addr = valid.str(0, '');
            hash = parseHash(addr, this.network);
            _context12.next = 8;
            return wallet.getPath(hash);

          case 8:
            path = _context12.sent;

            if (path) {
              _context12.next = 11;
              break;
            }

            return _context12.abrupt('return', '');

          case 11:
            return _context12.abrupt('return', path.name);

          case 12:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this);
  }));

  function getAccount(_x23, _x24) {
    return _ref12.apply(this, arguments);
  }

  return getAccount;
}();

RPC.prototype.getAddressesByAccount = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(args, help) {
    var wallet, valid, name, addrs, paths, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, path, addr;

    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context13.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getaddressesbyaccount "account"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0, '');
            addrs = [];


            if (name === '') name = 'default';

            _context13.next = 9;
            return wallet.getPaths(name);

          case 9:
            paths = _context13.sent;
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context13.prev = 13;


            for (_iterator3 = (0, _getIterator3.default)(paths); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              path = _step3.value;
              addr = path.toAddress();

              addrs.push(addr.toString(this.network));
            }

            _context13.next = 21;
            break;

          case 17:
            _context13.prev = 17;
            _context13.t0 = _context13['catch'](13);
            _didIteratorError3 = true;
            _iteratorError3 = _context13.t0;

          case 21:
            _context13.prev = 21;
            _context13.prev = 22;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 24:
            _context13.prev = 24;

            if (!_didIteratorError3) {
              _context13.next = 27;
              break;
            }

            throw _iteratorError3;

          case 27:
            return _context13.finish(24);

          case 28:
            return _context13.finish(21);

          case 29:
            return _context13.abrupt('return', addrs);

          case 30:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this, [[13, 17, 21, 29], [22,, 24, 28]]);
  }));

  function getAddressesByAccount(_x25, _x26) {
    return _ref13.apply(this, arguments);
  }

  return getAddressesByAccount;
}();

RPC.prototype.getBalance = function () {
  var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(args, help) {
    var wallet, valid, name, minconf, watchOnly, balance, value;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            if (!(help || args.length > 3)) {
              _context14.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getbalance ( "account" minconf includeWatchonly )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0);
            minconf = valid.u32(1, 1);
            watchOnly = valid.bool(2, false);


            if (name === '') name = 'default';

            if (name === '*') name = null;

            if (!(wallet.watchOnly !== watchOnly)) {
              _context14.next = 11;
              break;
            }

            return _context14.abrupt('return', 0);

          case 11:
            _context14.next = 13;
            return wallet.getBalance(name);

          case 13:
            balance = _context14.sent;
            value = void 0;

            if (minconf > 0) value = balance.confirmed;else value = balance.unconfirmed;

            return _context14.abrupt('return', Amount.btc(value, true));

          case 17:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function getBalance(_x27, _x28) {
    return _ref14.apply(this, arguments);
  }

  return getBalance;
}();

RPC.prototype.getNewAddress = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(args, help) {
    var wallet, valid, name, addr;
    return _regenerator2.default.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            if (!(help || args.length > 1)) {
              _context15.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getnewaddress ( "account" )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0);


            if (name === '') name = 'default';

            _context15.next = 8;
            return wallet.createReceive(name);

          case 8:
            addr = _context15.sent;
            return _context15.abrupt('return', addr.getAddress('string'));

          case 10:
          case 'end':
            return _context15.stop();
        }
      }
    }, _callee15, this);
  }));

  function getNewAddress(_x29, _x30) {
    return _ref15.apply(this, arguments);
  }

  return getNewAddress;
}();

RPC.prototype.getRawChangeAddress = function () {
  var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(args, help) {
    var wallet, addr;
    return _regenerator2.default.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            if (!(help || args.length > 1)) {
              _context16.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getrawchangeaddress');

          case 2:
            wallet = this.wallet;
            _context16.next = 5;
            return wallet.createChange();

          case 5:
            addr = _context16.sent;
            return _context16.abrupt('return', addr.getAddress('string'));

          case 7:
          case 'end':
            return _context16.stop();
        }
      }
    }, _callee16, this);
  }));

  function getRawChangeAddress(_x31, _x32) {
    return _ref16.apply(this, arguments);
  }

  return getRawChangeAddress;
}();

RPC.prototype.getReceivedByAccount = function () {
  var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(args, help) {
    var wallet, valid, name, minconf, height, paths, filter, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, path, txs, total, lastConf, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, wtx, conf, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, output, hash;

    return _regenerator2.default.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context17.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getreceivedbyaccount "account" ( minconf )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0);
            minconf = valid.u32(1, 0);
            height = this.wdb.state.height;


            if (name === '') name = 'default';

            _context17.next = 10;
            return wallet.getPaths(name);

          case 10:
            paths = _context17.sent;
            filter = new _set2.default();
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context17.prev = 15;


            for (_iterator4 = (0, _getIterator3.default)(paths); !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
              path = _step4.value;

              filter.add(path.hash);
            }_context17.next = 23;
            break;

          case 19:
            _context17.prev = 19;
            _context17.t0 = _context17['catch'](15);
            _didIteratorError4 = true;
            _iteratorError4 = _context17.t0;

          case 23:
            _context17.prev = 23;
            _context17.prev = 24;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 26:
            _context17.prev = 26;

            if (!_didIteratorError4) {
              _context17.next = 29;
              break;
            }

            throw _iteratorError4;

          case 29:
            return _context17.finish(26);

          case 30:
            return _context17.finish(23);

          case 31:
            _context17.next = 33;
            return wallet.getHistory(name);

          case 33:
            txs = _context17.sent;
            total = 0;
            lastConf = -1;
            _iteratorNormalCompletion5 = true;
            _didIteratorError5 = false;
            _iteratorError5 = undefined;
            _context17.prev = 39;
            _iterator5 = (0, _getIterator3.default)(txs);

          case 41:
            if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
              _context17.next = 69;
              break;
            }

            wtx = _step5.value;
            conf = wtx.getDepth(height);

            if (!(conf < minconf)) {
              _context17.next = 46;
              break;
            }

            return _context17.abrupt('continue', 66);

          case 46:

            if (lastConf === -1 || conf < lastConf) lastConf = conf;

            _iteratorNormalCompletion6 = true;
            _didIteratorError6 = false;
            _iteratorError6 = undefined;
            _context17.prev = 50;
            for (_iterator6 = (0, _getIterator3.default)(wtx.tx.outputs); !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              output = _step6.value;
              hash = output.getHash('hex');

              if (hash && filter.has(hash)) total += output.value;
            }
            _context17.next = 58;
            break;

          case 54:
            _context17.prev = 54;
            _context17.t1 = _context17['catch'](50);
            _didIteratorError6 = true;
            _iteratorError6 = _context17.t1;

          case 58:
            _context17.prev = 58;
            _context17.prev = 59;

            if (!_iteratorNormalCompletion6 && _iterator6.return) {
              _iterator6.return();
            }

          case 61:
            _context17.prev = 61;

            if (!_didIteratorError6) {
              _context17.next = 64;
              break;
            }

            throw _iteratorError6;

          case 64:
            return _context17.finish(61);

          case 65:
            return _context17.finish(58);

          case 66:
            _iteratorNormalCompletion5 = true;
            _context17.next = 41;
            break;

          case 69:
            _context17.next = 75;
            break;

          case 71:
            _context17.prev = 71;
            _context17.t2 = _context17['catch'](39);
            _didIteratorError5 = true;
            _iteratorError5 = _context17.t2;

          case 75:
            _context17.prev = 75;
            _context17.prev = 76;

            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }

          case 78:
            _context17.prev = 78;

            if (!_didIteratorError5) {
              _context17.next = 81;
              break;
            }

            throw _iteratorError5;

          case 81:
            return _context17.finish(78);

          case 82:
            return _context17.finish(75);

          case 83:
            return _context17.abrupt('return', Amount.btc(total, true));

          case 84:
          case 'end':
            return _context17.stop();
        }
      }
    }, _callee17, this, [[15, 19, 23, 31], [24,, 26, 30], [39, 71, 75, 83], [50, 54, 58, 66], [59,, 61, 65], [76,, 78, 82]]);
  }));

  function getReceivedByAccount(_x33, _x34) {
    return _ref17.apply(this, arguments);
  }

  return getReceivedByAccount;
}();

RPC.prototype.getReceivedByAddress = function () {
  var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(args, help) {
    var wallet, valid, addr, minconf, height, hash, txs, total, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, wtx, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, output;

    return _regenerator2.default.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context18.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getreceivedbyaddress "bitcoinaddress" ( minconf )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            addr = valid.str(0, '');
            minconf = valid.u32(1, 0);
            height = this.wdb.state.height;
            hash = parseHash(addr, this.network);
            _context18.next = 10;
            return wallet.getHistory();

          case 10:
            txs = _context18.sent;
            total = 0;
            _iteratorNormalCompletion7 = true;
            _didIteratorError7 = false;
            _iteratorError7 = undefined;
            _context18.prev = 15;
            _iterator7 = (0, _getIterator3.default)(txs);

          case 17:
            if (_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done) {
              _context18.next = 43;
              break;
            }

            wtx = _step7.value;

            if (!(wtx.getDepth(height) < minconf)) {
              _context18.next = 21;
              break;
            }

            return _context18.abrupt('continue', 40);

          case 21:
            _iteratorNormalCompletion8 = true;
            _didIteratorError8 = false;
            _iteratorError8 = undefined;
            _context18.prev = 24;


            for (_iterator8 = (0, _getIterator3.default)(wtx.tx.outputs); !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
              output = _step8.value;

              if (output.getHash('hex') === hash) total += output.value;
            }
            _context18.next = 32;
            break;

          case 28:
            _context18.prev = 28;
            _context18.t0 = _context18['catch'](24);
            _didIteratorError8 = true;
            _iteratorError8 = _context18.t0;

          case 32:
            _context18.prev = 32;
            _context18.prev = 33;

            if (!_iteratorNormalCompletion8 && _iterator8.return) {
              _iterator8.return();
            }

          case 35:
            _context18.prev = 35;

            if (!_didIteratorError8) {
              _context18.next = 38;
              break;
            }

            throw _iteratorError8;

          case 38:
            return _context18.finish(35);

          case 39:
            return _context18.finish(32);

          case 40:
            _iteratorNormalCompletion7 = true;
            _context18.next = 17;
            break;

          case 43:
            _context18.next = 49;
            break;

          case 45:
            _context18.prev = 45;
            _context18.t1 = _context18['catch'](15);
            _didIteratorError7 = true;
            _iteratorError7 = _context18.t1;

          case 49:
            _context18.prev = 49;
            _context18.prev = 50;

            if (!_iteratorNormalCompletion7 && _iterator7.return) {
              _iterator7.return();
            }

          case 52:
            _context18.prev = 52;

            if (!_didIteratorError7) {
              _context18.next = 55;
              break;
            }

            throw _iteratorError7;

          case 55:
            return _context18.finish(52);

          case 56:
            return _context18.finish(49);

          case 57:
            return _context18.abrupt('return', Amount.btc(total, true));

          case 58:
          case 'end':
            return _context18.stop();
        }
      }
    }, _callee18, this, [[15, 45, 49, 57], [24, 28, 32, 40], [33,, 35, 39], [50,, 52, 56]]);
  }));

  function getReceivedByAddress(_x35, _x36) {
    return _ref18.apply(this, arguments);
  }

  return getReceivedByAddress;
}();

RPC.prototype._toWalletTX = function () {
  var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(wtx) {
    var wallet, details, receive, _iteratorNormalCompletion9, _didIteratorError9, _iteratorError9, _iterator9, _step9, member, det, sent, received, i, _member;

    return _regenerator2.default.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            wallet = this.wallet;
            _context19.next = 3;
            return wallet.toDetails(wtx);

          case 3:
            details = _context19.sent;

            if (details) {
              _context19.next = 6;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'TX not found.');

          case 6:
            receive = true;
            _iteratorNormalCompletion9 = true;
            _didIteratorError9 = false;
            _iteratorError9 = undefined;
            _context19.prev = 10;
            _iterator9 = (0, _getIterator3.default)(details.inputs);

          case 12:
            if (_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done) {
              _context19.next = 20;
              break;
            }

            member = _step9.value;

            if (!member.path) {
              _context19.next = 17;
              break;
            }

            receive = false;
            return _context19.abrupt('break', 20);

          case 17:
            _iteratorNormalCompletion9 = true;
            _context19.next = 12;
            break;

          case 20:
            _context19.next = 26;
            break;

          case 22:
            _context19.prev = 22;
            _context19.t0 = _context19['catch'](10);
            _didIteratorError9 = true;
            _iteratorError9 = _context19.t0;

          case 26:
            _context19.prev = 26;
            _context19.prev = 27;

            if (!_iteratorNormalCompletion9 && _iterator9.return) {
              _iterator9.return();
            }

          case 29:
            _context19.prev = 29;

            if (!_didIteratorError9) {
              _context19.next = 32;
              break;
            }

            throw _iteratorError9;

          case 32:
            return _context19.finish(29);

          case 33:
            return _context19.finish(26);

          case 34:
            det = [];
            sent = 0;
            received = 0;
            i = 0;

          case 38:
            if (!(i < details.outputs.length)) {
              _context19.next = 53;
              break;
            }

            _member = details.outputs[i];

            if (!_member.path) {
              _context19.next = 46;
              break;
            }

            if (!(_member.path.branch === 1)) {
              _context19.next = 43;
              break;
            }

            return _context19.abrupt('continue', 50);

          case 43:

            det.push({
              account: _member.path.name,
              address: _member.address.toString(this.network),
              category: 'receive',
              amount: Amount.btc(_member.value, true),
              label: _member.path.name,
              vout: i
            });

            received += _member.value;

            return _context19.abrupt('continue', 50);

          case 46:
            if (!receive) {
              _context19.next = 48;
              break;
            }

            return _context19.abrupt('continue', 50);

          case 48:

            det.push({
              account: '',
              address: _member.address ? _member.address.toString(this.network) : null,
              category: 'send',
              amount: -Amount.btc(_member.value, true),
              fee: -Amount.btc(details.fee, true),
              vout: i
            });

            sent += _member.value;

          case 50:
            i++;
            _context19.next = 38;
            break;

          case 53:
            return _context19.abrupt('return', {
              amount: Amount.btc(receive ? received : -sent, true),
              confirmations: details.confirmations,
              blockhash: details.block ? util.revHex(details.block) : null,
              blockindex: details.index,
              blocktime: details.time,
              txid: util.revHex(details.hash),
              walletconflicts: [],
              time: details.mtime,
              timereceived: details.mtime,
              'bip125-replaceable': 'no',
              details: det,
              hex: details.tx.toRaw().toString('hex')
            });

          case 54:
          case 'end':
            return _context19.stop();
        }
      }
    }, _callee19, this, [[10, 22, 26, 34], [27,, 29, 33]]);
  }));

  function _toWalletTX(_x37) {
    return _ref19.apply(this, arguments);
  }

  return _toWalletTX;
}();

RPC.prototype.getTransaction = function () {
  var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(args, help) {
    var wallet, valid, hash, watchOnly, wtx;
    return _regenerator2.default.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context20.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'gettransaction "txid" ( includeWatchonly )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            hash = valid.hash(0);
            watchOnly = valid.bool(1, false);

            if (hash) {
              _context20.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter');

          case 8:
            _context20.next = 10;
            return wallet.getTX(hash);

          case 10:
            wtx = _context20.sent;

            if (wtx) {
              _context20.next = 13;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'TX not found.');

          case 13:
            _context20.next = 15;
            return this._toWalletTX(wtx, watchOnly);

          case 15:
            return _context20.abrupt('return', _context20.sent);

          case 16:
          case 'end':
            return _context20.stop();
        }
      }
    }, _callee20, this);
  }));

  function getTransaction(_x38, _x39) {
    return _ref20.apply(this, arguments);
  }

  return getTransaction;
}();

RPC.prototype.abandonTransaction = function () {
  var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(args, help) {
    var wallet, valid, hash, result;
    return _regenerator2.default.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context21.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'abandontransaction "txid"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            hash = valid.hash(0);

            if (hash) {
              _context21.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 7:
            _context21.next = 9;
            return wallet.abandon(hash);

          case 9:
            result = _context21.sent;

            if (result) {
              _context21.next = 12;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'Transaction not in wallet.');

          case 12:
            return _context21.abrupt('return', null);

          case 13:
          case 'end':
            return _context21.stop();
        }
      }
    }, _callee21, this);
  }));

  function abandonTransaction(_x40, _x41) {
    return _ref21.apply(this, arguments);
  }

  return abandonTransaction;
}();

RPC.prototype.getUnconfirmedBalance = function () {
  var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(args, help) {
    var wallet, balance;
    return _regenerator2.default.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            if (!(help || args.length > 0)) {
              _context22.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getunconfirmedbalance');

          case 2:
            wallet = this.wallet;
            _context22.next = 5;
            return wallet.getBalance();

          case 5:
            balance = _context22.sent;
            return _context22.abrupt('return', Amount.btc(balance.unconfirmed, true));

          case 7:
          case 'end':
            return _context22.stop();
        }
      }
    }, _callee22, this);
  }));

  function getUnconfirmedBalance(_x42, _x43) {
    return _ref22.apply(this, arguments);
  }

  return getUnconfirmedBalance;
}();

RPC.prototype.getWalletInfo = function () {
  var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(args, help) {
    var wallet, balance;
    return _regenerator2.default.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context23.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getwalletinfo');

          case 2:
            wallet = this.wallet;
            _context23.next = 5;
            return wallet.getBalance();

          case 5:
            balance = _context23.sent;
            return _context23.abrupt('return', {
              walletid: wallet.id,
              walletversion: 6,
              balance: Amount.btc(balance.unconfirmed, true),
              unconfirmed_balance: Amount.btc(balance.unconfirmed, true),
              txcount: wallet.txdb.state.tx,
              keypoololdest: 0,
              keypoolsize: 0,
              unlocked_until: wallet.master.until,
              paytxfee: Amount.btc(this.wdb.feeRate, true)
            });

          case 7:
          case 'end':
            return _context23.stop();
        }
      }
    }, _callee23, this);
  }));

  function getWalletInfo(_x44, _x45) {
    return _ref23.apply(this, arguments);
  }

  return getWalletInfo;
}();

RPC.prototype.importPrivKey = function () {
  var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(args, help) {
    var wallet, valid, secret, rescan, key;
    return _regenerator2.default.wrap(function _callee24$(_context24) {
      while (1) {
        switch (_context24.prev = _context24.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 3)) {
              _context24.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'importprivkey "bitcoinprivkey" ( "label" rescan )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            secret = valid.str(0);
            rescan = valid.bool(2, false);
            key = parseSecret(secret, this.network);
            _context24.next = 9;
            return wallet.importKey(0, key);

          case 9:
            if (!rescan) {
              _context24.next = 12;
              break;
            }

            _context24.next = 12;
            return this.wdb.rescan(0);

          case 12:
            return _context24.abrupt('return', null);

          case 13:
          case 'end':
            return _context24.stop();
        }
      }
    }, _callee24, this);
  }));

  function importPrivKey(_x46, _x47) {
    return _ref24.apply(this, arguments);
  }

  return importPrivKey;
}();

RPC.prototype.importWallet = function () {
  var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(args, help) {
    var wallet, valid, file, rescan, data, lines, keys, _iteratorNormalCompletion10, _didIteratorError10, _iteratorError10, _iterator10, _step10, line, parts, secret, _iteratorNormalCompletion11, _didIteratorError11, _iteratorError11, _iterator11, _step11, key;

    return _regenerator2.default.wrap(function _callee25$(_context25) {
      while (1) {
        switch (_context25.prev = _context25.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context25.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'importwallet "filename" ( rescan )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            file = valid.str(0);
            rescan = valid.bool(1, false);

            if (!fs.unsupported) {
              _context25.next = 8;
              break;
            }

            throw new RPCError(errs.INTERNAL_ERROR, 'FS not available.');

          case 8:
            _context25.next = 10;
            return fs.readFile(file, 'utf8');

          case 10:
            data = _context25.sent;
            lines = data.split(/\n+/);
            keys = [];
            _iteratorNormalCompletion10 = true;
            _didIteratorError10 = false;
            _iteratorError10 = undefined;
            _context25.prev = 16;
            _iterator10 = (0, _getIterator3.default)(lines);

          case 18:
            if (_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done) {
              _context25.next = 33;
              break;
            }

            line = _step10.value;

            line = line.trim();

            if (!(line.length === 0)) {
              _context25.next = 23;
              break;
            }

            return _context25.abrupt('continue', 30);

          case 23:
            if (!/^\s*#/.test(line)) {
              _context25.next = 25;
              break;
            }

            return _context25.abrupt('continue', 30);

          case 25:
            parts = line.split(/\s+/);

            if (!(parts.length < 4)) {
              _context25.next = 28;
              break;
            }

            throw new RPCError(errs.DESERIALIZATION_ERROR, 'Malformed wallet.');

          case 28:
            secret = parseSecret(parts[0], this.network);


            keys.push(secret);

          case 30:
            _iteratorNormalCompletion10 = true;
            _context25.next = 18;
            break;

          case 33:
            _context25.next = 39;
            break;

          case 35:
            _context25.prev = 35;
            _context25.t0 = _context25['catch'](16);
            _didIteratorError10 = true;
            _iteratorError10 = _context25.t0;

          case 39:
            _context25.prev = 39;
            _context25.prev = 40;

            if (!_iteratorNormalCompletion10 && _iterator10.return) {
              _iterator10.return();
            }

          case 42:
            _context25.prev = 42;

            if (!_didIteratorError10) {
              _context25.next = 45;
              break;
            }

            throw _iteratorError10;

          case 45:
            return _context25.finish(42);

          case 46:
            return _context25.finish(39);

          case 47:
            _iteratorNormalCompletion11 = true;
            _didIteratorError11 = false;
            _iteratorError11 = undefined;
            _context25.prev = 50;
            _iterator11 = (0, _getIterator3.default)(keys);

          case 52:
            if (_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done) {
              _context25.next = 59;
              break;
            }

            key = _step11.value;
            _context25.next = 56;
            return wallet.importKey(0, key);

          case 56:
            _iteratorNormalCompletion11 = true;
            _context25.next = 52;
            break;

          case 59:
            _context25.next = 65;
            break;

          case 61:
            _context25.prev = 61;
            _context25.t1 = _context25['catch'](50);
            _didIteratorError11 = true;
            _iteratorError11 = _context25.t1;

          case 65:
            _context25.prev = 65;
            _context25.prev = 66;

            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }

          case 68:
            _context25.prev = 68;

            if (!_didIteratorError11) {
              _context25.next = 71;
              break;
            }

            throw _iteratorError11;

          case 71:
            return _context25.finish(68);

          case 72:
            return _context25.finish(65);

          case 73:
            if (!rescan) {
              _context25.next = 76;
              break;
            }

            _context25.next = 76;
            return this.wdb.rescan(0);

          case 76:
            return _context25.abrupt('return', null);

          case 77:
          case 'end':
            return _context25.stop();
        }
      }
    }, _callee25, this, [[16, 35, 39, 47], [40,, 42, 46], [50, 61, 65, 73], [66,, 68, 72]]);
  }));

  function importWallet(_x48, _x49) {
    return _ref25.apply(this, arguments);
  }

  return importWallet;
}();

RPC.prototype.importAddress = function () {
  var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(args, help) {
    var wallet, valid, addr, rescan, p2sh, script;
    return _regenerator2.default.wrap(function _callee26$(_context26) {
      while (1) {
        switch (_context26.prev = _context26.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 4)) {
              _context26.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'importaddress "address" ( "label" rescan p2sh )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            addr = valid.str(0, '');
            rescan = valid.bool(2, false);
            p2sh = valid.bool(3, false);

            if (!p2sh) {
              _context26.next = 16;
              break;
            }

            script = valid.buf(0);

            if (script) {
              _context26.next = 11;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameters.');

          case 11:

            script = Script.fromRaw(script);
            script = Script.fromScripthash(script.hash160());

            addr = script.getAddress();
            _context26.next = 17;
            break;

          case 16:
            addr = parseAddress(addr, this.network);

          case 17:
            _context26.next = 19;
            return wallet.importAddress(0, addr);

          case 19:
            if (!rescan) {
              _context26.next = 22;
              break;
            }

            _context26.next = 22;
            return this.wdb.rescan(0);

          case 22:
            return _context26.abrupt('return', null);

          case 23:
          case 'end':
            return _context26.stop();
        }
      }
    }, _callee26, this);
  }));

  function importAddress(_x50, _x51) {
    return _ref26.apply(this, arguments);
  }

  return importAddress;
}();

RPC.prototype.importPubkey = function () {
  var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(args, help) {
    var wallet, valid, data, rescan, key;
    return _regenerator2.default.wrap(function _callee27$(_context27) {
      while (1) {
        switch (_context27.prev = _context27.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 4)) {
              _context27.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'importpubkey "pubkey" ( "label" rescan )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            data = valid.buf(0);
            rescan = valid.bool(2, false);

            if (data) {
              _context27.next = 8;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 8:
            key = KeyRing.fromPublic(data, this.network);
            _context27.next = 11;
            return wallet.importKey(0, key);

          case 11:
            if (!rescan) {
              _context27.next = 14;
              break;
            }

            _context27.next = 14;
            return this.wdb.rescan(0);

          case 14:
            return _context27.abrupt('return', null);

          case 15:
          case 'end':
            return _context27.stop();
        }
      }
    }, _callee27, this);
  }));

  function importPubkey(_x52, _x53) {
    return _ref27.apply(this, arguments);
  }

  return importPubkey;
}();

RPC.prototype.keyPoolRefill = function () {
  var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(args, help) {
    return _regenerator2.default.wrap(function _callee28$(_context28) {
      while (1) {
        switch (_context28.prev = _context28.next) {
          case 0:
            if (!(help || args.length > 1)) {
              _context28.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'keypoolrefill ( newsize )');

          case 2:
            return _context28.abrupt('return', null);

          case 3:
          case 'end':
            return _context28.stop();
        }
      }
    }, _callee28, this);
  }));

  function keyPoolRefill(_x54, _x55) {
    return _ref28.apply(this, arguments);
  }

  return keyPoolRefill;
}();

RPC.prototype.listAccounts = function () {
  var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(args, help) {
    var wallet, valid, minconf, watchOnly, accounts, map, _iteratorNormalCompletion12, _didIteratorError12, _iteratorError12, _iterator12, _step12, account, balance, value;

    return _regenerator2.default.wrap(function _callee29$(_context29) {
      while (1) {
        switch (_context29.prev = _context29.next) {
          case 0:
            if (!(help || args.length > 2)) {
              _context29.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listaccounts ( minconf includeWatchonly)');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            minconf = valid.u32(0, 0);
            watchOnly = valid.bool(1, false);
            _context29.next = 8;
            return wallet.getAccounts();

          case 8:
            accounts = _context29.sent;
            map = {};
            _iteratorNormalCompletion12 = true;
            _didIteratorError12 = false;
            _iteratorError12 = undefined;
            _context29.prev = 13;
            _iterator12 = (0, _getIterator3.default)(accounts);

          case 15:
            if (_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done) {
              _context29.next = 27;
              break;
            }

            account = _step12.value;
            _context29.next = 19;
            return wallet.getBalance(account);

          case 19:
            balance = _context29.sent;
            value = balance.unconfirmed;


            if (minconf > 0) value = balance.confirmed;

            if (wallet.watchOnly !== watchOnly) value = 0;

            map[account] = Amount.btc(value, true);

          case 24:
            _iteratorNormalCompletion12 = true;
            _context29.next = 15;
            break;

          case 27:
            _context29.next = 33;
            break;

          case 29:
            _context29.prev = 29;
            _context29.t0 = _context29['catch'](13);
            _didIteratorError12 = true;
            _iteratorError12 = _context29.t0;

          case 33:
            _context29.prev = 33;
            _context29.prev = 34;

            if (!_iteratorNormalCompletion12 && _iterator12.return) {
              _iterator12.return();
            }

          case 36:
            _context29.prev = 36;

            if (!_didIteratorError12) {
              _context29.next = 39;
              break;
            }

            throw _iteratorError12;

          case 39:
            return _context29.finish(36);

          case 40:
            return _context29.finish(33);

          case 41:
            return _context29.abrupt('return', map);

          case 42:
          case 'end':
            return _context29.stop();
        }
      }
    }, _callee29, this, [[13, 29, 33, 41], [34,, 36, 40]]);
  }));

  function listAccounts(_x56, _x57) {
    return _ref29.apply(this, arguments);
  }

  return listAccounts;
}();

RPC.prototype.listAddressGroupings = function () {
  var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(args, help) {
    return _regenerator2.default.wrap(function _callee30$(_context30) {
      while (1) {
        switch (_context30.prev = _context30.next) {
          case 0:
            if (!help) {
              _context30.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listaddressgroupings');

          case 2:
            throw new Error('Not implemented.');

          case 3:
          case 'end':
            return _context30.stop();
        }
      }
    }, _callee30, this);
  }));

  function listAddressGroupings(_x58, _x59) {
    return _ref30.apply(this, arguments);
  }

  return listAddressGroupings;
}();

RPC.prototype.listLockUnspent = function () {
  var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(args, help) {
    var wallet, outpoints, out, _iteratorNormalCompletion13, _didIteratorError13, _iteratorError13, _iterator13, _step13, outpoint;

    return _regenerator2.default.wrap(function _callee31$(_context31) {
      while (1) {
        switch (_context31.prev = _context31.next) {
          case 0:
            if (!(help || args.length > 0)) {
              _context31.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listlockunspent');

          case 2:
            wallet = this.wallet;
            outpoints = wallet.getLocked();
            out = [];
            _iteratorNormalCompletion13 = true;
            _didIteratorError13 = false;
            _iteratorError13 = undefined;
            _context31.prev = 8;


            for (_iterator13 = (0, _getIterator3.default)(outpoints); !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
              outpoint = _step13.value;

              out.push({
                txid: outpoint.txid(),
                vout: outpoint.index
              });
            }

            _context31.next = 16;
            break;

          case 12:
            _context31.prev = 12;
            _context31.t0 = _context31['catch'](8);
            _didIteratorError13 = true;
            _iteratorError13 = _context31.t0;

          case 16:
            _context31.prev = 16;
            _context31.prev = 17;

            if (!_iteratorNormalCompletion13 && _iterator13.return) {
              _iterator13.return();
            }

          case 19:
            _context31.prev = 19;

            if (!_didIteratorError13) {
              _context31.next = 22;
              break;
            }

            throw _iteratorError13;

          case 22:
            return _context31.finish(19);

          case 23:
            return _context31.finish(16);

          case 24:
            return _context31.abrupt('return', out);

          case 25:
          case 'end':
            return _context31.stop();
        }
      }
    }, _callee31, this, [[8, 12, 16, 24], [17,, 19, 23]]);
  }));

  function listLockUnspent(_x60, _x61) {
    return _ref31.apply(this, arguments);
  }

  return listLockUnspent;
}();

RPC.prototype.listReceivedByAccount = function () {
  var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(args, help) {
    var valid, minconf, includeEmpty, watchOnly;
    return _regenerator2.default.wrap(function _callee32$(_context32) {
      while (1) {
        switch (_context32.prev = _context32.next) {
          case 0:
            if (!(help || args.length > 3)) {
              _context32.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listreceivedbyaccount ( minconf includeempty includeWatchonly )');

          case 2:
            valid = new Validator([args]);
            minconf = valid.u32(0, 0);
            includeEmpty = valid.bool(1, false);
            watchOnly = valid.bool(2, false);
            _context32.next = 8;
            return this._listReceived(minconf, includeEmpty, watchOnly, true);

          case 8:
            return _context32.abrupt('return', _context32.sent);

          case 9:
          case 'end':
            return _context32.stop();
        }
      }
    }, _callee32, this);
  }));

  function listReceivedByAccount(_x62, _x63) {
    return _ref32.apply(this, arguments);
  }

  return listReceivedByAccount;
}();

RPC.prototype.listReceivedByAddress = function () {
  var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(args, help) {
    var valid, minconf, includeEmpty, watchOnly;
    return _regenerator2.default.wrap(function _callee33$(_context33) {
      while (1) {
        switch (_context33.prev = _context33.next) {
          case 0:
            if (!(help || args.length > 3)) {
              _context33.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listreceivedbyaddress ( minconf includeempty includeWatchonly )');

          case 2:
            valid = new Validator([args]);
            minconf = valid.u32(0, 0);
            includeEmpty = valid.bool(1, false);
            watchOnly = valid.bool(2, false);
            _context33.next = 8;
            return this._listReceived(minconf, includeEmpty, watchOnly, false);

          case 8:
            return _context33.abrupt('return', _context33.sent);

          case 9:
          case 'end':
            return _context33.stop();
        }
      }
    }, _callee33, this);
  }));

  function listReceivedByAddress(_x64, _x65) {
    return _ref33.apply(this, arguments);
  }

  return listReceivedByAddress;
}();

RPC.prototype._listReceived = function () {
  var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(minconf, empty, watchOnly, account) {
    var wallet, paths, height, map, _iteratorNormalCompletion14, _didIteratorError14, _iteratorError14, _iterator14, _step14, path, addr, txs, _iteratorNormalCompletion15, _didIteratorError15, _iteratorError15, _iterator15, _step15, wtx, conf, _iteratorNormalCompletion20, _didIteratorError20, _iteratorError20, _iterator20, _step20, output, _addr, hash, _entry4, out, _iteratorNormalCompletion16, _didIteratorError16, _iteratorError16, _iterator16, _step16, entry, _map, _iteratorNormalCompletion17, _didIteratorError17, _iteratorError17, _iterator17, _step17, _entry, item, _iteratorNormalCompletion18, _didIteratorError18, _iteratorError18, _iterator18, _step18, _entry2, result, _iteratorNormalCompletion19, _didIteratorError19, _iteratorError19, _iterator19, _step19, _entry3;

    return _regenerator2.default.wrap(function _callee34$(_context34) {
      while (1) {
        switch (_context34.prev = _context34.next) {
          case 0:
            wallet = this.wallet;
            _context34.next = 3;
            return wallet.getPaths();

          case 3:
            paths = _context34.sent;
            height = this.wdb.state.height;
            map = new _map3.default();
            _iteratorNormalCompletion14 = true;
            _didIteratorError14 = false;
            _iteratorError14 = undefined;
            _context34.prev = 9;

            for (_iterator14 = (0, _getIterator3.default)(paths); !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
              path = _step14.value;
              addr = path.toAddress();

              map.set(path.hash, {
                involvesWatchonly: wallet.watchOnly,
                address: addr.toString(this.network),
                account: path.name,
                amount: 0,
                confirmations: -1,
                label: ''
              });
            }

            _context34.next = 17;
            break;

          case 13:
            _context34.prev = 13;
            _context34.t0 = _context34['catch'](9);
            _didIteratorError14 = true;
            _iteratorError14 = _context34.t0;

          case 17:
            _context34.prev = 17;
            _context34.prev = 18;

            if (!_iteratorNormalCompletion14 && _iterator14.return) {
              _iterator14.return();
            }

          case 20:
            _context34.prev = 20;

            if (!_didIteratorError14) {
              _context34.next = 23;
              break;
            }

            throw _iteratorError14;

          case 23:
            return _context34.finish(20);

          case 24:
            return _context34.finish(17);

          case 25:
            _context34.next = 27;
            return wallet.getHistory();

          case 27:
            txs = _context34.sent;
            _iteratorNormalCompletion15 = true;
            _didIteratorError15 = false;
            _iteratorError15 = undefined;
            _context34.prev = 31;
            _iterator15 = (0, _getIterator3.default)(txs);

          case 33:
            if (_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done) {
              _context34.next = 71;
              break;
            }

            wtx = _step15.value;
            conf = wtx.getDepth(height);

            if (!(conf < minconf)) {
              _context34.next = 38;
              break;
            }

            return _context34.abrupt('continue', 68);

          case 38:
            _iteratorNormalCompletion20 = true;
            _didIteratorError20 = false;
            _iteratorError20 = undefined;
            _context34.prev = 41;
            _iterator20 = (0, _getIterator3.default)(wtx.tx.outputs);

          case 43:
            if (_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done) {
              _context34.next = 54;
              break;
            }

            output = _step20.value;
            _addr = output.getAddress();

            if (_addr) {
              _context34.next = 48;
              break;
            }

            return _context34.abrupt('continue', 51);

          case 48:
            hash = _addr.getHash('hex');
            _entry4 = map.get(hash);


            if (_entry4) {
              if (_entry4.confirmations === -1 || conf < _entry4.confirmations) _entry4.confirmations = conf;
              _entry4.address = _addr.toString(this.network);
              _entry4.amount += output.value;
            }

          case 51:
            _iteratorNormalCompletion20 = true;
            _context34.next = 43;
            break;

          case 54:
            _context34.next = 60;
            break;

          case 56:
            _context34.prev = 56;
            _context34.t1 = _context34['catch'](41);
            _didIteratorError20 = true;
            _iteratorError20 = _context34.t1;

          case 60:
            _context34.prev = 60;
            _context34.prev = 61;

            if (!_iteratorNormalCompletion20 && _iterator20.return) {
              _iterator20.return();
            }

          case 63:
            _context34.prev = 63;

            if (!_didIteratorError20) {
              _context34.next = 66;
              break;
            }

            throw _iteratorError20;

          case 66:
            return _context34.finish(63);

          case 67:
            return _context34.finish(60);

          case 68:
            _iteratorNormalCompletion15 = true;
            _context34.next = 33;
            break;

          case 71:
            _context34.next = 77;
            break;

          case 73:
            _context34.prev = 73;
            _context34.t2 = _context34['catch'](31);
            _didIteratorError15 = true;
            _iteratorError15 = _context34.t2;

          case 77:
            _context34.prev = 77;
            _context34.prev = 78;

            if (!_iteratorNormalCompletion15 && _iterator15.return) {
              _iterator15.return();
            }

          case 80:
            _context34.prev = 80;

            if (!_didIteratorError15) {
              _context34.next = 83;
              break;
            }

            throw _iteratorError15;

          case 83:
            return _context34.finish(80);

          case 84:
            return _context34.finish(77);

          case 85:
            out = [];
            _iteratorNormalCompletion16 = true;
            _didIteratorError16 = false;
            _iteratorError16 = undefined;
            _context34.prev = 89;

            for (_iterator16 = (0, _getIterator3.default)(map.values()); !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
              entry = _step16.value;

              out.push(entry);
            }_context34.next = 97;
            break;

          case 93:
            _context34.prev = 93;
            _context34.t3 = _context34['catch'](89);
            _didIteratorError16 = true;
            _iteratorError16 = _context34.t3;

          case 97:
            _context34.prev = 97;
            _context34.prev = 98;

            if (!_iteratorNormalCompletion16 && _iterator16.return) {
              _iterator16.return();
            }

          case 100:
            _context34.prev = 100;

            if (!_didIteratorError16) {
              _context34.next = 103;
              break;
            }

            throw _iteratorError16;

          case 103:
            return _context34.finish(100);

          case 104:
            return _context34.finish(97);

          case 105:
            if (!account) {
              _context34.next = 157;
              break;
            }

            _map = new _map3.default();
            _iteratorNormalCompletion17 = true;
            _didIteratorError17 = false;
            _iteratorError17 = undefined;
            _context34.prev = 110;
            _iterator17 = (0, _getIterator3.default)(out);

          case 112:
            if (_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done) {
              _context34.next = 123;
              break;
            }

            _entry = _step17.value;
            item = _map.get(_entry.account);

            if (item) {
              _context34.next = 119;
              break;
            }

            _map.set(_entry.account, _entry);
            _entry.address = undefined;
            return _context34.abrupt('continue', 120);

          case 119:
            item.amount += _entry.amount;

          case 120:
            _iteratorNormalCompletion17 = true;
            _context34.next = 112;
            break;

          case 123:
            _context34.next = 129;
            break;

          case 125:
            _context34.prev = 125;
            _context34.t4 = _context34['catch'](110);
            _didIteratorError17 = true;
            _iteratorError17 = _context34.t4;

          case 129:
            _context34.prev = 129;
            _context34.prev = 130;

            if (!_iteratorNormalCompletion17 && _iterator17.return) {
              _iterator17.return();
            }

          case 132:
            _context34.prev = 132;

            if (!_didIteratorError17) {
              _context34.next = 135;
              break;
            }

            throw _iteratorError17;

          case 135:
            return _context34.finish(132);

          case 136:
            return _context34.finish(129);

          case 137:

            out = [];

            _iteratorNormalCompletion18 = true;
            _didIteratorError18 = false;
            _iteratorError18 = undefined;
            _context34.prev = 141;
            for (_iterator18 = (0, _getIterator3.default)(_map.values()); !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
              _entry2 = _step18.value;

              out.push(_entry2);
            }_context34.next = 149;
            break;

          case 145:
            _context34.prev = 145;
            _context34.t5 = _context34['catch'](141);
            _didIteratorError18 = true;
            _iteratorError18 = _context34.t5;

          case 149:
            _context34.prev = 149;
            _context34.prev = 150;

            if (!_iteratorNormalCompletion18 && _iterator18.return) {
              _iterator18.return();
            }

          case 152:
            _context34.prev = 152;

            if (!_didIteratorError18) {
              _context34.next = 155;
              break;
            }

            throw _iteratorError18;

          case 155:
            return _context34.finish(152);

          case 156:
            return _context34.finish(149);

          case 157:
            result = [];
            _iteratorNormalCompletion19 = true;
            _didIteratorError19 = false;
            _iteratorError19 = undefined;
            _context34.prev = 161;
            _iterator19 = (0, _getIterator3.default)(out);

          case 163:
            if (_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done) {
              _context34.next = 173;
              break;
            }

            _entry3 = _step19.value;

            if (!(!empty && _entry3.amount === 0)) {
              _context34.next = 167;
              break;
            }

            return _context34.abrupt('continue', 170);

          case 167:

            if (_entry3.confirmations === -1) _entry3.confirmations = 0;

            _entry3.amount = Amount.btc(_entry3.amount, true);
            result.push(_entry3);

          case 170:
            _iteratorNormalCompletion19 = true;
            _context34.next = 163;
            break;

          case 173:
            _context34.next = 179;
            break;

          case 175:
            _context34.prev = 175;
            _context34.t6 = _context34['catch'](161);
            _didIteratorError19 = true;
            _iteratorError19 = _context34.t6;

          case 179:
            _context34.prev = 179;
            _context34.prev = 180;

            if (!_iteratorNormalCompletion19 && _iterator19.return) {
              _iterator19.return();
            }

          case 182:
            _context34.prev = 182;

            if (!_didIteratorError19) {
              _context34.next = 185;
              break;
            }

            throw _iteratorError19;

          case 185:
            return _context34.finish(182);

          case 186:
            return _context34.finish(179);

          case 187:
            return _context34.abrupt('return', result);

          case 188:
          case 'end':
            return _context34.stop();
        }
      }
    }, _callee34, this, [[9, 13, 17, 25], [18,, 20, 24], [31, 73, 77, 85], [41, 56, 60, 68], [61,, 63, 67], [78,, 80, 84], [89, 93, 97, 105], [98,, 100, 104], [110, 125, 129, 137], [130,, 132, 136], [141, 145, 149, 157], [150,, 152, 156], [161, 175, 179, 187], [180,, 182, 186]]);
  }));

  function _listReceived(_x66, _x67, _x68, _x69) {
    return _ref34.apply(this, arguments);
  }

  return _listReceived;
}();

RPC.prototype.listSinceBlock = function () {
  var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(args, help) {
    var wallet, chainHeight, valid, block, minconf, watchOnly, height, entry, txs, out, highest, _iteratorNormalCompletion21, _didIteratorError21, _iteratorError21, _iterator21, _step21, wtx, json;

    return _regenerator2.default.wrap(function _callee35$(_context35) {
      while (1) {
        switch (_context35.prev = _context35.next) {
          case 0:
            wallet = this.wallet;
            chainHeight = this.wdb.state.height;
            valid = new Validator([args]);
            block = valid.hash(0);
            minconf = valid.u32(1, 0);
            watchOnly = valid.bool(2, false);

            if (!help) {
              _context35.next = 8;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listsinceblock ( "blockhash" target-confirmations includeWatchonly)');

          case 8:
            if (!(wallet.watchOnly !== watchOnly)) {
              _context35.next = 10;
              break;
            }

            return _context35.abrupt('return', []);

          case 10:
            height = -1;

            if (!block) {
              _context35.next = 16;
              break;
            }

            _context35.next = 14;
            return this.client.getEntry(block);

          case 14:
            entry = _context35.sent;

            if (entry) height = entry.height;

          case 16:

            if (height === -1) height = this.chain.height;

            _context35.next = 19;
            return wallet.getHistory();

          case 19:
            txs = _context35.sent;
            out = [];
            highest = void 0;
            _iteratorNormalCompletion21 = true;
            _didIteratorError21 = false;
            _iteratorError21 = undefined;
            _context35.prev = 25;
            _iterator21 = (0, _getIterator3.default)(txs);

          case 27:
            if (_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done) {
              _context35.next = 41;
              break;
            }

            wtx = _step21.value;

            if (!(wtx.height < height)) {
              _context35.next = 31;
              break;
            }

            return _context35.abrupt('continue', 38);

          case 31:
            if (!(wtx.getDepth(chainHeight) < minconf)) {
              _context35.next = 33;
              break;
            }

            return _context35.abrupt('continue', 38);

          case 33:

            if (!highest || wtx.height > highest) highest = wtx;

            _context35.next = 36;
            return this._toListTX(wtx);

          case 36:
            json = _context35.sent;


            out.push(json);

          case 38:
            _iteratorNormalCompletion21 = true;
            _context35.next = 27;
            break;

          case 41:
            _context35.next = 47;
            break;

          case 43:
            _context35.prev = 43;
            _context35.t0 = _context35['catch'](25);
            _didIteratorError21 = true;
            _iteratorError21 = _context35.t0;

          case 47:
            _context35.prev = 47;
            _context35.prev = 48;

            if (!_iteratorNormalCompletion21 && _iterator21.return) {
              _iterator21.return();
            }

          case 50:
            _context35.prev = 50;

            if (!_didIteratorError21) {
              _context35.next = 53;
              break;
            }

            throw _iteratorError21;

          case 53:
            return _context35.finish(50);

          case 54:
            return _context35.finish(47);

          case 55:
            return _context35.abrupt('return', {
              transactions: out,
              lastblock: highest && highest.block ? util.revHex(highest.block) : encoding.NULL_HASH
            });

          case 56:
          case 'end':
            return _context35.stop();
        }
      }
    }, _callee35, this, [[25, 43, 47, 55], [48,, 50, 54]]);
  }));

  function listSinceBlock(_x70, _x71) {
    return _ref35.apply(this, arguments);
  }

  return listSinceBlock;
}();

RPC.prototype._toListTX = function () {
  var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(wtx) {
    var wallet, details, receive, _iteratorNormalCompletion22, _didIteratorError22, _iteratorError22, _iterator22, _step22, _member2, sent, received, sendMember, recMember, sendIndex, recIndex, i, _member3, member, index;

    return _regenerator2.default.wrap(function _callee36$(_context36) {
      while (1) {
        switch (_context36.prev = _context36.next) {
          case 0:
            wallet = this.wallet;
            _context36.next = 3;
            return wallet.toDetails(wtx);

          case 3:
            details = _context36.sent;

            if (details) {
              _context36.next = 6;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'TX not found.');

          case 6:
            receive = true;
            _iteratorNormalCompletion22 = true;
            _didIteratorError22 = false;
            _iteratorError22 = undefined;
            _context36.prev = 10;
            _iterator22 = (0, _getIterator3.default)(details.inputs);

          case 12:
            if (_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done) {
              _context36.next = 20;
              break;
            }

            _member2 = _step22.value;

            if (!_member2.path) {
              _context36.next = 17;
              break;
            }

            receive = false;
            return _context36.abrupt('break', 20);

          case 17:
            _iteratorNormalCompletion22 = true;
            _context36.next = 12;
            break;

          case 20:
            _context36.next = 26;
            break;

          case 22:
            _context36.prev = 22;
            _context36.t0 = _context36['catch'](10);
            _didIteratorError22 = true;
            _iteratorError22 = _context36.t0;

          case 26:
            _context36.prev = 26;
            _context36.prev = 27;

            if (!_iteratorNormalCompletion22 && _iterator22.return) {
              _iterator22.return();
            }

          case 29:
            _context36.prev = 29;

            if (!_didIteratorError22) {
              _context36.next = 32;
              break;
            }

            throw _iteratorError22;

          case 32:
            return _context36.finish(29);

          case 33:
            return _context36.finish(26);

          case 34:
            sent = 0;
            received = 0;
            sendMember = void 0, recMember = void 0, sendIndex = void 0, recIndex = void 0;
            i = 0;

          case 38:
            if (!(i < details.outputs.length)) {
              _context36.next = 53;
              break;
            }

            _member3 = details.outputs[i];

            if (!_member3.path) {
              _context36.next = 47;
              break;
            }

            if (!(_member3.path.branch === 1)) {
              _context36.next = 43;
              break;
            }

            return _context36.abrupt('continue', 50);

          case 43:
            received += _member3.value;
            recMember = _member3;
            recIndex = i;
            return _context36.abrupt('continue', 50);

          case 47:

            sent += _member3.value;
            sendMember = _member3;
            sendIndex = i;

          case 50:
            i++;
            _context36.next = 38;
            break;

          case 53:
            member = void 0, index = void 0;

            if (receive) {
              member = recMember;
              index = recIndex;
            } else {
              member = sendMember;
              index = sendIndex;
            }

            // In the odd case where we send to ourselves.
            if (!member) {
              assert(!receive);
              member = recMember;
              index = recIndex;
            }

            return _context36.abrupt('return', {
              account: member.path ? member.path.name : '',
              address: member.address ? member.address.toString(this.network) : null,
              category: receive ? 'receive' : 'send',
              amount: Amount.btc(receive ? received : -sent, true),
              label: member.path ? member.path.name : undefined,
              vout: index,
              confirmations: details.getDepth(),
              blockhash: details.block ? util.revHex(details.block) : null,
              blockindex: details.index,
              blocktime: details.time,
              txid: util.revHex(details.hash),
              walletconflicts: [],
              time: details.mtime,
              timereceived: details.mtime,
              'bip125-replaceable': 'no'
            });

          case 57:
          case 'end':
            return _context36.stop();
        }
      }
    }, _callee36, this, [[10, 22, 26, 34], [27,, 29, 33]]);
  }));

  function _toListTX(_x72) {
    return _ref36.apply(this, arguments);
  }

  return _toListTX;
}();

RPC.prototype.listTransactions = function () {
  var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(args, help) {
    var wallet, valid, name, count, from, watchOnly, txs, end, to, out, i, wtx, json;
    return _regenerator2.default.wrap(function _callee37$(_context37) {
      while (1) {
        switch (_context37.prev = _context37.next) {
          case 0:
            if (!(help || args.length > 4)) {
              _context37.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listtransactions ( "account" count from includeWatchonly)');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0);
            count = valid.u32(1, 10);
            from = valid.u32(2, 0);
            watchOnly = valid.bool(3, false);

            if (!(wallet.watchOnly !== watchOnly)) {
              _context37.next = 10;
              break;
            }

            return _context37.abrupt('return', []);

          case 10:

            if (name === '') name = 'default';

            _context37.next = 13;
            return wallet.getHistory();

          case 13:
            txs = _context37.sent;


            common.sortTX(txs);

            end = from + count;
            to = Math.min(end, txs.length);
            out = [];
            i = from;

          case 19:
            if (!(i < to)) {
              _context37.next = 28;
              break;
            }

            wtx = txs[i];
            _context37.next = 23;
            return this._toListTX(wtx);

          case 23:
            json = _context37.sent;

            out.push(json);

          case 25:
            i++;
            _context37.next = 19;
            break;

          case 28:
            return _context37.abrupt('return', out);

          case 29:
          case 'end':
            return _context37.stop();
        }
      }
    }, _callee37, this);
  }));

  function listTransactions(_x73, _x74) {
    return _ref37.apply(this, arguments);
  }

  return listTransactions;
}();

RPC.prototype.listUnspent = function () {
  var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(args, help) {
    var wallet, valid, minDepth, maxDepth, addrs, height, map, _valid2, i, addr, hash, coins, out, _iteratorNormalCompletion23, _didIteratorError23, _iteratorError23, _iterator23, _step23, coin, depth, _addr2, _hash, ring;

    return _regenerator2.default.wrap(function _callee38$(_context38) {
      while (1) {
        switch (_context38.prev = _context38.next) {
          case 0:
            if (!(help || args.length > 3)) {
              _context38.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'listunspent ( minconf maxconf  ["address",...] )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            minDepth = valid.u32(0, 1);
            maxDepth = valid.u32(1, 9999999);
            addrs = valid.array(2);
            height = this.wdb.state.height;
            map = new _set2.default();

            if (!addrs) {
              _context38.next = 21;
              break;
            }

            _valid2 = new Validator([addrs]);
            i = 0;

          case 12:
            if (!(i < addrs.length)) {
              _context38.next = 21;
              break;
            }

            addr = _valid2.str(i, '');
            hash = parseHash(addr, this.network);

            if (!map.has(hash)) {
              _context38.next = 17;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Duplicate address.');

          case 17:

            map.add(hash);

          case 18:
            i++;
            _context38.next = 12;
            break;

          case 21:
            _context38.next = 23;
            return wallet.getCoins();

          case 23:
            coins = _context38.sent;


            common.sortCoins(coins);

            out = [];
            _iteratorNormalCompletion23 = true;
            _didIteratorError23 = false;
            _iteratorError23 = undefined;
            _context38.prev = 29;
            _iterator23 = (0, _getIterator3.default)(coins);

          case 31:
            if (_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done) {
              _context38.next = 50;
              break;
            }

            coin = _step23.value;
            depth = coin.getDepth(height);

            if (!(depth < minDepth || depth > maxDepth)) {
              _context38.next = 36;
              break;
            }

            return _context38.abrupt('continue', 47);

          case 36:
            _addr2 = coin.getAddress();

            if (_addr2) {
              _context38.next = 39;
              break;
            }

            return _context38.abrupt('continue', 47);

          case 39:
            _hash = coin.getHash('hex');

            if (!addrs) {
              _context38.next = 43;
              break;
            }

            if (!(!_hash || !map.has(_hash))) {
              _context38.next = 43;
              break;
            }

            return _context38.abrupt('continue', 47);

          case 43:
            _context38.next = 45;
            return wallet.getKey(_hash);

          case 45:
            ring = _context38.sent;


            out.push({
              txid: coin.txid(),
              vout: coin.index,
              address: _addr2 ? _addr2.toString(this.network) : null,
              account: ring ? ring.name : undefined,
              redeemScript: ring && ring.script ? ring.script.toJSON() : undefined,
              scriptPubKey: coin.script.toJSON(),
              amount: Amount.btc(coin.value, true),
              confirmations: depth,
              spendable: !wallet.isLocked(coin),
              solvable: true
            });

          case 47:
            _iteratorNormalCompletion23 = true;
            _context38.next = 31;
            break;

          case 50:
            _context38.next = 56;
            break;

          case 52:
            _context38.prev = 52;
            _context38.t0 = _context38['catch'](29);
            _didIteratorError23 = true;
            _iteratorError23 = _context38.t0;

          case 56:
            _context38.prev = 56;
            _context38.prev = 57;

            if (!_iteratorNormalCompletion23 && _iterator23.return) {
              _iterator23.return();
            }

          case 59:
            _context38.prev = 59;

            if (!_didIteratorError23) {
              _context38.next = 62;
              break;
            }

            throw _iteratorError23;

          case 62:
            return _context38.finish(59);

          case 63:
            return _context38.finish(56);

          case 64:
            return _context38.abrupt('return', out);

          case 65:
          case 'end':
            return _context38.stop();
        }
      }
    }, _callee38, this, [[29, 52, 56, 64], [57,, 59, 63]]);
  }));

  function listUnspent(_x75, _x76) {
    return _ref38.apply(this, arguments);
  }

  return listUnspent;
}();

RPC.prototype.lockUnspent = function () {
  var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(args, help) {
    var wallet, valid, unlock, outputs, _iteratorNormalCompletion24, _didIteratorError24, _iteratorError24, _iterator24, _step24, output, _valid3, hash, index, outpoint;

    return _regenerator2.default.wrap(function _callee39$(_context39) {
      while (1) {
        switch (_context39.prev = _context39.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context39.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'lockunspent unlock ([{"txid":"txid","vout":n},...])');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            unlock = valid.bool(0, false);
            outputs = valid.array(1);

            if (!(args.length === 1)) {
              _context39.next = 9;
              break;
            }

            if (unlock) wallet.unlockCoins();
            return _context39.abrupt('return', true);

          case 9:
            if (outputs) {
              _context39.next = 11;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 11:
            _iteratorNormalCompletion24 = true;
            _didIteratorError24 = false;
            _iteratorError24 = undefined;
            _context39.prev = 14;
            _iterator24 = (0, _getIterator3.default)(outputs);

          case 16:
            if (_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done) {
              _context39.next = 31;
              break;
            }

            output = _step24.value;
            _valid3 = new Validator([output]);
            hash = _valid3.hash('txid');
            index = _valid3.u32('vout');

            if (!(hash == null || index == null)) {
              _context39.next = 23;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid parameter.');

          case 23:
            outpoint = new Outpoint(hash, index);

            if (!unlock) {
              _context39.next = 27;
              break;
            }

            wallet.unlockCoin(outpoint);
            return _context39.abrupt('continue', 28);

          case 27:

            wallet.lockCoin(outpoint);

          case 28:
            _iteratorNormalCompletion24 = true;
            _context39.next = 16;
            break;

          case 31:
            _context39.next = 37;
            break;

          case 33:
            _context39.prev = 33;
            _context39.t0 = _context39['catch'](14);
            _didIteratorError24 = true;
            _iteratorError24 = _context39.t0;

          case 37:
            _context39.prev = 37;
            _context39.prev = 38;

            if (!_iteratorNormalCompletion24 && _iterator24.return) {
              _iterator24.return();
            }

          case 40:
            _context39.prev = 40;

            if (!_didIteratorError24) {
              _context39.next = 43;
              break;
            }

            throw _iteratorError24;

          case 43:
            return _context39.finish(40);

          case 44:
            return _context39.finish(37);

          case 45:
            return _context39.abrupt('return', true);

          case 46:
          case 'end':
            return _context39.stop();
        }
      }
    }, _callee39, this, [[14, 33, 37, 45], [38,, 40, 44]]);
  }));

  function lockUnspent(_x77, _x78) {
    return _ref39.apply(this, arguments);
  }

  return lockUnspent;
}();

RPC.prototype.move = function () {
  var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(args, help) {
    return _regenerator2.default.wrap(function _callee40$(_context40) {
      while (1) {
        switch (_context40.prev = _context40.next) {
          case 0:
            throw new Error('Not implemented.');

          case 1:
          case 'end':
            return _context40.stop();
        }
      }
    }, _callee40, this);
  }));

  function move(_x79, _x80) {
    return _ref40.apply(this, arguments);
  }

  return move;
}();

RPC.prototype.sendFrom = function () {
  var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(args, help) {
    var wallet, valid, name, str, value, minconf, addr, options, tx;
    return _regenerator2.default.wrap(function _callee41$(_context41) {
      while (1) {
        switch (_context41.prev = _context41.next) {
          case 0:
            if (!(help || args.length < 3 || args.length > 6)) {
              _context41.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'sendfrom "fromaccount" "tobitcoinaddress"' + ' amount ( minconf "comment" "comment-to" )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0);
            str = valid.str(1);
            value = valid.ufixed(2, 8);
            minconf = valid.u32(3, 0);
            addr = parseAddress(str, this.network);

            if (!(!addr || value == null)) {
              _context41.next = 11;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 11:

            if (name === '') name = 'default';

            options = {
              account: name,
              depth: minconf,
              outputs: [{
                address: addr,
                value: value
              }]
            };
            _context41.next = 15;
            return wallet.send(options);

          case 15:
            tx = _context41.sent;
            return _context41.abrupt('return', tx.txid());

          case 17:
          case 'end':
            return _context41.stop();
        }
      }
    }, _callee41, this);
  }));

  function sendFrom(_x81, _x82) {
    return _ref41.apply(this, arguments);
  }

  return sendFrom;
}();

RPC.prototype.sendMany = function () {
  var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(args, help) {
    var wallet, valid, name, sendTo, minconf, subtract, to, uniq, outputs, _iteratorNormalCompletion25, _didIteratorError25, _iteratorError25, _iterator25, _step25, key, value, addr, hash, output, options, tx;

    return _regenerator2.default.wrap(function _callee42$(_context42) {
      while (1) {
        switch (_context42.prev = _context42.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 5)) {
              _context42.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'sendmany "fromaccount" {"address":amount,...}' + ' ( minconf "comment" ["address",...] )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            name = valid.str(0);
            sendTo = valid.obj(1);
            minconf = valid.u32(2, 1);
            subtract = valid.bool(4, false);


            if (name === '') name = 'default';

            if (sendTo) {
              _context42.next = 11;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 11:
            to = new Validator([sendTo]);
            uniq = new _set2.default();
            outputs = [];
            _iteratorNormalCompletion25 = true;
            _didIteratorError25 = false;
            _iteratorError25 = undefined;
            _context42.prev = 17;
            _iterator25 = (0, _getIterator3.default)((0, _keys2.default)(sendTo));

          case 19:
            if (_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done) {
              _context42.next = 36;
              break;
            }

            key = _step25.value;
            value = to.ufixed(key, 8);
            addr = parseAddress(key, this.network);
            hash = addr.getHash('hex');

            if (!(value == null)) {
              _context42.next = 26;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid parameter.');

          case 26:
            if (!uniq.has(hash)) {
              _context42.next = 28;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid parameter.');

          case 28:

            uniq.add(hash);

            output = new Output();

            output.value = value;
            output.script.fromAddress(addr);
            outputs.push(output);

          case 33:
            _iteratorNormalCompletion25 = true;
            _context42.next = 19;
            break;

          case 36:
            _context42.next = 42;
            break;

          case 38:
            _context42.prev = 38;
            _context42.t0 = _context42['catch'](17);
            _didIteratorError25 = true;
            _iteratorError25 = _context42.t0;

          case 42:
            _context42.prev = 42;
            _context42.prev = 43;

            if (!_iteratorNormalCompletion25 && _iterator25.return) {
              _iterator25.return();
            }

          case 45:
            _context42.prev = 45;

            if (!_didIteratorError25) {
              _context42.next = 48;
              break;
            }

            throw _iteratorError25;

          case 48:
            return _context42.finish(45);

          case 49:
            return _context42.finish(42);

          case 50:
            options = {
              outputs: outputs,
              subtractFee: subtract,
              account: name,
              depth: minconf
            };
            _context42.next = 53;
            return wallet.send(options);

          case 53:
            tx = _context42.sent;
            return _context42.abrupt('return', tx.txid());

          case 55:
          case 'end':
            return _context42.stop();
        }
      }
    }, _callee42, this, [[17, 38, 42, 50], [43,, 45, 49]]);
  }));

  function sendMany(_x83, _x84) {
    return _ref42.apply(this, arguments);
  }

  return sendMany;
}();

RPC.prototype.sendToAddress = function () {
  var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(args, help) {
    var wallet, valid, str, value, subtract, addr, options, tx;
    return _regenerator2.default.wrap(function _callee43$(_context43) {
      while (1) {
        switch (_context43.prev = _context43.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 5)) {
              _context43.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'sendtoaddress "bitcoinaddress" amount' + ' ( "comment" "comment-to" subtractfeefromamount )');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            str = valid.str(0);
            value = valid.ufixed(1, 8);
            subtract = valid.bool(4, false);
            addr = parseAddress(str, this.network);

            if (!(!addr || value == null)) {
              _context43.next = 10;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 10:
            options = {
              subtractFee: subtract,
              outputs: [{
                address: addr,
                value: value
              }]
            };
            _context43.next = 13;
            return wallet.send(options);

          case 13:
            tx = _context43.sent;
            return _context43.abrupt('return', tx.txid());

          case 15:
          case 'end':
            return _context43.stop();
        }
      }
    }, _callee43, this);
  }));

  function sendToAddress(_x85, _x86) {
    return _ref43.apply(this, arguments);
  }

  return sendToAddress;
}();

RPC.prototype.setAccount = function () {
  var _ref44 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee44(args, help) {
    return _regenerator2.default.wrap(function _callee44$(_context44) {
      while (1) {
        switch (_context44.prev = _context44.next) {
          case 0:
            if (!(help || args.length < 1 || args.length > 2)) {
              _context44.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'setaccount "bitcoinaddress" "account"');

          case 2:
            throw new Error('Not implemented.');

          case 3:
          case 'end':
            return _context44.stop();
        }
      }
    }, _callee44, this);
  }));

  function setAccount(_x87, _x88) {
    return _ref44.apply(this, arguments);
  }

  return setAccount;
}();

RPC.prototype.setTXFee = function () {
  var _ref45 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee45(args, help) {
    var valid, rate;
    return _regenerator2.default.wrap(function _callee45$(_context45) {
      while (1) {
        switch (_context45.prev = _context45.next) {
          case 0:
            valid = new Validator([args]);
            rate = valid.ufixed(0, 8);

            if (!(help || args.length < 1 || args.length > 1)) {
              _context45.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'settxfee amount');

          case 4:
            if (!(rate == null)) {
              _context45.next = 6;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 6:

            this.wdb.feeRate = rate;

            return _context45.abrupt('return', true);

          case 8:
          case 'end':
            return _context45.stop();
        }
      }
    }, _callee45, this);
  }));

  function setTXFee(_x89, _x90) {
    return _ref45.apply(this, arguments);
  }

  return setTXFee;
}();

RPC.prototype.signMessage = function () {
  var _ref46 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee46(args, help) {
    var wallet, valid, b58, str, addr, ring, msg, hash, sig;
    return _regenerator2.default.wrap(function _callee46$(_context46) {
      while (1) {
        switch (_context46.prev = _context46.next) {
          case 0:
            if (!(help || args.length !== 2)) {
              _context46.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'signmessage "bitcoinaddress" "message"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            b58 = valid.str(0, '');
            str = valid.str(1, '');
            addr = parseHash(b58, this.network);
            _context46.next = 9;
            return wallet.getKey(addr);

          case 9:
            ring = _context46.sent;

            if (ring) {
              _context46.next = 12;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'Address not found.');

          case 12:
            if (wallet.master.key) {
              _context46.next = 14;
              break;
            }

            throw new RPCError(errs.WALLET_UNLOCK_NEEDED, 'Wallet is locked.');

          case 14:
            msg = Buffer.from(MAGIC_STRING + str, 'utf8');
            hash = digest.hash256(msg);
            sig = ring.sign(hash);
            return _context46.abrupt('return', sig.toString('base64'));

          case 18:
          case 'end':
            return _context46.stop();
        }
      }
    }, _callee46, this);
  }));

  function signMessage(_x91, _x92) {
    return _ref46.apply(this, arguments);
  }

  return signMessage;
}();

RPC.prototype.walletLock = function () {
  var _ref47 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee47(args, help) {
    var wallet;
    return _regenerator2.default.wrap(function _callee47$(_context47) {
      while (1) {
        switch (_context47.prev = _context47.next) {
          case 0:
            wallet = this.wallet;

            if (!(help || wallet.master.encrypted && args.length !== 0)) {
              _context47.next = 3;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'walletlock');

          case 3:
            if (wallet.master.encrypted) {
              _context47.next = 5;
              break;
            }

            throw new RPCError(errs.WALLET_WRONG_ENC_STATE, 'Wallet is not encrypted.');

          case 5:
            _context47.next = 7;
            return wallet.lock();

          case 7:
            return _context47.abrupt('return', null);

          case 8:
          case 'end':
            return _context47.stop();
        }
      }
    }, _callee47, this);
  }));

  function walletLock(_x93, _x94) {
    return _ref47.apply(this, arguments);
  }

  return walletLock;
}();

RPC.prototype.walletPassphraseChange = function () {
  var _ref48 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee48(args, help) {
    var wallet, valid, old, new_;
    return _regenerator2.default.wrap(function _callee48$(_context48) {
      while (1) {
        switch (_context48.prev = _context48.next) {
          case 0:
            wallet = this.wallet;

            if (!(help || wallet.master.encrypted && args.length !== 2)) {
              _context48.next = 3;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'walletpassphrasechange' + ' "oldpassphrase" "newpassphrase"');

          case 3:
            valid = new Validator([args]);
            old = valid.str(0, '');
            new_ = valid.str(1, '');

            if (wallet.master.encrypted) {
              _context48.next = 8;
              break;
            }

            throw new RPCError(errs.WALLET_WRONG_ENC_STATE, 'Wallet is not encrypted.');

          case 8:
            if (!(old.length < 1 || new_.length < 1)) {
              _context48.next = 10;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid parameter');

          case 10:
            _context48.next = 12;
            return wallet.setPassphrase(old, new_);

          case 12:
            return _context48.abrupt('return', null);

          case 13:
          case 'end':
            return _context48.stop();
        }
      }
    }, _callee48, this);
  }));

  function walletPassphraseChange(_x95, _x96) {
    return _ref48.apply(this, arguments);
  }

  return walletPassphraseChange;
}();

RPC.prototype.walletPassphrase = function () {
  var _ref49 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee49(args, help) {
    var wallet, valid, passphrase, timeout;
    return _regenerator2.default.wrap(function _callee49$(_context49) {
      while (1) {
        switch (_context49.prev = _context49.next) {
          case 0:
            wallet = this.wallet;
            valid = new Validator([args]);
            passphrase = valid.str(0, '');
            timeout = valid.u32(1);

            if (!(help || wallet.master.encrypted && args.length !== 2)) {
              _context49.next = 6;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'walletpassphrase "passphrase" timeout');

          case 6:
            if (wallet.master.encrypted) {
              _context49.next = 8;
              break;
            }

            throw new RPCError(errs.WALLET_WRONG_ENC_STATE, 'Wallet is not encrypted.');

          case 8:
            if (!(passphrase.length < 1)) {
              _context49.next = 10;
              break;
            }

            throw new RPCError(errs.INVALID_PARAMETER, 'Invalid parameter');

          case 10:
            if (!(timeout == null)) {
              _context49.next = 12;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter');

          case 12:
            _context49.next = 14;
            return wallet.unlock(passphrase, timeout);

          case 14:
            return _context49.abrupt('return', null);

          case 15:
          case 'end':
            return _context49.stop();
        }
      }
    }, _callee49, this);
  }));

  function walletPassphrase(_x97, _x98) {
    return _ref49.apply(this, arguments);
  }

  return walletPassphrase;
}();

RPC.prototype.importPrunedFunds = function () {
  var _ref50 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee50(args, help) {
    var valid, txRaw, blockRaw, tx, block, hash, height, entry;
    return _regenerator2.default.wrap(function _callee50$(_context50) {
      while (1) {
        switch (_context50.prev = _context50.next) {
          case 0:
            if (!(help || args.length < 2 || args.length > 3)) {
              _context50.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'importprunedfunds "rawtransaction" "txoutproof" ( "label" )');

          case 2:
            valid = new Validator([args]);
            txRaw = valid.buf(0);
            blockRaw = valid.buf(1);

            if (!(!txRaw || !blockRaw)) {
              _context50.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 7:
            tx = TX.fromRaw(txRaw);
            block = MerkleBlock.fromRaw(blockRaw);
            hash = block.hash('hex');

            if (block.verify()) {
              _context50.next = 12;
              break;
            }

            throw new RPCError(errs.VERIFY_ERROR, 'Invalid proof.');

          case 12:
            if (block.hasTX(tx.hash('hex'))) {
              _context50.next = 14;
              break;
            }

            throw new RPCError(errs.VERIFY_ERROR, 'Invalid proof.');

          case 14:
            _context50.next = 16;
            return this.client.getEntry(hash);

          case 16:
            height = _context50.sent;

            if (!(height === -1)) {
              _context50.next = 19;
              break;
            }

            throw new RPCError(errs.VERIFY_ERROR, 'Invalid proof.');

          case 19:
            entry = {
              hash: hash,
              time: block.time,
              height: height
            };
            _context50.next = 22;
            return this.wdb.addTX(tx, entry);

          case 22:
            if (_context50.sent) {
              _context50.next = 24;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'No tracked address for TX.');

          case 24:
            return _context50.abrupt('return', null);

          case 25:
          case 'end':
            return _context50.stop();
        }
      }
    }, _callee50, this);
  }));

  function importPrunedFunds(_x99, _x100) {
    return _ref50.apply(this, arguments);
  }

  return importPrunedFunds;
}();

RPC.prototype.removePrunedFunds = function () {
  var _ref51 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee51(args, help) {
    var wallet, valid, hash;
    return _regenerator2.default.wrap(function _callee51$(_context51) {
      while (1) {
        switch (_context51.prev = _context51.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context51.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'removeprunedfunds "txid"');

          case 2:
            wallet = this.wallet;
            valid = new Validator([args]);
            hash = valid.hash(0);

            if (hash) {
              _context51.next = 7;
              break;
            }

            throw new RPCError(errs.TYPE_ERROR, 'Invalid parameter.');

          case 7:
            _context51.next = 9;
            return wallet.remove(hash);

          case 9:
            if (_context51.sent) {
              _context51.next = 11;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'Transaction not in wallet.');

          case 11:
            return _context51.abrupt('return', null);

          case 12:
          case 'end':
            return _context51.stop();
        }
      }
    }, _callee51, this);
  }));

  function removePrunedFunds(_x101, _x102) {
    return _ref51.apply(this, arguments);
  }

  return removePrunedFunds;
}();

RPC.prototype.selectWallet = function () {
  var _ref52 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee52(args, help) {
    var valid, id, wallet;
    return _regenerator2.default.wrap(function _callee52$(_context52) {
      while (1) {
        switch (_context52.prev = _context52.next) {
          case 0:
            valid = new Validator([args]);
            id = valid.str(0);

            if (!(help || args.length !== 1)) {
              _context52.next = 4;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'selectwallet "id"');

          case 4:
            _context52.next = 6;
            return this.wdb.get(id);

          case 6:
            wallet = _context52.sent;

            if (wallet) {
              _context52.next = 9;
              break;
            }

            throw new RPCError(errs.WALLET_ERROR, 'Wallet not found.');

          case 9:

            this.wallet = wallet;

            return _context52.abrupt('return', null);

          case 11:
          case 'end':
            return _context52.stop();
        }
      }
    }, _callee52, this);
  }));

  function selectWallet(_x103, _x104) {
    return _ref52.apply(this, arguments);
  }

  return selectWallet;
}();

RPC.prototype.getMemoryInfo = function () {
  var _ref53 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee53(args, help) {
    return _regenerator2.default.wrap(function _callee53$(_context53) {
      while (1) {
        switch (_context53.prev = _context53.next) {
          case 0:
            if (!(help || args.length !== 0)) {
              _context53.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'getmemoryinfo');

          case 2:
            return _context53.abrupt('return', util.memoryUsage());

          case 3:
          case 'end':
            return _context53.stop();
        }
      }
    }, _callee53, this);
  }));

  function getMemoryInfo(_x105, _x106) {
    return _ref53.apply(this, arguments);
  }

  return getMemoryInfo;
}();

RPC.prototype.setLogLevel = function () {
  var _ref54 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee54(args, help) {
    var valid, level;
    return _regenerator2.default.wrap(function _callee54$(_context54) {
      while (1) {
        switch (_context54.prev = _context54.next) {
          case 0:
            if (!(help || args.length !== 1)) {
              _context54.next = 2;
              break;
            }

            throw new RPCError(errs.MISC_ERROR, 'setloglevel "level"');

          case 2:
            valid = new Validator([args]);
            level = valid.str(0, '');


            this.logger.setLevel(level);

            return _context54.abrupt('return', null);

          case 6:
          case 'end':
            return _context54.stop();
        }
      }
    }, _callee54, this);
  }));

  function setLogLevel(_x107, _x108) {
    return _ref54.apply(this, arguments);
  }

  return setLogLevel;
}();

/*
 * Helpers
 */

function parseHash(raw, network) {
  var addr = parseAddress(raw, network);
  return addr.getHash('hex');
}

function parseAddress(raw, network) {
  try {
    return Address.fromString(raw, network);
  } catch (e) {
    throw new RPCError(errs.INVALID_ADDRESS_OR_KEY, 'Invalid address.');
  }
}

function parseSecret(raw, network) {
  try {
    return KeyRing.fromSecret(raw, network);
  } catch (e) {
    throw new RPCError(errs.INVALID_ADDRESS_OR_KEY, 'Invalid key.');
  }
}

/*
 * Expose
 */

module.exports = RPC;