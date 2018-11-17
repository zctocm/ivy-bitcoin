// external imports
import React from "react"
import { connect } from "react-redux"

// internal imports
import { getCompiled, getError, getSource } from "../selectors"
import Ace from "./ace"
import ErrorAlert from "./errorAlert"
import { Opcodes } from "./opcodes"

// Handles syntax highlighting
require("../util/ivymode.js")

const mapStateToProps = state => {
  console.log(state.templates.sourceMap)
  return {
    // todo 替换为out2  以及替换pre 的数据
    source: state.templates.sourceMap.TransferWithTimeout,
    // error: getError(state)
  }
}

const Editor = ({ source }) => {
  return (
    <div>
      <div className="panel panel-default">
        <div className="panel-heading clearfix">
          <h1 className="panel-title pull-left">Contract Template ( Out2 )</h1>
          <ul className="panel-heading-btns pull-right">
          </ul>
        </div>
        <Ace source={source} />
        {/*{error ? <ErrorAlert errorMessage={error} /> : <Opcodes />}*/}
        <div className="panel-body inner">
            <h1>Bitcoin Cash Script</h1>
            <pre className="wrap">
              IF DUP HASH160 PUSH(recoveryKeyHash) EQUALVERIFY CHECKSIGVERIFY PUSH(recoveryTime) CHECKLOCKTIMEVERIFY ELSE DUP HASH160 PUSH(pubkeyhash)
              EQUALVERIFY CHECKSIGVERIFY DUP PUSH(t0) GREATTHAN PUSH(1) NUMEQUALVERIFY DUP PUSH(t1) LESSTHAN PUSH(1) NUMEQUALVERIFY PUSH(threshold)
              PUSH(2) PICK GREATTHAN PUSH(1) NUMEQUALVERIFY CAT PUSH(tpubkey) CHECKDATASIG ENDIF
            </pre>
        </div>
      </div>
    </div>
  )
}

export default connect(mapStateToProps)(Editor)
