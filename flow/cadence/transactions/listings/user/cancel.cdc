import "FungibleToken"
import "FungibleTokenConnectors"
import "Fractional"

transaction(
  symbol: String,
  vaultId: String,
  listingId: String,
  seller: Address,
  shareAmount: UFix64
) {
  prepare(
    sellerAcct: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account,
    admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account
  ) {
    let storagePath: StoragePath = StoragePath(identifier: "vault_".concat(symbol))!
    let receiverPath: PublicPath = PublicPath(identifier: "receiver_".concat(symbol))!
    if !sellerAcct.capabilities.exists(receiverPath) {
      panic("Setup Shares required: missing Receiver for seller")
    }
    
    let adminWithdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> = admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(storagePath)

    let source: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: nil, withdrawVault: adminWithdrawCap, uniqueID: nil)
    let sellerRecv: Capability<&{FungibleToken.Vault}> = sellerAcct.capabilities.storage.issue<&{FungibleToken.Vault}>(storagePath)
    let sink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: sellerRecv, uniqueID: nil)
    let shares: @{FungibleToken.Vault} <- source.withdrawAvailable(maxAmount: shareAmount)
    if shares.balance > 0.0 {
      sink.depositCapacity(from: &shares as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
    }
    destroy shares
    let adminRef = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing Fractional.Admin")
    adminRef.cancelListing(vaultId: vaultId, listingId: listingId)
  }
}


