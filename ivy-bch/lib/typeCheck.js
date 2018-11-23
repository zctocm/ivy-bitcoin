"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./btc/types");
const ast_1 = require("./ast");
const instructions_1 = require("./btc/instructions");
const errors_1 = require("./errors");
function isSameType(type1, type2) {
    const typeClass = types_1.getTypeClass(type1);
    if (typeClass !== types_1.getTypeClass(type2)) {
        return false;
    }
    switch (typeClass) {
        case "Primitive":
            return type1 === type2;
        case "Hash":
            return (type1.hashFunction === type2.hashFunction &&
                isSameType(type1.inputType, type2.inputType));
        case "List":
            return isSameType(type1.elementType, type2.elementType);
    }
}
function unify(left, right, mapping) {
    if (isSameType(left, right)) {
        return true; // identical; trivially satisfied; move on
    }
    if (left === "Address") {
        throw new errors_1.IvyTypeError("cannot use item of type Program outside of a lock statement");
    }
    const typeClass = types_1.getTypeClass(left);
    if (typeClass !== types_1.getTypeClass(right)) {
        throw new errors_1.IvyTypeError("incompatible types: " +
            types_1.typeToString(left) +
            " and " +
            types_1.typeToString(right));
    }
    switch (typeClass) {
        case "Primitive": {
            throw new errors_1.IvyTypeError("incompatible types: " + left + " and " + right); // we know they're not the same type
        }
        case "List":
            return unify(left.elementType, right.elementType, mapping);
        case "Hash": {
            const leftHashFunction = left.hashFunction;
            const rightHashFunction = right.hashFunction;
            if (leftHashFunction !== rightHashFunction) {
                throw new errors_1.IvyTypeError("incompatible hash functions: " +
                    leftHashFunction +
                    " and " +
                    rightHashFunction);
            }
            return unify(left.inputType, right.inputType, mapping);
        }
    }
}
function matchTypes(firstType, secondType) {
    const typeClass = types_1.getTypeClass(firstType);
    if (typeClass !== types_1.getTypeClass(secondType)) {
        throw new errors_1.IvyTypeError("got " +
            types_1.typeToString(secondType) +
            ", expected " +
            types_1.typeToString(firstType));
    }
    switch (typeClass) {
        case "Primitive":
            if (firstType !== secondType) {
                throw new errors_1.IvyTypeError("got " +
                    types_1.typeToString(secondType) +
                    ", expected " +
                    types_1.typeToString(firstType));
            }
            return;
        case "Hash":
            if (!types_1.isHash(firstType) || !types_1.isHash(secondType)) {
                throw new errors_1.BugError("type guard surprisingly failed");
            }
            if (firstType.hashFunction !== secondType.hashFunction) {
                throw new errors_1.IvyTypeError("cannot match " +
                    types_1.typeToString(firstType) +
                    " with " +
                    types_1.typeToString(secondType));
            }
            matchTypes(firstType.inputType, secondType.inputType);
            return;
        case "List":
            matchTypes(firstType.elementType, secondType.elementType);
            return;
        default:
            throw new errors_1.BugError("type class should have been handled");
    }
}
exports.matchTypes = matchTypes;
function unifyFunction(typeSignature, inputTypes) {
    // typecheck some inputs against the function's type signature
    // also maybe compute the output type and/or more specific input types
    const typeSigInputs = typeSignature.inputs;
    if (inputTypes.length !== typeSignature.inputs.length) {
        throw new errors_1.IvyTypeError("got " +
            types_1.inputTypesToString(inputTypes) +
            ", expected " +
            types_1.inputTypesToString(typeSigInputs));
    }
    for (let i = 0; i < inputTypes.length; i++) {
        const firstType = typeSigInputs[i];
        const secondType = inputTypes[i];
        matchTypes(firstType, secondType);
    }
    return typeSignature.output;
}
exports.unifyFunction = unifyFunction;
function typeCheckExpression(expression) {
    switch (expression.type) {
        case "instructionExpression":
            const inputTypes = expression.args.map(arg => typeCheckExpression(arg));
            if (types_1.isHashFunctionName(expression.instruction)) {
                const inputType = typeCheckExpression(expression.args[0]);
                if (inputTypes.length !== 1) {
                    throw new errors_1.IvyTypeError("hash function expected 1 argument, got " + inputTypes.length);
                }
                if (!types_1.isHash(inputType) &&
                    inputType !== "Bytes" &&
                    inputType !== "PublicKey") {
                    throw new errors_1.IvyTypeError("cannot hash item of type " + types_1.typeToString(inputType));
                }
                return {
                    type: "hashType",
                    hashFunction: expression.instruction,
                    inputType
                };
            }
            switch (expression.instruction) {
                case "bytes":
                    if (inputTypes.length !== 1) {
                        throw new errors_1.IvyTypeError("bytes function expected 1 argument, got " + inputTypes.length);
                    }
                    if (inputTypes[0] === "Value") {
                        throw new errors_1.IvyTypeError("cannot call bytes on an item of type Value");
                    }
                    if (inputTypes[0] === "Boolean") {
                        throw new errors_1.IvyTypeError("cannot call bytes on an item of type Boolean");
                    }
                    return "Bytes";
                case "==":
                case "!=":
                case ">":
                case "<":
                    // todo: check the inputType when '>' 
                    if (inputTypes[0] === "Boolean" || inputTypes[1] === "Boolean") {
                        throw new errors_1.IvyTypeError("cannot pass value of type Boolean to " + expression.instruction);
                    }
                    matchTypes(inputTypes[0], inputTypes[1]);
                    return "Boolean";
                default:
                    const typeSig = instructions_1.getTypeSignature(expression.instruction);
                    unifyFunction(typeSig, inputTypes);
                    return typeSig.output;
            }
        case "literal": {
            return expression.literalType;
        }
        case "variable":
            if (expression.itemType === undefined) {
                throw new Error("no type for variable " + expression.name);
            }
            return expression.itemType;
        case "listLiteral":
            if (expression.values.length === 0) {
                throw new errors_1.IvyTypeError("lists cannot be empty");
            }
            const unifiedType = expression.values
                .map(exp => typeCheckExpression(exp))
                .reduce((firstType, secondType) => {
                matchTypes(firstType, secondType);
                return firstType;
            });
            return { type: "listType", elementType: unifiedType };
    }
}
exports.typeCheckExpression = typeCheckExpression;
function typeCheckStatement(statement) {
    switch (statement.type) {
        case "assertion": {
            const expressionType = typeCheckExpression(statement.expression);
            if (expressionType !== "Boolean") {
                throw new errors_1.IvyTypeError("verify statement expects a Boolean, got " +
                    types_1.typeToString(expressionType));
            }
            return;
        }
        case "unlock": {
            const expressionType = typeCheckExpression(statement.value);
            if (expressionType !== "Value") {
                throw new errors_1.IvyTypeError("unlock statement expects a Value, got " +
                    types_1.typeToString(expressionType));
            }
            return;
        }
    }
}
exports.typeCheckStatement = typeCheckStatement;
function typeCheckClause(clause) {
    for (const statement of clause.statements) {
        typeCheckStatement(statement);
    }
}
exports.typeCheckClause = typeCheckClause;
function checkUniqueClauseNames(clauses) {
    const clauseNames = clauses.map(clause => clause.name);
    if (new Set(clauseNames).size !== clauseNames.length) {
        throw new errors_1.NameError("clause names must be unique");
    }
}
function checkMultiSigArgumentCounts(contract) {
    ast_1.mapOverAST((node) => {
        switch (node.type) {
            case "instructionExpression": {
                // check checkMultiSig argument counts
                if (node.instruction === "checkMultiSig") {
                    const pubKeys = node.args[0];
                    const sigs = node.args[1];
                    if (parseInt(sigs.value, 10) > pubKeys.values.length) {
                        throw new errors_1.IvyTypeError("number of public keys passed to checkMultiSig " +
                            "must be greater than or equal to number of signatures");
                    }
                }
                return node;
            }
            default:
                return node;
        }
    }, contract);
}
function isSignatureCheck(statement) {
    return (statement.type === "unlock" ||
        (statement.type === "assertion" &&
            statement.expression.type === "instructionExpression" &&
            statement.expression.instruction === "checkSig") // don't even allow multisig yet
    );
}
function checkValueFlow(rawContract) {
    // find if there's a clause that just checks some signatures
    let sigCheckClause;
    ast_1.mapOverAST((node) => {
        switch (node.type) {
            case "clause": {
                if (node.parameters.every(param => param.itemType === "Signature") &&
                    node.statements.every(isSignatureCheck) // conservative for now
                ) {
                    sigCheckClause = node;
                }
                return node;
            }
            default:
                return node;
        }
    }, rawContract);
    // annotate clauses that include outputs with preapprovals
    // and remove unlock statements while we're at it
    return ast_1.mapOverAST((node) => {
        switch (node.type) {
            case "clause": {
                return Object.assign({}, node, { statements: node.statements.filter(statement => statement.type === "assertion") });
            }
            default:
                return node;
        }
    }, rawContract);
}
function typeCheckContract(rawContract) {
    checkUniqueClauseNames(rawContract.clauses);
    const numValues = rawContract.parameters.filter(param => param.itemType === "Value").length;
    if (numValues === 0) {
        throw new errors_1.IvyTypeError("A contract must have a parameter of type Value.");
    }
    if (numValues > 1) {
        throw new errors_1.IvyTypeError("A contract can only have one parameter of type Value.");
    }
    for (const parameter of rawContract.parameters) {
        if (parameter.itemType === undefined) {
            throw new errors_1.BugError("parameter type unexpectedly undefined");
        }
        if (parameter.itemType === "Signature") {
            throw new errors_1.IvyTypeError("Signatures cannot be used as contract parameters");
        }
    }
    for (const clause of rawContract.clauses) {
        for (const parameter of clause.parameters) {
            if (parameter.itemType === "Value") {
                throw new errors_1.IvyTypeError("Values cannot be used as clause parameters");
            }
        }
    }
    for (const clause of rawContract.clauses) {
        typeCheckClause(clause);
    }
    checkMultiSigArgumentCounts(rawContract);
    return checkValueFlow(rawContract);
}
exports.typeCheckContract = typeCheckContract;
//# sourceMappingURL=typeCheck.js.map