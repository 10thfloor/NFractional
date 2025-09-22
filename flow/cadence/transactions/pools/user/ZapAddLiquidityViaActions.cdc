import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"
import "ConstantProductAMMSwapper"
import "Fractional"
import "DeFiActions"

transaction(
  poolOwner: Address,
  poolPublicPathIdentifier: String,
  amountFlow: UFix64,
  minLpOut: UFix64,
  vaultId: String,
  platformAdmin: Address
) {
  prepare(signer: auth(Storage, BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
    // Pool
    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let poolCap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !poolCap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = poolCap.borrow() ?? panic("invalid pool capability")

    // Ensure FLOW receiver
    if signer.storage.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      signer.storage.save(<-v, to: /storage/flowTokenVault)
      let _ = signer.capabilities.unpublish(/public/flowTokenReceiver)
      signer.capabilities.publish(
        signer.capabilities.storage.issue<&FlowToken.Vault>(/storage/flowTokenVault),
        at: /public/flowTokenReceiver
      )
    }

    // Refund receivers for add-with-change
    let shareRecv: Capability<&{FungibleToken.Receiver}> = signer.capabilities.get<&{FungibleToken.Receiver}>(VaultShareToken.getReceiverPublicPath())
    if !shareRecv.check() { panic("share receiver not linked") }
    let flowRecv: Capability<&{FungibleToken.Receiver}> = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
    if !flowRecv.check() { panic("FLOW receiver not linked") }

    // Withdraw FLOW input
    let flowRef: auth(FungibleToken.Withdraw) &FlowToken.Vault =
      signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("FLOW vault not found")
    var flowAll: @FlowToken.Vault <- flowRef.withdraw(amount: amountFlow) as! @FlowToken.Vault

    // Compute split by reserves: target roughly 50/50 by current pool value
    let res: {String: UFix64} = p.reserves()
    let rsOpt = res["share"]; let rfOpt = res["flow"]
    if rsOpt == nil || rfOpt == nil { panic("pool reserves missing") }
    let rs = rsOpt!; let rf = rfOpt!
    let flowToSwap: UFix64 = amountFlow * rs / (rs + rf)
    let flowForLP: UFix64 = amountFlow - flowToSwap

    // Prepare split: take flowToSwap for swap leg
    var shareSide: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
    if flowToSwap > 0.0 {
      let fW: auth(FungibleToken.Withdraw) &FlowToken.Vault = &flowAll as auth(FungibleToken.Withdraw) &FlowToken.Vault
      let toSwap: @FlowToken.Vault <- fW.withdraw(amount: flowToSwap) as! @FlowToken.Vault

      // Swap FLOW -> SHARE via FeeSwapper

      let swapper: {ConstantProductAMMSwapper.FeeSwapper} =
        ConstantProductAMMSwapper.makeFlowToShareSwapper(
          poolCap: poolCap,
          trader: signer.address,
          id: nil
        ) as! {ConstantProductAMMSwapper.FeeSwapper}

      let res2: @{String: {FungibleToken.Vault}} <- swapper.swapWithFee(quote: nil, inVault: <-toSwap)
      let outShare <- res2.remove(key: "output")! // @VaultShareToken.Vault
      let feeFlow <- res2.remove(key: "fee")! as! @FlowToken.Vault
      destroy res2

      // Fee routing: split FLOW fee into protocol/vault shares
      let feeParams: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: vaultId)
      let vaultSplitBps: UInt64 = feeParams["ammFeeSplitVaultBps"]!
      let protocolSplitBps: UInt64 = feeParams["ammFeeSplitProtocolBps"]!
      let vaultShareAmt: UFix64 = (feeFlow.balance * UFix64(vaultSplitBps)) / 10000.0
      let protocolShareAmt: UFix64 = feeFlow.balance - vaultShareAmt

      // Ensure per-vault FLOW treasury exists under signer (publishes public receiver)
      let vtIdent = "VaultTreasury_FLOW_".concat(vaultId)
      let vtStorage: StoragePath = StoragePath(identifier: vtIdent)!
      let vtPublic: PublicPath = PublicPath(identifier: vtIdent)!
      if signer.storage.borrow<&FlowToken.Vault>(from: vtStorage) == nil {
        let empty <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
        signer.storage.save(<-empty, to: vtStorage)
      }
      let _unpub = signer.capabilities.unpublish(vtPublic)
      signer.capabilities.publish(
        signer.capabilities.storage.issue<&FlowToken.Vault>(vtStorage),
        at: vtPublic
      )

      // Withdraw and route
      let feeRef: auth(FungibleToken.Withdraw) &FlowToken.Vault = &feeFlow as auth(FungibleToken.Withdraw) &FlowToken.Vault
      if protocolShareAmt > 0.0 {
        let prot <- feeRef.withdraw(amount: protocolShareAmt) as! @FlowToken.Vault
        let platRecv: Capability<&{FungibleToken.Vault}> = getAccount(platformAdmin).capabilities.get<&{FungibleToken.Vault}>(/public/PlatformTreasury_FLOW)
        platRecv.borrow()!.deposit(from: <-prot)
      }
      if vaultShareAmt > 0.0 {
        let vPart <- feeRef.withdraw(amount: vaultShareAmt) as! @FlowToken.Vault
        let vRecv: &{FungibleToken.Receiver} = signer.storage.borrow<&{FungibleToken.Receiver}>(from: vtStorage)!
        vRecv.deposit(from: <-vPart)
      }
      destroy feeFlow

      // Accumulate share side
      let recvShare = &shareSide as &{FungibleToken.Receiver}
      recvShare.deposit(from: <-outShare)
    }

    // flowForLP remains inside flowAll; ensure flowAll equals flowForLP or less due to rounding
    // Proceed to add liquidity with change (refund caps already set)
    let lp: @ConstantProductAMM.LPVault <- p.addLiquidityWithChange(
      share: <-shareSide,
      flow: <-flowAll,
      minLpOut: minLpOut,
      provider: signer.address,
      shareRefund: shareRecv,
      flowRefund: flowRecv
    )

    // Save/merge LP and publish cap
    let lpPath = StoragePath(identifier: "AMM_LP_".concat(p.poolId))!
    if signer.storage.borrow<&ConstantProductAMM.LPVault>(from: lpPath) == nil {
      signer.storage.save(<-lp, to: lpPath)
    } else {
      let lpRef = signer.storage.borrow<&ConstantProductAMM.LPVault>(from: lpPath)!
      lpRef.deposit(from: <-lp)
    }
    let lpPubPath: PublicPath = PublicPath(identifier: "AMM_LP_".concat(p.poolId))!
    let _ = signer.capabilities.unpublish(lpPubPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&ConstantProductAMM.LPVault>(lpPath),
      at: lpPubPath
    )
  }
}