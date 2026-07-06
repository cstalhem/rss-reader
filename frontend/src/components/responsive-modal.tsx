"use client";

import { useState } from "react";
import type * as React from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

/**
 * The responsive overlay container validated by the feed-management prototype:
 * a centered Dialog at ≥768px, a Vaul bottom drawer below, switched by the
 * project's `useIsMobile` hook (same 768px breakpoint). Both portal to body
 * (Radix default), so the modal survives the sidebar itself being a mobile
 * Sheet. Bodies have no description, so `aria-describedby={undefined}`
 * suppresses Radix's warning explicitly.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  children,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  // Latch the container choice at open time (adjust-state-during-render, not
  // useEffect) so crossing the 768px breakpoint while open — e.g. a phone
  // rotation — doesn't swap Drawer↔Dialog mid-flight and wipe form state.
  const [latched, setLatched] = useState(isMobile);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLatched(isMobile);
  }

  if (latched) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
