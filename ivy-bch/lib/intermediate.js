"use strict";
// compile to an intermediate representation
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./errors");
function operationToString(op) {
    switch (op.type) {
        case "verify":
        case "beginIf":
        case "else":
        case "endIf":
            return op.type;
        case "beginClause":
            return "(beginClause " + op.clause.name + ")";
        case "endClause":
            return "(endClause " + op.clause.name + ")";
        case "push":
            return "(push " + op.value + ")";
        case "instructionOp":
            return op.expression.instruction;
        case "beginContract":
            return ("(beginContract (" +
                op.contract.parameters.map(param => param.name).join(", ") +
                "))");
        case "get":
            return "(get " + op.variable.name + ")";
        case "pick":
            return "(pick " + op.depth + ")";
        case "roll":
            return "(roll " + op.depth + ")";
        case "pushParameter":
            return "(push " + op.name + ")";
        case "drop":
            return "drop";
    }
}
exports.operationToString = operationToString;
function operationsToString(ops) {
    return ops.map(operationToString).join(" ");
}
exports.operationsToString = operationsToString;
function compileContractToIntermediate(contract) {
    const operations = [];
    const emit = (op) => operations.push(op);
    compileToIntermediate(contract, emit);
    return operations;
}
exports.compileContractToIntermediate = compileContractToIntermediate;
function compileToIntermediate(node, emit) {
    const compile = n => compileToIntermediate(n, emit);
    switch (node.type) {
        case "contract": {
            emit({ type: "beginContract", contract: node });
            compile(node.block);
            return node;
        }
        case "rawcontract": {
            throw new errors_1.BugError("raw contract passed to compileToIntermediate, which expects a desugared contract");
        }
        case "clause": {
            emit({ type: "beginClause", clause: node });
            const statements = [...node.statements];
            statements.slice(0, -1).map(compile);
            // just the expression from the last statement in each clause
            // don't verify it (because of the implicit verify at the end of Bitcoin Script)
            const last = statements[statements.length - 1];
            if (!last) {
                emit({ type: "push", literalType: "Boolean", value: "true" });
            }
            else if (last.type !== "assertion") {
                throw new errors_1.BugError("expected last statement to be assertion");
            }
            else {
                compile(last.expression);
            }
            emit({ type: "endClause", clause: node });
            return node;
        }
        case "conditional": {
            compile(node.condition);
            emit({ type: "beginIf" });
            compile(node.ifBlock);
            if (node.elseBlock) {
                emit({ type: "else" });
                compile(node.elseBlock);
            }
            emit({ type: "endIf" });
            return node;
        }
        case "assertion": {
            compile(node.expression);
            emit({ type: "verify" });
            return node;
        }
        case "instructionExpression": {
            node.args
                .slice()
                .reverse()
                .map(compile);
            emit({ type: "instructionOp", expression: node });
            return node;
        }
        case "variable": {
            emit({ type: "get", variable: node });
            return node;
        }
        case "literal": {
            emit({ type: "push", literalType: node.literalType, value: node.value });
            return node;
        }
        case "unlock": {
            return node;
        }
        case "listLiteral": {
            throw new errors_1.BugError("list literal should have been desugared before compileToIntermediate");
        }
        case "parameter": {
            throw new errors_1.BugError("parameter should not be passed to compileToIntermediate");
        }
    }
}
//# sourceMappingURL=intermediate.js.map