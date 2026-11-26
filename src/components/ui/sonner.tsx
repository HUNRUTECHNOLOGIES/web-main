import type { ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

type ToasterProps = ComponentProps<typeof Sonner>;

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-[#00FF66]" />,
        info: <Info className="w-4 h-4 text-[#00E5FF]" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        error: <XCircle className="w-4 h-4 text-red-400" />,
        loading: <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />,
      }}
      toastOptions={{
        style: {
          background: 'var(--theme-surface)',
          color: 'var(--theme-text)',
          border: '1px solid var(--theme-border)',
          borderRadius: '8px',
          boxShadow: '0 14px 36px rgba(0, 0, 0, 0.55)',
          fontFamily: 'var(--font-sans)',
        },
        classNames: {
          toast: 'group toast font-sans text-xs',
          title: 'text-[#E6EDF3] font-semibold text-xs',
          description: 'text-[#94A3B8] font-mono text-[11px]',
          closeButton:
            'bg-[#141B26] border-white/15 text-[#94A3B8] hover:text-white hover:bg-[#1C2636]',
          actionButton: 'bg-[#00FF66] text-[#0A0D12] font-semibold text-xs',
          cancelButton: 'bg-[#141B26] text-[#C4CEDB] text-xs',
        },
      }}
      {...props}
    />
  );
}
