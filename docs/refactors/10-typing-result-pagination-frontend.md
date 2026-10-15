# Refactor 2.5 — Frontend consumes the paginated history (consumer half)

**Area:** Frontend — results service, auth context, history view
**Architecture pattern:** Cursor-free "load more" accumulation over an offset-paginated API
**Status:** Done (pairs with the backend change in refactor 2.4)

## Bottleneck / anti-pattern (before)

The frontend expected the whole history in one payload and did all paging on the client:

```ts
// services/results.ts
const data = await api.get<ApiTypingResultResponse[]>('/result');   // unbounded array

// context/AuthContext.tsx
setServerResults(data.map(mapApiResultToTestResult));               // whole list in memory

// Components/Dashboard/RecentHistory.tsx
const ITEMS_PER_PAGE = 10;
const paginated = filtered.slice(0, page * ITEMS_PER_PAGE);         // client-side "Load More"
```

- The API returned every row (now paginated backend-side in 2.4), so the client had to hold and map
  the entire history.
- `RecentHistory` faked paging with `slice()` over the full list and a local `page` counter.

## Solution / enhancement (after)

The client now requests a page at a time and **accumulates** pages on demand:

```ts
// types/api.ts
export interface ApiPage<T> { content: T[]; page: number; size: number;
                              totalElements: number; totalPages: number; last: boolean; }

// services/results.ts
export const RESULTS_PAGE_SIZE = 20;
const data = await api.get<ApiPage<ApiTypingResultResponse>>(`/result?page=${page}&size=${size}`);
```

```ts
// context/AuthContext.tsx
const fetchResults = useCallback(async () => {           // first page (mount / login)
  const { data } = await apiGetResults(0, RESULTS_PAGE_SIZE);
  setServerResults(data.content.map(mapApiResultToTestResult));
  setResultsPage(data.page);
  setHasMoreResults(!data.last);
}, []);

const loadMoreResults = useCallback(async () => {        // append next page
  if (!getAccessToken() || !hasMoreResults) return;
  const { data } = await apiGetResults(resultsPage + 1, RESULTS_PAGE_SIZE);
  setServerResults(prev => [...prev, ...data.content.map(mapApiResultToTestResult)]);
  setResultsPage(data.page);
  setHasMoreResults(!data.last);
}, [resultsPage, hasMoreResults]);
```

`RecentHistory` drops its local `page`/`slice` paging and renders the accumulated results, showing a
**Load More** button only while `hasMoreResults` is true; the button calls `loadMoreResults()`.

## Architecture pattern

- **"Load more" accumulation:** the client tracks the last page number and a `hasMore` flag, appends
  each fetched page, and hides the trigger when `last` is reached. The API contract (2.4) supplies
  everything the UI needs (`last`, `totalElements`) without the client ever holding the full history.

## Notes / trade-offs

- **Search semantics changed:** `RecentHistory` search now filters the *loaded* pages, not the whole
  history (previously it filtered the full in-memory list). Making search span all pages would require
  a backend search parameter (own follow-up). Documented here so the behaviour change is explicit.
- `addResult` still optimistically prepends and then calls `fetchResults()`, which resets to page 0
  (same "refresh the list after save" behaviour as before; any extra loaded pages are dropped).
- `resultsPage` / `hasMoreResults` are reset to `0` / `false` on logout and on the global 401 handler.

## Files changed

- `frontend/src/types/api.ts` — new `ApiPage<T>`.
- `frontend/src/services/results.ts` — `apiGetResults(page, size)` returns `ApiPage<...>`.
- `frontend/src/context/AuthContext.tsx` — page accumulation, `hasMoreResults`, `loadMoreResults`.
- `frontend/src/Components/Dashboard/RecentHistory.tsx` — server-driven "Load More" (no local slicing).

## Verification

- Frontend typecheck: `npx tsc -b` (green).
- ESLint on the touched files: the only error is the **pre-existing** `react-refresh/only-export-components`
  on `AuthContext.tsx` (the file has always exported both `AuthProvider` and `useAuth`) — not
  introduced here.
- Manually: history loads 20 rows, "Load More" appends the next 20, button disappears on the last page.

## Rollback

Revert this commit together with 2.4 (`92728f9`); neither half is compatible with the other.
