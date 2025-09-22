import "Fractional"
import "FungibleToken"

/// Read vault treasury share balance from the admin account
/// Path: VaultTreasury_<CONTRACT_NAME>_<vaultId>
/// Uses the public path if a Vault capability is published, otherwise returns 0.0
access(all) fun main(admin: Address, vaultId: String): UFix64 {
  // Get vault FT metadata to construct the treasury path
  let ftMeta: {String: String}? = Fractional.getVaultFT(vaultId: vaultId)
  if ftMeta == nil { return 0.0 }
  
  let ftContractName: String = ftMeta!["name"]!
  
  // Construct vault treasury public path: VaultTreasury_<CONTRACT_NAME>_<vaultId>
  let vaultTreasuryIdent: String = "VaultTreasury_".concat(ftContractName).concat("_").concat(vaultId)
  let pubPath: PublicPath = PublicPath(identifier: vaultTreasuryIdent)!
  
  // Try to borrow Vault capability from the public path (Vault implements Balance)
  let cap: Capability<&{FungibleToken.Vault}>? = 
    getAccount(admin).capabilities.get<&{FungibleToken.Vault}>(pubPath)
  
  if let cap = cap {
    if let vaultRef: &{FungibleToken.Vault} = cap.borrow() {
      return vaultRef.balance
    }
  }
  
  return 0.0
}

