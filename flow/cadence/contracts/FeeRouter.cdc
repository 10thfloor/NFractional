import "FungibleToken"
import "FungibleTokenConnectors"
import "Fractional"

/// FeeRouter centralizes fee split computation and routing to treasuries.
/// Token-agnostic: operates over {FungibleToken.Vault} interfaces and well-known
/// public path conventions for treasuries.
access(all) contract FeeRouter {

    /// Compute fee splits for a given vault and price amount using Fractional fee params.
    /// Returns tuple-like dictionary with: feeBps, feeAmount, vaultShare, protocolShare
    access(all) view fun computeFeeSplits(
        vaultId: String,
        amount: UFix64
    ): {String: UFix64} {
        if amount <= 0.0 {
            return {"feeBps": 0.0, "feeAmount": 0.0, "vaultShare": 0.0, "protocolShare": 0.0}
        }
        let params: {String: UInt64} = Fractional.getFeeParams(vaultId: vaultId)
        let feeBps: UFix64 = UFix64(params["feeBps"] ?? 0)
        let feeAmount: UFix64 = (amount * feeBps) / 10000.0
        if feeAmount <= 0.0 {
            return {"feeBps": feeBps, "feeAmount": 0.0, "vaultShare": 0.0, "protocolShare": 0.0}
        }
        let vaultSplitBps: UFix64 = UFix64(params["vaultSplitBps"] ?? 0)
        let vaultShare: UFix64 = (feeAmount * vaultSplitBps) / 10000.0
        let protocolShare: UFix64 = feeAmount - vaultShare
        return {
            "feeBps": feeBps,
            "feeAmount": feeAmount,
            "vaultShare": vaultShare,
            "protocolShare": protocolShare
        }
    }

    /// Route a concrete fee amount from a source vault to platform and per-vault treasuries.
    ///
    /// - tokenIdent is used to derive treasury public paths (e.g., "FLOW").
    /// - source is a withdraw-capability to the payer's vault (e.g., buyer's FlowToken vault).
    /// - adminAddr is the platform admin address that holds treasuries and publishes caps.
    access(all) fun routeFee(
        vaultId: String,
        tokenIdent: String,
        amount: UFix64,
        source: Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>,
        adminAddr: Address
    ) {
        if amount <= 0.0 { return }

        let splits: {String: UFix64} = FeeRouter.computeFeeSplits(vaultId: vaultId, amount: amount)
        let feeAmount: UFix64 = splits["feeAmount"] ?? 0.0
        if feeAmount <= 0.0 { return }

        let vaultShare: UFix64 = splits["vaultShare"] ?? 0.0
        let protocolShare: UFix64 = feeAmount - vaultShare

        // Resolve sinks
        let platformPath: PublicPath = PublicPath(identifier: "PlatformTreasury_".concat(tokenIdent))!
        let platformRecv: Capability<&{FungibleToken.Vault}> = getAccount(adminAddr).capabilities.get<&{FungibleToken.Vault}>(platformPath)

        let vtIdent: String = "VaultTreasury_".concat(tokenIdent).concat("_").concat(vaultId)
        let vaultPath: PublicPath = PublicPath(identifier: vtIdent)!
        let vaultRecv: Capability<&{FungibleToken.Vault}> = getAccount(adminAddr).capabilities.get<&{FungibleToken.Vault}>(vaultPath)

        // Move protocol share
        if protocolShare > 0.0 {
            let srcP: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: protocolShare, withdrawVault: source, uniqueID: nil)
            let dstP: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: platformRecv, uniqueID: nil)
            let pf: @{FungibleToken.Vault} <- srcP.withdrawAvailable(maxAmount: protocolShare)
            dstP.depositCapacity(from: &pf as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
            destroy pf
        }

        // Move vault share
        if vaultShare > 0.0 {
            let srcV: FungibleTokenConnectors.VaultSource = FungibleTokenConnectors.VaultSource(min: vaultShare, withdrawVault: source, uniqueID: nil)
            let dstV: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: vaultRecv, uniqueID: nil)
            let vf: @{FungibleToken.Vault} <- srcV.withdrawAvailable(maxAmount: vaultShare)
            dstV.depositCapacity(from: &vf as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
            destroy vf
        }

        // Event emission is handled by the calling transaction for now.
    }

    /// Route an AMM-produced fee vault to platform and per-vault treasuries using AMM fee splits.
    /// - The fee resource is consumed and split internally.
    /// - The tokenIdent is used for treasury paths (e.g., FLOW or per‑vault FT contract name).
    access(all) fun routeAmmFeeFromVault(
        vaultId: String,
        tokenIdent: String,
        fee: @{FungibleToken.Vault},
        adminAddr: Address,
        vaultStorageSuffix: String
    ) {
        if fee.balance <= 0.0 { destroy fee; return }

        let params: {String: UInt64} = Fractional.getAmmFeeParams(vaultId: vaultId)
        let vaultSplitBps: UFix64 = UFix64(params["ammFeeSplitVaultBps"] ?? 0)
        // protocol split is implicit: 10000 - vaultSplitBps in Fractional, but
        // we compute directly from fee.balance to avoid rounding drift.
        let vaultShare: UFix64 = (fee.balance * vaultSplitBps) / 10000.0
        let protocolShare: UFix64 = fee.balance - vaultShare

        // Resolve sinks
        let platformPath: PublicPath = PublicPath(identifier: "PlatformTreasury_".concat(tokenIdent))!
        let platformRecv: Capability<&{FungibleToken.Vault}> = getAccount(adminAddr).capabilities.get<&{FungibleToken.Vault}>(platformPath)

        let vtIdent: String = "VaultTreasury_".concat(tokenIdent).concat("_").concat(vaultStorageSuffix)
        let vaultPath: PublicPath = PublicPath(identifier: vtIdent)!
        let vaultRecv: Capability<&{FungibleToken.Vault}> = getAccount(adminAddr).capabilities.get<&{FungibleToken.Vault}>(vaultPath)

        let feeRef: auth(FungibleToken.Withdraw) &{FungibleToken.Vault} = &fee

        if protocolShare > 0.0 {
            let outP: @{FungibleToken.Vault} <- feeRef.withdraw(amount: protocolShare)
            let sinkP: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: platformRecv, uniqueID: nil)
            sinkP.depositCapacity(from: &outP as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
            destroy outP
        }

        if vaultShare > 0.0 {
            let outV: @{FungibleToken.Vault} <- feeRef.withdraw(amount: vaultShare)
            let sinkV: FungibleTokenConnectors.VaultSink = FungibleTokenConnectors.VaultSink(max: nil, depositVault: vaultRecv, uniqueID: nil)
            sinkV.depositCapacity(from: &outV as auth(FungibleToken.Withdraw) &{FungibleToken.Vault})
            destroy outV
        }

        destroy fee
    }
}


