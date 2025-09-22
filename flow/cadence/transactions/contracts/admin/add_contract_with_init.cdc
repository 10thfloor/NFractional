transaction(name: String, codeHex: String, initName: String, initSymbol: String, initDecimals: UInt8, initMaxSupply: UFix64?) {
  prepare(signer: auth(Contracts) &Account) {
    signer.contracts.add(
      name: name,
      code: codeHex.decodeHex(),
      initName,
      initSymbol,
      initDecimals,
      initMaxSupply
    )
  }
}


