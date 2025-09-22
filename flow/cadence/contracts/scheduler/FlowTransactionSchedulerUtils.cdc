import FlowTransactionScheduler from "FlowTransactionScheduler"

access(all) contract FlowTransactionSchedulerUtils {

    /// Minimal emulator-only Manager: stores handler owner address + public path identifier and invokes it.
        access(all) resource Manager {
            access(all) var handlerOwnerAddress: Address
            access(all) var handlerPathIdentifier: String

        init() {
            self.handlerOwnerAddress = 0x0
            self.handlerPathIdentifier = ""
        }

        access(all) fun setHandler(owner: Address, pathIdentifier: String) {
            self.handlerOwnerAddress = owner
            self.handlerPathIdentifier = pathIdentifier
        }

        access(all) fun invoke(data: {String: String}) {
            if self.handlerOwnerAddress == 0x0 { return }
            if self.handlerPathIdentifier.length == 0 { return }
            let cap: Capability<&{FlowTransactionScheduler.TransactionHandler}> =
                getAccount(self.handlerOwnerAddress).capabilities.get<&{FlowTransactionScheduler.TransactionHandler}>(PublicPath(identifier: self.handlerPathIdentifier)!)
            if let h: &{FlowTransactionScheduler.TransactionHandler} = cap.borrow() {
                h.handle(data: data)
            }
        }
    }

    access(all) fun createManager(): @Manager { return <- create Manager() }
}


