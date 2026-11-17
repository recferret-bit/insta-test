import { Modal, type ModalProps } from "./Modal";

export type SheetProps = Omit<ModalProps, "variant">;

/** Bottom sheet (action menus, mobile pickers). Same focus/Esc contract as `Modal`. */
export function Sheet(props: SheetProps) {
  return <Modal {...props} variant="sheet" />;
}
