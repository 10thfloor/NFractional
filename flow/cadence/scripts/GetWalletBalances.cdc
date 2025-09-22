import "FungibleToken"
import "ConstantProductAMM"

// Read wallet balances for FLOW, a vault's share token (by symbol), and LP for an optional poolId.
// - account: Address to inspect
// - vaultSymbol: Share token symbol used to derive the balance public path ("balance_" + symbol)
// - poolId: Optional pool identifier to read LP held in storage at /storage/AMM_LP_<poolId>
// Returns a string map with keys: "flow", "share", "lp"
access(all) view fun main(account: Address, vaultSymbol: String, poolId: String?): {String: String} {
  let out: {String: String} = {}

  // FLOW balance via standard public balance capability
  var flowBal: UFix64 = 0.0
  if let f = getAccount(account).capabilities.borrow<&{FungibleToken.Balance}>(/public/flowTokenBalance) {
    flowBal = f.balance
  }
  out["flow"] = flowBal.toString()

  // Share balance via derived public balance path: "balance_" + symbol
  var shareBal: UFix64 = 0.0
  let sharePath: PublicPath = PublicPath(identifier: "balance_".concat(vaultSymbol))!
  if let s = getAccount(account).capabilities.borrow<&{FungibleToken.Balance}>(sharePath) {
    shareBal = s.balance
  }
  out["share"] = shareBal.toString()

  // LP balance is stored in user storage as ConstantProductAMM.LPVault at /storage/AMM_LP_<poolId>
  var lpBal: UFix64 = 0.0
  if let pid = poolId {
    let lpPubPath: PublicPath = PublicPath(identifier: "AMM_LP_".concat(pid))!
    let lpCap: Capability<&ConstantProductAMM.LPVault> = getAccount(account).capabilities.get<&ConstantProductAMM.LPVault>(lpPubPath)
    if let l = lpCap.borrow() {
      lpBal = l.getBalance()
    }
  }
  out["lp"] = lpBal.toString()

  return out
}


