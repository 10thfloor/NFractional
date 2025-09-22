import "FungibleToken"
import "FlowToken"
import "VaultShareToken"
import "ConstantProductAMM"

// Swaps exact-in from one token to the other with minOut protection.

transaction(poolOwner: Address, poolPublicPathIdentifier: String, inShare: Bool, amount: UFix64, minOut: UFix64) {
  prepare(signer: auth(Storage, BorrowValue) &Account) {
    let publicPath: PublicPath = PublicPath(identifier: poolPublicPathIdentifier)!
    let poolCap: Capability<&ConstantProductAMM.Pool> =
      getAccount(poolOwner).capabilities.get<&ConstantProductAMM.Pool>(publicPath)
    if !poolCap.check() { panic("invalid pool capability") }
    let p: &ConstantProductAMM.Pool = poolCap.borrow() ?? panic("invalid pool capability")
    if inShare {
      // Swap share -> flow using a provided share vault from signer storage (user should withdraw before submitting)
      panic("Provide a transaction variant that carries @VaultShareToken.Vault as argument; not implemented in this generic tx")
    } else {
      panic("Provide a transaction variant that carries @FlowToken.Vault as argument; not implemented in this generic tx")
    }
  }
}

