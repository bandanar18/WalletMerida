import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button, Card, ErrorBox, Loading } from '../components/ui';
import { referralLink } from '../lib/format';
import { useAgent } from '../lib/queries';

const SHARE_TEXT = (name: string, link: string) =>
  `¡Juega en la Lotería Fortuna.Bet con ${name}! Regístrate con mi código aquí: ${link} (+18 · Juega con responsabilidad · DEMO)`;

export function MyCodePage() {
  const agent = useAgent();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const code = agent.data?.code ?? null;
  const link = code ? referralLink(code) : '';

  useEffect(() => {
    if (!link) return;
    void QRCode.toDataURL(link, { width: 640, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0B3D1F', light: '#FFFFFF' } }).then(setQr);
  }, [link]);

  if (agent.isLoading) return <Loading />;
  if (agent.error) return <ErrorBox error={agent.error} />;
  if (!code) return <ErrorBox error={new Error('Tu agencia no tiene un código activo.')} />;
  const name = agent.data!.displayName;

  const copy = async (what: string, label: string) => {
    try {
      await navigator.clipboard.writeText(what);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied('No se pudo copiar');
    }
  };

  const share = async () => {
    const text = SHARE_TEXT(name, link);
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text });
        return;
      } catch {
        /* cancelado: seguimos a WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const download = () => (qr ? void downloadCard(qr, name, code) : undefined);

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <p className="text-sm font-semibold text-slate-500">Tu código</p>
        <div className="mx-auto mt-3 aspect-square w-full max-w-64 rounded-2xl bg-white p-2 ring-1 ring-brand-100">
          {qr ? <img src={qr} alt={`Código QR de ${name}`} className="h-full w-full" /> : <Loading />}
        </div>
        <button onClick={() => void copy(code, 'Código copiado')} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2" aria-label="Copiar código">
          <span className="tabular text-2xl font-extrabold tracking-widest text-brand-900">{code}</span>
          <span className="text-sm font-semibold text-brand-700">Copiar</span>
        </button>
        <p className="mt-4 text-sm text-slate-600">
          Quien escanee este código queda registrado contigo y ganas el <strong>3 %</strong> de sus jugadas.
        </p>
      </Card>

      <Button onClick={() => void share()}>Compartir por WhatsApp</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => void copy(link, 'Enlace copiado')}>
          Copiar enlace
        </Button>
        <Button variant="ghost" onClick={download} disabled={!qr}>
          Descargar imagen
        </Button>
      </div>
      {copied && (
        <p role="status" className="text-center text-sm font-semibold text-brand-700">
          {copied}
        </p>
      )}
      <p className="break-all text-center text-xs text-slate-400">{link}</p>
    </div>
  );
}

/** Tarjeta PNG lista para estados o imprimir: QR, código, nombre y leyenda legal. */
async function downloadCard(qrDataUrl: string, name: string, code: string) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0B3D1F';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#F5C518';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Fortuna.Bet · Agencia Virtual', W / 2, 110);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(name, W / 2, 200, W - 120);

  const img = new Image();
  img.src = qrDataUrl;
  await img.decode();
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, 190, 260, 700, 700, 40);
  ctx.drawImage(img, 220, 290, 640, 640);

  ctx.fillStyle = '#F5C518';
  ctx.font = 'bold 88px system-ui, sans-serif';
  ctx.fillText(code, W / 2, 1080);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '40px system-ui, sans-serif';
  ctx.fillText('Escanea y regístrate para jugar', W / 2, 1160);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillText('+18 · Juega con responsabilidad · DEMO sin valor real', W / 2, 1270);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `agencia-${code}.png`;
  a.click();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
