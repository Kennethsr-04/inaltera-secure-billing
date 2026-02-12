// Mock data for development when API endpoints are not yet available

export const mockClientes = [
  { id: "1", nombre: "Empresa Demo S.L.", nif: "B12345678", direccion: "Calle Mayor 1, Madrid", email: "demo@empresa.com" },
  { id: "2", nombre: "Servicios Técnicos S.A.", nif: "A87654321", direccion: "Av. Diagonal 200, Barcelona", email: "info@servtec.es" },
  { id: "3", nombre: "Juan García López", nif: "12345678A", direccion: "C/ Sierpes 15, Sevilla", email: "juan@gmail.com" },
];

export const mockProductos = [
  { id: "1", codigo: "SRV001", descripcion: "Servicio de consultoría", precio: 80.00, iva: 21 },
  { id: "2", codigo: "SRV002", descripcion: "Desarrollo web", precio: 65.00, iva: 21 },
  { id: "3", codigo: "PRD001", descripcion: "Licencia software anual", precio: 299.00, iva: 21 },
  { id: "4", codigo: "PRD002", descripcion: "Material de oficina", precio: 15.50, iva: 21 },
];

export const mockFacturas = [
  {
    id: "F001",
    fecha: "2026-02-10",
    tipo: "Emitida",
    numero: "2026/001",
    cliente: "Empresa Demo S.L.",
    total: 1210.00,
    estado: "Sellada",
    trazabilidad: "Verificada",
  },
  {
    id: "F002",
    fecha: "2026-02-08",
    tipo: "Emitida",
    numero: "2026/002",
    cliente: "Juan García López",
    total: 363.00,
    estado: "Sellada",
    trazabilidad: "Verificada",
  },
  {
    id: "F003",
    fecha: "2026-02-05",
    tipo: "Cargada",
    numero: "EXT-2026/015",
    cliente: "Servicios Técnicos S.A.",
    total: 850.50,
    estado: "Sellada",
    trazabilidad: "Verificada",
  },
  {
    id: "F004",
    fecha: "2026-01-28",
    tipo: "Emitida",
    numero: "2026/003",
    cliente: "Empresa Demo S.L.",
    total: 2420.00,
    estado: "Sellada",
    trazabilidad: "Verificada",
  },
];

export const mockSubscriptionStatus = {
  plan: "gratuito",
  facturasUsadas: 3,
  facturasLimite: 5,
  proximaRenovacion: "2026-03-01",
};

export const mockUserProfile = {
  razonSocial: "",
  nif: "",
  direccion: "",
  codigoPostal: "",
  ciudad: "",
  provincia: "",
};
