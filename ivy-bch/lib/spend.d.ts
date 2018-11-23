/// <reference types="node" />
import { Contract, Transaction } from "./instantiate";
export declare const toSighash: (instantiated: Contract, spendTransaction: Transaction) => Buffer | undefined;
export declare const spend: (spendSourceTransaction: any, spendDestinationAddress: any, amount: number, locktime: number, sequenceNumber: {
    sequence: number;
    seconds: boolean;
}) => any;
export declare function toBuf(arg: Buffer | number | string): any;
export declare const fulfill: (instantiated: Contract, spendTx: any, clauseArgs: any[], spendClauseName: string) => any;
export declare const createSignature: (sigHash: Buffer, secret: string) => Buffer | undefined;
