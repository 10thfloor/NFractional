import "FungibleToken"
import "VaultShareToken"

// Setup per‑vault FT vault and public caps
transaction() {
  prepare(acct: auth(Storage, BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability) &Account) {
    let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()
    let receiverPath: PublicPath = VaultShareToken.getReceiverPublicPath()
    let balancePath: PublicPath = VaultShareToken.getBalancePublicPath()

    if acct.storage.borrow<&VaultShareToken.Vault>(from: storagePath) == nil {
      let any: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let v: @VaultShareToken.Vault <- any as! @VaultShareToken.Vault
      acct.storage.save(<-v, to: storagePath)
    }

    let _r: Capability? = acct.capabilities.unpublish(receiverPath)
    acct.capabilities.publish(
      acct.capabilities.storage.issue<&{FungibleToken.Receiver}>(storagePath),
      at: receiverPath
    )

    let _b: Capability? = acct.capabilities.unpublish(balancePath)
    acct.capabilities.publish(
      acct.capabilities.storage.issue<&VaultShareToken.Vault>(storagePath),
      at: balancePath
    )
  }
}


