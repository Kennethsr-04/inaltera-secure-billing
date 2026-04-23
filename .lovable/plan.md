

## Objetivo

Permitir que cualquier persona (sin estar logueada) pueda **visualizar el código QR** de una factura y verificar sus datos, escaneando el QR impreso o accediendo al enlace.

## Estado actual

- La ruta `/verificar?huella=...` **ya es pública** (no está dentro de `ProtectedRoute` en `App.tsx`).
- La edge function `verificar-factura` **ya funciona sin login**: usa `SERVICE_ROLE_KEY` para saltarse RLS y devolver los datos por `huella_hash` o `numero_factura`.
- Lo que **falta**: la página `/verificar` muestra los datos de la factura pero **no renderiza el QR visualmente**. El QR solo es visible actualmente desde `Registro.tsx` y `Facturacion.tsx`, que están detrás del login.

## Cambios propuestos

### 1. Mostrar el QR en la página pública `/verificar`

En `src/pages/VerificarFactura.tsx`:

- Importar `QRCodeSVG` desde `qrcode.react`.
- Añadir una nueva tarjeta visual con el QR generado a partir de `factura.qr_url`, justo después de la tarjeta de "Factura verificada".
- Incluir un botón "Descargar QR" que exporte el SVG como PNG (mismo patrón que ya se usa en `Registro.tsx`).
- Mostrar también el enlace de verificación en texto, por si el usuario quiere copiarlo.

```text
┌─────────────────────────────┐
│ ✅ Factura verificada       │
├─────────────────────────────┤
│   ┌─────────────────┐       │
│   │  ███ ▄▄▄ ███    │       │
│   │  ██ QR HERE ██  │       │
│   │  ███ ▀▀▀ ███    │       │
│   └─────────────────┘       │
│   [ Descargar QR ]          │
├─────────────────────────────┤
│ Nº Factura · Estado         │
│ Importe total               │
│ Fecha · Régimen · Cliente   │
│ Desglose fiscal             │
│ Huella SHA-256              │
└─────────────────────────────┘
```

### 2. Acceso directo por número de factura (opcional pero útil)

La edge function ya soporta `?numero=...`. Añadir en la página un pequeño formulario al inicio (cuando no hay parámetros) para que un usuario externo pueda introducir un número de factura y verificarla manualmente, sin necesidad del enlace QR.

### 3. Confirmar que no hay barreras de auth

- Verificar que `App.tsx` mantiene `<Route path="/verificar" element={<VerificarFactura />} />` **fuera** de `ProtectedRoute` (ya lo está).
- La llamada `fetch` a la edge function ya envía solo `apikey` (publishable), sin `Authorization`, por lo que funciona sin sesión.
- No se requieren cambios en RLS ni en la edge function.

## Detalles técnicos

- **Componente QR**: `QRCodeSVG` con `value={factura.qr_url}`, `size={200}`, `level="H"`, fondo blanco para máximo contraste de escaneo.
- **Descarga PNG**: serializar el SVG, dibujarlo en un `<canvas>` y disparar descarga vía `toDataURL("image/png")`.
- **Sin cambios en backend**: la función `verificar-factura` ya devuelve `qr_url` en su `select`.
- **Sin cambios en BD**: `qr_url` y `huella_hash` ya se guardan al crear/importar facturas.

## Resultado para el usuario final

Cualquiera que escanee el QR de una factura impresa (o reciba el enlace `https://.../verificar?huella=...`) verá:
1. Sello de "Factura verificada".
2. **El propio QR renderizado** con opción de descarga.
3. Datos fiscales completos y huella SHA-256.

Sin necesidad de cuenta, sin login, sin fricción.

