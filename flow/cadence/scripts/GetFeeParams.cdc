import "Fractional"

access(all) fun main(vaultId: String): {String: UInt64} {
  return Fractional.getFeeParams(vaultId: vaultId)
}


