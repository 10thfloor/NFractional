import "FungibleToken"
import "FlowToken"

// Transfers FLOW from the signer to the specified recipient
// Arguments:
// - to: Address of the recipient (must have a FlowToken Receiver published)
// - amount: UFix64 amount to transfer (e.g., 1000.00)
transaction(to: Address, amount: UFix64) {
    prepare(signer: auth(BorrowValue) &Account) {
        // Borrow an authorized reference with the Withdraw entitlement in Cadence 1.0
        let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Missing FlowToken Vault for signer")

        let receiver = getAccount(to)
            .capabilities
            .get<&{FungibleToken.Receiver}>(/public/flowTokenReceiver)
            .borrow()
            ?? panic("Recipient missing FlowToken Receiver capability")

        let payment <- vaultRef.withdraw(amount: amount)
        receiver.deposit(from: <-payment)
    }
}


