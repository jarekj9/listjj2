import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.jsx";

export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", onConfirm, busy = false, error = "" }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (busy && !nextOpen) return; onOpenChange(nextOpen); }}>
      <DialogContent showCloseButton={!busy} className="rounded-[1.35rem] border-[#e1e5db] bg-[#fffefa] p-6 sm:p-7">
        <DialogHeader className="text-left">
          <span className="mb-1 grid size-10 place-items-center rounded-xl bg-[#f8e9e4] text-[#b55043]"><AlertTriangle size={18} aria-hidden="true" /></span>
          <DialogTitle className="font-display text-2xl font-medium tracking-tight text-[#243a2e]">{title}</DialogTitle>
          <DialogDescription className="min-w-0 text-[13px] leading-6 text-[#526257] [overflow-wrap:anywhere]">{description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" aria-live="assertive" className="m-0 rounded-lg border border-[#efd4ce] bg-[#fbefeb] px-3 py-2 text-xs leading-5 text-[#873d33] [overflow-wrap:anywhere]">{error}</p>}
        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} className="rounded-xl">Keep it</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm} className="rounded-xl">{busy ? "Working…" : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
