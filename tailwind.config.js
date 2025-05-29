/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",      // for Next.js 13 app directory
    "./pages/**/*.{js,ts,jsx,tsx}",    // for pages directory (optional)
    "./components/**/*.{js,ts,jsx,tsx}" // for components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
