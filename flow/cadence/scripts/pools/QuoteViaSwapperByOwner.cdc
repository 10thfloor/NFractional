import "ConstantProductAMM"
import "ConstantProductAMMSwapper"
import "DeFiActions"

/// Read-only quote via ConstantProductAMMSwapper (DeFiActions-compatible).
/// direction: "share_to_flow" | "flow_to_share"
access(all) view fun main(
  owner: Address,
  poolId: String,
  direction: String,
  amountIn: UFix64,
  trader: Address
): {String: UFix64} {
  let pubPath: PublicPath = ConstantProductAMM.getPoolPublicPath(poolId: poolId)
  let cap: Capability<&ConstantProductAMM.Pool> = getAccount(owner).capabilities.get<&ConstantProductAMM.Pool>(pubPath)
  let p: &ConstantProductAMM.Pool = cap.borrow() ?? panic("invalid pool capability")

  var dir: ConstantProductAMMSwapper.Direction = ConstantProductAMMSwapper.Direction.ShareToFlow
  if direction == "share_to_flow" {
    dir = ConstantProductAMMSwapper.Direction.ShareToFlow
  } else if direction == "flow_to_share" {
    dir = ConstantProductAMMSwapper.Direction.FlowToShare
  } else {
    panic("invalid direction tag")
  }

  // Build swapper and quote output for provided input using the same path as the tx
  var swapperOpt: {DeFiActions.Swapper}? = nil
  if dir == ConstantProductAMMSwapper.Direction.ShareToFlow {
    swapperOpt = ConstantProductAMMSwapper.makeShareToFlowSwapper(poolCap: cap, trader: trader, id: nil)
  } else {
    swapperOpt = ConstantProductAMMSwapper.makeFlowToShareSwapper(poolCap: cap, trader: trader, id: nil)
  }
  let swapper: {DeFiActions.Swapper} = swapperOpt!

  let concrete: ConstantProductAMMSwapper.AMMSwapper = swapper as! ConstantProductAMMSwapper.AMMSwapper
  let qGeneric: {DeFiActions.Quote} = concrete.quoteOut(forProvided: amountIn, reverse: false)
  let q: ConstantProductAMMSwapper.AMMQuote = qGeneric as! ConstantProductAMMSwapper.AMMQuote

  return {"in": q.inAmount, "out": q.outAmount}
}


