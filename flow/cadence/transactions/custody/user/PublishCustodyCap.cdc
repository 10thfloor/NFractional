import "Fractional"

transaction {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability, Storage) &Account) {
    if signer.storage.borrow<&Fractional.Custody>(from: /storage/FractionalCustody) == nil {
      signer.storage.save(<- Fractional.createCustody(), to: /storage/FractionalCustody)
    }
    let existing: Capability<&{Fractional.CustodyPublic}> = signer.capabilities.get<&{Fractional.CustodyPublic}>(Fractional.CustodyPublicPath)
    if !existing.check() {
      let _: Capability? = signer.capabilities.unpublish(Fractional.CustodyPublicPath)
      signer.capabilities.publish(
        signer.capabilities.storage.issue<&{Fractional.CustodyPublic}>(/storage/FractionalCustody),
        at: Fractional.CustodyPublicPath
      )
    }
  }
}


