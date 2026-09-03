type Props = {
  src?: string;
  className?: string;
};

export function BrandLogo({ src = '/logo-opiina.png', className = 'h-10 drop-shadow' }: Props) {
  return (
    <img
      src={src}
      alt="Opiina"
      className={className}
      onError={(e) => {
        const el = e.currentTarget;
        if (el.src.endsWith('/logo.svg')) return;
        el.src = '/logo.svg';
      }}
    />
  );
}
