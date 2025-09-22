import FungibleToken from 0xee82856bf20e2aa6
import Fractional from 0xf8d6e0586b0a20c7

access(all) view fun main(vaultId: String, account: Address): {String: Bool} {
  let meta = Fractional.getVaultFT(vaultId: vaultId) ?? panic("no per-vault FT metadata")
  let recvPath = PublicPath(identifier: meta["receiver"]!)!
  let balPath  = PublicPath(identifier: meta["balance"]!)!

  let recvCap = getAccount(account).capabilities.get<&{FungibleToken.Receiver}>(recvPath)
  let balCap  = getAccount(account).capabilities.get<&{FungibleToken.Balance}>(balPath)

  return {
    "hasReceiverCap": recvCap.check(),
    "hasBalanceCap": balCap.check()
  }
}