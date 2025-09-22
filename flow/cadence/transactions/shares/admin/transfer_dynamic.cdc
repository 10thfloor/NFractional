import "FungibleToken"
import "VaultShareToken"

// Admin-only transfer of shares from admin escrow to a recipient
// This transaction is aliased at runtime so that VaultShareToken resolves
// to the concrete per-vault FT contract.
transaction(
  recipient: Address,
  amount: UFix64,
  vaultStoragePathIdentifier: String,
  receiverPublicPathIdentifier: String
) {
  prepare(admin: auth(BorrowValue, Storage) &Account) {
    let storagePath: StoragePath = StoragePath(identifier: vaultStoragePathIdentifier)!
    let withdrawRef: auth(FungibleToken.Withdraw) &VaultShareToken.Vault = admin.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: storagePath)
      ?? panic("admin share vault missing")

    let receiverPath: PublicPath = PublicPath(identifier: receiverPublicPathIdentifier)!
    let cap: Capability<&{FungibleToken.Receiver}> = getAccount(recipient)
      .capabilities.get<&{FungibleToken.Receiver}>(receiverPath)
    if !cap.check() { panic("recipient receiver cap missing") }
    let receiver: &{FungibleToken.Receiver} = cap.borrow()
      ?? panic("recipient receiver borrow failed")

    let payment: @{FungibleToken.Vault} <- withdrawRef.withdraw(amount: amount)
    receiver.deposit(from: <-payment)
  }
}


