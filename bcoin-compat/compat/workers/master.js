/*!
 * master.js - master process for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var EventEmitter = require('events');
var util = require('../utils/util');
var Network = require('../protocol/network');
var jobs = require('./jobs');
var Parser = require('./parser');
var Framer = require('./framer');
var packets = require('./packets');
var Parent = require('./parent');

/**
 * Represents the master process.
 * @alias module:workers.Master
 * @constructor
 */

function Master() {
  if (!(this instanceof Master)) return new Master();

  EventEmitter.call(this);

  this.parent = new Parent();
  this.framer = new Framer();
  this.parser = new Parser();
  this.listening = false;
  this.color = false;

  this.init();
}

(0, _setPrototypeOf2.default)(Master.prototype, EventEmitter.prototype);

/**
 * Initialize master. Bind events.
 * @private
 */

Master.prototype.init = function init() {
  var _this = this;

  this.parent.on('data', function (data) {
    _this.parser.feed(data);
  });

  this.parent.on('error', function (err) {
    _this.emit('error', err);
  });

  this.parent.on('exception', function (err) {
    _this.send(new packets.ErrorPacket(err));
    setTimeout(function () {
      return _this.destroy();
    }, 1000);
  });

  this.parser.on('error', function (err) {
    _this.emit('error', err);
  });

  this.parser.on('packet', function (packet) {
    _this.emit('packet', packet);
  });
};

/**
 * Set environment.
 * @param {Object} env
 */

Master.prototype.setEnv = function setEnv(env) {
  this.color = env.BCOIN_WORKER_ISTTY === '1';
  this.set(env.BCOIN_WORKER_NETWORK);
};

/**
 * Set primary network.
 * @param {NetworkType|Network} network
 */

Master.prototype.set = function set(network) {
  return Network.set(network);
};

/**
 * Send data to worker.
 * @param {Buffer} data
 * @returns {Boolean}
 */

Master.prototype.write = function write(data) {
  return this.parent.write(data);
};

/**
 * Frame and send a packet.
 * @param {Packet} packet
 * @returns {Boolean}
 */

Master.prototype.send = function send(packet) {
  return this.write(this.framer.packet(packet));
};

/**
 * Emit an event on the worker side.
 * @param {String} event
 * @param {...Object} arg
 * @returns {Boolean}
 */

Master.prototype.sendEvent = function sendEvent() {
  for (var _len = arguments.length, items = Array(_len), _key = 0; _key < _len; _key++) {
    items[_key] = arguments[_key];
  }

  return this.send(new packets.EventPacket(items));
};

/**
 * Destroy the worker.
 */

Master.prototype.destroy = function destroy() {
  return this.parent.destroy();
};

/**
 * Write a message to stdout in the master process.
 * @param {Object|String} obj
 * @param {...String} args
 */

Master.prototype.log = function log() {
  for (var _len2 = arguments.length, items = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    items[_key2] = arguments[_key2];
  }

  var text = util.format(items, this.color);
  this.send(new packets.LogPacket(text));
};

/**
 * Listen for messages from master process (only if worker).
 */

Master.prototype.listen = function listen() {
  var _this2 = this;

  assert(!this.listening, 'Already listening.');

  this.listening = true;

  this.on('error', function (err) {
    _this2.send(new packets.ErrorPacket(err));
  });

  this.on('packet', function (packet) {
    try {
      _this2.handlePacket(packet);
    } catch (e) {
      _this2.emit('error', e);
    }
  });
};

/**
 * Handle packet.
 * @private
 * @param {Packet}
 */

Master.prototype.handlePacket = function handlePacket(packet) {
  var result = void 0;

  switch (packet.cmd) {
    case packets.types.ENV:
      this.setEnv(packet.env);
      break;
    case packets.types.EVENT:
      this.emit('event', packet.items);
      this.emit.apply(this, (0, _toConsumableArray3.default)(packet.items));
      break;
    case packets.types.ERROR:
      this.emit('error', packet.error);
      break;
    default:
      result = jobs.execute(packet);
      result.id = packet.id;
      this.send(result);
      break;
  }
};

/*
 * Expose
 */

module.exports = Master;