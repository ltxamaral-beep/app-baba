import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#090f16',
          900: '#0d1721',
          850: '#121e2b',
          800: '#182737',
          750: '#1c2e42',
          700: '#22384f',
          600: '#2c4864',
          500: '#3d5f80',
        },
        teal: {
          300: '#34d399',
          400: '#14b8a6',
          500: '#00b49f',
          600: '#009b88',
          700: '#0d695e',
          800: '#0e4a43',
          900: '#0c3530',
        },
        wine: {
          900: '#2b161c',
          800: '#3e2229',
          700: '#522c37',
        },
        pitch: {
          950: '#06130b',
          900: '#0b2014',
          800: '#0f3120',
          700: '#14462e',
          600: '#1a613f',
          500: '#228556',
          400: '#2fb174',
          300: '#4fd895',
          200: '#86f0bb',
          100: '#c5fae0',
          50: '#edfdf5',
        },
        gold: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
