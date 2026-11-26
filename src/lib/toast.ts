import { toast } from 'sonner';

export interface ToastOptions {
  description?: string;
  duration?: number;
}

export const notify = {
  success(title: string, options?: ToastOptions) {
    return toast.success(title, {
      description: options?.description,
      duration: options?.duration ?? 3200,
    });
  },
  info(title: string, options?: ToastOptions) {
    return toast.info(title, {
      description: options?.description,
      duration: options?.duration ?? 3000,
    });
  },
  warning(title: string, options?: ToastOptions) {
    return toast.warning(title, {
      description: options?.description,
      duration: options?.duration ?? 3600,
    });
  },
  error(title: string, options?: ToastOptions) {
    return toast.error(title, {
      description: options?.description,
      duration: options?.duration ?? 4200,
    });
  },
};
