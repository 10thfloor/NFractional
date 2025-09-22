import "Fractional"

transaction {
  prepare(signer: auth(Storage) &Account) {
    if signer.storage.borrow<&Fractional.Custody>(from: /storage/FractionalCustody) == nil {
      signer.storage.save(<- Fractional.createCustody(), to: /storage/FractionalCustody)
    }
  }
}

