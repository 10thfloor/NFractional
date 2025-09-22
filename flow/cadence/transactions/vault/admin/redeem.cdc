import "Fractional"

transaction(
  vaultId: String
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.redeem(vaultId: vaultId)
  }
}


