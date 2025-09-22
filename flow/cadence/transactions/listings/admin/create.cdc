import "Fractional"

transaction(
  vaultId: String,
  listingId: String,
  priceAsset: String,
  priceAmount: UFix64,
  shareAmount: UFix64,
  seller: Address
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.createListing(
      vaultId: vaultId,
      listingId: listingId,
      priceAsset: priceAsset,
      priceAmount: priceAmount,
      amount: shareAmount,
      seller: seller
    )
  }
}


