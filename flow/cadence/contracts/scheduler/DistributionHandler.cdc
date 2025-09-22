import FlowTransactionScheduler from "FlowTransactionScheduler"
import Fractional from "Fractional"

access(all) contract DistributionHandler {

    access(all) event DistributionExecutionTriggered(
        programId: String,
        vaultId: String
    )

    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(all) fun handle(data: {String: String}) {
            let programId: String = data["programId"] ?? panic("missing programId")
            let vaultId: String = data["vaultId"] ?? panic("missing vaultId")

            // Emit event that off-chain service listens to
            emit DistributionExecutionTriggered(programId: programId, vaultId: vaultId)
        }
    }

    access(all) fun createHandler(): @Handler { return <- create Handler() }
}

