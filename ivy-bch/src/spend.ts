import { Template } from "./template"

import { Contract, Transaction } from "./instantiate"

import {
  address as Address,
  keyring as KeyRing,
  opcode as Opcode,
  primitives,
  script as Script,
} from "bcoin"

const MTX = primitives.MTX
const TX = primitives.TX

import * as crypto from "bcrypto"

import { secp256k1 } from "./crypto"

export const toSighash = (
  instantiated: Contract,
  spendTransaction: Transaction
) => {
  if (spendTransaction === undefined) {
    return undefined
  }
  try {
    const script = instantiated.publicKey
      ? Script.fromPubkeyhash(
          crypto.hash160(Buffer.from(instantiated.publicKey, "hex"))
        )
      : Script.fromRaw(Buffer.from(instantiated.script, "hex"))
    console.log('===test_script: '+JSON.stringify(Script))  
    return spendTransaction.signatureHash(0, script, instantiated.amount, 0x41, 1 << 16)
  } catch (e) {
    return undefined
  }
}

export const spend = (
  spendSourceTransaction: any,
  spendDestinationAddress: any,
  amount: number,
  locktime: number,
  sequenceNumber: { sequence: number; seconds: boolean }
) => {
  const sourceTransaction = TX.fromJSON(spendSourceTransaction)
  const m = new MTX()
  m.addTX(sourceTransaction, 0)
  m.addOutput({
    address: spendDestinationAddress,
    value: amount
  })
  m.setLocktime(locktime)
  m.setSequence(0, sequenceNumber.sequence, sequenceNumber.seconds)
  // console.warn('tx json spend: '+JSON.stringify(m.toJSON()))
  return m
}

export function toBuf(arg: Buffer | number | string) {
  // console.log('toBuf_arg: '+JSON.stringify(arg))
  if (typeof arg === "number") {
    // console.log('toBuf_humber: '+Opcode.fromInt(arg))
    return Opcode.fromInt(arg)
   // roundabout, but seems to be the only exposed way
  } else if (typeof arg === "string") {
    // console.log('toBuf_string: '+JSON.stringify(Opcode.fromString(arg)))
    // return Buffer.from(arg, "hex")
    return Opcode.fromString(arg)
  } else {
    // console.log('toBuf_default_original: '+arg)
    // console.log('toBuf_default_json: '+JSON.stringify(arg))
    // console.log('toBuf_default_data: '+Opcode.fromData(arg))
    return Opcode.fromData(arg)
  }
}

export const fulfill = (
  instantiated: Contract,
  spendTx: any,
  clauseArgs: any[],
  spendClauseName: string
) => {
  const spendTransaction = spendTx.clone()
  // deal with a weird bug in the cloning
  spendTransaction.view = spendTx.view
  const script = instantiated.publicKey
    ? Buffer.from(instantiated.publicKey, "hex")
    : Buffer.from(instantiated.script, "hex")
  console.log('fulfill_script: '+JSON.stringify(script))  
  const realClauses = instantiated.template.clauses
  const spendClauseIndex = realClauses
    .map(clause => clause.name)
    .indexOf(spendClauseName)
  if (spendClauseIndex === -1) {
    throw new Error("could not find clause: " + spendClauseName)
  }
  const numClauses = instantiated.template.clauses.length
  console.log('clauseArgs: '+JSON.stringify(clauseArgs))
  const generatedArgs = clauseArgs.reverse().map(toBuf)
  console.log('generatedArgs: '+JSON.stringify(generatedArgs))
  const maybeClauseArg = numClauses > 1 ? [toBuf(spendClauseIndex)] : []
  console.log('maybeClauseArg: '+JSON.stringify(maybeClauseArg))
  const args = [...generatedArgs, ...maybeClauseArg, toBuf(script)]
  console.log('fulfill_args: '+JSON.stringify(args))
  const scriptSig = Script.fromArray(args)
  console.log('scriptSig: '+JSON.stringify(scriptSig))
  spendTransaction.inputs[0].script = scriptSig
  console.log('tx_json_fullfill: '+JSON.stringify(spendTransaction.toJSON()))
  return spendTransaction
}

const sigHashType = Buffer.from([0x41])

export const createSignature = (sigHash: Buffer, secret: string) => {
  let privKey
  try {
    privKey = KeyRing.fromSecret(secret).getPrivateKey()
  } catch (e) {
    console.warn('spend进这里了'+JSON.stringify(e))
    return undefined
  }
  console.warn('走这里了么')
  const sig = secp256k1.signDER(sigHash, privKey) as Buffer
  const fullSig = Buffer.concat([sig, sigHashType])
  return fullSig
}
