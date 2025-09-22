import "Fractional"

transaction(
  vaultId: String,
  collection: String,
  tokenId: UInt64,
  shareSymbol: String,
  policy: String
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.createVault(
      vaultId: vaultId,
      collection: collection,
      tokenId: tokenId,
      shareSymbol: shareSymbol,
      policy: policy,
      creator: signer.address
    )
  }
}




