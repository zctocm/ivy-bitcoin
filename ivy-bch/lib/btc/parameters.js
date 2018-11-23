"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const errors_1 = require("../errors");
function isContractParameterHash(type) {
    return isContractParameterType(type.inputType);
}
exports.isContractParameterHash = isContractParameterHash;
function isContractParameterType(type) {
    if (type === "Signature" || types_1.isList(type)) {
        return false;
    }
    if (types_1.isHash(type)) {
        return isContractParameterHash(type);
    }
    else {
        return true;
    }
}
exports.isContractParameterType = isContractParameterType;
function toContractParameter(parameter) {
    if (!isContractParameterType(parameter.itemType)) {
        throw new errors_1.BugError("invalid contract parameter type for " +
            parameter.name +
            ": " +
            types_1.typeToString(parameter.itemType));
    }
    const contractParameter = {
        type: "contractParameter",
        valueType: parameter.itemType,
        name: parameter.name
    };
    return contractParameter;
}
exports.toContractParameter = toContractParameter;
function isClauseParameterHash(type) {
    return isClauseParameterType(type.inputType);
}
exports.isClauseParameterHash = isClauseParameterHash;
function isClauseParameterType(type) {
    if (types_1.isHash(type)) {
        return isClauseParameterHash(type);
    }
    if (type === "Signature") {
        return true;
    }
    return isContractParameterType(type);
}
exports.isClauseParameterType = isClauseParameterType;
function toClauseParameter(parameter) {
    if (!isClauseParameterType(parameter.itemType)) {
        throw new errors_1.BugError("invalid contract parameter type for " +
            parameter.name +
            ": " +
            types_1.typeToString(parameter.itemType));
    }
    const clauseParameter = {
        type: "clauseParameter",
        valueType: parameter.itemType,
        name: parameter.name
    };
    return clauseParameter;
}
exports.toClauseParameter = toClauseParameter;
//# sourceMappingURL=parameters.js.map