import "FungibleToken"
import "Fractional"
import "VaultShareToken"

/// Mint shares to vault treasury instead of a recipient
transaction(vaultId: String, amount: UFix64) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    // Get vault FT metadata
    let ftMeta: {String: String}? = Fractional.getVaultFT(vaultId: vaultId)
    if ftMeta == nil { panic("vault FT not registered") }
    
    let ftContractName: String = ftMeta!["name"]!
    
    // Vault treasury path: VaultTreasury_<CONTRACT_NAME>_<vaultId>
    let vaultTreasuryIdent: String = "VaultTreasury_".concat(ftContractName).concat("_").concat(vaultId)
    let vaultTreasuryPublic: PublicPath = PublicPath(identifier: vaultTreasuryIdent)!
    
    // Get Admin from vault FT contract
    let adminRef = VaultShareToken.borrowAdmin() ?? panic("missing VaultShareToken.Admin")
    
    // Get vault treasury receiver capability
    let treasuryRecv: Capability<&{FungibleToken.Vault}>? = signer.capabilities.get<&{FungibleToken.Vault}>(vaultTreasuryPublic)
    if treasuryRecv == nil {
      panic("vault treasury not published - ensure treasury is set up first")
    }
    
    // Mint to vault treasury
    adminRef.mint(to: treasuryRecv!.borrow() ?? panic("treasury receiver missing"), amount: amount)
  }
}

