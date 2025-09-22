import "ExampleNFT"

access(all)
fun main(account: Address): [UInt64] {
  let acct: &Account = getAccount(account)
  let cap: Capability<&ExampleNFT.Collection> = acct.capabilities.get<&ExampleNFT.Collection>(ExampleNFT.CollectionPublicPath)
  let colRef: &ExampleNFT.Collection = cap.borrow() ?? panic("missing ExampleNFT collection")
  return colRef.getIDs()
}




