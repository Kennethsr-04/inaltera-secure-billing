import { Building2, FileText, ClipboardList, LogOut, ArrowUpDown, PanelTop, Sun, Moon, Package, Trash2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { InalteraLogo } from "@/components/InalteraLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { title: "Datos de Empresa y Tarifas", url: "/perfil", icon: Building2 },
  { title: "Servicios", url: "/servicios", icon: Package },
  { title: "Facturación y Carga", url: "/facturacion", icon: FileText },
  { title: "Registro de Facturas", url: "/registro", icon: ClipboardList },
  { title: "Papelera", url: "/papelera", icon: Trash2 },
  { title: "Importar / Exportar", url: "/datos", icon: ArrowUpDown },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { toggleOrientation } = useLayout();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <InalteraLogo size="md" />
        <p className="text-xs text-muted-foreground mt-1">Tu solución NO-VERI*FACTU</p>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
                      activeClassName="bg-accent text-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 truncate">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          <span className="truncate">{user?.email}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-muted-foreground hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="shrink-0">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{theme === "light" ? "Modo oscuro" : "Modo claro"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleOrientation} className="shrink-0">
                <PanelTop className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Cambiar a menú superior</TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
