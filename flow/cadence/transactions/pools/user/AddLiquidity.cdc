import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"
import "Fractional"

// Adds liquidity to a pool by withdrawing from the signer's share and FLOW vaults.
// The LP vault is persisted at /storage/AMM_LP_<poolId> for the signer.

transaction(poolOwner: Address, poolPublicPathIdentifier: String, shareAmount: UFix64, flowAmount: UFix64, minLpOut: UFix64, vaultId: String) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    // Liveness guard: require LockBox custody is alive
    let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
    if !Fractional.isCustodyAlive(vaultId: vaultId, custodian: v.custodian) { panic("vault custody not alive") }

    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let poolCap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !poolCap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = poolCap.borrow() ?? panic("invalid pool capability")
    let shareRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: VaultShareToken.getVaultStoragePath())
      ?? panic("share vault not found")
    let flowRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("FLOW vault not found")

    let share <- shareRef.withdraw(amount: shareAmount) as! @VaultShareToken.Vault
    let flow <- flowRef.withdraw(amount: flowAmount) as! @FlowToken.Vault
    let lp: @ConstantProductAMM.LPVault <- p.addLiquidity(share: <-share, flow: <-flow, minLpOut: minLpOut, provider: signer.address)
    let lpPath = StoragePath(identifier: "AMM_LP_".concat(p.poolId))!
    if signer.storage.borrow<&ConstantProductAMM.LPVault>(from: lpPath) == nil {
      signer.storage.save(<-lp, to: lpPath)
    } else {
      let lpRef = signer.storage.borrow<&ConstantProductAMM.LPVault>(from: lpPath)!
      lpRef.deposit(from: <-lp)
    }

    // Publish public capability so UI can read LP balance
    let lpPubPath: PublicPath = PublicPath(identifier: "AMM_LP_".concat(p.poolId))!
    let _ = signer.capabilities.unpublish(lpPubPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&ConstantProductAMM.LPVault>(lpPath),
      at: lpPubPath
    )
  }
}


