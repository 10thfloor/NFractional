import "FungibleToken"
import "VaultShareToken"

// Ensure admin/share treasuries exist for the per‑vault FT (aliased as VaultShareToken).
// Idempotent: safe to run many times. Optionally ensures a per‑vault public escrow for the given vaultId.
//
// Notes:
// - This transaction assumes the import of VaultShareToken has been aliased to the concrete per‑vault FT
//   via: import <ContractName> as VaultShareToken from 0x<address>
// - If your per‑vault FT exposes standard helper paths (getVaultStoragePath, getReceiverPublicPath,
//   getBalancePublicPath), this will set up the vault and publish receiver/balance caps.
// - If your admin uses custom storage/public paths for escrow, those can be introduced here as needed.
transaction(tokenIdent: String, vaultStorageSuffix: String?) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()
    let receiverPath: PublicPath = VaultShareToken.getReceiverPublicPath()
    let balancePath: PublicPath = VaultShareToken.getBalancePublicPath()

    if admin.storage.borrow<&VaultShareToken.Vault>(from: storagePath) == nil {
      let any: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let v: @VaultShareToken.Vault <- any as! @VaultShareToken.Vault
      admin.storage.save(<-v, to: storagePath)
    }

    // Publish receiver and balance caps idempotently
    let _ = admin.capabilities.unpublish(receiverPath)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&{FungibleToken.Receiver}>(storagePath),
      at: receiverPath
    )

    let _b = admin.capabilities.unpublish(balancePath)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&{FungibleToken.Balance}>(storagePath),
      at: balancePath
    )

    // Platform-level per-token treasury under /storage|/public/PlatformTreasury_<TOKEN>
    let platStorageIdent = "PlatformTreasury_".concat(tokenIdent)
    let platStorage: StoragePath = StoragePath(identifier: platStorageIdent)!
    let platPublic: PublicPath = PublicPath(identifier: platStorageIdent)!

    if admin.storage.borrow<&VaultShareToken.Vault>(from: platStorage) == nil {
      let any2: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let v2: @VaultShareToken.Vault <- any2 as! @VaultShareToken.Vault
      admin.storage.save(<-v2, to: platStorage)
    }
    let _plat = admin.capabilities.unpublish(platPublic)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&{FungibleToken.Vault}>(platStorage),
      at: platPublic
    )

    // Per‑vault share treasury under /storage|/public/VaultTreasury_<TOKEN>_<VAULTID>
    if vaultStorageSuffix != nil {
      let vtIdent: String = "VaultTreasury_".concat(tokenIdent).concat("_").concat(vaultStorageSuffix!)
      let vtStorage: StoragePath = StoragePath(identifier: vtIdent)!
      let vtPublic: PublicPath = PublicPath(identifier: vtIdent)!

      if admin.storage.borrow<&VaultShareToken.Vault>(from: vtStorage) == nil {
        let any3: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
        let v3: @VaultShareToken.Vault <- any3 as! @VaultShareToken.Vault
        admin.storage.save(<-v3, to: vtStorage)
      }
      let _vt = admin.capabilities.unpublish(vtPublic)
      admin.capabilities.publish(
        admin.capabilities.storage.issue<&{FungibleToken.Vault}>(vtStorage),
        at: vtPublic
      )
    }
  }
}


