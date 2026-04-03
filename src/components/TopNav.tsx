import { Building2, FileText, ClipboardList, LogOut, ArrowUpDown, PanelLeft, Sun, Moon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLayout } from "@/contexts/LayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import { InalteraLogo } from "@/components/InalteraLogo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { title: "Datos de Empresa", url: "/perfil", icon: Building2 },
  { title: "Facturación", url: "/facturacion", icon: FileText },
  { title: "Registro", url: "/registro", icon: ClipboardList },
  { title: "Importar / Exportar", url: "/datos", icon: ArrowUpDown },
];

export function TopNav() {
  const { user, logout } = useAuth();
  const { toggleOrientation } = useLayout();

  return (
    <header className="h-14 border-b bg-card flex items-center px-4 gap-4 shrink-0">
      <InalteraLogo size="sm" />

      <nav className="flex items-center gap-1 flex-1 ml-4">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
            activeClassName="bg-accent text-accent-foreground font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{item.title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden lg:inline truncate max-w-[200px]">
          {user?.email}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleOrientation}>
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cambiar a menú lateral</TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
