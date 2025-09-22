import "Fractional"

transaction(
  vaultId: String,
  proposalId: String,
  asset: String,
  amount: UFix64,
  quorumPercent: UInt64,
  supportPercent: UInt64,
  expiresAt: UInt64
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.proposeBuyout(
      vaultId: vaultId,
      proposalId: proposalId,
      asset: asset,
      amount: amount,
      quorumPercent: quorumPercent,
      supportPercent: supportPercent,
      expiresAt: expiresAt
    )
  }
}




