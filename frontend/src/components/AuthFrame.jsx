import { Leaf, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";

export default function AuthFrame({ eyebrow, title, description, children }) {
  return (
    <main className="grid min-h-screen bg-[#f5f5ef] lg:grid-cols-[minmax(360px,0.88fr)_1.12fr]">
      <aside className="auth-dark relative hidden min-h-screen flex-col overflow-hidden bg-[#19382e] px-10 py-9 text-white lg:flex xl:px-14">
        <Link to="/login" className="relative z-10 flex w-fit items-center gap-3 rounded-lg">
          <span className="grid size-10 place-items-center rounded-[13px] bg-[#d9ed9c] text-[#1e3d31]"><Leaf size={20} aria-hidden="true" /></span>
          <span className="font-serif text-2xl tracking-tight">listjj</span>
        </Link>
        <div className="relative z-10 my-auto max-w-[430px] py-16">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-[.22em] text-[#bed095]">Your own small corner</p>
          <p className="font-display m-0 text-[3.7rem] font-medium leading-[.98] tracking-[-.04em] text-[#f6f5ec] xl:text-[4.35rem]">Keep a little room for <em className="font-normal text-[#d9ed9c]">wonder.</em></p>
          <p className="mt-6 max-w-[340px] text-[14px] leading-7 text-[#b9c8bc]">A thoughtful place for the notes, lists and passing ideas worth keeping.</p>
          <div className="mt-11 flex items-center gap-3 border-t border-white/15 pt-5 text-[11px] text-[#aebeb2]">
            <span className="grid size-8 place-items-center rounded-full border border-white/20 font-serif text-sm italic text-[#d9ed9c]">1</span>
            <span>Collect the useful things. Let the rest pass.</span>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between border-t border-white/15 pt-4 font-mono text-[9px] uppercase tracking-[.14em] text-[#9caf9f]">
          <span>Made for clear minds</span><span>v2 · private by design</span>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-28 size-[420px] rounded-full border border-white/[0.08]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 size-[300px] rounded-full border border-white/[0.08]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-8 right-20 size-[150px] rounded-full border border-[#d9ed9c]/15" />
      </aside>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-9 sm:py-9 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/login" className="flex items-center gap-2 font-serif text-xl tracking-tight text-[#20382d] lg:hidden">
            <span className="grid size-8 place-items-center rounded-xl bg-[#d9ed9c] text-[#244b3d]"><Leaf size={16} /></span>listjj
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#58675d]"><LockKeyhole size={12} aria-hidden="true" /> Private by default</span>
        </div>
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-[#58675d]">{eyebrow}</p>
          <h1 data-page-title tabIndex={-1} className="font-display m-0 text-[2.65rem] font-medium leading-[1.03] tracking-[-.04em] text-[#20382d] sm:text-[3.15rem]">{title}</h1>
          <p className="mb-8 mt-3 text-[13px] leading-6 text-[#58675d]">{description}</p>
          {children}
        </div>
        <div className="flex items-center justify-between border-t border-[#e3e5dd] pt-4 text-[10px] text-[#58675d]">
          <span>Listjj <span className="px-1">·</span> A quiet place to keep things.</span>
          <span className="font-mono uppercase tracking-[.1em]">Private workspace</span>
        </div>
      </section>
    </main>
  );
}
