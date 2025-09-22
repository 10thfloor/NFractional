import FlowTransactionScheduler from "FlowTransactionScheduler"

access(all) contract FlowTransactionSchedulerUtilsV2 {

    access(all) let managerStoragePath: StoragePath
    access(all) let managerPublicPath: PublicPath

    access(all) resource interface Manager {
        access(all) fun schedule(
            handlerCap: Capability<&{FlowTransactionScheduler.TransactionHandler}>,
            data: {String: String}?,
            timestamp: UFix64,
            priority: UInt8,
            executionEffort: UInt64
        ): UInt64
    }

    access(all) resource ManagerImpl: Manager {
        access(self) var nextId: UInt64

        init() {
            self.nextId = 1
        }

        access(all) fun schedule(
            handlerCap: Capability<&{FlowTransactionScheduler.TransactionHandler}>,
            data: {String: String}?,
            timestamp: UFix64,
            priority: UInt8,
            executionEffort: UInt64
        ): UInt64 {
            // Emulator shim: ignore timestamp/priority/effort and execute immediately
            let id: UInt64 = self.nextId
            self.nextId = self.nextId + 1

            if let h = handlerCap.borrow() {
                if data != nil { h.handle(data: data!) }
                else { h.handle(data: { }) }
            }
            return id
        }
    }

    access(all) fun createManager(): @ManagerImpl { return <- create ManagerImpl() }

    init() {
        self.managerStoragePath = /storage/TxSchedulerManagerV2
        self.managerPublicPath = /public/TxSchedulerManagerV2
    }
}


