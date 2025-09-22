import "FungibleToken"
import "FlowToken"
import "Fractional"
import "FungibleTokenConnectors"
import "FeeRouter"

// Buyer pays seller with FLOW and buyer receives escrowed shares; optional fee routed to platform/vault treasuries
transaction(
  symbol: String,
  vaultId: String,
  listingId: String,
  seller: Address,
  priceAmount: UFix64,
  shareAmount: UFix64
) {
  prepare(
    buyer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account,
    admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account
  ) {
    if buyer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      buyer.storage.save(<-v, to: /storage/flowTokenVault)
      buyer.capabilities.unpublish(/public/flowTokenReceiver)
      buyer.capabilities.publish(
        buyer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
        at: /public/flowTokenReceiver
      )
    }

    let buyerWithdrawCap = buyer.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(/storage/flowTokenVault)
    let paySource = FungibleTokenConnectors.VaultSource(min: nil, withdrawVault: buyerWithdrawCap, uniqueID: nil)
    let sellerRecv = getAccount(seller).capabilities.get<&{FungibleToken.Vault}>(/public/flowTokenReceiver)
    let paySink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: sellerRecv, uniqueID: nil)
    let funds <- paySource.withdrawAvailable(maxAmount: priceAmount)
    if funds.balance <= 0.0 {
      destroy funds
      panic("insufficient buyer funds")
    } else {
      while funds.balance > 0.0 {
        let before = funds.balance
        paySink.depositCapacity(from: &funds as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
        if funds.balance == before { panic("failed to deposit buyer funds") }
      }
      destroy funds
    }

    // Route fees via FeeRouter (FLOW only here)
    let buyerWithdrawCap2 = buyer.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(/storage/flowTokenVault)
    
    FeeRouter.routeFee(
      vaultId: vaultId,
      tokenIdent: "FLOW",
      amount: priceAmount,
      source: buyerWithdrawCap2,
      adminAddr: admin.address
    )

    let shareStorage: StoragePath = StoragePath(identifier: "vault_".concat(symbol))!
    let shareReceiver: PublicPath = PublicPath(identifier: "receiver_".concat(symbol))!
    let buyerRecvCap = buyer.capabilities.get<&{FungibleToken.Receiver}>(shareReceiver)
    if !buyerRecvCap.check() {
      panic("Setup Shares required: missing Receiver for buyer")
    }
    let adminWithdrawCap = admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(shareStorage)
    let shareSource = FungibleTokenConnectors.VaultSource(min: shareAmount, withdrawVault: adminWithdrawCap, uniqueID: nil)
    let buyerShareRecv = buyer.capabilities.storage.issue<&{FungibleToken.Vault}>(shareStorage)
    let shareSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: buyerShareRecv, uniqueID: nil)
    let shares <- shareSource.withdrawAvailable(maxAmount: shareAmount)
    if shares.balance <= 0.0 {
      destroy shares
      panic("insufficient escrowed shares for listing")
    } else {
      while shares.balance > 0.0 {
        let before = shares.balance
        shareSink.depositCapacity(from: &shares as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
        if shares.balance == before { panic("failed to deposit shares to buyer") }
      }
      destroy shares
    }

    let adminRef = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing Fractional.Admin")
    adminRef.fillListing(vaultId: vaultId, listingId: listingId, buyer: buyer.address)
  }
}


