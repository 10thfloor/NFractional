import "Fractional"

transaction(account: Address) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability, Storage) &Account) {
    let targetAccount: &Account = getAccount(account)
    
    // Check if custody resource exists
    let custodyRef: &Fractional.Custody? = targetAccount.storage.borrow<&Fractional.Custody>(from: /storage/FractionalCustody)
    if custodyRef == nil {
      panic("Custody resource not found for account")
    }
    
    // Check if capability is already published
    let existing: Capability<&{Fractional.CustodyPublic}>? = targetAccount.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
    
    if existing == nil || !existing!.check() {
      // Unpublish existing capability if it exists
      let _: Capability? = targetAccount.capabilities.unpublish(Fractional.CustodyPublicPath)
      
      // Publish new capability
      targetAccount.capabilities.publish(
        targetAccount.capabilities.storage.issue<&{Fractional.CustodyPublic}>(/storage/FractionalCustody),
        at: Fractional.CustodyPublicPath
      )
    }
  }
}
