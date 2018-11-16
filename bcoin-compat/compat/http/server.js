/*!
 * server.js - http server for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

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
var HTTPBase = require('./base');
var util = require('../utils/util');
var base58 = require('../utils/base58');
var Bloom = require('../utils/bloom');
var TX = require('../primitives/tx');
var Outpoint = require('../primitives/outpoint');
var digest = require('../crypto/digest');
var random = require('../crypto/random');
var ccmp = require('../crypto/ccmp');
var Network = require('../protocol/network');
var Validator = require('../utils/validator');
var pkg = require('../pkg');

/**
 * HTTPServer
 * @alias module:http.Server
 * @constructor
 * @param {Object} options
 * @param {Fullnode} options.node
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
  this.node = this.options.node;

  this.chain = this.node.chain;
  this.mempool = this.node.mempool;
  this.pool = this.node.pool;
  this.fees = this.node.fees;
  this.miner = this.node.miner;
  this.rpc = this.node.rpc;

  this.init();
}

(0, _setPrototypeOf2.default)(HTTPServer.prototype, HTTPBase.prototype);

/**
 * Initialize routes.
 * @private
 */

HTTPServer.prototype.init = function init() {
  var _this = this;

  this.on('request', function (req, res) {
    if (req.method === 'POST' && req.pathname === '/') return;

    _this.logger.debug('Request for method=%s path=%s (%s).', req.method, req.pathname, req.socket.remoteAddress);
  });

  this.on('listening', function (address) {
    _this.logger.info('Node HTTP server listening on %s (port=%d).', address.address, address.port);
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
      realm: 'node'
    }));
  }

  this.use(this.bodyParser({
    contentType: 'json'
  }));

  this.use(this.jsonRPC(this.rpc));

  this.get('/', function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(req, res) {
      var totalTX, size, addr;
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              totalTX = _this2.mempool ? _this2.mempool.map.size : 0;
              size = _this2.mempool ? _this2.mempool.getSize() : 0;
              addr = _this2.pool.hosts.getLocal();


              if (!addr) addr = _this2.pool.hosts.address;

              res.send(200, {
                version: pkg.version,
                network: _this2.network.type,
                chain: {
                  height: _this2.chain.height,
                  tip: _this2.chain.tip.rhash(),
                  progress: _this2.chain.getProgress()
                },
                pool: {
                  host: addr.host,
                  port: addr.port,
                  agent: _this2.pool.options.agent,
                  services: _this2.pool.options.services.toString(2),
                  outbound: _this2.pool.peers.outbound,
                  inbound: _this2.pool.peers.inbound
                },
                mempool: {
                  tx: totalTX,
                  size: size
                },
                time: {
                  uptime: _this2.node.uptime(),
                  system: util.now(),
                  adjusted: _this2.network.now(),
                  offset: _this2.network.time.offset
                },
                memory: util.memoryUsage()
              });

            case 5:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this2);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());

  // UTXO by address
  this.get('/coin/address/:address', function () {
    var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(req, res) {
      var valid, address, coins, result, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, coin;

      return _regenerator2.default.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              valid = req.valid();
              address = valid.str('address');


              enforce(address, 'Address is required.');
              enforce(!_this2.chain.options.spv, 'Cannot get coins in SPV mode.');

              _context2.next = 6;
              return _this2.node.getCoinsByAddress(address);

            case 6:
              coins = _context2.sent;
              result = [];
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context2.prev = 11;


              for (_iterator = (0, _getIterator3.default)(coins); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                coin = _step.value;

                result.push(coin.getJSON(_this2.network));
              }_context2.next = 19;
              break;

            case 15:
              _context2.prev = 15;
              _context2.t0 = _context2['catch'](11);
              _didIteratorError = true;
              _iteratorError = _context2.t0;

            case 19:
              _context2.prev = 19;
              _context2.prev = 20;

              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }

            case 22:
              _context2.prev = 22;

              if (!_didIteratorError) {
                _context2.next = 25;
                break;
              }

              throw _iteratorError;

            case 25:
              return _context2.finish(22);

            case 26:
              return _context2.finish(19);

            case 27:
              res.send(200, result);

            case 28:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this2, [[11, 15, 19, 27], [20,, 22, 26]]);
    }));

    return function (_x3, _x4) {
      return _ref2.apply(this, arguments);
    };
  }());

  // UTXO by id
  this.get('/coin/:hash/:index', function () {
    var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(req, res) {
      var valid, hash, index, coin;
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');
              index = valid.u32('index');


              enforce(hash, 'Hash is required.');
              enforce(index != null, 'Index is required.');
              enforce(!_this2.chain.options.spv, 'Cannot get coins in SPV mode.');

              _context3.next = 8;
              return _this2.node.getCoin(hash, index);

            case 8:
              coin = _context3.sent;

              if (coin) {
                _context3.next = 12;
                break;
              }

              res.send(404);
              return _context3.abrupt('return');

            case 12:

              res.send(200, coin.getJSON(_this2.network));

            case 13:
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

  // Bulk read UTXOs
  this.post('/coin/address', function () {
    var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(req, res) {
      var valid, address, coins, result, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, coin;

      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              valid = req.valid();
              address = valid.array('addresses');


              enforce(address, 'Address is required.');
              enforce(!_this2.chain.options.spv, 'Cannot get coins in SPV mode.');

              _context4.next = 6;
              return _this2.node.getCoinsByAddress(address);

            case 6:
              coins = _context4.sent;
              result = [];
              _iteratorNormalCompletion2 = true;
              _didIteratorError2 = false;
              _iteratorError2 = undefined;
              _context4.prev = 11;


              for (_iterator2 = (0, _getIterator3.default)(coins); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                coin = _step2.value;

                result.push(coin.getJSON(_this2.network));
              }_context4.next = 19;
              break;

            case 15:
              _context4.prev = 15;
              _context4.t0 = _context4['catch'](11);
              _didIteratorError2 = true;
              _iteratorError2 = _context4.t0;

            case 19:
              _context4.prev = 19;
              _context4.prev = 20;

              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }

            case 22:
              _context4.prev = 22;

              if (!_didIteratorError2) {
                _context4.next = 25;
                break;
              }

              throw _iteratorError2;

            case 25:
              return _context4.finish(22);

            case 26:
              return _context4.finish(19);

            case 27:
              res.send(200, result);

            case 28:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this2, [[11, 15, 19, 27], [20,, 22, 26]]);
    }));

    return function (_x7, _x8) {
      return _ref4.apply(this, arguments);
    };
  }());

  // TX by hash
  this.get('/tx/:hash', function () {
    var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(req, res) {
      var valid, hash, meta, view;
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              valid = req.valid();
              hash = valid.hash('hash');


              enforce(hash, 'Hash is required.');
              enforce(!_this2.chain.options.spv, 'Cannot get TX in SPV mode.');

              _context5.next = 6;
              return _this2.node.getMeta(hash);

            case 6:
              meta = _context5.sent;

              if (meta) {
                _context5.next = 10;
                break;
              }

              res.send(404);
              return _context5.abrupt('return');

            case 10:
              _context5.next = 12;
              return _this2.node.getMetaView(meta);

            case 12:
              view = _context5.sent;


              res.send(200, meta.getJSON(_this2.network, view, _this2.chain.height));

            case 14:
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

  // TX by address
  this.get('/tx/address/:address', function () {
    var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(req, res) {
      var valid, address, metas, result, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, meta, view;

      return _regenerator2.default.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              valid = req.valid();
              address = valid.str('address');


              enforce(address, 'Address is required.');
              enforce(!_this2.chain.options.spv, 'Cannot get TX in SPV mode.');

              _context6.next = 6;
              return _this2.node.getMetaByAddress(address);

            case 6:
              metas = _context6.sent;
              result = [];
              _iteratorNormalCompletion3 = true;
              _didIteratorError3 = false;
              _iteratorError3 = undefined;
              _context6.prev = 11;
              _iterator3 = (0, _getIterator3.default)(metas);

            case 13:
              if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
                _context6.next = 22;
                break;
              }

              meta = _step3.value;
              _context6.next = 17;
              return _this2.node.getMetaView(meta);

            case 17:
              view = _context6.sent;

              result.push(meta.getJSON(_this2.network, view, _this2.chain.height));

            case 19:
              _iteratorNormalCompletion3 = true;
              _context6.next = 13;
              break;

            case 22:
              _context6.next = 28;
              break;

            case 24:
              _context6.prev = 24;
              _context6.t0 = _context6['catch'](11);
              _didIteratorError3 = true;
              _iteratorError3 = _context6.t0;

            case 28:
              _context6.prev = 28;
              _context6.prev = 29;

              if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
              }

            case 31:
              _context6.prev = 31;

              if (!_didIteratorError3) {
                _context6.next = 34;
                break;
              }

              throw _iteratorError3;

            case 34:
              return _context6.finish(31);

            case 35:
              return _context6.finish(28);

            case 36:

              res.send(200, result);

            case 37:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, _this2, [[11, 24, 28, 36], [29,, 31, 35]]);
    }));

    return function (_x11, _x12) {
      return _ref6.apply(this, arguments);
    };
  }());

  // Bulk read TXs
  this.post('/tx/address', function () {
    var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(req, res) {
      var valid, address, metas, result, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, meta, view;

      return _regenerator2.default.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              valid = req.valid();
              address = valid.array('addresses');


              enforce(address, 'Address is required.');
              enforce(!_this2.chain.options.spv, 'Cannot get TX in SPV mode.');

              _context7.next = 6;
              return _this2.node.getMetaByAddress(address);

            case 6:
              metas = _context7.sent;
              result = [];
              _iteratorNormalCompletion4 = true;
              _didIteratorError4 = false;
              _iteratorError4 = undefined;
              _context7.prev = 11;
              _iterator4 = (0, _getIterator3.default)(metas);

            case 13:
              if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                _context7.next = 22;
                break;
              }

              meta = _step4.value;
              _context7.next = 17;
              return _this2.node.getMetaView(meta);

            case 17:
              view = _context7.sent;

              result.push(meta.getJSON(_this2.network, view, _this2.chain.height));

            case 19:
              _iteratorNormalCompletion4 = true;
              _context7.next = 13;
              break;

            case 22:
              _context7.next = 28;
              break;

            case 24:
              _context7.prev = 24;
              _context7.t0 = _context7['catch'](11);
              _didIteratorError4 = true;
              _iteratorError4 = _context7.t0;

            case 28:
              _context7.prev = 28;
              _context7.prev = 29;

              if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
              }

            case 31:
              _context7.prev = 31;

              if (!_didIteratorError4) {
                _context7.next = 34;
                break;
              }

              throw _iteratorError4;

            case 34:
              return _context7.finish(31);

            case 35:
              return _context7.finish(28);

            case 36:

              res.send(200, result);

            case 37:
            case 'end':
              return _context7.stop();
          }
        }
      }, _callee7, _this2, [[11, 24, 28, 36], [29,, 31, 35]]);
    }));

    return function (_x13, _x14) {
      return _ref7.apply(this, arguments);
    };
  }());

  // Block by hash/height
  this.get('/block/:block', function () {
    var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(req, res) {
      var valid, hash, block, view, height, confirmations;
      return _regenerator2.default.wrap(function _callee8$(_context8) {
        while (1) {
          switch (_context8.prev = _context8.next) {
            case 0:
              valid = req.valid();
              hash = valid.get('block');


              enforce(typeof hash === 'string', 'Hash or height required.');
              enforce(!_this2.chain.options.spv, 'Cannot get block in SPV mode.');

              if (hash.length === 64) hash = util.revHex(hash);else hash = parseInt(hash, 10);

              _context8.next = 7;
              return _this2.chain.getBlock(hash);

            case 7:
              block = _context8.sent;

              if (block) {
                _context8.next = 11;
                break;
              }

              res.send(404);
              return _context8.abrupt('return');

            case 11:
              _context8.next = 13;
              return _this2.chain.getBlockView(block);

            case 13:
              view = _context8.sent;

              if (view) {
                _context8.next = 17;
                break;
              }

              res.send(404);
              return _context8.abrupt('return');

            case 17:
              _context8.next = 19;
              return _this2.chain.getHeight(hash);

            case 19:
              height = _context8.sent;
              confirmations = _this2.chain.height - height;


              res.send(200, block.getJSON(_this2.network, view, height, confirmations));

            case 22:
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

  // Mempool snapshot
  this.get('/mempool', function () {
    var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(req, res) {
      var hashes, result, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, hash;

      return _regenerator2.default.wrap(function _callee9$(_context9) {
        while (1) {
          switch (_context9.prev = _context9.next) {
            case 0:
              enforce(_this2.mempool, 'No mempool available.');

              hashes = _this2.mempool.getSnapshot();
              result = [];
              _iteratorNormalCompletion5 = true;
              _didIteratorError5 = false;
              _iteratorError5 = undefined;
              _context9.prev = 6;


              for (_iterator5 = (0, _getIterator3.default)(hashes); !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                hash = _step5.value;

                result.push(util.revHex(hash));
              }_context9.next = 14;
              break;

            case 10:
              _context9.prev = 10;
              _context9.t0 = _context9['catch'](6);
              _didIteratorError5 = true;
              _iteratorError5 = _context9.t0;

            case 14:
              _context9.prev = 14;
              _context9.prev = 15;

              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
              }

            case 17:
              _context9.prev = 17;

              if (!_didIteratorError5) {
                _context9.next = 20;
                break;
              }

              throw _iteratorError5;

            case 20:
              return _context9.finish(17);

            case 21:
              return _context9.finish(14);

            case 22:
              res.send(200, result);

            case 23:
            case 'end':
              return _context9.stop();
          }
        }
      }, _callee9, _this2, [[6, 10, 14, 22], [15,, 17, 21]]);
    }));

    return function (_x17, _x18) {
      return _ref9.apply(this, arguments);
    };
  }());

  // Broadcast TX
  this.post('/broadcast', function () {
    var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(req, res) {
      var valid, raw, tx;
      return _regenerator2.default.wrap(function _callee10$(_context10) {
        while (1) {
          switch (_context10.prev = _context10.next) {
            case 0:
              valid = req.valid();
              raw = valid.buf('tx');


              enforce(raw, 'TX is required.');

              tx = TX.fromRaw(raw);
              _context10.next = 6;
              return _this2.node.sendTX(tx);

            case 6:

              res.send(200, { success: true });

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

  // Estimate fee
  this.get('/fee', function () {
    var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(req, res) {
      var valid, blocks, fee;
      return _regenerator2.default.wrap(function _callee11$(_context11) {
        while (1) {
          switch (_context11.prev = _context11.next) {
            case 0:
              valid = req.valid();
              blocks = valid.u32('blocks');

              if (_this2.fees) {
                _context11.next = 5;
                break;
              }

              res.send(200, { rate: _this2.network.feeRate });
              return _context11.abrupt('return');

            case 5:
              fee = _this2.fees.estimateFee(blocks);


              res.send(200, { rate: fee });

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

  // Reset chain
  this.post('/reset', function () {
    var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(req, res) {
      var valid, height;
      return _regenerator2.default.wrap(function _callee12$(_context12) {
        while (1) {
          switch (_context12.prev = _context12.next) {
            case 0:
              valid = req.valid();
              height = valid.u32('height');


              enforce(height != null, 'Height is required.');

              _context12.next = 5;
              return _this2.chain.reset(height);

            case 5:

              res.send(200, { success: true });

            case 6:
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
};

/**
 * Handle new websocket.
 * @private
 * @param {WebSocket} socket
 */

HTTPServer.prototype.handleSocket = function handleSocket(socket) {
  var _this4 = this;

  socket.hook('auth', function (args) {
    if (socket.auth) throw new Error('Already authed.');

    if (!_this4.options.noAuth) {
      var valid = new Validator([args]);
      var key = valid.str(0, '');

      if (key.length > 255) throw new Error('Invalid API key.');

      var data = Buffer.from(key, 'ascii');
      var hash = digest.hash256(data);

      if (!ccmp(hash, _this4.options.apiHash)) throw new Error('Invalid API key.');
    }

    socket.auth = true;

    _this4.logger.info('Successful auth from %s.', socket.remoteAddress);
    _this4.handleAuth(socket);

    return null;
  });

  socket.emit('version', {
    version: pkg.version,
    network: this.network.type
  });
};

/**
 * Handle new auth'd websocket.
 * @private
 * @param {WebSocket} socket
 */

HTTPServer.prototype.handleAuth = function handleAuth(socket) {
  var _this5 = this;

  socket.hook('watch chain', function (args) {
    socket.join('chain');
    return null;
  });

  socket.hook('unwatch chain', function (args) {
    socket.leave('chain');
    return null;
  });

  socket.hook('watch mempool', function (args) {
    socket.join('mempool');
    return null;
  });

  socket.hook('unwatch mempool', function (args) {
    socket.leave('mempool');
    return null;
  });

  socket.hook('set filter', function (args) {
    var valid = new Validator([args]);
    var data = valid.buf(0);

    if (!data) throw new Error('Invalid parameter.');

    socket.filter = Bloom.fromRaw(data);

    return null;
  });

  socket.hook('get tip', function (args) {
    return _this5.chain.tip.toRaw();
  });

  socket.hook('get entry', function () {
    var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(args) {
      var valid, block, entry;
      return _regenerator2.default.wrap(function _callee13$(_context13) {
        while (1) {
          switch (_context13.prev = _context13.next) {
            case 0:
              valid = new Validator([args]);
              block = valid.numhash(0);

              if (!(block == null)) {
                _context13.next = 4;
                break;
              }

              throw new Error('Invalid parameter.');

            case 4:
              _context13.next = 6;
              return _this5.chain.getEntry(block);

            case 6:
              entry = _context13.sent;

              if (entry) {
                _context13.next = 9;
                break;
              }

              return _context13.abrupt('return', null);

            case 9:
              _context13.next = 11;
              return _this5.chain.isMainChain(entry);

            case 11:
              if (_context13.sent) {
                _context13.next = 13;
                break;
              }

              return _context13.abrupt('return', null);

            case 13:
              return _context13.abrupt('return', entry.toRaw());

            case 14:
            case 'end':
              return _context13.stop();
          }
        }
      }, _callee13, _this5);
    }));

    return function (_x25) {
      return _ref13.apply(this, arguments);
    };
  }());

  socket.hook('add filter', function (args) {
    var valid = new Validator([args]);
    var chunks = valid.array(0);

    if (!chunks) throw new Error('Invalid parameter.');

    if (!socket.filter) throw new Error('No filter set.');

    var items = new Validator([chunks]);

    for (var i = 0; i < chunks.length; i++) {
      var data = items.buf(i);

      if (!data) throw new Error('Bad data chunk.');

      _this5.filter.add(data);

      if (_this5.node.spv) _this5.pool.watch(data);
    }

    return null;
  });

  socket.hook('reset filter', function (args) {
    socket.filter = null;
    return null;
  });

  socket.hook('estimate fee', function (args) {
    var valid = new Validator([args]);
    var blocks = valid.u32(0);

    if (!_this5.fees) return _this5.network.feeRate;

    return _this5.fees.estimateFee(blocks);
  });

  socket.hook('send', function (args) {
    var valid = new Validator([args]);
    var data = valid.buf(0);

    if (!data) throw new Error('Invalid parameter.');

    var tx = TX.fromRaw(data);

    _this5.node.send(tx);

    return null;
  });

  socket.hook('rescan', function (args) {
    var valid = new Validator([args]);
    var start = valid.numhash(0);

    if (start == null) throw new Error('Invalid parameter.');

    return _this5.scan(socket, start);
  });

  this.bindChain();
};

/**
 * Bind to chain events.
 * @private
 */

HTTPServer.prototype.bindChain = function bindChain() {
  var _this6 = this;

  var pool = this.mempool || this.pool;

  this.chain.on('connect', function (entry, block, view) {
    var list = _this6.channel('chain');

    if (!list) return;

    var raw = entry.toRaw();

    _this6.to('chain', 'chain connect', raw);

    for (var item = list.head; item; item = item.next) {
      var socket = item.value;
      var txs = _this6.filterBlock(socket, block);
      socket.emit('block connect', raw, txs);
    }
  });

  this.chain.on('disconnect', function (entry, block, view) {
    var list = _this6.channel('chain');

    if (!list) return;

    var raw = entry.toRaw();

    _this6.to('chain', 'chain disconnect', raw);
    _this6.to('chain', 'block disconnect', raw);
  });

  this.chain.on('reset', function (tip) {
    var list = _this6.channel('chain');

    if (!list) return;

    var raw = tip.toRaw();

    _this6.to('chain', 'chain reset', raw);
  });

  pool.on('tx', function (tx) {
    var list = _this6.channel('mempool');

    if (!list) return;

    var raw = tx.toRaw();

    for (var item = list.head; item; item = item.next) {
      var socket = item.value;

      if (!_this6.filterTX(socket, tx)) continue;

      socket.emit('tx', raw);
    }
  });
};

/**
 * Filter block by socket.
 * @private
 * @param {WebSocket} socket
 * @param {Block} block
 * @returns {TX[]}
 */

HTTPServer.prototype.filterBlock = function filterBlock(socket, block) {
  if (!socket.filter) return [];

  var txs = [];

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(block.txs), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var tx = _step6.value;

      if (this.filterTX(socket, tx)) txs.push(tx.toRaw());
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

  return txs;
};

/**
 * Filter transaction by socket.
 * @private
 * @param {WebSocket} socket
 * @param {TX} tx
 * @returns {Boolean}
 */

HTTPServer.prototype.filterTX = function filterTX(socket, tx) {
  if (!socket.filter) return false;

  var found = false;

  for (var i = 0; i < tx.outputs.length; i++) {
    var output = tx.outputs[i];
    var hash = output.getHash();

    if (!hash) continue;

    if (socket.filter.test(hash)) {
      var prevout = Outpoint.fromTX(tx, i);
      socket.filter.add(prevout.toRaw());
      found = true;
    }
  }

  if (found) return true;

  if (!tx.isCoinbase()) {
    var _iteratorNormalCompletion7 = true;
    var _didIteratorError7 = false;
    var _iteratorError7 = undefined;

    try {
      for (var _iterator7 = (0, _getIterator3.default)(tx.inputs), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
        var _ref14 = _step7.value;
        var _prevout = _ref14.prevout;

        if (socket.filter.test(_prevout.toRaw())) return true;
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
  }

  return false;
};

/**
 * Scan using a socket's filter.
 * @private
 * @param {WebSocket} socket
 * @param {Hash} start
 * @returns {Promise}
 */

HTTPServer.prototype.scan = function () {
  var _ref15 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee14(socket, start) {
    var scanner;
    return _regenerator2.default.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            scanner = this.scanner.bind(this, socket);
            _context14.next = 3;
            return this.node.scan(start, socket.filter, scanner);

          case 3:
            return _context14.abrupt('return', null);

          case 4:
          case 'end':
            return _context14.stop();
        }
      }
    }, _callee14, this);
  }));

  function scan(_x26, _x27) {
    return _ref15.apply(this, arguments);
  }

  return scan;
}();

/**
 * Handle rescan iteration.
 * @private
 * @param {WebSocket} socket
 * @param {ChainEntry} entry
 * @param {TX[]} txs
 * @returns {Promise}
 */

HTTPServer.prototype.scanner = function scanner(socket, entry, txs) {
  var block = entry.toRaw();
  var raw = [];

  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = (0, _getIterator3.default)(txs), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var tx = _step8.value;

      raw.push(tx.toRaw());
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

  socket.emit('block rescan', block, raw);

  return _promise2.default.resolve();
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
  this.node = null;
  this.apiKey = base58.encode(random.randomBytes(20));
  this.apiHash = digest.hash256(Buffer.from(this.apiKey, 'ascii'));
  this.noAuth = false;

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
  assert(options.node && (0, _typeof3.default)(options.node) === 'object', 'HTTP Server requires a Node.');

  this.node = options.node;
  this.network = options.node.network;
  this.logger = options.node.logger;

  this.port = this.network.rpcPort;

  if (options.logger != null) {
    assert((0, _typeof3.default)(options.logger) === 'object');
    this.logger = options.logger;
  }

  if (options.apiKey != null) {
    assert(typeof options.apiKey === 'string', 'API key must be a string.');
    assert(options.apiKey.length <= 255, 'API key must be under 256 bytes.');
    assert(util.isAscii(options.apiKey), 'API key must be ascii.');
    this.apiKey = options.apiKey;
    this.apiHash = digest.hash256(Buffer.from(this.apiKey, 'ascii'));
  }

  if (options.noAuth != null) {
    assert(typeof options.noAuth === 'boolean');
    this.noAuth = options.noAuth;
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