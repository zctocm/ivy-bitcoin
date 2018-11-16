/*!
 * config.js - configuration parsing for bcoin
 * Copyright (c) 2016-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _isSafeInteger = require('babel-runtime/core-js/number/is-safe-integer');

var _isSafeInteger2 = _interopRequireDefault(_isSafeInteger);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var Path = require('path');
var os = require('os');
var fs = require('../utils/fs');
var util = require('../utils/util');
var HOME = os.homedir ? os.homedir() : '/';

/**
 * Config Parser
 * @alias module:node.Config
 * @constructor
 * @param {String} module - Module name (e.g. `bcoin`).
 */

function Config(module) {
  if (!(this instanceof Config)) return new Config(module);

  assert(typeof module === 'string');
  assert(module.length > 0);

  this.module = module;
  this.network = 'main';
  this.prefix = Path.join(HOME, '.' + module);

  this.options = (0, _create2.default)(null);
  this.data = (0, _create2.default)(null);
  this.env = (0, _create2.default)(null);
  this.args = (0, _create2.default)(null);
  this.argv = [];
  this.pass = [];
  this.query = (0, _create2.default)(null);
  this.hash = (0, _create2.default)(null);
}

/**
 * Option name aliases.
 * @const {Object}
 */

Config.alias = {
  'seed': 'seeds',
  'node': 'nodes',
  'n': 'network'
};

/**
 * Inject options.
 * @param {Object} options
 */

Config.prototype.inject = function inject(options) {
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)((0, _keys2.default)(options)), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      var value = options[key];

      switch (key) {
        case 'hash':
        case 'query':
        case 'env':
        case 'argv':
        case 'config':
          continue;
      }

      this.set(key, value);
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
};

/**
 * Load options from hash, query, env, or args.
 * @param {Object} options
 */

Config.prototype.load = function load(options) {
  if (options.hash) this.parseHash(options.hash);

  if (options.query) this.parseQuery(options.query);

  if (options.env) this.parseEnv(options.env);

  if (options.argv) this.parseArg(options.argv);

  this.network = this.getNetwork();
  this.prefix = this.getPrefix();
};

/**
 * Open a config file.
 * @param {String} file - e.g. `bcoin.conf`.
 * @throws on IO error
 */

Config.prototype.open = function open(file) {
  if (fs.unsupported) return;

  var path = this.getFile(file);

  var text = void 0;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return;
    throw e;
  }

  this.parseConfig(text);

  this.network = this.getNetwork();
  this.prefix = this.getPrefix();
};

/**
 * Set default option.
 * @param {String} key
 * @param {Object} value
 */

Config.prototype.set = function set(key, value) {
  assert(typeof key === 'string', 'Key must be a string.');

  if (value == null) return;

  key = key.replace(/-/g, '');
  key = key.toLowerCase();

  this.options[key] = value;
};

/**
 * Test whether a config option is present.
 * @param {String} key
 * @returns {Boolean}
 */

Config.prototype.has = function has(key) {
  if (typeof key === 'number') {
    assert(key >= 0, 'Index must be positive.');
    if (key >= this.argv.length) return false;
    return true;
  }

  assert(typeof key === 'string', 'Key must be a string.');

  key = key.replace(/-/g, '');
  key = key.toLowerCase();

  if (this.hash[key] != null) return true;

  if (this.query[key] != null) return true;

  if (this.args[key] != null) return true;

  if (this.env[key] != null) return true;

  if (this.data[key] != null) return true;

  if (this.options[key] != null) return true;

  return false;
};

/**
 * Get a config option.
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Object|null}
 */

Config.prototype.get = function get(key, fallback) {
  if (fallback === undefined) fallback = null;

  if (Array.isArray(key)) {
    var keys = key;
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = (0, _getIterator3.default)(keys), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var _key = _step2.value;

        var value = this.get(_key);
        if (value !== null) return value;
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

    return fallback;
  }

  if (typeof key === 'number') {
    assert(key >= 0, 'Index must be positive.');

    if (key >= this.argv.length) return fallback;

    if (this.argv[key] != null) return this.argv[key];

    return fallback;
  }

  assert(typeof key === 'string', 'Key must be a string.');

  key = key.replace(/-/g, '');
  key = key.toLowerCase();

  if (this.hash[key] != null) return this.hash[key];

  if (this.query[key] != null) return this.query[key];

  if (this.args[key] != null) return this.args[key];

  if (this.env[key] != null) return this.env[key];

  if (this.data[key] != null) return this.data[key];

  if (this.options[key] != null) return this.options[key];

  return fallback;
};

/**
 * Get a value's type.
 * @param {String} key
 * @returns {String}
 */

Config.prototype.typeOf = function typeOf(key) {
  var value = this.get(key);

  if (value === null) return 'null';

  return typeof value === 'undefined' ? 'undefined' : (0, _typeof3.default)(value);
};

/**
 * Get a config option (as a string).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {String|null}
 */

Config.prototype.str = function str(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') throw new Error(fmt(key) + ' must be a string.');

  return value;
};

/**
 * Get a config option (as an integer).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.int = function int(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (typeof value !== 'number') throw new Error(fmt(key) + ' must be an int.');

    if (!(0, _isSafeInteger2.default)(value)) throw new Error(fmt(key) + ' must be an int.');

    return value;
  }

  if (!/^\-?\d+$/.test(value)) throw new Error(fmt(key) + ' must be an int.');

  value = parseInt(value, 10);

  if (!(0, _isSafeInteger2.default)(value)) throw new Error(fmt(key) + ' must be an int.');

  return value;
};

/**
 * Get a config option (as a unsigned integer).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.uint = function uint(key, fallback) {
  var value = this.int(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < 0) throw new Error(fmt(key) + ' must be a uint.');

  return value;
};

/**
 * Get a config option (as a float).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.float = function float(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (typeof value !== 'number') throw new Error(fmt(key) + ' must be a float.');

    if (!isFinite(value)) throw new Error(fmt(key) + ' must be a float.');

    return value;
  }

  if (!/^\-?\d*(?:\.\d*)?$/.test(value)) throw new Error(fmt(key) + ' must be a float.');

  if (!/\d/.test(value)) throw new Error(fmt(key) + ' must be a float.');

  value = parseFloat(value);

  if (!isFinite(value)) throw new Error(fmt(key) + ' must be a float.');

  return value;
};

/**
 * Get a config option (as a positive float).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.ufloat = function ufloat(key, fallback) {
  var value = this.float(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < 0) throw new Error(fmt(key) + ' must be a positive float.');

  return value;
};

/**
 * Get a value (as a fixed number).
 * @param {String} key
 * @param {Number?} exp
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.fixed = function fixed(key, exp, fallback) {
  var value = this.float(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  try {
    return util.fromFloat(value, exp || 0);
  } catch (e) {
    throw new Error(fmt(key) + ' must be a fixed number.');
  }
};

/**
 * Get a value (as a positive fixed number).
 * @param {String} key
 * @param {Number?} exp
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.ufixed = function ufixed(key, exp, fallback) {
  var value = this.fixed(key, exp);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (value < 0) throw new Error(fmt(key) + ' must be a positive fixed number.');

  return value;
};

/**
 * Get a config option (as a boolean).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Boolean|null}
 */

Config.prototype.bool = function bool(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  // Bitcoin Core compat.
  if (typeof value === 'number') {
    if (value === 1) return true;

    if (value === 0) return false;
  }

  if (typeof value !== 'string') {
    if (typeof value !== 'boolean') throw new Error(fmt(key) + ' must be a boolean.');
    return value;
  }

  if (value === 'true' || value === '1') return true;

  if (value === 'false' || value === '0') return false;

  throw new Error(fmt(key) + ' must be a boolean.');
};

/**
 * Get a config option (as a buffer).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Buffer|null}
 */

Config.prototype.buf = function buf(key, fallback, enc) {
  var value = this.get(key);

  if (!enc) enc = 'hex';

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (!Buffer.isBuffer(value)) throw new Error(fmt(key) + ' must be a buffer.');
    return value;
  }

  var data = Buffer.from(value, enc);

  if (data.length !== Buffer.byteLength(value, enc)) throw new Error(fmt(key) + ' must be a ' + enc + ' string.');

  return data;
};

/**
 * Get a config option (as an array of strings).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {String[]|null}
 */

Config.prototype.array = function array(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'string') {
    if (!Array.isArray(value)) throw new Error(fmt(key) + ' must be an array.');
    return value;
  }

  var parts = value.trim().split(/\s*,\s*/);
  var result = [];

  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(parts), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var part = _step3.value;

      if (part.length === 0) continue;

      result.push(part);
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  return result;
};

/**
 * Get a config option (as an object).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Object|null}
 */

Config.prototype.obj = function obj(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if ((typeof value === 'undefined' ? 'undefined' : (0, _typeof3.default)(value)) !== 'object') throw new Error(fmt(key) + ' must be an object.');

  return value;
};

/**
 * Get a config option (as a function).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Function|null}
 */

Config.prototype.func = function func(key, fallback) {
  var value = this.get(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  if (typeof value !== 'function') throw new Error(fmt(key) + ' must be a function.');

  return value;
};

/**
 * Get a config option (as a string).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {String|null}
 */

Config.prototype.path = function path(key, fallback) {
  var value = this.str(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  switch (value[0]) {
    case '~':
      // home dir
      value = Path.join(HOME, value.substring(1));
      break;
    case '@':
      // prefix
      value = Path.join(this.prefix, value.substring(1));
      break;
    default:
      // cwd
      break;
  }

  return Path.normalize(value);
};

/**
 * Get a config option (in MB).
 * @param {String} key
 * @param {Object?} fallback
 * @returns {Number|null}
 */

Config.prototype.mb = function mb(key, fallback) {
  var value = this.uint(key);

  if (fallback === undefined) fallback = null;

  if (value === null) return fallback;

  return value * 1024 * 1024;
};

/**
 * Grab network type from config data.
 * @private
 * @returns {String}
 */

Config.prototype.getNetwork = function getNetwork() {
  var network = this.str('network');

  if (!network) network = 'main';

  assert(isAlpha(network), 'Bad network.');

  return network;
};

/**
 * Grab prefix from config data.
 * @private
 * @returns {String}
 */

Config.prototype.getPrefix = function getPrefix() {
  var prefix = this.str('prefix');

  if (prefix) {
    if (prefix[0] === '~') prefix = Path.join(HOME, prefix.substring(1));
    return prefix;
  }

  prefix = Path.join(HOME, '.' + this.module);

  var network = this.str('network');

  if (network) {
    assert(isAlpha(network), 'Bad network.');
    if (network !== 'main') prefix = Path.join(prefix, network);
  }

  return Path.normalize(prefix);
};

/**
 * Grab config filename from config data.
 * @private
 * @param {String} file
 * @returns {String}
 */

Config.prototype.getFile = function getFile(file) {
  var name = this.str('config');

  if (name) return name;

  return Path.join(this.prefix, file);
};

/**
 * Ensure prefix.
 * @returns {Promise}
 */

Config.prototype.ensure = function ensure() {
  if (fs.unsupported) return _promise2.default.resolve();

  return fs.mkdirp(this.prefix);
};

/**
 * Create a file path using `prefix`.
 * @param {String} file
 * @returns {String}
 */

Config.prototype.location = function location(file) {
  return Path.join(this.prefix, file);
};

/**
 * Parse config text.
 * @private
 * @param {String} text
 */

Config.prototype.parseConfig = function parseConfig(text) {
  assert(typeof text === 'string', 'Config must be text.');

  if (text.charCodeAt(0) === 0xfeff) text = text.substring(1);

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/\\\n/g, '');

  var colons = true;
  var seen = false;
  var num = 0;

  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(text.split('\n')), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var chunk = _step4.value;

      var line = chunk.trim();

      num += 1;

      if (line.length === 0) continue;

      if (line[0] === '#') continue;

      var equal = line.indexOf('=');
      var colon = line.indexOf(':');

      var index = -1;

      if (colon !== -1 && (colon < equal || equal === -1)) {
        if (seen && !colons) throw new Error('Expected \'=\' on line ' + num + ': "' + line + '".');

        index = colon;
        seen = true;
        colons = true;
      } else if (equal !== -1) {
        if (seen && colons) throw new Error('Expected \':\' on line ' + num + ': "' + line + '".');

        index = equal;
        seen = true;
        colons = false;
      } else {
        var symbol = colons ? ':' : '=';
        throw new Error('Expected \'' + symbol + '\' on line ' + num + ': "' + line + '".');
      }

      var key = line.substring(0, index).trim();

      key = key.replace(/\-/g, '');

      if (!isLowerKey(key)) throw new Error('Invalid option on line ' + num + ': ' + key + '.');

      var value = line.substring(index + 1).trim();

      if (value.length === 0) continue;

      var alias = Config.alias[key];

      if (alias) key = alias;

      this.data[key] = value;
    }
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4.return) {
        _iterator4.return();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }
};

/**
 * Parse arguments.
 * @private
 * @param {Array?} argv
 */

Config.prototype.parseArg = function parseArg(argv) {
  if (!argv || (typeof argv === 'undefined' ? 'undefined' : (0, _typeof3.default)(argv)) !== 'object') argv = process.argv;

  assert(Array.isArray(argv));

  var last = null;
  var pass = false;

  for (var i = 2; i < argv.length; i++) {
    var arg = argv[i];

    assert(typeof arg === 'string');

    if (arg === '--') {
      pass = true;
      continue;
    }

    if (pass) {
      this.pass.push(arg);
      continue;
    }

    if (arg.length === 0) {
      last = null;
      continue;
    }

    if (arg.indexOf('--') === 0) {
      var index = arg.indexOf('=');

      var key = null;
      var _value = null;
      var empty = false;

      if (index !== -1) {
        // e.g. --opt=val
        key = arg.substring(2, index);
        _value = arg.substring(index + 1);
        last = null;
        empty = false;
      } else {
        // e.g. --opt
        key = arg.substring(2);
        _value = 'true';
        last = null;
        empty = true;
      }

      key = key.replace(/\-/g, '');

      if (!isLowerKey(key)) throw new Error('Invalid argument: --' + key + '.');

      if (_value.length === 0) continue;

      // Do not allow one-letter aliases.
      if (key.length > 1) {
        var alias = Config.alias[key];
        if (alias) key = alias;
      }

      this.args[key] = _value;

      if (empty) last = key;

      continue;
    }

    if (arg[0] === '-') {
      // e.g. -abc
      last = null;

      for (var j = 1; j < arg.length; j++) {
        var _key2 = arg[j];

        if ((_key2 < 'a' || _key2 > 'z') && (_key2 < 'A' || _key2 > 'Z') && (_key2 < '0' || _key2 > '9') && _key2 !== '?') {
          throw new Error('Invalid argument: -' + _key2 + '.');
        }

        var _alias = Config.alias[_key2];

        if (_alias) _key2 = _alias;

        this.args[_key2] = 'true';

        last = _key2;
      }

      continue;
    }

    // e.g. foo
    var value = arg;

    if (value.length === 0) {
      last = null;
      continue;
    }

    if (last) {
      this.args[last] = value;
      last = null;
    } else {
      this.argv.push(value);
    }
  }
};

/**
 * Parse environment variables.
 * @private
 * @param {Object?} env
 * @returns {Object}
 */

Config.prototype.parseEnv = function parseEnv(env) {
  var prefix = this.module;

  prefix = prefix.toUpperCase();
  prefix = prefix.replace(/-/g, '_');
  prefix += '_';

  if (!env || (typeof env === 'undefined' ? 'undefined' : (0, _typeof3.default)(env)) !== 'object') env = process.env;

  assert(env && (typeof env === 'undefined' ? 'undefined' : (0, _typeof3.default)(env)) === 'object');

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)((0, _keys2.default)(env)), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var key = _step5.value;

      var value = env[key];

      assert(typeof value === 'string');

      if (!util.startsWith(key, prefix)) continue;

      key = key.substring(prefix.length);
      key = key.replace(/_/g, '');

      if (!isUpperKey(key)) continue;

      if (value.length === 0) continue;

      key = key.toLowerCase();

      // Do not allow one-letter aliases.
      if (key.length > 1) {
        var alias = Config.alias[key];
        if (alias) key = alias;
      }

      this.env[key] = value;
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
};

/**
 * Parse uri querystring variables.
 * @private
 * @param {String} query
 */

Config.prototype.parseQuery = function parseQuery(query) {
  if (typeof query !== 'string') {
    if (!global.location) return {};

    query = global.location.search;

    if (typeof query !== 'string') return {};
  }

  return this.parseForm(query, this.query);
};

/**
 * Parse uri hash variables.
 * @private
 * @param {String} hash
 */

Config.prototype.parseHash = function parseHash(hash) {
  if (typeof hash !== 'string') {
    if (!global.location) return {};

    hash = global.location.hash;

    if (typeof hash !== 'string') return {};
  }

  return this.parseForm(hash, this.hash);
};

/**
 * Parse form-urlencoded variables.
 * @private
 * @param {String} query
 */

Config.prototype.parseForm = function parseForm(query, map) {
  assert(typeof query === 'string');

  if (query.length === 0) return;

  var ch = '?';

  if (map === this.hash) ch = '#';

  if (query[0] === ch) query = query.substring(1);

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(query.split('&')), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var pair = _step6.value;

      var index = pair.indexOf('=');

      var key = void 0,
          value = void 0;
      if (index !== -1) {
        key = pair.substring(0, index);
        value = pair.substring(index + 1);
      } else {
        key = pair;
        value = 'true';
      }

      key = unescape(key);
      key = key.replace(/\-/g, '');

      if (!isLowerKey(key)) continue;

      value = unescape(value);

      if (value.length === 0) continue;

      var alias = Config.alias[key];

      if (alias) key = alias;

      map[key] = value;
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
};

/*
 * Helpers
 */

function fmt(key) {
  if (Array.isArray(key)) key = key[0];

  if (typeof key === 'number') return 'Argument #' + key;

  return key;
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

function isAlpha(str) {
  return (/^[a-z0-9]+$/.test(str)
  );
}

function isKey(key) {
  return (/^[a-zA-Z0-9]+$/.test(key)
  );
}

function isLowerKey(key) {
  if (!isKey(key)) return false;

  return !/[A-Z]/.test(key);
}

function isUpperKey(key) {
  if (!isKey(key)) return false;

  return !/[a-z]/.test(key);
}

/*
 * Expose
 */

module.exports = Config;