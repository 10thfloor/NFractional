import "MetadataViews"
import "ViewResolver"
import "Fractional"

access(all) fun main(vaultId: String): {String: String}? {
  let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
  let custodian: Address = v.custodian

  let lbCap: Capability<&{Fractional.LockBoxPublic}> =
    getAccount(custodian).capabilities.get<&{Fractional.LockBoxPublic}>(Fractional.LockBoxPublicPath)
  if let lb: &{Fractional.LockBoxPublic} = lbCap.borrow() {
    if let r: &{ViewResolver.Resolver} = lb.borrowViewResolver(vaultId: vaultId) {
      if let d: MetadataViews.Display = MetadataViews.getDisplay(r) {
        let url: String = (d.thumbnail as? MetadataViews.HTTPFile)?.url ?? ""
        return {"name": d.name, "description": d.description, "thumbnail": url}
      }
    }
  }
  return nil
}
