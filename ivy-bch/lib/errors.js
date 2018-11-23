"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ExtendableError extends Error {
    constructor(message, name, location) {
        super();
        this.message = message;
        this.name = name;
        this.location = location;
        this.stack = new Error().stack;
    }
}
exports.ExtendableError = ExtendableError;
class NameError extends ExtendableError {
    constructor(message, location) {
        super(message, "NameError", location);
    }
}
exports.NameError = NameError;
class BugError extends ExtendableError {
    constructor(message) {
        super(message, "BugError");
    }
}
exports.BugError = BugError;
class IvyTypeError extends ExtendableError {
    constructor(message, location) {
        super(message, "IvyTypeError", location);
    }
}
exports.IvyTypeError = IvyTypeError;
class ValueError extends ExtendableError {
    constructor(message, location) {
        super(message, "ValueError", location);
    }
}
exports.ValueError = ValueError;
//# sourceMappingURL=errors.js.map