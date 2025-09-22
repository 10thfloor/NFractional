import "FungibleToken"
import "FlowToken"
import "VaultShareToken"

/// Ensures admin treasuries exist and are published for a given token ident and optional vault.
/// - tokenIdent: e.g., "FLOW" or the per‑vault FT contract name aliased as VaultShareToken
/// - vaultId: optional; when provided, ensures per‑vault treasury as well
transaction(tokenIdent: String, vaultId: String?) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    // Platform treasury: /storage|/public/PlatformTreasury_<TOKEN>
    let platStorage: StoragePath = StoragePath(identifier: "PlatformTreasury_".concat(tokenIdent))!
    let platPublic: PublicPath = PublicPath(identifier: "PlatformTreasury_".concat(tokenIdent))!

    if tokenIdent == "FLOW" {
      if admin.storage.borrow<&FlowToken.Vault>(from: platStorage) == nil {
        let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
        admin.storage.save(<-v, to: platStorage)
      }
      let _ = admin.capabilities.unpublish(platPublic)
      admin.capabilities.publish(admin.capabilities.storage.issue<&FlowToken.Vault>(platStorage), at: platPublic)
    } else {
      if admin.storage.borrow<&{FungibleToken.Vault}>(from: platStorage) == nil {
        let vAny: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>()) as @{FungibleToken.Vault}
        admin.storage.save(<-vAny, to: platStorage)
      }
      let _ = admin.capabilities.unpublish(platPublic)
      admin.capabilities.publish(admin.capabilities.storage.issue<&{FungibleToken.Vault}>(platStorage), at: platPublic)
    }

    // Optional per‑vault treasury: /storage|/public/VaultTreasury_<TOKEN>_<vaultId>
    if vaultId != nil {
      let vtIdent = "VaultTreasury_".concat(tokenIdent).concat("_").concat(vaultId!)
      let vtStorage: StoragePath = StoragePath(identifier: vtIdent)!
      let vtPublic: PublicPath = PublicPath(identifier: vtIdent)!

      if tokenIdent == "FLOW" {
        if admin.storage.borrow<&FlowToken.Vault>(from: vtStorage) == nil {
          let v2: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
          admin.storage.save(<-v2, to: vtStorage)
        }
        let __ = admin.capabilities.unpublish(vtPublic)
        admin.capabilities.publish(admin.capabilities.storage.issue<&FlowToken.Vault>(vtStorage), at: vtPublic)
      } else {
        if admin.storage.borrow<&{FungibleToken.Vault}>(from: vtStorage) == nil {
          let v2Any: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>()) as @{FungibleToken.Vault}
          admin.storage.save(<-v2Any, to: vtStorage)
        }
        let __ = admin.capabilities.unpublish(vtPublic)
        admin.capabilities.publish(admin.capabilities.storage.issue<&{FungibleToken.Vault}>(vtStorage), at: vtPublic)
      }
    }
  }
}


