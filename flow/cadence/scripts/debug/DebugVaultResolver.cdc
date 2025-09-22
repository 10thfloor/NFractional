import "Fractional"
import "ViewResolver"
import "MetadataViews"

access(all) fun main(account: Address, vaultId: String): {String: String} {
  let acct = getAccount(account)
  let cap = acct.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
  if !cap.check() { return {"status":"no_cap"} }
  if let c: &{Fractional.CustodyPublic} = cap.borrow() {
    if let r: &{ViewResolver.Resolver} = c.borrowViewResolver(vaultId: vaultId) {
      let hasDisplay = (r.resolveView(Type<MetadataViews.Display>()) as! MetadataViews.Display?) != nil
      return {"status":"ok", "display": hasDisplay ? "yes" : "no"}
    }
    return {"status":"no_resolver"}
  }
  return {"status":"no_custody"}
}