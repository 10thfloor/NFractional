import "NonFungibleToken"

access(all) fun main(account: Address): [{String: String}] {
  let acc: &Account = getAccount(account)
  var results: [{String: String}] = []

  acc.storage.forEachStored(fun (path: StoragePath, t: Type): Bool {
    if t.isSubtype(of: Type<@{NonFungibleToken.Provider}>()) {
      var entry: {String: String} = {}
      entry["storagePath"] = path.toString()
      entry["typeId"] = t.identifier
      results.append(entry)
    }
    return true
  })
  return results
}
