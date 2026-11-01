export default function PageHeader({ id = "page-title", number, eyebrow, title, description, action, className = "" }) {
  return (
    <header className={`mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end ${className}`}>
      <div className="max-w-2xl">
        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#58675d]">
          {number && <span className="grid size-5 place-items-center rounded-full border border-[#ccd6c9] text-[9px] text-[#4a6755]">{number}</span>}
          {eyebrow}
        </p>
        <h1 id={id} data-page-title tabIndex={-1} className="font-display m-0 text-[2.55rem] font-medium leading-[0.98] tracking-[-0.045em] text-[#20382d] sm:text-[3.35rem]">{title}</h1>
        {description && <p className="mb-0 mt-3 max-w-xl text-[13px] leading-6 text-[#58675d] sm:text-sm">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
