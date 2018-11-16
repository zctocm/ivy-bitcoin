/*!
 * server.js - http server for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

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
var path = require('path');
var HTTPBase = require('../http/base');
var util = require('../utils/util');
var base58 = require('../utils/base58');
var MTX = require('../primitives/mtx');
var Outpoint = require('../primitives/outpoint');
var Script = require('../script/script');
var digest = require('../crypto/digest');
var random = require('../crypto/random');
var ccmp = require('../crypto/ccmp');
var Network = require('../protocol/network');
var Validator = require('../utils/validator');
var Address = require('../primitives/address');
var KeyRing = require('../primitives/keyring');
var common = require('./common');

/**
 * HTTPServer
 * @alias module:wallet.HTTPServer
 * @constructor
 * @param {Object} options
 * @see HTTPBase
 * @emits HTTPServer#socket
 */

function HTTPServer(options) {
  if (!(this instanceof HTTPServer)) return new HTTPServer(options);

  options = new HTTPOptions(options);

  HTTPBase.call(this, options);

  this.options = options;
  this.network = this.options.network;
  this.logger = this.options.logger.context('http');
  this.walletdb = this.options.walletdb;

  this.server = new HTTPBase(this.options);
  this.rpc = this.walletdb.rpc;

  this.init();
}

(0, _setPrototypeOf2.default)(HTTPServer.prototype, HTTPBase.prototype);

/**
 * Attach to server.
 * @private
 * @param {HTTPServer} server
 */

HTTPServer.prototype.attach = function attach(server) {
  server.mount('/wallet', this);
};

/**
 * Initialize http server.
 * @private
 */

HTTPServer.prototype.init = function init() {
  var _this = this;

  this.on('request', function (req, res) {
    if (req.method === 'POST' && req.pathname === '/') return;

    _this.logger.debug('Request for method=%s path=%s (%s).', req.method, req.pathname, req.socket.remoteAddress);
  });

  this.on('listening', function (address) {
    _this.logger.info('HTTP server listening on %s (port=%d).', address.address, address.port);
  });

  this.initRouter();
  this.initSockets();
};

/**
 * Initialize routes.
 * @private
 */

HTTPServer.prototype.initRouter = function initRouter() {
  var _this2 = this;

  this.use(this.cors());

  if (!this.options.noAuth) {
    this.use(this.basicAuth({
      password: this.options.apiKey,
      realm: 'wallet'
    }));
  }

  this.use(this.bodyParser({
    contentType: 'json'
  }));

  this.use(this.jsonRPC(this.rpc));

  this.hook(function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(req, res) {
      var valid, id, token, _wallet, wallet;

      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              valid = req.valid();

              if (!(req.path.length === 0)) {
                _context.next = 3;
                break;
              }

              return _context.abrupt('return');

            case 3:
              if (!(req.path[0] === '_admin')) {
                _context.next = 5;
                break;
              }

              return _context.abrupt('return');

            case 5:
              if (!(req.method === 'PUT' && req.path.length === 1)) {
                _context.next = 7;
                break;
              }

              return _context.abrupt('return');

            case 7:
              id = valid.str('id');
              token = valid.buf('token');

              if (_this2.options.walletAuth) {
                _context.next = 18;
                break;
              }

              _context.next = 12;
              return _this2.walletdb.get(id);

            case 12:
              _wallet = _context.sent;

              if (_wallet) {
                _context.next = 16;
                break;
              }

              res.send(404);
              return _context.abrupt('return');

            case 16:

              req.wallet = _wallet;

              return _context.abrupt('return');

            case 18:
              wallet = void 0;
              _context.prev = 19;
              _context.next = 22;
              return _this2.walletdb.auth(id, token);

            case 22:
              wallet = _context.sent;
              _context.next = 30;
              break;

            case 25:
              _context.prev = 25;
              _context.t0 = _context['catch'](19);

              _this2.logger.info('Auth failure for %s: %s.', id, _context.t0.message);
              res.error(403, _context.t0);
              return _context.abrupt('return');

            case 30:
              if (wallet) {
                _context.next = 33;
                break;
              }

              res.send(404);
              return _context.abrupt('return');

            case 33:

              req.wallet = wallet;

              _this2.logger.info('Successful auth for %s.', id);

            case 35:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this2, [[19, 25]]);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());

  // Rescan
  this.post('/_admin/rescan', function () {
    var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(req, res) {
      var valid, height;
      return _regenerator2.default.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              valid = req.valid();
              height = valid.u32('height');


              res.send(200, { success: true });

              _context2.next = 5;
              return _this2.walletdb.rescan(height);

            case 5:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this2);
    }));

    return function (_x3, _x4) {
      return _ref2.apply(this, arguments);
    };
  }());

  // Resend
  this.post('/_admin/resend', function () {
    var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(req, res) {
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return _this2.walletdb.resend();

            case 2:

              res.send(200, { success: true });

            case 3:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this2);
    }));

    return function (_x5, _x6) {
      return _ref3.apply(this, arguments);
    };
  }());

  // Backup WalletDB
  this.post('/_admin/backup', function () {
    var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(req, res) {
      var valid, path;
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              valid = req.valid();
              path = valid.str('path');


              enforce(path, 'Path is required.');

              _context4.next = 5;
              return _this2.walletdb.backup(path);

            case 5:

              res.send(200, { success: true });

            case 6:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this2);
    }));

    return function (_x7, _x8) {
      return _ref4.apply(this, arguments);
    };
  }());

  // List wallets
  this.get('/_admin/wallets', function () {
    var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(req, res) {
      var wallets;
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return _this2.walletdb.getWallets();

            case 2:
              wallets = _context5.sent;

              res.send(200, wallets);

            case 4:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this2);
    }));

    return function (_x9, _x10) {
      return _ref5.apply(this, arguments);
    };
  }());

  // Get wallet
  this.get('/:id', function (req, res) {
    res.send(200, req.wallet.toJSON());
  });

  // Get wallet master key
  this.get('/:id/master', function (req, res) {
    res.send(200, req.wallet.master.toJSON(true));
  });

  // Create wallet (compat)
  this.post('/', function () {
    var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(req, res) {
      var valid, wallet;
      return _regenerator2.default.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              valid = req.valid();
              _context6.next = 3;
              return _this2.walletdb.create({
                id: valid.str('id'),
                type: valid.str('type'),
                m: valid.u32('m'),
                n: valid.u32('n'),
                passphrase: valid.str('passphrase'),
                master: valid.str('master'),
                mnemonic: valid.str('mnemonic'),
                witness: valid.bool('witness'),
                accountKey: valid.str('accountKey'),
                watchOnly: valid.bool('watchOnly')
              });

            case 3:
              wallet = _context6.sent;


              res.send(200, wallet.toJSON());

            case 5:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, _this2);
    }));

    return function (_x11, _x12) {
      return _ref6.apply(this, arguments);
    };
  }());

  // Create wallet
  this.put('/:id', function () {
    var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(req, res) {
      var valid, wallet;
      return _regenerator2.default.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              valid = req.valid();
              _context7.next = 3;
              return _this2.walletdb.create({
                id: valid.str('id'),
                type: valid.str('type'),
                m: valid.u32('m'),
                n: valid.u32('n'),
                passphrase: valid.str('passphrase'),
                master: valid.str('master'),
                mnemonic: valid.str('mnemonic'),
                witness: valid.bool('witness'),
                accountKey: valid.str('accountKey'),
                watchOnly: valid.bool('watchOnly')
              });

            case 3:
              wallet = _context7.sent;


              res.send(200, wallet.toJSON());

            case 5:
            case 'end':
              return _context7.stop();
          }
        }
      }, _callee7, _this2);
    }));

    return function (_x13, _x14) {
      return _ref7.apply(this, arguments);
    };
  }());

  // List accounts
  this.get('/:id/account', function () {
    var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(req, res) {
      var accounts;
      return _regenerator2.default.wrap(function _callee8$(_context8) {
        while (1) {
          switch (_context8.prev = _context8.next) {
            case 0:
              _context8.next = 2;
              return req.wallet.getAccounts();

            case 2:
              accounts = _context8.sent;

              res.send(200, accounts);

            case 4:
            case 'end':
              return _context8.stop();
          }
        }
      }, _callee8, _this2);
    }));

    return function (_x15, _x16) {
      return _ref8.apply(this, arguments);
    };
  }());

  // Get account
  this.get('/:id/account/:account', function () {
    var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(req, res) {
      var valid, acct, account;
      return _regenerator2.default.wrap(function _callee9$(_context9) {
        while (1) {
          switch (_context9.prev = _context9.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context9.next = 4;
              return req.wallet.getAccount(acct);

            case 4:
              account = _context9.sent;

              if (account) {
                _context9.next = 8;
                break;
              }

              res.send(404);
              return _context9.abrupt('return');

            case 8:

              res.send(200, account.toJSON());

            case 9:
            case 'end':
              return _context9.stop();
          }
        }
      }, _callee9, _this2);
    }));

    return function (_x17, _x18) {
      return _ref9.apply(this, arguments);
    };
  }());

  // Create account (compat)
  this.post('/:id/account', function () {
    var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(req, res) {
      var valid, passphrase, options, account;
      return _regenerator2.default.wrap(function _callee10$(_context10) {
        while (1) {
          switch (_context10.prev = _context10.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              options = {
                name: valid.str(['account', 'name']),
                witness: valid.bool('witness'),
                watchOnly: valid.bool('watchOnly'),
                type: valid.str('type'),
                m: valid.u32('m'),
                n: valid.u32('n'),
                accountKey: valid.str('accountKey'),
                lookahead: valid.u32('lookahead')
              };
              _context10.next = 5;
              return req.wallet.createAccount(options, passphrase);

            case 5:
              account = _context10.sent;


              res.send(200, account.toJSON());

            case 7:
            case 'end':
              return _context10.stop();
          }
        }
      }, _callee10, _this2);
    }));

    return function (_x19, _x20) {
      return _ref10.apply(this, arguments);
    };
  }());

  // Create account
  this.put('/:id/account/:account', function () {
    var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(req, res) {
      var valid, passphrase, options, account;
      return _regenerator2.default.wrap(function _callee11$(_context11) {
        while (1) {
          switch (_context11.prev = _context11.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              options = {
                name: valid.str('account'),
                witness: valid.bool('witness'),
                watchOnly: valid.bool('watchOnly'),
                type: valid.str('type'),
                m: valid.u32('m'),
                n: valid.u32('n'),
                accountKey: valid.str('accountKey'),
                lookahead: valid.u32('lookahead')
              };
              _context11.next = 5;
              return req.wallet.createAccount(options, passphrase);

            case 5:
              account = _context11.sent;


              res.send(200, account.toJSON());

            case 7:
            case 'end':
              return _context11.stop();
          }
        }
      }, _callee11, _this2);
    }));

    return function (_x21, _x22) {
      return _ref11.apply(this, arguments);
    };
  }());

  // Change passphrase
  this.post('/:id/passphrase', function () {
    var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(req, res) {
      var valid, old, new_;
      return _regenerator2.default.wrap(function _callee12$(_context12) {
        while (1) {
          switch (_context12.prev = _context12.next) {
            case 0:
              valid = req.valid();
              old = valid.str('old');
              new_ = valid.str('new');


              enforce(old || new_, 'Passphrase is required.');

              _context12.next = 6;
              return req.wallet.setPassphrase(old, new_);

            case 6:

              res.send(200, { success: true });

            case 7:
            case 'end':
              return _context12.stop();
          }
        }
      }, _callee12, _this2);
    }));

    return function (_x23, _x24) {
      return _ref12.apply(this, arguments);
    };
  }());

  // Unlock wallet
  this.post('/:id/unlock', function () {
    var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(req, res) {
      var valid, passphrase, timeout;
      return _regenerator2.default.wrap(function _callee13$(_context13) {
        while (1) {
          switch (_context13.prev = _context13.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              timeout = valid.u32('timeout');


              enforce(passphrase, 'Passphrase is required.');

              _context13.next = 6;
              return req.wallet.unlock(passphrase, timeout);

            case 6:

              res.send(200, { success: true });

            case 7:
            case 'end':
              return _context13.stop();
          }
        }
      }, _callee13, _this2);
    }));

    return function (_x25, _x26) {
      return _ref13.apply(this, arguments);
    };
  }());

  // Lock wallet
  this.post('/:id/lock', function () {
    var _ref14 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(req, res) {
      return _regenerator2.default.wrap(function _callee14$(_context14) {
        while (1) {
          switch (_context14.prev = _context14.next) {
            case 0:
              _context14.next = 2;
              return req.wallet.lock();

            case 2:
              res.send(200, { success: true });

            case 3:
            case 'end':
              return _context14.stop();
          }
        }
      }, _callee14, _this2);
    }));

    return function (_x27, _x28) {
      return _ref14.apply(this, arguments);
    };
  }());

  // Import key
  this.post('/:id/import', function () {
    var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee15(req, res) {
      var valid, acct, passphrase, pub, priv, b58, key, _key, addr;

      return _regenerator2.default.wrap(function _callee15$(_context15) {
        while (1) {
          switch (_context15.prev = _context15.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              passphrase = valid.str('passphrase');
              pub = valid.buf('publicKey');
              priv = valid.str('privateKey');
              b58 = valid.str('address');

              if (!pub) {
                _context15.next = 12;
                break;
              }

              key = KeyRing.fromPublic(pub, _this2.network);
              _context15.next = 10;
              return req.wallet.importKey(acct, key);

            case 10:
              res.send(200, { success: true });
              return _context15.abrupt('return');

            case 12:
              if (!priv) {
                _context15.next = 18;
                break;
              }

              _key = KeyRing.fromSecret(priv, _this2.network);
              _context15.next = 16;
              return req.wallet.importKey(acct, _key, passphrase);

            case 16:
              res.send(200, { success: true });
              return _context15.abrupt('return');

            case 18:
              if (!b58) {
                _context15.next = 24;
                break;
              }

              addr = Address.fromString(b58, _this2.network);
              _context15.next = 22;
              return req.wallet.importAddress(acct, addr);

            case 22:
              res.send(200, { success: true });
              return _context15.abrupt('return');

            case 24:

              enforce(false, 'Key or address is required.');

            case 25:
            case 'end':
              return _context15.stop();
          }
        }
      }, _callee15, _this2);
    }));

    return function (_x29, _x30) {
      return _ref15.apply(this, arguments);
    };
  }());

  // Generate new token
  this.post('/:id/retoken', function () {
    var _ref16 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee16(req, res) {
      var valid, passphrase, token;
      return _regenerator2.default.wrap(function _callee16$(_context16) {
        while (1) {
          switch (_context16.prev = _context16.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              _context16.next = 4;
              return req.wallet.retoken(passphrase);

            case 4:
              token = _context16.sent;


              res.send(200, {
                token: token.toString('hex')
              });

            case 6:
            case 'end':
              return _context16.stop();
          }
        }
      }, _callee16, _this2);
    }));

    return function (_x31, _x32) {
      return _ref16.apply(this, arguments);
    };
  }());

  // Send TX
  this.post('/:id/send', function () {
    var _ref17 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee17(req, res) {
      var valid, passphrase, outputs, options, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, output, _valid, raw, script, tx, details;

      return _regenerator2.default.wrap(function _callee17$(_context17) {
        while (1) {
          switch (_context17.prev = _context17.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              outputs = valid.array('outputs', []);
              options = {
                rate: valid.u64('rate'),
                blocks: valid.u32('blocks'),
                maxFee: valid.u64('maxFee'),
                selection: valid.str('selection'),
                smart: valid.bool('smart'),
                subtractFee: valid.bool('subtractFee'),
                subtractIndex: valid.i32('subtractIndex'),
                depth: valid.u32(['confirmations', 'depth']),
                outputs: []
              };
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context17.prev = 7;


              for (_iterator = (0, _getIterator3.default)(outputs); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                output = _step.value;
                _valid = new Validator([output]);
                raw = _valid.buf('script');
                script = null;


                if (raw) script = Script.fromRaw(raw);

                options.outputs.push({
                  script: script,
                  address: _valid.str('address'),
                  value: _valid.u64('value')
                });
              }

              _context17.next = 15;
              break;

            case 11:
              _context17.prev = 11;
              _context17.t0 = _context17['catch'](7);
              _didIteratorError = true;
              _iteratorError = _context17.t0;

            case 15:
              _context17.prev = 15;
              _context17.prev = 16;

              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }

            case 18:
              _context17.prev = 18;

              if (!_didIteratorError) {
                _context17.next = 21;
                break;
              }

              throw _iteratorError;

            case 21:
              return _context17.finish(18);

            case 22:
              return _context17.finish(15);

            case 23:
              _context17.next = 25;
              return req.wallet.send(options, passphrase);

            case 25:
              tx = _context17.sent;
              _context17.next = 28;
              return req.wallet.getDetails(tx.hash('hex'));

            case 28:
              details = _context17.sent;


              res.send(200, details.toJSON());

            case 30:
            case 'end':
              return _context17.stop();
          }
        }
      }, _callee17, _this2, [[7, 11, 15, 23], [16,, 18, 22]]);
    }));

    return function (_x33, _x34) {
      return _ref17.apply(this, arguments);
    };
  }());

  // Create TX
  this.post('/:id/create', function () {
    var _ref18 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee18(req, res) {
      var valid, passphrase, outputs, options, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, output, _valid2, raw, script, tx;

      return _regenerator2.default.wrap(function _callee18$(_context18) {
        while (1) {
          switch (_context18.prev = _context18.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              outputs = valid.array('outputs', []);
              options = {
                rate: valid.u64('rate'),
                maxFee: valid.u64('maxFee'),
                selection: valid.str('selection'),
                smart: valid.bool('smart'),
                subtractFee: valid.bool('subtractFee'),
                subtractIndex: valid.i32('subtractIndex'),
                depth: valid.u32(['confirmations', 'depth']),
                outputs: []
              };
              _iteratorNormalCompletion2 = true;
              _didIteratorError2 = false;
              _iteratorError2 = undefined;
              _context18.prev = 7;


              for (_iterator2 = (0, _getIterator3.default)(outputs); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                output = _step2.value;
                _valid2 = new Validator([output]);
                raw = _valid2.buf('script');
                script = null;


                if (raw) script = Script.fromRaw(raw);

                options.outputs.push({
                  script: script,
                  address: _valid2.str('address'),
                  value: _valid2.u64('value')
                });
              }

              _context18.next = 15;
              break;

            case 11:
              _context18.prev = 11;
              _context18.t0 = _context18['catch'](7);
              _didIteratorError2 = true;
              _iteratorError2 = _context18.t0;

            case 15:
              _context18.prev = 15;
              _context18.prev = 16;

              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }

            case 18:
              _context18.prev = 18;

              if (!_didIteratorError2) {
                _context18.next = 21;
                break;
              }

              throw _iteratorError2;

            case 21:
              return _context18.finish(18);

            case 22:
              return _context18.finish(15);

            case 23:
              _context18.next = 25;
              return req.wallet.createTX(options);

            case 25:
              tx = _context18.sent;
              _context18.next = 28;
              return req.wallet.sign(tx, passphrase);

            case 28:

              res.send(200, tx.getJSON(_this2.network));

            case 29:
            case 'end':
              return _context18.stop();
          }
        }
      }, _callee18, _this2, [[7, 11, 15, 23], [16,, 18, 22]]);
    }));

    return function (_x35, _x36) {
      return _ref18.apply(this, arguments);
    };
  }());

  // Sign TX
  this.post('/:id/sign', function () {
    var _ref19 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee19(req, res) {
      var valid, passphrase, raw, tx;
      return _regenerator2.default.wrap(function _callee19$(_context19) {
        while (1) {
          switch (_context19.prev = _context19.next) {
            case 0:
              valid = req.valid();
              passphrase = valid.str('passphrase');
              raw = valid.buf('tx');


              enforce(raw, 'TX is required.');

              tx = MTX.fromRaw(raw);
              _context19.next = 7;
              return req.wallet.getCoinView(tx);

            case 7:
              tx.view = _context19.sent;
              _context19.next = 10;
              return req.wallet.sign(tx, passphrase);

            case 10:

              res.send(200, tx.getJSON(_this2.network));

            case 11:
            case 'end':
              return _context19.stop();
          }
        }
      }, _callee19, _this2);
    }));

    return function (_x37, _x38) {
      return _ref19.apply(this, arguments);
    };
  }());

  // Zap Wallet TXs
  this.post('/:id/zap', function () {
    var _ref20 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee20(req, res) {
      var valid, acct, age;
      return _regenerator2.default.wrap(function _callee20$(_context20) {
        while (1) {
          switch (_context20.prev = _context20.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              age = valid.u32('age');


              enforce(age, 'Age is required.');

              _context20.next = 6;
              return req.wallet.zap(acct, age);

            case 6:

              res.send(200, { success: true });

            case 7:
            case 'end':
              return _context20.stop();
          }
        }
      }, _callee20, _this2);
    }));

    return function (_x39, _x40) {
      return _ref20.apply(this, arguments);
    };
  }());

  // Abandon Wallet TX
  this.del('/:id/tx/:hash', function () {
    var _ref21 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee21(req, res) {
      var valid, hash;
      return _regenerator2.default.wrap(function _callee21$(_context21) {
        while (1) {
          switch (_context21.prev = _context21.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');


              enforce(hash, 'Hash is required.');

              _context21.next = 5;
              return req.wallet.abandon(hash);

            case 5:

              res.send(200, { success: true });

            case 6:
            case 'end':
              return _context21.stop();
          }
        }
      }, _callee21, _this2);
    }));

    return function (_x41, _x42) {
      return _ref21.apply(this, arguments);
    };
  }());

  // List blocks
  this.get('/:id/block', function () {
    var _ref22 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee22(req, res) {
      var heights;
      return _regenerator2.default.wrap(function _callee22$(_context22) {
        while (1) {
          switch (_context22.prev = _context22.next) {
            case 0:
              _context22.next = 2;
              return req.wallet.getBlocks();

            case 2:
              heights = _context22.sent;

              res.send(200, heights);

            case 4:
            case 'end':
              return _context22.stop();
          }
        }
      }, _callee22, _this2);
    }));

    return function (_x43, _x44) {
      return _ref22.apply(this, arguments);
    };
  }());

  // Get Block Record
  this.get('/:id/block/:height', function () {
    var _ref23 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee23(req, res) {
      var valid, height, block;
      return _regenerator2.default.wrap(function _callee23$(_context23) {
        while (1) {
          switch (_context23.prev = _context23.next) {
            case 0:
              valid = req.valid();
              height = valid.u32('height');


              enforce(height != null, 'Height is required.');

              _context23.next = 5;
              return req.wallet.getBlock(height);

            case 5:
              block = _context23.sent;

              if (block) {
                _context23.next = 9;
                break;
              }

              res.send(404);
              return _context23.abrupt('return');

            case 9:

              res.send(200, block.toJSON());

            case 10:
            case 'end':
              return _context23.stop();
          }
        }
      }, _callee23, _this2);
    }));

    return function (_x45, _x46) {
      return _ref23.apply(this, arguments);
    };
  }());

  // Add key
  this.put('/:id/shared-key', function () {
    var _ref24 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee24(req, res) {
      var valid, acct, key;
      return _regenerator2.default.wrap(function _callee24$(_context24) {
        while (1) {
          switch (_context24.prev = _context24.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              key = valid.str('accountKey');


              enforce(key, 'Key is required.');

              _context24.next = 6;
              return req.wallet.addSharedKey(acct, key);

            case 6:

              res.send(200, { success: true });

            case 7:
            case 'end':
              return _context24.stop();
          }
        }
      }, _callee24, _this2);
    }));

    return function (_x47, _x48) {
      return _ref24.apply(this, arguments);
    };
  }());

  // Remove key
  this.del('/:id/shared-key', function () {
    var _ref25 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee25(req, res) {
      var valid, acct, key;
      return _regenerator2.default.wrap(function _callee25$(_context25) {
        while (1) {
          switch (_context25.prev = _context25.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              key = valid.str('accountKey');


              enforce(key, 'Key is required.');

              _context25.next = 6;
              return req.wallet.removeSharedKey(acct, key);

            case 6:

              res.send(200, { success: true });

            case 7:
            case 'end':
              return _context25.stop();
          }
        }
      }, _callee25, _this2);
    }));

    return function (_x49, _x50) {
      return _ref25.apply(this, arguments);
    };
  }());

  // Get key by address
  this.get('/:id/key/:address', function () {
    var _ref26 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee26(req, res) {
      var valid, address, key;
      return _regenerator2.default.wrap(function _callee26$(_context26) {
        while (1) {
          switch (_context26.prev = _context26.next) {
            case 0:
              valid = req.valid();
              address = valid.str('address');


              enforce(address, 'Address is required.');

              _context26.next = 5;
              return req.wallet.getKey(address);

            case 5:
              key = _context26.sent;

              if (key) {
                _context26.next = 9;
                break;
              }

              res.send(404);
              return _context26.abrupt('return');

            case 9:

              res.send(200, key.toJSON());

            case 10:
            case 'end':
              return _context26.stop();
          }
        }
      }, _callee26, _this2);
    }));

    return function (_x51, _x52) {
      return _ref26.apply(this, arguments);
    };
  }());

  // Get private key
  this.get('/:id/wif/:address', function () {
    var _ref27 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee27(req, res) {
      var valid, address, passphrase, key;
      return _regenerator2.default.wrap(function _callee27$(_context27) {
        while (1) {
          switch (_context27.prev = _context27.next) {
            case 0:
              valid = req.valid();
              address = valid.str('address');
              passphrase = valid.str('passphrase');


              enforce(address, 'Address is required.');

              _context27.next = 6;
              return req.wallet.getPrivateKey(address, passphrase);

            case 6:
              key = _context27.sent;

              if (key) {
                _context27.next = 10;
                break;
              }

              res.send(404);
              return _context27.abrupt('return');

            case 10:

              res.send(200, { privateKey: key.toSecret() });

            case 11:
            case 'end':
              return _context27.stop();
          }
        }
      }, _callee27, _this2);
    }));

    return function (_x53, _x54) {
      return _ref27.apply(this, arguments);
    };
  }());

  // Create address
  this.post('/:id/address', function () {
    var _ref28 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee28(req, res) {
      var valid, acct, address;
      return _regenerator2.default.wrap(function _callee28$(_context28) {
        while (1) {
          switch (_context28.prev = _context28.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context28.next = 4;
              return req.wallet.createReceive(acct);

            case 4:
              address = _context28.sent;


              res.send(200, address.toJSON());

            case 6:
            case 'end':
              return _context28.stop();
          }
        }
      }, _callee28, _this2);
    }));

    return function (_x55, _x56) {
      return _ref28.apply(this, arguments);
    };
  }());

  // Create change address
  this.post('/:id/change', function () {
    var _ref29 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee29(req, res) {
      var valid, acct, address;
      return _regenerator2.default.wrap(function _callee29$(_context29) {
        while (1) {
          switch (_context29.prev = _context29.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context29.next = 4;
              return req.wallet.createChange(acct);

            case 4:
              address = _context29.sent;


              res.send(200, address.toJSON());

            case 6:
            case 'end':
              return _context29.stop();
          }
        }
      }, _callee29, _this2);
    }));

    return function (_x57, _x58) {
      return _ref29.apply(this, arguments);
    };
  }());

  // Create nested address
  this.post('/:id/nested', function () {
    var _ref30 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee30(req, res) {
      var valid, acct, address;
      return _regenerator2.default.wrap(function _callee30$(_context30) {
        while (1) {
          switch (_context30.prev = _context30.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context30.next = 4;
              return req.wallet.createNested(acct);

            case 4:
              address = _context30.sent;


              res.send(200, address.toJSON());

            case 6:
            case 'end':
              return _context30.stop();
          }
        }
      }, _callee30, _this2);
    }));

    return function (_x59, _x60) {
      return _ref30.apply(this, arguments);
    };
  }());

  // Wallet Balance
  this.get('/:id/balance', function () {
    var _ref31 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee31(req, res) {
      var valid, acct, balance;
      return _regenerator2.default.wrap(function _callee31$(_context31) {
        while (1) {
          switch (_context31.prev = _context31.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context31.next = 4;
              return req.wallet.getBalance(acct);

            case 4:
              balance = _context31.sent;

              if (balance) {
                _context31.next = 8;
                break;
              }

              res.send(404);
              return _context31.abrupt('return');

            case 8:

              res.send(200, balance.toJSON());

            case 9:
            case 'end':
              return _context31.stop();
          }
        }
      }, _callee31, _this2);
    }));

    return function (_x61, _x62) {
      return _ref31.apply(this, arguments);
    };
  }());

  // Wallet UTXOs
  this.get('/:id/coin', function () {
    var _ref32 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee32(req, res) {
      var valid, acct, coins, result, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, coin;

      return _regenerator2.default.wrap(function _callee32$(_context32) {
        while (1) {
          switch (_context32.prev = _context32.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context32.next = 4;
              return req.wallet.getCoins(acct);

            case 4:
              coins = _context32.sent;
              result = [];


              common.sortCoins(coins);

              _iteratorNormalCompletion3 = true;
              _didIteratorError3 = false;
              _iteratorError3 = undefined;
              _context32.prev = 10;
              for (_iterator3 = (0, _getIterator3.default)(coins); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                coin = _step3.value;

                result.push(coin.getJSON(_this2.network));
              }_context32.next = 18;
              break;

            case 14:
              _context32.prev = 14;
              _context32.t0 = _context32['catch'](10);
              _didIteratorError3 = true;
              _iteratorError3 = _context32.t0;

            case 18:
              _context32.prev = 18;
              _context32.prev = 19;

              if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
              }

            case 21:
              _context32.prev = 21;

              if (!_didIteratorError3) {
                _context32.next = 24;
                break;
              }

              throw _iteratorError3;

            case 24:
              return _context32.finish(21);

            case 25:
              return _context32.finish(18);

            case 26:
              res.send(200, result);

            case 27:
            case 'end':
              return _context32.stop();
          }
        }
      }, _callee32, _this2, [[10, 14, 18, 26], [19,, 21, 25]]);
    }));

    return function (_x63, _x64) {
      return _ref32.apply(this, arguments);
    };
  }());

  // Locked coins
  this.get('/:id/locked', function () {
    var _ref33 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee33(req, res) {
      var locked, result, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, outpoint;

      return _regenerator2.default.wrap(function _callee33$(_context33) {
        while (1) {
          switch (_context33.prev = _context33.next) {
            case 0:
              locked = req.wallet.getLocked();
              result = [];
              _iteratorNormalCompletion4 = true;
              _didIteratorError4 = false;
              _iteratorError4 = undefined;
              _context33.prev = 5;


              for (_iterator4 = (0, _getIterator3.default)(locked); !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                outpoint = _step4.value;

                result.push(outpoint.toJSON());
              }_context33.next = 13;
              break;

            case 9:
              _context33.prev = 9;
              _context33.t0 = _context33['catch'](5);
              _didIteratorError4 = true;
              _iteratorError4 = _context33.t0;

            case 13:
              _context33.prev = 13;
              _context33.prev = 14;

              if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
              }

            case 16:
              _context33.prev = 16;

              if (!_didIteratorError4) {
                _context33.next = 19;
                break;
              }

              throw _iteratorError4;

            case 19:
              return _context33.finish(16);

            case 20:
              return _context33.finish(13);

            case 21:
              res.send(200, result);

            case 22:
            case 'end':
              return _context33.stop();
          }
        }
      }, _callee33, _this2, [[5, 9, 13, 21], [14,, 16, 20]]);
    }));

    return function (_x65, _x66) {
      return _ref33.apply(this, arguments);
    };
  }());

  // Lock coin
  this.put('/:id/locked/:hash/:index', function () {
    var _ref34 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee34(req, res) {
      var valid, hash, index, outpoint;
      return _regenerator2.default.wrap(function _callee34$(_context34) {
        while (1) {
          switch (_context34.prev = _context34.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');
              index = valid.u32('index');


              enforce(hash, 'Hash is required.');
              enforce(index != null, 'Index is required.');

              outpoint = new Outpoint(hash, index);


              req.wallet.lockCoin(outpoint);

              res.send(200, { success: true });

            case 8:
            case 'end':
              return _context34.stop();
          }
        }
      }, _callee34, _this2);
    }));

    return function (_x67, _x68) {
      return _ref34.apply(this, arguments);
    };
  }());

  // Unlock coin
  this.del('/:id/locked/:hash/:index', function () {
    var _ref35 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee35(req, res) {
      var valid, hash, index, outpoint;
      return _regenerator2.default.wrap(function _callee35$(_context35) {
        while (1) {
          switch (_context35.prev = _context35.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');
              index = valid.u32('index');


              enforce(hash, 'Hash is required.');
              enforce(index != null, 'Index is required.');

              outpoint = new Outpoint(hash, index);


              req.wallet.unlockCoin(outpoint);

              res.send(200, { success: true });

            case 8:
            case 'end':
              return _context35.stop();
          }
        }
      }, _callee35, _this2);
    }));

    return function (_x69, _x70) {
      return _ref35.apply(this, arguments);
    };
  }());

  // Wallet Coin
  this.get('/:id/coin/:hash/:index', function () {
    var _ref36 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee36(req, res) {
      var valid, hash, index, coin;
      return _regenerator2.default.wrap(function _callee36$(_context36) {
        while (1) {
          switch (_context36.prev = _context36.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');
              index = valid.u32('index');


              enforce(hash, 'Hash is required.');
              enforce(index != null, 'Index is required.');

              _context36.next = 7;
              return req.wallet.getCoin(hash, index);

            case 7:
              coin = _context36.sent;

              if (coin) {
                _context36.next = 11;
                break;
              }

              res.send(404);
              return _context36.abrupt('return');

            case 11:

              res.send(200, coin.getJSON(_this2.network));

            case 12:
            case 'end':
              return _context36.stop();
          }
        }
      }, _callee36, _this2);
    }));

    return function (_x71, _x72) {
      return _ref36.apply(this, arguments);
    };
  }());

  // Wallet TXs
  this.get('/:id/tx/history', function () {
    var _ref37 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee37(req, res) {
      var valid, acct, txs, details, result, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, item;

      return _regenerator2.default.wrap(function _callee37$(_context37) {
        while (1) {
          switch (_context37.prev = _context37.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context37.next = 4;
              return req.wallet.getHistory(acct);

            case 4:
              txs = _context37.sent;


              common.sortTX(txs);

              _context37.next = 8;
              return req.wallet.toDetails(txs);

            case 8:
              details = _context37.sent;
              result = [];
              _iteratorNormalCompletion5 = true;
              _didIteratorError5 = false;
              _iteratorError5 = undefined;
              _context37.prev = 13;


              for (_iterator5 = (0, _getIterator3.default)(details); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                item = _step5.value;

                result.push(item.toJSON());
              }_context37.next = 21;
              break;

            case 17:
              _context37.prev = 17;
              _context37.t0 = _context37['catch'](13);
              _didIteratorError5 = true;
              _iteratorError5 = _context37.t0;

            case 21:
              _context37.prev = 21;
              _context37.prev = 22;

              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
              }

            case 24:
              _context37.prev = 24;

              if (!_didIteratorError5) {
                _context37.next = 27;
                break;
              }

              throw _iteratorError5;

            case 27:
              return _context37.finish(24);

            case 28:
              return _context37.finish(21);

            case 29:
              res.send(200, result);

            case 30:
            case 'end':
              return _context37.stop();
          }
        }
      }, _callee37, _this2, [[13, 17, 21, 29], [22,, 24, 28]]);
    }));

    return function (_x73, _x74) {
      return _ref37.apply(this, arguments);
    };
  }());

  // Wallet Pending TXs
  this.get('/:id/tx/unconfirmed', function () {
    var _ref38 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee38(req, res) {
      var valid, acct, txs, details, result, _iteratorNormalCompletion6, _didIteratorError6, _iteratorError6, _iterator6, _step6, item;

      return _regenerator2.default.wrap(function _callee38$(_context38) {
        while (1) {
          switch (_context38.prev = _context38.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              _context38.next = 4;
              return req.wallet.getPending(acct);

            case 4:
              txs = _context38.sent;


              common.sortTX(txs);

              _context38.next = 8;
              return req.wallet.toDetails(txs);

            case 8:
              details = _context38.sent;
              result = [];
              _iteratorNormalCompletion6 = true;
              _didIteratorError6 = false;
              _iteratorError6 = undefined;
              _context38.prev = 13;


              for (_iterator6 = (0, _getIterator3.default)(details); !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
                item = _step6.value;

                result.push(item.toJSON());
              }_context38.next = 21;
              break;

            case 17:
              _context38.prev = 17;
              _context38.t0 = _context38['catch'](13);
              _didIteratorError6 = true;
              _iteratorError6 = _context38.t0;

            case 21:
              _context38.prev = 21;
              _context38.prev = 22;

              if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
              }

            case 24:
              _context38.prev = 24;

              if (!_didIteratorError6) {
                _context38.next = 27;
                break;
              }

              throw _iteratorError6;

            case 27:
              return _context38.finish(24);

            case 28:
              return _context38.finish(21);

            case 29:
              res.send(200, result);

            case 30:
            case 'end':
              return _context38.stop();
          }
        }
      }, _callee38, _this2, [[13, 17, 21, 29], [22,, 24, 28]]);
    }));

    return function (_x75, _x76) {
      return _ref38.apply(this, arguments);
    };
  }());

  // Wallet TXs within time range
  this.get('/:id/tx/range', function () {
    var _ref39 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee39(req, res) {
      var valid, acct, options, txs, details, result, _iteratorNormalCompletion7, _didIteratorError7, _iteratorError7, _iterator7, _step7, item;

      return _regenerator2.default.wrap(function _callee39$(_context39) {
        while (1) {
          switch (_context39.prev = _context39.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              options = {
                start: valid.u32('start'),
                end: valid.u32('end'),
                limit: valid.u32('limit'),
                reverse: valid.bool('reverse')
              };
              _context39.next = 5;
              return req.wallet.getRange(acct, options);

            case 5:
              txs = _context39.sent;
              _context39.next = 8;
              return req.wallet.toDetails(txs);

            case 8:
              details = _context39.sent;
              result = [];
              _iteratorNormalCompletion7 = true;
              _didIteratorError7 = false;
              _iteratorError7 = undefined;
              _context39.prev = 13;


              for (_iterator7 = (0, _getIterator3.default)(details); !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                item = _step7.value;

                result.push(item.toJSON());
              }_context39.next = 21;
              break;

            case 17:
              _context39.prev = 17;
              _context39.t0 = _context39['catch'](13);
              _didIteratorError7 = true;
              _iteratorError7 = _context39.t0;

            case 21:
              _context39.prev = 21;
              _context39.prev = 22;

              if (!_iteratorNormalCompletion7 && _iterator7.return) {
                _iterator7.return();
              }

            case 24:
              _context39.prev = 24;

              if (!_didIteratorError7) {
                _context39.next = 27;
                break;
              }

              throw _iteratorError7;

            case 27:
              return _context39.finish(24);

            case 28:
              return _context39.finish(21);

            case 29:
              res.send(200, result);

            case 30:
            case 'end':
              return _context39.stop();
          }
        }
      }, _callee39, _this2, [[13, 17, 21, 29], [22,, 24, 28]]);
    }));

    return function (_x77, _x78) {
      return _ref39.apply(this, arguments);
    };
  }());

  // Last Wallet TXs
  this.get('/:id/tx/last', function () {
    var _ref40 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee40(req, res) {
      var valid, acct, limit, txs, details, result, _iteratorNormalCompletion8, _didIteratorError8, _iteratorError8, _iterator8, _step8, item;

      return _regenerator2.default.wrap(function _callee40$(_context40) {
        while (1) {
          switch (_context40.prev = _context40.next) {
            case 0:
              valid = req.valid();
              acct = valid.str('account');
              limit = valid.u32('limit');
              _context40.next = 5;
              return req.wallet.getLast(acct, limit);

            case 5:
              txs = _context40.sent;
              _context40.next = 8;
              return req.wallet.toDetails(txs);

            case 8:
              details = _context40.sent;
              result = [];
              _iteratorNormalCompletion8 = true;
              _didIteratorError8 = false;
              _iteratorError8 = undefined;
              _context40.prev = 13;


              for (_iterator8 = (0, _getIterator3.default)(details); !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
                item = _step8.value;

                result.push(item.toJSON());
              }_context40.next = 21;
              break;

            case 17:
              _context40.prev = 17;
              _context40.t0 = _context40['catch'](13);
              _didIteratorError8 = true;
              _iteratorError8 = _context40.t0;

            case 21:
              _context40.prev = 21;
              _context40.prev = 22;

              if (!_iteratorNormalCompletion8 && _iterator8.return) {
                _iterator8.return();
              }

            case 24:
              _context40.prev = 24;

              if (!_didIteratorError8) {
                _context40.next = 27;
                break;
              }

              throw _iteratorError8;

            case 27:
              return _context40.finish(24);

            case 28:
              return _context40.finish(21);

            case 29:
              res.send(200, result);

            case 30:
            case 'end':
              return _context40.stop();
          }
        }
      }, _callee40, _this2, [[13, 17, 21, 29], [22,, 24, 28]]);
    }));

    return function (_x79, _x80) {
      return _ref40.apply(this, arguments);
    };
  }());

  // Wallet TX
  this.get('/:id/tx/:hash', function () {
    var _ref41 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee41(req, res) {
      var valid, hash, tx, details;
      return _regenerator2.default.wrap(function _callee41$(_context41) {
        while (1) {
          switch (_context41.prev = _context41.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');


              enforce(hash, 'Hash is required.');

              _context41.next = 5;
              return req.wallet.getTX(hash);

            case 5:
              tx = _context41.sent;

              if (tx) {
                _context41.next = 9;
                break;
              }

              res.send(404);
              return _context41.abrupt('return');

            case 9:
              _context41.next = 11;
              return req.wallet.toDetails(tx);

            case 11:
              details = _context41.sent;


              res.send(200, details.toJSON());

            case 13:
            case 'end':
              return _context41.stop();
          }
        }
      }, _callee41, _this2);
    }));

    return function (_x81, _x82) {
      return _ref41.apply(this, arguments);
    };
  }());

  // Resend
  this.post('/:id/resend', function () {
    var _ref42 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee42(req, res) {
      return _regenerator2.default.wrap(function _callee42$(_context42) {
        while (1) {
          switch (_context42.prev = _context42.next) {
            case 0:
              _context42.next = 2;
              return req.wallet.resend();

            case 2:
              res.send(200, { success: true });

            case 3:
            case 'end':
              return _context42.stop();
          }
        }
      }, _callee42, _this2);
    }));

    return function (_x83, _x84) {
      return _ref42.apply(this, arguments);
    };
  }());
};

/**
 * Initialize websockets.
 * @private
 */

HTTPServer.prototype.initSockets = function initSockets() {
  var _this3 = this;

  if (!this.io) return;

  this.on('socket', function (socket) {
    _this3.handleSocket(socket);
  });

  this.walletdb.on('tx', function (id, tx, details) {
    var json = details.toJSON();
    _this3.to('w:' + id, 'wallet tx', json);
  });

  this.walletdb.on('confirmed', function (id, tx, details) {
    var json = details.toJSON();
    _this3.to('w:' + id, 'wallet confirmed', json);
  });

  this.walletdb.on('unconfirmed', function (id, tx, details) {
    var json = details.toJSON();
    _this3.to('w:' + id, 'wallet unconfirmed', json);
  });

  this.walletdb.on('conflict', function (id, tx, details) {
    var json = details.toJSON();
    _this3.to('w:' + id, 'wallet conflict', json);
  });

  this.walletdb.on('balance', function (id, balance) {
    var json = balance.toJSON();
    _this3.to('w:' + id, 'wallet balance', json);
  });

  this.walletdb.on('address', function (id, receive) {
    var json = [];

    var _iteratorNormalCompletion9 = true;
    var _didIteratorError9 = false;
    var _iteratorError9 = undefined;

    try {
      for (var _iterator9 = (0, _getIterator3.default)(receive), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
        var addr = _step9.value;

        json.push(addr.toJSON());
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

    _this3.to('w:' + id, 'wallet address', json);
  });
};

/**
 * Handle new websocket.
 * @private
 * @param {WebSocket} socket
 */

HTTPServer.prototype.handleSocket = function handleSocket(socket) {
  var _this4 = this;

  socket.hook('wallet auth', function (args) {
    if (socket.auth) throw new Error('Already authed.');

    if (!_this4.options.noAuth) {
      var valid = new Validator([args]);
      var key = valid.str(0, '');

      if (key.length > 255) throw new Error('Invalid API key.');

      var data = Buffer.from(key, 'utf8');
      var hash = digest.hash256(data);

      if (!ccmp(hash, _this4.options.apiHash)) throw new Error('Invalid API key.');
    }

    socket.auth = true;

    _this4.logger.info('Successful auth from %s.', socket.remoteAddress);

    _this4.handleAuth(socket);

    return null;
  });
};

/**
 * Handle new auth'd websocket.
 * @private
 * @param {WebSocket} socket
 */

HTTPServer.prototype.handleAuth = function handleAuth(socket) {
  var _this5 = this;

  socket.hook('wallet join', function () {
    var _ref43 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee43(args) {
      var valid, id, token, wallet;
      return _regenerator2.default.wrap(function _callee43$(_context43) {
        while (1) {
          switch (_context43.prev = _context43.next) {
            case 0:
              valid = new Validator([args]);
              id = valid.str(0, '');
              token = valid.buf(1);

              if (id) {
                _context43.next = 5;
                break;
              }

              throw new Error('Invalid parameter.');

            case 5:
              if (_this5.options.walletAuth) {
                _context43.next = 8;
                break;
              }

              socket.join('w:' + id);
              return _context43.abrupt('return', null);

            case 8:
              if (token) {
                _context43.next = 10;
                break;
              }

              throw new Error('Invalid parameter.');

            case 10:
              wallet = void 0;
              _context43.prev = 11;
              _context43.next = 14;
              return _this5.walletdb.auth(id, token);

            case 14:
              wallet = _context43.sent;
              _context43.next = 21;
              break;

            case 17:
              _context43.prev = 17;
              _context43.t0 = _context43['catch'](11);

              _this5.logger.info('Wallet auth failure for %s: %s.', id, _context43.t0.message);
              throw new Error('Bad token.');

            case 21:
              if (wallet) {
                _context43.next = 23;
                break;
              }

              throw new Error('Wallet does not exist.');

            case 23:

              _this5.logger.info('Successful wallet auth for %s.', id);

              socket.join('w:' + id);

              return _context43.abrupt('return', null);

            case 26:
            case 'end':
              return _context43.stop();
          }
        }
      }, _callee43, _this5, [[11, 17]]);
    }));

    return function (_x85) {
      return _ref43.apply(this, arguments);
    };
  }());

  socket.hook('wallet leave', function (args) {
    var valid = new Validator([args]);
    var id = valid.str(0, '');

    if (!id) throw new Error('Invalid parameter.');

    socket.leave('w:' + id);

    return null;
  });
};

/**
 * HTTPOptions
 * @alias module:http.HTTPOptions
 * @constructor
 * @param {Object} options
 */

function HTTPOptions(options) {
  if (!(this instanceof HTTPOptions)) return new HTTPOptions(options);

  this.network = Network.primary;
  this.logger = null;
  this.walletdb = null;
  this.apiKey = base58.encode(random.randomBytes(20));
  this.apiHash = digest.hash256(Buffer.from(this.apiKey, 'ascii'));
  this.serviceHash = this.apiHash;
  this.noAuth = false;
  this.walletAuth = false;

  this.prefix = null;
  this.host = '127.0.0.1';
  this.port = 8080;
  this.ssl = false;
  this.keyFile = null;
  this.certFile = null;

  this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {HTTPOptions}
 */

HTTPOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options);
  assert(options.walletdb && (0, _typeof3.default)(options.walletdb) === 'object', 'HTTP Server requires a WalletDB.');

  this.walletdb = options.walletdb;
  this.network = options.walletdb.network;
  this.logger = options.walletdb.logger;
  this.port = this.network.rpcPort + 2;

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.apiKey != null) {
    assert(typeof options.apiKey === 'string', 'API key must be a string.');
    assert(options.apiKey.length <= 255, 'API key must be under 255 bytes.');
    assert(util.isAscii(options.apiKey), 'API key must be ASCII.');
    this.apiKey = options.apiKey;
    this.apiHash = digest.hash256(Buffer.from(this.apiKey, 'ascii'));
  }

  if (options.noAuth != null) {
    assert(typeof options.noAuth === 'boolean');
    this.noAuth = options.noAuth;
  }

  if (options.walletAuth != null) {
    assert(typeof options.walletAuth === 'boolean');
    this.walletAuth = options.walletAuth;
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
    this.keyFile = path.join(this.prefix, 'key.pem');
    this.certFile = path.join(this.prefix, 'cert.pem');
  }

  if (options.host != null) {
    assert(typeof options.host === 'string');
    this.host = options.host;
  }

  if (options.port != null) {
    assert(util.isU16(options.port), 'Port must be a number.');
    this.port = options.port;
  }

  if (options.ssl != null) {
    assert(typeof options.ssl === 'boolean');
    this.ssl = options.ssl;
  }

  if (options.keyFile != null) {
    assert(typeof options.keyFile === 'string');
    this.keyFile = options.keyFile;
  }

  if (options.certFile != null) {
    assert(typeof options.certFile === 'string');
    this.certFile = options.certFile;
  }

  // Allow no-auth implicitly
  // if we're listening locally.
  if (!options.apiKey) {
    if (this.host === '127.0.0.1' || this.host === '::1') this.noAuth = true;
  }

  return this;
};

/**
 * Instantiate http options from object.
 * @param {Object} options
 * @returns {HTTPOptions}
 */

HTTPOptions.fromOptions = function fromOptions(options) {
  return new HTTPOptions().fromOptions(options);
};

/*
 * Helpers
 */

function enforce(value, msg) {
  if (!value) {
    var err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

/*
 * Expose
 */

module.exports = HTTPServer;