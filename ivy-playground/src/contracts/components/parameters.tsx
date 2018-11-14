import { typeToString } from "ivy-bitcoin"
import * as momentImport from "moment"
// external imports
import React from "react"
import {
  ButtonToolbar,
  DropdownButton,
  Form,
  FormControl,
  FormGroup,
  HelpBlock,
  InputGroup,
  MenuItem,
  Panel,
  ToggleButton,
  ToggleButtonGroup
} from "react-bootstrap"
import { connect } from "react-redux"
import { compose } from "redux"
import {
  LockTimeControl,
  SequenceNumberControl
} from "./transactionDetailInputs"

// ivy imports
import { getState as getContractsState } from "../../contracts/selectors"
import {
  getShowUnlockInputErrors,
  getSpendContract
} from "../../contracts/selectors"
import {
  getInputMap,
  getParameterIds,
  getParameterIds2,
  getShowLockInputErrors
} from "../../templates/selectors"

import RadioSelect from "../../app/components/radioselect"
import {
  BlockheightTimeInput,
  BlocksDurationInput,
  BooleanInput,
  BytesInput,
  ComplexInput,
  DurationInput,
  GenerateBytesInput,
  GenerateHashInput,
  GeneratePrivateKeyInput,
  GeneratePublicKeyInput,
  GenerateSignatureInput,
  getChild,
  HashInput,
  Input,
  InputContext,
  InputType,
  LockTimeInput,
  NumberInput,
  ParameterInput,
  ProvideBytesInput,
  ProvideHashInput,
  ProvidePrivateKeyInput,
  ProvidePublicKeyInput,
  ProvideSignatureInput,
  PublicKeyInput,
  SecondsDurationInput,
  SequenceNumberInput,
  SignatureInput,
  TimeInput,
  TimestampTimeInput,
  ValueInput
} from "../../inputs/types"

import {
  computeDataForInput,
  getInputContext,
  getParameterIdentifier,
  validateInput
} from "../../inputs/data"

// internal imports
import { updateClauseInput, updateInput } from "../actions"
import {
  getClauseParameterIds,
  getError,
  getSignatureData,
  getSpendInputMap
} from "../selectors"

// weird workaround
const moment =
  typeof (momentImport as any).default === "function"
    ? (momentImport as any).default
    : momentImport

function getChildWidget(input: ComplexInput, isTwo: boolean = false) {
  return (
      isTwo ? getWidget2(getChild(input)) : getWidget(getChild(input))
  )
}

function ParameterWidget(props: {
  input: ParameterInput
  handleChange: (e) => undefined
}) {
  // handle the fact that unknown input types end up here
  if (props.input.valueType === undefined) {
    throw new Error("invalid input for ParameterWidget: " + props.input.name)
  }
  // handle the fact that clause arguments look like spend.sig rather than sig
  const parameterName = getParameterIdentifier(props.input)
  const valueType = typeToString(props.input.valueType)
  return (
    <div key={props.input.name}>
      <label>
        {parameterName}: <span className="type-label">{valueType}</span>
      </label>
      {getChildWidget(props.input)}
    </div>
  )
}
function ParameterWidget2(props: {
    input: ParameterInput
    handleChange: (e) => undefined
}) {
    // handle the fact that unknown input types end up here
    if (props.input.valueType === undefined) {
        throw new Error("invalid input for ParameterWidget: " + props.input.name)
    }
    // handle the fact that clause arguments look like spend.sig rather than sig
    const parameterName = getParameterIdentifier(props.input)
    const valueType = typeToString(props.input.valueType)
    return (
        <div key={props.input.name}>
            <label>
                {parameterName}: <span className="type-label">{valueType}</span>
            </label>
            {getChildWidget(props.input,true)}
        </div>
    )
}
function GenerateBytesWidget(props: {
  id: string
  input: GenerateBytesInput
  handleChange: (e) => undefined
}) {
  return (
    <div>
      <InputGroup>
        <InputGroup.Addon>Length</InputGroup.Addon>
        <FormControl
          type="text"
          style={{ width: 200 }}
          key={props.input.name}
          value={props.input.value}
          onChange={props.handleChange}
        />
      </InputGroup>
      <ComputedValue computeFor={props.id} />
    </div>
  )
}
function GenerateBytesWidget2(props: {
    id: string
    input: GenerateBytesInput
    handleChange: (e) => undefined
}) {
    return (
        <div>
            <InputGroup>
                <InputGroup.Addon>Length</InputGroup.Addon>
                <FormControl
                    type="text"
                    style={{ width: 200 }}
                    key={props.input.name}
                    value={props.input.value}
                    onChange={props.handleChange}
                />
            </InputGroup>
            <ComputedValue computeFor={props.id}  isTwo = { true } />
        </div>
    )
}
function NumberWidget(props: {
  input: NumberInput
  handleChange: (e) => undefined
}) {
  return (
    <FormControl
      type="text"
      style={{ width: 250 }}
      key={props.input.name}
      value={props.input.value}
      onChange={props.handleChange}
    />
  )
}

function ValueWidget(props: {
  input: ValueInput
  handleChange: (e) => undefined
}) {
  return (
    <InputGroup style={{ width: "300px" }}>
      <FormControl
        type="text"
        className="string-input"
        placeholder="0.0"
        key={props.input.name}
        value={props.input.value}
        onChange={props.handleChange}
      />
      <InputGroup.Addon>BTC (simulated)</InputGroup.Addon>
    </InputGroup>
  )
}

function TimestampTimeWidget(props: {
  input: TimeInput
  handleChange: (e) => undefined
}) {
  return (
    <div className="form-group">
      <FormControl
        type="datetime-local"
        key={props.input.name}
        value={props.input.value}
        onChange={props.handleChange}
      />
    </div>
  )
}

function BooleanWidget(props: {
  input: BooleanInput
  handleChange: (e) => undefined
}) {
  // onChange is broken on ToggleButtonGroup
  // so we use a workaround
  return (
    <ButtonToolbar>
      <ToggleButtonGroup
        key={props.input.name}
        type="radio"
        name="options"
        value={props.input.value}
        onChange={e => undefined}
      >
        <ToggleButton
          onClick={e => {
            props.handleChange({ target: { value: "true" } })
          }}
          value="true"
        >
          True
        </ToggleButton>
        <ToggleButton
          onClick={e => {
            props.handleChange({ target: { value: "false" } })
          }}
          value="false"
        >
          False
        </ToggleButton>
      </ToggleButtonGroup>
    </ButtonToolbar>
  )
}

function BytesWidget(props: {
  input: BytesInput
  handleChange: (e) => undefined
}) {
  const options = [
    { label: "Generate Bytes", value: "generateBytesInput" },
    { label: "Provide Bytes", value: "provideBytesInput" }
  ]
  return (
    <div>
      <RadioSelect
        options={options}
        selected={props.input.value}
        name={props.input.name}
        handleChange={props.handleChange}
      />
      {getChildWidget(props.input)}
    </div>
  )
}
function BytesWidget2(props: {
    input: BytesInput
    handleChange: (e) => undefined
}) {
    const options = [
        { label: "Generate Bytes", value: "generateBytesInput" },
        { label: "Provide Bytes", value: "provideBytesInput" }
    ]
    return (
        <div>
            <RadioSelect
                options={options}
                selected={props.input.value}
                name={props.input.name}
                handleChange={props.handleChange}
            />
            {getChildWidget(props.input, true)}
        </div>
    )
}

function ProvidePrivateKeyWidget(props: {
  input: ProvidePrivateKeyInput
  handleChange: (e) => undefined
}) {
  return (
    <div>
      <TextWidget input={props.input} handleChange={props.handleChange} />
      <HelpBlock>(Do not paste your own Bitcoin private key here)</HelpBlock>
    </div>
  )
}

function TextWidget(props: {
  input:
    | ProvideBytesInput
    | ProvideHashInput
    | ProvidePublicKeyInput
    | ProvideSignatureInput
    | ProvidePrivateKeyInput
  handleChange: (e) => undefined
}) {
  return (
    <FormControl
      type="text"
      key={props.input.name}
      className="form-control string-input"
      value={props.input.value}
      onChange={props.handleChange}
    />
  )
}

function HashWidget(props: {
  input: HashInput
  handleChange: (e) => undefined
}) {
  const options = [
    { label: "Generate Hash", value: "generateHashInput" },
    { label: "Provide Hash", value: "provideHashInput" }
  ]
  const handleChange = (s: string) => undefined
  return (
    <div>
      <RadioSelect
        options={options}
        selected={props.input.value}
        name={props.input.name}
        handleChange={props.handleChange}
      />
      {getChildWidget(props.input)}
    </div>
  )
}
function HashWidget2(props: {
    input: HashInput
    handleChange: (e) => undefined
}) {
    const options = [
        { label: "Generate Hash", value: "generateHashInput" },
        { label: "Provide Hash", value: "provideHashInput" }
    ]
    const handleChange = (s: string) => undefined
    return (
        <div>
            <RadioSelect
                options={options}
                selected={props.input.value}
                name={props.input.name}
                handleChange={props.handleChange}
            />
            {getChildWidget(props.input,true)}
        </div>
    )
}
function GenerateHashWidget(props: {
  id: string
  input: GenerateHashInput
  handleChange: (e) => undefined
}) {
  return (
    <div>
      <ComputedValue computeFor={props.id} />
      <div className="nested">
        <div className="description">
          {props.input.hashType.hashFunction} of:
        </div>
        <label className="type-label">
          {typeToString(props.input.hashType.inputType)}
        </label>
        {getChildWidget(props.input)}
      </div>
    </div>
  )
}

function GenerateHashWidget2(props: {
    id: string
    input: GenerateHashInput
    handleChange: (e) => undefined
}) {
    return (
        <div>
            <ComputedValue computeFor={props.id} isTwo = { true } />
            <div className="nested">
                <div className="description">
                    {props.input.hashType.hashFunction} of:
                </div>
                <label className="type-label">
                    {typeToString(props.input.hashType.inputType)}
                </label>
                {getChildWidget(props.input, true)}
            </div>
        </div>
    )
}

function PublicKeyWidget(props: {
  input: PublicKeyInput
  handleChange: (e) => undefined
}) {
  const options = [
    { label: "Generate Public Key", value: "generatePublicKeyInput" },
    { label: "Provide Public Key", value: "providePublicKeyInput" }
  ]
  const handleChange = (s: string) => undefined
  return (
    <div>
      <RadioSelect
        options={options}
        selected={props.input.value}
        name={props.input.name}
        handleChange={props.handleChange}
      />
      {getChildWidget(props.input)}
    </div>
  )
}

function PublicKeyWidget2(props: {
    input: PublicKeyInput
    handleChange: (e) => undefined
}) {
    const options = [
        { label: "Generate Public Key", value: "generatePublicKeyInput" },
        { label: "Provide Public Key", value: "providePublicKeyInput" }
    ]
    const handleChange = (s: string) => undefined
    return (
        <div>
            <RadioSelect
                options={options}
                selected={props.input.value}
                name={props.input.name}
                handleChange={props.handleChange}
            />
            {getChildWidget(props.input, true)}
        </div>
    )
}

function GeneratePublicKeyWidget(props: {
  id: string
  input: GeneratePublicKeyInput
  handleChange: (e) => undefined
}) {
  const options = [
    { label: "Generate Private Key", value: "generatePrivateKeyInput" },
    { label: "Provide Private Key", value: "providePrivateKeyInput" }
  ]
  return (
    <div>
      <ComputedValue computeFor={props.id} />
      <div className="nested">
        <div className="description">derived from:</div>
        <label className="type-label">PrivateKey</label>
        <RadioSelect
          options={options}
          selected={props.input.value}
          name={props.input.name}
          handleChange={props.handleChange}
        />
        {getChildWidget(props.input)}
      </div>
    </div>
  )
}
function GeneratePublicKeyWidget2(props: {
    id: string
    input: GeneratePublicKeyInput
    handleChange: (e) => undefined
}) {
    const options = [
        { label: "Generate Private Key", value: "generatePrivateKeyInput" },
        { label: "Provide Private Key", value: "providePrivateKeyInput" }
    ]
    return (
        <div>
            <ComputedValue computeFor={props.id} isTwo = {true} />
            <div className="nested">
                <div className="description">derived from:</div>
                <label className="type-label">PrivateKey</label>
                <RadioSelect
                    options={options}
                    selected={props.input.value}
                    name={props.input.name}
                    handleChange={props.handleChange}
                />
                {getChildWidget(props.input, true)}
            </div>
        </div>
    )
}
function GenerateSignatureWidget(props: {
  id: string
  input: GenerateSignatureInput
  handleChange: (e) => undefined
  computedValue: string
}) {
  return (
    <div>
      <ComputedValue computeFor={props.id} />
      <div className="nested">
        <div className="description">signed using:</div>
        <label className="type-label">PrivateKey</label>
        {getChildWidget(props.input)}
      </div>
    </div>
  )
}
function GenerateSignatureWidget2(props: {
    id: string
    input: GenerateSignatureInput
    handleChange: (e) => undefined
    computedValue: string
}) {
    return (
        <div>
            <ComputedValue computeFor={props.id} isTwo = {true} />
            <div className="nested">
                <div className="description">signed using:</div>
                <label className="type-label">PrivateKey</label>
                {getChildWidget(props.input, true)}
            </div>
        </div>
    )
}
function SignatureWidget(props: {
  input: SignatureInput
  handleChange: (e) => undefined
  computedValue: string
}) {
  const options = [
    { label: "Generate Signature", value: "generateSignatureInput" },
    { label: "Provide Signature", value: "provideSignatureInput" }
  ]
  return (
    <div>
      <RadioSelect
        options={options}
        selected={props.input.value}
        name={props.input.name}
        handleChange={props.handleChange}
      />
      {getChildWidget(props.input)}
    </div>
  )
}
function SignatureWidget2(props: {
    input: SignatureInput
    handleChange: (e) => undefined
    computedValue: string
}) {
    const options = [
        { label: "Generate Signature", value: "generateSignatureInput" },
        { label: "Provide Signature", value: "provideSignatureInput" }
    ]
    return (
        <div>
            <RadioSelect
                options={options}
                selected={props.input.value}
                name={props.input.name}
                handleChange={props.handleChange}
            />
            {getChildWidget(props.input, true)}
        </div>
    )
}
function GeneratePrivateKeyWidget(props: {
  input: GeneratePrivateKeyInput
  handleChange: (e) => undefined
}) {
  return (
    <div>
      <pre className="wrap">{props.input.value}</pre>
    </div>
  )
}

interface Option {
  label: string
  value: string
}

function OptionsWidget(props: {
  input: DurationInput
  handleChange: (e) => undefined
  options: Option[]
}) {
  const chosenOptions = props.options.filter(
    opt => opt.value === props.input.value
  )
  if (chosenOptions.length !== 1) {
    throw new Error("there should be only one chosen option")
  }
  const chosen = chosenOptions[0]
  const others = props.options.filter(opt => opt.value !== props.input.value)
  const menuItems = others.map(opt => {
    return (
      <MenuItem
        key={opt.value}
        onClick={e => props.handleChange({ target: { value: opt.value } })}
      >
        {opt.label}
      </MenuItem>
    )
  })
  return (
    <div style={{ width: 300 }}>
      <InputGroup>
        {getChildWidget(props.input)}
        <DropdownButton
          componentClass={InputGroup.Button}
          id="input-dropdown-addon"
          title={chosen.label}
        >
          {menuItems}
        </DropdownButton>
      </InputGroup>
    </div>
  )
}
function OptionsWidget2(props: {
    input: DurationInput
    handleChange: (e) => undefined
    options: Option[]
}) {
    const chosenOptions = props.options.filter(
        opt => opt.value === props.input.value
    )
    if (chosenOptions.length !== 1) {
        throw new Error("there should be only one chosen option")
    }
    const chosen = chosenOptions[0]
    const others = props.options.filter(opt => opt.value !== props.input.value)
    const menuItems = others.map(opt => {
        return (
            <MenuItem
                key={opt.value}
                onClick={e => props.handleChange({ target: { value: opt.value } })}
            >
                {opt.label}
            </MenuItem>
        )
    })
    return (
        <div style={{ width: 300 }}>
            <InputGroup>
                {getChildWidget(props.input, true)}
                <DropdownButton
                    componentClass={InputGroup.Button}
                    id="input-dropdown-addon"
                    title={chosen.label}
                >
                    {menuItems}
                </DropdownButton>
            </InputGroup>
        </div>
    )
}
function DurationWidget(props: {
  input: DurationInput
  handleChange: (e) => undefined
}) {
  const options = [
    { label: "x 512 seconds", value: "secondsDurationInput" },
    { label: "Blocks", value: "blocksDurationInput" }
  ]
  const helperText =
    props.input.value === "secondsDurationInput" ? (
      <ComputedSecondsWidget
        name={props.input.name + ".secondsDurationInput"}
      />
    ) : (
      <ComputedDurationWidget
        name={props.input.name + ".blocksDurationInput"}
      />
    )
  return (
    <FormGroup>
      <OptionsWidget {...props} options={options} />
      {helperText}
    </FormGroup>
  )
}
function DurationWidget2(props: {
    input: DurationInput
    handleChange: (e) => undefined
}) {
    const options = [
        { label: "x 512 seconds", value: "secondsDurationInput" },
        { label: "Blocks", value: "blocksDurationInput" }
    ]
    const helperText =
        props.input.value === "secondsDurationInput" ? (
            <ComputedSecondsWidget
                name={props.input.name + ".secondsDurationInput"}
            />
        ) : (
            <ComputedDurationWidget
                name={props.input.name + ".blocksDurationInput"}
            />
        )
    return (
        <FormGroup>
            <OptionsWidget2 {...props} options={options} />
            {helperText}
        </FormGroup>
    )
}

function ComputedSecondsWidgetUnconnected(props: {
  input: SecondsDurationInput
}) {
  if (!/^\d+$/.test(props.input.value)) {
    return <span />
  }
  const durationsOf512Seconds = parseInt(props.input.value, 10)
  const duration =
    durationsOf512Seconds === 0
      ? "0 minutes"
      : moment.duration(durationsOf512Seconds * 512 * 1000).humanize()
  return <HelpBlock>~ {duration}</HelpBlock>
}

function ComputedBlockHeightWidgetUnconnected(props: {
  input: BlocksDurationInput
}) {
  if (!/^\d+$/.test(props.input.value)) {
    return <span />
  }
  const blocks = parseInt(props.input.value, 10)
  const duration =
    blocks === 0
      ? "0 minutes"
      : moment.duration(blocks * 10 * 60 * 1000).humanize()
  return <HelpBlock>~ {duration}</HelpBlock>
}

const mapStateToComputedInputProps = (state, { name }) => {
  const inputContext = name.split(".").shift() as InputContext
  let inputMap
    if (inputContext === "contractParameters") {
        inputMap = getInputMap(state)
    } else {
        inputMap = getSpendInputMap(state)
    }
  if (inputMap === undefined) {
    throw new Error("input map should not be undefined now")
  }
  return {
    input: inputMap[name]
  }
}

const ComputedSecondsWidget = connect(mapStateToComputedInputProps)(
  ComputedSecondsWidgetUnconnected
)

const ComputedDurationWidget = connect(mapStateToComputedInputProps)(
  ComputedBlockHeightWidgetUnconnected
)

function TimeWidget(props: {
  input: DurationInput
  handleChange: (e) => undefined
}) {
  const options = [
    {
      label: "Timestamp (UTC)",
      value: "timestampTimeInput"
    },
    {
      label: "Block Height",
      value: "blockheightTimeInput"
    }
  ]
  return <OptionsWidget {...props} options={options} />
}

function TimeWidget2(props: {
    input: DurationInput
    handleChange: (e) => undefined
}) {
    const options = [
        {
            label: "Timestamp (UTC)",
            value: "timestampTimeInput"
        },
        {
            label: "Block Height",
            value: "blockheightTimeInput"
        }
    ]
    return <OptionsWidget2 {...props} options={options} />
}

function BalanceWidgetUnconnected({ namePrefix, balance }) {
  let jsx = <small />
  if (balance !== undefined) {
    jsx = <small className="value-balance">{balance} available</small>
  }
  return jsx
}

function LockTimeWidget(props: {
  input: LockTimeInput
  handleChange: (e) => undefined
}) {
  return getChildWidget(props.input)
}

function LockTimeWidget2(props: {
    input: LockTimeInput
    handleChange: (e) => undefined
}) {
    return getChildWidget(props.input, true)
}

function SequenceNumberWidget(props: {
  input: SequenceNumberInput
  handleChange: (e) => undefined
}) {
  return getChildWidget(props.input)
}
function SequenceNumberWidget2(props: {
    input: SequenceNumberInput
    handleChange: (e) => undefined
}) {
    return getChildWidget(props.input, true)
}
function getWidgetType(
  type: InputType,
  isTwo: boolean = false
): ((props: {input: Input; handleChange: (e) => undefined }) => JSX.Element) {
  switch (type) {
    case "numberInput":
      return NumberWidget
    case "booleanInput":
      return BooleanWidget
    case "bytesInput":
      return (isTwo ? BytesWidget2 : BytesWidget)
    case "generateBytesInput":
      return (isTwo? GenerateBytesWidget2: GenerateBytesWidget)
    case "provideBytesInput":
      return TextWidget
    case "publicKeyInput":
      return (isTwo? PublicKeyWidget2 : PublicKeyWidget)
    case "signatureInput":
      return (isTwo? SignatureWidget2: SignatureWidget)
    case "generateSignatureInput":
      return (isTwo? GenerateSignatureWidget2 : GenerateSignatureWidget)
    case "generatePublicKeyInput":
      return (isTwo ? GeneratePublicKeyWidget2 : GeneratePublicKeyWidget)
    case "generatePrivateKeyInput":
      return GeneratePrivateKeyWidget
    case "providePublicKeyInput":
      return TextWidget
    case "providePrivateKeyInput":
      return ProvidePrivateKeyWidget
    case "provideSignatureInput":
      return TextWidget
    case "hashInput":
      return (isTwo? HashWidget2 : HashWidget)
    case "provideHashInput":
      return TextWidget
    case "generateHashInput":
      return (isTwo? GenerateHashWidget2 : GenerateHashWidget)
    case "timeInput":
      return (isTwo? TimeWidget2 : TimeWidget)
    case "valueInput":
      return ValueWidget
    case "timestampTimeInput":
      return TimestampTimeWidget
    case "blockheightTimeInput":
      return NumberWidget
    case "durationInput":
      return (isTwo? DurationWidget2 : DurationWidget)
    case "secondsDurationInput":
      return TextWidget
    case "blocksDurationInput":
      return TextWidget
    case "lockTimeInput":
      return (isTwo? LockTimeWidget2 : LockTimeWidget)
    case "sequenceNumberInput":
      return SequenceNumberWidget
    default:
      return (isTwo ? ParameterWidget2 : ParameterWidget)
  }
}

function mapToInputProps(
  pageShowError: boolean,
  inputsById: { [s: string]: Input },
  id: string
) {
  const input = inputsById[id]
  if (input === undefined) {
    throw new Error("bad input ID: " + id)
  }

  const hasInputError = !validateInput(input)

  return {
    input,
    hasInputError,
    pageShowError
  }
}

function mapToInputProps2(
    pageShowError: boolean,
    inputsById: { [s: string]: Input },
    id: string
) {
    const input = inputsById[id]
    if (input === undefined) {
        throw new Error("bad input ID: " + id)
    }

    const hasInputError = !validateInput(input)

    return {
        input,
        hasInputError,
        pageShowError
    }
}

function mapStateToContractInputProps(
  state,
  ownProps: { id: string; showError: boolean }
) {
  const inputMap = getInputMap(state)
  if (inputMap === undefined) {
    throw new Error(
      "inputMap should not be undefined when contract inputs are being rendered"
    )
  }
  // const showError = getShowLockInputErrors(state)
    return mapToInputProps(ownProps.showError, inputMap, ownProps.id)
}
function mapStateToContractInputProps2(
  state,
  ownProps: { id: string; showError: boolean }
) {
  const inputMap = state.templates.inputMap2
  if (inputMap === undefined) {
    throw new Error(
      "inputMap should not be undefined when contract inputs are being rendered"
    )
  }
  // const showError = getShowLockInputErrors(state)
  return mapToInputProps2(ownProps.showError, inputMap, ownProps.id)
}

function mapDispatchToContractInputProps(dispatch, ownProps: { id: string }) {
  return {
    handleChange: e => {
      dispatch(updateInput(ownProps.id, e.target.value.toString()))
    }
  }
}

function mapStateToSpendInputProps(state, ownProps: { id: string }) {
  const inputsById = getSpendInputMap(state)
  const showError = getShowUnlockInputErrors(state)
  return mapToInputProps(showError, inputsById, ownProps.id)
}

function mapDispatchToSpendInputProps(dispatch, ownProps: { id: string }) {
  return {
    handleChange: e => {
      dispatch(updateClauseInput(ownProps.id, e.target.value.toString()))
    }
  }
}

function mapToComputedProps(state, ownProps: any) {
  const id = ownProps.computeFor
  const { isTwo } = ownProps
  const inputContext = id.split(".").shift() as InputContext
  console.log(isTwo)
  let inputsById
    if (inputContext === "contractParameters") {
        inputsById = isTwo ?  state.templates.inputMap2 : getInputMap(state)
    } else {
        inputsById = getSpendInputMap(state)
    }
  if (inputsById === undefined) {
    throw new Error(
      "inputMap should not be undefined when contract inputs are being rendered"
    )
  }
  const input = inputsById[id]
  if (input === undefined) {
    throw new Error("bad input ID: " + ownProps.computeFor)
  }
  if (
    input.type === "generateHashInput" ||
    input.type === "generateBytesInput" ||
    input.type === "generatePublicKeyInput"
  ) {
    try {
      const computedValue = computeDataForInput(ownProps.computeFor, inputsById)
      return {
        value: computedValue
      }
    } catch (e) {
      console.log(e)
      return {}
    }
  } else if (input.type === "generateSignatureInput") {
    try {
      const computedValue = getSignatureData(state, id, inputsById)
      return {
        value: computedValue
      }
    } catch (e) {
      console.log(e)
      return {}
    }
  }
}

function ComputedValueUnconnected(props: { value: string }) {
  return props.value ? <pre>{props.value}</pre> : <span />
}

const ComputedValue = connect(mapToComputedProps)(ComputedValueUnconnected)

// higher order component
function addID(id: string) {
  return (WrappedWidget: any) => {
    return React.createElement(WrappedWidget, {
      key: "connect(" + id + ")",
      id
    })
  }
}

// higher order component
function focusWidget(WrappedWidget) {
  return class FocusWidget extends React.Component<
    {
      hasInputError: boolean
      pageShowError: boolean
      handleChange: (e) => undefined
    },
    { showError: boolean }
  > {
    constructor(props) {
      super(props)
      this.state = { showError: false }
    }

    public componentWillReceiveProps(nextProps) {
      this.setState({ showError: true })
    }

    public render() {
      const { handleChange, hasInputError, ...passProps } = this.props
      const errorClass = hasInputError
        ? this.state.showError ? "has-error" : "has-warning"
        : ""
      return (
        <div className={"form-group " + errorClass}>
          <WrappedWidget
            errorClass={errorClass}
            handleChange={handleChange}
            {...passProps}
          />
        </div>
      )
    }
  }
}

export function getWidget(id: string): JSX.Element {
  const inputContext = id.split(".").shift() as InputContext
  const type = id.split(".").pop() as InputType
  let widgetTypeConnected
  if (inputContext === "contractParameters") {
    widgetTypeConnected = connect(
      mapStateToContractInputProps,
      mapDispatchToContractInputProps
    )(focusWidget(getWidgetType(type)))
  } else {
    widgetTypeConnected = connect(
      mapStateToSpendInputProps,
      mapDispatchToSpendInputProps
    )(focusWidget(getWidgetType(type)))
  }
  const widget = addID(id)(widgetTypeConnected)
  return (
    <div className="widget-wrapper" key={"container(" + id + ")"}>
      {widget}
    </div>
  )
}

export function getWidget2(id: string): JSX.Element {
    const inputContext = id.split(".").shift() as InputContext
    const type = id.split(".").pop() as InputType
    let widgetTypeConnected
    if (inputContext === "contractParameters") {
        widgetTypeConnected = connect(
            mapStateToContractInputProps2,
            mapDispatchToContractInputProps
        )(focusWidget(getWidgetType(type, true)))
    } else {
        widgetTypeConnected = connect(
            mapStateToSpendInputProps,
            mapDispatchToSpendInputProps
        )(focusWidget(getWidgetType(type, true)))
    }
    const widget = addID(id)(widgetTypeConnected)
    return (
        <div className="widget-wrapper" key={"container(" + id + ")"}>
            {widget}
        </div>
    )
}

function mapStateToContractParametersProps(state) {
    console.log('getParameterIds(state)', getParameterIds(state))
    return {
    parameterIds: getParameterIds(state)
  }
}

function mapStateToContractParametersPropsTwo(state) {
    return {
        parameterIds: getParameterIds2(state)
    }
}

function ContractParametersUnconnected(props: { parameterIds: string[] }) {
  if (props.parameterIds.length === 0) {
    return <div />
  }
    const parameterInputs = props.parameterIds.map(id => {
    return (
      <div key={id} className="argument">
        {getWidget(id)}
      </div>
    )
  })
  return (
    <section style={{ wordBreak: "break-all" }}>
      <Form>{parameterInputs}</Form>
    </section>
  )
}

function ContractParametersUnconnectedTwo(props: { parameterIds: string[] }) {
    if (props.parameterIds.length === 0) {
        return <div />
    }
    const parameterInputs = props.parameterIds.map(id => {
        return (
            <div key={id} className="argument">
                {getWidget2(id)}
            </div>
        )
    })
    return (
        <section style={{ wordBreak: "break-all" }}>
            <Form>{parameterInputs}</Form>
        </section>
    )
}

export const ContractParameters = connect(mapStateToContractParametersProps)(
    ContractParametersUnconnected
)
// checkDataSig output 2
export const ContractParametersTwo= connect(mapStateToContractParametersPropsTwo)(
    ContractParametersUnconnectedTwo
)

function ClauseParametersUnconnected(props: { parameterIds: string[] }) {
  if (props.parameterIds.length === 0) {
    return <div />
  }
    const parameterInputs = props.parameterIds.map(id => {
    return (
      <div key={id} className="argument">
        {getWidget(id)}
      </div>
    )
  })
  return (
    <section>
      <h4>Clause Arguments</h4>
      <Form>{parameterInputs}</Form>
    </section>
  )
}

export const ClauseParameters = connect(state => ({
  parameterIds: getClauseParameterIds(state)
}))(ClauseParametersUnconnected)
