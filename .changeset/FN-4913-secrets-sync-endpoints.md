---
"@runfusion/fusion": minor
---

Add cross-node secrets sync endpoints (`POST /api/nodes/:id/secrets/push`, `POST /api/nodes/:id/secrets/pull`, `POST /api/secrets/sync-receive`, `GET /api/secrets/sync-export`) with shared-passphrase envelope (scrypt → AES-256-GCM) and Bearer-apiKey auth on inbound routes. Passphrase is stored locally encrypted under the master key (reserved `__sync_passphrase__` row, `access_policy="deny"`) and is never transmitted or echoed.
