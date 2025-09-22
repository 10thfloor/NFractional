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
    admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account
  ) {
    let storagePath: StoragePath = StoragePath(identifier: "vault_".concat(symbol))!
    let receiverPath: PublicPath = PublicPath(identifier: "receiver_".concat(symbol))!
    let adminWithdrawCap = admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(storagePath)
    let shares <- FungibleTokenConnectors.VaultSource(min: shareAmount, withdrawVault: adminWithdrawCap, uniqueID: nil)
      .withdrawAvailable(maxAmount: shareAmount)
    let recv = getAccount(seller).capabilities.get<&{FungibleToken.Receiver}>(receiverPath).borrow()
      ?? panic("seller receiver missing")
    recv.deposit(from: <-shares)
    let adminRef = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing Fractional.Admin")
    adminRef.expireListing(vaultId: vaultId, listingId: listingId)
  }
}


