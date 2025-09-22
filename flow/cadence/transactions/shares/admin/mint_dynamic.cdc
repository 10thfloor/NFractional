import "FungibleToken"
import "VaultShareToken"

// Mint per‑vault FT to a recipient using the contract Admin
transaction(recipient: Address, amount: UFix64) {
  prepare(signer: auth(Storage) &Account) {
    let adminRef = VaultShareToken.borrowAdmin() ?? panic("missing Admin")
    let recv: Capability<&{FungibleToken.Receiver}> = getAccount(recipient)
      .capabilities.get<&{FungibleToken.Receiver}>(VaultShareToken.getReceiverPublicPath())
    adminRef.mint(to: recv.borrow() ?? panic("recipient receiver missing"), amount: amount)
  }
}


