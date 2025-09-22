import "FlowToken"

transaction(vaultId: String) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    if admin.storage.borrow<&FlowToken.Vault>(from: /storage/PlatformTreasury_FLOW) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      admin.storage.save(<-v, to: /storage/PlatformTreasury_FLOW)
    }
    let _ = admin.capabilities.unpublish(/public/PlatformTreasury_FLOW)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&FlowToken.Vault>(/storage/PlatformTreasury_FLOW),
      at: /public/PlatformTreasury_FLOW
    )

    let vtIdent = "VaultTreasury_FLOW_".concat(vaultId)
    let vtStorage = StoragePath(identifier: vtIdent)!
    let vtPublic = PublicPath(identifier: vtIdent)!
    if admin.storage.borrow<&FlowToken.Vault>(from: vtStorage) == nil {
      let v2: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      admin.storage.save(<-v2, to: vtStorage)
    }
    let __ = admin.capabilities.unpublish(vtPublic)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&FlowToken.Vault>(vtStorage),
      at: vtPublic
    )
  }
}


