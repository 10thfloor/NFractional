import "Fractional"

transaction(
  vaultId: String,
  proposalId: String,
  result: String
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.finalizeBuyout(
      vaultId: vaultId,
      proposalId: proposalId,
      result: result
    )
  }
}




