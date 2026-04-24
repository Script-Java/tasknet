## 2024-04-24 - CalendarPage Render Performance
**Learning:** React rendering loops within loops (e.g., `hours.map` calling `entries.filter`) cause significant main thread blocking due to repeated O(N) operations and excessive Date instantiations.
**Action:** Use `useMemo` to group data into HashMaps (e.g., O(1) lookups by hour) prior to rendering to eliminate nested filtering inside render loops.

## 2023-10-27 - O(N^2) Date Parsing Bottleneck

**Learning:** Repeatedly instantiating `Date` objects inside a tight loop with $O(N)$ operations leads to massive performance degradation (e.g., $O(N^2)$ date parsing).
**Action:** When repeatedly comparing dates against an expanding set, maintain a parallel data structure of primitive timestamps (`number` in milliseconds) instead of constructing `Date` objects on the fly, which drastically improves comparison speed.
