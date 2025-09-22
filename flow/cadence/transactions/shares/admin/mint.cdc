import "FungibleToken"
import "VaultShareToken"

// Mint VaultShareToken to a recipient using the contract Admin
// Requires that the VaultShareToken contract's Admin resource exists in contract storage
// and that the recipient has set up their VaultShareToken vault and receiver capability.
transaction(recipient: Address, amount: UFix64) {
    prepare(signer: auth(Storage) &Account) {
        let adminRef = VaultShareToken.borrowAdmin() ?? panic("missing VaultShareToken.Admin")
        let recv: Capability<&{FungibleToken.Receiver}> = getAccount(recipient)
            .capabilities.get<&{FungibleToken.Receiver}>(VaultShareToken.getReceiverPublicPath())
        adminRef.mint(to: recv.borrow() ?? panic("recipient receiver missing"), amount: amount)
    }
}
