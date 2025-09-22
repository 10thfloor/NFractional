import "Fractional"

access(all) fun main(account: Address): {String: String} {
  let acct: &Account = getAccount(account)
  
  // Check if custody resource exists
  let custodyRef: &Fractional.Custody? = acct.storage.borrow<&Fractional.Custody>(from: /storage/FractionalCustody)
  
  if custodyRef == nil {
    return {"status": "no_custody_resource", "message": "Custody resource not found"}
  }
  
  // Check if custody capability is published
  let cap: Capability<&{Fractional.CustodyPublic}>? = acct.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
  
  if cap == nil {
    return {"status": "no_custody_capability", "message": "Custody capability not published"}
  }
  
  if !cap!.check() {
    return {"status": "invalid_capability", "message": "Custody capability is invalid"}
  }
  
  return {"status": "custody_ready", "message": "Custody resource and capability are properly set up"}
}
