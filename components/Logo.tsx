import Link from "next/link";
import { FaCube } from "react-icons/fa";

type LogoVariant = "full" | "icon";
type LogoSize = "sm" | "md" | "lg" | "xl";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  linkTo?: string;
}

const TEXT_SIZE: Record<LogoSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
};

const ICON_SIZE: Record<LogoSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

export default function Logo({
  variant = "full",
  size = "md",
  className = "",
  linkTo,
}: LogoProps) {
  const content = (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <FaCube className={`text-brand-primary ${ICON_SIZE[size]}`} />
      {variant === "full" && (
        <span className={`font-logo font-semibold text-brand-dark tracking-tight ${TEXT_SIZE[size]}`}>
          Trace.
        </span>
      )}
    </span>
  );

  if (linkTo) {
    return (
      <Link href={linkTo} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
