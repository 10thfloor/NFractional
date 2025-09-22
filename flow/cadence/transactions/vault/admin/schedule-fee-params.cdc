import "Fractional"

transaction(vaultId: String, feeBps: UInt64, vaultSplitBps: UInt64, protocolSplitBps: UInt64, effectiveAt: UInt64) {
  prepare(admin: auth(Storage) &Account) {
    let ref: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    ref.scheduleFeeParams(vaultId: vaultId, feeBps: feeBps, vaultSplitBps: vaultSplitBps, protocolSplitBps: protocolSplitBps, effectiveAt: effectiveAt)
  }
}


