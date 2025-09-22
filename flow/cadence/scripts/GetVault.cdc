import "Fractional"

access(all)
fun main(vaultId: String): Fractional.Vault? {
  return Fractional.getVault(vaultId: vaultId)
}




