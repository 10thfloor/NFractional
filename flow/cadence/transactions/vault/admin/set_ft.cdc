import "Fractional"

/// Registers the concrete FT contract for a vault's share token.
/// Must be called by the platform admin that holds `Fractional.Admin` in storage.
///
/// Args:
/// - vaultId: ID of the vault/series
/// - ftAddress: address where the FT contract is deployed
/// - ftContractName: contract name (at ftAddress) for the FT
/// - vaultStoragePathIdentifier: identifier for StoragePath (e.g., "vault_SYMBOL")
/// - receiverPublicPathIdentifier: identifier for PublicPath receiver (e.g., "receiver_SYMBOL")
/// - balancePublicPathIdentifier: identifier for PublicPath balance (e.g., "balance_SYMBOL")
transaction(
  vaultId: String,
  ftAddress: Address,
  ftContractName: String,
  vaultStoragePathIdentifier: String,
  receiverPublicPathIdentifier: String,
  balancePublicPathIdentifier: String
) {
  prepare(admin: auth(Storage) &Account) {
    let adminRef: &Fractional.Admin = admin.storage.borrow<&Fractional.Admin>(from: /storage/FractionalAdmin)
      ?? panic("missing Fractional.Admin")

    adminRef.setVaultFT(
      vaultId: vaultId,
      ftAddress: ftAddress,
      ftContractName: ftContractName,
      vaultStoragePathIdentifier: vaultStoragePathIdentifier,
      receiverPublicPathIdentifier: receiverPublicPathIdentifier,
      balancePublicPathIdentifier: balancePublicPathIdentifier
    )
  }
}


