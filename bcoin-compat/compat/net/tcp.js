/*!
 * tcp.js - tcp backend for bcoin
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

/* eslint prefer-arrow-callback: "off" */

'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EventEmitter = require('events');
var net = require('net');
var socks = require('./socks');

/**
 * @exports net/tcp
 */

var tcp = exports;

/**
 * Create a TCP socket and connect.
 * @param {Number} port
 * @param {String} host
 * @param {String?} proxy
 * @returns {Object}
 */

tcp.createSocket = function createSocket(port, host, proxy) {
  if (proxy) return socks.connect(proxy, port, host);
  return net.connect(port, host);
};

/**
 * Create a TCP server.
 * @returns {Object}
 */

tcp.createServer = function createServer() {
  var server = new net.Server();
  var ee = new EventEmitter();

  ee.listen = function listen(port, host) {
    return new _promise2.default(function (resolve, reject) {
      server.once('error', reject);
      server.listen(port, host, function () {
        server.removeListener('error', reject);
        resolve();
      });
    });
  };

  ee.close = function close() {
    return new _promise2.default(function (resolve, reject) {
      server.close(wrap(resolve, reject));
    });
  };

  ee.address = function address() {
    return server.address();
  };

  Object.defineProperty(ee, 'maxConnections', {
    get: function get() {
      return server.maxConnections;
    },
    set: function set(value) {
      server.maxConnections = value;
      return server.maxConnections;
    }
  });

  server.on('listening', function () {
    ee.emit('listening');
  });

  server.on('connection', function (socket) {
    ee.emit('connection', socket);
  });

  server.on('error', function (err) {
    ee.emit('error', err);
  });

  return ee;
};

/*
 * Helpers
 */

function wrap(resolve, reject) {
  return function (err, result) {
    if (err) {
      reject(err);
      return;
    }
    resolve(result);
  };
}