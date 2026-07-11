# Weave

**A decentralized, permissionless social graph protocol built on Stellar.**

> Status: 🚧 Early development — core Soroban contracts are being built first. See [Roadmap](#roadmap) and [`docs/weave_technical_spec.md`](./docs/weave_technical_spec.md) for the full build spec.

---

## The Problem

Decentralized social protocols have split into two camps, and neither has cracked it:

- **Crypto-native protocols** (Lens, Farcaster) have real on-chain programmability and composability, but tiny, expensive-to-scale user bases — after years and hundreds of millions in funding, neither has sustained 100K daily active users.
- **Federated protocols** (Bluesky/AT Protocol) have real scale — 40M+ users — but no programmable, on-chain economic layer. No native payments, no composability with other financial primitives.

Nobody has combined mainstream-viable cost/UX with native payments. **That gap is Weave's opportunity on Stellar** — sub-5-second finality and sub-cent fees let Weave behave like cheap, federated-style infrastructure while still being a public ledger with native asset rails and every profile is a funded wallet by construction.

Full competitive research and rationale: [`docs/weave_technical_spec.md`](./docs/weave_technical_spec.md).

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
│  Identity Layer  (Soroban: Profile / Follow / Reputation)  │
└───────────────────────────────────────────────────────────┘
```

**On-chain (Soroban):** profile identity, follow edges, reputation/attestation, post-content hash anchoring.
**Off-chain:** post/media content (IPFS/Arweave), indexer + GraphQL read API, RDF/JSON-LD semantic export.
**Payments:** native Stellar payment operations for tipping — not routed through custom contract accounting.

Design principles, full contract interfaces, and the on-chain/off-chain data placement table live in the [technical spec](./docs/weave_technical_spec.md).

---

## Tech Stack

| Layer | Stack |
|---|---|
| Smart contracts | Rust + [`soroban-sdk`](https://developers.stellar.org/docs/build/smart-contracts), built on OpenZeppelin's [Stellar Contracts](https://docs.openzeppelin.com/stellar-contracts) suite |
| Frontend | Next.js, TypeScript, Tailwind CSS v4 |
| Indexer *(planned)* | Postgres + GraphQL API, subscribed to Soroban contract events |
| Wallet | [Freighter](https://www.freighter.app/) / any SEP-10-compatible Stellar wallet |

---

## Repository Structure

```
.
├── contracts/          # Soroban smart contracts (Rust)
│   ├── profile-registry/
│   ├── follow-graph/
│   ├── reputation-registry/
│   └── post-anchor/
├── frontend/            # Next.js + TypeScript + Tailwind v4 app
├── docs/
│   └── weave_technical_spec.md   # Full research + build spec
└── README.md
```

*(Adjust this tree to match your actual folder layout as the repo fills in.)*

---

## Contracts

### ProfileRegistry — deployed to Stellar testnet

**Contract ID:** `CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU`

Deployed to Stellar testnet — verify independently via [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU) or Soroban RPC at contract ID `CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU`.

#### `register` — create a new profile
```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  register \
  --owner <YOUR_STELLAR_ADDRESS> \
  --handle your_handle \
  --metadata_uri "ipfs://<YOUR_CID>"
# returns: "1"  (the assigned profile_id)
```

#### `get_profile` — fetch a profile by ID
```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  get_profile \
  --profile_id 1
# returns: {"created_at":...,"follower_count":0,"following_count":0,"handle":"your_handle","metadata_uri":"ipfs://...","owner":"G..."}
```

#### `resolve_handle` — look up a profile_id by handle (case-insensitive)
```bash
stellar contract invoke \
  --id CAVUZWNQ322DFBNDEENP6GBYF6ESZFQDIEJN5C367WIG23AFMZO7ZLDU \
  --source <YOUR_KEY_ALIAS> \
  --network testnet \
  -- \
  resolve_handle \
  --handle your_handle
# returns: "1"
```

---

## Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) + the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup) (`stellar contract` commands)
- Node.js 18+ and npm/pnpm

### Build & deploy a contract
```bash
cd contracts
stellar keys generate alice --network testnet --fund
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/profile_registry.wasm \
  --source alice \
  --network testnet \
  --alias profile_registry \
  -- \
  --admin <ALICE_PUBLIC_KEY>
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Roadmap

Full phased roadmap in [`docs/weave_technical_spec.md § 13`](./docs/weave_technical_spec.md#13-phased-build-roadmap). Short version:

- **Phase 0 (now):** repo foundations, `ProfileRegistry` contract, minimal wallet → contract → UI demo loop.
- **Phase 1:** `FollowGraph`, `PostAnchor`, basic indexer + GraphQL, native-payment tipping in a reference client.
- **Phase 2:** `ReputationRegistry`, developer SDK, RDF/JSON-LD semantic export.
- **Phase 3:** selective-disclosure privacy (ZK) research track.

---

## Contributing

This project participates in the [Stellar Drips Wave](https://www.drips.network/wave/stellar) program — issues tagged for a Wave cycle are scoped and point-valued for contributors. General contribution guidelines are coming in `CONTRIBUTING.md`; in the meantime, open an issue before starting significant work so effort isn't duplicated.

---

## License

[MIT](./LICENSE)
