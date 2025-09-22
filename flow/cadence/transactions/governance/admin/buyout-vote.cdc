import "Fractional"

transaction(
  vaultId: String,
  proposalId: String,
  forVotes: UFix64,
  againstVotes: UFix64
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.voteBuyout(
      vaultId: vaultId,
      proposalId: proposalId,
      forVotes: forVotes,
      againstVotes: againstVotes
    )
  }
}




