import Image from "next/image";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import appIcon from "../../../WordCrack/assets/icon.png";

function StoreButton(props: { kind: "ios" | "android"; href?: string }) {
  const label = props.kind === "ios" ? "Download on the App Store" : "Get it on Google Play";
  const sub = props.kind === "ios" ? "iOS" : "Android";
  return (
    <a
      className="group inline-flex w-full sm:w-auto items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-glow hover:bg-white/10"
      href={props.href ?? "#"}
    >
      <div className="flex items-center gap-4">
        <div className="h-11 w-11 rounded-xl bg-white/10 grid place-items-center text-xl">
          {props.kind === "ios" ? "" : "▶"}
        </div>
        <div className="leading-tight">
          <div className="text-xs text-white/70">{sub}</div>
          <div className="font-extrabold">{label}</div>
        </div>
      </div>
      <span className="text-white/60 group-hover:text-white">→</span>
    </a>
  );
}

export default function HomePage() {
  return (
    <div>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6">
        <section className="pt-10 md:pt-16">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-white/80">
                <span className="inline-block h-2 w-2 rounded-full bg-sky" />
                Hourly 5‑letter cipher puzzle
              </div>

              <h1 className="mt-5 text-4xl md:text-5xl font-black tracking-tight">
                Crack the cipher.
                <br />
                Beat the clock.
              </h1>

              <p className="mt-4 text-white/75 text-lg leading-relaxed">
                WordCrack is a fast, logic‑driven word game. Everyone gets the same puzzle for the current hour—solve
                quicker to climb the leaderboard.
              </p>

              <div id="download" className="mt-7 flex flex-col sm:flex-row gap-3">
                <StoreButton kind="ios" href="#" />
                <StoreButton kind="android" href="#" />
              </div>

              <p className="mt-3 text-xs text-white/50">
                Replace the “#” links with your App Store / Play Store URLs when you’re ready.
              </p>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-glow">
                <div className="flex items-center gap-3">
                  <Image src={appIcon} alt="WordCrack" width={44} height={44} priority />
                  <div>
                    <div className="font-extrabold">WordCrack</div>
                    <div className="text-xs text-white/60">Ciphered Word • 5 columns • penalties for hints</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-5 gap-3">
                  {["C", "I", "P", "H", "R"].map((c) => (
                    <div
                      key={c}
                      className="aspect-square rounded-2xl bg-gradient-to-b from-blue/35 to-sky/10 border border-border grid place-items-center text-3xl font-black"
                    >
                      {c}
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-5 gap-3">
                  {["▲", "A", "▼", "▲", "B"].map((t, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-2xl border border-border bg-white/5 grid place-items-center font-extrabold text-white/90"
                    >
                      {t}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-white/5 px-4 py-3">
                  <div className="text-sm text-white/70">Final time</div>
                  <div className="font-black text-lg tabular-nums">00:42.18</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-black tracking-tight">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Ciphered Word",
                body: "You’re shown a ciphered 5‑letter word. One shift amount is used (some positions may be unshifted).",
              },
              {
                title: "5 Columns",
                body: "Each column cycles through 5 letters (one is correct). Tap ▲/▼ to pick your guess.",
              },
              {
                title: "Ranked by speed",
                body: "Score is final time (solve time + penalties). Hints help, but always cost time.",
              },
            ].map((x) => (
              <div key={x.title} className="rounded-3xl border border-border bg-card p-6">
                <div className="font-extrabold text-lg">{x.title}</div>
                <div className="mt-2 text-white/70 leading-relaxed">{x.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-border bg-card p-8">
          <div className="text-2xl font-black">Ready to crack the next puzzle?</div>
          <div className="mt-2 text-white/70">Download WordCrack and compete on the hourly leaderboard.</div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <StoreButton kind="ios" href="#" />
            <StoreButton kind="android" href="#" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

