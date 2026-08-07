import * as QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  url: string;
  tenantName?: string | null;
  tenantSlug?: string | null;
  sizePx?: number;
};

type LoadedAssets = {
  qrDataUrl: string;
  iconImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
};

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAssets(url: string): Promise<LoadedAssets> {
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 1400,
    margin: 0,
    errorCorrectionLevel: 'H',
    color: { dark: '#0b1a3b', light: '#ffffff' } as any,
  } as any);
  const [iconImg, logoImg] = await Promise.all([
    loadImg('/icon-opiina.png'),
    loadImg('/logo-opiina.png'),
  ]);
  return { qrDataUrl, iconImg, logoImg };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rMax = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rMax, y);
  ctx.arcTo(x + w, y, x + w, y + h, rMax);
  ctx.arcTo(x + w, y + h, x, y + h, rMax);
  ctx.arcTo(x, y + h, x, y, rMax);
  ctx.arcTo(x, y, x + w, y, rMax);
  ctx.closePath();
}

function drawCorner(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  stroke: number,
  pos: 'tl' | 'tr' | 'bl' | 'br',
  color: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const rot =
    pos === 'tl' ? 0 : pos === 'tr' ? Math.PI / 2 : pos === 'br' ? Math.PI : -Math.PI / 2;
  ctx.rotate(rot);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.moveTo(inner, outer);
  ctx.lineTo(inner, inner);
  ctx.lineTo(outer, inner);
  ctx.stroke();
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'center',
) {
  ctx.textAlign = align;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

export function QrCodePosterWhistleblower({
  url,
  tenantName,
  tenantSlug,
  sizePx = 720,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspect = 9 / 10;
  const width = sizePx;
  const height = Math.round(width / aspect);

  const assetsKey = useMemo(() => `${url}|${width}x${height}`, [url, width, height]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    loadAssets(url)
      .then((assets) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;

        // Fundo: gradiente azul → roxo (com a leve curvatura do modelo)
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#0b75d1');
        bgGrad.addColorStop(0.55, '#3a5be6');
        bgGrad.addColorStop(1, '#7c3aed');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Glow superior sutil
        const glowTop = ctx.createRadialGradient(width * 0.25, height * 0.05, 10, width * 0.25, height * 0.05, width * 0.7);
        glowTop.addColorStop(0, 'rgba(255,255,255,0.25)');
        glowTop.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glowTop;
        ctx.fillRect(0, 0, width, height * 0.45);

        const padX = Math.round(width * 0.06);

        // Título
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const titleTop = Math.round(height * 0.055);
        ctx.font = `800 ${Math.round(width * 0.06)}px Inter, Arial, sans-serif`;
        ctx.fillText('ESCANEIE O QR CODE', width / 2, titleTop);
        ctx.fillText('PARA FAZER SUA DENÚNCIA', width / 2, titleTop + Math.round(width * 0.072));

        // Quadrado branco do QR Code
        const qrOuterSize = Math.round(width - padX * 2);
        const qrOuterX = padX;
        const qrOuterY = Math.round(height * 0.175);
        const qrOuterR = Math.round(width * 0.055);
        drawRoundedRect(ctx, qrOuterX, qrOuterY, qrOuterSize, qrOuterSize, qrOuterR);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Margem interna do QR dentro do quadrado
        const qrPad = Math.round(qrOuterSize * 0.06);
        const qrX = qrOuterX + qrPad;
        const qrY = qrOuterY + qrPad;
        const qrSize = qrOuterSize - qrPad * 2;

        // Desenha QR Code (já vem com fundo branco e preto #0b1a3b)
        const qrImg = new Image();
        qrImg.onload = () => {
          if (cancelled) return;
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

          // Cantoneiras azuis (4 pontos externos do quadrado branco)
          const cornerOuter = Math.round(qrOuterSize * 0.11);
          const cornerInner = Math.round(qrOuterSize * 0.05);
          const cornerStroke = Math.max(6, Math.round(qrOuterSize * 0.018));
          const cornerColor = '#1e40af';
          drawCorner(ctx, qrOuterX, qrOuterY, cornerOuter, cornerInner, cornerStroke, 'tl', cornerColor);
          drawCorner(ctx, qrOuterX + qrOuterSize, qrOuterY, cornerOuter, cornerInner, cornerStroke, 'tr', cornerColor);
          drawCorner(ctx, qrOuterX, qrOuterY + qrOuterSize, cornerOuter, cornerInner, cornerStroke, 'bl', cornerColor);
          drawCorner(ctx, qrOuterX + qrOuterSize, qrOuterY + qrOuterSize, cornerOuter, cornerInner, cornerStroke, 'br', cornerColor);

          // Ícone no centro do QR (20% a 22% do QR com fundo branco em círculo + sombra)
          const iconBox = Math.round(qrSize * 0.22);
          const iconX = qrX + (qrSize - iconBox) / 2;
          const iconY = qrY + (qrSize - iconBox) / 2;

          // Sombra do círculo do ícone
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.18)';
          ctx.shadowBlur = Math.round(iconBox * 0.08);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(iconX + iconBox / 2, iconY + iconBox / 2, iconBox / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Borda sutil no ícone
          ctx.lineWidth = Math.max(2, Math.round(iconBox * 0.02));
          ctx.strokeStyle = 'rgba(15,23,42,0.06)';
          ctx.beginPath();
          ctx.arc(iconX + iconBox / 2, iconY + iconBox / 2, iconBox / 2, 0, Math.PI * 2);
          ctx.stroke();

          if (assets.iconImg) {
            const iconPad = Math.round(iconBox * 0.14);
            ctx.drawImage(
              assets.iconImg,
              iconX + iconPad,
              iconY + iconPad,
              iconBox - iconPad * 2,
              iconBox - iconPad * 2,
            );
          }

          // Abaixo do QR: selo "Ambiente seguro e confidencial" + cadeado
          const lockTop = qrOuterY + qrOuterSize + Math.round(height * 0.035);
          const lockSize = Math.round(height * 0.045);
          const lockX = Math.round(width * 0.24);
          const lockY = lockTop;
          const lockColor = '#ffffff';
          ctx.save();
          ctx.translate(lockX, lockY);
          // Corpo
          ctx.fillStyle = lockColor;
          drawRoundedRect(ctx, lockSize * 0.08, lockSize * 0.42, lockSize * 0.84, lockSize * 0.55, lockSize * 0.12);
          ctx.fill();
          // Arco
          ctx.strokeStyle = lockColor;
          ctx.lineWidth = Math.max(3, Math.round(lockSize * 0.13));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(lockSize * 0.5, lockSize * 0.42, lockSize * 0.24, Math.PI, 0, false);
          ctx.stroke();
          // Furo
          ctx.fillStyle = bgGrad;
          ctx.beginPath();
          ctx.arc(lockSize * 0.5, lockSize * 0.7, lockSize * 0.05, 0, Math.PI * 2);
          ctx.fill();
          // Tarracha
          ctx.fillRect(lockSize * 0.46, lockSize * 0.7, lockSize * 0.08, lockSize * 0.15);
          ctx.restore();

          ctx.fillStyle = '#ffffff';
          ctx.font = `600 ${Math.round(width * 0.03)}px Inter, Arial, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(
            'Ambiente seguro e confidencial',
            lockX + lockSize + Math.round(width * 0.025),
            lockTop + Math.round(lockSize * 0.72),
          );

          // Card "Não se cale. Denuncie. Faça a diferença." com escudo
          const cardY = lockTop + lockSize + Math.round(height * 0.025);
          const cardH = Math.round(height * 0.14);
          const cardX = padX;
          const cardW = width - padX * 2;
          const cardR = Math.round(width * 0.05);
          drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
          const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
          cardGrad.addColorStop(0, 'rgba(15,23,42,0.55)');
          cardGrad.addColorStop(1, 'rgba(30,64,175,0.45)');
          ctx.fillStyle = cardGrad;
          ctx.fill();
          // Borda do card
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 2;
          drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
          ctx.stroke();

          // Escudo
          const shieldSize = Math.round(cardH * 0.56);
          const shieldX = cardX + Math.round(cardW * 0.08);
          const shieldY = cardY + Math.round((cardH - shieldSize) / 2);
          ctx.save();
          ctx.translate(shieldX, shieldY);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(3, Math.round(shieldSize * 0.055));
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          // Forma escudo
          ctx.beginPath();
          const s = shieldSize;
          ctx.moveTo(s * 0.08, s * 0.08);
          ctx.lineTo(s * 0.92, s * 0.08);
          ctx.lineTo(s * 0.92, s * 0.55);
          ctx.quadraticCurveTo(s * 0.92, s * 0.85, s * 0.5, s * 0.98);
          ctx.quadraticCurveTo(s * 0.08, s * 0.85, s * 0.08, s * 0.55);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255,255,255,0.0)';
          ctx.stroke();
          // Check V
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(3, Math.round(shieldSize * 0.08));
          ctx.beginPath();
          ctx.moveTo(s * 0.28, s * 0.5);
          ctx.lineTo(s * 0.46, s * 0.68);
          ctx.lineTo(s * 0.74, s * 0.34);
          ctx.stroke();
          ctx.restore();

          // Texto do card
          const textX = shieldX + shieldSize + Math.round(cardW * 0.05);
          const textMaxW = cardX + cardW - textX - Math.round(cardW * 0.05);
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.round(width * 0.04)}px Inter, Arial, sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText('Não se cale.', textX, cardY + Math.round(cardH * 0.36));
          ctx.font = `700 ${Math.round(width * 0.032)}px Inter, Arial, sans-serif`;
          wrapText(
            ctx,
            'Denuncie. Faça a diferença.',
            textX,
            cardY + Math.round(cardH * 0.72),
            textMaxW,
            Math.round(width * 0.038),
            'left',
          );

          // Rodapé: marca Opiina + tenant / slug (quando disponível)
          const footerY = height - Math.round(height * 0.035);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = `500 ${Math.round(width * 0.018)}px Inter, Arial, sans-serif`;
          ctx.textAlign = 'center';
          const footerPieces: string[] = [];
          if (tenantName) footerPieces.push(String(tenantName).trim());
          if (tenantSlug) footerPieces.push(`/canal-etico/${tenantSlug}`);
          footerPieces.push('Desenvolvido por Opiina');
          ctx.fillText(footerPieces.join(' • '), width / 2, footerY);

          // Pequeno logo Opiina no rodapé esquerdo (se tiver)
          if (assets.logoImg) {
            const logoH = Math.round(height * 0.028);
            const ratio = assets.logoImg.width / assets.logoImg.height;
            const logoW = Math.round(logoH * ratio);
            ctx.drawImage(assets.logoImg, padX, footerY - logoH - 2, logoW, logoH);
          }

          setReady(true);
        };
        qrImg.onerror = () => {
          setError('Falha ao gerar QR Code');
        };
        qrImg.src = assets.qrDataUrl;
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e?.message ?? 'Erro ao renderizar cartaz'));
      });

    return () => {
      cancelled = true;
    };
  }, [assetsKey, height, tenantName, tenantSlug, url, width]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    const slug = tenantSlug ? tenantSlug.replace(/[^a-z0-9-_]+/gi, '') : 'canal-etico';
    a.download = `cartaz-canal-de-denuncias-${slug}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="grid w-full gap-3">
      <div className="overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-1 ring-slate-200">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block h-auto w-full"
          style={{ maxWidth: '100%' }}
        />
      </div>
      {error && <div className="text-sm text-rose-700">{error}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={downloadPng} disabled={!ready}>
          {ready ? 'Baixar cartaz em PNG (impressão)' : 'Gerando cartaz...'}
        </Button>
        <span className="text-xs text-slate-500">
          Tamanho: {width} × {height} px · Nível de correção H (permite ícone no centro)
        </span>
      </div>
    </div>
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const { className = '', variant = 'primary', ...rest } = props;
  const base =
    'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const color =
    variant === 'secondary'
      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      : 'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800';
  return <button className={`${base} ${color} ${className}`} {...rest} />;
}
