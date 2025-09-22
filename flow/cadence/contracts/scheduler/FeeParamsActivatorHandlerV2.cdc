import FlowTransactionScheduler from "FlowTransactionScheduler"
import Fractional from "Fractional"

access(all) contract FeeParamsActivatorHandlerV2 {

    access(all) resource Handler: FlowTransactionScheduler.TransactionHandler {
        access(all) fun handle(data: {String: String}) {
            let vId: String = data["vaultId"] ?? ""
            if vId.length == 0 { return }
            if Fractional.getPendingFeeParams(vaultId: vId) == nil { return }

            let ownerAddr: Address = self.owner?.address ?? panic("missing owner")
            let cap: Capability<&{Fractional.FeeActivation}> =
                getAccount(ownerAddr).capabilities.get<&{Fractional.FeeActivation}>(Fractional.FeeActivatorPublicPath)
            let ref: &{Fractional.FeeActivation} = cap.borrow() ?? panic("missing FeeActivator cap")
            ref.activate(vaultId: vId)
        }
    }

    access(all) fun createHandler(): @Handler { return <- create Handler() }
}


