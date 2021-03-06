import { Template } from "./template"

import {
  address as Address,
  opcode as Opcode,
  outpoint as Outpoint,
  primitives,
  script as Script
} from "bcoin"
import { BugError } from "./errors"

import * as crypto from "bcrypto"

const MTX = primitives.MTX

interface ScriptObject {
  toJSON: () => string // encodes as hex string
  hash160: () => Buffer
  isPubkey: () => boolean
  toRaw: () => Buffer
}

export interface Contract {
  script: string
  testnetAddress: string
  publicKey?: string
  fundingTransaction?: TransactionJSON
  amount: number
  template: Template
}

export interface Output {
  address: string
  script: string
  value: string
}

export interface TransactionJSON {
  hash: string
  inputs: any[]
  outputs: any[]
  locktime: number
  mutable: boolean
}

export interface Transaction {
  hash: (s: string) => string
  outputs: Output[]
  toJSON: () => TransactionJSON
  signatureHash: (
    index: number,
    script: any,
    amount: number,
    type: number,
    flags: number
  ) => Buffer
}

function createFundingTransaction(
  address: string,
  valueArgs: number[],
  seed: Buffer
): TransactionJSON | undefined {
  if (valueArgs.some(isNaN)) {
    return undefined
  }

  const mtx = new MTX()
  console.log('valuesArgs: '+ JSON.stringify(valueArgs))
  valueArgs.forEach(amount => {
    mtx.addInput({
      prevout: new Outpoint(),
      script: new Script(),
      sequence: 0xffffffff
    })
  })

  const totalAmount = valueArgs.reduce((a, b) => a + b, 0)

  mtx.addOutput({
    address,
    value: totalAmount
  })

  // add dummy output for uniqueness
  const randomScript = Script.fromNulldata(seed)
  mtx.addOutput({
    script: randomScript,
    value: 0
  })

  const tx: Transaction = mtx.toTX()
  console.warn('tx json createFundingTransaction: '+JSON.stringify(tx.toJSON()))
  return tx.toJSON()
}

export function argToPushData(arg: Buffer | number | string) {
  if (typeof arg === "number") {
    return Opcode.fromInt(arg)
  } else if (typeof arg === "string") {
    return Opcode.fromData(Buffer.from(arg, "hex"))
  } else {
    return Opcode.fromData(arg)
  }
}

export function symbolToOpcode(sym: string, argMap: Map<string, any>) {
  if (sym[sym.length - 1] === ")") {
    // it's a contract argument
    const name = sym.slice(5, sym.length - 1)
    const arg = argMap.get(name)
    if (arg === undefined) {
      throw new BugError("argument '" + name + "' unexpectedly has no data")
    }
    return argToPushData(arg)
  } else if (/^\d+$/.test(sym)) {
    return Opcode.fromInt(parseInt(sym, 10))
  }
  return Opcode.fromSymbol(sym)
}

export function instantiate(
  template: Template,
  args: Array<Buffer | number>,
  seed = crypto.randomBytes(32)
): Contract {
  const numArgs = template.params.length
  if (numArgs !== args.length) {
    throw new Error("expected " + numArgs + " arguments, got " + args.length)
  }
  const dataArgs = args.filter(
    (_, i) => template.params[i].valueType !== "Value"
  )
  const valueArgs = args.filter(
    (_, i) => template.params[i].valueType === "Value"
  ) as number[]
  const instructions = template.instructions
  const argMap = new Map<string, any>()
  template.params.map((param, i) => {
    if (param.valueType !== "Value") {
      argMap.set(param.name, args[i])
    }
  })
  // console.log('argMap: '+JSON.stringify(argMap))
  const opcodes = instructions.map(inst => symbolToOpcode(inst, argMap))
  // console.log('opcodes: '+JSON.stringify(opcodes))
  const script: ScriptObject = Script.fromArray(opcodes)
  // console.log('script: '+JSON.stringify(script))
  const testnetAddress = Address.fromScripthash(
    script.hash160(),
    "testnet"
  )
  const mainnetAddress = Address.fromScripthash(script.hash160())
  const tx = createFundingTransaction(testnetAddress, valueArgs, seed)
  // if (tx === undefined) {
  //   throw new Error(
  //     "expected tx to not be undefined when called in instantiate"
  //   )
  // }
  const instantiated = {
    script: script.toJSON(),
    testnetAddress: testnetAddress.toBase58(),
    mainnetAddress: mainnetAddress.toBase58(),
    publicKey: script.isPubkey()
      ? (args[0] as Buffer).toString("hex")
      : undefined,
    fundingTransaction: tx,
    amount: valueArgs.reduce((a, b) => a + b, 0),
    template
  }
  return instantiated
}
