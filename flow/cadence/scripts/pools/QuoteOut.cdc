import "ConstantProductAMM"

/// Returns the quoted output amount given an input amount and direction.
/// direction: "SHARE_TO_FLOW" or "FLOW_TO_SHARE"
///
access(all) fun main(pool: Capability<&ConstantProductAMM.Pool>, direction: String, amountIn: UFix64): UFix64 {
  let p: &ConstantProductAMM.Pool = pool.borrow() ?? panic("invalid pool capability")
  if direction == "SHARE_TO_FLOW" {
    return p.quoteOutShareToFlow(amountIn: amountIn)
  }
  if direction == "FLOW_TO_SHARE" {
    return p.quoteOutFlowToShare(amountIn: amountIn)
  }
  panic("invalid direction")
}


