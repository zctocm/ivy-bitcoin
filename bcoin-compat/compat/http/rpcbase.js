/*!
 * rpcbase.js - json rpc for bcoin.
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var Lock = require('../utils/lock');
var Logger = require('../node/logger');

/**
 * JSON RPC
 * @alias module:http.RPCBase
 * @constructor
 */

function RPCBase() {
  if (!(this instanceof RPCBase)) return new RPCBase();

  EventEmitter.call(this);

  this.logger = Logger.global;
  this.calls = (0, _create2.default)(null);
  this.mounts = [];
  this.locker = new Lock();
}

(0, _setPrototypeOf2.default)(RPCBase.prototype, EventEmitter.prototype);

/**
 * RPC errors.
 * @enum {Number}
 * @default
 */

RPCBase.errors = {
  // Standard JSON-RPC 2.0 errors
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700,

  // General application defined errors
  MISC_ERROR: -1,
  FORBIDDEN_BY_SAFE_MODE: -2,
  TYPE_ERROR: -3,
  INVALID_ADDRESS_OR_KEY: -5,
  OUT_OF_MEMORY: -7,
  INVALID_PARAMETER: -8,
  DATABASE_ERROR: -20,
  DESERIALIZATION_ERROR: -22,
  VERIFY_ERROR: -25,
  VERIFY_REJECTED: -26,
  VERIFY_ALREADY_IN_CHAIN: -27,
  IN_WARMUP: -28,

  // Aliases for backward compatibility
  TRANSACTION_ERROR: -25,
  TRANSACTION_REJECTED: -26,
  TRANSACTION_ALREADY_IN_CHAIN: -27,

  // P2P client errors
  CLIENT_NOT_CONNECTED: -9,
  CLIENT_IN_INITIAL_DOWNLOAD: -10,
  CLIENT_NODE_ALREADY_ADDED: -23,
  CLIENT_NODE_NOT_ADDED: -24,
  CLIENT_NODE_NOT_CONNECTED: -29,
  CLIENT_INVALID_IP_OR_SUBNET: -30,
  CLIENT_P2P_DISABLED: -31,

  // Wallet errors
  WALLET_ERROR: -4,
  WALLET_INSUFFICIENT_FUNDS: -6,
  WALLET_INVALID_ACCOUNT_NAME: -11,
  WALLET_KEYPOOL_RAN_OUT: -12,
  WALLET_UNLOCK_NEEDED: -13,
  WALLET_PASSPHRASE_INCORRECT: -14,
  WALLET_WRONG_ENC_STATE: -15,
  WALLET_ENCRYPTION_FAILED: -16,
  WALLET_ALREADY_UNLOCKED: -17
};

/**
 * Magic string for signing.
 * @const {String}
 * @default
 */

RPCBase.MAGIC_STRING = 'Bitcoin Signed Message:\n';

/**
 * Execute batched RPC calls.
 * @param {Object|Object[]} body
 * @param {Object} query
 * @returns {Promise}
 */

RPCBase.prototype.call = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(body, query) {
    var cmds, out, array, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, cmd, result, code;

    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            cmds = body;
            out = [];
            array = true;


            if (!Array.isArray(cmds)) {
              cmds = [cmds];
              array = false;
            }

            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 7;
            _iterator = (0, _getIterator3.default)(cmds);

          case 9:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context.next = 59;
              break;
            }

            cmd = _step.value;

            if (!(!cmd || (typeof cmd === 'undefined' ? 'undefined' : (0, _typeof3.default)(cmd)) !== 'object')) {
              _context.next = 14;
              break;
            }

            out.push({
              result: null,
              error: {
                message: 'Invalid request.',
                code: RPCBase.errors.INVALID_REQUEST
              },
              id: null
            });
            return _context.abrupt('continue', 56);

          case 14:
            if (!(cmd.id && (0, _typeof3.default)(cmd.id) === 'object')) {
              _context.next = 17;
              break;
            }

            out.push({
              result: null,
              error: {
                message: 'Invalid ID.',
                code: RPCBase.errors.INVALID_REQUEST
              },
              id: null
            });
            return _context.abrupt('continue', 56);

          case 17:

            if (cmd.id == null) cmd.id = null;

            if (!cmd.params) cmd.params = [];

            if (!(typeof cmd.method !== 'string')) {
              _context.next = 22;
              break;
            }

            out.push({
              result: null,
              error: {
                message: 'Method not found.',
                code: RPCBase.errors.METHOD_NOT_FOUND
              },
              id: cmd.id
            });
            return _context.abrupt('continue', 56);

          case 22:
            if (Array.isArray(cmd.params)) {
              _context.next = 25;
              break;
            }

            out.push({
              result: null,
              error: {
                message: 'Invalid params.',
                code: RPCBase.errors.INVALID_PARAMS
              },
              id: cmd.id
            });
            return _context.abrupt('continue', 56);

          case 25:

            if (cmd.method !== 'getwork' && cmd.method !== 'getblocktemplate' && cmd.method !== 'getbestblockhash') {
              this.logger.debug('Handling RPC call: %s.', cmd.method);
              if (cmd.method !== 'submitblock' && cmd.method !== 'getmemorypool') {
                this.logger.debug(cmd.params);
              }
            }

            if (cmd.method === 'getwork') {
              if (query.longpoll) cmd.method = 'getworklp';
            }

            result = void 0;
            _context.prev = 28;
            _context.next = 31;
            return this.execute(cmd);

          case 31:
            result = _context.sent;
            _context.next = 54;
            break;

          case 34:
            _context.prev = 34;
            _context.t0 = _context['catch'](28);
            code = void 0;
            _context.t1 = _context.t0.type;
            _context.next = _context.t1 === 'RPCError' ? 40 : _context.t1 === 'ValidationError' ? 42 : _context.t1 === 'EncodingError' ? 44 : _context.t1 === 'FundingError' ? 46 : 48;
            break;

          case 40:
            code = _context.t0.code;
            return _context.abrupt('break', 52);

          case 42:
            code = RPCBase.errors.TYPE_ERROR;
            return _context.abrupt('break', 52);

          case 44:
            code = RPCBase.errors.DESERIALIZATION_ERROR;
            return _context.abrupt('break', 52);

          case 46:
            code = RPCBase.errors.WALLET_INSUFFICIENT_FUNDS;
            return _context.abrupt('break', 52);

          case 48:
            code = RPCBase.errors.INTERNAL_ERROR;
            this.logger.error('RPC internal error.');
            this.logger.error(_context.t0);
            return _context.abrupt('break', 52);

          case 52:

            out.push({
              result: null,
              error: {
                message: _context.t0.message,
                code: code
              },
              id: cmd.id
            });

            return _context.abrupt('continue', 56);

          case 54:

            if (result === undefined) result = null;

            out.push({
              result: result,
              error: null,
              id: cmd.id
            });

          case 56:
            _iteratorNormalCompletion = true;
            _context.next = 9;
            break;

          case 59:
            _context.next = 65;
            break;

          case 61:
            _context.prev = 61;
            _context.t2 = _context['catch'](7);
            _didIteratorError = true;
            _iteratorError = _context.t2;

          case 65:
            _context.prev = 65;
            _context.prev = 66;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 68:
            _context.prev = 68;

            if (!_didIteratorError) {
              _context.next = 71;
              break;
            }

            throw _iteratorError;

          case 71:
            return _context.finish(68);

          case 72:
            return _context.finish(65);

          case 73:

            if (!array) out = out[0];

            return _context.abrupt('return', out);

          case 75:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[7, 61, 65, 73], [28, 34], [66,, 68, 72]]);
  }));

  function call(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return call;
}();

/**
 * Execute an RPC call.
 * @private
 * @param {Object} json
 * @param {Boolean} help
 * @returns {Promise}
 */

RPCBase.prototype.execute = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(json, help) {
    var func, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, mount;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            func = this.calls[json.method];

            if (func) {
              _context2.next = 31;
              break;
            }

            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context2.prev = 5;
            _iterator2 = (0, _getIterator3.default)(this.mounts);

          case 7:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context2.next = 16;
              break;
            }

            mount = _step2.value;

            if (!mount.calls[json.method]) {
              _context2.next = 13;
              break;
            }

            _context2.next = 12;
            return mount.execute(json, help);

          case 12:
            return _context2.abrupt('return', _context2.sent);

          case 13:
            _iteratorNormalCompletion2 = true;
            _context2.next = 7;
            break;

          case 16:
            _context2.next = 22;
            break;

          case 18:
            _context2.prev = 18;
            _context2.t0 = _context2['catch'](5);
            _didIteratorError2 = true;
            _iteratorError2 = _context2.t0;

          case 22:
            _context2.prev = 22;
            _context2.prev = 23;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 25:
            _context2.prev = 25;

            if (!_didIteratorError2) {
              _context2.next = 28;
              break;
            }

            throw _iteratorError2;

          case 28:
            return _context2.finish(25);

          case 29:
            return _context2.finish(22);

          case 30:
            throw new RPCError(RPCBase.errors.METHOD_NOT_FOUND, 'Method not found: ' + json.method + '.');

          case 31:
            _context2.next = 33;
            return func.call(this, json.params, help);

          case 33:
            return _context2.abrupt('return', _context2.sent);

          case 34:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[5, 18, 22, 30], [23,, 25, 29]]);
  }));

  function execute(_x3, _x4) {
    return _ref2.apply(this, arguments);
  }

  return execute;
}();

/**
 * Add a custom RPC call.
 * @param {String} name
 * @param {Function} func
 */

RPCBase.prototype.add = function add(name, func) {
  assert(typeof func === 'function', 'Handler must be a function.');
  assert(!this.calls[name], 'Duplicate RPC call.');
  this.calls[name] = func;
};

/**
 * Mount another RPC object.
 * @param {Object} rpc
 */

RPCBase.prototype.mount = function mount(rpc) {
  assert(rpc, 'RPC must be an object.');
  assert(typeof rpc.execute === 'function', 'Execute must be a method.');
  this.mounts.push(rpc);
};

/**
 * Attach to another RPC object.
 * @param {Object} rpc
 */

RPCBase.prototype.attach = function attach(rpc) {
  assert(rpc, 'RPC must be an object.');
  assert(typeof rpc.execute === 'function', 'Execute must be a method.');
  rpc.mount(this);
};

/**
 * RPC Error
 * @constructor
 * @ignore
 */

function RPCError(code, msg) {
  Error.call(this);

  assert(typeof code === 'number');
  assert(typeof msg === 'string');

  this.type = 'RPCError';
  this.message = msg;
  this.code = code;

  if (Error.captureStackTrace) Error.captureStackTrace(this, RPCError);
}

(0, _setPrototypeOf2.default)(RPCError.prototype, Error.prototype);

/*
 * Expose
 */

exports = RPCBase;
exports.RPCError = RPCError;

module.exports = exports;