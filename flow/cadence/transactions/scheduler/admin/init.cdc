import Fractional from "Fractional"
import FlowTransactionScheduler from "FlowTransactionScheduler"
import FlowTransactionSchedulerUtils from "FlowTransactionSchedulerUtils"
import FeeParamsActivatorHandler from "FeeParamsActivatorHandler"

// Admin init: publish FeeActivator cap and create scheduler Manager + handler
transaction {
    prepare(admin: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, PublishCapability, UnpublishCapability) &Account) {
        // Ensure FeeActivator exists and publish restricted cap
        if admin.storage.borrow<&Fractional.FeeActivator>(from: Fractional.FeeActivatorStoragePath) == nil {
            let a: @Fractional.FeeActivator <- Fractional.createFeeActivator()
            admin.storage.save(<-a, to: Fractional.FeeActivatorStoragePath)
        }
        // Re-publish public cap (idempotent)
        let _: Capability? = admin.capabilities.unpublish(Fractional.FeeActivatorPublicPath)
        // Publish concrete type; borrowers can request the restricted interface &{Fractional.FeeActivation}
        admin.capabilities.publish(
            admin.capabilities.storage.issue<&Fractional.FeeActivator>(Fractional.FeeActivatorStoragePath),
            at: Fractional.FeeActivatorPublicPath
        )

        // Create or replace Manager
        if admin.storage.borrow<&FlowTransactionSchedulerUtils.Manager>(from: /storage/TxSchedulerManager) == nil {
            let m: @FlowTransactionSchedulerUtils.Manager <- FlowTransactionSchedulerUtils.createManager()
            admin.storage.save(<-m, to: /storage/TxSchedulerManager)
        }

        // Create handler resource and store once (idempotent)
        if admin.storage.borrow<&FeeParamsActivatorHandler.Handler>(from: /storage/FeeParamsActivatorHandler) == nil {
            let h: @FeeParamsActivatorHandler.Handler <- FeeParamsActivatorHandler.createHandler()
            admin.storage.save(<-h, to: /storage/FeeParamsActivatorHandler)
        }

        // Wire handler into manager using admin's published public path
        let mRef: &FlowTransactionSchedulerUtils.Manager = admin.storage.borrow<&FlowTransactionSchedulerUtils.Manager>(from: /storage/TxSchedulerManager) ?? panic("missing manager")
        // Publish a public capability for the handler if not present
        let _capHandlerUnpub: Capability? = admin.capabilities.unpublish(/public/FeeParamsActivatorHandler)
        admin.capabilities.publish(
            admin.capabilities.storage.issue<&FeeParamsActivatorHandler.Handler>(/storage/FeeParamsActivatorHandler),
            at: /public/FeeParamsActivatorHandler
        )
        mRef.setHandler(owner: admin.address, pathIdentifier: "FeeParamsActivatorHandler")
    }
}


