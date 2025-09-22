import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"
import "ConstantProductAMMSwapper"

// Read-only quote via adapter; accept UInt8 for direction to match API calls (0=ShareToFlow, 1=FlowToShare)
access(all) fun main(pool: Capability<&ConstantProductAMM.Pool>, direction: UInt8, amountIn: UFix64): {String: UFix64} {
  let p: &ConstantProductAMM.Pool = pool.borrow() ?? panic("invalid pool capability")
  if direction == UInt8(0) { // ShareToFlow
    let out: UFix64 = p.quoteOutShareToFlow(amountIn: amountIn)
    return { "in": amountIn, "out": out }
  } else if direction == UInt8(1) { // FlowToShare
    let out: UFix64 = p.quoteOutFlowToShare(amountIn: amountIn)
    return { "in": amountIn, "out": out }
  }
  panic("invalid direction")
}


