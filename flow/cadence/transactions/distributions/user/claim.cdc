import "Fractional"

transaction(
  programId: String,
  amount: UFix64
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.payoutClaimed(
      programId: programId,
      account: signer.address,
      amount: amount
    )
  }
}




