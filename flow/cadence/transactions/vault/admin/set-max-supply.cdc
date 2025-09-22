import "Fractional"

transaction(
  vaultId: String,
  maxSupply: UFix64
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.setMaxSupply(vaultId: vaultId, maxSupply: maxSupply)
  }
}


