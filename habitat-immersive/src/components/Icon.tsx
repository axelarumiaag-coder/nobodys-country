import type { SVGProps } from 'react';

const paths: Record<string, JSX.Element> = {
  bed: <path d="M3 18v-6.5A1.5 1.5 0 0 1 4.5 10h15a1.5 1.5 0 0 1 1.5 1.5V18M3 15h18M3 18v1.5M21 18v1.5M6 10V7.5A1.5 1.5 0 0 1 7.5 6h3A1.5 1.5 0 0 1 12 7.5V10" />,
  bath: <path d="M4 12h16v2.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 14.5V12ZM6 12V5.5A1.5 1.5 0 0 1 8.9 5M7 19l-1 2M17 19l1 2" />,
  area: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 8l8 8M16 8l-8 8" />,
  pin: <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  pano: <path d="M3 9.5C3 7.6 7 6 12 6s9 1.6 9 3.5v5c0 1.9-4 3.5-9 3.5s-9-1.6-9-3.5v-5ZM3 9.5C3 11.4 7 13 12 13s9-1.6 9-3.5M12 13v5" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  compass: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5.5M12 7.6v.4" />,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4-4" />,
  sliders: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5" />,
  home: <path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5V11Z" />,
  energy: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  calendar: <path d="M5 6h14v14H5zM5 10h14M9 3v5M15 3v5" />,
  layers: <path d="m12 4 9 4.5-9 4.5-9-4.5L12 4ZM3 13l9 4.5 9-4.5" />,
  map: <path d="m9 5-5 2v12l5-2 6 2 5-2V5l-5 2-6-2Zm0 0v12m6-10v12" />,
  hand: (
    <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-1.5V5a1.5 1.5 0 0 1 3 0v6m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.1L4 15.6a1.6 1.6 0 0 1 2.3-2.2L8 15" />
  ),
  door: <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M4 21h16M14.5 12.5v.5" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
