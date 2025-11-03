import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"
import "ConstantProductAMMSwapper"
import "DeFiActions"
import "Fractional"
import "FungibleTokenConnectors"
import "FeeRouter"

transaction(
  poolOwner: Address,
  poolPublicPathIdentifier: String,
  directionTag: String, // "share_to_flow" | "flow_to_share"
  amountIn: UFix64,
  slippageBps: UInt64,
  useID: Bool,
  vaultId: String,  // needed for fee routing
  platformAdmin: Address,
  tokenIdent: String,
  vaultStorageSuffix: String
) {
  prepare(signer: auth(Storage, BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
    // Liveness guard: require LockBox custody is alive
    let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
    if !Fractional.isCustodyAlive(vaultId: vaultId, custodian: v.custodian) { panic("vault custody not alive") }

    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let cap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !cap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = cap.borrow() ?? panic("invalid pool capability")

    var direction: ConstantProductAMMSwapper.Direction = ConstantProductAMMSwapper.Direction.ShareToFlow
    switch directionTag {
      case "share_to_flow":
        direction = ConstantProductAMMSwapper.Direction.ShareToFlow
      case "flow_to_share":
        direction = ConstantProductAMMSwapper.Direction.FlowToShare
      default:
        panic("invalid direction tag")
    }

    var id: DeFiActions.UniqueIdentifier? = nil
    if useID {
      id = DeFiActions.createUniqueIdentifier()
    }
    if direction == ConstantProductAMMSwapper.Direction.ShareToFlow {
      let shareRef = signer.storage
        .borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(
          from: VaultShareToken.getVaultStoragePath()
        ) ?? panic("share vault not found")
      let input: @VaultShareToken.Vault <- shareRef.withdraw(amount: amountIn) as! @VaultShareToken.Vault
      let baseSwapper1: {DeFiActions.Swapper} =
        ConstantProductAMMSwapper.makeShareToFlowSwapper(poolCap: cap, trader: signer.address, id: id)
      let swapper: {ConstantProductAMMSwapper.FeeSwapper} = baseSwapper1 as! {ConstantProductAMMSwapper.FeeSwapper}
      // Compute platform fee on input and effective amount for quoting
      let feeParams1: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: p.vaultId)
      let ammFeeBps1: UInt64 = feeParams1["ammFeeBps"] ?? 0
      let platformFee1: UFix64 = (amountIn * UFix64(ammFeeBps1)) / 10000.0
      let effectiveIn1: UFix64 = amountIn > platformFee1 ? (amountIn - platformFee1) : 0.0

      // Compute on-chain quote and slippage minOut using effective input
      let qOut: {DeFiActions.Quote} = (baseSwapper1 as! ConstantProductAMMSwapper.AMMSwapper).quoteOut(forProvided: effectiveIn1, reverse: false)
      let q: ConstantProductAMMSwapper.AMMQuote = qOut as! ConstantProductAMMSwapper.AMMQuote
      let slipMul: UFix64 = (10000.0 - UFix64(slippageBps)) / 10000.0
      let minOut: UFix64 = q.outAmount * slipMul
      
      // Get result dictionary with output and fee
      let quoteMin: ConstantProductAMMSwapper.AMMQuote = ConstantProductAMMSwapper.AMMQuote(
        inType: p.getShareVaultType(),
        outType: Type<@FlowToken.Vault>(),
        inAmount: effectiveIn1,
        outAmount: minOut
      )
      let result: @{String: {FungibleToken.Vault}} <- swapper.swapWithFee(
        quote: quoteMin as {DeFiActions.Quote},
        inVault: <-input
      )
      let output: @FlowToken.Vault <- result.remove(key: "output")! as! @FlowToken.Vault
      let fee: @{FungibleToken.Vault} <- result.remove(key: "fee")!
      destroy result
      
      // Route AMM fee via FeeRouter using explicit per‑vault share token ident
      if fee.balance > 0.0 {
        FeeRouter.routeAmmFeeFromVault(
          vaultId: vaultId,
          tokenIdent: tokenIdent,
          fee: <-fee,
          adminAddr: platformAdmin,
          vaultStorageSuffix: vaultStorageSuffix
        )
      } else {
        destroy fee
      }
      
      // Ensure FLOW vault and receiver are linked for first-time users
      if signer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault) == nil {
        let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
        signer.storage.save(<-v, to: /storage/flowTokenVault)
        let _: Capability? = signer.capabilities.unpublish(/public/flowTokenReceiver)
        signer.capabilities.publish(
          signer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
          at: /public/flowTokenReceiver
        )
      } else {
        let recvCap = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
        if !recvCap.check() {
          let _: Capability? = signer.capabilities.unpublish(/public/flowTokenReceiver)
          signer.capabilities.publish(
            signer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
            at: /public/flowTokenReceiver
          )
        }
      }

      // Verify slippage and deposit output (minOut already enforced in pool.swap)
      let flowReceiver = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
      if !flowReceiver.check() { panic("FLOW receiver not linked") }
      flowReceiver.borrow()!.deposit(from: <-output)
    } else if direction == ConstantProductAMMSwapper.Direction.FlowToShare {
      let flowRef: auth(FungibleToken.Withdraw) &FlowToken.Vault =
        signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
        ?? panic("FLOW vault not found")
      let input: @FlowToken.Vault <- flowRef.withdraw(amount: amountIn) as! @FlowToken.Vault
      let baseSwapper3: {DeFiActions.Swapper} =
        ConstantProductAMMSwapper.makeFlowToShareSwapper(poolCap: cap, trader: signer.address, id: id)
      let swapper: {ConstantProductAMMSwapper.FeeSwapper} = baseSwapper3 as! {ConstantProductAMMSwapper.FeeSwapper}
      // Compute platform fee on input and effective amount for quoting
      let feeParams2: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: p.vaultId)
      let ammFeeBps2: UInt64 = feeParams2["ammFeeBps"] ?? 0
      let platformFee2: UFix64 = (amountIn * UFix64(ammFeeBps2)) / 10000.0
      let effectiveIn2: UFix64 = amountIn > platformFee2 ? (amountIn - platformFee2) : 0.0

      // Compute on-chain quote and slippage minOut using effective input
      let qOut2: {DeFiActions.Quote} = (baseSwapper3 as! ConstantProductAMMSwapper.AMMSwapper).quoteOut(forProvided: effectiveIn2, reverse: false)
      let q2: ConstantProductAMMSwapper.AMMQuote = qOut2 as! ConstantProductAMMSwapper.AMMQuote
      let slipMul2: UFix64 = (10000.0 - UFix64(slippageBps)) / 10000.0
      let minOut2: UFix64 = q2.outAmount * slipMul2
      
      // Get result dictionary with output and fee
      let quoteMin2: ConstantProductAMMSwapper.AMMQuote = ConstantProductAMMSwapper.AMMQuote(
        inType: Type<@FlowToken.Vault>(),
        outType: p.getShareVaultType(),
        inAmount: effectiveIn2,
        outAmount: minOut2
      )
      let result: @{String: {FungibleToken.Vault}} <- swapper.swapWithFee(
        quote: quoteMin2 as {DeFiActions.Quote},
        inVault: <-input
      )
      let output: @VaultShareToken.Vault <- result.remove(key: "output")! as! @VaultShareToken.Vault
      let fee: @FlowToken.Vault <- result.remove(key: "fee")! as! @FlowToken.Vault
      destroy result
      
      // Route AMM fee via FeeRouter (FLOW)
      if fee.balance > 0.0 {
        FeeRouter.routeAmmFeeFromVault(
          vaultId: vaultId,
          tokenIdent: "FLOW",
          fee: <-fee,
          adminAddr: platformAdmin,
          vaultStorageSuffix: vaultStorageSuffix
        )
      } else {
        destroy fee
      }
      
      // Verify slippage and deposit output (minOut already enforced in pool.swap)
      let shareReceiverPath = VaultShareToken.getReceiverPublicPath()
      let shareReceiver = signer.capabilities.get<&{FungibleToken.Receiver}>(shareReceiverPath)
      if !shareReceiver.check() { panic("Share receiver not linked") }
      shareReceiver.borrow()!.deposit(from: <-output)
    } else {
      panic("invalid direction")
    }
  }
}