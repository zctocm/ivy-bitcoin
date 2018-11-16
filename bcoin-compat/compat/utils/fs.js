/*!
 * fs.js - promisified fs module for bcoin
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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fs = require('fs');
var co = require('./co');

exports.access = co.promisify(fs.access);
exports.accessSync = fs.accessSync;
exports.appendFile = co.promisify(fs.appendFile);
exports.appendFileSync = fs.appendFileSync;
exports.chmod = co.promisify(fs.chmod);
exports.chmodSync = fs.chmodSync;
exports.chown = co.promisify(fs.chown);
exports.chownSync = fs.chownSync;
exports.close = co.promisify(fs.close);
exports.closeSync = fs.closeSync;
exports.constants = fs.constants;
exports.createReadStream = fs.createReadStream;
exports.createWriteStream = fs.createWriteStream;
exports.exists = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(file) {
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            _context.next = 3;
            return exports.stat(file);

          case 3:
            return _context.abrupt('return', true);

          case 6:
            _context.prev = 6;
            _context.t0 = _context['catch'](0);

            if (!(_context.t0.code === 'ENOENT')) {
              _context.next = 10;
              break;
            }

            return _context.abrupt('return', false);

          case 10:
            throw _context.t0;

          case 11:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, undefined, [[0, 6]]);
  }));

  return function (_x) {
    return _ref.apply(this, arguments);
  };
}();
exports.existsSync = function (file) {
  try {
    exports.statSync(file);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return false;
    throw e;
  }
};
exports.fchmod = co.promisify(fs.fchmod);
exports.fchmodSync = fs.fchmodSync;
exports.fchown = co.promisify(fs.fchown);
exports.fchownSync = fs.fchownSync;
exports.fdatasync = co.promisify(fs.fdatasync);
exports.fdatasyncSync = fs.fdatasyncSync;
exports.fstat = co.promisify(fs.fstat);
exports.fstatSync = fs.fstatSync;
exports.fsync = co.promisify(fs.fsync);
exports.fsyncSync = fs.fsyncSync;
exports.ftruncate = co.promisify(fs.ftruncate);
exports.ftruncateSync = fs.ftruncateSync;
exports.futimes = co.promisify(fs.futimes);
exports.futimesSync = fs.futimesSync;
exports.lchmod = co.promisify(fs.lchmod);
exports.lchmodSync = fs.lchmodSync;
exports.lchown = co.promisify(fs.lchown);
exports.lchownSync = fs.lchownSync;
exports.link = co.promisify(fs.link);
exports.linkSync = fs.linkSync;
exports.lstat = co.promisify(fs.lstat);
exports.lstatSync = fs.lstatSync;
exports.mkdir = co.promisify(fs.mkdir);
exports.mkdirSync = fs.mkdirSync;
exports.mkdtemp = co.promisify(fs.mkdtemp);
exports.mkdtempSync = fs.mkdtempSync;
exports.open = co.promisify(fs.open);
exports.openSync = fs.openSync;
exports.read = co.promisify(fs.read);
exports.readSync = fs.readSync;
exports.readdir = co.promisify(fs.readdir);
exports.readdirSync = fs.readdirSync;
exports.readFile = co.promisify(fs.readFile);
exports.readFileSync = fs.readFileSync;
exports.readlink = co.promisify(fs.readlink);
exports.readlinkSync = fs.readlinkSync;
exports.realpath = co.promisify(fs.realpath);
exports.realpathSync = fs.realpathSync;
exports.rename = co.promisify(fs.rename);
exports.renameSync = fs.renameSync;
exports.rmdir = co.promisify(fs.rmdir);
exports.rmdirSync = fs.rmdirSync;
exports.stat = co.promisify(fs.stat);
exports.statSync = fs.statSync;
exports.symlink = co.promisify(fs.symlink);
exports.symlinkSync = fs.symlinkSync;
exports.truncate = co.promisify(fs.truncate);
exports.truncateSync = fs.truncateSync;
exports.unlink = co.promisify(fs.unlink);
exports.unlinkSync = fs.unlinkSync;
exports.unwatchFile = fs.unwatchFile;
exports.utimes = co.promisify(fs.utimes);
exports.utimesSync = fs.utimesSync;
exports.watch = fs.watch;
exports.watchFile = fs.watchFile;
exports.write = co.promisify(fs.write);
exports.writeSync = fs.writeSync;
exports.writeFile = co.promisify(fs.writeFile);
exports.writeFileSync = fs.writeFileSync;

exports.mkdirpSync = function mkdirpSync(dir, mode) {
  if (mode == null) mode = 488;

  var _getParts = getParts(dir),
      _getParts2 = (0, _slicedToArray3.default)(_getParts, 2),
      path = _getParts2[0],
      parts = _getParts2[1];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {

    for (var _iterator = (0, _getIterator3.default)(parts), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var part = _step.value;

      path += part;

      try {
        var stat = exports.statSync(path);
        if (!stat.isDirectory()) throw new Error('Could not create directory.');
      } catch (e) {
        if (e.code === 'ENOENT') exports.mkdirSync(path, mode);else throw e;
      }

      path += '/';
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

exports.mkdirp = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(dir, mode) {
    var _getParts3, _getParts4, path, parts, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, part, stat;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (mode == null) mode = 488;

            _getParts3 = getParts(dir), _getParts4 = (0, _slicedToArray3.default)(_getParts3, 2), path = _getParts4[0], parts = _getParts4[1];
            _iteratorNormalCompletion2 = true;
            _didIteratorError2 = false;
            _iteratorError2 = undefined;
            _context2.prev = 5;
            _iterator2 = (0, _getIterator3.default)(parts);

          case 7:
            if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
              _context2.next = 30;
              break;
            }

            part = _step2.value;

            path += part;

            _context2.prev = 10;
            _context2.next = 13;
            return exports.stat(path);

          case 13:
            stat = _context2.sent;

            if (stat.isDirectory()) {
              _context2.next = 16;
              break;
            }

            throw new Error('Could not create directory.');

          case 16:
            _context2.next = 26;
            break;

          case 18:
            _context2.prev = 18;
            _context2.t0 = _context2['catch'](10);

            if (!(_context2.t0.code === 'ENOENT')) {
              _context2.next = 25;
              break;
            }

            _context2.next = 23;
            return exports.mkdir(path, mode);

          case 23:
            _context2.next = 26;
            break;

          case 25:
            throw _context2.t0;

          case 26:

            path += '/';

          case 27:
            _iteratorNormalCompletion2 = true;
            _context2.next = 7;
            break;

          case 30:
            _context2.next = 36;
            break;

          case 32:
            _context2.prev = 32;
            _context2.t1 = _context2['catch'](5);
            _didIteratorError2 = true;
            _iteratorError2 = _context2.t1;

          case 36:
            _context2.prev = 36;
            _context2.prev = 37;

            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }

          case 39:
            _context2.prev = 39;

            if (!_didIteratorError2) {
              _context2.next = 42;
              break;
            }

            throw _iteratorError2;

          case 42:
            return _context2.finish(39);

          case 43:
            return _context2.finish(36);

          case 44:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this, [[5, 32, 36, 44], [10, 18], [37,, 39, 43]]);
  }));

  function mkdirp(_x2, _x3) {
    return _ref2.apply(this, arguments);
  }

  return mkdirp;
}();

function getParts(path) {
  path = path.replace(/\\/g, '/');
  path = path.replace(/(^|\/)\.\//, '$1');
  path = path.replace(/\/+\.?$/, '');

  var parts = path.split(/\/+/);

  var root = '';

  if (process.platform === 'win32') {
    if (parts[0].indexOf(':') !== -1) root = parts.shift() + '/';
  }

  if (parts.length > 0) {
    if (parts[0].length === 0) {
      parts.shift();
      root = '/';
    }
  }

  return [root, parts];
}