import "FungibleToken"
import "FlowToken"
import "ConstantProductAMM"
import "ConstantProductAMMSwapper"
import "Fractional"

// Read-only quote via adapter by owner + poolId; direction: 0=ShareToFlow, 1=FlowToShare
access(all) fun main(owner: Address, poolId: String, direction: UInt8, amountIn: UFix64): {String: UFix64} {
  let pubPath: PublicPath = ConstantProductAMM.getPoolPublicPath(poolId: poolId)
  let cap: Capability<&ConstantProductAMM.Pool> = getAccount(owner).capabilities.get<&ConstantProductAMM.Pool>(pubPath)
  let p: &ConstantProductAMM.Pool = cap.borrow() ?? panic("invalid pool capability")
  // Adjust input by platform AMM fee to reflect on-chain swap math
  let feeParams: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: p.vaultId)
  let ammFeeBps: UInt64 = feeParams["ammFeeBps"]!
  let platformFee: UFix64 = (amountIn * UFix64(ammFeeBps)) / 10000.0
  let effectiveIn: UFix64 = amountIn - platformFee

  if direction == 0 { // ShareToFlow
    let out: UFix64 = p.quoteOutShareToFlow(amountIn: effectiveIn)
    return {"in": amountIn, "out": out}
  } else if direction == 1 { // FlowToShare
    let out: UFix64 = p.quoteOutFlowToShare(amountIn: effectiveIn)
    return {"in": amountIn, "out": out}
  }
  panic("invalid direction")
}


