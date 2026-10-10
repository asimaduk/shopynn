export type AppConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type AppConfirmRequest = AppConfirmOptions & {
  id: number;
  resolve: (ok: boolean) => void;
};

type Listener = (request: AppConfirmRequest | null) => void;

let listener: Listener | null = null;
const queue: AppConfirmRequest[] = [];
let nextId = 1;

const emit = () => listener?.(queue[0] ?? null);

export function subscribeAppConfirm(fn: Listener) {
  listener = fn;
  emit();
  return () => {
    if (listener === fn) listener = null;
  };
}

export function settleAppConfirm(id: number, ok: boolean) {
  const idx = queue.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const [request] = queue.splice(idx, 1);
  request.resolve(ok);
  emit();
}

/**
 * Promise-based replacement for window.confirm, rendered by <AppConfirmHost /> as an MUI dialog.
 * Resolves true when confirmed, false when cancelled or dismissed.
 */
export function appConfirm(options: AppConfirmOptions): Promise<boolean> {
  if (!listener) {
    return Promise.resolve(
      window.confirm(
        [options.title, options.message].filter(Boolean).join("\n\n"),
      ),
    );
  }
  return new Promise((resolve) => {
    queue.push({ ...options, id: nextId++, resolve });
    emit();
  });
}
