import * as QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then((url: string) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) return <div className="h-[220px] w-[220px] rounded-md bg-slate-100" />;

  return <img src={dataUrl} width={size} height={size} alt="QR Code" className="rounded-md bg-white p-2" />;
}
