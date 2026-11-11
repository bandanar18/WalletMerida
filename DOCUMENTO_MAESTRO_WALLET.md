# Wallet de Agencias Virtuales — Documento Maestro

> **Versión:** 1.1 · **Fecha:** 10-11-2026 · **Estado:** aprobado — Fase 1 (núcleo backend) implementada en la rama `feature/agencias-virtuales` de la Lotería
> **Sistema vinculado:** Plataforma de Lotería *FortunaBet* — `C:\Users\Jesus\Desktop\Proyectos con Claude\Loteria`
> **Referencias:** `Loteria/README.md`, `Loteria/docs/Animalitos_de_Merida_MER-05.md` (§12 *Programa de Agencias Virtuales*), infografía «Programa de Agencias Virtuales».

> ⚠️ **Aplicación DEMO.** La plataforma de lotería opera hoy en modo demostración, sin valor real ni autorización de ningún ente regulador. La Wallet hereda esa condición: **las comisiones no tienen valor real** hasta que exista licencia (CNC / CONALOT) y asesoría legal. Todo lo que aquí se describe debe poder funcionar en modo DEMO.

Leyenda: **[D]** decisión de este documento · **[⚠]** riesgo o inconsistencia detectada · **[?]** pendiente de confirmar con la operadora.

### Estado de implementación

| Fase | Estado | Dónde |
|---|---|---|
| 1 – Núcleo backend | ✅ Hecha (sin commit) | Rama `feature/agencias-virtuales` del repo `Loteria` |
| 2 – Wallet MVP (app aparte) + `/r/:code` y campo en registro | ✅ Hecha (sin commit) | App en esta carpeta (`WalletLoteria`, puerto 5174); cambios de la web en la rama de la Lotería |
| 3 – Directorio de Pago Móvil, SMS, tasa BCV, retiros en Bs, backoffice | ⏳ Pendiente (migración `021`) | — |
| 4 – Crecimiento | ⏳ Pendiente | — |

**Fase 2 incluye:** app React aparte en `WalletLoteria/` (entrar con la cuenta de la Lotería, crear agencia, Inicio, Mi código con QR/WhatsApp/imagen, Referidos, Movimientos, pasar a saldo de juego, avisos en tiempo real) y, en la web de la Lotería, la ruta `/r/:code` y el campo «Código de agencia» con «Te invitó: …». Instalable como PWA (manifiesto); sin modo sin conexión todavía.

**Fase 1 incluye:** `packages/domain/src/affiliate.ts` (+ tests), migración `020_affiliates.sql`, módulo `apps/api/src/affiliate/` (activar agencia, código/QR, resumen, historial, referidos, movimientos, rotar código, pasar a saldo de juego, backoffice de agencias y tasas), integración en registro, venta, anulación de ticket, liquidación y anulación de sorteo, y `scripts/smoke-agencias.mjs`.

**Diferencias con el diseño (decididas al implementar):**
- Las cuentas de la agencia **no** usan un `owner_type` nuevo: son cuentas del mismo usuario (`owner_type = 'PLAYER'`) con tipos `AGENT_PENDING` y `AGENT_CASH`. Así heredan el `CHECK` de saldo ≥ 0 sin tocar las restricciones existentes. `/me/transactions` del jugador las excluye. `AGENT_LOCKED` y `HOUSE_FX` se agregan en la Fase 3.
- Los avisos en tiempo real van a la sala existente `player:<userId>` (eventos `commission`, `referral`, `balance`) en lugar de una sala `agent:<id>`: el usuario ya está unido a ella al conectarse.
- La regla K11 se aplica con el margen calculado por modalidad (`modalityMarginBps`). Carga inicial: 3 % general y **0 % en Terminal Nevado (MER-04)** por su margen 0 %.
- Topes iniciales (K10): Bs 5.000 y 50 USDT de comisión por jugada; sin tope diario.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Glosario](#2-glosario)
3. [Cómo funciona (flujo de punta a punta)](#3-cómo-funciona-flujo-de-punta-a-punta)
4. [Reglas de negocio](#4-reglas-de-negocio)
5. [Directorio de Pago Móvil](#5-directorio-de-pago-móvil)
6. [Arquitectura y vinculación con la Lotería](#6-arquitectura-y-vinculación-con-la-lotería)
7. [Modelo de datos](#7-modelo-de-datos)
8. [Contabilidad (ledger de doble partida)](#8-contabilidad-ledger-de-doble-partida)
9. [Puntos de integración en el código de la Lotería](#9-puntos-de-integración-en-el-código-de-la-lotería)
10. [API](#10-api)
11. [Interfaz de la Wallet (simple y fácil de usar)](#11-interfaz-de-la-wallet-simple-y-fácil-de-usar)
12. [Cambios en la app de Lotería (jugador)](#12-cambios-en-la-app-de-lotería-jugador)
13. [Backoffice de agencias](#13-backoffice-de-agencias)
14. [Seguridad y antifraude](#14-seguridad-y-antifraude)
15. [Cumplimiento y juego responsable](#15-cumplimiento-y-juego-responsable)
16. [Pruebas](#16-pruebas)
17. [Plan de entrega por fases](#17-plan-de-entrega-por-fases)
18. [Preguntas abiertas](#18-preguntas-abiertas)

---

## 1. Resumen ejecutivo

La **Wallet de Agencias Virtuales** es una aplicación móvil (web instalable, PWA) para que cualquier persona mayor de edad se registre como **Agencia**, obtenga un **código de afiliado con su QR**, lo comparta, y **gane el 3 % de cada jugada** que hagan los jugadores que se registraron con ese código, en **todos los juegos** de la Lotería.

| Pregunta | Respuesta corta |
|---|---|
| ¿Qué gana la agencia? | **3 % del monto apostado** en cada jugada de sus referidos, gane o pierda el jugador. |
| ¿Cuándo lo ve? | **Al instante**: la comisión aparece en la Wallet en el momento de la jugada como «Por liberar». |
| ¿Cuándo la puede usar? | Cuando el sorteo de esa jugada se liquida (normalmente en menos de 1 hora). Pasa a «Disponible». |
| ¿Cómo la retira? | **Siempre en bolívares, por Pago Móvil**, a una de las cuentas que guardó en su **Directorio de Pago Móvil** (con verificación de identidad). Las comisiones en USDT se convierten a Bs a la tasa del día al retirar. También puede pasarlas **al instante** a su saldo de juego en la Lotería (sin mínimo). |
| ¿Quién paga la comisión? | **La casa, de su margen.** Nunca se descuenta del premio ni de la apuesta del jugador. |
| ¿Cuánto cuesta ser agencia? | Nada. Sin inversión. |
| ¿Cómo se vincula con la Lotería? | **Misma cuenta, misma base de datos, mismo ledger.** La comisión se registra en la misma transacción que la jugada: o se guardan las dos o ninguna. |

**Principios de diseño [D]**

1. **Simple primero.** 4 pantallas, un botón principal por pantalla, textos cortos, números grandes.
2. **Exactitud contable.** Todo movimiento de dinero pasa por `LedgerService.post` (doble partida, idempotente, inmutable), igual que el resto de la plataforma.
3. **La comisión nunca se inventa.** Se calcula en el servidor, a partir de la jugada guardada, con la tasa vigente en ese momento, y queda congelada.
4. **Sin sorpresas para el jugador.** Ser referido no cambia precios, premios ni límites del jugador.

---

## 2. Glosario

| Término | Significado |
|---|---|
| **Agencia** (agente, afiliado) | Usuario registrado que tiene un código de afiliado y cobra comisiones. |
| **Código de afiliado** | Identificador corto y único de la agencia, p. ej. `FB-7K3Q9X`. Se comparte como texto, enlace o QR. |
| **Referido** | Jugador que se registró en la Lotería usando el código de una agencia. |
| **Jugada** | Cada línea de un ticket (`lottery.play`): un sorteo + una selección + un monto. Un ticket puede tener varias jugadas. |
| **Base de comisión** | Monto apostado de la jugada (`lottery.play.amount`). |
| **Comisión por liberar** | Comisión ya generada cuya jugada aún no se liquidó. No se puede retirar. |
| **Comisión disponible** | Comisión liberada; se puede retirar. |
| **Liberación** | Paso de «por liberar» a «disponible», al liquidarse el sorteo de la jugada. |
| **Reverso** | Anulación de una comisión por liberar porque la jugada se anuló (ticket anulado por el jugador o sorteo anulado). |
| **bps** | Puntos básicos: 300 bps = 3,00 %. Las tasas se guardan como enteros en bps para no usar decimales. |

---

## 3. Cómo funciona (flujo de punta a punta)

```
 AGENCIA                         JUGADOR                         SISTEMA
 ───────                         ───────                         ───────
 1. Se registra como agencia
    en la Wallet  ─────────────────────────────────────────────▶ crea agente + código FB-7K3Q9X
 2. Comparte su QR / enlace ──▶ 3. Escanea el QR
                                   https://<lotería>/r/FB7K3Q9X ▶ guarda el código (30 días)
                                4. Se registra en la Lotería ──▶ vincula jugador → agencia (permanente)
                                5. Deposita y juega en
                                   cualquier juego ────────────▶ en la MISMA transacción del ticket:
                                                                  · cobra la apuesta al jugador
                                                                  · registra comisión 3 % «por liberar»
 6. Ve «+Bs 30 por liberar»  ◀──────────────────────────────────  aviso en tiempo real (socket)
                                                                 7. El sorteo se liquida ──▶ comisión «disponible»
 8. Ve «+Bs 30 disponible»   ◀──────────────────────────────────
 9. Retira: a su saldo de jugador (inmediato) o a su banco
```

Si el jugador **anula** su ticket (dentro de los 5 minutos permitidos) o la operadora **anula el sorteo**, la comisión por liberar de esas jugadas se **reversa** y la agencia lo ve en su historial como «Jugada anulada −Bs 30».

---

## 4. Reglas de negocio

### 4.1 Registro de agencia

| # | Regla |
|---|---|
| R1 | Cualquier usuario de la Lotería (rol `PLAYER`, mayor de 18, cuenta activa, no autoexcluido) puede activar su agencia con un toque. **No es una cuenta nueva**: usa el mismo correo y contraseña de la Lotería. [D] |
| R2 | Quien no tenga cuenta se registra desde la Wallet con el mismo formulario de la Lotería (cédula, fecha de nacimiento, teléfono VE, correo) y queda con ambas cosas: cuenta de jugador y agencia. |
| R3 | Debe aceptar los **Términos del Programa de Agencias** (versión guardada con fecha). |
| R4 | Una persona = una agencia (único por `user_id`). |
| R5 | La agencia puede generar comisiones desde el primer día; **para retirar al banco** necesita KYC nivel 2 (igual que los retiros de jugador). Transferir a su propio saldo de jugador no exige KYC 2. [D] |
| R6 | Estados de la agencia: `ACTIVE`, `SUSPENDED` (no genera comisiones nuevas ni retira; conserva el historial), `CLOSED`. |

### 4.2 Código de afiliado y QR

| # | Regla |
|---|---|
| C1 | Formato: prefijo `FB-` + 6 caracteres **Crockford Base32** (sin `I`, `L`, `O`, `U` para evitar confusiones). Ej.: `FB-7K3Q9X`. ≈ 1.070 millones de combinaciones. |
| C2 | Se genera con el CSPRNG del servidor (`crypto.randomInt`), nunca `Math.random()`. Único en BD; si choca, se regenera. |
| C3 | Al escribirlo se acepta sin guion, en minúsculas y con `O`→`0`, `I`/`L`→`1` (normalización). |
| C4 | El QR codifica un **enlace**, no solo el código: `https://<dominio-lotería>/r/FB7K3Q9X`. Así cualquier cámara lo abre sin app especial. |
| C5 | La agencia puede **regenerar** su código (p. ej. si lo publicó por error). El código anterior queda inactivo para **nuevos** registros; los referidos ya vinculados se mantienen. Máximo 1 cambio cada 30 días. |
| C6 | (Fase 2) Etiquetas de campaña opcionales: `/r/FB7K3Q9X?c=whatsapp` para que la agencia sepa qué canal le trae más jugadores. |

### 4.3 Vinculación jugador → agencia (atribución)

| # | Regla |
|---|---|
| A1 | Al abrir `/r/<código>`, la Lotería valida el código y lo guarda en el navegador **30 días** (cookie + `localStorage`). Luego lleva al registro. |
| A2 | El formulario de registro muestra el campo **«Código de agencia (opcional)»** ya rellenado y editable, con el nombre comercial de la agencia como confirmación: *«Te invitó: Agencia Los Andes»*. |
| A3 | La vinculación ocurre **solo al registrarse** y es **permanente** e **inmutable** (la agencia cobra por todas las jugadas futuras del jugador). [D] [?] — ver §18 si se desea vencimiento. |
| A4 | Un jugador ya registrado **no** puede cambiarse de agencia ni agregar una después. (Excepción: soporte puede asignarla dentro de las primeras 72 h si el jugador demuestra que olvidó escribir el código; queda en auditoría.) |
| A5 | **Autorreferido prohibido:** no se vincula si el jugador es la misma persona que la agencia (mismo `user_id`, misma cédula o mismo teléfono). |
| A6 | Código inválido, inactivo o de agencia suspendida → el registro **continúa sin agencia** (nunca se bloquea el registro por un código malo); se muestra «Código no válido, puedes continuar sin él». |

### 4.4 Comisión

| # | Regla |
|---|---|
| K1 | **Tasa: 3 % (300 bps)** del monto apostado de cada jugada. Configurable desde el backoffice por juego/producto; la tasa aplicada queda **congelada** en cada comisión (un cambio futuro no altera comisiones ya generadas). |
| K2 | **Base: `lottery.play.amount`** (lo apostado), sin importar si la jugada gana o pierde. |
| K3 | **Cálculo:** `comisión = floor(monto × bps / 10000)` en unidades mínimas (`bigint`). Ej.: jugada de Bs 100,00 = `10000` céntimos → `10000 × 300 / 10000 = 300` → **Bs 3,00**. Si el resultado es 0 (jugadas de menos de Bs 0,34), no se registra comisión. |
| K4 | **Moneda:** la comisión se genera en la moneda de la jugada (VES o USDT) y la agencia tiene saldo separado por moneda. **Al retirar, todo se paga en bolívares**: el saldo en USDT se convierte a Bs con la tasa vigente en el momento de la solicitud (ver §4.5). |
| K5 | **Juegos con comisión:** todos los juegos de lotería (Animalitos de Mérida, Frutas del Páramo, Triple Andino, Kino Teleférico, Terminal Nevado y los que se agreguen) y deportes cuando se reactive. **Futuros no genera comisión** en v1 (no es una «jugada» y el 3 % del nocional superaría el margen). [D] |
| K6 | **No generan comisión:** tickets de simulación (`is_simulation = true`), jugadas de modalidades `PENDING_APPROVAL`, jugadas de jugadores sin al menos **un depósito aprobado** (protege contra granjas de cuentas con el bono de bienvenida), y jugadas hechas mientras la agencia estaba `SUSPENDED`. [D] |
| K7 | **Estados:** `PENDING` (por liberar) → `RELEASED` (disponible) o `REVERSED` (anulada). Una comisión nunca vuelve atrás. |
| K8 | **Liberación:** cuando el sorteo de la jugada se liquida (`settleDraw`), sus comisiones pasan a `RELEASED`. En deportes: al liquidarse la apuesta. |
| K9 | **Reverso:** si la jugada termina `VOID` (ticket anulado por el jugador o sorteo anulado), la comisión `PENDING` pasa a `REVERSED` y el dinero vuelve a la casa. |
| K10 | **Topes (anti-abuso, configurables):** máximo por jugada (p. ej. equivalente a Bs 5.000) y máximo diario por agencia. Lo que exceda el tope no se paga y queda marcado en el reporte. [?] valores |
| K11 | **[⚠] Margen mínimo:** la tasa de comisión **debe ser menor que el margen de la casa** de cada modalidad. El backoffice valida `bps < (1 − RTP) × 10000` al guardar la tasa. **Terminal Nevado – Terminal directo** paga 100× sobre 100 números (RTP 100 %, margen 0 %): con 3 % de comisión la casa pierde dinero en esa modalidad. Se debe ajustar el factor o excluir la modalidad de la comisión antes de activar el programa. |

**Ejemplo con los números de la infografía.** La infografía muestra «+Bs 25.000 por jugada». Con 3 %, eso exige una jugada de **Bs 833.333**. **[⚠]** El material promocional debe usar ejemplos reales (p. ej. «Tu referido juega Bs 1.000 → tú ganas Bs 30»), o se convierte en publicidad engañosa.

### 4.5 Retiros de la Wallet

**Regla general [D]: el único retiro de dinero es en bolívares (VES) por Pago Móvil.** No hay retiros en USDT, ni a direcciones cripto, ni en efectivo.

| Opción | Destino | Moneda que recibe | Mínimo | Tiempo | Requisito |
|---|---|---|---|---|---|
| **Retirar por Pago Móvil** | Una cuenta del **Directorio de Pago Móvil** de la agencia (§5) | **Siempre Bs** | [?] p. ej. Bs 500, por costo de operación | Cola de caja (mismo flujo de `payments.withdrawal`) | KYC nivel 2 + límites diarios por nivel (`kyc_level_limit`, en VES) |
| **Pasar a mi saldo de juego** (no es un retiro) | `PLAYER_CASH` del mismo usuario en la Lotería, **en la misma moneda** | VES o USDT | Ninguno | **Inmediato** (transacción interna) | Agencia activa |

**Retiro desde el saldo en USDT**

| # | Regla |
|---|---|
| W1 | La agencia elige cuánto retirar de su saldo en USDT y la Wallet le muestra **cuántos Bs recibirá** antes de confirmar: «5,00 USDT × 45,20 = **Bs 226,00**». |
| W2 | **Tasa de cambio:** **la tasa oficial del BCV del día, cargada manualmente por un administrador** en el backoffice. [D] Una sola tasa vigente a la vez, con fecha, autor y auditoría. No hay feed automático. |
| W3 | La tasa queda **congelada en la solicitud** (`fx_rate` en el retiro). Si cambia mientras caja procesa, se paga la tasa congelada. Si el retiro se rechaza, se devuelven los **USDT originales** (no Bs). |
| W4 | Redondeo: `bs = floor(usdt_micro × tasa_x100 / 10⁶)` en céntimos; la fracción sobrante no se cobra a la agencia (se descuenta exactamente el USDT solicitado). |
| W5 | Si no hay tasa cargada para hoy, el retiro desde USDT queda deshabilitado con el mensaje «La tasa del día aún no está disponible». Los retiros desde Bs siguen funcionando. |
| W6 | Los límites diarios de KYC se calculan sobre el **monto en Bs** pagado, sumando ambos orígenes. |

- El monto solicitado queda **bloqueado** (`AGENT_LOCKED`) hasta que caja lo pague o rechace, igual que los retiros de jugador.
- Caja ve en su cola el monto **a pagar en Bs** y los datos del Pago Móvil (banco, teléfono, cédula, titular y parentesco si es familiar), listos para copiar.
- **[⚠]** La infografía promete «Sin montos mínimos» y «Disponible 24/7». Eso solo es cierto para «Pasar a mi saldo de juego». Los retiros por Pago Móvil dependen del horario de caja.
- El Pago Móvil puede ser **de la agencia o de un familiar** registrado en su directorio (ver §5, reglas P1 y P9).

---

## 5. Directorio de Pago Móvil

Cada agencia guarda aquí las cuentas de Pago Móvil donde quiere cobrar: **las suyas o las de un familiar**. Así no tiene que escribir los datos en cada retiro: **elige una de su lista y confirma**. Cada cuenta se confirma con un **código por SMS** antes de guardarse.

### 5.1 Qué guarda cada entrada

| Campo | Ejemplo | Validación |
|---|---|---|
| **Nombre corto** (alias) | «Banesco de mamá» | 1–30 caracteres; único dentro del directorio de la agencia. |
| **¿De quién es?** | Mía · Familiar | Si es **Mía**, nombre y cédula se rellenan solos con los datos de la agencia y no se editan. Si es **Familiar**, se piden los dos campos siguientes. |
| **Parentesco** (solo familiar) | Madre | Lista cerrada: Padre/Madre, Hijo/a, Hermano/a, Cónyuge/Pareja, Abuelo/a, Nieto/a, Tío/a, Sobrino/a, Primo/a, Suegro/a, Cuñado/a. |
| **Nombre y apellido del titular** (solo familiar) | Carmen Pérez | 3–80 caracteres. Caja lo ve para verificar antes de pagar. |
| **Banco** | 0134 – Banesco | Se elige de una **lista cerrada** de bancos venezolanos con Pago Móvil (código de 4 dígitos + nombre). No se escribe a mano. |
| **Teléfono** | 0414-123-4567 | Celular venezolano (0412, 0414, 0416, 0424, 0426…), normalizado con `normalizeVePhone` existente. |
| **Cédula del titular** | V-8.765.432 | Tipo V/E + número (`isValidDocument` existente). Si es **Mía**, debe coincidir con la cédula de la agencia. |
| **Predeterminada** | ✓ | Solo una por agencia; es la que aparece seleccionada al retirar. |

Catálogo inicial de bancos (configurable en backoffice): 0102 Banco de Venezuela · 0104 Venezolano de Crédito · 0105 Mercantil · 0108 Provincial · 0114 Bancaribe · 0115 Exterior · 0128 Caroní · 0134 Banesco · 0137 Sofitasa · 0138 Plaza · 0151 BFC · 0156 100% Banco · 0157 Delsur · 0163 Tesoro · 0166 Agrícola · 0168 Bancrecer · 0169 R4 · 0171 Activo · 0172 Bancamiga · 0174 Banplus · 0175 Bicentenario · 0177 Banfanb · 0191 BNC. [?] confirmar lista vigente.

### 5.2 Reglas

| # | Regla |
|---|---|
| P1 | Máximo **5** cuentas por agencia, de las cuales máximo **3 de familiares**. [D] |
| P2 | No se repite la misma combinación banco + teléfono en el directorio de la agencia. |
| P3 | **Confirmación por SMS:** agregar o editar una cuenta (banco, teléfono, cédula o titular) envía un **código de 6 dígitos** al teléfono **registrado de la agencia** (no al del Pago Móvil). La cuenta solo se guarda al escribir el código. Vence en **5 minutos**, máximo **3 intentos**, máximo **1 reenvío por minuto** y **5 envíos por hora**. Cambiar solo el alias o la predeterminada no pide código. |
| P4 | **Modo DEMO — el SMS no se envía.** Mientras `SMS_ENABLED=false` (por defecto en DEMO), el código se genera, se guarda y se valida igual que en producción, pero en vez de enviarse **se muestra en la pantalla** en un aviso amarillo: «DEMO: no se envió SMS. Tu código es **482913**». Al activar un proveedor de SMS real basta con `SMS_ENABLED=true` y sus credenciales; el flujo no cambia. |
| P5 | Cada vez que se agrega, edita o elimina una cuenta se avisa en la Wallet y por correo: «Se agregó el Pago Móvil Banesco ···4567 (Carmen Pérez, Madre). Si no fuiste tú, escríbenos.» |
| P6 | **Eliminar** es un borrado lógico (`deleted_at`): los retiros pasados conservan los datos con los que se pagaron (copiados en el retiro). |
| P7 | Una cuenta con un retiro **en trámite** no se puede editar ni eliminar hasta que caja lo pague o rechace. |
| P8 | Caja puede marcar una cuenta como **«Datos incorrectos»** al rechazar un retiro (p. ej. el banco devolvió el pago o el nombre no coincide). La cuenta queda inhabilitada hasta que la agencia la corrija (con nuevo código SMS). |
| P9 | **Controles para terceros:** la cédula de un familiar no puede ser la de un **referido** de la misma agencia (evita disfrazar pagos a jugadores) y si la misma cédula aparece en directorios de **2 o más agencias** se genera una alerta 🚩 en el backoffice. Los retiros a familiares cuentan para los límites diarios de KYC de la agencia. |
| P10 | El mismo directorio sirve, en una fase posterior, para los **retiros de jugador** de la Lotería, que hoy escriben el destino en cada solicitud. |

> **[⚠] Pago a terceros.** El manual MER-05 (cláusula 15ª) prohíbe que **terceros sin facultades** cobren *premios*. Las comisiones de agencia no son premios, y la operadora decidió permitir familiares; aun así conviene que los **Términos del Programa de Agencias** digan expresamente que la agencia autoriza el pago a ese familiar y asume la responsabilidad, y confirmarlo con asesoría legal.

### 5.3 Interfaz

Se entra desde **☰ → Mis Pago Móvil** y desde el paso 2 de **Retirar** («+ Agregar otro»).

```
Mis Pago Móvil (3 de 5)            Agregar Pago Móvil              Confirmar
┌──────────────────────────────┐   ┌──────────────────────────────┐ ┌──────────────────────────┐
│ ★ Mi Banesco                 │   │ ¿De quién es?                │ │ Te enviamos un código    │
│   0134 Banesco · Mía         │   │  ( Mía )  (● Familiar )      │ │ por SMS al 0414-***-0011 │
│   0414-***-4567              │   │ Parentesco      [ Madre  ▾ ] │ │                          │
│                    [Editar]  │   │ Nombre y apellido            │ │ ┌──┬──┬──┬──┬──┬──┐      │
├──────────────────────────────┤   │ [ Carmen Pérez             ] │ │ │4 │8 │2 │9 │1 │3 │      │
│   Banesco de mamá            │   │ Cédula                       │ │ └──┴──┴──┴──┴──┴──┘      │
│   0134 · Carmen P. (Madre)   │   │ [ V ▾ ][ 8765432           ] │ │ ┌──────────────────────┐ │
│   0424-***-8899              │   │ Banco                        │ │ │      CONFIRMAR       │ │
├──────────────────────────────┤   │ [ 0134 – Banesco         ▾ ] │ │ └──────────────────────┘ │
│   BDV de mi hermano          │   │ Teléfono                     │ │ Reenviar código (0:45)   │
│   0102 · Luis P. (Hermano)   │   │ [ 0424 123 8899            ] │ │ ┌──────────────────────┐ │
│   0412-***-2233              │   │ Nombre corto                 │ │ │ DEMO: no se envió SMS│ │
├──────────────────────────────┤   │ [ Banesco de mamá          ] │ │ │ Tu código es 482913  │ │
│ ┌──────────────────────────┐ │   │ ☐ Usar como predeterminada   │ │ └──────────────────────┘ │
│ │  + AGREGAR PAGO MÓVIL    │ │   │ ┌──────────────────────────┐ │ └──────────────────────────┘
│ └──────────────────────────┘ │   │ │   ENVIAR CÓDIGO SMS ▶    │ │
└──────────────────────────────┘   │ └──────────────────────────┘ │
                                   └──────────────────────────────┘
```
- Si elige **Mía**, desaparecen Parentesco, Nombre y Cédula editables y se muestra «Cédula: V-20.111.111 🔒».
- El recuadro amarillo «DEMO» solo aparece mientras el SMS está desactivado.

Estado vacío: «Aún no tienes Pago Móvil guardados. Agrega uno para poder retirar.» + botón **Agregar Pago Móvil**.

---

## 6. Arquitectura y vinculación con la Lotería

### 6.1 Decisión [D]: módulo dentro del mismo backend + app de Wallet separada

```
┌──────────────────────────┐      ┌──────────────────────────┐
│  App Lotería (jugador)   │      │  App Wallet (agencia)     │
│  apps/web  :5173         │      │  WalletLoteria  :5174     │
│  React + Vite + Tailwind │      │  React + Vite + Tailwind  │
│  + captura /r/<código>   │      │  PWA instalable           │
└────────────┬─────────────┘      └────────────┬─────────────┘
             │  HTTPS + JWT (mismo login)       │
             ▼                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                    API NestJS  (apps/api :3000)               │
│  identity · wallet/ledger · lottery · payments · kyc · audit  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  NUEVO  affiliate/   (agentes, códigos, comisiones)    │   │
│  └────────────────────────────────────────────────────────┘   │
│  realtime (socket.io + pg_notify) → sala  agent:<id>          │
└───────────────────────────────┬──────────────────────────────┘
                                ▼
                    PostgreSQL 16 (mismo esquema)
              + esquema nuevo  affiliate
```

**Por qué así y no como sistema aparte:**

- **Atomicidad.** La comisión se escribe en la **misma transacción SQL** que la jugada (`BET_PLACED`). Si la jugada falla, no hay comisión; si la comisión falla, no hay jugada. Con un servicio separado habría que manejar colas, reintentos y descuadres.
- **Un solo ledger** con su invariante Σ D = Σ C, reconciliación y auditoría encadenada ya construidas.
- **Un solo inicio de sesión.** La agencia entra a la Wallet con su cuenta de la Lotería (mismo JWT, mismo refresh token en cookie httpOnly).
- **Transferencia inmediata** Wallet → saldo de juego es solo un asiento contable entre dos cuentas del mismo usuario.

**Ubicación del código**

| Pieza | Dónde |
|---|---|
| Backend `affiliate` (controladores, servicio, reglas) | `Loteria/apps/api/src/affiliate/` |
| Reglas puras (cálculo, código, normalización) + tests | `Loteria/packages/domain/src/affiliate.ts` |
| Migración SQL | `Loteria/apps/api/migrations/020_affiliates.sql` |
| Frontend Wallet | Este repositorio `WalletLoteria/` (o `Loteria/apps/wallet` si se prefiere el monorepo; recomendado el monorepo para compartir `@loteria/domain` y tipos) [?] |
| Captura del código y campo en registro | `Loteria/apps/web` (`/r/:code`, `pages/Auth.tsx`) |
| Backoffice de agencias | `Loteria/apps/web/src/pages/admin/Agencies.tsx` |

> **Futuro (si se separa):** si algún día la Wallet debe ser un sistema independiente, el punto de corte es un **outbox** (`affiliate.outbox` con eventos `PLAY_PLACED`, `PLAY_SETTLED`, `PLAY_VOIDED`) escrito en la misma transacción, que el otro sistema consume de forma idempotente. No se recomienda para v1.

### 6.2 Stack de la Wallet

Igual que la Lotería para no duplicar conocimiento: **React 19 + Vite 7 + Tailwind 4 + TanStack Query + react-router 7 + socket.io-client**. Agregados:

- `qrcode` (generar QR en el cliente como SVG/PNG, sin servicios externos).
- `vite-plugin-pwa` (instalable, ícono en el teléfono, funciona con mala señal mostrando el último saldo).
- API Web Share (`navigator.share`) para compartir a WhatsApp/Telegram con un toque.

---

## 7. Modelo de datos

Migración `020_affiliates.sql` (montos `BIGINT` en unidades mínimas; fechas `TIMESTAMPTZ` UTC; mismas convenciones que `001_init.sql`).

```sql
CREATE SCHEMA IF NOT EXISTS affiliate;

-- Agencia: perfil sobre un usuario existente (no es otra cuenta de acceso).
CREATE TABLE affiliate.agent (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL UNIQUE REFERENCES identity.app_user (id),
  display_name     text NOT NULL,                 -- «Agencia Los Andes» (visible al referido)
  status           text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  terms_version    text NOT NULL,
  terms_accepted_at timestamptz NOT NULL,
  suspended_reason text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Códigos: historial de códigos de la agencia; solo uno activo a la vez.
CREATE TABLE affiliate.code (
  code        text PRIMARY KEY,                   -- normalizado, sin guion: 'FB7K3Q9X'
  agent_id    uuid NOT NULL REFERENCES affiliate.agent (id),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  retired_at  timestamptz
);
CREATE UNIQUE INDEX code_one_active_uq ON affiliate.code (agent_id) WHERE active;

-- Vinculación jugador → agencia (una por jugador, inmutable).
CREATE TABLE affiliate.referral (
  player_id   uuid PRIMARY KEY REFERENCES identity.app_user (id),
  agent_id    uuid NOT NULL REFERENCES affiliate.agent (id),
  code        text NOT NULL REFERENCES affiliate.code (code),
  source      text NOT NULL DEFAULT 'SIGNUP' CHECK (source IN ('SIGNUP', 'SUPPORT')),
  campaign    text,                                -- ?c=whatsapp (fase 2)
  created_by  uuid REFERENCES identity.app_user (id), -- staff, si source = SUPPORT
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_agent_idx ON affiliate.referral (agent_id, created_at DESC);
CREATE TRIGGER referral_immutable BEFORE UPDATE OR DELETE ON affiliate.referral
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Tasas por producto/juego. game_id NULL = tasa por defecto del producto.
CREATE TABLE affiliate.rate (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product     text NOT NULL CHECK (product IN ('LOTTERY', 'SPORTS')),
  game_id     uuid REFERENCES lottery.game (id),
  rate_bps    integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 2000),
  valid_from  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid NOT NULL REFERENCES identity.app_user (id)
);
-- Tasa vigente = la de valid_from más reciente <= now() (más específica primero: juego > producto).

-- Comisión: una fila por jugada comisionable.
CREATE TABLE affiliate.commission (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES affiliate.agent (id),
  player_id     uuid NOT NULL REFERENCES identity.app_user (id),
  product       text NOT NULL CHECK (product IN ('LOTTERY', 'SPORTS')),
  play_id       uuid,                              -- lottery.play.id
  bet_id        uuid,                              -- sports (fase posterior)
  ticket_id     uuid,
  draw_id       uuid,
  game_id       uuid,
  currency      text NOT NULL REFERENCES wallet.currency (code),
  base_amount   bigint NOT NULL CHECK (base_amount > 0),
  rate_bps      integer NOT NULL,                  -- congelada
  amount        bigint NOT NULL CHECK (amount > 0),
  capped        boolean NOT NULL DEFAULT false,    -- se recortó por tope
  status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RELEASED', 'REVERSED')),
  accrual_tx_id uuid NOT NULL REFERENCES wallet.ledger_transaction (id),
  final_tx_id   uuid REFERENCES wallet.ledger_transaction (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  finalized_at  timestamptz,
  UNIQUE (product, play_id),
  CHECK (num_nonnulls(play_id, bet_id) = 1)
);
CREATE INDEX commission_agent_idx  ON affiliate.commission (agent_id, created_at DESC);
CREATE INDEX commission_pending_draw_idx ON affiliate.commission (draw_id) WHERE status = 'PENDING';

-- Retiros de la agencia al banco (reusa la lógica de payments.withdrawal).
ALTER TABLE payments.withdrawal
  ADD COLUMN source            text NOT NULL DEFAULT 'PLAYER' CHECK (source IN ('PLAYER', 'AGENT')),
  ADD COLUMN payout_account_id uuid,              -- entrada del directorio usada (FK abajo)
  ADD COLUMN source_currency   text REFERENCES wallet.currency (code), -- saldo de origen: VES o USDT
  ADD COLUMN source_amount     bigint,            -- monto descontado en la moneda de origen
  ADD COLUMN fx_rate_id        uuid;              -- tasa congelada (solo si source_currency = USDT)
-- Retiros de agencia: siempre se pagan en VES por Pago Móvil.
ALTER TABLE payments.withdrawal ADD CONSTRAINT withdrawal_agent_ves CHECK (
  source <> 'AGENT' OR (currency = 'VES' AND method = 'PAGO_MOVIL' AND payout_account_id IS NOT NULL
                        AND source_currency IS NOT NULL AND source_amount > 0
                        AND (source_currency = 'VES') = (fx_rate_id IS NULL)));
-- `destination` (jsonb) sigue guardando una COPIA de banco, teléfono, cédula, titular y parentesco al momento de solicitar.

-- Directorio de Pago Móvil (§5).
CREATE TABLE affiliate.bank (
  code    char(4) PRIMARY KEY,                    -- '0134'
  name    text NOT NULL,                          -- 'Banesco'
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE affiliate.payout_account (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES affiliate.agent (id),
  alias            text NOT NULL CHECK (length(alias) BETWEEN 1 AND 30),
  bank_code        char(4) NOT NULL REFERENCES affiliate.bank (code),
  phone            text NOT NULL,                 -- normalizado 58414xxxxxxx
  document_type    text NOT NULL CHECK (document_type IN ('V', 'E')),
  document_number  text NOT NULL,
  holder_kind      text NOT NULL CHECK (holder_kind IN ('SELF', 'FAMILY')),
  holder_name      text NOT NULL,                 -- SELF: nombre de la agencia; FAMILY: escrito por la agencia
  relationship     text CHECK (relationship IN ('PADRE_MADRE', 'HIJO', 'HERMANO', 'CONYUGE', 'ABUELO', 'NIETO', 'TIO', 'SOBRINO', 'PRIMO', 'SUEGRO', 'CUNADO')),
  -- SELF: cédula = la de la agencia (validado en servicio). FAMILY: parentesco obligatorio.
  CHECK ((holder_kind = 'FAMILY') = (relationship IS NOT NULL)),
  is_default       boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVALID')), -- INVALID: caja marcó datos incorrectos
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE UNIQUE INDEX payout_alias_uq   ON affiliate.payout_account (agent_id, lower(alias)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX payout_dest_uq    ON affiliate.payout_account (agent_id, bank_code, phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX payout_default_uq ON affiliate.payout_account (agent_id) WHERE is_default AND deleted_at IS NULL;
-- Máximo 5 activas (3 de familiares) por agencia (P1): validado en el servicio con la fila del agente bloqueada FOR UPDATE.
CREATE INDEX payout_document_idx ON affiliate.payout_account (document_type, document_number) WHERE deleted_at IS NULL; -- alerta P9

-- Códigos de confirmación por SMS (P3/P4). Se guarda solo el hash del código.
CREATE TABLE affiliate.sms_challenge (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES identity.app_user (id),
  purpose      text NOT NULL CHECK (purpose IN ('PAYOUT_ACCOUNT_ADD', 'PAYOUT_ACCOUNT_EDIT')),
  payload_hash text NOT NULL,                     -- hash de los datos a guardar: el código solo vale para ESOS datos
  code_hash    text NOT NULL,                     -- SHA-256(código + sal); nunca el código en claro
  phone        text NOT NULL,                     -- teléfono registrado de la agencia
  delivery     text NOT NULL CHECK (delivery IN ('SMS', 'DEMO_SCREEN')),
  attempts     smallint NOT NULL DEFAULT 0 CHECK (attempts <= 3),
  expires_at   timestamptz NOT NULL,              -- now() + 5 min
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sms_challenge_user_idx ON affiliate.sms_challenge (user_id, created_at DESC);
ALTER TABLE payments.withdrawal ADD CONSTRAINT withdrawal_payout_fk
  FOREIGN KEY (payout_account_id) REFERENCES affiliate.payout_account (id);

-- Tasa de cambio USDT → VES (W2). Append-only; la vigente es la más reciente.
CREATE TABLE affiliate.fx_rate (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base        text NOT NULL DEFAULT 'USDT',
  quote       text NOT NULL DEFAULT 'VES',
  rate_x100   bigint NOT NULL CHECK (rate_x100 > 0),  -- Bs por 1 USDT × 100 (45,20 → 4520)
  source      text NOT NULL DEFAULT 'BCV',
  valid_date  date NOT NULL,                          -- día (America/Caracas) en que aplica
  created_by  uuid NOT NULL REFERENCES identity.app_user (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER fx_rate_immutable BEFORE UPDATE OR DELETE ON affiliate.fx_rate
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
ALTER TABLE payments.withdrawal ADD CONSTRAINT withdrawal_fx_fk
  FOREIGN KEY (fx_rate_id) REFERENCES affiliate.fx_rate (id);

-- Cuentas contables nuevas.
ALTER TABLE wallet.account DROP CONSTRAINT account_owner_type_check;
ALTER TABLE wallet.account ADD CONSTRAINT account_owner_type_check
  CHECK (owner_type IN ('PLAYER', 'HOUSE', 'AGENT'));
-- (ajustar también los CHECK de saldo ≥ 0 y owner_id NOT NULL para incluir AGENT)
ALTER TABLE wallet.account DROP CONSTRAINT account_account_type_check;
ALTER TABLE wallet.account ADD CONSTRAINT account_account_type_check CHECK (account_type IN (
  'PLAYER_CASH', 'PLAYER_LOCKED', 'BETS_IN_PLAY', 'HOUSE_GGR', 'PAYMENT_CLEARING',
  'PLAYER_FUTURES', 'FUTURES_MARGIN', 'HOUSE_FUTURES_FEES', 'HOUSE_FUTURES_PNL',
  'HOUSE_PROMOTIONS',
  'AGENT_PENDING',        -- comisiones por liberar
  'AGENT_CASH',           -- comisiones disponibles
  'AGENT_LOCKED',         -- retiros por Pago Móvil en trámite (siempre VES)
  'HOUSE_COMMISSIONS',    -- gasto de comisiones de la casa (por producto)
  'HOUSE_FX'              -- puente de conversión USDT → VES (una cuenta por moneda)
));
```

> Ajuste de identidad: agregar `affiliate` al `RefProduct` del `LedgerService` (`'AFFILIATE'`) y los nuevos `AccountType`.

---

## 8. Contabilidad (ledger de doble partida)

Convención existente: `balance = Σ créditos − Σ débitos`. Las cuentas de agencia son de naturaleza acreedora (saldo ≥ 0). `HOUSE_COMMISSIONS` es un gasto de la casa: su saldo se ve negativo.

| Evento | Tipo (`type`) | Débito | Crédito | Idempotency key |
|---|---|---|---|---|
| Jugada comisionable vendida | `COMMISSION_ACCRUED` | `HOUSE_COMMISSIONS` (LOTTERY) | `AGENT_PENDING` | `affiliate:accrue:<ticketId>` (una por ticket, suma de sus jugadas) |
| Sorteo liquidado | `COMMISSION_RELEASED` | `AGENT_PENDING` | `AGENT_CASH` | `affiliate:release:<drawId>:<agentId>:<moneda>` |
| Jugada anulada (ticket o sorteo) | `COMMISSION_REVERSED` | `AGENT_PENDING` | `HOUSE_COMMISSIONS` | `affiliate:reverse:<ticketId>` o `affiliate:reverse:<playId>` |
| Transferencia a saldo de juego | `AGENT_TO_PLAYER` | `AGENT_CASH` | `PLAYER_CASH` (mismo usuario) | `affiliate:transfer:<clientKey>` |
| Retiro Pago Móvil solicitado (desde Bs) | `AGENT_WITHDRAWAL_REQUESTED` | `AGENT_CASH` (VES) | `AGENT_LOCKED` (VES) | `payments:withdrawal:<id>` |
| Retiro Pago Móvil solicitado (desde USDT) — asiento 1 | `AGENT_FX_SELL` | `AGENT_CASH` (USDT) | `HOUSE_FX` (USDT) | `payments:withdrawal-fx-sell:<id>` |
| … asiento 2 (misma transacción SQL) | `AGENT_FX_BUY` | `HOUSE_FX` (VES) | `AGENT_LOCKED` (VES) | `payments:withdrawal-fx-buy:<id>` |
| Retiro pagado | `AGENT_WITHDRAWAL_PAID` | `AGENT_LOCKED` (VES) | `PAYMENT_CLEARING` (VES) | `payments:withdrawal-paid:<id>` |
| Retiro rechazado (desde Bs) | `AGENT_WITHDRAWAL_REJECTED` | `AGENT_LOCKED` (VES) | `AGENT_CASH` (VES) | `payments:withdrawal-reject:<id>` |
| Retiro rechazado (desde USDT) | `AGENT_FX_REVERSED` (2 asientos) | `AGENT_LOCKED` (VES) / `HOUSE_FX` (USDT) | `HOUSE_FX` (VES) / `AGENT_CASH` (USDT) | `payments:withdrawal-fx-rev-ves:<id>` / `…-usdt:<id>` |

> La conversión usa **dos asientos** porque el ledger prohíbe mezclar monedas en una misma transacción contable (trigger `check_tx_balanced`). Ambos van en la misma transacción SQL: se guardan los dos o ninguno. `HOUSE_FX` en VES acumula los bolívares que la casa entrega por conversiones; en USDT, los USDT que recibe. La tesorería lo usa para saber cuántos USDT debe vender para cubrir pagos.

**Ejemplo de retiro desde USDT** (tasa 45,20): la agencia retira 5,00 USDT → recibe Bs 226,00.
```
AGENT_FX_SELL        D AGENT_CASH(USDT)    5.000.000   C HOUSE_FX(USDT)      5.000.000
AGENT_FX_BUY         D HOUSE_FX(VES)          22.600   C AGENT_LOCKED(VES)      22.600
… caja paga el Pago Móvil …
AGENT_WITHDRAWAL_PAID D AGENT_LOCKED(VES)     22.600   C PAYMENT_CLEARING(VES)  22.600
```

**Ejemplo.** Ana (referida de la agencia *Los Andes*) compra un ticket de Animalitos con 2 jugadas de Bs 100 y Bs 50 en el sorteo de las 3:00 p. m.

```
BET_PLACED           D PLAYER_CASH(Ana)          15.000   C BETS_IN_PLAY(LOTTERY)   15.000
COMMISSION_ACCRUED   D HOUSE_COMMISSIONS(LOTTERY)   450   C AGENT_PENDING(LosAndes)    450   ← misma transacción SQL
… 3:00 p. m. el sorteo se liquida …
COMMISSION_RELEASED  D AGENT_PENDING(LosAndes)      450   C AGENT_CASH(LosAndes)       450
```
(montos en céntimos: Bs 150,00 apostados → Bs 4,50 de comisión)

**Reconciliación (agregar al `reconcile` existente):**
- Σ `commission.amount` con `status = PENDING` por agente/moneda = saldo de `AGENT_PENDING`.
- Ninguna comisión `PENDING` cuya jugada esté `WON`, `LOST` o `VOID` por más de 10 minutos (alerta en el dashboard).
- `HOUSE_COMMISSIONS` = −(Σ RELEASED + Σ PENDING).

---

## 9. Puntos de integración en el código de la Lotería

Todos los cambios ocurren **dentro de la transacción que ya existe**; no se agregan transacciones nuevas en el camino crítico.

| # | Archivo / función | Cambio |
|---|---|---|
| I1 | `apps/api/src/identity/auth.dto.ts` → `RegisterDto` | Agregar `@IsOptional() @IsString() @MaxLength(12) referralCode?: string`. |
| I2 | `apps/api/src/identity/auth.service.ts` → `register()` | Después de crear el usuario y antes del commit: `affiliate.attachReferral(c, userId, dto.referralCode, {document, phone})`. Si el código no es válido, **no falla**: registra sin agencia y lo anota en auditoría. |
| I3 | `apps/api/src/lottery/lottery.service.ts` → venta de ticket (justo después del `ledger.post` de `BET_PLACED`, ~línea 569) | `await this.affiliate.accrueForTicket(c, { ticketId, playerId, gameId, currency, plays, isSimulation })`. Busca la referencia del jugador (1 consulta por PK), descarta si no aplica (K6), calcula por jugada, inserta filas `commission` y un solo `COMMISSION_ACCRUED`. Publica `agent:<id>` → `commission`. |
| I4 | `lottery.service.ts` → `cancelTicket()` (después de `BET_CANCELLED`) | `affiliate.reverseForTicket(c, ticketId)`. |
| I5 | `apps/api/src/lottery/draw-lifecycle.service.ts` → `settleDraw()` | Al final de la liquidación: `affiliate.releaseForDraw(c, drawId)` — agrupa por agente y moneda, un asiento por grupo. |
| I6 | `draw-lifecycle.service.ts` → `cancelDraw()` (dentro del bucle de `BET_VOID`) | `affiliate.reverseForPlay(c, playId)`. |
| I7 | `apps/api/src/wallet/ledger.service.ts` | Nuevos `AccountType`, `RefProduct = 'AFFILIATE'`, helpers `agentPending/agentCash/agentLocked`, y publicar saldo también a la sala `agent:<id>`. |
| I8 | `apps/api/src/payments/payments.service.ts` | Retiros con `source = 'AGENT'`: solo `PAGO_MOVIL` en VES hacia una entrada del directorio (`ACTIVE`, no borrada; propia o de familiar). Si el origen es USDT, toma la tasa del día, congela `fx_rate_id` y hace los asientos de conversión. Copia banco/teléfono/cédula/titular/parentesco en `destination`. Caja los ve en la misma cola con etiqueta «Agencia», el monto **en Bs** y botón «Datos incorrectos» (marca la entrada `INVALID`). Límite KYC calculado en VES. |
| I9 | `apps/api/src/common/realtime.ts` | Nueva sala `agent:${string}`; el gateway une al socket a su sala de agente si el usuario tiene agencia. |
| I10 | `apps/api/src/app.module.ts` | Registrar `AffiliateModule` (exporta `AffiliateService` para lottery e identity). |
| I11 | Deportes (al reactivarse) `sports.service.ts` | Mismo patrón: acumular en `BET_PLACED`, liberar al liquidar, reversar en `VOID`. |
| I12 | Nuevo `apps/api/src/common/sms.service.ts` + `config.ts` | `SmsService.send(phone, text)` con dos implementaciones: `DemoSmsService` (no envía nada; el código vuelve en la respuesta como `demoCode` y queda `delivery = 'DEMO_SCREEN'`) y la de un proveedor real. Se elige con `SMS_ENABLED` (por defecto `false`; si `NODE_ENV=production` y `SIMULATION_MODE=false`, el arranque falla si `SMS_ENABLED=false`, para que nunca se use el modo demo con dinero real). Código con `crypto.randomInt`. |

**Rendimiento.** I3 añade 1 lectura por PK (`referral`), 1 inserción por lotes (`unnest`) y 1 asiento contable sólo cuando el jugador es referido. Para jugadores sin agencia el costo es una sola lectura.

---

## 10. API

Base: `https://<api>/` · JSON · montos como **string** en unidades mínimas (convención existente) · autenticación JWT existente.

### 10.1 Públicos

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/affiliate/codes/:code` | Valida un código. Respuesta: `{ valid: true, agentName: "Agencia Los Andes" }` o `{ valid: false }`. Rate limit estricto (10/min por IP) para evitar enumeración. **No** revela nada más de la agencia. |

### 10.2 Agencia (`@Roles('PLAYER')` + tener agencia)

| Método | Ruta | Uso |
|---|---|---|
| `POST` | `/agent` | Activar agencia: `{ displayName, acceptTerms: true }` → crea agente y código. |
| `GET` | `/agent/me` | Perfil: nombre, estado, código activo, enlace, KYC. |
| `GET` | `/agent/summary` | **Pantalla de inicio:** `{ balances: [{currency, available, pending, locked}], today: {plays, commission}, referrals: {total, activeToday} }`. |
| `GET` | `/agent/commissions?cursor&limit` | Historial (paginado por cursor): fecha, juego, referido enmascarado, monto base, comisión, estado. |
| `GET` | `/agent/referrals?cursor&limit` | Lista de referidos: alias enmascarado («Ana P.»), fecha de registro, jugadas del mes, comisión generada del mes. |
| `GET` | `/agent/stats?from&to` | Serie diaria de comisiones (para el gráfico). |
| `POST` | `/agent/code/rotate` | Regenerar código (regla C5). |
| `POST` | `/agent/transfer-to-player` | `{ currency, amount, idempotencyKey }` → mueve de `AGENT_CASH` a `PLAYER_CASH`. |
| `GET` | `/agent/withdrawals/quote?sourceCurrency&amount` | Vista previa: `{ sourceAmount, rate, rateDate, payoutVes }`. Para VES la tasa es 1. |
| `POST` | `/agent/withdrawals` | `{ sourceCurrency: 'VES'\|'USDT', amount, payoutAccountId, idempotencyKey }` → retiro **en Bs por Pago Móvil** (KYC 2, límites). No acepta otro método ni moneda de pago. |
| `GET` | `/agent/withdrawals` | Estado de retiros (con monto en Bs, origen, tasa y Pago Móvil usado). |
| `GET` | `/agent/payout-accounts` | Directorio de Pago Móvil (teléfono y cédula enmascarados). |
| `POST` | `/agent/payout-accounts/challenge` | `{ action: 'ADD'\|'EDIT', id?, alias, holderKind: 'SELF'\|'FAMILY', relationship?, holderName?, documentType?, documentNumber?, bankCode, phone, isDefault }` → valida los datos y envía el código SMS. Respuesta: `{ challengeId, expiresAt, maskedPhone }` y, **solo en DEMO**, `demoCode`. |
| `POST` | `/agent/payout-accounts/confirm` | `{ challengeId, code }` → guarda la cuenta (P1–P5, P9). |
| `PATCH` | `/agent/payout-accounts/:id` | `{ alias?, isDefault? }` → cambios que no piden SMS. |
| `DELETE` | `/agent/payout-accounts/:id` | Borrado lógico (P6, P7). |
| `GET` | `/banks` | Catálogo de bancos activos (público, cacheable). |
| `GET` | `/fx/today` | Tasa USDT→VES vigente `{ rate, date, source }` o `null`. |

### 10.3 Backoffice (`ADMIN`, `AUDITOR` lectura)

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/admin/agents?status&q` | Lista con totales. |
| `GET` | `/admin/agents/:id` | Detalle: referidos, comisiones, alertas de fraude. |
| `POST` | `/admin/agents/:id/suspend` · `/reactivate` | Con motivo obligatorio (auditoría). |
| `GET/POST` | `/admin/affiliate/rates` | Ver/crear tasas (valida K11). |
| `POST` | `/admin/referrals` | Asignación manual por soporte (regla A4, máx. 72 h). |
| `GET` | `/admin/affiliate/report?from&to` | Comisiones por agencia, juego y moneda; exportable CSV. |
| `GET/POST` | `/admin/fx-rates` | Ver historial / cargar la tasa del día (USDT→VES). Auditoría obligatoria. |
| `GET/POST/PATCH` | `/admin/banks` | Mantener el catálogo de bancos. |
| `POST` | `/admin/payout-accounts/:id/invalidate` | Marcar Pago Móvil con datos incorrectos (P8). |

### 10.4 Tiempo real

Sala `agent:<agentId>` (socket.io existente). Eventos (avisos pequeños; el cliente vuelve a pedir el dato):

- `commission` → `{ status: 'PENDING' | 'RELEASED' | 'REVERSED', currency }`
- `balance` → `{ currency }`
- `referral` → nuevo referido registrado
- `withdrawal` → cambio de estado de un retiro

### 10.5 Errores (códigos `BusinessError`)

`AGENT_NOT_FOUND`, `AGENT_SUSPENDED`, `AGENT_ALREADY_EXISTS`, `CODE_ROTATION_TOO_SOON`, `INSUFFICIENT_FUNDS`, `KYC_REQUIRED`, `WITHDRAWAL_LIMIT`, `MIN_AMOUNT`, `FX_RATE_UNAVAILABLE`, `PAYOUT_ACCOUNT_REQUIRED`, `PAYOUT_ACCOUNT_INVALID`, `PAYOUT_ACCOUNT_LIMIT`, `PAYOUT_FAMILY_LIMIT`, `PAYOUT_ACCOUNT_DUPLICATE`, `PAYOUT_HOLDER_MISMATCH` (cuenta «Mía» con otra cédula), `PAYOUT_HOLDER_IS_REFERRAL`, `PAYOUT_ACCOUNT_IN_USE`, `SMS_CODE_INVALID`, `SMS_CODE_EXPIRED`, `SMS_TOO_MANY_ATTEMPTS`, `SMS_RATE_LIMITED`. Cada uno con mensaje en español listo para mostrar.

---

## 11. Interfaz de la Wallet (simple y fácil de usar)

### 11.1 Principios de UX

1. **Una pantalla = una pregunta.** Inicio: «¿cuánto tengo?». Mi código: «¿cómo invito?». Referidos: «¿quién juega?». Movimientos: «¿de dónde salió?».
2. **Botón principal grande** (≥ 48 px de alto) y de color dorado; todo lo demás es secundario.
3. **Números grandes, texto corto.** Montos en `Bs 1.234,56` / `12,50 USDT` (formato venezolano, como `lib/format.ts`).
4. **Sin jerga.** «Por liberar» en vez de «pendiente de liquidación»; «Pasar a mi saldo de juego» en vez de «transferencia interna».
5. **Móvil primero** (360 px), funciona con una mano; barra inferior de 4 pestañas.
6. **Accesible:** contraste AA, textos ≥ 16 px, iconos siempre con texto, compatible con lector de pantalla.
7. **Identidad visual** de la infografía: verde oscuro `#0B3D1F` / verde `#1E7A3C` / dorado `#F5C518` / blanco. Modo claro por defecto; modo oscuro opcional.

### 11.2 Mapa de pantallas

```
Entrar (login de la Lotería) ─┬─▶ ¿Tiene agencia? ─ no ─▶ Activar agencia (1 paso)
                              └─ sí ─▶ [ Inicio | Mi código | Referidos | Movimientos ]
                                         │
                                         ├─▶ Retirar  (2 pasos) ──▶ + Agregar Pago Móvil
                                         ├─▶ Pasar a mi saldo de juego (1 paso)
                                         └─▶ Menú ☰: Mis Pago Móvil · Perfil · Ayuda · Términos
```

### 11.3 Wireframes

**Activar agencia (primera vez)**
```
┌────────────────────────────────┐
│   🍀 Agencia Virtual            │
│                                │
│  Gana el 3 % de cada jugada    │
│  de las personas que invites.  │
│                                │
│  ✓ Sin inversión               │
│  ✓ Ves tus comisiones al       │
│    instante                    │
│  ✓ Pásalas a tu saldo cuando   │
│    quieras                     │
│                                │
│  Nombre de tu agencia          │
│  ┌──────────────────────────┐  │
│  │ Agencia Los Andes        │  │
│  └──────────────────────────┘  │
│  ☐ Acepto los Términos del     │
│    Programa de Agencias        │
│                                │
│  ┌──────────────────────────┐  │
│  │   CREAR MI AGENCIA  ▶    │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

**Inicio**
```
┌────────────────────────────────┐
│ Hola, Agencia Los Andes    ☰   │
│ [ Bs ]  USDT                   │  ← selector de moneda
│ ┌────────────────────────────┐ │
│ │ Disponible                 │ │
│ │   Bs 12.450,00             │ │  ← número grande
│ │ Por liberar  Bs 1.230,00 ⓘ │ │  ← ⓘ «Se libera cuando el
│ └────────────────────────────┘ │      sorteo termina»
│ ┌────────────────────────────┐ │
│ │   RETIRAR (Pago Móvil) ▶   │ │  ← botón dorado
│ └────────────────────────────┘ │
│   Pasar a mi saldo de juego ▶  │  ← enlace secundario
│  Hoy:  48 jugadas · +Bs 960    │
│  Referidos: 23 (9 jugaron hoy) │
│                                │
│  Últimos movimientos           │
│  ● +Bs 30,00  Ana P. · Animal. │
│    hace 1 min · Por liberar    │
│  ● +Bs 12,00  Luis R. · Triple │
│    hace 3 min · Disponible     │
│  ○ −Bs 6,00   Jugada anulada   │
│                    Ver todo ▶  │
├────────────────────────────────┤
│ 🏠Inicio  ▦Código  👥Ref.  ≡Mov│
└────────────────────────────────┘
```

**Mi código**
```
┌────────────────────────────────┐
│        Tu código               │
│   ┌──────────────────────┐     │
│   │  ▓▓ ▓ ▓▓▓  ▓ ▓▓      │     │
│   │  ▓  QR GRANDE  ▓▓    │     │
│   │  ▓▓▓ ▓ ▓  ▓▓▓ ▓      │     │
│   └──────────────────────┘     │
│        FB-7K3Q9X   [Copiar]    │
│                                │
│ ┌────────────────────────────┐ │
│ │   COMPARTIR POR WHATSAPP   │ │
│ └────────────────────────────┘ │
│  [Copiar enlace] [Descargar    │
│                   imagen]      │
│                                │
│  Quien escanee este código     │
│  queda registrado contigo y    │
│  ganas el 3 % de sus jugadas.  │
└────────────────────────────────┘
```
«Descargar imagen» genera una tarjeta PNG lista para imprimir o subir a estados: logo, QR, código, nombre de la agencia y la leyenda legal obligatoria (+18, juego responsable, DEMO si aplica).

**Referidos**
```
┌────────────────────────────────┐
│ Referidos (23)       Este mes ▾│
│ ┌────────────────────────────┐ │
│ │ Ana P.     12 jugadas      │ │
│ │ desde 02/11   +Bs 360,00   │ │
│ ├────────────────────────────┤ │
│ │ Luis R.     5 jugadas      │ │
│ │ desde 05/11   +Bs 75,00    │ │
│ ├────────────────────────────┤ │
│ │ María G.    0 jugadas      │ │
│ │ desde 09/11  Aún no juega  │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```
Privacidad: nombre + inicial del apellido; nunca cédula, teléfono, saldo, premios ni números jugados.

**Retirar por Pago Móvil (2 pasos) — siempre se recibe en Bs**
```
Paso 1 ─ ¿Cuánto?                    Paso 2 ─ ¿A cuál Pago Móvil?
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Retirar de:  [ Bs ]  USDT    │    │ Recibirás  Bs 226,00         │
│ Disponible: 12,50 USDT       │    │                              │
│ ┌──────────────────────────┐ │    │ ◉ ★ Mi Banesco               │
│ │ 5,00 USDT                │ │    │     0134 · 0414-***-4567     │
│ └──────────────────────────┘ │    │ ○ Banesco de mamá (Carmen P.)│
│ [Todo]                       │    │ + Agregar Pago Móvil         │
│                              │    │                              │
│ Recibirás en tu Pago Móvil:  │    │ ┌──────────────────────────┐ │
│      Bs 226,00               │    │ │     CONFIRMAR  ▶         │ │
│ Tasa BCV hoy: 45,20 Bs/USDT  │    │ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │    └──────────────────────────────┘
│ │       SIGUIENTE ▶        │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
                     ▼
   ✅ Solicitud enviada. Te pagaremos Bs 226,00 al Pago Móvil
      Banesco ···4567. Te avisaremos cuando esté hecho.
```
- Si retira desde **Bs**, no se muestra la tasa: «Recibirás Bs 5.000,00».
- Si no tiene KYC 2: en lugar del paso 1 aparece «Verifica tu identidad para retirar» con botón a la verificación existente (`KycCard`).
- Si no tiene Pago Móvil guardados: el paso 2 abre directamente el formulario **Agregar Pago Móvil** (§5.3) con su confirmación por SMS, y al terminar vuelve al retiro.
- Si no hay tasa del día y elige USDT: «La tasa de hoy aún no está disponible. Puedes retirar desde tu saldo en Bs o intentarlo más tarde.»

**Pasar a mi saldo de juego (1 paso)** — no es un retiro; mueve comisiones a su saldo de jugador en la **misma moneda**, al instante y sin mínimo: elegir moneda → monto → **PASAR** → «✅ Bs 5.000,00 ya están en tu saldo de juego.»

**Movimientos:** lista cronológica con filtros simples (Todos · Comisiones · Retiros), cada fila con icono, monto con signo y color (verde +, gris −), descripción y estado.

### 11.4 Estados vacíos y mensajes

| Situación | Mensaje |
|---|---|
| Sin referidos | «Aún no tienes referidos. Comparte tu código y empieza a ganar.» + botón **Compartir** |
| Referidos que no juegan | «Tus referidos aún no han jugado hoy.» |
| Por liberar > 0 | ⓘ «Esta comisión estará disponible cuando termine el sorteo de la jugada.» |
| Agencia suspendida | Banner rojo: «Tu agencia está en revisión. Escríbenos a soporte.» (sin detalles de fraude) |
| Sin conexión | «Sin conexión. Mostrando tu último saldo (hace 3 min).» |
| Jugada anulada | «El jugador anuló su ticket o el sorteo fue anulado; la comisión se descontó.» |
| Retiro pagado | «Te pagamos Bs 226,00 por Pago Móvil a Banesco ···4567. Ref. 001234.» |
| Retiro rechazado por datos incorrectos | «No pudimos pagar a Banesco ···4567: revisa los datos de ese Pago Móvil. Te devolvimos 5,00 USDT a tu saldo.» |

### 11.5 Notificaciones

- En la app (tiempo real): animación breve del saldo «+Bs 30» al llegar una comisión.
- Push web (opcional, fase 2): **resumen** cada hora o diario, no una por jugada, para no saturar.

---

## 12. Cambios en la app de Lotería (jugador)

1. **Ruta `/r/:code`** → valida el código, lo guarda 30 días, redirige a `/registro` (o a `/` si ya tiene sesión, sin cambiar nada).
2. **Registro (`pages/Auth.tsx`)** → campo «Código de agencia (opcional)», rellenado automáticamente; confirma el nombre de la agencia.
3. **Cuenta (`pages/Account.tsx`)** → línea informativa «Te registraste con: Agencia Los Andes». (Transparencia; el jugador no ve comisiones de nadie.)
4. **Menú** → enlace «Hazte Agencia Virtual» que abre la Wallet (mismo login).
5. **Todos los juegos** siguen igual: el referido juega exactamente con los mismos precios, premios y límites que cualquier jugador.

---

## 13. Backoffice de agencias

Nueva sección **Agencias** en `/admin`:

- **Lista:** agencia, código, estado, referidos, jugadas y comisión del período, alertas 🚩.
- **Detalle de agencia:** referidos (aquí sí con datos completos, para staff), comisiones, retiros, historial de códigos, auditoría, botón **Suspender / Reactivar** con motivo.
- **Tasas de comisión:** tabla por producto/juego con validación de margen (K11) y fecha de vigencia.
- **Tasa del día USDT→Bs:** campo único «Tasa BCV de hoy» con historial; aviso en el dashboard si a las 9:00 a. m. no se ha cargado.
- **Bancos:** catálogo de bancos con Pago Móvil (activar/desactivar).
- **Caja (Pagos existente):** los retiros de agencia muestran «Pagar Bs X a: banco, teléfono, cédula» con botones de copiar, y el origen (Bs o USDT con la tasa congelada).
- **Reporte:** comisiones por agencia × juego × moneda; total pagado vs. GGR (la comisión como % del GGR).
- **Dashboard (existente):** nueva tarjeta «Comisiones hoy» y verificación de integridad (reconciliación §8).

---

## 14. Seguridad y antifraude

| Riesgo | Control |
|---|---|
| **Autorreferido** (la agencia se registra a sí misma con otra cuenta) | Bloqueo por misma cédula/teléfono (A5); KYC obligatorio para retirar; alerta si agencia y referido comparten IP/dispositivo/datos bancarios de depósito. |
| **Granja de cuentas** con bono de bienvenida | Sin comisión hasta el primer **depósito aprobado** del referido (K6). |
| **Apuestas de lavado** (apostar a todo para generar comisión) | Económicamente irracional: el jugador pierde el margen (p. ej. 28,6 % en Animalitos) para ganar 3 %. Aun así: alerta si un referido cubre ≥ 80 % de los resultados de un sorteo. Requiere K11 (comisión < margen) en **todas** las modalidades. |
| **Ciclos anular–rejugar** | La comisión queda `PENDING` hasta liquidarse; si se anula, se reversa. No hay ganancia. |
| **Colusión agencia–cajero** | Retiros por Pago Móvil pasan por la cola de caja con 4 ojos para montos altos [?]; auditoría encadenada. |
| **Robo de cuenta → cambiar el Pago Móvil y retirar** | Código SMS al teléfono registrado de la agencia para agregar/editar (P3), aviso por correo (P5), copia del destino en cada retiro. **[⚠] En DEMO el código se muestra en pantalla, así que esta protección no existe hasta activar el SMS real**; por eso los retiros reales siguen deshabilitados en DEMO. |
| **Pagos a «familiares» que en realidad son jugadores o testaferros** | Máx. 3 cuentas de familiares; cédula de familiar ≠ cédula de un referido (P9); alerta si una cédula está en directorios de varias agencias; titular y parentesco visibles para caja; límites KYC de la agencia. |
| **Abuso del SMS** (costo / spam) | 1 reenvío por minuto, 5 por hora, código válido solo para los datos que se enviaron (`payload_hash`). |
| **Manipulación de la tasa** | Tasa cargada solo por ADMIN, append-only, auditada; alerta si varía > 10 % respecto al día anterior; congelada por retiro. |
| **Enumeración de códigos** | Espacio de 32⁶; rate limit en `/affiliate/codes/:code`; respuesta mínima. |
| **Doble acreditación** | Idempotency keys únicas por ticket/sorteo/jugada; `UNIQUE (product, play_id)` en `commission`. |
| **Concurrencia** | Bloqueos `FOR UPDATE` ordenados del ledger existente; transferencia con `idempotencyKey` del cliente. |
| **Sesión** | Mismo JWT corto + refresh rotativo httpOnly; CORS restringido al dominio de la Wallet; CSP estricta en la PWA. |
| **Privacidad de referidos** | La agencia solo ve alias enmascarados y agregados (§11.3). |
| **Auditoría** | Toda acción (activar agencia, vincular referido, rotar código, suspender, cambiar tasa, transferir, retirar) va a `audit.audit_log` con hash encadenado. |

---

## 15. Cumplimiento y juego responsable

- **[⚠] Afirmación de oficialidad.** La infografía dice «Juegos Oficiales del Gobierno Bolivariano de Mérida», pero el manual MER-05 indica que **no hay autorización acreditada**. Esa frase **no puede aparecer** en la Wallet, en el material descargable ni en los mensajes compartidos hasta que exista la autorización (ya señalado en MER-05 §12).
- **Modo DEMO.** Mientras la plataforma sea demo, la Wallet muestra el banner «DEMO – comisiones sin valor real» y los retiros por Pago Móvil quedan deshabilitados (solo transferencia a saldo de juego de prueba). El directorio de Pago Móvil sí se puede llenar para probarlo.
- **Cambio de divisas [?]:** confirmar con asesoría legal que convertir USDT a Bs a la tasa BCV para pagar comisiones cumple la normativa cambiaria vigente.
- **Mayoría de edad.** Agencias y referidos ≥ 18 (validación existente `isAdult`).
- **Material promocional obligatorio:** leyenda «+18 · Juega con responsabilidad», sin promesas de ganancia garantizada, con ejemplos reales de comisión (§4.4).
- **Términos del Programa de Agencias** (documento aparte, versión con fecha): prohíbe incentivar a menores o a personas autoexcluidas, spam, prometer premios, ofrecer créditos o «fiar» jugadas, y permite suspender por fraude.
- **Autoexclusión:** un referido autoexcluido no puede jugar (control existente), por lo tanto no genera comisión; la agencia **no** es notificada del motivo.
- **Tributario / laboral [?]:** definir si la comisión requiere retención (ISLR), facturación o contrato de agencia; quién emite el comprobante.
- **AML:** comisiones acumuladas por encima de umbrales [?] disparan revisión; retiros solo a cuentas propias o de familiares declarados (titular, cédula y parentesco registrados).

---

## 16. Pruebas

**Dominio (`packages/domain/src/affiliate.test.ts`, en `npm test`):**
- Cálculo: `floor(10000 × 300 / 10000) = 300`; montos que dan 0; montos máximos sin desbordar `bigint`; tope por jugada.
- Código: formato, alfabeto Crockford, normalización (`fb7k3q9x`, `FB-7K3Q9X`, `FB 7K3Q9O` → `FB7K3Q90`).
- Validación de tasa vs. margen (K11) para cada modalidad sembrada — debe **fallar** hoy para Terminal directo 100×.
- Conversión USDT→Bs: `5.000.000 µUSDT × 4520 / 10⁶ = 22.600 céntimos`; redondeo hacia abajo; montos mínimos.

**Integración (`scripts/smoke.mjs`, nuevo bloque «agencias»):**
1. Activar agencia → obtener código.
2. Registrar jugador con `referralCode` → aprobar depósito → comprar ticket de 2 jugadas → comisión `PENDING` correcta y saldo `AGENT_PENDING`.
3. Jugador sin depósito → no hay comisión.
4. Ticket de simulación → no hay comisión.
5. Anular ticket en ventana → comisión `REVERSED`, saldos en 0.
6. Sorteo extraordinario liquidado → comisión `RELEASED`, `AGENT_CASH` correcto.
7. Anular sorteo → `REVERSED`.
8. Transferir a saldo de juego (dos llamadas con la misma `idempotencyKey` → un solo movimiento).
9. Autorreferido (misma cédula) → registro sin agencia.
10. 50 tickets concurrentes del mismo referido → Σ comisiones exacta, ledger cuadrado, `reconcile().ok === true`.
11. Agencia suspendida → jugadas nuevas sin comisión.
12. Directorio: agregar 5 cuentas OK, la 6.ª falla; 4.ª de familiar falla; duplicada falla; «Mía» con otra cédula falla; familiar con cédula de un referido falla.
13. SMS en DEMO: el `challenge` devuelve `demoCode`, el código correcto guarda la cuenta, uno incorrecto 3 veces bloquea, uno vencido falla, y un código no sirve para datos distintos a los enviados. Con `SMS_ENABLED=true` la respuesta **no** incluye `demoCode`.
14. Retiro desde Bs → `AGENT_LOCKED` en VES; pagado → `PAYMENT_CLEARING`; rechazado → vuelve a `AGENT_CASH`.
15. Retiro desde USDT con tasa 45,20 → dos asientos, `withdrawal.amount` = Bs correctos, `fx_rate_id` congelado; cambiar la tasa después no altera el pago; rechazo → vuelven los USDT exactos.
16. Retiro desde USDT sin tasa del día → `FX_RATE_UNAVAILABLE`.
17. Intentar retiro con `method = USDT` o `TRANSFER` → rechazado por validación y por el `CHECK` de BD.

**UI (Wallet):** pruebas de componentes de las 4 pantallas y del flujo de retiro; prueba manual en teléfono Android de gama baja (360 px, 3G simulado).

---

## 17. Plan de entrega por fases

| Fase | Alcance | Resultado |
|---|---|---|
| **0 – Preparación** | Resolver K11 (Terminal directo), confirmar preguntas §18, Términos del programa. | Reglas cerradas. |
| **1 – Núcleo (backend)** | Migración 020, `AffiliateModule`, cálculo en dominio + tests, integración I1–I10, reconciliación, auditoría. | Comisiones correctas en BD y ledger, verificables por smoke. |
| **2 – Wallet MVP** | PWA con Activar agencia, Inicio, Mi código (QR + compartir), Referidos, Movimientos, transferencia a saldo de juego, tiempo real. Ruta `/r/:code` y campo en registro de la Lotería. | Flujo completo de punta a punta en DEMO. |
| **3 – Retiros y backoffice** | Directorio de Pago Móvil, retiros en Bs por Pago Móvil (KYC 2) con conversión desde USDT, tasa del día y catálogo de bancos en admin, sección Agencias, reporte CSV, alertas de fraude. | Operable por la casa. |
| **4 – Crecimiento** | Etiquetas de campaña, tarjeta descargable, push con resumen, gráfico de ganancias, deportes cuando se reactive. | Mejoras de adopción. |

---

## 18. Preguntas abiertas

1. **Vigencia de la vinculación:** ¿la agencia cobra por el jugador **para siempre** (supuesto actual) o por un período (p. ej. 12 meses)?
2. **Tasa por juego:** ¿3 % igual para todos los juegos, o diferenciada? ¿Qué hacer con Terminal directo (margen 0 %)?
3. **Topes:** valor del tope por jugada y del tope diario por agencia.
4. **Retiros por Pago Móvil:** monto mínimo en Bs, horario de caja, umbral para doble aprobación.
   - **Proveedor de SMS** para cuando salga de DEMO (y su costo por mensaje).
   - ¿Los límites de 5 cuentas / 3 de familiares y la lista de parentescos están bien?
   - *Resuelto:* tasa BCV cargada por el administrador · se permiten Pago Móvil de familiares · confirmación por SMS (simulada en pantalla mientras sea DEMO).
5. **Multinivel:** ¿una agencia puede reclutar sub-agencias y cobrar sobre ellas? (Supuesto actual: **no**, un solo nivel; el multinivel aumenta riesgo regulatorio.)
6. **Agencias físicas / taquillas (POS):** ¿la Wallet también servirá a taquillas que venden tickets en persona (canal `POS`)? Eso cambia el modelo (la agencia vende, no solo refiere).
7. **Tributación:** retención, facturación y contrato de las agencias.
8. **Repositorio:** ¿la Wallet vive en este repositorio (`WalletLoteria`) o como `apps/wallet` dentro del monorepo de la Lotería (recomendado)?
9. **Dominio y marca:** dominio de la Wallet y del enlace corto (`/r/...`), y aprobación del nombre «Fortuna Bets» vs. «FortunaBet» (el README usa este último).
