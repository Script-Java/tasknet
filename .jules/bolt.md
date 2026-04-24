## 2024-04-24 - N+1 Query Optimization in Supabase Sync

**Learning:** When pushing local offline changes to a remote backend like Supabase, iterating over changes sequentially with an `await` in the loop results in an N+1 query problem, bottlenecking the entire sync process.
**Action:** Use `Promise.all` alongside `Array.map` to execute those database mutations concurrently. This leads to massive performance gains (e.g. from 517ms to 30ms for 50 records) without compromising functionality, provided error catching is applied to each individual promise within the mapped array to accurately return partial vs total success.
