import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <Image src={`${basePath}/logo.svg`} alt="MindShift" width={36} height={36} priority />
        <span className="font-extrabold tracking-tight text-lg">MindShift</span>
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link className="text-white/80 hover:text-white" href="/support">
          Support
        </Link>
        <a
          className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-white/10"
          href="#download"
        >
          Get the app
        </a>
      </nav>
    </header>
  );
}

