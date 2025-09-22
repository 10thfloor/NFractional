import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"

// Simple add: user provides any amounts; pool uses exact proportional part and refunds the rest.
transaction(
  poolOwner: Address,
  poolPublicPathIdentifier: String,
  shareIn: UFix64,
  flowIn: UFix64,
  minLpOut: UFix64
) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let poolCap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !poolCap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = poolCap.borrow() ?? panic("invalid pool capability")

    // Withdraw requested amounts (either may be zero)
    var share: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
    if shareIn > 0.0 {
      let shareRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: VaultShareToken.getVaultStoragePath())
        ?? panic("share vault not found")
      let tmp <- shareRef.withdraw(amount: shareIn)
      let recvS = &share as &{FungibleToken.Receiver}
      recvS.deposit(from: <-tmp)
    }
    var flow: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
    if flowIn > 0.0 {
      let flowRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
        ?? panic("FLOW vault not found")
      let w: @FlowToken.Vault <- flowRef.withdraw(amount: flowIn) as! @FlowToken.Vault
      let recv = &flow as &{FungibleToken.Receiver}
      recv.deposit(from: <-w)
    }

    // Refund receivers
    let shareRecv: Capability<&{FungibleToken.Receiver}> = signer.capabilities.get<&{FungibleToken.Receiver}>(VaultShareToken.getReceiverPublicPath())
    if !shareRecv.check() { panic("share receiver not found") }
    let flowRecv: Capability<&{FungibleToken.Receiver}> = signer.capabilities.get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
    if !flowRecv.check() { panic("FLOW receiver not found") }

    // Support single-sided input: if one side is zero, swap half to create the pair
    if share.balance > 0.0 && flow.balance == 0.0 {
      let half: UFix64 = share.balance / 2.0
      if half > 0.0 {
        let sRefW: auth(FungibleToken.Withdraw) &{FungibleToken.Vault} = &share
        let toSwap: @{FungibleToken.Vault} <- sRefW.withdraw(amount: half)
        let res: @{String: {FungibleToken.Vault}} <- p.swapShareForFlow(input: <-toSwap, minOut: 0.0, trader: signer.address)
        // Extract output and fee
        let out <- res.remove(key: "output")
          ?? panic("swapShareForFlow missing output")
        let fee <- res.remove(key: "fee")
          ?? panic("swapShareForFlow missing fee")
        destroy res
        // Deposit output (generic FT) into FLOW vault receiver
        let fr: &{FungibleToken.Receiver} = &flow
        fr.deposit(from: <-out)
        // Internal routing: discard fee for now to avoid resource loss
        destroy fee
      }
    } else if flow.balance > 0.0 && share.balance == 0.0 {
      let halfF: UFix64 = flow.balance / 2.0
      if halfF > 0.0 {
        let fRefW: auth(FungibleToken.Withdraw) &FlowToken.Vault = &flow
        let toSwapF: @FlowToken.Vault <- fRefW.withdraw(amount: halfF) as! @FlowToken.Vault
        let res2: @{String: {FungibleToken.Vault}} <- p.swapFlowForShare(input: <-toSwapF, minOut: 0.0, trader: signer.address)
        // Extract output and fee
        let out2 <- res2.remove(key: "output")
          ?? panic("swapFlowForShare missing output")
        let fee2 <- res2.remove(key: "fee")
          ?? panic("swapFlowForShare missing fee")
        destroy res2
        let sr: &{FungibleToken.Receiver} = &share 
        sr.deposit(from: <-out2)
        destroy fee2
      }
    }

    // Execute add-with-change
    let lp: @ConstantProductAMM.LPVault <- p.addLiquidityWithChange(
      share: <-share,
      flow: <-flow,
      minLpOut: minLpOut,
      provider: signer.address,
      shareRefund: shareRecv,
      flowRefund: flowRecv
    )

    // Save/merge LP and publish public capability
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


