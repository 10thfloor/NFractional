import "ConstantProductAMM"

/// Lists poolIds for AMM pools published under a specific account's public storage,
/// optionally filtered by `vaultId` (pass empty string to return all).
access(all) fun main(account: Address, vaultId: String): [String] {
  let acct: &Account = getAccount(account)
  var ids: [String] = []
  acct.storage.forEachPublic(fun (path: PublicPath, _t: Type): Bool {
    let cap: Capability<&ConstantProductAMM.Pool> = acct.capabilities.get<&ConstantProductAMM.Pool>(path)
    if let p: &ConstantProductAMM.Pool = cap.borrow() {
      if vaultId == "" || p.vaultId == vaultId {
        ids.append(p.poolId)
      }
    }
    return true
  })
  return ids
}


