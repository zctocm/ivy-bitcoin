import { Instruction } from "./btc/instructions";
import { Hash, Primitive, Type } from "./btc/types";
export interface Location {
    start: {
        column: number;
        line: number;
    };
    end: {
        column: number;
        line: number;
    };
}
export declare type InstructionExpressionType = "binaryExpression" | "callExpression";
export interface Parameter {
    type: "parameter";
    location: Location;
    name: string;
    itemType: Primitive | Hash;
    scope?: string;
}
export interface Import {
    type: "import";
    name: string;
}
export interface RawContract {
    type: "rawcontract";
    location: Location;
    name: string;
    parameters: Parameter[];
    clauses: Clause[];
    referenceCounts?: Map<string, number>;
}
export interface Conditional {
    type: "conditional";
    condition: Expression;
    ifBlock: Block;
    elseBlock?: Block;
    location?: Location;
}
export declare type Block = Conditional | Clause;
export interface Contract {
    type: "contract";
    location: Location;
    name: string;
    parameters: Parameter[];
    block: Block;
    numClauses: number;
    clauseSelector?: string;
    referenceCounts: Map<string, number>;
}
export interface Clause {
    type: "clause";
    location: Location;
    name: string;
    parameters: Parameter[];
    statements: Statement[];
    referenceCounts?: Map<string, number>;
}
export interface Assertion {
    type: "assertion";
    location: Location;
    expression: Expression;
}
export interface Unlock {
    type: "unlock";
    location: Location;
    value: Variable;
}
export declare type Statement = Assertion | Unlock;
export declare function statementToString(statement: Statement): string;
export declare type Expression = InstructionExpression | ListLiteral | ValueLiteral | Variable;
export interface InstructionExpression {
    type: "instructionExpression";
    expressionType: InstructionExpressionType;
    instruction: Instruction;
    location: Location;
    args: Expression[];
}
export interface PartialExpression {
    type: "partial";
    operator: string;
    left: Expression;
}
export declare function createBinaryExpression(partials: PartialExpression[], right: Expression): Expression;
export declare function createInstructionExpression(expressionType: InstructionExpressionType, location: Location, name: string, args: Expression[]): Expression;
export interface Variable {
    type: "variable";
    location: Location;
    name: string;
    scope?: string;
    itemType?: Type;
}
export declare type LiteralType = "Boolean" | "Integer";
export interface ListLiteral {
    type: "listLiteral";
    location: Location;
    values: Expression[];
}
export interface ValueLiteral {
    type: "literal";
    literalType: LiteralType;
    location: Location;
    value: string;
}
export declare function contractToString(contract: RawContract): string;
export declare type ASTNode = Parameter | RawContract | Contract | Conditional | Clause | Statement | Expression;
export declare function mapOverAST(func: (Node: any) => ASTNode, node: ASTNode): ASTNode;
export declare function scopedName(item: Parameter | Variable | Import): string;
