"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const instructions_1 = require("./instructions");
function toOpcodes(ops) {
    const newOps = [];
    const emit = (o) => {
        newOps.push(o);
    };
    for (const op of ops) {
        switch (op.type) {
            case "pick": {
                emit(op.depth.toString());
                emit("PICK");
                break;
            }
            case "roll": {
                emit(op.depth.toString());
                emit("ROLL");
                break;
            }
            case "instructionOp": {
                const instructionOpcodes = instructions_1.getOpcodes(op.expression.instruction);
                instructionOpcodes.map(emit);
                break;
            }
            case "verify": {
                emit("VERIFY");
                break;
            }
            case "push": {
                if (op.literalType === "Boolean") {
                    emit(op.value === "true" ? "1" : "0");
                }
                else {
                    emit(op.value);
                }
                break;
            }
            case "beginIf": {
                emit("IF");
                break;
            }
            case "else": {
                emit("ELSE");
                break;
            }
            case "endIf": {
                emit("ENDIF");
                break;
            }
            case "pushParameter": {
                emit("PUSH(" + op.name + ")");
                break;
            }
            case "drop": {
                emit("DROP");
            }
        }
    }
    return newOps;
}
exports.default = toOpcodes;
//# sourceMappingURL=toOpcodes.js.map