import "Fractional"

access(all) fun main(account: Address): Bool {
  let acct: &Account = getAccount(account)
  let cap: Capability<&{Fractional.CustodyPublic}> =
    acct.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
  return cap.borrow() != nil
}