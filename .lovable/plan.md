# INALTERA — Tu solución NO-VERI*FACTU

## Visión General

Aplicación SPA profesional para gestión de facturación electrónica con cumplimiento fiscal español. Diseño limpio con paleta azul (#007bff), fondos claros, y componentes shadcn/ui. Responsive para móvil y escritorio.

---

## 1. Identidad Visual y Layout Base

- **Paleta de colores**: Primario azul brillante (#007bff), fondo gris claro, texto oscuro, acentos blancos
- **Logo placeholder**: SVG con flecha en cuadrado azul apuntando arriba-derecha + texto "INALTERA"
- **Eslogan**: "Tu solución NO-VERI*FACTU" visible en login y sidebar
- **Layout principal**: Sidebar colapsable con navegación + área de contenido principal

## 2. Módulo de Autenticación

- **Página de Login**: Email + contraseña, botón de acceso, enlace a registro
- **Página de Registro**: Email + contraseña + confirmación, validación con zod
- **Gestión de token**: Almacenamiento en localStorage, interceptor para añadir token a peticiones API
- **Rutas protegidas**: Redirección automática a login si no hay sesión activa
- **Conexión API**: POST a endpoints de login/registro reales; mock para respuestas no disponibles

## 3. Navegación Principal (Post-login)

- **Sidebar** con tres secciones:
  1. 🏢 Datos de la Empresa y Tarifas
  2. 📄 Facturación y Carga
  3. 📋 Registro de Facturas
- Indicador visual de la sección activa
- Colapsable en móvil con hamburger menu

## 4. Vista: Datos de la Empresa y Tarifas

### Pestaña A — Datos Fiscales

- Formulario: Razón Social, NIF (validación formato español), Domicilio Fiscal (dirección, CP, ciudad, provincia)
- Validación completa con zod
- Envío a POST /user/profile (mock si no disponible)

### Pestaña B — Gestión de Tarifas

- Tabla/cards con planes: Gratuito (0-5 facturas), 9€ (6-10), 15€ (11-20)
- Contador de facturas actual del usuario (GET /user/subscription/status, mock disponible)
- Botón "Suscribirse/Cambiar Plan" con simulación de pasarela de pago
- Indicador visual del plan activo

## 5. Vista: Facturación y Carga

### Pestaña A — Elaborar Factura (campos completos)

- **Datos emisor**: Prellenados desde perfil
- **Datos cliente**: Selector con autocompletado (GET /catalog/clientes), opción crear nuevo
- **Tipo de factura**: Completa, simplificada, rectificativa
- **Líneas de producto**: Tabla editable con autocompletado (GET /catalog/productos), cantidad, precio unitario, descuento
- **Impuestos**: Tipo IVA (21%, 10%, 4%, exento), régimen IVA, retención IRPF (%), recargo de equivalencia
- **Totales**: Cálculo automático (base imponible, cuota IVA, retenciones, total)
- **Botón "Generar y Sellar Factura"**: POST /factura/emitir → muestra confirmación con ID de registro y enlace al PDF

### Pestaña B — Carga de Facturas de Terceros

- Zona drag-and-drop para archivos PDF (solo PDF permitido)
- Vista previa del nombre del archivo
- **Botón "Cargar y Sellar PDF"**: POST /factura/cargar_pdf → confirmación con PDF sellado con QR

## 6. Vista: Registro de Facturas

- **Tabla de datos** con columnas: Fecha, Tipo, Número, Cliente, Total (€), Estado de Trazabilidad, Acciones
- **Buscador**: Campo de texto para búsqueda por contenido
- **Filtros de fecha**: Selector "Desde" y "Hasta" con date pickers
- **Acciones por fila**: Iconos para descargar PDF (con QR) y descargar registro XML/JSON
- **Paginación** de resultados
- Datos de GET /registro/listado con parámetros de búsqueda y filtro

## 7. Infraestructura Técnica

- **Servicio API centralizado** con axios/fetch, base URL configurable, interceptor de autenticación
- **Sistema mock**: Datos simulados para endpoints no disponibles, fácil de desactivar cuando la API esté lista
- **React Query** para caché y gestión de estado del servidor
- **React Router** para navegación SPA con rutas protegidas
- **Validación** con zod en todos los formularios