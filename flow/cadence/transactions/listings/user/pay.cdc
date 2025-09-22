import "FungibleToken"
import "FlowToken"

// Buyer-only payment leg for a listing.
// Sends FLOW to platform treasury escrow; admin later settles atomically (pay seller + transfer shares).
transaction(
  vaultId: String,
  listingId: String,
  seller: Address,
  priceAmount: UFix64,
  platformAdmin: Address
) {
  prepare(buyer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
    // Ensure buyer FLOW vault/receiver
    if buyer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      buyer.storage.save(<-v, to: /storage/flowTokenVault)
      let _: Capability? = buyer.capabilities.unpublish(/public/flowTokenReceiver)
      buyer.capabilities.publish(
        buyer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
        at: /public/flowTokenReceiver
      )
    }

    // Move funds to platform escrow (treasury) for atomic settlement later
    let withdrawRef: auth(FungibleToken.Withdraw) &FlowToken.Vault =
      buyer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("FLOW vault not found")
    let out: @FlowToken.Vault <- withdrawRef.withdraw(amount: priceAmount) as! @FlowToken.Vault
    let platRecv: &{FungibleToken.Receiver} = getAccount(platformAdmin)
      .capabilities
      .get<&{FungibleToken.Receiver}>(/public/PlatformTreasury_FLOW)
      .borrow() ?? panic("platform FLOW treasury receiver missing")
    platRecv.deposit(from: <-out)
  }
}


