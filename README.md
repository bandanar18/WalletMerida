# Wallet de Agencias Virtuales (Fortuna.Bet)

> ⚠️ **DEMO.** Las comisiones no tienen valor real (igual que la Lotería).

Aplicación **aparte** de la Lotería, para las agencias: código de afiliado con QR, comisiones del 3 % en tiempo real, referidos y paso de comisiones al saldo de juego. Se conecta a la API de la Lotería (`../Loteria`) y usa la **misma cuenta** que la Lotería.

Diseño completo: [DOCUMENTO_MAESTRO_WALLET.md](DOCUMENTO_MAESTRO_WALLET.md).

## Cómo correrla

Requisitos: la Lotería encendida (`npm run dev` en `../Loteria`: base de datos, API en :3000 y web en :5173).

```bash
npm install
```

```bash
copy .env.example .env
```

```bash
npm run dev
```

Abrir http://localhost:5174. En desarrollo aparecen accesos rápidos de prueba (cuentas `SEED_*` de la Lotería).

## Cómo se conecta con la Lotería

| Qué | Cómo |
|---|---|
| Cuenta / sesión | `POST /api/v1/auth/login` de la Lotería; renovación con la cookie httpOnly de la Lotería |
| Datos de la agencia | `/api/v1/agent/*` (módulo `affiliate` de la API de la Lotería) |
| Tiempo real | Socket.IO de la Lotería (`/api/v1/socket.io`): eventos `commission`, `balance`, `referral` |
| QR / enlace | `VITE_LOTERIA_URL/r/<código>` → la web de la Lotería guarda el código y abre el registro con «Te invitó: …» |

En desarrollo, Vite reenvía `/api` a `LOTERIA_API_URL`. En producción, la Wallet se sirve en su propio dominio con un proxy inverso de `/api` hacia la API de la Lotería.

> **Nota de desarrollo:** como las dos apps corren en `localhost`, comparten la cookie de sesión: entrar con otra cuenta en una cambia la sesión de la otra. En producción (dominios distintos) cada app tiene su propia sesión.

## Pantallas

Inicio (disponible / por liberar, hoy, referidos, últimas comisiones, pasar a saldo de juego) · Mi código (QR, copiar, WhatsApp, imagen descargable) · Referidos · Movimientos. «Retirar por Pago Móvil» y «Mis Pago Móvil» llegan en la Fase 3.
