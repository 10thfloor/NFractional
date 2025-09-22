import "FeeRouter"

access(all) view fun main(vaultId: String, amount: UFix64): {String: UFix64} {
  return FeeRouter.computeFeeSplits(vaultId: vaultId, amount: amount)
}


