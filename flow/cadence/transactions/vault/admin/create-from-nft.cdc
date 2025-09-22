import "NonFungibleToken"
import "Fractional"

transaction(
  vaultId: String,
  collectionStoragePath: String,
  collectionPublicPath: String,
  tokenId: UInt64,
  shareSymbol: String,
  policy: String
) {
    prepare(signer: auth(BorrowValue, SaveValue, Storage, Capabilities) &Account) {
        let storagePath: StoragePath = StoragePath(identifier: collectionStoragePath)!
        let providerRef: auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider} = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider}>(from: storagePath)
            ?? panic("missing provider at storage path")
        let nft: @{NonFungibleToken.NFT} <- providerRef.withdraw(withdrawID: tokenId)
        // Create vault metadata first when using lockbox to satisfy deposit validation
        let admin: &Fractional.Admin = signer.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
            ?? panic("missing admin")
        // Always use LockBox custody (default)
        admin.createVaultFromNFT(
          vaultId: vaultId,
          collectionStoragePath: collectionStoragePath,
          collectionPublicPath: collectionPublicPath,
          tokenId: tokenId,
          shareSymbol: shareSymbol,
          policy: "lockbox",
          creator: signer.address
        )

        if signer.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox) == nil {
            signer.storage.save(<- Fractional.createLockBox(), to: /storage/FractionalLockBox)
        }
        let _: Capability? = signer.capabilities.unpublish(Fractional.LockBoxPublicPath)
        signer.capabilities.publish(
            signer.capabilities.storage.issue<&{Fractional.LockBoxPublic}>(/storage/FractionalLockBox),
            at: Fractional.LockBoxPublicPath
        )
        let lb: &Fractional.LockBox = signer.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox)!
        lb.deposit(vaultId: vaultId, nft: <-nft)

        admin.emitUnderlyingDeposited(
          vaultId: vaultId,
          collectionStoragePath: collectionStoragePath,
          collectionPublicPath: collectionPublicPath,
          tokenId: tokenId,
          nftType: "NonFungibleToken.NFT"
        )
    }
}


