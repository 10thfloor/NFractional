import "Fractional"

transaction {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability, Storage) &Account) {
    if signer.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox) == nil {
      signer.storage.save(<- Fractional.createLockBox(), to: /storage/FractionalLockBox)
    }
    let _: Capability? = signer.capabilities.unpublish(Fractional.LockBoxPublicPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&{Fractional.LockBoxPublic}>(/storage/FractionalLockBox),
      at: Fractional.LockBoxPublicPath
    )
  }
}


