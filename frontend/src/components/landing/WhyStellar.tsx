export default function WhyStellar() {
  return (
    <section id="why" className="border-t border-border py-22">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-14 px-7 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="mb-4 flex items-center gap-2.5 font-mono text-xs tracking-[0.14em] text-gold-soft uppercase before:h-px before:w-4 before:bg-gold before:content-['']">
            Why Stellar
          </p>
          <h2 className="mb-5 font-serif text-[26px] text-star sm:text-[34px]">
            Scale and programmability haven&apos;t gone together — until now.
          </h2>
          <p className="mb-4 text-[15.5px] leading-relaxed text-slate">
            Crypto-native social protocols have composability and native monetization, but
            small, expensive-to-scale user bases. Federated protocols have real scale, but no
            programmable economic layer underneath.
          </p>
          <p className="mb-4 text-[15.5px] leading-relaxed text-slate">
            <strong className="font-semibold text-star">Weave doesn&apos;t have to choose.</strong>{" "}
            Stellar&apos;s sub-5-second finality and sub-cent fees mean the graph can be cheap
            enough to feel instant, while every action still settles on a public ledger with
            native payment rails already built in.
          </p>
          <p className="text-[15.5px] leading-relaxed text-slate">
            The result: a social graph where identity and money were never separate concerns
            to begin with.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-6 pb-4.5 pt-7">
          <svg viewBox="0 0 460 360" className="block h-auto w-full">
            <line x1="50" y1="20" x2="50" y2="310" stroke="rgb(242 240 234 / 0.14)" strokeWidth="1" />
            <line x1="50" y1="310" x2="440" y2="310" stroke="rgb(242 240 234 / 0.14)" strokeWidth="1" />
            <text x="50" y="332" className="font-mono uppercase" fontSize="10.5" fill="#6b7590" letterSpacing=".05em">
              Low programmability
            </text>
            <text x="290" y="332" className="font-mono uppercase" fontSize="10.5" fill="#6b7590" letterSpacing=".05em">
              High programmability
            </text>

            <circle cx="95" cy="55" r="6" fill="#9aa3bd" />
            <text x="110" y="52" fontSize="12.5" fontWeight="600" fill="#f2f0ea">
              Federated protocols
            </text>
            <text x="110" y="67" className="font-mono" fontSize="10" fill="#9aa3bd">
              Real reach, no payments layer
            </text>

            <circle cx="360" cy="255" r="6" fill="#9aa3bd" />
            <text x="235" y="252" fontSize="12.5" fontWeight="600" fill="#f2f0ea">
              Chain-native protocols
            </text>
            <text x="235" y="267" className="font-mono" fontSize="10" fill="#9aa3bd">
              Composable, small audiences
            </text>

            <circle cx="350" cy="70" r="9" fill="none" stroke="#c9a24b" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="350" cy="70" r="3" fill="#c9a24b" />
            <text x="245" y="47" fontSize="12.5" fontWeight="600" fill="#e4c378">
              Weave — built for both
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
