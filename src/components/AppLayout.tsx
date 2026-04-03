import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopNav } from "@/components/TopNav";
import { useLayout } from "@/contexts/LayoutContext";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { orientation, toggleOrientation } = useLayout();

  if (orientation === "top") {
    return (
      <div className="min-h-screen flex flex-col w-full">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 border-b flex items-center px-4 bg-card shrink-0 gap-2">
            <SidebarTrigger />
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleOrientation}>
                  <PanelLeft className="h-4 w-4 rotate-90" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cambiar a menú superior</TooltipContent>
            </Tooltip>
          </header>
          <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
