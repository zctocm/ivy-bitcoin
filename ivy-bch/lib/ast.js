"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instructions_1 = require("./btc/instructions");
const types_1 = require("./btc/types");
const errors_1 = require("./errors");
function statementToString(statement) {
    switch (statement.type) {
        case "assertion":
            return "verify " + expressionToString(statement.expression);
        case "unlock":
            return "unlock " + statement.value;
    }
}
exports.statementToString = statementToString;
function createBinaryExpression(partials, right) {
    const last = partials.pop();
    if (last === undefined) {
        throw new errors_1.BugError("partials list must not be empty");
    }
    const operator = last.operator;
    const left = partials.length
        ? createBinaryExpression(partials, last.left)
        : last.left;
    return createInstructionExpression("binaryExpression", left.location, operator, [right, left]);
}
exports.createBinaryExpression = createBinaryExpression;
function createInstructionExpression(expressionType, location, name, args) {
    const instruction = name;
    if (!instructions_1.isInstruction(instruction)) {
        throw new errors_1.NameError("invalid instruction name: " + instruction);
    }
    return {
        type: "instructionExpression",
        expressionType,
        instruction,
        location,
        args
    };
}
exports.createInstructionExpression = createInstructionExpression;
function contractToString(contract) {
    return ("contract " +
        contract.name +
        "(" +
        contract.parameters.map(param => parameterToString(param)).join(", ") +
        ") {\n  " +
        contract.clauses.map(clause => clauseToString(clause)).join("\n  ") +
        "\n}");
}
exports.contractToString = contractToString;
function clauseToString(clause) {
    return ("clause " +
        clause.name +
        "(" +
        clause.parameters.map(param => parameterToString(param)).join(", ") +
        ") {\n    " +
        clause.statements
            .map(statement => statementToString(statement))
            .join("\n    ") +
        "\n  }");
}
function literalToString(literal) {
    return literal.value;
}
function instructionExpressionToString(expression) {
    switch (expression.expressionType) {
        case "binaryExpression":
            return ("(" +
                expressionToString(expression.args[0]) +
                " " +
                expression.instruction +
                " " +
                expressionToString(expression.args[1]) +
                ")");
        case "callExpression":
            return (expression.instruction +
                "(" +
                expression.args.map(exp => expressionToString(exp)).join(", ") +
                ")");
    }
}
function listLiteralToString(expression) {
    return ("[" + expression.values.map(exp => expressionToString(exp)).join(", ") + "]");
}
function expressionToString(expression) {
    switch (expression.type) {
        case "literal":
            return literalToString(expression);
        case "instructionExpression":
            return instructionExpressionToString(expression);
        case "variable":
            return scopedName(expression);
        case "listLiteral":
            return listLiteralToString(expression);
    }
}
function parameterToString(parameter) {
    return (parameter.name +
        (parameter.itemType === undefined
            ? ""
            : ": " + types_1.typeToString(parameter.itemType)));
}
function mapOverAST(func, node) {
    switch (node.type) {
        case "parameter": {
            return func(node);
        }
        case "rawcontract": {
            return func(Object.assign({}, node, { parameters: node.parameters.map(param => mapOverAST(func, param)), clauses: node.clauses.map(clause => mapOverAST(func, clause)) }));
        }
        case "contract": {
            return func(Object.assign({}, node, { parameters: node.parameters.map(param => mapOverAST(func, param)), block: mapOverAST(func, node.block) }));
        }
        case "conditional": {
            return func(Object.assign({}, node, { condition: mapOverAST(func, node.condition), ifBlock: mapOverAST(func, node.ifBlock), elseBlock: node.elseBlock ? mapOverAST(func, node.elseBlock) : undefined }));
        }
        case "clause": {
            return func(Object.assign({}, node, { parameters: node.parameters.map(param => mapOverAST(func, param)), statements: node.statements.map(st => mapOverAST(func, st)) }));
        }
        case "assertion": {
            return func(Object.assign({}, node, { expression: mapOverAST(func, node.expression) }));
        }
        case "instructionExpression": {
            return func(Object.assign({}, node, { args: node.args.map(arg => mapOverAST(func, arg)) }));
        }
        case "variable": {
            return func(node);
        }
        case "listLiteral": {
            return func(Object.assign({}, node, { values: node.values.map(val => mapOverAST(func, val)) }));
        }
        case "literal": {
            return func(node);
        }
        case "unlock": {
            return func(Object.assign({}, node, { value: func(node.value) }));
        }
    }
}
exports.mapOverAST = mapOverAST;
function scopedName(item) {
    if (item.type === "import") {
        return item.name;
    }
    return item.scope === undefined ? item.name : item.scope + "." + item.name;
}
exports.scopedName = scopedName;
//# sourceMappingURL=ast.js.map