import "NonFungibleToken"

// Get NFT IDs for a collection given account and public path identifier
access(all) view fun main(account: Address, publicPathIdentifier: String): [UInt64] {
  let path: PublicPath = PublicPath(identifier: publicPathIdentifier)!
  let cap: Capability<&{NonFungibleToken.CollectionPublic}> = getAccount(account)
    .capabilities.get<&{NonFungibleToken.CollectionPublic}>(path)
  if !cap.check() { return [] }
  let col: &{NonFungibleToken.CollectionPublic}? = cap.borrow()
  if col == nil { return [] }
  return col!.getIDs()
}


