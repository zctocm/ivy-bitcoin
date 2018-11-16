/*!
 * http.js - http server for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var path = require('path');
var EventEmitter = require('events');
var URL = require('url');

var _require = require('string_decoder'),
    StringDecoder = _require.StringDecoder;

var AsyncObject = require('../utils/asyncobject');
var util = require('../utils/util');
var co = require('../utils/co');
var Validator = require('../utils/validator');

var _require2 = require('../utils/list'),
    List = _require2.List,
    ListItem = _require2.ListItem;

var fs = require('../utils/fs');
var digest = require('../crypto/digest');
var ccmp = require('../crypto/ccmp');

/**
 * HTTPBase
 * @alias module:http.Base
 * @constructor
 * @param {Object?} options
 * @emits HTTPBase#socket
 */

function HTTPBase(options) {
  if (!(this instanceof HTTPBase)) return new HTTPBase(options);

  AsyncObject.call(this);

  this.config = new HTTPBaseOptions(options);
  this.config.load();

  this.server = null;
  this.io = null;
  this.sockets = new List();
  this.channels = new _map2.default();
  this.routes = new Routes();
  this.mounts = [];
  this.stack = [];
  this.hooks = [];

  this._init();
}

(0, _setPrototypeOf2.default)(HTTPBase.prototype, AsyncObject.prototype);

/**
 * Initialize server.
 * @private
 */

HTTPBase.prototype._init = function _init() {
  var _this = this;

  var backend = this.config.getBackend();
  var options = this.config.toHTTP();

  this.server = backend.createServer(options);

  this._initRouter();
  this._initSockets();

  this.server.on('connection', function (socket) {
    socket.on('error', function (err) {
      if (err.message === 'Parse Error') {
        var msg = 'http_parser.execute failure';
        msg += ' (parsed=' + (err.bytesParsed || -1);
        msg += ' code=' + err.code + ')';
        err = new Error(msg);
      }

      _this.emit('error', err);

      try {
        socket.destroy();
      } catch (e) {
        ;
      }
    });
  });

  this.server.on('error', function (err) {
    _this.emit('error', err);
  });
};

/**
 * Initialize router.
 * @private
 */

HTTPBase.prototype._initRouter = function _initRouter() {
  var _this2 = this;

  this.server.on('request', function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(hreq, hres) {
      var req, res;
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              req = new Request(hreq, hres, hreq.url);
              res = new Response(hreq, hres);


              req.on('error', function () {});

              _context.prev = 3;

              req.pause();
              _context.next = 7;
              return _this2.handleRequest(req, res);

            case 7:
              _context.next = 13;
              break;

            case 9:
              _context.prev = 9;
              _context.t0 = _context['catch'](3);

              res.error(_context.t0.statusCode || 500, _context.t0);
              _this2.emit('error', _context.t0);

            case 13:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this2, [[3, 9]]);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }());
};

/**
 * Handle a request.
 * @private
 * @param {ServerRequest} req
 * @param {ServerResponse} res
 * @returns {Promise}
 */

HTTPBase.prototype.handleRequest = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(req, res) {
    var routes, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, route, params;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return this.handleMounts(req, res);

          case 2:
            if (!_context2.sent) {
              _context2.next = 4;
              break;
            }

            return _context2.abrupt('return');

          case 4:

            this.emit('request', req, res);

            _context2.next = 7;
            return this.handleStack(req, res);

          case 7:
            if (!_context2.sent) {
              _context2.next = 9;
              break;
            }

            return _context2.abrupt('return');

          case 9:
            routes = this.routes.getHandlers(req.method);

            if (routes) {
              _context2.next = 12;
              break;
            }

            throw new Error('No routes found for method: ' + req.method + '.');

          case 12:
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context2.prev = 15;
            _iterator = (0, _getIterator3.default)(routes);

          case 17:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context2.next = 34;
              break;
            }

            route = _step.value;
            params = route.match(req.pathname);

            if (params) {
              _context2.next = 22;
              break;
            }

            return _context2.abrupt('continue', 31);

          case 22:

            req.params = params;

            _context2.next = 25;
            return this.handleHooks(req, res);

          case 25:
            if (!_context2.sent) {
              _context2.next = 27;
              break;
            }

            return _context2.abrupt('return');

          case 27:
            _context2.next = 29;
            return route.call(req, res);

          case 29:
            if (!_context2.sent) {
              _context2.next = 31;
              break;
            }

            return _context2.abrupt('return');

          case 31:
            _iteratorNormalCompletion = true;
            _context2.next = 17;
            break;

          case 34:
            _context2.next = 40;
            break;

          case 36:
            _context2.prev = 36;
            _context2.t0 = _context2['catch'](15);
            _didIteratorError = true;
            _iteratorError = _context2.t0;

          case 40:
            _context2.prev = 40;
            _context2.prev = 41;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 43:
            _context2.prev = 43;

            if (!_didIteratorError) {
              _context2.next = 46;
              break;
            }

            throw _iteratorError;

          case 46:
            return _context2.finish(43);

          case 47:
            return _context2.finish(40);

          case 48:
            throw new Error('No routes found for path: ' + req.pathname + '.');

          case 49:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[15, 36, 40, 48], [41,, 43, 47]]);
  }));

  function handleRequest(_x3, _x4) {
    return _ref2.apply(this, arguments);
  }

  return handleRequest;
}();

/**
 * CORS middleware.
 * @returns {Function}
 */

HTTPBase.prototype.cors = function cors() {
  var _this3 = this;

  return function () {
    var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(req, res) {
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Credentials', 'true');
              res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
              res.setHeader('Access-Control-Allow-Headers', 'Authorization');

              if (!(req.method === 'OPTIONS')) {
                _context3.next = 8;
                break;
              }

              res.setStatus(200);
              res.end();
              return _context3.abrupt('return');

            case 8:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this3);
    }));

    return function (_x5, _x6) {
      return _ref3.apply(this, arguments);
    };
  }();
};

/**
 * Basic auth middleware.
 * @param {Object} options
 * @returns {Function}
 */

HTTPBase.prototype.basicAuth = function basicAuth(options) {
  var _this4 = this;

  assert(options, 'Basic auth requires options.');

  var user = options.username;
  var pass = options.password;
  var realm = options.realm;

  if (user != null) {
    assert(typeof user === 'string');
    assert(user.length <= 255, 'Username too long.');
    assert(util.isAscii(user), 'Username must be ASCII.');
    user = digest.hash256(Buffer.from(user, 'ascii'));
  }

  assert(typeof pass === 'string');
  assert(pass.length <= 255, 'Password too long.');
  assert(util.isAscii(pass), 'Password must be ASCII.');
  pass = digest.hash256(Buffer.from(pass, 'ascii'));

  if (!realm) realm = 'server';

  assert(typeof realm === 'string');

  var fail = function fail(res) {
    res.setHeader('WWW-Authenticate', 'Basic realm="' + realm + '"');
    res.setStatus(401);
    res.end();
  };

  return function () {
    var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(req, res) {
      var hdr, parts, _parts, type, b64, auth, items, username, password, _raw, _hash, raw, hash;

      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              hdr = req.headers['authorization'];

              if (hdr) {
                _context4.next = 4;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 4:
              if (!(hdr.length > 674)) {
                _context4.next = 7;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 7:
              parts = hdr.split(' ');

              if (!(parts.length !== 2)) {
                _context4.next = 11;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 11:
              _parts = (0, _slicedToArray3.default)(parts, 2), type = _parts[0], b64 = _parts[1];

              if (!(type !== 'Basic')) {
                _context4.next = 15;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 15:
              auth = Buffer.from(b64, 'base64').toString('ascii');
              items = auth.split(':');
              username = items.shift();
              password = items.join(':');

              if (!user) {
                _context4.next = 28;
                break;
              }

              if (!(username.length > 255)) {
                _context4.next = 23;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 23:
              _raw = Buffer.from(username, 'ascii');
              _hash = digest.hash256(_raw);

              if (ccmp(_hash, user)) {
                _context4.next = 28;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 28:
              if (!(password.length > 255)) {
                _context4.next = 31;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 31:
              raw = Buffer.from(password, 'ascii');
              hash = digest.hash256(raw);

              if (ccmp(hash, pass)) {
                _context4.next = 36;
                break;
              }

              fail(res);
              return _context4.abrupt('return');

            case 36:

              req.username = username;

            case 37:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this4);
    }));

    return function (_x7, _x8) {
      return _ref4.apply(this, arguments);
    };
  }();
};

/**
 * Body parser middleware.
 * @param {Object} options
 * @returns {Function}
 */

HTTPBase.prototype.bodyParser = function bodyParser(options) {
  var _this5 = this;

  var opt = new BodyParserOptions(options);

  return function () {
    var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(req, res) {
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              if (!req.hasBody) {
                _context5.next = 2;
                break;
              }

              return _context5.abrupt('return');

            case 2:
              _context5.prev = 2;

              req.resume();
              _context5.next = 6;
              return _this5.parseBody(req, opt);

            case 6:
              req.body = _context5.sent;

            case 7:
              _context5.prev = 7;

              req.pause();
              return _context5.finish(7);

            case 10:

              req.hasBody = true;

            case 11:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this5, [[2,, 7, 10]]);
    }));

    return function (_x9, _x10) {
      return _ref5.apply(this, arguments);
    };
  }();
};

/**
 * Parse request body.
 * @private
 * @param {ServerRequest} req
 * @param {Object} options
 * @returns {Promise}
 */

HTTPBase.prototype.parseBody = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(req, options) {
    var body, type, data;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            body = (0, _create2.default)(null);

            if (!(req.method === 'GET')) {
              _context6.next = 3;
              break;
            }

            return _context6.abrupt('return', body);

          case 3:
            type = req.contentType;


            if (options.contentType) type = options.contentType;

            if (!(type === 'bin')) {
              _context6.next = 7;
              break;
            }

            return _context6.abrupt('return', body);

          case 7:
            _context6.next = 9;
            return this.readBody(req, 'utf8', options);

          case 9:
            data = _context6.sent;

            if (data) {
              _context6.next = 12;
              break;
            }

            return _context6.abrupt('return', body);

          case 12:
            _context6.t0 = type;
            _context6.next = _context6.t0 === 'json' ? 15 : _context6.t0 === 'form' ? 19 : 21;
            break;

          case 15:
            body = JSON.parse(data);

            if (!(!body || (typeof body === 'undefined' ? 'undefined' : (0, _typeof3.default)(body)) !== 'object' || Array.isArray(body))) {
              _context6.next = 18;
              break;
            }

            throw new Error('JSON body must be an object.');

          case 18:
            return _context6.abrupt('break', 21);

          case 19:
            body = parsePairs(data, options.keyLimit);
            return _context6.abrupt('break', 21);

          case 21:
            return _context6.abrupt('return', body);

          case 22:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function parseBody(_x11, _x12) {
    return _ref6.apply(this, arguments);
  }

  return parseBody;
}();

/**
 * Read and buffer request body.
 * @param {ServerRequest} req
 * @param {String} enc
 * @param {Object} options
 * @returns {Promise}
 */

HTTPBase.prototype.readBody = function readBody(req, enc, options) {
  var _this6 = this;

  return new _promise2.default(function (resolve, reject) {
    return _this6._readBody(req, enc, options, resolve, reject);
  });
};

/**
 * Read and buffer request body.
 * @private
 * @param {ServerRequest} req
 * @param {String} enc
 * @param {Object} options
 * @param {Function} resolve
 * @param {Function} reject
 */

HTTPBase.prototype._readBody = function _readBody(req, enc, options, resolve, reject) {
  var decode = new StringDecoder(enc);

  var hasData = false;
  var total = 0;
  var body = '';

  var cleanup = function cleanup() {
    /* eslint-disable */
    req.removeListener('data', onData);
    req.removeListener('error', onError);
    req.removeListener('end', onEnd);

    if (timer != null) {
      timer = null;
      clearTimeout(timer);
    }
    /* eslint-enable */
  };

  var onData = function onData(data) {
    total += data.length;
    hasData = true;

    if (total > options.bodyLimit) {
      reject(new Error('Request body overflow.'));
      return;
    }

    body += decode.write(data);
  };

  var onError = function onError(err) {
    cleanup();
    reject(err);
  };

  var onEnd = function onEnd() {
    cleanup();

    if (hasData) {
      resolve(body);
      return;
    }

    resolve(null);
  };

  var timer = setTimeout(function () {
    timer = null;
    cleanup();
    reject(new Error('Request body timed out.'));
  }, options.timeout);

  req.on('data', onData);
  req.on('error', onError);
  req.on('end', onEnd);
};

/**
 * JSON rpc middleware.
 * @param {RPCBase} rpc
 * @returns {Function}
 */

HTTPBase.prototype.jsonRPC = function jsonRPC(rpc) {
  var _this7 = this;

  return function () {
    var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7(req, res) {
      var json;
      return _regenerator2.default.wrap(function _callee7$(_context7) {
        while (1) {
          switch (_context7.prev = _context7.next) {
            case 0:
              if (!(req.method !== 'POST')) {
                _context7.next = 2;
                break;
              }

              return _context7.abrupt('return');

            case 2:
              if (!(req.pathname !== '/')) {
                _context7.next = 4;
                break;
              }

              return _context7.abrupt('return');

            case 4:
              if (!(typeof req.body.method !== 'string')) {
                _context7.next = 6;
                break;
              }

              return _context7.abrupt('return');

            case 6:
              _context7.next = 8;
              return rpc.call(req.body, req.query);

            case 8:
              json = _context7.sent;


              json = (0, _stringify2.default)(json);
              json += '\n';

              res.setHeader('X-Long-Polling', '/?longpoll=1');

              res.send(200, json, 'json');

            case 13:
            case 'end':
              return _context7.stop();
          }
        }
      }, _callee7, _this7);
    }));

    return function (_x13, _x14) {
      return _ref7.apply(this, arguments);
    };
  }();
};

/**
 * Handle mount stack.
 * @private
 * @param {HTTPRequest} req
 * @param {HTTPResponse} res
 * @returns {Promise}
 */

HTTPBase.prototype.handleMounts = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(req, res) {
    var url, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, route, server;

    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            url = req.url;
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context8.prev = 4;
            _iterator2 = (0, _getIterator3.default)(this.mounts);

          case 6:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context8.next = 20;
              break;
            }

            route = _step2.value;
            server = route.handler;

            if (route.hasPrefix(req.pathname)) {
              _context8.next = 11;
              break;
            }

            return _context8.abrupt('continue', 17);

          case 11:

            assert(url.indexOf(route.path) === 0);

            url = url.substring(route.path.length);
            req = req.rewrite(url);

            _context8.next = 16;
            return server.handleRequest(req, res);

          case 16:
            return _context8.abrupt('return', true);

          case 17:
            _iteratorNormalCompletion2 = true;
            _context8.next = 6;
            break;

          case 20:
            _context8.next = 26;
            break;

          case 22:
            _context8.prev = 22;
            _context8.t0 = _context8['catch'](4);
            _didIteratorError2 = true;
            _iteratorError2 = _context8.t0;

          case 26:
            _context8.prev = 26;
            _context8.prev = 27;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 29:
            _context8.prev = 29;

            if (!_didIteratorError2) {
              _context8.next = 32;
              break;
            }

            throw _iteratorError2;

          case 32:
            return _context8.finish(29);

          case 33:
            return _context8.finish(26);

          case 34:
            return _context8.abrupt('return', false);

          case 35:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this, [[4, 22, 26, 34], [27,, 29, 33]]);
  }));

  function handleMounts(_x15, _x16) {
    return _ref8.apply(this, arguments);
  }

  return handleMounts;
}();

/**
 * Handle middleware stack.
 * @private
 * @param {HTTPRequest} req
 * @param {HTTPResponse} res
 * @returns {Promise}
 */

HTTPBase.prototype.handleStack = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(req, res) {
    var _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, route;

    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context9.prev = 3;
            _iterator3 = (0, _getIterator3.default)(this.stack);

          case 5:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context9.next = 16;
              break;
            }

            route = _step3.value;

            if (route.hasPrefix(req.pathname)) {
              _context9.next = 9;
              break;
            }

            return _context9.abrupt('continue', 13);

          case 9:
            _context9.next = 11;
            return route.call(req, res);

          case 11:
            if (!_context9.sent) {
              _context9.next = 13;
              break;
            }

            return _context9.abrupt('return', true);

          case 13:
            _iteratorNormalCompletion3 = true;
            _context9.next = 5;
            break;

          case 16:
            _context9.next = 22;
            break;

          case 18:
            _context9.prev = 18;
            _context9.t0 = _context9['catch'](3);
            _didIteratorError3 = true;
            _iteratorError3 = _context9.t0;

          case 22:
            _context9.prev = 22;
            _context9.prev = 23;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 25:
            _context9.prev = 25;

            if (!_didIteratorError3) {
              _context9.next = 28;
              break;
            }

            throw _iteratorError3;

          case 28:
            return _context9.finish(25);

          case 29:
            return _context9.finish(22);

          case 30:
            return _context9.abrupt('return', false);

          case 31:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this, [[3, 18, 22, 30], [23,, 25, 29]]);
  }));

  function handleStack(_x17, _x18) {
    return _ref9.apply(this, arguments);
  }

  return handleStack;
}();

/**
 * Handle hook stack.
 * @private
 * @param {HTTPRequest} req
 * @param {HTTPResponse} res
 * @returns {Promise}
 */

HTTPBase.prototype.handleHooks = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee10(req, res) {
    var _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, route;

    return _regenerator2.default.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context10.prev = 3;
            _iterator4 = (0, _getIterator3.default)(this.hooks);

          case 5:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context10.next = 16;
              break;
            }

            route = _step4.value;

            if (route.hasPrefix(req.pathname)) {
              _context10.next = 9;
              break;
            }

            return _context10.abrupt('continue', 13);

          case 9:
            _context10.next = 11;
            return route.call(req, res);

          case 11:
            if (!_context10.sent) {
              _context10.next = 13;
              break;
            }

            return _context10.abrupt('return', true);

          case 13:
            _iteratorNormalCompletion4 = true;
            _context10.next = 5;
            break;

          case 16:
            _context10.next = 22;
            break;

          case 18:
            _context10.prev = 18;
            _context10.t0 = _context10['catch'](3);
            _didIteratorError4 = true;
            _iteratorError4 = _context10.t0;

          case 22:
            _context10.prev = 22;
            _context10.prev = 23;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 25:
            _context10.prev = 25;

            if (!_didIteratorError4) {
              _context10.next = 28;
              break;
            }

            throw _iteratorError4;

          case 28:
            return _context10.finish(25);

          case 29:
            return _context10.finish(22);

          case 30:
            return _context10.abrupt('return', false);

          case 31:
          case 'end':
            return _context10.stop();
        }
      }
    }, _callee10, this, [[3, 18, 22, 30], [23,, 25, 29]]);
  }));

  function handleHooks(_x19, _x20) {
    return _ref10.apply(this, arguments);
  }

  return handleHooks;
}();

/**
 * Initialize websockets.
 * @private
 */

HTTPBase.prototype._initSockets = function _initSockets() {
  var _this8 = this;

  if (!this.config.sockets) return;

  var IOServer = void 0;
  try {
    IOServer = require('socket.io');
  } catch (e) {
    ;
  }

  if (!IOServer) return;

  this.io = new IOServer({
    transports: ['websocket'],
    serveClient: false
  });

  this.io.attach(this.server);

  this.io.on('connection', function (ws) {
    _this8.addSocket(ws);
  });
};

/**
 * Broadcast event to channel.
 * @param {String} name
 * @param {String} type
 * @param {...Object} args
 */

HTTPBase.prototype.to = function to(name) {
  var list = this.channels.get(name);

  if (!list) return;

  assert(list.size > 0);

  for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    args[_key - 1] = arguments[_key];
  }

  for (var item = list.head; item; item = item.next) {
    var socket = item.value;
    socket.emit.apply(socket, args);
  }
};

/**
 * Broadcast event to all connections.
 * @param {String} channel
 * @param {String} type
 * @param {...Object} args
 */

HTTPBase.prototype.all = function all() {
  var list = this.sockets;

  for (var socket = list.head; socket; socket = socket.next) {
    socket.emit.apply(socket, arguments);
  }
};

/**
 * Add and initialize a websocket.
 * @private
 * @param {SocketIO.Socket} ws
 */

HTTPBase.prototype.addSocket = function addSocket(ws) {
  var _this9 = this;

  var socket = new WebSocket(ws, this);

  socket.on('error', function (err) {
    _this9.emit('error', err);
  });

  socket.on('close', function () {
    _this9.removeSocket(socket);
  });

  socket.on('join channel', function (name) {
    _this9.joinChannel(socket, name);
  });

  socket.on('leave channel', function (name) {
    _this9.leaveChannel(socket, name);
  });

  this.sockets.push(socket);

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(this.mounts), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var route = _step5.value;

      route.handler.addSocket(ws);
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

  this.emit('socket', socket);
};

/**
 * Remove a socket from lists.
 * @private
 * @param {WebSocket} socket
 */

HTTPBase.prototype.removeSocket = function removeSocket(socket) {
  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(socket.channels.keys()), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var key = _step6.value;

      this.leaveChannel(socket, key);
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

  assert(this.sockets.remove(socket));
};

/**
 * Add a socket to channel list.
 * @private
 * @param {WebSocket} socket
 * @param {String} name
 */

HTTPBase.prototype.joinChannel = function joinChannel(socket, name) {
  var item = socket.channels.get(name);

  if (item) return;

  var list = this.channels.get(name);

  if (!list) {
    list = new List();
    this.channels.set(name, list);
  }

  item = new ListItem(socket);
  list.push(item);

  socket.channels.set(name, item);
};

/**
 * Remove a socket from channel list.
 * @private
 * @param {WebSocket} socket
 * @param {String} name
 */

HTTPBase.prototype.leaveChannel = function leaveChannel(socket, name) {
  var item = socket.channels.get(name);

  if (!item) return;

  var list = this.channels.get(name);

  assert(list);
  assert(list.remove(item));

  if (list.size === 0) this.channels.delete(name);

  socket.channels.delete(name);
};

/**
 * Get channel list.
 * @private
 * @param {String} name
 */

HTTPBase.prototype.channel = function channel(name) {
  var list = this.channels.get(name);

  if (!list) return null;

  assert(list.size > 0);

  return list;
};

/**
 * Open the server.
 * @alias HTTPBase#open
 * @returns {Promise}
 */

HTTPBase.prototype._open = function _open() {
  return this.listen(this.config.port, this.config.host);
};

/**
 * Close the server.
 * @alias HTTPBase#close
 * @returns {Promise}
 */

HTTPBase.prototype._close = function _close() {
  var _this10 = this;

  return new _promise2.default(function (resolve, reject) {
    if (_this10.io) {
      _this10.server.once('close', resolve);
      _this10.io.close();
      return;
    }

    _this10.server.close(function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

/**
 * Mount a server.
 * @param {String?} path
 * @param {HTTPBase} server
 * @param {Object?} ctx
 */

HTTPBase.prototype.mount = function mount(path, server, ctx) {
  if (!server) {
    server = path;
    path = null;
  }
  this.mounts.push(new Route(ctx || this, path, server));
};

/**
 * Add a middleware to the stack.
 * @param {String?} path
 * @param {Function} handler
 * @param {Object?} ctx
 */

HTTPBase.prototype.use = function use(path, handler, ctx) {
  if (!handler) {
    handler = path;
    path = null;
  }
  this.stack.push(new Route(ctx || this, path, handler));
};

/**
 * Add a hook to the stack.
 * @param {String?} path
 * @param {Function} handler
 * @param {Object?} ctx
 */

HTTPBase.prototype.hook = function hook(path, handler, ctx) {
  if (!handler) {
    handler = path;
    path = null;
  }
  this.hooks.push(new Route(ctx || this, path, handler));
};

/**
 * Add a GET route.
 * @param {String} path
 * @param {Function} handler
 * @param {Object?} ctx
 */

HTTPBase.prototype.get = function get(path, handler, ctx) {
  this.routes.get.push(new Route(ctx || this, path, handler));
};

/**
 * Add a POST route.
 * @param {String} path
 * @param {Function} handler
 * @param {Object?} ctx
 */

HTTPBase.prototype.post = function post(path, handler, ctx) {
  this.routes.post.push(new Route(ctx || this, path, handler));
};

/**
 * Add a PUT route.
 * @param {String} path
 * @param {Function} handler
 * @param {Object?} ctx
 */

HTTPBase.prototype.put = function put(path, handler, ctx) {
  this.routes.put.push(new Route(ctx || this, path, handler));
};

/**
 * Add a DELETE route.
 * @param {String} path
 * @param {Function} handler
 * @param {Object?} ctx
 */

HTTPBase.prototype.del = function del(path, handler, ctx) {
  this.routes.del.push(new Route(ctx || this, path, handler));
};

/**
 * Get server address.
 * @returns {Object}
 */

HTTPBase.prototype.address = function address() {
  return this.server.address();
};

/**
 * Listen on port and host.
 * @param {Number} port
 * @param {String} host
 * @returns {Promise}
 */

HTTPBase.prototype.listen = function listen(port, host) {
  var _this11 = this;

  return new _promise2.default(function (resolve, reject) {
    _this11.server.once('error', reject);
    _this11.server.listen(port, host, function () {
      var addr = _this11.address();

      _this11.emit('listening', addr);

      _this11.server.removeListener('error', reject);
      resolve(addr);
    });
  });
};

/**
 * HTTP Base Options
 * @alias module:http.HTTPBaseOptions
 * @constructor
 * @param {Object} options
 */

function HTTPBaseOptions(options) {
  if (!(this instanceof HTTPBaseOptions)) return new HTTPBaseOptions(options);

  this.host = '127.0.0.1';
  this.port = 8080;
  this.sockets = true;

  this.ssl = false;
  this.keyFile = null;
  this.certFile = null;
  this.key = null;
  this.cert = null;
  this.ca = null;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {HTTPBaseOptions}
 */

HTTPBaseOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options);

  if (options.host != null) {
    assert(typeof options.host === 'string');
    this.host = options.host;
  }

  if (options.port != null) {
    assert(util.isU16(options.port), 'Port must be a number.');
    this.port = options.port;
  }

  if (options.sockets != null) {
    assert(typeof options.sockets === 'boolean');
    this.sockets = options.sockets;
  }

  if (options.prefix != null) {
    assert(typeof options.prefix === 'string');
    this.prefix = options.prefix;
    this.keyFile = path.join(this.prefix, 'key.pem');
    this.certFile = path.join(this.prefix, 'cert.pem');
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

  if (options.key != null) {
    assert(typeof options.key === 'string' || Buffer.isBuffer(options.key));
    this.key = options.key;
  }

  if (options.cert != null) {
    assert(typeof options.cert === 'string' || Buffer.isBuffer(options.cert));
    this.cert = options.cert;
  }

  if (options.ca != null) {
    assert(Array.isArray(options.ca));
    this.ca = options.ca;
  }

  if (this.ssl) {
    assert(this.key || this.keyFile, 'SSL specified with no provided key.');
    assert(this.cert || this.certFile, 'SSL specified with no provided cert.');
  }

  return this;
};

/**
 * Load key and cert file.
 * @private
 */

HTTPBaseOptions.prototype.load = function load() {
  if (!this.ssl) return;

  if (this.keyFile) this.key = fs.readFileSync(this.keyFile);

  if (this.certFile) this.cert = fs.readFileSync(this.certFile);
};

/**
 * Instantiate http server options from object.
 * @param {Object} options
 * @returns {HTTPBaseOptions}
 */

HTTPBaseOptions.fromOptions = function fromOptions(options) {
  return new HTTPBaseOptions().fromOptions(options);
};

/**
 * Get HTTP server backend.
 * @private
 * @returns {Object}
 */

HTTPBaseOptions.prototype.getBackend = function getBackend() {
  return this.ssl ? require('https') : require('http');
};

/**
 * Get HTTP server options.
 * @private
 * @returns {Object}
 */

HTTPBaseOptions.prototype.toHTTP = function toHTTP() {
  if (!this.ssl) return undefined;

  return {
    key: this.key,
    cert: this.cert,
    ca: this.ca
  };
};

/**
 * HTTP Base Options
 * @alias module:http.BodyParserOptions
 * @constructor
 * @param {Object} options
 */

function BodyParserOptions(options) {
  if (!(this instanceof BodyParserOptions)) return new BodyParserOptions(options);

  this.keyLimit = 100;
  this.bodyLimit = 20 << 20;
  this.contentType = null;
  this.timeout = 10 * 1000;

  if (options) this.fromOptions(options);
}

/**
 * Inject properties from object.
 * @private
 * @param {Object} options
 * @returns {BodyParserOptions}
 */

BodyParserOptions.prototype.fromOptions = function fromOptions(options) {
  assert(options);

  if (options.keyLimit != null) {
    assert(typeof options.keyLimit === 'number');
    this.keyLimit = options.keyLimit;
  }

  if (options.bodyLimit != null) {
    assert(typeof options.bodyLimit === 'number');
    this.bodyLimit = options.bodyLimit;
  }

  if (options.contentType != null) {
    assert(typeof options.contentType === 'string');
    this.contentType = options.contentType;
  }

  return this;
};

/**
 * Route
 * @constructor
 * @ignore
 */

function Route(ctx, path, handler) {
  if (!(this instanceof Route)) return new Route(ctx, path, handler);

  this.ctx = null;
  this.path = null;
  this.handler = null;

  this.regex = /^/;
  this.map = [];
  this.compiled = false;

  if (ctx) {
    assert((typeof ctx === 'undefined' ? 'undefined' : (0, _typeof3.default)(ctx)) === 'object');
    this.ctx = ctx;
  }

  if (path) {
    if (path instanceof RegExp) {
      this.regex = path;
    } else {
      assert(typeof path === 'string');
      assert(path.length > 0);
      this.path = path;
    }
  }

  assert(handler);
  assert(typeof handler === 'function' || (typeof handler === 'undefined' ? 'undefined' : (0, _typeof3.default)(handler)) === 'object');

  this.handler = handler;
}

Route.prototype.compile = function compile() {
  var path = this.path;
  var map = this.map;

  if (this.compiled) return;

  this.compiled = true;

  if (!path) return;

  path = path.replace(/(\/[^\/]+)\?/g, '(?:$1)?');
  path = path.replace(/\.(?!\+)/g, '\\.');
  path = path.replace(/\*/g, '.*?');
  path = path.replace(/%/g, '\\');

  path = path.replace(/:(\w+)/g, function (str, name) {
    map.push(name);
    return '([^/]+)';
  });

  this.regex = new RegExp('^' + path + '$');
};

Route.prototype.match = function match(pathname) {
  this.compile();

  assert(this.regex);

  var matches = this.regex.exec(pathname);

  if (!matches) return null;

  var params = (0, _create2.default)(null);

  for (var i = 1; i < matches.length; i++) {
    var item = matches[i];
    var key = this.map[i - 1];

    if (key) params[key] = item;

    params[i - 1] = item;
  }

  return params;
};

Route.prototype.hasPrefix = function hasPrefix(pathname) {
  if (!this.path) return true;

  return pathname.indexOf(this.path) === 0;
};

Route.prototype.call = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee11(req, res) {
    return _regenerator2.default.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            _context11.next = 2;
            return this.handler.call(this.ctx, req, res);

          case 2:
            return _context11.abrupt('return', res.sent);

          case 3:
          case 'end':
            return _context11.stop();
        }
      }
    }, _callee11, this);
  }));

  function call(_x21, _x22) {
    return _ref11.apply(this, arguments);
  }

  return call;
}();

/**
 * Routes
 * @constructor
 * @ignore
 */

function Routes() {
  if (!(this instanceof Routes)) return new Routes();

  this.get = [];
  this.post = [];
  this.put = [];
  this.del = [];
}

Routes.prototype.getHandlers = function getHandlers(method) {
  if (!method) return null;

  method = method.toUpperCase();

  switch (method) {
    case 'GET':
      return this.get;
    case 'POST':
      return this.post;
    case 'PUT':
      return this.put;
    case 'DELETE':
      return this.del;
    default:
      return null;
  }
};

/**
 * Request
 * @constructor
 * @ignore
 */

function Request(req, res, url) {
  if (!(this instanceof Request)) return new Request(req, res, url);

  EventEmitter.call(this);

  this.req = null;
  this.res = null;
  this.socket = null;
  this.method = 'GET';
  this.headers = (0, _create2.default)(null);
  this.contentType = 'bin';
  this.url = '/';
  this.pathname = '/';
  this.path = [];
  this.trailing = false;
  this.query = (0, _create2.default)(null);
  this.params = (0, _create2.default)(null);
  this.body = (0, _create2.default)(null);
  this.hasBody = false;
  this.username = null;
  this.readable = true;
  this.writable = false;

  if (req) this.init(req, res, url);
}

(0, _setPrototypeOf2.default)(Request.prototype, EventEmitter.prototype);

Request.prototype.init = function init(req, res, url) {
  var _this12 = this;

  assert(req);
  assert(res);

  this.req = req;
  this.res = res;
  this.socket = req.socket;
  this.method = req.method;
  this.headers = req.headers;
  this.contentType = parseType(req.headers['content-type']);

  req.on('error', function (err) {
    _this12.emit('error', err);
  });

  req.on('data', function (data) {
    _this12.emit('data', data);
  });

  req.on('end', function () {
    _this12.emit('end');
  });

  if (url != null) {
    try {
      this.parse(url);
    } catch (e) {
      ;
    }
  }
};

Request.prototype.parse = function parse(url) {
  var uri = URL.parse(url);

  var pathname = uri.pathname;
  var query = (0, _create2.default)(null);
  var trailing = false;

  if (pathname) {
    pathname = pathname.replace(/\/{2,}/g, '/');

    if (pathname[0] !== '/') pathname = '/' + pathname;

    if (pathname.length > 1) {
      if (pathname[pathname.length - 1] === '/') {
        pathname = pathname.slice(0, -1);
        trailing = true;
      }
    }

    pathname = pathname.replace(/%2f/gi, '');
    pathname = unescape(pathname);
  } else {
    pathname = '/';
  }

  assert(pathname.length > 0);
  assert(pathname[0] === '/');

  if (pathname.length > 1) assert(pathname[pathname.length - 1] !== '/');

  var path = pathname;

  if (path[0] === '/') path = path.substring(1);

  var parts = path.split('/');

  if (parts.length === 1) {
    if (parts[0].length === 0) parts = [];
  }

  url = pathname;

  if (uri.search && uri.search.length > 1) {
    assert(uri.search[0] === '?');
    url += uri.search;
  }

  if (uri.hash && uri.hash.length > 1) {
    assert(uri.hash[0] === '#');
    url += uri.hash;
  }

  if (uri.query) query = parsePairs(uri.query, 100);

  this.url = url;
  this.pathname = pathname;
  this.path = parts;
  this.query = query;
  this.trailing = trailing;
};

Request.prototype.rewrite = function rewrite(url) {
  var req = new Request();
  req.init(this.req, this.res, url);
  req.body = this.body;
  req.hasBody = this.hasBody;
  return req;
};

Request.prototype.valid = function valid() {
  return new Validator([this.query, this.params, this.body]);
};

Request.prototype.pipe = function pipe(dest) {
  return this.req.pipe(dest);
};

Request.prototype.pause = function pause() {
  return this.req.pause();
};

Request.prototype.resume = function resume() {
  return this.req.resume();
};

Request.prototype.destroy = function destroy() {
  return this.req.destroy();
};

/**
 * Response
 * @constructor
 * @ignore
 */

function Response(req, res) {
  if (!(this instanceof Response)) return new Response(req, res);

  EventEmitter.call(this);

  this.req = req;
  this.res = res;
  this.sent = false;
  this.readable = false;
  this.writable = true;
  this.statusCode = 200;
  this.res.statusCode = 200;

  if (req) this.init(req, res);
}

(0, _setPrototypeOf2.default)(Response.prototype, EventEmitter.prototype);

Response.prototype.init = function init(req, res) {
  var _this13 = this;

  assert(req);
  assert(res);

  res.on('error', function (err) {
    _this13.emit('error', err);
  });

  res.on('drain', function () {
    _this13.emit('drain');
  });

  res.on('close', function () {
    _this13.emit('close');
  });
};

Response.prototype.setStatus = function setStatus(code) {
  this.statusCode = code;
  this.res.statusCode = code;
};

Response.prototype.setType = function setType(type) {
  this.setHeader('Content-Type', getType(type));
};

Response.prototype.hasType = function hasType() {
  return this.getHeader('Content-Type') != null;
};

Response.prototype.destroy = function destroy() {
  return this.res.destroy();
};

Response.prototype.setHeader = function setHeader(key, value) {
  return this.res.setHeader(key, value);
};

Response.prototype.getHeader = function getHeader(key) {
  return this.res.getHeader(key);
};

Response.prototype.writeHead = function writeHead(code, headers) {
  return this.res.writeHead(code, headers);
};

Response.prototype.write = function write(data, enc) {
  return this.res.write(data, enc);
};

Response.prototype.end = function end(data, enc) {
  this.sent = true;
  return this.res.end(data, enc);
};

Response.prototype.error = function error(code, err) {
  if (this.sent) return;

  if (!code) code = 400;

  this.send(code, {
    error: {
      type: err.type || 'Error',
      message: err.message,
      code: err.code
    }
  });
};

Response.prototype.redirect = function redirect(code, url) {
  if (!url) {
    url = code;
    code = 301;
  }

  this.setStatus(code);
  this.setHeader('Location', url);
  this.end();
};

Response.prototype.send = function send(code, msg, type) {
  if (this.sent) return;

  assert(typeof code === 'number', 'Code must be a number.');

  if (msg == null) {
    msg = {
      error: {
        type: 'Error',
        message: 'No message.'
      }
    };
  }

  if (msg && (typeof msg === 'undefined' ? 'undefined' : (0, _typeof3.default)(msg)) === 'object' && !Buffer.isBuffer(msg)) {
    msg = (0, _stringify2.default)(msg, null, 2) + '\n';
    if (!type) type = 'json';
    assert(type === 'json', 'Bad type passed with json object.');
  }

  if (!type && !this.hasType()) type = typeof msg === 'string' ? 'txt' : 'bin';

  this.setStatus(code);

  if (type) this.setType(type);

  if (typeof msg === 'string') {
    var len = Buffer.byteLength(msg, 'utf8');
    this.setHeader('Content-Length', len.toString(10));
    try {
      this.write(msg, 'utf8');
      this.end();
    } catch (e) {
      ;
    }
    return;
  }

  if (Buffer.isBuffer(msg)) {
    this.setHeader('Content-Length', msg.length.toString(10));
    try {
      this.write(msg);
      this.end();
    } catch (e) {
      ;
    }
    return;
  }

  assert(false, 'Bad object passed to send.');
};

/**
 * WebSocket
 * @constructor
 * @ignore
 * @param {SocketIO.Socket}
 */

function WebSocket(socket, ctx) {
  if (!(this instanceof WebSocket)) return new WebSocket(socket, ctx);

  EventEmitter.call(this);

  this.context = ctx;
  this.socket = socket;
  this.remoteAddress = socket.conn.remoteAddress;
  this.hooks = (0, _create2.default)(null);
  this.channels = new _map2.default();
  this.auth = false;
  this.filter = null;
  this.prev = null;
  this.next = null;

  this.init();
}

(0, _setPrototypeOf2.default)(WebSocket.prototype, EventEmitter.prototype);

WebSocket.prototype.init = function init() {
  var _this14 = this;

  var socket = this.socket;
  var onevent = socket.onevent.bind(socket);

  socket.onevent = function (packet) {
    var result = onevent(packet);
    _this14.onevent(packet);
    return result;
  };

  socket.on('error', function (err) {
    _this14.dispatch('error', err);
  });

  socket.on('disconnect', function () {
    _this14.dispatch('close');
  });
};

WebSocket.prototype.onevent = function () {
  var _ref12 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee12(packet) {
    var args, type, ack, result;
    return _regenerator2.default.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            args = (packet.data || []).slice();
            type = args.shift() || '';
            ack = void 0;

            if (typeof args[args.length - 1] === 'function') ack = args.pop();else ack = this.socket.ack(packet.id);

            result = void 0;
            _context12.prev = 5;
            _context12.next = 8;
            return this.fire(type, args);

          case 8:
            result = _context12.sent;
            _context12.next = 15;
            break;

          case 11:
            _context12.prev = 11;
            _context12.t0 = _context12['catch'](5);

            ack({
              type: _context12.t0.type || 'Error',
              message: _context12.t0.message,
              code: _context12.t0.code
            });
            return _context12.abrupt('return');

          case 15:
            if (!(result === undefined)) {
              _context12.next = 17;
              break;
            }

            return _context12.abrupt('return');

          case 17:

            ack(null, result);

          case 18:
          case 'end':
            return _context12.stop();
        }
      }
    }, _callee12, this, [[5, 11]]);
  }));

  function onevent(_x23) {
    return _ref12.apply(this, arguments);
  }

  return onevent;
}();

WebSocket.prototype.hook = function hook(type, handler) {
  assert(!this.hooks[type], 'Event already added.');
  this.hooks[type] = handler;
};

WebSocket.prototype.fire = function () {
  var _ref13 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee13(type, args) {
    var handler;
    return _regenerator2.default.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            handler = this.hooks[type];

            if (handler) {
              _context13.next = 3;
              break;
            }

            return _context13.abrupt('return', undefined);

          case 3:
            _context13.next = 5;
            return handler.call(this.context, args);

          case 5:
            return _context13.abrupt('return', _context13.sent);

          case 6:
          case 'end':
            return _context13.stop();
        }
      }
    }, _callee13, this);
  }));

  function fire(_x24, _x25) {
    return _ref13.apply(this, arguments);
  }

  return fire;
}();

WebSocket.prototype.join = function join(name) {
  this.dispatch('join channel', name);
};

WebSocket.prototype.leave = function leave(name) {
  this.dispatch('leave channel', name);
};

WebSocket.prototype.dispatch = function dispatch() {
  var emit = EventEmitter.prototype.emit;
  return emit.apply(this, arguments);
};

WebSocket.prototype.emit = function emit() {
  return this.socket.emit.apply(this.socket, arguments);
};

WebSocket.prototype.call = function call() {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  var socket = this.socket;
  return new _promise2.default(function (resolve, reject) {
    args.push(co.wrap(resolve, reject));
    socket.emit.apply(socket, args);
  });
};

WebSocket.prototype.destroy = function destroy() {
  return this.socket.disconnect();
};

/*
 * Helpers
 */

function parsePairs(str, limit) {
  var parts = str.split('&');
  var data = (0, _create2.default)(null);

  if (parts.length > limit) return data;

  assert(!limit || parts.length <= limit, 'Too many keys in querystring.');

  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(parts), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var pair = _step7.value;

      var index = pair.indexOf('=');

      var key = void 0,
          value = void 0;
      if (index === -1) {
        key = pair;
        value = '';
      } else {
        key = pair.substring(0, index);
        value = pair.substring(index + 1);
      }

      key = unescape(key);

      if (key.length === 0) continue;

      value = unescape(value);

      if (value.length === 0) continue;

      data[key] = value;
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

  return data;
}

function unescape(str) {
  try {
    str = decodeURIComponent(str);
    str = str.replace(/\+/g, ' ');
  } catch (e) {
    ;
  }
  str = str.replace(/\0/g, '');
  return str;
}

function getType(type) {
  switch (type) {
    case 'json':
      return 'application/json';
    case 'form':
      return 'application/x-www-form-urlencoded; charset=utf-8';
    case 'html':
      return 'text/html; charset=utf-8';
    case 'xml':
      return 'application/xml; charset=utf-8';
    case 'js':
      return 'application/javascript; charset=utf-8';
    case 'css':
      return 'text/css; charset=utf-8';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'bin':
      return 'application/octet-stream';
    default:
      return type;
  }
}

function parseType(type) {
  type = type || '';
  type = type.split(';')[0];
  type = type.toLowerCase();
  type = type.trim();

  switch (type) {
    case 'text/x-json':
    case 'application/json':
      return 'json';
    case 'application/x-www-form-urlencoded':
      return 'form';
    case 'text/html':
    case 'application/xhtml+xml':
      return 'html';
    case 'text/javascript':
    case 'application/javascript':
      return 'js';
    case 'text/css':
      return 'css';
    case 'text/plain':
      return 'txt';
    case 'application/octet-stream':
      return 'bin';
    default:
      return 'bin';
  }
}

/*
 * Expose
 */

module.exports = HTTPBase;