import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  darkMode: 'class',
  plugins: [],
  important: '#__next',
  corePlugins: {
    preflight: false, // Disable Tailwind's base styles to avoid conflicts with MUI
  },
};

export default config;

