import "Fractional"

transaction(
  symbol: String,
  from: Address,
  to: Address,
  amount: UFix64
) {
  prepare(signer: auth(Storage) &Account) {
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.transfer(symbol: symbol, from: from, to: to, amount: amount)
  }
}




