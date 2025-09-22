import "FungibleToken"
import "FlowToken"
import "Fractional"
import "FungibleTokenConnectors"
import "FeeRouter"
import "ConstantProductAMM"
import "ConstantProductAMMSwapper"
import "VaultShareToken"
import "DeFiActions"

// Optional AMM pre-swap on our platform (share -> flow) before paying seller
transaction(
  pool: Capability<&ConstantProductAMM.Pool>,
  swapShareAmount: UFix64,
  minFlowOut: UFix64,
  symbol: String,
  seller: Address,
  priceAmount: UFix64,
  shareAmount: UFix64,
  vaultId: String,
  listingId: String
) {
  prepare(
    buyer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account,
    admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account
  ) {
    // Liveness guard: require LockBox custody is alive
    let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
    if !Fractional.isCustodyAlive(vaultId: vaultId, custodian: v.custodian) { panic("vault custody not alive") }

    if buyer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      buyer.storage.save(<-v, to: /storage/flowTokenVault)
      let _ = buyer.capabilities.unpublish(/public/flowTokenReceiver)
      buyer.capabilities.publish(
        buyer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
        at: /public/flowTokenReceiver
      )
    }

    // Optional: swap share -> flow on our AMM before payment
    if swapShareAmount > 0.0 {
      let p: &ConstantProductAMM.Pool = pool.borrow() ?? panic("invalid pool capability")
      let shareRef: auth(FungibleToken.Withdraw) &VaultShareToken.Vault = buyer.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: VaultShareToken.getVaultStoragePath())
        ?? panic("share vault not found")
      let input: @VaultShareToken.Vault <- shareRef.withdraw(amount: swapShareAmount) as! @VaultShareToken.Vault
      let swapper: {DeFiActions.Swapper} = ConstantProductAMMSwapper.makeShareToFlowSwapper(poolCap: pool, trader: buyer.address, id: nil)
      let q: {DeFiActions.Quote} = swapper.quoteOut(forProvided: swapShareAmount, reverse: false)
      if q.outAmount < minFlowOut { panic("slippage: quoted < min") }
      let out: @{FungibleToken.Vault} <- swapper.swap(quote: q, inVault: <-input)
      let casted: @FlowToken.Vault <- out as! @FlowToken.Vault
      let flowRecv = buyer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
      if !flowRecv.check() { panic("FLOW receiver not linked") }
      flowRecv.borrow()!.deposit(from: <-casted)
      // p is kept borrowed to satisfy reference usage; not used further
      let _ = p
    }

    // Pay seller in FLOW
    let withdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> = buyer.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(/storage/flowTokenVault)
    let source: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: nil, withdrawVault: withdrawCap, uniqueID: nil)
    let sellerDepositCap: Capability<&{FungibleToken.Vault}> = getAccount(seller).capabilities.get<&{FungibleToken.Vault}>(/public/flowTokenReceiver)
    let sink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: sellerDepositCap, uniqueID: nil)
    let tokens: @{FungibleToken.Vault} <- source.withdrawAvailable(maxAmount: priceAmount)
    sink.depositCapacity(from: &tokens as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
    destroy tokens

    // Route listing taker fee via FeeRouter (FLOW)
    let buyerWithdrawCap2: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> = buyer.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(/storage/flowTokenVault)
    FeeRouter.routeFee(
      vaultId: vaultId,
      tokenIdent: "FLOW",
      amount: priceAmount,
      source: buyerWithdrawCap2,
      adminAddr: admin.address
    )

    let shareStorage: StoragePath = StoragePath(identifier: "vault_".concat(symbol))!
    let shareReceiver: PublicPath = PublicPath(identifier: "receiver_".concat(symbol))!
    if !buyer.capabilities.exists(shareReceiver) {
      panic("Setup Shares required: missing Receiver for buyer")
    }
    let adminWithdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> = admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(shareStorage)
    let shareSource: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: shareAmount, withdrawVault: adminWithdrawCap, uniqueID: nil)
    let buyerShareRecv: Capability<&{FungibleToken.Vault}> = buyer.capabilities.storage.issue<&{FungibleToken.Vault}>(shareStorage)
    let shareSink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: buyerShareRecv, uniqueID: nil)
    let shares: @{FungibleToken.Vault} <- shareSource.withdrawAvailable(maxAmount: shareAmount)
    if shares.balance <= 0.0 {
      destroy shares
      panic("insufficient escrowed shares for listing")
    } else {
      while shares.balance > 0.0 {
        let before: UFix64 = shares.balance
        shareSink.depositCapacity(from: &shares as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
        if shares.balance == before { panic("failed to deposit shares to buyer") }
      }
      destroy shares
    }

    let adminRef: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing admin")
    adminRef.fillListing(vaultId: vaultId, listingId: listingId, buyer: buyer.address)
  }
}


