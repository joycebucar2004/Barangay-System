export function BarangayLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/seals/barangay-campagao.jpg"
      width={size}
      height={size}
      alt="Barangay Campagao seal"
      className={`rounded-full object-cover ${className || ""}`}
      style={{ width: size, height: size }}
    />
  );
}
