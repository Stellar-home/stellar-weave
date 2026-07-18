# Weave

**A decentralized, permissionless social graph protocol on Stellar.**

> Status: 🟢 Active development — 2 of 4 core Soroban contracts are live on testnet, with a
> working end-to-end wallet demo. See [Roadmap](#roadmap), [Deployed Contracts](#deployed-contracts),
> [Try the Live Demo](#try-the-live-demo), and [`docs/weave_technical_spec.md`](./docs/weave_technical_spec.md).

---

## The Problem

Decentralized social protocols have split into two camps, and neither has cracked it:

- **Crypto-native protocols** (Lens, Farcaster) have real on-chain programmability and composability, but tiny, expensive-to-scale user bases.
- **Federated protocols** (Bluesky/AT Protocol) have real scale — 40M+ users — but no programmable, on-chain economic layer.

Nobody has combined mainstream-viable cost/UX with native payments. **That gap is Weave's opportunity on Stellar** — sub-5-second finality and sub-cent fees let Weave behave like cheap, federated-style infrastructure while still being a public ledger with native asset rails, where every profile is a funded wallet by construction.

Full competitive research and rationale: [`docs/weave_technical_spec.md`](./docs/weave_technical_spec.md).

---

## Try the Live Demo

**`/demo`** is a working, three-step flow against real testnet contracts — not a mock:

1. **Connect** a wallet (Freighter, xBull, Albedo, Lobstr, or Hana, via
   [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit) — not
   Freighter-only).
2. **Register** a profile — a real `ProfileRegistry.register` transaction, signed by your
   connected wallet.
3. **Follow** another profile — a real `FollowGraph.follow` transaction, with live
   `is_following` / follower-count reads immediately after.

Run it locally: `cd frontend && npm install && npm run dev`, then visit `/demo`.

> **Demo recording:** a screen capture of the full connect → register → follow flow against
> testnet is tracked in [#13](https://github.com/Stellar-home/stellar-weave/issues/13) and will
> be embedded here once available.
>
> *The three-step flow in action: connect a Stellar wallet, register a profile with a real
> `ProfileRegistry.register` transaction, then follow another profile with a real
> `FollowGraph.follow` transaction — `is_following` and follower count update immediately after.*

---

## Deployed Contracts

| Contract | Status | Testnet Contract ID | Docs |
|---|---|---|---|
| `ProfileRegistry` | ✅ Live — 5 public functions | [`CAVUZWNQ...MZO7ZLDU`](https://stellar.expert/explorer/testnet/contract/CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU) | [`contracts/profile-registry/DEPLOYMENT.md`](./contracts/profile-registry/DEPLOYMENT.md) |
| `FollowGraph` | ✅ Live | [`CBO2USOJ...T5DSO5BOR`](https://stellar.expert/explorer/testnet/contract/CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR) | [`contracts/follow-graph/DEPLOYMENT.md`](./contracts/follow-graph/DEPLOYMENT.md) |
| `ReputationRegistry` | ⏳ Not started | — | — |
| `PostAnchor` | ⏳ Not started | — | — |

**`ProfileRegistry`'s 5 functions:** `register`, `get_profile`, `resolve_handle`,
`update_metadata`, `transfer_ownership`. (The last two are fully implemented, tested, and
deployed — easy to miss since most examples only demo the first three.)

> **⚠️ `follower_count` / `following_count` on `Profile` are always `0`.** These fields
> exist in `ProfileRegistry`'s struct but are never written to — `ProfileRegistry` was
> deployed before `FollowGraph` existed and has no mutation path for them, and Soroban
> contracts are immutable post-deploy. **Real counts live in `FollowGraph`** —
> call `get_follower_count` / `get_following_count` there, not `ProfileRegistry.get_profile`.
> See `contracts/follow-graph/DEPLOYMENT.md` for the full design note. If you're building a
> client against `ProfileRegistry` alone, do not surface its `follower_count` field to users.

**Live proof, verifiable independently by anyone:** Profile 1 followed Profile 2 on testnet —
[`follow_created` transaction](https://stellar.expert/explorer/testnet/tx/35c06183c749f0d9980b494b00b041a9e55d0293018d318ac75e71e9b200205b),
after which `is_following(1, 2)` returns `true` and `get_follower_count(2)` returns `1` against
live RPC.

37 unit tests passing across both contracts (19 + 18), covering auth enforcement, handle
validation, pagination boundaries, and cross-contract call correctness.

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Application Layer  (clients, feeds, tipping UI, DAOs)     │
├───────────────────────────────────────────────────────────┤
│  Query / Indexing Layer  (indexer service + GraphQL API)   │
├───────────────────────────────────────────────────────────┤
│  Semantic Layer  (RDF-style schema, content-addressed)     │
├───────────────────────────────────────────────────────────┤
│  Content Layer  (IPFS/Arweave — off-chain, hash on-chain)  │
├───────────────────────────────────────────────────────────┤
│  Identity Layer  (Soroban: Profile ✅ / Follow ✅ / Reputation ⏳) │
└───────────────────────────────────────────────────────────┘
```

**On-chain (Soroban):** profile identity, follow edges + counts, reputation/attestation
*(planned)*, post-content hash anchoring *(planned)*.
**Off-chain:** post/media content (IPFS/Arweave), indexer + GraphQL read API *(not started
— see [Roadmap](#roadmap))*, RDF/JSON-LD semantic export.
**Payments:** native Stellar payment operations for tipping — not routed through custom
contract accounting.

Design principles, full contract interfaces, and the on-chain/off-chain data placement
table live in the [technical spec](./docs/weave_technical_spec.md).

---

## Tech Stack

| Layer | Stack |
|---|---|
| Smart contracts | Rust + [`soroban-sdk`](https://developers.stellar.org/docs/build/smart-contracts), built on [OpenZeppelin's Stellar contracts](https://www.openzeppelin.com/networks/stellar) |
| Frontend | Next.js, TypeScript, Tailwind CSS v4 |
| Wallet | [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit) — Freighter, xBull, Albedo, Lobstr, Hana |
| Backend / Indexer | Rust (Axum) + Postgres — *foundation in progress, see Roadmap* |
| Content storage | IPFS *(planned, not yet wired up)* |

---

## Repository Structure

```
.
├── contracts/
│   ├── profile-registry/    # ✅ Live on testnet
│   ├── follow-graph/        # ✅ Live on testnet
│   ├── reputation-registry/ # ⏳ not started
│   └── post-anchor/         # ⏳ not started
├── backend/                  # 🟡 foundation in progress — Axum + Postgres indexer
├── frontend/
│   ├── app/page.tsx           # Landing page
│   ├── app/demo/page.tsx      # ✅ Live 3-step demo (connect → register → follow)
│   └── packages/               # Generated typed contract clients
├── docs/
│   └── weave_technical_spec.md
└── README.md
```

---

## Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) + the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup) v27+
- Node.js 18+ and npm/pnpm
- Postgres (for backend work)

### Try the live contracts right now (no local setup needed beyond the CLI)

```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <your-key-alias> --network testnet \
  -- get_profile --profile_id 1

stellar contract invoke \
  --id CBO2USOJ4MII4GWULU2YGBIAIUN7333SFU5S5R3GKLAP6FGT5DSO5BOR \
  --source <your-key-alias> --network testnet \
  -- is_following --follower 1 --followee 2
```

Full invocation examples for every function are in each contract's `DEPLOYMENT.md`.

### Build from source
```bash
cd contracts/profile-registry && stellar contract build
cd ../follow-graph && stellar contract build
cd ../../frontend && npm install && npm run dev   # then visit /demo
cd ../backend && cargo build
```

---

## Roadmap

Full phased roadmap in [`docs/weave_technical_spec.md § 13`](./docs/weave_technical_spec.md#13-phased-build-roadmap).

- **Phase 0 — Foundations:** ✅ done — and exceeded: `ProfileRegistry`, `FollowGraph`, and a
  full working wallet demo at `/demo` all shipped, not just the "minimal wallet loop"
  originally scoped.
- **Phase 1 — MVP:** 🟡 in progress. `ProfileRegistry` ✅, `FollowGraph` ✅, demo ✅,
  backend/indexer foundation ✅ (Axum + Postgres + `ProfileRegistry` ingestion worker,
  `GET /profiles/:id` endpoint live).
  Remaining: `FollowGraph` event ingestion, `PostAnchor` contract, GraphQL read API,
  native-payment tipping in a reference client.
- **Phase 2 — Reputation & Composability:** ⏳ not started.
- **Phase 3 — Privacy (ZK, research-gated):** ⏳ not started.

Open, scoped issues for the current phase are tracked in [GitHub Issues](../../issues) —
see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how contributions are scoped and reviewed.

---

## Contributing

This project participates in the [Stellar Drips Wave](https://www.drips.network/wave/stellar)
program — issues tagged for the current Wave cycle are scoped and point-valued
(Trivial / Medium / High) for contributors. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
the [open issues](../../issues) to get started.

---

## License

[MIT](./LICENSE)