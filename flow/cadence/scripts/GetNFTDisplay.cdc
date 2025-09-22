import "NonFungibleToken"
import "MetadataViews"
import "ViewResolver"

// Return basic display metadata for a given NFT if it implements MetadataViews.Display
// - account: owner address of the collection
// - publicPathIdentifier: the identifier part of the public path (e.g., "MomentCollection")
// - tokenId: the NFT id to inspect
// Returns a dictionary with keys: name, description, thumbnail (if available)
access(all) fun main(
  account: Address,
  publicPathIdentifier: String,
  tokenId: UInt64
): {String: String}? {
  let path: PublicPath = PublicPath(identifier: publicPathIdentifier)!
  let cap: Capability<&{NonFungibleToken.CollectionPublic}> = getAccount(account)
    .capabilities.get<&{NonFungibleToken.CollectionPublic}>(path)
  if !cap.check() { return nil }
  let col = cap.borrow()
  if col == nil { return nil }

  if let nftRef = col!.borrowNFT(tokenId) {
    // Try resolving MetadataViews.Display via ViewResolver
    let resolver: &{ViewResolver.Resolver} = nftRef
    if let display: MetadataViews.Display = resolver.resolveView(Type<MetadataViews.Display>()) as! MetadataViews.Display? {
        var out: {String: String} = {}
        out["name"] = display.name
        out["description"] = display.description
        let url: String = (display.thumbnail as? MetadataViews.HTTPFile)?.url ?? ""
        if url.length > 0 { out["thumbnail"] = url }
        return out
    }
  }
  return nil
}


