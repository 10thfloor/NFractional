access(all) contract FlowTransactionScheduler {

    /// Minimal emulator-only interface to model Scheduled Transactions handlers.
    access(all) resource interface TransactionHandler {
        access(all) fun handle(data: {String: String})
    }
}


