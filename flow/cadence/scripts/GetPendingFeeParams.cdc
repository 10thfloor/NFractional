import "Fractional"

access(all) fun main(vaultId: String): {String: UInt64}? {
  return Fractional.getPendingFeeParams(vaultId: vaultId)
}


