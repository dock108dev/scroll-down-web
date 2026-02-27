interface TeamColorDotProps {
  color?: string;
  size?: "sm" | "md";
}

export function TeamColorDot({ color, size = "sm" }: TeamColorDotProps) {
  const sizeClass = size === "sm" ? "h-2 w-2" : "h-3 w-3";

  return (
    <span
      className={`${sizeClass} inline-block rounded-full`}
      style={{ backgroundColor: color ?? "#525252" }}
    />
  );
}
