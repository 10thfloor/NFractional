import "FungibleToken"
import "FungibleTokenConnectors"
import "Fractional"
import "VaultShareToken"

/// Dual-authorizer listing creation that escrows seller shares into admin escrow atomically.
transaction(
  symbol: String,
  vaultId: String,
  listingId: String,
  priceAsset: String,
  priceAmount: UFix64,
  shareAmount: UFix64,
  seller: Address
) {
  prepare(
    sellerAcct: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account,
    admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account
  ) {
    // Liveness guard: require LockBox custody is alive
    let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
    if !Fractional.isCustodyAlive(vaultId: vaultId, custodian: v.custodian) { panic("vault custody not alive") }

    let shareStorage: StoragePath = StoragePath(identifier: "vault_".concat(symbol))!
    let shareReceiver: PublicPath = PublicPath(identifier: "receiver_".concat(symbol))!

    if !sellerAcct.capabilities.exists(shareReceiver) {
      panic("Setup Shares required: missing Receiver for seller")
    }

    // Ensure admin escrow exists and receiver/balance caps published
    if admin.storage.borrow<&VaultShareToken.Vault>(from: shareStorage) == nil {
      let empty: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let escrow: @VaultShareToken.Vault <- empty as! @VaultShareToken.Vault
      admin.storage.save(<-escrow, to: shareStorage)
    }
    let _: Capability? = admin.capabilities.unpublish(shareReceiver)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&{FungibleToken.Receiver}>(shareStorage),
      at: shareReceiver
    )

    // Also publish balance capability so UIs can read escrowed balance
    let shareBalance: PublicPath = PublicPath(identifier: "balance_".concat(symbol))!
    let __: Capability? = admin.capabilities.unpublish(shareBalance)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&{FungibleToken.Balance}>(shareStorage),
      at: shareBalance
    )

    // Move seller shares -> admin escrow (direct withdraw/deposit)
    let sellerVaultRef: auth(FungibleToken.Withdraw) &VaultShareToken.Vault =
      sellerAcct.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: shareStorage)
      ?? panic("seller share vault missing")
    let adminEscrowRef: &VaultShareToken.Vault =
      admin.storage.borrow<&VaultShareToken.Vault>(from: shareStorage)
      ?? panic("admin escrow missing")
    let pulled: @{FungibleToken.Vault} <- sellerVaultRef.withdraw(amount: shareAmount)
    adminEscrowRef.deposit(from: <-pulled)

    // Record listing
    let adminRef: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing Fractional.Admin")
    adminRef.createListing(
      vaultId: vaultId,
      listingId: listingId,
      priceAsset: priceAsset,
      priceAmount: priceAmount,
      amount: shareAmount,
      seller: seller
    )
  }
}


