/// <reference types="node" />
import { Template } from "./template";
export interface Contract {
    script: string;
    testnetAddress: string;
    publicKey?: string;
    fundingTransaction?: TransactionJSON;
    amount: number;
    template: Template;
}
export interface Output {
    address: string;
    script: string;
    value: string;
}
export interface TransactionJSON {
    hash: string;
    inputs: any[];
    outputs: any[];
    locktime: number;
    mutable: boolean;
}
export interface Transaction {
    hash: (s: string) => string;
    outputs: Output[];
    toJSON: () => TransactionJSON;
    signatureHash: (index: number, script: any, amount: number, type: number, flags: number) => Buffer;
}
export declare function argToPushData(arg: Buffer | number | string): any;
export declare function symbolToOpcode(sym: string, argMap: Map<string, any>): any;
export declare function instantiate(template: Template, args: Array<Buffer | number>, seed?: any): Contract;
