import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import WhatWeaveIs from "@/components/landing/WhatWeaveIs";
import WhyStellar from "@/components/landing/WhyStellar";
import UseCases from "@/components/landing/UseCases";
import AppsShowcase from "@/components/landing/AppsShowcase";
import EcosystemImpact from "@/components/landing/EcosystemImpact";
import Architecture from "@/components/landing/Architecture";
import Cta from "@/components/landing/Cta";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <div className="bg-stars fixed inset-0 z-0 opacity-55" aria-hidden="true" />
      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <WhatWeaveIs />
          <WhyStellar />
          <UseCases />
          <AppsShowcase />
          <EcosystemImpact />
          <Architecture />
          <Cta />
        </main>
        <Footer />
      </div>
    </>
  );
}
