import localFont from "next/font/local";

// Display face — used sparingly, for headlines and card titles only.
// Self-hosted latin subset (downloaded from Google Fonts, Fraunces v38).
export const fraunces = localFont({
  src: [
    {
      path: "../../public/fonts/fraunces-normal.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "../../public/fonts/fraunces-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

// Body face — IBM Plex Sans is a variable font; one file covers 400–700.
// Self-hosted latin subset (IBM Plex Sans v23).
export const plexSans = localFont({
  src: [
    {
      path: "../../public/fonts/ibm-plex-sans.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

// Data/utility face — IBM Plex Mono, discrete weight files.
// Self-hosted latin subset (IBM Plex Mono v20).
export const plexMono = localFont({
  src: [
    {
      path: "../../public/fonts/ibm-plex-mono-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-mono-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-mono-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-plex-mono",
  display: "swap",
});
