## Custody Process

This document describes how underlying NFTs are held, verified, redeemed, and cleaned up in the platform.

### Models

- Protocol Escrow (legacy Custody): NFT held under `Fractional.Custody` in admin/user account.
- Assisted Self-Custody (LockBox): NFT held under user account `Fractional.LockBox` with protocol-gated withdrawal.

### Setup

1) User runs `transactions/custody/user/setup-lockbox.cdc` (or vault creation tx auto-sets it) to save `LockBox` at `/storage/FractionalLockBox` and publish `LockBoxPublic` at `Fractional.LockBoxPublicPath`.
2) Fractionalization tx deposits the NFT:
   - If policy == "lockbox": deposit into `LockBox.deposit(vaultId, <-nft)`.
   - Else: deposit into legacy `Custody`.
   - Emits `UnderlyingDeposited`.

### Liveness

- Script `scripts/VaultCustodyStatus.cdc` derives custodian from `Fractional.getVault(vaultId)` and checks `LockBoxPublic.borrowViewResolver(vaultId) != nil`.
- UI and transactions (listings, AMM, LP) gate actions with `Fractional.isCustodyAlive` preconditions.
- API exposes `Vault.custodyAlive` via GraphQL.

### Safety Invariants

- Burn-before-redeem: Protocol withdrawals require `declaredTotalSupply == 0.0` and vault `state == "redeemed"`.
- Legacy withdrawal guarded: `Custody.withdraw` requires `vault.state == "redeemed"` and caller is `custodian`.

### Redemption

1) Burn all shares (per‑vault FT) off-chain in tx.
2) Call `Fractional.Admin.redeemAndWithdraw(lockbox, vaultId, declaredTotalSupply: 0.0)` to set state and withdraw.
3) Emits `Redeemed` and `UnderlyingWithdrawn`.

### Residual Cleanup

- `LockBox.drain(vaultId, declaredTotalSupply)`: burns residual NFT for redeemed vaults with zero supply; emits `UnderlyingBurned`.
- `LockBox.drainAll({vaultId: UFix64})`: drains multiple holdings using per‑vault declared totals.

### Deposit Validation

- `LockBox.deposit` and `Custody.deposit` assert:
  - Known `vaultId`.
  - Custodian has a public collection capability at `vault.collectionPublicPath` implementing `NonFungibleToken.CollectionPublic`.
  - Deposited NFT `id` matches `vault.tokenId`.

### Minimal Buyout (Opt‑in Tender)

- `Fractional.BuyoutEscrow` stores buyer address, `vaultId`, price asset metadata, and escrowed funds/shares.
- Events: Created, Funded, SharesDeposited, Cancelled, Closed.
- Finalization sequence (in tx):
  1) Burn all shares from escrowed share vault using FT Admin (per‑vault token).
  2) Call `Fractional.withdrawFromLockBox(lockbox, vaultId, 0.0)` or `redeemAndWithdraw` to receive NFT.
  3) Close escrow; distribute funds off-chain or via follow-up claims.

### Failure/Recovery

- If custody liveness fails (cap removed or NFT moved), UI and tx gates block trading.
- Admin/users can re-publish `LockBoxPublic` and re-deposit NFT to restore liveness.
- Residuals (unclaimed NFTs) can be explicitly burned via `drain` once redeemed and zero supply.
