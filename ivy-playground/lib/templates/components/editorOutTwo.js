// external imports
import React from "react";
import { connect } from "react-redux";
import Ace from "./ace";
// Handles syntax highlighting
require("../util/ivymode.js");
const mapStateToProps = state => {
    console.log(state.templates.sourceMap);
    return {
        // todo 替换为out2  以及替换pre 的数据
        source: state.templates.sourceMap.TransferWithTimeout,
    };
};
const Editor = ({ source }) => {
    return (React.createElement("div", null,
        React.createElement("div", { className: "panel panel-default" },
            React.createElement("div", { className: "panel-heading clearfix" },
                React.createElement("h1", { className: "panel-title pull-left" }, "Contract Template ( Out2 )"),
                React.createElement("ul", { className: "panel-heading-btns pull-right" })),
            React.createElement(Ace, { source: source }),
            React.createElement("div", { className: "panel-body inner" },
                React.createElement("h1", null, "Bitcoin Cash Script"),
                React.createElement("pre", { className: "wrap" }, "IF DUP HASH160 PUSH(recoveryKeyHash) EQUALVERIFY CHECKSIGVERIFY PUSH(recoveryTime) CHECKLOCKTIMEVERIFY ELSE DUP HASH160 PUSH(pubkeyhash) EQUALVERIFY CHECKSIGVERIFY DUP PUSH(t0) GREATTHAN PUSH(1) NUMEQUALVERIFY DUP PUSH(t1) LESSTHAN PUSH(1) NUMEQUALVERIFY PUSH(threshold) PUSH(2) PICK GREATTHAN PUSH(1) NUMEQUALVERIFY CAT PUSH(tpubkey) CHECKDATASIG ENDIF")))));
};
export default connect(mapStateToProps)(Editor);
