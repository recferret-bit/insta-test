import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon } from "./Icon";
import { useFocusTrap } from "./useFocusTrap";
import "./Modal.css";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visually hide the title (still the dialog's accessible name). */
  hideTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** `modal` (centered; becomes a bottom sheet below 768 px) or `sheet` (always a bottom sheet). */
  variant?: "modal" | "sheet";
  size?: "sm" | "md" | "lg";
  /** Close when the backdrop is clicked (default true). */
  dismissOnBackdrop?: boolean;
};

let openCount = 0;

function lockScroll(): () => void {
  openCount++;
  if (openCount === 1) document.body.style.overflow = "hidden";
  return () => {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.style.overflow = "";
  };
}

/**
 * Accessible dialog: `role="dialog"` + `aria-modal`, focus trap, `Esc` closes, focus returns to the trigger,
 * body scroll locked while open. Rendered in a portal on `document.body`.
 */
export function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  children,
  footer,
  variant = "modal",
  size = "md",
  dismissOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, open, onClose);

  useEffect(() => (open ? lockScroll() : undefined), [open]);

  if (!open) return null;
  return createPortal(
    <div
      className={`modal-backdrop modal-backdrop--${variant}`}
      onMouseDown={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal modal--${variant} modal--${size}`}
      >
        <header className="modal__header">
          <h2 id={titleId} className={hideTitle ? "visually-hidden" : "modal__title"}>
            {title}
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <Icon icon={X} size={22} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
