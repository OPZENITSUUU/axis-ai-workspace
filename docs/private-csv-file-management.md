# Private CSV File Management

## Scope

AXIS provides a **CSV files** section in Settings and a **Manage CSV files** command. It lists only attachment records where the signed-in user owns the record and its MIME type is `text/csv`.

| Action | Behavior | Privacy boundary |
|---|---|---|
| View | Shows CSV name, size, and upload date. | The protected query filters by authenticated `userId` and `text/csv`. |
| Rename | Changes the private attachment display name and preserves a `.csv` extension. | The storage key remains unchanged; no object URL or provider credential is sent to the browser. |
| Delete | Requires an explicit in-product confirmation, then removes the owned attachment record. | The deletion procedure requires both the authenticated user scope and the literal `DELETE CSV` confirmation. |

The storage layer intentionally does not expose direct object deletion. Removing the private database reference makes the stored object unreachable through AXIS, while preserving the platform storage boundary. A deleted CSV is also removed from the active composer attachment pills and the current conversation attachment refresh.

## Validation

The implementation is covered by protected router tests, database helper ownership tests, and visual-system assertions. TypeScript validation passes, and the AXIS test suite reports **52 active tests passing** with one deliberately skipped external gateway probe.
