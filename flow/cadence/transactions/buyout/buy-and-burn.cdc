import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "Fractional"

/// Buy a holder's shares for FLOW and burn them immediately.
/// This transaction handles a single holder at a time.
/// Repeat until VaultShareToken totalSupply == 0, then run admin redeem-and-withdraw.
transaction(
  vaultId: String,
  shares: UFix64,
  pricePerShare: UFix64,
  minPayment: UFix64
) {
  prepare(
    buyer: auth(Storage, BorrowValue, SaveValue) &Account,
    holder: auth(Storage, BorrowValue) &Account
  ) {
    let _v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")

    // 1) Ensure buyer share vault exists (to burn from)
    let sharePath = VaultShareToken.getVaultStoragePath()
    if buyer.storage.borrow<&VaultShareToken.Vault>(from: sharePath) == nil {
      let empty: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let casted: @VaultShareToken.Vault <- empty as! @VaultShareToken.Vault
      buyer.storage.save(<-casted, to: sharePath)
    }
    let buyerShareRef = buyer.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: sharePath)
      ?? panic("buyer share vault not found")

    // 2) Withdraw shares from holder and deposit to buyer (so we can burn via admin)
    let holderShareRef = holder.storage
      .borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: sharePath)
      ?? panic("holder share vault not found")
    let lot: @VaultShareToken.Vault <- holderShareRef.withdraw(amount: shares) as! @VaultShareToken.Vault
    buyerShareRef.deposit(from: <-lot)

    // 3) Pay holder in FLOW
    let pay: UFix64 = pricePerShare * shares
    let buyerFlowRef = buyer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("buyer FLOW vault not found")
    let out: @FlowToken.Vault <- buyerFlowRef.withdraw(amount: pay) as! @FlowToken.Vault
    if out.balance < minPayment { panic("payment short") }
    let holderRecv = holder.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
    if !holderRecv.check() { panic("holder FLOW receiver not linked") }
    holderRecv.borrow()!.deposit(from: <-out)

    // 4) Burn the acquired shares from buyer vault
    let admin = VaultShareToken.borrowAdmin() ?? panic("FT admin missing")
    admin.burn(from: buyerShareRef as auth(FungibleToken.Withdraw) &{FungibleToken.Vault}, amount: shares)
  }
}


