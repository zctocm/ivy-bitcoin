/*!
 * rpcclient.js - json rpc client for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Network = require('../protocol/network');
var request = require('./request');

/**
 * Bcoin RPC client.
 * @alias module:http.RPCClient
 * @constructor
 * @param {String} uri
 * @param {Object?} options
 */

function RPCClient(options) {
  if (!(this instanceof RPCClient)) return new RPCClient(options);

  if (!options) options = {};

  if (typeof options === 'string') options = { uri: options };

  this.options = options;
  this.network = Network.get(options.network);

  this.uri = options.uri || 'http://localhost:' + this.network.rpcPort;
  this.apiKey = options.apiKey;
  this.id = 0;
}

/**
 * Make a json rpc request.
 * @private
 * @param {String} method - RPC method name.
 * @param {Array} params - RPC parameters.
 * @returns {Promise} - Returns Object?.
 */

RPCClient.prototype.execute = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(method, params) {
    var res;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return request({
              method: 'POST',
              uri: this.uri,
              pool: true,
              json: {
                method: method,
                params: params,
                id: this.id++
              },
              auth: {
                username: 'bitcoinrpc',
                password: this.apiKey || ''
              }
            });

          case 2:
            res = _context.sent;

            if (!(res.statusCode === 401)) {
              _context.next = 5;
              break;
            }

            throw new RPCError('Unauthorized (bad API key).', -1);

          case 5:
            if (!(res.type !== 'json')) {
              _context.next = 7;
              break;
            }

            throw new Error('Bad response (wrong content-type).');

          case 7:
            if (res.body) {
              _context.next = 9;
              break;
            }

            throw new Error('No body for JSON-RPC response.');

          case 9:
            if (!res.body.error) {
              _context.next = 11;
              break;
            }

            throw new RPCError(res.body.error.message, res.body.error.code);

          case 11:
            if (!(res.statusCode !== 200)) {
              _context.next = 13;
              break;
            }

            throw new Error('Status code: ' + res.statusCode + '.');

          case 13:
            return _context.abrupt('return', res.body.result);

          case 14:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function execute(_x, _x2) {
    return _ref.apply(this, arguments);
  }

  return execute;
}();

/*
 * Helpers
 */

function RPCError(msg, code) {
  Error.call(this);

  this.type = 'RPCError';
  this.message = String(msg);
  this.code = code >>> 0;

  if (Error.captureStackTrace) Error.captureStackTrace(this, RPCError);
}

(0, _setPrototypeOf2.default)(RPCError.prototype, Error.prototype);

/*
 * Expose
 */

module.exports = RPCClient;