/*!
 * node.js - node object for bcoin
 * Copyright (c) 2014-2015, Fedor Indutny (MIT License)
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _setPrototypeOf = require('babel-runtime/core-js/object/set-prototype-of');

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var AsyncObject = require('../utils/asyncobject');
var util = require('../utils/util');
var Network = require('../protocol/network');
var Logger = require('./logger');
var WorkerPool = require('../workers/workerpool');
var secp256k1 = require('../crypto/secp256k1');
var native = require('../native');
var Config = require('./config');

/**
 * Base class from which every other
 * Node-like object inherits.
 * @alias module:node.Node
 * @constructor
 * @abstract
 * @param {Object} options
 */

function Node(options) {
  if (!(this instanceof Node)) return new Node(options);

  AsyncObject.call(this);

  this.config = new Config('bcoin');
  this.config.inject(options);
  this.config.load(options);

  if (options.config) this.config.open('bcoin.conf');

  this.network = Network.get(this.config.network);
  this.startTime = -1;
  this.bound = [];
  this.plugins = (0, _create2.default)(null);
  this.stack = [];

  this.logger = null;
  this.workers = null;

  this.spv = false;
  this.chain = null;
  this.fees = null;
  this.mempool = null;
  this.pool = null;
  this.miner = null;
  this.http = null;

  this.init();
}

(0, _setPrototypeOf2.default)(Node.prototype, AsyncObject.prototype);

/**
 * Initialize options.
 * @private
 * @param {Object} options
 */

Node.prototype.initOptions = function initOptions() {
  var logger = new Logger();
  var config = this.config;

  if (config.has('logger')) logger = config.obj('logger');

  logger.set({
    filename: config.bool('log-file') ? config.location('debug.log') : null,
    level: config.str('log-level'),
    console: config.bool('log-console'),
    shrink: config.bool('log-shrink')
  });

  this.logger = logger.context('node');

  this.workers = new WorkerPool({
    enabled: config.bool('workers'),
    size: config.uint('workers-size'),
    timeout: config.uint('workers-timeout'),
    file: config.str('worker-file')
  });
};

/**
 * Initialize node.
 * @private
 * @param {Object} options
 */

Node.prototype.init = function init() {
  var _this = this;

  this.initOptions();

  this.on('error', function () {});

  this.workers.on('spawn', function (child) {
    _this.logger.info('Spawning worker process: %d.', child.id);
  });

  this.workers.on('exit', function (code, child) {
    _this.logger.warning('Worker %d exited: %s.', child.id, code);
  });

  this.workers.on('log', function (text, child) {
    _this.logger.debug('Worker %d says:', child.id);
    _this.logger.debug(text);
  });

  this.workers.on('error', function (err, child) {
    if (child) {
      _this.logger.error('Worker %d error: %s', child.id, err.message);
      return;
    }
    _this.emit('error', err);
  });

  this.hook('preopen', function () {
    return _this.handlePreopen();
  });
  this.hook('preclose', function () {
    return _this.handlePreclose();
  });
  this.hook('open', function () {
    return _this.handleOpen();
  });
  this.hook('close', function () {
    return _this.handleClose();
  });
};

/**
 * Ensure prefix directory.
 * @returns {Promise}
 */

Node.prototype.ensure = function ensure() {
  return this.config.ensure();
};

/**
 * Create a file path using `prefix`.
 * @param {String} file
 * @returns {String}
 */

Node.prototype.location = function location(name) {
  return this.config.location(name);
};

/**
 * Open node. Bind all events.
 * @private
 */

Node.prototype.handlePreopen = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var _this2 = this;

    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.logger.open();

          case 2:
            _context.next = 4;
            return this.workers.open();

          case 4:

            this.bind(this.network.time, 'offset', function (offset) {
              _this2.logger.info('Time offset: %d (%d minutes).', offset, offset / 60 | 0);
            });

            this.bind(this.network.time, 'sample', function (sample, total) {
              _this2.logger.debug('Added time data: samples=%d, offset=%d (%d minutes).', total, sample, sample / 60 | 0);
            });

            this.bind(this.network.time, 'mismatch', function () {
              _this2.logger.warning('Adjusted time mismatch!');
              _this2.logger.warning('Please make sure your system clock is correct!');
            });

          case 7:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  function handlePreopen() {
    return _ref.apply(this, arguments);
  }

  return handlePreopen;
}();

/**
 * Open node.
 * @private
 */

Node.prototype.handleOpen = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            this.startTime = util.now();

            if (!secp256k1.binding) {
              this.logger.warning('Warning: secp256k1-node was not built.');
              this.logger.warning('Verification will be slow.');
            }

            if (!native.binding) {
              this.logger.warning('Warning: bcoin-native was not built.');
              this.logger.warning('Hashing will be slow.');
            }

            if (!this.workers.enabled) {
              this.logger.warning('Warning: worker pool is disabled.');
              this.logger.warning('Verification will be slow.');
            }

          case 4:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function handleOpen() {
    return _ref2.apply(this, arguments);
  }

  return handleOpen;
}();

/**
 * Open node. Bind all events.
 * @private
 */

Node.prototype.handlePreclose = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3() {
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            ;

          case 1:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));

  function handlePreclose() {
    return _ref3.apply(this, arguments);
  }

  return handlePreclose;
}();

/**
 * Close node. Unbind all events.
 * @private
 */

Node.prototype.handleClose = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4() {
    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, _ref5, _ref6, obj, event, listener;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context4.prev = 3;

            for (_iterator = (0, _getIterator3.default)(this.bound); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              _ref5 = _step.value;
              _ref6 = (0, _slicedToArray3.default)(_ref5, 3);
              obj = _ref6[0];
              event = _ref6[1];
              listener = _ref6[2];

              obj.removeListener(event, listener);
            }_context4.next = 11;
            break;

          case 7:
            _context4.prev = 7;
            _context4.t0 = _context4['catch'](3);
            _didIteratorError = true;
            _iteratorError = _context4.t0;

          case 11:
            _context4.prev = 11;
            _context4.prev = 12;

            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }

          case 14:
            _context4.prev = 14;

            if (!_didIteratorError) {
              _context4.next = 17;
              break;
            }

            throw _iteratorError;

          case 17:
            return _context4.finish(14);

          case 18:
            return _context4.finish(11);

          case 19:
            this.bound.length = 0;
            this.startTime = -1;

            _context4.next = 23;
            return this.workers.close();

          case 23:
            _context4.next = 25;
            return this.logger.close();

          case 25:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this, [[3, 7, 11, 19], [12,, 14, 18]]);
  }));

  function handleClose() {
    return _ref4.apply(this, arguments);
  }

  return handleClose;
}();

/**
 * Bind to an event on `obj`, save listener for removal.
 * @private
 * @param {EventEmitter} obj
 * @param {String} event
 * @param {Function} listener
 */

Node.prototype.bind = function bind(obj, event, listener) {
  this.bound.push([obj, event, listener]);
  obj.on(event, listener);
};

/**
 * Emit and log an error.
 * @private
 * @param {Error} err
 */

Node.prototype.error = function error(err) {
  this.logger.error(err);
  this.emit('error', err);
};

/**
 * Get node uptime in seconds.
 * @returns {Number}
 */

Node.prototype.uptime = function uptime() {
  if (this.startTime === -1) return 0;

  return util.now() - this.startTime;
};

/**
 * Attach a plugin.
 * @param {Object} plugin
 * @returns {Object} Plugin instance.
 */

Node.prototype.use = function use(plugin) {
  var _this3 = this;

  assert(plugin, 'Plugin must be an object.');
  assert(typeof plugin.init === 'function', '`init` must be a function.');

  assert(!this.loaded, 'Cannot add plugin after node is loaded.');

  var instance = plugin.init(this);

  assert(!instance.open || typeof instance.open === 'function', '`open` must be a function.');
  assert(!instance.close || typeof instance.close === 'function', '`close` must be a function.');

  if (plugin.id) {
    assert(typeof plugin.id === 'string', '`id` must be a string.');

    // Reserved names
    switch (plugin.id) {
      case 'chain':
      case 'fees':
      case 'mempool':
      case 'miner':
      case 'pool':
      case 'rpc':
      case 'http':
        assert(false, plugin.id + ' is already added.');
        break;
    }

    assert(!this.plugins[plugin.id], plugin.id + ' is already added.');

    this.plugins[plugin.id] = instance;
  }

  this.stack.push(instance);

  if (typeof instance.on === 'function') instance.on('error', function (err) {
    return _this3.error(err);
  });

  return instance;
};

/**
 * Test whether a plugin is available.
 * @param {String} name
 * @returns {Boolean}
 */

Node.prototype.has = function has(name) {
  return this.plugins[name] != null;
};

/**
 * Get a plugin.
 * @param {String} name
 * @returns {Object|null}
 */

Node.prototype.get = function get(name) {
  assert(typeof name === 'string', 'Plugin name must be a string.');

  // Reserved names.
  switch (name) {
    case 'chain':
      assert(this.chain, 'chain is not loaded.');
      return this.chain;
    case 'fees':
      assert(this.fees, 'fees is not loaded.');
      return this.fees;
    case 'mempool':
      assert(this.mempool, 'mempool is not loaded.');
      return this.mempool;
    case 'miner':
      assert(this.miner, 'miner is not loaded.');
      return this.miner;
    case 'pool':
      assert(this.pool, 'pool is not loaded.');
      return this.pool;
    case 'rpc':
      assert(this.rpc, 'rpc is not loaded.');
      return this.rpc;
    case 'http':
      assert(this.http, 'http is not loaded.');
      return this.http;
  }

  return this.plugins[name] || null;
};

/**
 * Require a plugin.
 * @param {String} name
 * @returns {Object}
 * @throws {Error} on onloaded plugin
 */

Node.prototype.require = function require(name) {
  var plugin = this.get(name);
  assert(plugin, name + ' is not loaded.');
  return plugin;
};

/**
 * Load plugins.
 * @private
 */

Node.prototype.loadPlugins = function loadPlugins() {
  var plugins = this.config.array('plugins', []);
  var loader = this.config.func('loader');

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(plugins), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var plugin = _step2.value;

      if (typeof plugin === 'string') {
        assert(loader, 'Must pass a loader function.');
        plugin = loader(plugin);
      }
      this.use(plugin);
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

/**
 * Open plugins.
 * @private
 */

Node.prototype.openPlugins = function () {
  var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    var _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, plugin;

    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _iteratorNormalCompletion3 = true;
            _didIteratorError3 = false;
            _iteratorError3 = undefined;
            _context5.prev = 3;
            _iterator3 = (0, _getIterator3.default)(this.stack);

          case 5:
            if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
              _context5.next = 13;
              break;
            }

            plugin = _step3.value;

            if (!plugin.open) {
              _context5.next = 10;
              break;
            }

            _context5.next = 10;
            return plugin.open();

          case 10:
            _iteratorNormalCompletion3 = true;
            _context5.next = 5;
            break;

          case 13:
            _context5.next = 19;
            break;

          case 15:
            _context5.prev = 15;
            _context5.t0 = _context5['catch'](3);
            _didIteratorError3 = true;
            _iteratorError3 = _context5.t0;

          case 19:
            _context5.prev = 19;
            _context5.prev = 20;

            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }

          case 22:
            _context5.prev = 22;

            if (!_didIteratorError3) {
              _context5.next = 25;
              break;
            }

            throw _iteratorError3;

          case 25:
            return _context5.finish(22);

          case 26:
            return _context5.finish(19);

          case 27:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this, [[3, 15, 19, 27], [20,, 22, 26]]);
  }));

  function openPlugins() {
    return _ref7.apply(this, arguments);
  }

  return openPlugins;
}();

/**
 * Close plugins.
 * @private
 */

Node.prototype.closePlugins = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6() {
    var _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, plugin;

    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            _iteratorNormalCompletion4 = true;
            _didIteratorError4 = false;
            _iteratorError4 = undefined;
            _context6.prev = 3;
            _iterator4 = (0, _getIterator3.default)(this.stack);

          case 5:
            if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
              _context6.next = 13;
              break;
            }

            plugin = _step4.value;

            if (!plugin.close) {
              _context6.next = 10;
              break;
            }

            _context6.next = 10;
            return plugin.close();

          case 10:
            _iteratorNormalCompletion4 = true;
            _context6.next = 5;
            break;

          case 13:
            _context6.next = 19;
            break;

          case 15:
            _context6.prev = 15;
            _context6.t0 = _context6['catch'](3);
            _didIteratorError4 = true;
            _iteratorError4 = _context6.t0;

          case 19:
            _context6.prev = 19;
            _context6.prev = 20;

            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }

          case 22:
            _context6.prev = 22;

            if (!_didIteratorError4) {
              _context6.next = 25;
              break;
            }

            throw _iteratorError4;

          case 25:
            return _context6.finish(22);

          case 26:
            return _context6.finish(19);

          case 27:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this, [[3, 15, 19, 27], [20,, 22, 26]]);
  }));

  function closePlugins() {
    return _ref8.apply(this, arguments);
  }

  return closePlugins;
}();

/*
 * Expose
 */

module.exports = Node;