import "FungibleToken"
import "FlowToken"

// Ensure admin/vault FLOW treasuries exist and publish receiver/balance caps.
// Idempotent: safe to run many times.
//
// If a vaultId is provided, also ensure a per‑vault FLOW escrow under derived paths.
transaction(vaultStorageSuffix: String?) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    // Platform-level FLOW vault
    if admin.storage.borrow<&FlowToken.Vault>(from: /storage/PlatformTreasury_FLOW) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      admin.storage.save(<-v, to: /storage/PlatformTreasury_FLOW)
    }

    let _: Capability? = admin.capabilities.unpublish(/public/PlatformTreasury_FLOW)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&FlowToken.Vault>(/storage/PlatformTreasury_FLOW),
      at: /public/PlatformTreasury_FLOW
    )

    // Optional per‑vault FLOW escrow
    if vaultStorageSuffix != nil {
      let ident = "VaultTreasury_FLOW_".concat(vaultStorageSuffix!)
      let storagePath = StoragePath(identifier: ident)!
      let publicPath = PublicPath(identifier: ident)!

      if admin.storage.borrow<&FlowToken.Vault>(from: storagePath) == nil {
        let v2: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
        admin.storage.save(<-v2, to: storagePath)
      }
      let _pv: Capability? = admin.capabilities.unpublish(publicPath)
      admin.capabilities.publish(
        admin.capabilities.storage.issue<&FlowToken.Vault>(storagePath),
        at: publicPath
      )
    }
  }
}


