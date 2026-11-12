import type { ReactNode } from 'react';

type IconProps = { size?: number };

function Svg({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconHighlight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 11l-5 5v4h4l5-5" />
    <path d="M14 6l4 4" />
    <path d="M15 5l3-3 4 4-3 3z" />
  </Svg>
);
export const IconNote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3h10l4 4v14H5z" />
    <path d="M14 3v5h5" />
    <path d="M8 13h8M8 17h5" />
  </Svg>
);
export const IconAi = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 4v4M9 14h.01M15 14h.01M9 17h6" />
  </Svg>
);
export const IconSave = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3h12l3 3v15H5z" />
    <path d="M8 3v6h8V3M8 21v-7h8v7" />
  </Svg>
);
export const IconDelete = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
/** Góc kéo đổi cỡ (hai vạch chéo ở góc phải dưới). */
export const IconResize = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 10L10 20M20 16l-4 4" />
  </Svg>
);
export const IconRetry = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Svg>
);
export const IconBookmark = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3h12v18l-6-4-6 4z" />
  </svg>
);
