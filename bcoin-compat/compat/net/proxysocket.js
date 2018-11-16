/*!
 * proxysocket.js - wsproxy socket for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var IOClient = require('socket.io-client');
var util = require('../utils/util');
var digest = require('../crypto/digest');
var BufferWriter = require('../utils/writer');

function ProxySocket(uri) {
  if (!(this instanceof ProxySocket)) return new ProxySocket(uri);

  EventEmitter.call(this);

  this.info = null;

  this.socket = new IOClient(uri, { reconnection: false });
  this.sendBuffer = [];
  this.recvBuffer = [];
  this.paused = false;
  this.snonce = null;
  this.bytesWritten = 0;
  this.bytesRead = 0;
  this.remoteAddress = null;
  this.remotePort = 0;

  this.closed = false;

  this._init();
}

(0, _setPrototypeOf2.default)(ProxySocket.prototype, EventEmitter.prototype);

ProxySocket.prototype._init = function _init() {
  var _this = this;

  this.socket.on('info', function (info) {
    if (_this.closed) return;

    _this.info = info;

    if (info.pow) {
      _this.snonce = Buffer.from(info.snonce, 'hex');
      _this.target = Buffer.from(info.target, 'hex');
    }

    _this.emit('info', info);
  });

  this.socket.on('error', function (err) {
    console.error(err);
  });

  this.socket.on('tcp connect', function (addr, port) {
    if (_this.closed) return;
    _this.remoteAddress = addr;
    _this.remotePort = port;
    _this.emit('connect');
  });

  this.socket.on('tcp data', function (data) {
    data = Buffer.from(data, 'hex');
    if (_this.paused) {
      _this.recvBuffer.push(data);
      return;
    }
    _this.bytesRead += data.length;
    _this.emit('data', data);
  });

  this.socket.on('tcp close', function (data) {
    if (_this.closed) return;
    _this.closed = true;
    _this.emit('close');
  });

  this.socket.on('tcp error', function (e) {
    var err = new Error(e.message);
    err.code = e.code;
    _this.emit('error', err);
  });

  this.socket.on('tcp timeout', function () {
    _this.emit('timeout');
  });

  this.socket.on('disconnect', function () {
    if (_this.closed) return;
    _this.closed = true;
    _this.emit('close');
  });
};

ProxySocket.prototype.connect = function connect(port, host) {
  this.remoteAddress = host;
  this.remotePort = port;

  if (this.closed) {
    this.sendBuffer.length = 0;
    return;
  }

  if (!this.info) {
    this.once('info', connect.bind(this, port, host));
    return;
  }

  var nonce = 0;

  if (this.info.pow) {
    var bw = new BufferWriter();

    bw.writeU32(nonce);
    bw.writeBytes(this.snonce);
    bw.writeU32(port);
    bw.writeString(host, 'ascii');

    var pow = bw.render();

    util.log('Solving proof of work to create socket (%d, %s) -- please wait.', port, host);

    do {
      nonce++;
      assert(nonce <= 0xffffffff, 'Could not create socket.');
      pow.writeUInt32LE(nonce, 0, true);
    } while (digest.hash256(pow).compare(this.target) > 0);

    util.log('Solved proof of work: %d', nonce);
  }

  this.socket.emit('tcp connect', port, host, nonce);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(this.sendBuffer), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var chunk = _step.value;

      this.write(chunk);
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

  this.sendBuffer.length = 0;
};

ProxySocket.prototype.setKeepAlive = function setKeepAlive(enable, delay) {
  this.socket.emit('tcp keep alive', enable, delay);
};

ProxySocket.prototype.setNoDelay = function setNoDelay(enable) {
  this.socket.emit('tcp no delay', enable);
};

ProxySocket.prototype.setTimeout = function setTimeout(timeout, callback) {
  this.socket.emit('tcp set timeout', timeout);
  if (callback) this.on('timeout', callback);
};

ProxySocket.prototype.write = function write(data, callback) {
  if (!this.info) {
    this.sendBuffer.push(data);

    if (callback) callback();

    return true;
  }

  this.bytesWritten += data.length;

  this.socket.emit('tcp data', data.toString('hex'));

  if (callback) callback();

  return true;
};

ProxySocket.prototype.pause = function pause() {
  this.paused = true;
};

ProxySocket.prototype.resume = function resume() {
  var recv = this.recvBuffer;

  this.paused = false;
  this.recvBuffer = [];

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(recv), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var data = _step2.value;

      this.bytesRead += data.length;
      this.emit('data', data);
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
};

ProxySocket.prototype.destroy = function destroy() {
  if (this.closed) return;
  this.closed = true;
  this.socket.disconnect();
};

ProxySocket.connect = function connect(uri, port, host) {
  var socket = new ProxySocket(uri);
  socket.connect(port, host);
  return socket;
};

module.exports = ProxySocket;