import "FungibleToken"
import "VaultShareToken"

// Sets up share vault and public capabilities using the token's configured paths.
transaction {
  prepare(acct: auth(Storage, BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability) &Account) {
    let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()
    let receiverPath: PublicPath = VaultShareToken.getReceiverPublicPath()
    let balancePath: PublicPath = VaultShareToken.getBalancePublicPath()

    if acct.storage.borrow<&VaultShareToken.Vault>(from: storagePath) == nil {
      let any: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let v: @VaultShareToken.Vault <- any as! @VaultShareToken.Vault
      acct.storage.save(<-v, to: storagePath)
    }
    if !acct.capabilities.exists(receiverPath) {
      acct.capabilities.unpublish(receiverPath)
      acct.capabilities.publish(
        acct.capabilities.storage.issue<&{FungibleToken.Receiver}>(storagePath),
        at: receiverPath
      )
    }
    if !acct.capabilities.exists(balancePath) {
      acct.capabilities.unpublish(balancePath)
      acct.capabilities.publish(
        acct.capabilities.storage.issue<&VaultShareToken.Vault>(storagePath),
        at: balancePath
      )
    }
  }
}