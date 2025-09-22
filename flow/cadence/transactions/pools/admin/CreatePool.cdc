import "FungibleToken"
import "FlowToken"
import "ConstantProductAMM"

// Creates a Share–FLOW pool and publishes its public capability.
// Idempotence note: caller should ensure uniqueness by checking published cap for poolId beforehand.
//
// Args:
// - vaultId: string identifier of the share vault (e.g., the fractional vault id)
// - symbol: share token symbol (used by AMM for poolId)
// - feeBps: pool fee in basis points

transaction(vaultId: String, symbol: String, feeBps: UInt64, shareVaultType: Type) {
  prepare(signer: auth(BorrowValue, IssueStorageCapabilityController, SaveValue, UnpublishCapability, PublishCapability) &Account) {
    let factoryRef: &ConstantProductAMM.Factory = ConstantProductAMM.borrowFactory()
      ?? panic("AMM factory not found; deploy ConstantProductAMM and save factory at /storage/AMMFactoryV1")

    // Create pool under signer and publish capability
    let _poolRef: &ConstantProductAMM.Pool = factoryRef.createPool(account: signer, vaultId: vaultId, symbol: symbol, feeBps: feeBps, shareVaultType: shareVaultType)
    // No further action needed; capability is published by factory
  }
}


