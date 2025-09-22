import "Fractional"

transaction(vaultId: String, currentHeight: UInt64) {
  prepare(admin: auth(Storage) &Account) {
    let ref: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    ref.activateFeeParams(vaultId: vaultId, currentHeight: currentHeight)
  }
}


