/*!
 * external.js - external ip address discovery for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var request = require('../http/request');
var IP = require('../utils/ip');

/**
 * @exports net/external
 */

var external = exports;

/**
 * Attempt to retrieve external IP from icanhazip.com.
 * @method
 * @returns {Promise}
 */

external.getIPv4 = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var res, str, raw;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return request({
              method: 'GET',
              uri: 'http://ipv4.icanhazip.com',
              expect: 'txt',
              timeout: 2000
            });

          case 3:
            res = _context.sent;
            str = res.body.trim();
            raw = IP.toBuffer(str);

            if (IP.isIPv4(raw)) {
              _context.next = 8;
              break;
            }

            throw new Error('Could not find IPv4.');

          case 8:
            return _context.abrupt('return', IP.toString(raw));

          case 11:
            _context.prev = 11;
            _context.t0 = _context['catch'](0);
            _context.next = 15;
            return external.getIPv42();

          case 15:
            return _context.abrupt('return', _context.sent);

          case 16:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[0, 11]]);
  }));

  function getIPv4() {
    return _ref.apply(this, arguments);
  }

  return getIPv4;
}();

/**
 * Attempt to retrieve external IP from dyndns.org.
 * @method
 * @ignore
 * @returns {Promise}
 */

external.getIPv42 = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    var res, match, str, raw;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return request({
              method: 'GET',
              uri: 'http://checkip.dyndns.org',
              expect: 'html',
              timeout: 2000
            });

          case 2:
            res = _context2.sent;
            match = /IP Address:\s*([0-9a-f.:]+)/i.exec(res.body);

            if (match) {
              _context2.next = 6;
              break;
            }

            throw new Error('Could not find IPv4.');

          case 6:
            str = match[1];
            raw = IP.toBuffer(str);

            if (IP.isIPv4(raw)) {
              _context2.next = 10;
              break;
            }

            throw new Error('Could not find IPv4.');

          case 10:
            return _context2.abrupt('return', IP.toString(raw));

          case 11:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function getIPv42() {
    return _ref2.apply(this, arguments);
  }

  return getIPv42;
}();

/**
 * Attempt to retrieve external IP from icanhazip.com.
 * @method
 * @returns {Promise}
 */

external.getIPv6 = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    var res, str, raw;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return request({
              method: 'GET',
              uri: 'http://ipv6.icanhazip.com',
              expect: 'txt',
              timeout: 2000
            });

          case 2:
            res = _context3.sent;
            str = res.body.trim();
            raw = IP.toBuffer(str);

            if (IP.isIPv6(raw)) {
              _context3.next = 7;
              break;
            }

            throw new Error('Could not find IPv6.');

          case 7:
            return _context3.abrupt('return', IP.toString(raw));

          case 8:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function getIPv6() {
    return _ref3.apply(this, arguments);
  }

  return getIPv6;
}();