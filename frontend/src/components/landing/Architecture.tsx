const layers = [
  {
    name: "Identity",
    desc: "Profile, follow, and reputation contracts on Soroban — the source of truth for who exists and who's connected to whom.",
  },
  {
    name: "Content",
    desc: "Posts and media live off-chain on IPFS/Arweave; a content hash and author are anchored on-chain for verifiability.",
  },
  {
    name: "Semantic",
    desc: "An RDF/JSON-LD projection of the graph, so external tooling and AI agents can read Weave's data without a bespoke integration.",
  },
  {
    name: "Query / Indexing",
    desc: "A permissionless GraphQL API over indexed contract events — no API key required to read the graph.",
  },
  {
    name: "Application",
    desc: "Clients, feeds, and tipping UI — any app can build here without asking Weave for permission first.",
  },
];

export default function Architecture() {
  return (
    <section id="architecture" className="border-t border-border py-22">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-13 max-w-xl">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            How it&apos;s built
          </p>
          <h2 className="font-serif text-3xl text-star sm:text-[38px]">
            Strict about what belongs on-chain.
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">
            Only what needs consensus-level integrity lives in Soroban contracts. Everything
            high-volume and low-stakes lives off-chain.
          </p>
        </div>

        <div className="relative pl-7">
          <div className="absolute bottom-2 left-1.5 top-2 w-px bg-gradient-to-b from-gold to-border" />
          {layers.map((layer, i) => (
            <div key={layer.name} className={`relative pl-6.5 ${i !== layers.length - 1 ? "pb-8.5" : ""}`}>
              <div className="absolute -left-[27px] top-1 h-[11px] w-[11px] rounded-full border-2 border-gold bg-ink" />
              <h3 className="font-serif text-[19px] text-star">{layer.name}</h3>
              <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-relaxed text-slate">
                {layer.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
