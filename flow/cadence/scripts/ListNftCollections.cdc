import "NonFungibleToken"

// Enumerate public paths on an account and return those exposing
// NonFungibleToken.CollectionPublic
access(all) fun main(account: Address): [{String: String}] {
  let acc: &Account = getAccount(account)
  var results: [{String: String}] = []
  var entry: {String: String} = {}

  acc.storage.forEachPublic(fun (path: PublicPath, _t: Type): Bool {
    let cap: Capability<&{NonFungibleToken.CollectionPublic}> = acc.capabilities.get<&{NonFungibleToken.CollectionPublic}>(path)
    if let col: &{NonFungibleToken.CollectionPublic} = cap.borrow() {
      let typeId: String = col.getType().identifier
      entry["publicPath"] = path.toString()
      entry["typeId"] = typeId
      results.append(entry)
    }
    return true
  })
  return results
}


