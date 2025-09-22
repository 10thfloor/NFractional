import "FungibleToken"
import "VaultShareToken"

// Ensure admin escrow vault exists and publish receiver/balance caps using per‑vault FT
transaction(storageIdent: String, receiverIdent: String, balanceIdent: String) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    let storagePath: StoragePath = StoragePath(identifier: storageIdent)!
    let receiverPath: PublicPath = PublicPath(identifier: receiverIdent)!
    let balancePath: PublicPath = PublicPath(identifier: balanceIdent)!

    if admin.storage.borrow<&VaultShareToken.Vault>(from: storagePath) == nil {
      let empty: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let escrow: @VaultShareToken.Vault <- empty as! @VaultShareToken.Vault
      admin.storage.save(<-escrow, to: storagePath)
    }

    let _r: Capability? = admin.capabilities.unpublish(receiverPath)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&{FungibleToken.Receiver}>(storagePath),
      at: receiverPath
    )

    let _b: Capability? = admin.capabilities.unpublish(balancePath)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&VaultShareToken.Vault>(storagePath),
      at: balancePath
    )
  }
}


