import "MetadataViews"
import "ViewResolver"
import "Fractional"

access(all) fun main(account: Address, vaultId: String, tokenId: UInt64): {String: String}? {
  let acct: &Account = getAccount(account)
  let cap: Capability<&{Fractional.CustodyPublic}> =
    acct.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
  if let c: &{Fractional.CustodyPublic} = cap.borrow() {
    if let res: &{ViewResolver.Resolver} = c.borrowViewResolver(vaultId: vaultId) {
      if let d: MetadataViews.Display = res.resolveView(Type<MetadataViews.Display>()) as! MetadataViews.Display? {
        let url: String = (d.thumbnail as? MetadataViews.HTTPFile)?.url ?? ""
        return {"name": d.name, "description": d.description, "thumbnail": url}
      }
    }
  }
  return nil
}
