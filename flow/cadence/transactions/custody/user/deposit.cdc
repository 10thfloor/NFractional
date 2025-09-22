import "NonFungibleToken"
import "Fractional"

transaction(collectionStoragePath: String, tokenId: UInt64, vaultId: String) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, PublishCapability, UnpublishCapability, Storage) &Account) {
    let storagePath: StoragePath = StoragePath(identifier: collectionStoragePath)!
    let providerRef: auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider} = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider}>(from: storagePath)
      ?? panic("missing provider with withdraw at storage path")
    let nft: @{NonFungibleToken.NFT} <- providerRef.withdraw(withdrawID: tokenId)

    if signer.storage.borrow<&Fractional.Custody>(from: /storage/FractionalCustody) == nil {
      signer.storage.save(<- Fractional.createCustody(), to: /storage/FractionalCustody)
    }
    let _ = signer.capabilities.unpublish(Fractional.CustodyPublicPath)
    signer.capabilities.publish(
      signer.capabilities.storage.issue<&{Fractional.CustodyPublic}>(/storage/FractionalCustody),
      at: Fractional.CustodyPublicPath
    )
    let custody: &Fractional.Custody = signer.storage.borrow<&Fractional.Custody>(from: /storage/FractionalCustody)
      ?? panic("custody not found")
    custody.deposit(vaultId: vaultId, nft: <-nft)
    let _res = custody.borrowViewResolver(vaultId: vaultId) ?? panic("resolver not available after deposit")
  }
}


