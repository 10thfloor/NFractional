import "Fractional"

transaction(
  vaultId: String,
  listingId: String,
  buyer: Address
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.fillListing(
      vaultId: vaultId,
      listingId: listingId,
      buyer: buyer
    )
  }
}


