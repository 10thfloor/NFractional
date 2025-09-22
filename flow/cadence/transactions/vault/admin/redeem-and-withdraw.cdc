import "NonFungibleToken"
import "Fractional"

// NOTE: This transaction assumes all outstanding shares have been burned
// prior to execution. It sets the vault state to redeemed and withdraws
// the underlying NFT from the custodian's LockBox, depositing it back
// to the custodian's original collection path recorded in the vault.
// Authorizer order: admin first, then custodian.
transaction(
  vaultId: String
) {
  prepare(
    admin: auth(Storage) &Account,
    custodian: auth(BorrowValue, Storage, Capabilities) &Account
  ) {
    let adminRef: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing admin")

    // Borrow LockBox from the custodian's storage
    let lb: &Fractional.LockBox = custodian.storage.borrow<&Fractional.LockBox>(from: /storage/FractionalLockBox)
      ?? panic("missing LockBox")

    // Redeem and pull NFT out of LockBox
    // NOTE: Caller must ensure total supply has been burned; pass 0.0 to assert
    let nft: @{NonFungibleToken.NFT} <- adminRef.redeemAndWithdraw(lockbox: lb, vaultId: vaultId, declaredTotalSupply: 0.0)

    // Read target collection path from vault metadata
    let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
    let storagePath: StoragePath = StoragePath(identifier: v.collectionStoragePath)!

    // Deposit NFT back to the custodian's collection
    let receiver: &{NonFungibleToken.Receiver} = custodian.storage.borrow<&{NonFungibleToken.Receiver}>(from: storagePath)
      ?? panic("recipient collection missing")
    receiver.deposit(token: <- nft)
  }
}


