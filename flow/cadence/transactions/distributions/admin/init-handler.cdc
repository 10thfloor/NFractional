import FlowTransactionSchedulerUtilsV2 from "FlowTransactionSchedulerUtilsV2"
import DistributionHandler from "DistributionHandler"

transaction {
  prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability) &Account) {
    // Ensure manager exists
    if admin.storage.borrow<&FlowTransactionSchedulerUtilsV2.ManagerImpl>(from: FlowTransactionSchedulerUtilsV2.managerStoragePath) == nil {
      let m: @FlowTransactionSchedulerUtilsV2.ManagerImpl <- FlowTransactionSchedulerUtilsV2.createManager()
      admin.storage.save(<-m, to: FlowTransactionSchedulerUtilsV2.managerStoragePath)
      let _: Capability? = admin.capabilities.unpublish(FlowTransactionSchedulerUtilsV2.managerPublicPath)
      admin.capabilities.publish(
        admin.capabilities.storage.issue<&FlowTransactionSchedulerUtilsV2.ManagerImpl>(FlowTransactionSchedulerUtilsV2.managerStoragePath),
        at: FlowTransactionSchedulerUtilsV2.managerPublicPath
      )
    }

    // Ensure handler exists and publish public cap
    if admin.storage.borrow<&DistributionHandler.Handler>(from: /storage/DistributionHandler) == nil {
      let h: @DistributionHandler.Handler <- DistributionHandler.createHandler()
      admin.storage.save(<-h, to: /storage/DistributionHandler)
    }
    let _capUnpub: Capability? = admin.capabilities.unpublish(/public/DistributionHandler)
    admin.capabilities.publish(
      admin.capabilities.storage.issue<&DistributionHandler.Handler>(/storage/DistributionHandler),
      at: /public/DistributionHandler
    )
  }
}

