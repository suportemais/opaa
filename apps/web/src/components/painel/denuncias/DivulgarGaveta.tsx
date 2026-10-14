import * as QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { Icone } from '../Icone';

const ICONE_CENTRO = '/icon-opiina.png';

function carregarImagem(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** QR Code em PNG com o ícone da Opiina no centro (mesmo visual do QrCode do app). */
async function gerarQrPng(valor: string, tamanho: number) {
  const base: string = await QRCode.toDataURL(valor, { width: tamanho, margin: 2, errorCorrectionLevel: 'H' } as never);
  const [qr, icone] = await Promise.all([carregarImagem(base), carregarImagem(ICONE_CENTRO)]);
  if (!qr) return base;
  const canvas = document.createElement('canvas');
  canvas.width = qr.naturalWidth;
  canvas.height = qr.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base;
  ctx.drawImage(qr, 0, 0);
  if (icone) {
    const fundo = Math.round(canvas.width * 0.26);
    const lado = Math.round(canvas.width * 0.2);
    const c = canvas.width / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(c, c, fundo / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(icone, c - lado / 2, c - lado / 2, lado, lado);
  }
  return canvas.toDataURL('image/png');
}

/** "Divulgar o canal": link, QR Code e PNG para imprimir (gaveta do protótipo). */
export function DivulgarGaveta({
  aberta,
  onFechar,
  slug,
  empresa,
  carregando,
  erro,
  avisar,
}: {
  aberta: boolean;
  onFechar: () => void;
  slug: string;
  empresa: string;
  carregando: boolean;
  erro: boolean;
  avisar: (t: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<string | null>(null);

  const origem = typeof window !== 'undefined' ? window.location.origin : '';
  const caminho = slug ? `/canal-etico/${slug}` : '';
  const caminhoAlt = slug ? `/whistleblower/${slug}` : '';
  const link = caminho ? `${origem}${caminho}` : '';

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (aberta && !dlg.open) {
      dlg.showModal();
      tituloRef.current?.focus();
    }
    if (!aberta && dlg.open) dlg.close();
  }, [aberta]);

  useEffect(() => {
    let cancelado = false;
    setQr(null);
    if (!aberta || !link) return;
    gerarQrPng(link, 480)
      .then((url) => {
        if (!cancelado) setQr(url);
      })
      .catch(() => {
        if (!cancelado) setQr(null);
      });
    return () => {
      cancelado = true;
    };
  }, [aberta, link]);

  const fechar = () => ref.current?.close();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      avisar('Link do canal copiado');
    } catch {
      linkRef.current?.select();
      avisar('Selecione e copie o link (Ctrl+C)');
    }
  }

  async function baixar() {
    try {
      const url = await gerarQrPng(link, 1024);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode-canal-de-denuncias${slug ? `-${slug}` : ''}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      avisar('QR Code baixado');
    } catch {
      avisar('Não foi possível gerar a imagem');
    }
  }

  return (
    <dialog
      ref={ref}
      className="gaveta"
      aria-labelledby="dv-titulo"
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div className="gaveta__corpo">
        <div className="gaveta__topo">
          <h2 className="cfg-gaveta__titulo" id="dv-titulo" tabIndex={-1} ref={tituloRef}>
            Divulgar o canal
          </h2>
          <button className="botao-icone" type="button" aria-label="Fechar" onClick={fechar}>
            <Icone nome="fechar" />
          </button>
        </div>
        <p className="cartao__sub">
          Coloque o link ou o QR Code onde a equipe vê: murais, intranet, e-mails, grupo da equipe.
          {empresa ? (
            <>
              {' '}
              Empresa: <strong>{empresa}</strong>
              {slug ? ` (${slug})` : ''}.
            </>
          ) : null}
        </p>

        <ul className="den-garantias">
          <li>
            <Icone nome="ok" />
            Aberto a qualquer pessoa, sem login
          </li>
          <li>
            <Icone nome="ok" />
            Quem denuncia escolhe se quer se identificar
          </li>
          <li>
            <Icone nome="ok" />
            Cada denúncia recebe um protocolo
          </li>
        </ul>

        {carregando && <p className="campo__dica">Carregando o link do canal…</p>}
        {erro && (
          <p className="cli__erro cli__erro--geral" role="alert">
            Falha ao carregar as informações da empresa.
          </p>
        )}

        <div className="campo">
          <label htmlFor="dv-link">Link do canal</label>
          <div className="den-link">
            <input id="dv-link" ref={linkRef} type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn--primario" type="button" onClick={copiar} disabled={!link}>
              <Icone nome="link" />
              Copiar
            </button>
          </div>
          {caminho && (
            <a className="btn btn--fantasma den-abrir" href={caminho} target="_blank" rel="noreferrer">
              Abrir o canal e ver como a equipe vê
            </a>
          )}
          {caminhoAlt && (
            <p className="campo__dica">
              Link alternativo:{' '}
              <a href={caminhoAlt} target="_blank" rel="noreferrer">
                {caminhoAlt}
              </a>
            </p>
          )}
        </div>

        <div className="den-qr">
          <div className="den-qr__imagem">
            {qr ? (
              <img src={qr} alt="QR Code do canal de denúncias" width={124} height={124} />
            ) : (
              <div className="den-qr__vazio" aria-hidden="true" />
            )}
          </div>
          <div>
            <strong>QR Code para imprimir</strong>
            <p>Quem aponta a câmera do celular abre o canal. Teste antes de imprimir.</p>
            <button className="btn btn--secundario" type="button" onClick={baixar} disabled={!link}>
              Baixar imagem (PNG)
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
