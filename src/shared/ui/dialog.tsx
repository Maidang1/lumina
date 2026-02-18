import React, { createContext, useContext, useEffect } from "react";
import { cn } from "@/shared/lib/utils";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

let openDialogCount = 0;
let lockedScrollY = 0;
let originalBodyOverflow = "";
let originalBodyPaddingRight = "";
let originalBodyPosition = "";
let originalBodyTop = "";
let originalBodyWidth = "";

const lockBodyScroll = (): void => {
  if (typeof document === "undefined") return;

  if (openDialogCount === 0) {
    const body = document.body;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    lockedScrollY = window.scrollY;
    originalBodyOverflow = body.style.overflow;
    originalBodyPaddingRight = body.style.paddingRight;
    originalBodyPosition = body.style.position;
    originalBodyTop = body.style.top;
    originalBodyWidth = body.style.width;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY}px`;
    body.style.width = "100%";

    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }
  }

  openDialogCount += 1;
};

const unlockBodyScroll = (): void => {
  if (typeof document === "undefined") return;
  if (openDialogCount <= 0) return;

  openDialogCount -= 1;

  if (openDialogCount === 0) {
    const body = document.body;
    body.style.overflow = originalBodyOverflow;
    body.style.paddingRight = originalBodyPaddingRight;
    body.style.position = originalBodyPosition;
    body.style.top = originalBodyTop;
    body.style.width = originalBodyWidth;
    window.scrollTo(0, lockedScrollY);
  }
};

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>
    {children}
  </DialogContext.Provider>
);

const useDialog = (): DialogContextValue => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used inside Dialog");
  }
  return context;
};

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  overlayClassName?: string;
}

const DialogContent: React.FC<DialogContentProps> = ({
  className,
  overlayClassName,
  children,
  ...props
}) => {
  const { open, onOpenChange } = useDialog();

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm",
        overlayClassName,
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        className={cn(
          "relative w-full rounded-lg border border-white/10 bg-[#1a1a1a] text-gray-200 shadow-xl",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("flex flex-col space-y-1.5", className)} {...props} />;

const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => <h2 className={cn("text-lg font-semibold text-white", className)} {...props} />;

const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("flex items-center justify-end gap-2", className)} {...props} />;

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const DialogClose: React.FC<DialogCloseProps> = ({
  className,
  onClick,
  ...props
}) => {
  const { onOpenChange } = useDialog();
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a962]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onOpenChange(false);
      }}
      {...props}
    />
  );
};

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
};
