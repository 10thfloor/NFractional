import FlowTransactionScheduler from "FlowTransactionScheduler"
import Fractional from "Fractional"

access(all) contract FeeParamsActivatorHandler {

    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(all) fun handle(data: {String: String}) {
            let vaultId: String = data["vaultId"] ?? panic("missing vaultId")

            let ownerAddr: Address = self.owner?.address ?? 0x0
            let cap: Capability<&{Fractional.FeeActivation}> = getAccount(ownerAddr).capabilities.get<&{Fractional.FeeActivation}>(Fractional.FeeActivatorPublicPath)
            let ref: &{Fractional.FeeActivation} = cap.borrow() ?? panic("missing FeeActivator cap")
            ref.activate(vaultId: vaultId)
        }
    }

    access(all) fun createHandler(): @Handler { return <- create Handler() }
}


