## 2026-04-24 - Bulk IDB Insert Optimization
**Learning:** Sequential `.put` operations that instantiate separate IndexedDB transactions are significantly slower than opening a single `readwrite` transaction and running `.put` statements using `Promise.all`.
**Action:** When inserting arrays of data into IndexedDB, always use a single bulk transaction and batch writes inside `Promise.all`.
