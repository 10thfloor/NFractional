import "Fractional"
import "ViewResolver"

access(all) fun main(account: Address, vaultId: String): Bool {
  let cap: Capability<&{Fractional.CustodyPublic}> = getAccount(account).capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
  if let c: &{Fractional.CustodyPublic} = cap.borrow() {
    return c.borrowViewResolver(vaultId: vaultId) != nil
  }
  return false
}