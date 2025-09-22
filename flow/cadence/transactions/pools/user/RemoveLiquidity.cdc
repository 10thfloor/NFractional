import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"
import "Fractional"

// Removes liquidity by burning LP and returning both share and flow to signer.

transaction(poolOwner: Address, poolPublicPathIdentifier: String, lpAmount: UFix64, minShare: UFix64, minFlow: UFix64, vaultId: String) {
  prepare(signer: auth(Storage, BorrowValue) &Account) {
    // Liveness guard: require LockBox custody is alive
    let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
    if !Fractional.isCustodyAlive(vaultId: vaultId, custodian: v.custodian) { panic("vault custody not alive") }

    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let poolCap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !poolCap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = poolCap.borrow() ?? panic("invalid pool capability")
    let lpPath: StoragePath = StoragePath(identifier: "AMM_LP_".concat(p.poolId))!
    let lpRef: &ConstantProductAMM.LPVault = signer.storage.borrow<&ConstantProductAMM.LPVault>(from: lpPath) ?? panic("LP vault not found")

    let lpToBurn: @ConstantProductAMM.LPVault <- lpRef.withdraw(amount: lpAmount)
    let out: @{String: {FungibleToken.Vault}} <- p.removeLiquidity(lp: <-lpToBurn, minShare: minShare, minFlow: minFlow, provider: signer.address)
    let outShare: @{FungibleToken.Vault} <- out.remove(key: "share") as! @{FungibleToken.Vault}
    let outFlow: @{FungibleToken.Vault} <- out.remove(key: "flow") as! @{FungibleToken.Vault}
    destroy out

    // Deposit to signer’s standard vaults
    let shareReceiver: &{FungibleToken.Receiver} = signer.capabilities.borrow<&{FungibleToken.Receiver}>(VaultShareToken.getReceiverPublicPath())
      ?? panic("share receiver not found")
    shareReceiver.deposit(from: <-(outShare as! @VaultShareToken.Vault))
    let flowReceiver: &{FungibleToken.Receiver} = signer.capabilities.borrow<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
      ?? panic("FLOW receiver not found")
    flowReceiver.deposit(from: <-(outFlow as! @FlowToken.Vault))
  }
}


