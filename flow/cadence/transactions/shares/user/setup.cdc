import "FungibleToken"
import "VaultShareToken"

// Idempotent holder setup for VaultShareToken
// - Creates empty Vault at contract-defined storage path if missing
// - Publishes receiver and metadata caps at contract-defined public paths
transaction() {
    prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
        let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()
        let receiverPath: PublicPath = VaultShareToken.getReceiverPublicPath()
        let metadataPath: PublicPath = VaultShareToken.getBalancePublicPath()

        if signer.storage.borrow<&VaultShareToken.Vault>(from: storagePath) == nil {
            let vault <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
            signer.storage.save(<-vault, to: storagePath)
        }

        // Receiver: &{FungibleToken.Receiver}
        signer.capabilities.unpublish(receiverPath)
        signer.capabilities.publish(
            signer.capabilities.storage.issue<&{FungibleToken.Receiver}>(storagePath),
            at: receiverPath
        )

        // Metadata/balance: &VaultShareToken.Vault (resolver + balance)
        signer.capabilities.unpublish(metadataPath)
        signer.capabilities.publish(
            signer.capabilities.storage.issue<&VaultShareToken.Vault>(storagePath),
            at: metadataPath
        )
    }
}


