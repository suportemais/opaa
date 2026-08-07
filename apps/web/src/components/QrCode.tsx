import * as QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({
  value,
  size = 220,
  centerIconSrc,
}: {
  value: string;
  size?: number;
  centerIconSrc?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setIconUrl(null);
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: centerIconSrc ? 'H' : 'M',
    } as any)
      .then((url: string) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    if (centerIconSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!cancelled) setIconUrl(centerIconSrc);
      };
      img.onerror = () => {
        if (!cancelled) setIconUrl(null);
      };
      img.src = centerIconSrc;
    }
    return () => {
      cancelled = true;
    };
  }, [value, size, centerIconSrc]);

  if (!dataUrl) return <div style={{ width: size, height: size }} className="rounded-md bg-slate-100" />;

  const iconSize = Math.round(size * 0.22);
  const iconBg = Math.round(size * 0.26);

  return (
    <div
      className="relative inline-block rounded-md bg-white p-2 shadow-sm ring-1 ring-slate-200"
      style={{ width: size + 16, height: size + 16 }}
    >
      <img
        src={dataUrl}
        width={size}
        height={size}
        alt="QR Code"
        className="block h-auto w-full"
      />
      {iconUrl && (
        <>
          <div
            className="pointer-events-none absolute rounded-full bg-white shadow"
            style={{
              width: iconBg,
              height: iconBg,
              left: `calc(50% - ${iconBg / 2}px + 8px)`,
              top: `calc(50% - ${iconBg / 2}px + 8px)`,
              boxShadow: '0 2px 8px rgba(15,23,42,0.12)',
            }}
          />
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              width: iconSize,
              height: iconSize,
              left: `calc(50% - ${iconSize / 2}px + 8px)`,
              top: `calc(50% - ${iconSize / 2}px + 8px)`,
              objectFit: 'contain',
            }}
          />
        </>
      )}
    </div>
  );
}
