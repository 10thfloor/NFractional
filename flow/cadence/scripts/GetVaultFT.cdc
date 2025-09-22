import "Fractional"

access(all) fun main(vaultId: String): {String: String}? {
  return Fractional.getVaultFT(vaultId: vaultId)
}


