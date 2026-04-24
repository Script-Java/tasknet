## 2024-04-24 - CalendarPage Render Performance
**Learning:** React rendering loops within loops (e.g., `hours.map` calling `entries.filter`) cause significant main thread blocking due to repeated O(N) operations and excessive Date instantiations.
**Action:** Use `useMemo` to group data into HashMaps (e.g., O(1) lookups by hour) prior to rendering to eliminate nested filtering inside render loops.
