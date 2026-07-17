const cases = [
  {
    title: "Social-payment apps",
    desc: "Send value to anyone you follow, or split a bill across your connections, without leaving the social graph to find a wallet address.",
  },
  {
    title: "Creator economies",
    desc: "Creators collect micro-tips and subscriptions directly from followers — the payment rail and the audience live in the same place.",
  },
  {
    title: "Reputation-based lending",
    desc: "Lending protocols read graph and reputation signals as an input to underwriting, instead of starting from zero trust.",
  },
  {
    title: "DAO governance",
    desc: "Weight votes by demonstrated participation and social standing, not just token balance.",
  },
  {
    title: "Community discovery",
    desc: "Find people with shared interests based on real on-chain behavior and connections, not a recommendation black box.",
  },
  {
    title: "Portable professional identity",
    desc: "Verified credentials and standing move with a person across every app built on Weave, instead of living in one platform's silo.",
  },
];

export default function UseCases() {
  return (
    <section id="cases" className="border-t border-border py-22">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-13 max-w-xl">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            What you can build
          </p>
          <h2 className="font-serif text-3xl text-star sm:text-[38px]">
            One graph, a lot of different apps.
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">
            Weave doesn&apos;t prescribe a client. It&apos;s infrastructure any Stellar app can
            read from and write to.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border border-l-2 border-l-gold bg-panel p-6 pb-5.5 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:border-l-gold-soft"
            >
              <h3 className="mb-2.5 font-serif text-lg italic text-star">{c.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-slate">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
