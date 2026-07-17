const impacts = [
  {
    num: "01",
    title: "New composability for existing apps",
    desc: "DeFi, DAO, and marketplace contracts already on Stellar can read Weave's graph and reputation data directly — a lending app can check social trust signals without building its own social layer.",
  },
  {
    num: "02",
    title: "A reason to hold a Stellar wallet beyond payments",
    desc: "Every Weave profile is a funded Stellar address. Social activity becomes a second on-ramp into the ecosystem, alongside payments and asset issuance.",
  },
  {
    num: "03",
    title: "Network effects that don't lock users into one app",
    desc: "Because the graph is permissionless to read, competing clients can all draw on the same user base — switching costs for users stay low, which is good for the ecosystem even when it's inconvenient for any one app.",
  },
  {
    num: "04",
    title: "A proving ground for Stellar's low-fee, fast-finality thesis",
    desc: "Social interactions are exactly the high-frequency, low-value-per-action workload that shows off sub-cent fees and sub-5-second finality — a workload most other chains can't support economically.",
  },
];

export default function EcosystemImpact() {
  return (
    <section id="ecosystem" className="border-t border-border py-22">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-13 max-w-xl">
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            Impact on Stellar
          </p>
          <h2 className="font-serif text-3xl text-star sm:text-[38px]">
            A social layer makes every other Stellar app more useful.
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate">
            Weave isn&apos;t trying to be the one social app on Stellar. It&apos;s trying to be
            the layer every app can share.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-9 lg:grid-cols-2 lg:gap-12">
          {impacts.map((item) => (
            <div key={item.num} className="flex gap-4.5">
              <span className="shrink-0 pt-0.5 font-mono text-[13px] text-gold-soft">
                {item.num}
              </span>
              <div>
                <h3 className="mb-2 text-base font-bold text-star">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
