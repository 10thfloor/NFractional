import "Fractional"

transaction(
  symbol: String,
  mode: String
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.setTransferMode(symbol: symbol, mode: mode)
  }
}


