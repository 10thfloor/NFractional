import "NonFungibleToken"
import "FungibleToken"
import "Fractional"
import "VaultShareToken"

// One-shot dual-authorizer: user deposits NFT to custody, admin creates vault metadata,
// user ensures share receiver setup for the concrete per‑vault FT, admin optionally sets max supply,
// and admin mints initial shares to the user.
//
// The VaultShareToken import is expected to be aliased at send-time to the concrete series contract
// for the given vaultId/symbol (e.g., import MySeries as VaultShareToken from 0xADMIN).
transaction(
  vaultId: String,
  collectionStoragePath: String,
  collectionPublicPath: String,
  tokenId: UInt64,
  shareSymbol: String,
  policy: String,
  maxSupply: UFix64?,
  initialMint: UFix64,
  ftAddress: Address,
  ftContractName: String,
  vaultStoragePathIdentifier: String,
  receiverPublicPathIdentifier: String,
  balancePublicPathIdentifier: String
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
    admin: auth(
      BorrowValue,
      IssueStorageCapabilityController,
      SaveValue,
      PublishCapability,
      UnpublishCapability,
      Storage
    ) &Account
  ) {
    // 1) Determine if user still holds the NFT in public collection

    // If the user's public collection no longer contains the token, assume it's already deposited and skip
    let pubPath: PublicPath = PublicPath(identifier: collectionPublicPath)!
    var shouldDeposit: Bool = true
   let pubCap: Capability<&{NonFungibleToken.CollectionPublic}> =
  user.capabilities.get<&{NonFungibleToken.CollectionPublic}>(pubPath)

    if pubCap.check() {
      let pubRef = pubCap.borrow() ?? panic("public collection capability not borrowable")
      let ids: [UInt64] = pubRef.getIDs()

      var found: Bool = false
      var i: Int = 0
      while i < ids.length {
        if ids[i] == tokenId { found = true; break }
        i = i + 1
      }
      if !found { shouldDeposit = false }
    }

    // (Withdraw and deposit handled after vault metadata creation into LockBox)

    // 2) Admin: create vault metadata (LockBox policy)
    let adminRef: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")
    var didCreateVault: Bool = false
    if Fractional.getVault(vaultId: vaultId) == nil {
      adminRef.createVaultFromNFT(
        vaultId: vaultId,
        collectionStoragePath: collectionStoragePath,
        collectionPublicPath: collectionPublicPath,
        tokenId: tokenId,
        shareSymbol: shareSymbol,
        policy: "lockbox",
        creator: user.address
      )
      didCreateVault = true
    }

    // 3) User: if needed, withdraw NFT and deposit into LockBox, emit event
    if shouldDeposit {
      let colStoragePath: StoragePath = StoragePath(identifier: collectionStoragePath)!
      let providerRef: auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider} = user.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Provider}>(from: colStoragePath)
        ?? panic("missing provider at storage path")
      let nft: @{NonFungibleToken.NFT} <- providerRef.withdraw(withdrawID: tokenId)
      if user.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox) == nil {
        user.storage.save(<- Fractional.createLockBox(), to: /storage/FractionalLockBox)
      }
      let _: Capability? = user.capabilities.unpublish(Fractional.LockBoxPublicPath)
      user.capabilities.publish(
        user.capabilities.storage.issue<&{Fractional.LockBoxPublic}>(/storage/FractionalLockBox),
        at: Fractional.LockBoxPublicPath
      )
      let lb: &Fractional.LockBox = user.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox)!
      lb.deposit(vaultId: vaultId, nft: <- nft)
      adminRef.emitUnderlyingDeposited(
        vaultId: vaultId,
        collectionStoragePath: collectionStoragePath,
        collectionPublicPath: collectionPublicPath,
        tokenId: tokenId,
        nftType: "NonFungibleToken.NFT"
      )
    }

    // Register per‑vault FT to this vault now that it exists
    var didRegisterFT: Bool = false
    if Fractional.getVaultFT(vaultId: vaultId) == nil {
      adminRef.setVaultFT(
        vaultId: vaultId,
        ftAddress: ftAddress,
        ftContractName: ftContractName,
        vaultStoragePathIdentifier: vaultStoragePathIdentifier,
        receiverPublicPathIdentifier: receiverPublicPathIdentifier,
        balancePublicPathIdentifier: balancePublicPathIdentifier
      )
      didRegisterFT = true
    }
  
    // 4) User: ensure share vault & receiver/balance caps for the per‑vault FT
    let shareStoragePath: StoragePath = VaultShareToken.getVaultStoragePath()
    let shareReceiverPath: PublicPath = VaultShareToken.getReceiverPublicPath()
    let shareBalancePath: PublicPath = VaultShareToken.getBalancePublicPath()

    if user.storage.borrow<&VaultShareToken.Vault>(from: shareStoragePath) == nil {
      let any: @{FungibleToken.Vault} <- VaultShareToken.createEmptyVault(vaultType: Type<@VaultShareToken.Vault>())
      let v: @VaultShareToken.Vault <- any as! @VaultShareToken.Vault
      user.storage.save(<- v, to: shareStoragePath)
    }

    // Publish receiver if missing
    let recvCapExisting = user.capabilities.get<&{FungibleToken.Receiver}>(shareReceiverPath)
    if recvCapExisting == nil || !(recvCapExisting!.check()) {
      let _ru: Capability? = user.capabilities.unpublish(shareReceiverPath)
      user.capabilities.publish(
        user.capabilities.storage.issue<&{FungibleToken.Receiver}>(shareStoragePath),
        at: shareReceiverPath
      )
    }
    // Publish balance if missing
    let balCapExisting = user.capabilities.get<&VaultShareToken.Vault>(shareBalancePath)
    if balCapExisting == nil || !(balCapExisting!.check()) {
      let _bu: Capability? = user.capabilities.unpublish(shareBalancePath)
      user.capabilities.publish(
        user.capabilities.storage.issue<&VaultShareToken.Vault>(shareStoragePath),
        at: shareBalancePath
      )
    }

    // 5) Admin: optional max supply, and mint initial shares to user
    if maxSupply != nil {
      if let v = Fractional.getVault(vaultId: vaultId) {
        if v.maxSupply == nil { adminRef.setMaxSupply(vaultId: vaultId, maxSupply: maxSupply!) }
      }
    }

    // Mint only on first registration to avoid duplicate mint from retries
    if initialMint > 0.0 && didRegisterFT {
      let adminToken = VaultShareToken.borrowAdmin() ?? panic("missing VaultShareToken.Admin")
      let recvCap = user.capabilities.get<&{FungibleToken.Receiver}>(shareReceiverPath)
      if !recvCap.check() { panic("user receiver not linked") }
      let receiver = recvCap.borrow() ?? panic("user receiver missing")
      adminToken.mint(to: receiver, amount: initialMint)

      // Optional convenience: emit Fractional-level SharesMinted for indexers
      adminRef.emitSharesMinted(symbol: shareSymbol, accounts: [user.address], amounts: [initialMint])
    }
  }
}


