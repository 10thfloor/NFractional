// flow/cadence/scripts/debug/GetVault.cdc
import "Fractional"

access(all) fun main(vaultId: String): {String: String}? {
  if let v: Fractional.Vault = Fractional.getVault(vaultId: vaultId) {
    return {
      "creator": v.creator.toString(),
      "tokenId": v.tokenId.toString(),
      "collectionPublicPath": v.collectionPublicPath
    }
  }
  return nil
}