import "ConstantProductAMM"

access(all) struct PoolInfo {
  access(all) let poolId: String
  access(all) let vaultId: String
  access(all) let symbol: String
  access(all) let feeBps: UInt64
  access(all) let reserveShare: UFix64
  access(all) let reserveFlow: UFix64

  init(poolId: String, vaultId: String, symbol: String, feeBps: UInt64, reserveShare: UFix64, reserveFlow: UFix64) {
    self.poolId = poolId
    self.vaultId = vaultId
    self.symbol = symbol
    self.feeBps = feeBps
    self.reserveShare = reserveShare
    self.reserveFlow = reserveFlow
  }
}

/// Lists detailed info for AMM pools published under a specific account's public storage,
/// optionally filtered by `vaultId` (pass empty string to return all).
access(all) fun main(account: Address, vaultId: String): [PoolInfo] {
  let acct: &Account = getAccount(account)
  var out: [PoolInfo] = []
  acct.storage.forEachPublic(fun (path: PublicPath, _t: Type): Bool {
    let cap: Capability<&ConstantProductAMM.Pool> = acct.capabilities.get<&ConstantProductAMM.Pool>(path)
    if let p: &ConstantProductAMM.Pool = cap.borrow() {
      if vaultId == "" || p.vaultId == vaultId {
        let r = p.reserves()
        let rs: UFix64 = r["share"] ?? 0.0
        let rf: UFix64 = r["flow"] ?? 0.0
        out.append(PoolInfo(
          poolId: p.poolId,
          vaultId: p.vaultId,
          symbol: p.symbol,
          feeBps: p.feeBps,
          reserveShare: rs,
          reserveFlow: rf
        ))
      }
    }
    return true
  })
  return out
}


