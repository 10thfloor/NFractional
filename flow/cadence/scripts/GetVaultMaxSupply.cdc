import "Fractional"

access(all) view fun main(vaultId: String): UFix64? {
  let v = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
  return v.maxSupply
}


