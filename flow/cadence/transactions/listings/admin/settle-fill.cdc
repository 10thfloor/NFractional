import "FungibleToken"
import "FungibleTokenConnectors"
import "VaultShareToken"
import "Fractional"
import "FlowToken"
import "FeeRouter"

// Admin-only settlement: move escrowed shares to buyer and mark listing filled.
transaction(
  symbol: String,
  vaultId: String,
  listingId: String,
  buyer: Address,
  shareAmount: UFix64,
  priceAmount: UFix64,
  seller: Address
) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    let storagePath: StoragePath = VaultShareToken.getVaultStoragePath()

    // Withdraw from admin escrow using Actions
    let adminWithdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> =
      admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(storagePath)
    let source: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: shareAmount, withdrawVault: adminWithdrawCap, uniqueID: nil)
    let buyerRecvCap: Capability<&{FungibleToken.Vault}> = getAccount(buyer)
      .capabilities.get<&{FungibleToken.Vault}>(VaultShareToken.getReceiverPublicPath())
    let sink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: buyerRecvCap, uniqueID: nil)

    let shares: @{FungibleToken.Vault} <- source.withdrawAvailable(maxAmount: shareAmount)
    sink.depositCapacity(from: &shares as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
    destroy shares

    // Pay seller from platform escrow and route fee
    let platStorage: StoragePath = StoragePath(identifier: "PlatformTreasury_FLOW")!
    let platWithdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> =
      admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(platStorage)

    // Compute fee splits
    let splits: {String: UFix64} = FeeRouter.computeFeeSplits(vaultId: vaultId, amount: priceAmount)
    let feeAmount: UFix64 = splits["feeAmount"] ?? 0.0
    let sellerAmount: UFix64 = priceAmount - feeAmount

    if sellerAmount > 0.0 {
      let src: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: sellerAmount, withdrawVault: platWithdrawCap, uniqueID: nil)
      let sellerRecv: Capability<&{FungibleToken.Vault}> = getAccount(seller).capabilities.get<&{FungibleToken.Vault}>(/public/flowTokenReceiver)
      let sink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: sellerRecv, uniqueID: nil)
      let funds: @{FungibleToken.Vault} <- src.withdrawAvailable(maxAmount: sellerAmount)
      sink.depositCapacity(from: &funds as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
      destroy funds
    }

    if feeAmount > 0.0 {
      FeeRouter.routeFee(
        vaultId: vaultId,
        tokenIdent: "FLOW",
        amount: feeAmount,
        source: platWithdrawCap,
        adminAddr: admin.address
      )
    }

    // Mark listing filled
    let a: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing admin")
    a.fillListing(vaultId: vaultId, listingId: listingId, buyer: buyer)
  }
}


