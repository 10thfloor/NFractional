import "FungibleToken"
import "FlowToken"
import "Fractional"
import "ConstantProductAMM"

transaction(poolOwner: Address, poolId: String, vaultId: String, shareAmount: UFix64, flowAmount: UFix64, minLpOut: UFix64) {
  prepare(admin: auth(BorrowValue, Storage) &Account) {
    let pubPath: PublicPath = ConstantProductAMM.getPoolPublicPath(poolId: poolId)
    let cap: Capability<&ConstantProductAMM.Pool> = getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(pubPath)
    assert(cap.check(), message: "invalid pool cap")
    let pool: &ConstantProductAMM.Pool = cap.borrow() ?? panic("bad pool")

    // Share escrow via dynamic storage path
    let meta: {String: String} = Fractional.getVaultFT(vaultId: vaultId) ?? panic("vault FT meta missing")
    let shareStorage: StoragePath = StoragePath(identifier: meta["storage"] ?? panic("storage ident missing"))!
    let shareEscrow: auth(FungibleToken.Withdraw) &{FungibleToken.Vault} = admin.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(from: shareStorage)
      ?? panic("share escrow missing")
    let share: @{FungibleToken.Vault} <- shareEscrow.withdraw(amount: shareAmount) // @{FungibleToken.Vault}

    // FLOW as concrete FlowToken
    let flowRef: auth(FungibleToken.Withdraw) &FlowToken.Vault =
      admin.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/PlatformTreasury_FLOW)
      ?? panic("admin FLOW vault missing")
    let flowAny: @{FungibleToken.Vault} <- flowRef.withdraw(amount: flowAmount)
    let flow: @FlowToken.Vault <- flowAny as! @FlowToken.Vault

    let _lp: @ConstantProductAMM.LPVault <- pool.addLiquidity(share: <-share, flow: <-flow, minLpOut: minLpOut, provider: admin.address)
    destroy _lp
  }
}   


