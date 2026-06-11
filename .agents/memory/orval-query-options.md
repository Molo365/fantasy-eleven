---
name: Orval query options require queryKey
description: Passing a `query` options object to a generated orval useGet* hook forces you to also supply queryKey.
---

When you pass any `query` options (e.g. `refetchInterval`, `enabled`) to an
orval-generated React Query hook in this repo (`useGetX({ query: {...} })`),
TypeScript reports `Property 'queryKey' is missing`. The generated
`UseQueryOptions` type requires `queryKey` even though the hook supplies a
default internally.

**Fix:** also pass the generated key function:
`useGetLiveFixtures({ query: { queryKey: getGetLiveFixturesQueryKey(), refetchInterval: 60_000 } })`.
The key function is exported alongside the hook from `@workspace/api-client-react`.

**Why:** matches the working pattern in `squad-builder.tsx`.
**How to apply:** any time you add query options to a generated hook, import and call `getGet<Name>QueryKey()`.

Also: a conditional type like
`ReturnType<typeof useGetX>["data"] extends (infer T)[] | undefined ? T : never`
resolves to `never`. Import the generated row type directly instead
(e.g. `type LiveFixture` from `@workspace/api-client-react`).
