import "VaultShareToken"

transaction() {
  prepare(admin: auth(Storage, BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability) &Account) {
    let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()
    if admin.storage.borrow<&VaultShareToken.Vault>(from: storagePath) == nil {
      let any <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let v: @VaultShareToken.Vault <- any as! @VaultShareToken.Vault
      admin.storage.save(<-v, to: storagePath)
    }
  }
}


