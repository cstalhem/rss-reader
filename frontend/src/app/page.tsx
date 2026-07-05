import { Inbox } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Home() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">All articles</h1>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <Inbox className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Nothing selected</p>
            <p className="text-sm text-muted-foreground">
              Pick a feed or folder from the sidebar to start reading.
            </p>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
