import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"

// Adds liquidity using the optimal pair computed from desired amounts and current reserves.
transaction(poolOwner: Address, poolPublicPathIdentifier: String, shareDesired: UFix64, flowDesired: UFix64, minLpOut: UFix64) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let poolCap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !poolCap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = poolCap.borrow() ?? panic("invalid pool capability")

    let rs: {String: UFix64} = p.reserves()
    let x0: UFix64 = rs["share"]!
    let y0: UFix64 = rs["flow"]!

    var shareAmt: UFix64 = shareDesired
    var flowAmt: UFix64 = flowDesired

    if x0 > 0.0 && y0 > 0.0 {
      // Compute the smallest proportional unit using GCD on 8dp integers
      let SCALE: UFix64 = 100000000.0
      let X0: UInt64 = UInt64(x0 * SCALE)
      let Y0: UInt64 = UInt64(y0 * SCALE)
      let shareDesiredU: UInt64 = UInt64(shareDesired * SCALE)
      let flowDesiredU: UInt64 = UInt64(flowDesired * SCALE)

      if X0 > 0 && Y0 > 0 {
        // Euclidean algorithm for GCD
        fun gcd(_ a: UInt64, _ b: UInt64): UInt64 {
          var x: UInt64 = a
          var y: UInt64 = b
          while y != 0 {
            let r: UInt64 = x % y
            x = y
            y = r
          }
          return x
        }

        let g: UInt64 = gcd(X0, Y0)
        let unitShare: UInt64 = X0 / g
        let unitFlow: UInt64 = Y0 / g

        let kShare: UInt64 = shareDesiredU / unitShare
        let kFlow: UInt64 = flowDesiredU / unitFlow
        let k: UInt64 = kShare < kFlow ? kShare : kFlow

        if k == 0 { panic("inputs too small for pool ratio at 8dp; increase one side") }

        let sU: UInt64 = k * unitShare
        let fU: UInt64 = k * unitFlow

        shareAmt = UFix64(sU) / SCALE
        flowAmt = UFix64(fU) / SCALE
      }
    }

    let shareRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &VaultShareToken.Vault>(from: VaultShareToken.getVaultStoragePath())
      ?? panic("share vault not found")
    let flowRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("FLOW vault not found")

    let share: @VaultShareToken.Vault <- shareRef.withdraw(amount: shareAmt) as! @VaultShareToken.Vault
    let flow: @FlowToken.Vault <- flowRef.withdraw(amount: flowAmt) as! @FlowToken.Vault

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
