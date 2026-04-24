## 2023-10-27 - O(N^2) Date Parsing Bottleneck

**Learning:** Repeatedly instantiating `Date` objects inside a tight loop with $O(N)$ operations leads to massive performance degradation (e.g., $O(N^2)$ date parsing).
**Action:** When repeatedly comparing dates against an expanding set, maintain a parallel data structure of primitive timestamps (`number` in milliseconds) instead of constructing `Date` objects on the fly, which drastically improves comparison speed.
