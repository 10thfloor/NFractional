import "Fractional"
import "FungibleToken"
import "FungibleTokenMetadataViews"

access(all) view fun main(vaultId: String): UFix64 {
  // Get the FT metadata for this vault
  let ftMeta: {String: String} = Fractional.getVaultFT(vaultId: vaultId) ?? panic("vault FT metadata not found")

  let ftAddress: Address = Address.fromString(ftMeta["address"]!) ?? panic("invalid FT address")
  let ftContractName: String = ftMeta["name"]!

  // Borrow the contract account to access the FT contract
  let ftContract: &{FungibleToken} = getAccount(ftAddress)
    .contracts.borrow<&{FungibleToken}>(name: ftContractName) ?? panic("FT contract not found")

  // Get total supply from the contract-level view
  let totalSupplyView: FungibleTokenMetadataViews.TotalSupply? = ftContract.resolveContractView(
    resourceType: nil,
    viewType: Type<FungibleTokenMetadataViews.TotalSupply>()
  ) as! FungibleTokenMetadataViews.TotalSupply?

  return totalSupplyView?.totalSupply ?? panic("totalSupply view not found")
}
