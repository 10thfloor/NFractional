import "NonFungibleToken"
import "Fractional"

// User submits an owned NFT for fractionalization with platform admin co-signing.
// Authorizer order: user first, admin second.
transaction(
  vaultId: String,
  collectionStoragePath: String,
  collectionPublicPath: String,
  tokenId: UInt64,
  shareSymbol: String,
  policy: String
) {
  prepare(
    user: auth(
      BorrowValue,
      SaveValue,
      Storage,
      Capabilities,
      IssueStorageCapabilityController,
      PublishCapability,
      UnpublishCapability
    ) &Account,
    admin: auth(Storage) &Account
  ) {
    let storagePath: StoragePath = StoragePath(identifier: collectionStoragePath)!

    // Withdraw user's NFT
    let providerRef: auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider} = user.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider}>(from: storagePath)
      ?? panic("missing provider at storage path")
    let nft: @{NonFungibleToken.NFT} <- providerRef.withdraw(withdrawID: tokenId)

    // Create vault metadata via admin (when using lockbox we must create first to pass deposit validation)
    let adminRef: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")

    // Always use LockBox custody (default)
    adminRef.createVaultFromNFT(
      vaultId: vaultId,
      collectionStoragePath: collectionStoragePath,
      collectionPublicPath: collectionPublicPath,
      tokenId: tokenId,
      shareSymbol: shareSymbol,
      policy: "lockbox",
      creator: user.address
    )

    // Ensure LockBox exists and publish public capability
    if user.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox) == nil {
      user.storage.save(<- Fractional.createLockBox(), to: /storage/FractionalLockBox)
    }
    let _: Capability? = user.capabilities.unpublish(Fractional.LockBoxPublicPath)
    user.capabilities.publish(
      user.capabilities.storage.issue<&{Fractional.LockBoxPublic}>(/storage/FractionalLockBox),
      at: Fractional.LockBoxPublicPath
    )
    let lb: &Fractional.LockBox = user.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox)!
    lb.deposit(vaultId: vaultId, nft: <-nft)
    adminRef.emitUnderlyingDeposited(
      vaultId: vaultId,
      collectionStoragePath: collectionStoragePath,
      collectionPublicPath: collectionPublicPath,
      tokenId: tokenId,
      nftType: "NonFungibleToken.NFT"
    )
  }
}




