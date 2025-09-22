import "FlowToken"

access(all) fun main(admin: Address): UFix64 {
  let cap: Capability<&FlowToken.Vault> = getAccount(admin).capabilities.get<&FlowToken.Vault>(/public/PlatformTreasury_FLOW)
  if let vault: &FlowToken.Vault = cap.borrow() {
    return vault.balance
  }
  return 0.0
}


