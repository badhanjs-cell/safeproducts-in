type SafeProductsBrandProps = {
  showTagline?: boolean;
  compact?: boolean;
};

export function SafeProductsBrand({ showTagline = true, compact = false }: SafeProductsBrandProps) {
  if (compact || !showTagline) {
    return (
      <div className="h-[46px] w-[205px] overflow-hidden sm:w-[220px]" aria-label="SafeProducts.in">
        <img
          src="/safeproducts-approved-logo.webp"
          alt="SafeProducts.in"
          className="block w-[222px] max-w-none origin-left -translate-y-[4px] scale-x-[0.92] object-contain sm:w-[238px]"
        />
      </div>
    );
  }

  return (
    <div
      className="w-[300px] sm:w-[350px] lg:w-[390px] xl:w-[410px]"
      aria-label="SafeProducts.in — Indian Regulatory Intelligence"
    >
      <img
        src="/safeproducts-approved-logo.webp"
        alt="SafeProducts.in — Indian Regulatory Intelligence"
        className="block h-auto w-full origin-left scale-x-[0.92] object-contain"
      />
    </div>
  );
}
