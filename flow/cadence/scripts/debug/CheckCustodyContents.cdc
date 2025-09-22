import "Fractional"
import "ViewResolver"

access(all) fun main(account: Address): [String] {
  let acct: &Account = getAccount(account)
  let cap: Capability<&{Fractional.CustodyPublic}> = acct.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
  
  if let custody: &{Fractional.CustodyPublic} = cap.borrow() {
    // We can't directly access the holdings, but we can try to borrow view resolvers
    // for known vault IDs to see what's in custody
    let testVaults = ["VAULT001", "VAULT002", "VAULT003"]
    var foundVaults: [String] = []
    
    for vaultId in testVaults {
      if let resolver: &{ViewResolver.Resolver} = custody.borrowViewResolver(vaultId: vaultId) {
        foundVaults.append(vaultId)
      }
    }
    
    return foundVaults
  }
  
  return []
}
