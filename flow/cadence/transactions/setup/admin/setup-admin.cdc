import "Fractional"
import "FlowToken"
import "FlowTransactionSchedulerUtilsV2"
import "FeeParamsActivatorHandlerV2"
import "FungibleToken"

transaction {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability, Storage) &Account) {
    if signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin) == nil {
      signer.storage.save(<-Fractional.createAdmin(), to: /storage/FractionalAdmin)
    }

    // Initialize Platform Treasury FLOW vault and publish receiver cap (idempotent)
    if signer.storage.borrow<&FlowToken.Vault>(from: /storage/PlatformTreasury_FLOW) == nil {
      let v: @FlowToken.Vault <- FlowToken.createEmptyVault(vaultType: Type<@FlowToken.Vault>())
      signer.storage.save(<-v, to: /storage/PlatformTreasury_FLOW)
    }
    let _: Capability? = signer.capabilities.unpublish(/public/PlatformTreasury_FLOW)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&FlowToken.Vault>(/storage/PlatformTreasury_FLOW),
      at: /public/PlatformTreasury_FLOW
    )

    // One-time funding: transfer 1000.00 FLOW from admin flow vault to PlatformTreasury (idempotent top-up)
    let platRef: &FlowToken.Vault = signer.storage.borrow<&FlowToken.Vault>(from: /storage/PlatformTreasury_FLOW)
      ?? panic("platform treasury missing after setup")
    if platRef.balance == 0.0 {
      let withdrawRef: auth(FungibleToken.Withdraw) &FlowToken.Vault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
        ?? panic("admin flowTokenVault missing; fund the admin first")

      // Transfer 1000.00 FLOW from admin flow vault to PlatformTreasury
      let amount: UFix64 = 1000.0
      
      let payment: @{FungibleToken.Vault} <- withdrawRef.withdraw(amount: amount)
      platRef.deposit(from: <-payment)
    }

    // Scheduler V2: ensure FeeActivator cap, Manager, and Handler are initialized (idempotent)
    if signer.storage.borrow<&Fractional.FeeActivator>(from: Fractional.FeeActivatorStoragePath) == nil {
      let a: @Fractional.FeeActivator <- Fractional.createFeeActivator()
      signer.storage.save(<-a, to: Fractional.FeeActivatorStoragePath)
    }
    let _fa: Capability? = signer.capabilities.unpublish(Fractional.FeeActivatorPublicPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&Fractional.FeeActivator>(Fractional.FeeActivatorStoragePath),
      at: Fractional.FeeActivatorPublicPath
    )

    if signer.storage.borrow<&FlowTransactionSchedulerUtilsV2.ManagerImpl>(from: FlowTransactionSchedulerUtilsV2.managerStoragePath) == nil {
      let m: @FlowTransactionSchedulerUtilsV2.ManagerImpl <- FlowTransactionSchedulerUtilsV2.createManager()
      signer.storage.save(<-m, to: FlowTransactionSchedulerUtilsV2.managerStoragePath)
    }
    let _mp: Capability? = signer.capabilities.unpublish(FlowTransactionSchedulerUtilsV2.managerPublicPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&FlowTransactionSchedulerUtilsV2.ManagerImpl>(FlowTransactionSchedulerUtilsV2.managerStoragePath),
      at: FlowTransactionSchedulerUtilsV2.managerPublicPath
    )

    if signer.storage.borrow<&FeeParamsActivatorHandlerV2.Handler>(from: /storage/FeeParamsActivatorHandlerV2) == nil {
      let h: @FeeParamsActivatorHandlerV2.Handler <- FeeParamsActivatorHandlerV2.createHandler()
      signer.storage.save(<-h, to: /storage/FeeParamsActivatorHandlerV2)
    }
    let _hp: Capability? = signer.capabilities.unpublish(/public/FeeParamsActivatorHandlerV2)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&FeeParamsActivatorHandlerV2.Handler>(/storage/FeeParamsActivatorHandlerV2),
      at: /public/FeeParamsActivatorHandlerV2
    )
  }
}




