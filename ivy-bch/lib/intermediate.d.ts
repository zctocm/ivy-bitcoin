import { Clause, Contract, InstructionExpression, Variable } from "./ast";
export declare type Operation = Get | Pick | Roll | BeginContract | InstructionOp | Verify | Push | BeginIf | Else | EndIf | BeginClause | EndClause | PushParameter | Drop;
export declare type FinalOperation = Pick | Roll | InstructionOp | Verify | Push | BeginIf | Else | EndIf | PushParameter | Drop;
export interface Get {
    type: "get";
    variable: Variable;
}
export interface Pick {
    type: "pick";
    depth: number;
}
export interface Roll {
    type: "roll";
    depth: number;
}
export interface Drop {
    type: "drop";
}
export interface BeginContract {
    type: "beginContract";
    contract: Contract;
}
export interface InstructionOp {
    type: "instructionOp";
    expression: InstructionExpression;
}
export interface Verify {
    type: "verify";
}
export interface Push {
    type: "push";
    literalType: "Integer" | "Boolean";
    value: string;
}
export interface PushParameter {
    type: "pushParameter";
    name: string;
}
export interface BeginIf {
    type: "beginIf";
}
export interface EndIf {
    type: "endIf";
}
export interface Else {
    type: "else";
}
export interface BeginClause {
    type: "beginClause";
    clause: Clause;
}
export interface EndClause {
    type: "endClause";
    clause: Clause;
}
export declare function operationToString(op: Operation): string;
export declare function operationsToString(ops: Operation[]): string;
export declare function compileContractToIntermediate(contract: Contract): Operation[];
