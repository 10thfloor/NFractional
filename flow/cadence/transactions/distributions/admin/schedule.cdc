import "Fractional"
import "FungibleToken"
import FlowTransactionScheduler from "FlowTransactionScheduler"
import FlowTransactionSchedulerUtilsV2 from "FlowTransactionSchedulerUtilsV2"
import DistributionHandler from "DistributionHandler"
// VaultShareToken import will be aliased dynamically
import "VaultShareToken"

transaction(
  vaultId: String,
  programId: String,
  asset: String,
  totalAmount: UFix64,
  schedule: String,
  startsAt: UInt64,
  endsAt: UInt64
) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    // Get vault FT metadata to determine contract name for escrow path
    let ftMeta: {String: String}? = Fractional.getVaultFT(vaultId: vaultId)
    if ftMeta == nil { panic("vault FT not registered") }
    
    let ftContractName: String = ftMeta!["name"]!
    
    // Distribution escrow path: DistributionEscrow_<CONTRACT_NAME>_<programId>
    let escrowStorageIdent: String = "DistributionEscrow_".concat(ftContractName).concat("_").concat(programId)
    let escrowStoragePath: StoragePath = StoragePath(identifier: escrowStorageIdent)!
    let escrowPublicPath: PublicPath = PublicPath(identifier: escrowStorageIdent)!
    
    // Ensure distribution escrow vault exists
    if signer.storage.borrow<&{FungibleToken.Vault}>(from: escrowStoragePath) == nil {
      let empty: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      signer.storage.save(<-empty, to: escrowStoragePath)
    }
    
    // Publish receiver capability for escrow (needed for minting into it)
    let _: Capability? = signer.capabilities.unpublish(escrowPublicPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&{FungibleToken.Receiver}>(escrowStoragePath),
      at: escrowPublicPath
    )
    
    // Mint totalAmount into distribution escrow
    // This will fail if it would exceed maxSupply (max supply check happens here)
    let adminRef = VaultShareToken.borrowAdmin() ?? panic("missing VaultShareToken.Admin")
    let escrowRecv: Capability<&{FungibleToken.Vault}>? = signer.capabilities.get<&{FungibleToken.Vault}>(escrowPublicPath)
    if escrowRecv == nil {
      panic("escrow receiver capability missing")
    }
    
    adminRef.mint(to: escrowRecv!.borrow() ?? panic("escrow receiver missing"), amount: totalAmount)
    
    // Emit DistributionScheduled event
    let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    admin.scheduleDistribution(
      vaultId: vaultId,
      programId: programId,
      asset: asset,
      totalAmount: totalAmount,
      schedule: schedule,
      startsAt: startsAt,
      endsAt: endsAt
    )
    
    // Create scheduled transaction for execution at startsAt
    let mRef: &FlowTransactionSchedulerUtilsV2.ManagerImpl = signer.storage.borrow<&FlowTransactionSchedulerUtilsV2.ManagerImpl>(from: FlowTransactionSchedulerUtilsV2.managerStoragePath)
      ?? panic("missing scheduler manager")
    
    let handlerCap: Capability<&{FlowTransactionScheduler.TransactionHandler}>? =
      signer.capabilities.get<&{FlowTransactionScheduler.TransactionHandler}>(/public/DistributionHandler)
    if handlerCap == nil {
      panic("missing DistributionHandler capability")
    }
    
    let data: {String: String} = {
      "programId": programId,
      "vaultId": vaultId
    }
    
    // Convert startsAt (UInt64 timestamp) to UFix64 for scheduler
    let timestamp: UFix64 = UFix64(startsAt)
    
    let _id: UInt64 = mRef.schedule(
      handlerCap: handlerCap!,
      data: data,
      timestamp: timestamp,
      priority: 0,
      executionEffort: 1000
    )
  }
}




