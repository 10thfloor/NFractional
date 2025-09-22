import "FungibleToken"
import "FlowToken"
import "DeFiActions"
import "DeFiActionsMathUtils"
import "DeFiActionsUtils"
import "ConstantProductAMM"

// ConstantProductAMMSwapper: DeFiActions-compatible Swapper adapter for ConstantProductAMM pools
// Provides standardized quote and swap interfaces without altering AMM core economics.
access(all) contract ConstantProductAMMSwapper {

  // Public constants to avoid magic numbers for Direction
  access(all) let DIR_SHARE_TO_FLOW: UInt8
  access(all) let DIR_FLOW_TO_SHARE: UInt8

  access(all) enum Direction: UInt8 {
    access(all) case ShareToFlow
    access(all) case FlowToShare
  }

  // Local swap event for indexers (DeFiActions events cannot be emitted outside that contract)
  access(all) event Swapped(
    inVault: String,
    outVault: String,
    inAmount: UFix64,
    outAmount: UFix64,
    inUUID: UInt64,
    outUUID: UInt64,
    uniqueID: UInt64?,
    swapperType: String
  )

  // Quote struct implementing DeFiActions.Quote
  access(all) struct AMMQuote: DeFiActions.Quote {
    access(all) let inType: Type
    access(all) let outType: Type
    access(all) let inAmount: UFix64
    access(all) let outAmount: UFix64

    init(inType: Type, outType: Type, inAmount: UFix64, outAmount: UFix64) {
      self.inType = inType
      self.outType = outType
      self.inAmount = inAmount
      self.outAmount = outAmount
    }
  }

  // Custom interface that extends DeFiActions.Swapper to support fee extraction
  access(all) struct interface FeeSwapper: DeFiActions.Swapper {
    access(all) fun swapWithFee(quote: {DeFiActions.Quote}?, inVault: @{FungibleToken.Vault}): @{String: {FungibleToken.Vault}}
  }

  // Swapper adapter implementing FeeSwapper
  access(all) struct AMMSwapper: FeeSwapper {
    // Required by IdentifiableStruct
    access(contract) var uniqueID: DeFiActions.UniqueIdentifier?

    access(self) let poolCap: Capability<&ConstantProductAMM.Pool>
    access(self) let direction: ConstantProductAMMSwapper.Direction
    access(self) let trader: Address

    init(poolCap: Capability<&ConstantProductAMM.Pool>, direction: ConstantProductAMMSwapper.Direction, trader: Address, id: DeFiActions.UniqueIdentifier?) {
      if !poolCap.check() { panic("invalid pool capability") }
      self.poolCap = poolCap
      self.direction = direction
      self.trader = trader
      self.uniqueID = id
    }

    // Types for current direction
    access(all) view fun inType(): Type {
      if self.direction == ConstantProductAMMSwapper.Direction.ShareToFlow {
        // share side is pool-bound; expose its type from pool
        let p = self.poolCap.borrow() ?? panic("invalid pool capability")
        return p.getShareVaultType()
      }
      return Type<@FlowToken.Vault>()
    }

    access(all) view fun outType(): Type {
      if self.direction == ConstantProductAMMSwapper.Direction.ShareToFlow {
        return Type<@FlowToken.Vault>()
      }
      let p = self.poolCap.borrow() ?? panic("invalid pool capability")
      return p.getShareVaultType()
    }

    // Quote required input to receive desired output. If reverse is true, flip direction for quoting.
    access(all) fun quoteIn(forDesired: UFix64, reverse: Bool): {DeFiActions.Quote} {
      let dir = reverse ? (self.direction == ConstantProductAMMSwapper.Direction.ShareToFlow ? ConstantProductAMMSwapper.Direction.FlowToShare : ConstantProductAMMSwapper.Direction.ShareToFlow) : self.direction
      let p = self.poolCap.borrow() ?? panic("invalid pool capability")
      let res: {String: UFix64} = p.reserves()
      let feeMul: UFix64 = (10000.0 - UFix64(p.feeBps)) / 10000.0
      if feeMul <= 0.0 { panic("invalid fee") }

      if dir == ConstantProductAMMSwapper.Direction.ShareToFlow {
        let xOpt: UFix64? = res["share"]
        let yOpt: UFix64? = res["flow"]
        if xOpt == nil || yOpt == nil { panic("reserve keys missing") }
        let x: UFix64 = xOpt!
        let y: UFix64 = yOpt!
        if forDesired >= y { panic("desired out exceeds reserves") }
        // in = (out * x) / (feeMul * (y - out)) with rounding up
        let denom: UFix64 = feeMul * (y - forDesired)
        let reqIn: UFix64 = DeFiActionsMathUtils.divUFix64WithRoundingUp((forDesired * x), denom)
        return AMMQuote(
          inType: p.getShareVaultType(),
          outType: Type<@FlowToken.Vault>(),
          inAmount: reqIn,
          outAmount: forDesired
        )
      } else {
        let xOpt: UFix64? = res["flow"]
        let yOpt: UFix64? = res["share"]
        if xOpt == nil || yOpt == nil { panic("reserve keys missing") }
        let x: UFix64 = xOpt!
        let y: UFix64 = yOpt!
        if forDesired >= y { panic("desired out exceeds reserves") }
        let denom: UFix64 = feeMul * (y - forDesired)
        let reqIn: UFix64 = DeFiActionsMathUtils.divUFix64WithRoundingUp((forDesired * x), denom)
        return AMMQuote(
          inType: Type<@FlowToken.Vault>(),
          outType: p.getShareVaultType(),
          inAmount: reqIn,
          outAmount: forDesired
        )
      }
    }

    // Quote output for provided input. If reverse is true, flip direction for quoting.
    access(all) fun quoteOut(forProvided: UFix64, reverse: Bool): {DeFiActions.Quote} {
      let dir = reverse ? (self.direction == ConstantProductAMMSwapper.Direction.ShareToFlow ? ConstantProductAMMSwapper.Direction.FlowToShare : ConstantProductAMMSwapper.Direction.ShareToFlow) : self.direction
      let p = self.poolCap.borrow() ?? panic("invalid pool capability")
      if dir == ConstantProductAMMSwapper.Direction.ShareToFlow {
        let out: UFix64 = p.quoteOutShareToFlow(amountIn: forProvided)
        return AMMQuote(
          inType: p.getShareVaultType(),
          outType: Type<@FlowToken.Vault>(),
          inAmount: forProvided,
          outAmount: out
        )
      } else {
        let out: UFix64 = p.quoteOutFlowToShare(amountIn: forProvided)
        return AMMQuote(
          inType: Type<@FlowToken.Vault>(),
          outType: p.getShareVaultType(),
          inAmount: forProvided,
          outAmount: out
        )
      }
    }

    // Standard swap method for DeFiActions.Swapper interface compliance
    access(all) fun swap(quote: {DeFiActions.Quote}?, inVault: @{FungibleToken.Vault}): @{FungibleToken.Vault} {
      let result <- self.swapWithFee(quote: quote, inVault: <-inVault)
      let output <- result.remove(key: "output")!
      let fee <- result.remove(key: "fee")!
      destroy result
      destroy fee
      return <-output
    }

    // Perform swap along current direction with fee extraction (enforces slippage if quote provided)
    access(all) fun swapWithFee(quote: {DeFiActions.Quote}?, inVault: @{FungibleToken.Vault}): @{String: {FungibleToken.Vault}} {
      if inVault.getType() != self.inType() { panic("invalid input vault type") }
      if quote != nil && !(quote!.inType == self.inType() && quote!.outType == self.outType()) { panic("quote types mismatch") }
      let p = self.poolCap.borrow() ?? panic("invalid pool capability")
      let inTypeStr: String = inVault.getType().identifier
      let inAmt: UFix64 = inVault.balance
      let inUUID: UInt64 = inVault.uuid
      if self.direction == ConstantProductAMMSwapper.Direction.ShareToFlow {
        let minOut: UFix64 = quote != nil ? quote!.outAmount : 0.0
        let result: @{String: {FungibleToken.Vault}} <- p.swapShareForFlow(input: <-inVault, minOut: minOut, trader: self.trader)
        let out: @FlowToken.Vault <- result.remove(key: "output")! as! @FlowToken.Vault
        let fee: @{FungibleToken.Vault} <- result.remove(key: "fee")!
        destroy result
        
        // Store values before moving
        let outTypeStr: String = out.getType().identifier
        let outAmount: UFix64 = out.balance
        let outUUID: UInt64 = out.uuid
        
        emit Swapped(
          inVault: inTypeStr,
          outVault: outTypeStr,
          inAmount: inAmt,
          outAmount: outAmount,
          inUUID: inUUID,
          outUUID: outUUID,
          uniqueID: self.uniqueID?.id ?? nil,
          swapperType: self.getType().identifier
        )
        // If a quote was supplied, ensure execution is at least as good
        if quote != nil && outAmount < quote!.outAmount { panic("slippage: out < quoted") }
        return <- {
          "output": <-out,
          "fee": <-fee
        }
      } else {
        let casted: @FlowToken.Vault <- (inVault as! @FlowToken.Vault)
        let minOut2: UFix64 = quote != nil ? quote!.outAmount : 0.0
        let result: @{String: {FungibleToken.Vault}} <- p.swapFlowForShare(input: <-casted, minOut: minOut2, trader: self.trader)
        let out <- result.remove(key: "output")!
        let fee: @{FungibleToken.Vault} <- result.remove(key: "fee")!
        destroy result
        
        // Store values before moving
        let outTypeStr: String = out.getType().identifier
        let outAmount: UFix64 = out.balance
        let outUUID: UInt64 = out.uuid
        
        emit Swapped(
          inVault: inTypeStr,
          outVault: outTypeStr,
          inAmount: inAmt,
          outAmount: outAmount,
          inUUID: inUUID,
          outUUID: outUUID,
          uniqueID: self.uniqueID?.id ?? nil,
          swapperType: self.getType().identifier
        )
        if quote != nil && outAmount < quote!.outAmount { panic("slippage: out < quoted") }
        return <- {
          "output": <-out,
          "fee": <-fee
        }
      }
    }

    // Swap back from outType to inType (enforces slippage if quote provided)
    access(all) fun swapBack(quote: {DeFiActions.Quote}?, residual: @{FungibleToken.Vault}): @{FungibleToken.Vault} {
      if residual.getType() != self.outType() { panic("invalid residual vault type") }
      let p = self.poolCap.borrow() ?? panic("invalid pool capability")
      let inTypeStr: String = residual.getType().identifier
      let inAmt: UFix64 = residual.balance
      let inUUID: UInt64 = residual.uuid
      if self.direction == ConstantProductAMMSwapper.Direction.ShareToFlow {
        // reverse: flow -> share
        let casted: @FlowToken.Vault <- (residual as! @FlowToken.Vault)
        let minOut: UFix64 = quote != nil ? quote!.outAmount : 0.0
        let result: @{String: {FungibleToken.Vault}} <- p.swapFlowForShare(input: <-casted, minOut: minOut, trader: self.trader)
        let out <- result.remove(key: "output")!
        let fee: @{FungibleToken.Vault} <- result.remove(key: "fee")!
        destroy result
        destroy fee
        emit Swapped(
          inVault: inTypeStr,
          outVault: out.getType().identifier,
          inAmount: inAmt,
          outAmount: out.balance,
          inUUID: inUUID,
          outUUID: out.uuid,
          uniqueID: self.uniqueID?.id ?? nil,
          swapperType: self.getType().identifier
        )
        if quote != nil && out.balance < quote!.outAmount { panic("slippage: out < quoted") }
        return <-out
      } else {
        // reverse: share -> flow
        let minOut2: UFix64 = quote != nil ? quote!.outAmount : 0.0
        let result: @{String: {FungibleToken.Vault}} <- p.swapShareForFlow(input: <-residual, minOut: minOut2, trader: self.trader)
        let out: @FlowToken.Vault <- result.remove(key: "output")! as! @FlowToken.Vault
        let fee: @{FungibleToken.Vault} <- result.remove(key: "fee")!
        destroy result
        destroy fee
        emit Swapped(
          inVault: inTypeStr,
          outVault: out.getType().identifier,
          inAmount: inAmt,
          outAmount: out.balance,
          inUUID: inUUID,
          outUUID: out.uuid,
          uniqueID: self.uniqueID?.id ?? nil,
          swapperType: self.getType().identifier
        )
        if quote != nil && out.balance < quote!.outAmount { panic("slippage: out < quoted") }
        return <-out
      }
    }

    // Minimal IdentifiableStruct impl requirement
    access(all) fun getComponentInfo(): DeFiActions.ComponentInfo {
      return DeFiActions.ComponentInfo(
        type: self.getType(),
        id: self.id(),
        innerComponents: []
      )
    }

    // IdentifiableStruct conformance helpers
    access(contract) view fun copyID(): DeFiActions.UniqueIdentifier? {
      return self.uniqueID
    }

    access(contract) fun setID(_ id: DeFiActions.UniqueIdentifier?) {
      self.uniqueID = id
    }
  }

  // Factory helpers
  access(all) fun makeShareToFlowSwapper(poolCap: Capability<&ConstantProductAMM.Pool>, trader: Address, id: DeFiActions.UniqueIdentifier?): {DeFiActions.Swapper} {
    return AMMSwapper(poolCap: poolCap, direction: ConstantProductAMMSwapper.Direction.ShareToFlow, trader: trader, id: id)
  }

  access(all) fun makeFlowToShareSwapper(poolCap: Capability<&ConstantProductAMM.Pool>, trader: Address, id: DeFiActions.UniqueIdentifier?): {DeFiActions.Swapper} {
    return AMMSwapper(poolCap: poolCap, direction: ConstantProductAMMSwapper.Direction.FlowToShare, trader: trader, id: id)
  }
  
  init() {
    self.DIR_SHARE_TO_FLOW = 0
    self.DIR_FLOW_TO_SHARE = 1
  }
}


