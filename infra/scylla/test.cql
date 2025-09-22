-- Vault
SELECT * FROM fractional.vaults
WHERE network='emulator' AND vault_id='vlt-emul-1';

-- Token metadata/supply
SELECT * FROM fractional.share_tokens
WHERE network='emulator' AND symbol='EX42';

-- Balances
SELECT * FROM fractional.balances
WHERE network='emulator' AND asset_symbol='EX42';

-- Recent events by type
SELECT type, block_height, tx_id FROM fractional.events
WHERE network='emulator'
AND vault_id='vlt-emul-1'
ORDER BY ts DESC
LIMIT 20;