import "Fractional"

access(all) fun main(vaultId: String): Bool {
  if let v = Fractional.getVault(vaultId: vaultId) {
    return Fractional.isCustodyAlive(vaultId: vaultId, custodian: v.custodian)
  }
  return false
}


