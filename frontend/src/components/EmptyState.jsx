import { Sparkles } from "lucide-react";
import { Button } from "./ui/button.jsx";

export default function EmptyState({ icon: Icon = Sparkles, eyebrow = "A clear page", title, description, action, onAction }) {
  return (
    <section className="flex min-h-[300px] flex-col items-center justify-center px-5 py-12 text-center sm:min-h-[360px]" aria-live="polite">
      <div className="relative mb-5 grid size-[66px] place-items-center rounded-[23px] bg-[#e7eddd] text-[#345b45]">
        <Icon size={27} strokeWidth={1.55} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 size-3 rounded-full border-[3px] border-background bg-[#d5e99b]" />
      </div>
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#58675d]">{eyebrow}</p>
      <h2 className="font-display m-0 text-[1.8rem] font-medium tracking-tight text-[#20382d]">{title}</h2>
      {description && <p className="mt-2 min-w-0 max-w-sm text-[13px] leading-6 text-[#58675d] [overflow-wrap:anywhere]">{description}</p>}
      {action && <Button onClick={onAction} className="mt-5 rounded-xl px-4">{action}</Button>}
    </section>
  );
}
