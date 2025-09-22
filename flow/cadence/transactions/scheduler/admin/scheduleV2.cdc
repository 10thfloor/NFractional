import FlowTransactionScheduler from "FlowTransactionScheduler"
import FlowTransactionSchedulerUtilsV2 from "FlowTransactionSchedulerUtilsV2"

// Official-style schedule tx: delaySeconds -> timestamp, priority, effort, data
transaction(delaySeconds: UFix64, priority: UInt8, executionEffort: UInt64, vaultId: String) {
    prepare(admin: auth(BorrowValue) &Account) {
        // Compute timestamp baseline: in emulator we can approximate using delaySeconds
        let now: UFix64 = 0.0 // emulator shim; ManagerImpl ignores timestamp and executes immediately
        let ts: UFix64 = now + delaySeconds

        let mRef: &FlowTransactionSchedulerUtilsV2.ManagerImpl = admin.storage.borrow<&FlowTransactionSchedulerUtilsV2.ManagerImpl>(from: FlowTransactionSchedulerUtilsV2.managerStoragePath)
            ?? panic("missing manager V2")

        let handlerCap: Capability<&{FlowTransactionScheduler.TransactionHandler}> =
            admin.capabilities.get<&{FlowTransactionScheduler.TransactionHandler}>(/public/FeeParamsActivatorHandlerV2)

        let data: {String: String} = {"vaultId": vaultId}
        let _id: UInt64 = mRef.schedule(
            handlerCap: handlerCap,
            data: data,
            timestamp: ts,
            priority: priority,
            executionEffort: executionEffort
        )
    }
}


