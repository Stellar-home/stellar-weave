import Link from "next/link";

const footerLinks = [
  { href: "#what", label: "What It Does" },
  { href: "https://github.com", label: "GitHub" },
  { href: "/docs", label: "Docs" },
  { href: "#ecosystem", label: "For Stellar" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border py-9">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-7">
        <span className="font-mono text-xs text-slate-dim">
          Weave — an open protocol on Stellar. MIT licensed.
        </span>
        <nav className="flex gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-[12.5px] text-slate transition-colors hover:text-gold-soft"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
