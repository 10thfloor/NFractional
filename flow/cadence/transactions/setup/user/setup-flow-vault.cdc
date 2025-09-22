import "FungibleToken"
import "FlowToken"

// Sets up a FlowToken Vault for the signer if missing and publishes Receiver/Balance capabilities
transaction {
    prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
        if signer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault) == nil {
            let vault: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
            signer.storage.save(<-vault, to: /storage/flowTokenVault)

            let _unused1 = signer.capabilities.unpublish(/public/flowTokenReceiver)
            signer.capabilities.publish(
                signer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
                at: /public/flowTokenReceiver
            )

            let _unused2 = signer.capabilities.unpublish(/public/flowTokenBalance)
            signer.capabilities.publish(
                signer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
                at: /public/flowTokenBalance
            )
        }
    }
}


