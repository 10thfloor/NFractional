import "FungibleToken"

access(all) view fun main(account: Address, balancePath: String): UFix64 {
  let cap = getAccount(account)
    .capabilities.get<&{FungibleToken.Balance}>(PublicPath(identifier: balancePath)!)
  if !cap.check() { return 0.0 }
  let ref = cap.borrow() ?? panic("balance capability missing")
  return ref.balance
}


