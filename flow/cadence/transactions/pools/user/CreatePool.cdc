import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"

// Creates a pool for a given vaultId/symbol and feeBps.
// Derives the concrete share vault type from the signer's existing share vault.
transaction(vaultId: String, symbol: String, feeBps: UInt64) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    let factoryRef: &ConstantProductAMM.Factory = ConstantProductAMM.borrowFactory()
      ?? panic("AMM factory not found; deploy ConstantProductAMM and save factory at /storage/AMMFactoryV1")

    // Derive the concrete vault type for this vault's share FT by borrowing from storage
    let shareRef: &{FungibleToken.Vault} = signer.storage.borrow<&{FungibleToken.Vault}>(from: VaultShareToken.getVaultStoragePath())
      ?? panic("share vault not found; ensure your receiver/vault is set up for the share token")
    let empty: @{FungibleToken.Vault} <- shareRef.createEmptyVault()
    let shareType: Type = empty.getType()
    destroy empty

    let _poolRef: &ConstantProductAMM.Pool = factoryRef.createPool(
      account: signer,
      vaultId: vaultId,
      symbol: symbol,
      feeBps: feeBps,
      shareVaultType: shareType
    )
  }
}


