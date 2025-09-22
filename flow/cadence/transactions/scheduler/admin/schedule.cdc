import FlowTransactionSchedulerUtils from "FlowTransactionSchedulerUtils"

// Enqueue/Execute scheduled activation (emulator: executes immediately via Manager.invoke).
// On mainnet, this would be created by a scheduler with an execution time.
transaction(vaultId: String) {
    prepare(admin: auth(BorrowValue) &Account) {
        let mRef: &FlowTransactionSchedulerUtils.Manager =
            admin.storage.borrow<&FlowTransactionSchedulerUtils.Manager>(from: /storage/TxSchedulerManager)
            ?? panic("missing manager")

        let data: {String: String} = {"vaultId": vaultId}
        mRef.invoke(data: data)
    }
}


