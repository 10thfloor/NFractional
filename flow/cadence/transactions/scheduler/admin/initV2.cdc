import FlowTransactionSchedulerUtilsV2 from "FlowTransactionSchedulerUtilsV2"
import FeeParamsActivatorHandlerV2 from "FeeParamsActivatorHandlerV2"
import Fractional from "Fractional"

transaction {
    prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability) &Account) {
        // Ensure FeeActivator exists and publish restricted cap (for handler borrow)
        if admin.storage.borrow<&Fractional.FeeActivator>(from: Fractional.FeeActivatorStoragePath) == nil {
            let a: @Fractional.FeeActivator <- Fractional.createFeeActivator()
            admin.storage.save(<-a, to: Fractional.FeeActivatorStoragePath)
        }
        let _: Capability? = admin.capabilities.unpublish(Fractional.FeeActivatorPublicPath)
        admin.capabilities.publish(
            admin.capabilities.storage.issue<&Fractional.FeeActivator>(Fractional.FeeActivatorStoragePath),
            at: Fractional.FeeActivatorPublicPath
        )

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
        if admin.storage.borrow<&FeeParamsActivatorHandlerV2.Handler>(from: /storage/FeeParamsActivatorHandlerV2) == nil {
            let h: @FeeParamsActivatorHandlerV2.Handler <- FeeParamsActivatorHandlerV2.createHandler()
            admin.storage.save(<-h, to: /storage/FeeParamsActivatorHandlerV2)
        }
        let _capUnpub: Capability? = admin.capabilities.unpublish(/public/FeeParamsActivatorHandlerV2)
        admin.capabilities.publish(
            admin.capabilities.storage.issue<&FeeParamsActivatorHandlerV2.Handler>(/storage/FeeParamsActivatorHandlerV2),
            at: /public/FeeParamsActivatorHandlerV2
        )
    }
}


