"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../errors");
function createTypeSignature(inputs, output) {
    return {
        type: "typeSignature",
        inputs,
        output
    };
}
exports.createTypeSignature = createTypeSignature;
function inputTypesToString(inputTypes) {
    return "(" + inputTypes.map(type => typeToString(type)).join(", ") + ")";
}
exports.inputTypesToString = inputTypesToString;
function isPrimitive(str) {
    switch (str) {
        case "PublicKey":
        case "Signature":
        case "Bytes":
        case "Time":
        case "Duration":
        case "Boolean":
        case "Integer":
        case "Value":
            return true;
        default:
            return false;
    }
}
exports.isPrimitive = isPrimitive;
function isHashTypeName(str) {
    switch (str) {
        case "Sha1":
        case "Sha256":
        case "Ripemd160":
            return true;
        default:
            return false;
    }
}
exports.isHashTypeName = isHashTypeName;
function isHash(type) {
    return typeof type === "object" && type.type === "hashType";
}
exports.isHash = isHash;
function isList(type) {
    return typeof type === "object" && type.type === "listType";
}
exports.isList = isList;
function isTypeClass(type) {
    return (type === "Primitive" ||
        type === "TypeVariable" ||
        type === "Hash" ||
        type === "List");
}
exports.isTypeClass = isTypeClass;
function getTypeClass(type) {
    if (isPrimitive(type)) {
        return "Primitive";
    }
    else if (isHash(type)) {
        return "Hash";
    }
    else if (isList(type)) {
        return "List";
    }
    else {
        throw new errors_1.BugError("unknown typeclass: " + typeToString(type));
    }
}
exports.getTypeClass = getTypeClass;
function isHashFunctionName(str) {
    switch (str) {
        case "sha1":
        case "sha256":
        case "ripemd160":
            return true;
        default:
            return false;
    }
}
exports.isHashFunctionName = isHashFunctionName;
function hashFunctionToTypeName(hash) {
    switch (hash) {
        case "sha1":
            return "Sha1";
        case "sha256":
            return "Sha256";
        case "ripemd160":
            return "Ripemd160";
        default:
            throw new Error("unknown hash function");
    }
}
exports.hashFunctionToTypeName = hashFunctionToTypeName;
function typeNameToHashFunction(hash) {
    switch (hash) {
        case "Sha1":
            return "sha1";
        case "Sha256":
            return "sha256";
        case "Ripemd160":
            return "ripemd160";
        default:
            throw new Error("unknown type name");
    }
}
exports.typeNameToHashFunction = typeNameToHashFunction;
function typeToString(type) {
    if (type === undefined) {
        throw new errors_1.BugError("undefined passed to typeToString()");
    }
    if (typeof type === "object") {
        switch (type.type) {
            case "hashType":
                return (hashFunctionToTypeName(type.hashFunction) +
                    "(" +
                    typeToString(type.inputType) +
                    ")");
            case "listType":
                return "List(" + typeToString(type.elementType) + ")";
            default:
                throw new errors_1.BugError("unknown type");
        }
    }
    else {
        return type;
    }
}
exports.typeToString = typeToString;
//# sourceMappingURL=types.js.map