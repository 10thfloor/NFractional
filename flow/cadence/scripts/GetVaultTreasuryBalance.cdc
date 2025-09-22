import "FlowToken"

access(all) fun main(admin: Address, vaultId: String): UFix64 {
  let pathId: String = "VaultTreasury_FLOW_".concat(vaultId)
  let pubPath: PublicPath = PublicPath(identifier: pathId)!
  let cap: Capability<&FlowToken.Vault> = getAccount(admin).capabilities.get<&FlowToken.Vault>(pubPath)
  if let vault: &FlowToken.Vault = cap.borrow() {
    return vault.balance
  }
  return 0.0
}


