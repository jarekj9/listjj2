import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.jsx";

export default function MessageBanner({ id, type = "error", title, children, className = "" }) {
  const Icon = type === "success" ? CheckCircle2 : type === "info" ? Info : AlertCircle;
  return (
    <Alert id={id} variant={type === "error" ? "destructive" : "default"} className={`my-4 rounded-xl ${type === "success" ? "border-[#c9d7b7] bg-[#f1f5e8] text-[#36513e]" : ""} ${className}`}>
      <Icon aria-hidden="true" />
      {title && <AlertTitle title={title}>{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
