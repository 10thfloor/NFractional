import "FungibleToken"

access(all) fun main(addr: Address, symbol: String): Bool {
    let account = getAccount(addr)
    let receiverPath = PublicPath(identifier: "receiver_".concat(symbol))!
    let cap = account.capabilities.get<&{FungibleToken.Receiver}>(receiverPath)
    return cap.check()
}


