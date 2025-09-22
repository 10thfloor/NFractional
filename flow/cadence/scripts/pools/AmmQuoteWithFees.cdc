import "FungibleToken"
import "FlowToken"
import "ConstantProductAMM"
import "ConstantProductAMMSwapper"
import "Fractional"

/// Read-only AMM quote with platform fee and split breakdown.
/// direction: "share_to_flow" | "flow_to_share"
access(all) view fun main(
  owner: Address,
  poolId: String,
  direction: String,
  amountIn: UFix64,
  vaultId: String
): {String: UFix64} {
  let pubPath: PublicPath = ConstantProductAMM.getPoolPublicPath(poolId: poolId)
  let cap: Capability<&ConstantProductAMM.Pool> = getAccount(owner).capabilities.get<&ConstantProductAMM.Pool>(pubPath)
  let p: &ConstantProductAMM.Pool = cap.borrow() ?? panic("invalid pool capability")

  // Platform AMM fee params (bps) and splits (bps)
  let feeParams: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: p.vaultId)
  let ammFeeBps: UInt64 = feeParams["ammFeeBps"] ?? 0
  let vaultSplitBps: UInt64 = feeParams["ammFeeSplitVaultBps"] ?? 0

  // Compute taker fee on input and effective amount for quoting
  let feeAmount: UFix64 = (amountIn * UFix64(ammFeeBps)) / 10000.0
  let effectiveIn: UFix64 = amountIn > feeAmount ? (amountIn - feeAmount) : 0.0

  var out: UFix64 = 0.0
  if direction == "share_to_flow" {
    out = p.quoteOutShareToFlow(amountIn: effectiveIn)
  } else if direction == "flow_to_share" {
    out = p.quoteOutFlowToShare(amountIn: effectiveIn)
  } else {
    panic("invalid direction tag")
  }

  // Split breakdown
  let vaultShare: UFix64 = (feeAmount * UFix64(vaultSplitBps)) / 10000.0
  let protocolShare: UFix64 = feeAmount > vaultShare ? (feeAmount - vaultShare) : 0.0

  return {
    "in": amountIn,
    "out": out,
    "feeAmount": feeAmount,
    "feeBps": UFix64(ammFeeBps),
    "vaultShare": vaultShare,
    "protocolShare": protocolShare
  }
}


