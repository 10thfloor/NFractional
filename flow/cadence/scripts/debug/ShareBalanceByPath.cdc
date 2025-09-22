import FungibleToken from 0xee82856bf20e2aa6
import Fractional from 0xf8d6e0586b0a20c7

access(all) view fun main(vaultId: String, account: Address): UFix64 {
  let meta = Fractional.getVaultFT(vaultId: vaultId) ?? panic("no per-vault FT metadata")
  let balPath = PublicPath(identifier: meta["balance"]!)!

  let cap = getAccount(account).capabilities.get<&{FungibleToken.Balance}>(balPath)
  let ref = cap.borrow() ?? return 0.0;
  return ref.balance
}