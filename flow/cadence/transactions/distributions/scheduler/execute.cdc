import "FungibleToken"
import "FungibleTokenConnectors"
import "Fractional"
// VaultShareToken import will be aliased dynamically by off-chain service
import "VaultShareToken"

// Recipient struct for distribution (only address, amounts calculated evenly)
access(all) struct Recipient {
  access(all) let Address: Address
  
  access(all) init(Address: Address) {
    self.Address = Address
  }
}

// Execute distribution: distribute shares evenly from escrow to recipients
transaction(
  programId: String,
  vaultId: String,
  totalAmount: UFix64,
  recipients: [Recipient]
) {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability, Storage) &Account) {
    // Validate we have recipients
    if recipients.length == 0 {
      panic("no recipients provided")
    }
    
    // Get vault FT metadata
    let ftMeta: {String: String}? = Fractional.getVaultFT(vaultId: vaultId)
    if ftMeta == nil { panic("vault FT not registered") }
    
    let ftContractName: String = ftMeta!["name"]!
    let receiverPathIdentifier: String = ftMeta!["receiver"]!
    let vaultReceiverPath: PublicPath = PublicPath(identifier: receiverPathIdentifier)!
    
    // Distribution escrow path: DistributionEscrow_<CONTRACT_NAME>_<programId>
    let escrowStorageIdent: String = "DistributionEscrow_".concat(ftContractName).concat("_").concat(programId)
    let escrowStoragePath: StoragePath = StoragePath(identifier: escrowStorageIdent)!
    
    // Verify escrow has sufficient balance (safety check)
    let escrowVault: &{FungibleToken.Vault} = admin.storage.borrow<&{FungibleToken.Vault}>(from: escrowStoragePath)
      ?? panic("distribution escrow not found")
    
    if escrowVault.balance < totalAmount {
      panic("insufficient escrow balance")
    }
    
    // Calculate amount per recipient (even division)
    let amountPerRecipient: UFix64 = totalAmount / UFix64(recipients.length)
    
    // Distribute shares to recipients
    var i = 0
    while i < recipients.length {
      let recipient: Address = recipients[i].Address
      
      // Withdraw from distribution escrow
      let escrowWithdrawCap: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}> =
        admin.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(escrowStoragePath)
      let source: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(
        min: amountPerRecipient,
        withdrawVault: escrowWithdrawCap,
        uniqueID: nil
      )
      
      // Get recipient receiver
      let recipientRecv: Capability<&{FungibleToken.Vault}> = getAccount(recipient)
        .capabilities.get<&{FungibleToken.Vault}>(vaultReceiverPath)
      if recipientRecv == nil {
        panic("recipient receiver not set up")
      }
      let sink: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(
        max: nil,
        depositVault: recipientRecv,
        uniqueID: nil
      )
      
      let shares: @{FungibleToken.Vault} <- source.withdrawAvailable(maxAmount: amountPerRecipient)
      sink.depositCapacity(from: &shares as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
      destroy shares
      
      // Emit claim event
      let fractionalAdmin: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) ?? panic("missing admin")
      fractionalAdmin.payoutClaimed(
        programId: programId,
        account: recipient,
        amount: amountPerRecipient
      )
      
      i = i + 1
    }
  }
}

