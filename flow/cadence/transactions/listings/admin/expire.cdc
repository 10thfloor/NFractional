import "FungibleToken"
import "FungibleTokenConnectors"
import "VaultShareToken"
import "Fractional"

// Admin expires a listing. Shares are returned from admin escrow to seller via Actions,
// then admin marks the listing expired.
transaction(
    vaultId: String,
    listingId: String,
    seller: Address,
    shareAmount: UFix64
) {
    prepare(
        admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account
    ) {
        let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()

        // Source: admin escrow → withdraw shares
        let adminWithdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> = admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(storagePath)
        let source: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: shareAmount, withdrawVault: adminWithdrawCap, uniqueID: nil)

        // Sink: seller receiver (must exist; require setup done)
        let sellerRecv: Capability<&{FungibleToken.Vault}> = getAccount(seller).capabilities.get<&{FungibleToken.Vault}>(VaultShareToken.getReceiverPublicPath())
        let sink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: sellerRecv, uniqueID: nil)

        let shares: @{FungibleToken.Vault} <- source.withdrawAvailable(maxAmount: shareAmount)
        sink.depositCapacity(from: &shares as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
        destroy shares

        // Mark expired
        let adminRef = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing Fractional.Admin")
        adminRef.expireListing(vaultId: vaultId, listingId: listingId)
    }
}


