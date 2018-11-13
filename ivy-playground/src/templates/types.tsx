import { ContractParameterType, InputMap } from "../inputs/types"

import { Template, TemplateClause } from "ivy-bitcoin"

export interface SourceMap {
  [s: string]: string
}

export interface Param {
  name: string
  type: ContractParameterType
}

export interface HashCall {
  hashType: string
  arg: string
  argType: string
}

export interface ValueInfo {
  name: string
  program?: string
  amount?: string
}

export interface ClauseInfo {
  name: string
  args: Param[]
  mintimes: string[]
  maxtimes: string[]
  hashCalls: HashCall[]
  valueInfo: ValueInfo[]
}

export interface TemplateState {
  sourceMap: SourceMap
  idList: string[]
  source: string,
  source2: string,
  chosenTemplate: string,
  inputMap?: InputMap
  inputMap2?: InputMap
  compiled?: Template
  compiled2?: Template
  showLockInputErrors: boolean
  error?
}

export { Template, TemplateClause }
