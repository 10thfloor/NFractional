import "Fractional"

transaction(symbol: String, accounts: [Address], amounts: [UFix64]) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.emitSharesMinted(symbol: symbol, accounts: accounts, amounts: amounts)
  }
}


