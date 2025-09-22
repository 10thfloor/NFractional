import "VaultShareToken"

// Returns the caller's balance for the current vault's share FT (VaultShareToken)
// Assumes the account has published a balance capability at VaultShareToken.getBalancePublicPath()
access(all) view fun main(account: Address): UFix64 {
    let cap: Capability<&VaultShareToken.Vault> = getAccount(account).capabilities.get<&VaultShareToken.Vault>(VaultShareToken.getBalancePublicPath())
    let vaultRef: &VaultShareToken.Vault = cap.borrow() ?? panic("VaultShareToken balance capability missing")
    return vaultRef.balance
}


