/*!
 * upnp.js - upnp for bcoin
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assert = require('assert');
var dgram = require('dgram');
var url = require('url');
var request = require('../http/request');
var co = require('../utils/co');
var Lock = require('../utils/lock');
var IP = require('../utils/ip');

/**
 * UPNP
 * @alias module:net.UPNP
 * @constructor
 * @param {String?} host - Multicast IP.
 * @param {Number?} port - Multicast port.
 * @param {String?} gateway - Gateway name.
 */

function UPNP(host, port, gateway) {
  if (!(this instanceof UPNP)) return new UPNP(host, port, gateway);

  this.host = host || '239.255.255.250';
  this.port = port || 1900;
  this.gateway = gateway || UPNP.INTERNET_GATEWAY;
  this.locker = new Lock();
  this.timeout = null;
  this.job = null;
}

/**
 * Default internet gateway string.
 * @const {String}
 * @default
 */

UPNP.INTERNET_GATEWAY = 'urn:schemas-upnp-org:device:InternetGatewayDevice:1';

/**
 * Default service types.
 * @const {String[]}
 * @default
 */

UPNP.WAN_SERVICES = ['urn:schemas-upnp-org:service:WANIPConnection:1', 'urn:schemas-upnp-org:service:WANPPPConnection:1'];

/**
 * Timeout before killing request.
 * @const {Number}
 * @default
 */

UPNP.RESPONSE_TIMEOUT = 1000;

/**
 * Clean up current job.
 * @private
 * @returns {Job}
 */

UPNP.prototype.cleanupJob = function cleanupJob() {
  var job = this.job;

  assert(this.socket);
  assert(this.job);

  this.job = null;

  this.socket.close();
  this.socket = null;

  this.stopTimeout();

  return job;
};

/**
 * Reject current job.
 * @private
 * @param {Error} err
 */

UPNP.prototype.rejectJob = function rejectJob(err) {
  var job = this.cleanupJob();
  job.reject(err);
};

/**
 * Resolve current job.
 * @private
 * @param {Object} result
 */

UPNP.prototype.resolveJob = function resolveJob(result) {
  var job = this.cleanupJob();
  job.resolve(result);
};

/**
 * Start gateway timeout.
 * @private
 */

UPNP.prototype.startTimeout = function startTimeout() {
  var _this = this;

  this.stopTimeout();
  this.timeout = setTimeout(function () {
    _this.timeout = null;
    _this.rejectJob(new Error('Request timed out.'));
  }, UPNP.RESPONSE_TIMEOUT);
};

/**
 * Stop gateway timeout.
 * @private
 */

UPNP.prototype.stopTimeout = function stopTimeout() {
  if (this.timeout != null) {
    clearTimeout(this.timeout);
    this.timeout = null;
  }
};

/**
 * Discover gateway.
 * @returns {Promise} Location string.
 */

UPNP.prototype.discover = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
    var unlock;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return this.locker.lock();

          case 2:
            unlock = _context.sent;
            _context.prev = 3;
            _context.next = 6;
            return this._discover();

          case 6:
            return _context.abrupt('return', _context.sent);

          case 7:
            _context.prev = 7;

            unlock();
            return _context.finish(7);

          case 10:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this, [[3,, 7, 10]]);
  }));

  function discover() {
    return _ref.apply(this, arguments);
  }

  return discover;
}();

/**
 * Discover gateway (without a lock).
 * @private
 * @returns {Promise} Location string.
 */

UPNP.prototype._discover = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2() {
    var _this2 = this;

    var socket, msg;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            socket = dgram.createSocket('udp4');


            socket.on('error', function (err) {
              _this2.rejectJob(err);
            });

            socket.on('message', function (data, rinfo) {
              var msg = data.toString('utf8');
              _this2.handleMsg(msg);
            });

            this.socket = socket;
            this.startTimeout();

            msg = '' + 'M-SEARCH * HTTP/1.1\r\n' + ('HOST: ' + this.host + ':' + this.port + '\r\n') + 'MAN: ssdp:discover\r\n' + 'MX: 10\r\n' + 'ST: ssdp:all\r\n';


            socket.send(msg, this.port, this.host);

            _context2.next = 9;
            return new _promise2.default(function (resolve, reject) {
              _this2.job = co.job(resolve, reject);
            });

          case 9:
            return _context2.abrupt('return', _context2.sent);

          case 10:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  function _discover() {
    return _ref2.apply(this, arguments);
  }

  return _discover;
}();

/**
 * Handle incoming UDP message.
 * @private
 * @param {String} msg
 * @returns {Promise}
 */

UPNP.prototype.handleMsg = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(msg) {
    var headers;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (this.socket) {
              _context3.next = 2;
              break;
            }

            return _context3.abrupt('return');

          case 2:
            headers = void 0;
            _context3.prev = 3;

            headers = UPNP.parseHeader(msg);
            _context3.next = 10;
            break;

          case 7:
            _context3.prev = 7;
            _context3.t0 = _context3['catch'](3);
            return _context3.abrupt('return');

          case 10:
            if (headers.location) {
              _context3.next = 12;
              break;
            }

            return _context3.abrupt('return');

          case 12:
            if (!(headers.st !== this.gateway)) {
              _context3.next = 14;
              break;
            }

            return _context3.abrupt('return');

          case 14:

            this.resolveJob(headers.location);

          case 15:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, this, [[3, 7]]);
  }));

  function handleMsg(_x) {
    return _ref3.apply(this, arguments);
  }

  return handleMsg;
}();

/**
 * Resolve service parameters from location.
 * @param {String} location
 * @param {String[]} targets - Target services.
 * @returns {Promise}
 */

UPNP.prototype.resolve = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(location, targets) {
    var host, res, xml, services, service;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            host = parseHost(location);


            if (!targets) targets = UPNP.WAN_SERVICES;

            _context4.next = 4;
            return request({
              method: 'GET',
              uri: location,
              timeout: UPNP.RESPONSE_TIMEOUT,
              expect: 'xml'
            });

          case 4:
            res = _context4.sent;
            xml = XMLElement.fromRaw(res.body);
            services = parseServices(xml);

            assert(services.length > 0, 'No services found.');

            service = extractServices(services, targets);

            assert(service, 'No service found.');
            assert(service.serviceId, 'No service ID found.');
            assert(service.serviceId.length > 0, 'No service ID found.');
            assert(service.controlURL, 'No control URL found.');
            assert(service.controlURL.length > 0, 'No control URL found.');

            service.controlURL = prependHost(host, service.controlURL);

            if (service.eventSubURL) service.eventSubURL = prependHost(host, service.eventSubURL);

            if (service.SCPDURL) service.SCPDURL = prependHost(host, service.SCPDURL);

            return _context4.abrupt('return', service);

          case 18:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  function resolve(_x2, _x3) {
    return _ref4.apply(this, arguments);
  }

  return resolve;
}();

/**
 * Parse UPNP datagram.
 * @private
 * @param {String} str
 * @returns {Object}
 */

UPNP.parseHeader = function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var headers = (0, _create2.default)(null);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = (0, _getIterator3.default)(lines), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var line = _step.value;

      line = line.trim();

      if (line.length === 0) continue;

      var index = line.indexOf(':');

      if (index === -1) {
        var _left = line.toLowerCase();
        headers[_left] = '';
        continue;
      }

      var left = line.substring(0, index);
      var right = line.substring(index + 1);

      left = left.trim();
      right = right.trim();

      left = left.toLowerCase();

      headers[left] = right;
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

  return headers;
};

/**
 * Discover gateway and resolve service.
 * @param {String?} host - Multicast IP.
 * @param {Number?} port - Multicast port.
 * @param {String?} gateway - Gateway type.
 * @param {String[]?} targets - Target service types.
 * @returns {Promise} Service.
 */

UPNP.discover = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(host, port, gateway, targets) {
    var upnp, location, service;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            upnp = new UPNP(host, port, gateway);
            _context5.next = 3;
            return upnp.discover();

          case 3:
            location = _context5.sent;
            _context5.next = 6;
            return upnp.resolve(location, targets);

          case 6:
            service = _context5.sent;
            return _context5.abrupt('return', new UPNPService(service));

          case 8:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, this);
  }));

  function discover(_x4, _x5, _x6, _x7) {
    return _ref5.apply(this, arguments);
  }

  return discover;
}();

/**
 * Gateway Service
 * @constructor
 * @ignore
 * @param {Object} options - Service parameters.
 */

function UPNPService(options) {
  if (!(this instanceof UPNPService)) return new UPNPService(options);

  this.serviceType = options.serviceType;
  this.serviceId = options.serviceId;
  this.controlURL = options.controlURL;
  this.eventSubURL = options.eventSubURL;
  this.SCPDURL = options.SCPDURL;
}

/**
 * Compile SOAP request.
 * @private
 * @param {String} action
 * @param {String[]} args
 * @returns {String}
 */

UPNPService.prototype.createRequest = function createRequest(action, args) {
  var type = (0, _stringify2.default)(this.serviceType);

  var params = '';

  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = (0, _getIterator3.default)(args), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var _ref6 = _step2.value;

      var _ref7 = (0, _slicedToArray3.default)(_ref6, 2);

      var key = _ref7[0];
      var value = _ref7[1];

      params += '<' + key + '>';
      if (value != null) params += value;
      params += '</' + key + '>';
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

  return '' + '<?xml version="1.0"?>' + '<s:Envelope' + ' xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"' + ' s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' + '<s:Body>' + ('<u:' + action + ' xmlns:u=' + type + '>') + ('' + params) + ('</u:' + action + '>') + '</s:Body>' + '</s:Envelope>';
};

/**
 * Send SOAP request and parse XML response.
 * @private
 * @param {String} action
 * @param {String[]} args
 * @returns {XMLElement}
 */

UPNPService.prototype.soapRequest = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(action, args) {
    var type, req, res, xml, err;
    return _regenerator2.default.wrap(function _callee6$(_context6) {
      while (1) {
        switch (_context6.prev = _context6.next) {
          case 0:
            type = this.serviceType;
            req = this.createRequest(action, args);
            _context6.next = 4;
            return request({
              method: 'POST',
              uri: this.controlURL,
              timeout: UPNP.RESPONSE_TIMEOUT,
              expect: 'xml',
              headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'Content-Length': Buffer.byteLength(req, 'utf8').toString(10),
                'Connection': 'close',
                'SOAPAction': (0, _stringify2.default)(type + '#' + action)
              },
              body: req
            });

          case 4:
            res = _context6.sent;
            xml = XMLElement.fromRaw(res.body);
            err = findError(xml);

            if (!err) {
              _context6.next = 9;
              break;
            }

            throw err;

          case 9:
            return _context6.abrupt('return', xml);

          case 10:
          case 'end':
            return _context6.stop();
        }
      }
    }, _callee6, this);
  }));

  function soapRequest(_x8, _x9) {
    return _ref8.apply(this, arguments);
  }

  return soapRequest;
}();

/**
 * Attempt to get external IP from service (wan).
 * @returns {Promise}
 */

UPNPService.prototype.getExternalIP = function () {
  var _ref9 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
    var action, xml, ip;
    return _regenerator2.default.wrap(function _callee7$(_context7) {
      while (1) {
        switch (_context7.prev = _context7.next) {
          case 0:
            action = 'GetExternalIPAddress';
            _context7.next = 3;
            return this.soapRequest(action, []);

          case 3:
            xml = _context7.sent;
            ip = findIP(xml);

            if (ip) {
              _context7.next = 7;
              break;
            }

            throw new Error('Could not find external IP.');

          case 7:
            return _context7.abrupt('return', ip);

          case 8:
          case 'end':
            return _context7.stop();
        }
      }
    }, _callee7, this);
  }));

  function getExternalIP() {
    return _ref9.apply(this, arguments);
  }

  return getExternalIP;
}();

/**
 * Attempt to add port mapping to local IP.
 * @param {String} remote - Remote IP.
 * @param {Number} src - Remote port.
 * @param {Number} dest - Local port.
 * @returns {Promise}
 */

UPNPService.prototype.addPortMapping = function () {
  var _ref10 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee8(remote, src, dest) {
    var action, local, xml, child;
    return _regenerator2.default.wrap(function _callee8$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            action = 'AddPortMapping';
            local = IP.getPrivate();

            if (!(local.length === 0)) {
              _context8.next = 4;
              break;
            }

            throw new Error('Cannot determine local IP.');

          case 4:
            _context8.next = 6;
            return this.soapRequest(action, [['NewRemoteHost', remote], ['NewExternalPort', src], ['NewProtocol', 'TCP'], ['NewInternalClient', local[0]], ['NewInternalPort', dest], ['NewEnabled', 'True'], ['NewPortMappingDescription', 'upnp:bcoin'], ['NewLeaseDuration', 0]]);

          case 6:
            xml = _context8.sent;
            child = xml.find('AddPortMappingResponse');

            if (child) {
              _context8.next = 10;
              break;
            }

            throw new Error('Port mapping failed.');

          case 10:
            return _context8.abrupt('return', child.text);

          case 11:
          case 'end':
            return _context8.stop();
        }
      }
    }, _callee8, this);
  }));

  function addPortMapping(_x10, _x11, _x12) {
    return _ref10.apply(this, arguments);
  }

  return addPortMapping;
}();

/**
 * Attempt to remove port mapping from local IP.
 * @param {String} remote - Remote IP.
 * @param {Number} port - Remote port.
 * @returns {Promise}
 */

UPNPService.prototype.removePortMapping = function () {
  var _ref11 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee9(remote, port) {
    var action, xml, child;
    return _regenerator2.default.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            action = 'DeletePortMapping';
            _context9.next = 3;
            return this.soapRequest(action, [['NewRemoteHost', remote], ['NewExternalPort', port], ['NewProtocol', 'TCP']]);

          case 3:
            xml = _context9.sent;
            child = xml.find('DeletePortMappingResponse');

            if (child) {
              _context9.next = 7;
              break;
            }

            throw new Error('Port unmapping failed.');

          case 7:
            return _context9.abrupt('return', child.text);

          case 8:
          case 'end':
            return _context9.stop();
        }
      }
    }, _callee9, this);
  }));

  function removePortMapping(_x13, _x14) {
    return _ref11.apply(this, arguments);
  }

  return removePortMapping;
}();

/**
 * XML Element
 * @constructor
 * @ignore
 */

function XMLElement(name) {
  this.name = name;
  this.type = name.replace(/^[^:]:/, '');
  this.children = [];
  this.text = '';
}

/**
 * Insantiate element from raw XML.
 * @param {String} xml
 * @returns {XMLElement}
 */

XMLElement.fromRaw = function fromRaw(xml) {
  var sentinel = new XMLElement('');
  var stack = [sentinel];

  var current = sentinel;
  var decl = false;

  while (xml.length > 0) {
    var m = void 0;

    m = /^<\?xml[^<>]*\?>/i.exec(xml);
    if (m) {
      xml = xml.substring(m[0].length);
      assert(current === sentinel, 'XML declaration inside element.');
      assert(!decl, 'XML declaration seen twice.');
      decl = true;
      continue;
    }

    m = /^<([\w:]+)[^<>]*?(\/?)>/i.exec(xml);
    if (m) {
      xml = xml.substring(m[0].length);

      var name = m[1];
      var trailing = m[2] === '/';
      var element = new XMLElement(name);

      if (trailing) {
        current.add(element);
        continue;
      }

      stack.push(element);
      current.add(element);
      current = element;

      continue;
    }

    m = /^<\/([\w:]+)[^<>]*>/i.exec(xml);
    if (m) {
      xml = xml.substring(m[0].length);

      var _name = m[1];

      assert(stack.length !== 1, 'No start tag.');

      var _element = stack.pop();

      assert(_element.name === _name, 'Tag mismatch.');
      current = stack[stack.length - 1];

      if (current === sentinel) break;

      continue;
    }

    m = /^([^<]+)/i.exec(xml);
    if (m) {
      xml = xml.substring(m[0].length);
      var text = m[1];
      current.text = text.trim();
      continue;
    }

    throw new Error('XML parse error.');
  }

  assert(sentinel.children.length > 0, 'No root element.');

  return sentinel.children[0];
};

/**
 * Push element onto children.
 * @param {XMLElement} child
 * @returns {Number}
 */

XMLElement.prototype.add = function add(child) {
  return this.children.push(child);
};

/**
 * Collect all descendants with matching name.
 * @param {String} name
 * @returns {XMLElement[]}
 */

XMLElement.prototype.collect = function collect(name) {
  return this._collect(name, []);
};

/**
 * Collect all descendants with matching name.
 * @private
 * @param {String} name
 * @param {XMLElement[]} result
 * @returns {XMLElement[]}
 */

XMLElement.prototype._collect = function _collect(name, result) {
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = (0, _getIterator3.default)(this.children), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var child = _step3.value;

      if (child.type === name) {
        result.push(child);
        continue;
      }

      child._collect(name, result);
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
 * Find child element with matching name.
 * @param {String} name
 * @returns {XMLElement|null}
 */

XMLElement.prototype.find = function find(name) {
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = (0, _getIterator3.default)(this.children), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var child = _step4.value;

      if (child.type === name) return child;

      var desc = child.find(name);

      if (desc) return desc;
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

  return null;
};

/*
 * XML Helpers
 */

function parseServices(el) {
  var children = el.collect('service');
  var services = [];

  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = (0, _getIterator3.default)(children), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var child = _step5.value;

      services.push(parseService(child));
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

  return services;
}

function parseService(el) {
  var service = (0, _create2.default)(null);

  var _iteratorNormalCompletion6 = true;
  var _didIteratorError6 = false;
  var _iteratorError6 = undefined;

  try {
    for (var _iterator6 = (0, _getIterator3.default)(el.children), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
      var child = _step6.value;

      if (child.children.length > 0) continue;

      service[child.type] = child.text;
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

  return service;
}

function findService(services, name) {
  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = (0, _getIterator3.default)(services), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var service = _step7.value;

      if (service.serviceType === name) return service;
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

  return null;
}

function extractServices(services, targets) {
  var _iteratorNormalCompletion8 = true;
  var _didIteratorError8 = false;
  var _iteratorError8 = undefined;

  try {
    for (var _iterator8 = (0, _getIterator3.default)(targets), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
      var name = _step8.value;

      var service = findService(services, name);
      if (service) return service;
    }
  } catch (err) {
    _didIteratorError8 = true;
    _iteratorError8 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion8 && _iterator8.return) {
        _iterator8.return();
      }
    } finally {
      if (_didIteratorError8) {
        throw _iteratorError8;
      }
    }
  }

  return null;
}

function findIP(el) {
  var child = el.find('NewExternalIPAddress');

  if (!child) return null;

  return IP.normalize(child.text);
}

function findError(el) {
  var child = el.find('UPnPError');

  if (!child) return null;

  var code = -1;
  var ccode = child.find('errorCode');

  if (ccode && /^\d+$/.test(ccode.text)) code = parseInt(ccode.text, 10);

  var desc = 'Unknown';
  var cdesc = child.find('errorDescription');

  if (cdesc) desc = cdesc.text;

  return new Error('UPnPError: ' + desc + ' (' + code + ').');
}

/*
 * Helpers
 */

function parseHost(uri) {
  var _url$parse = url.parse(uri),
      protocol = _url$parse.protocol,
      host = _url$parse.host;

  assert(protocol === 'http:' || protocol === 'https:', 'Bad URL for location.');

  return protocol + '//' + host;
}

function prependHost(host, uri) {
  if (uri.indexOf('://') === -1) {
    if (uri[0] !== '/') uri = '/' + uri;
    uri = host + uri;
  }
  return uri;
}

/*
 * Expose
 */

module.exports = UPNP;