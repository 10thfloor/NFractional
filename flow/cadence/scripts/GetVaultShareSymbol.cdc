import "Fractional"

access(all) fun main(vaultId: String): String {
  let v: Fractional.Vault = Fractional.getVault(vaultId: vaultId) ?? panic("unknown vault")
  return v.shareSymbol
}


