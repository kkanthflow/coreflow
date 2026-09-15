/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        app: "var(--bg-app)",
        "card-bg": "var(--bg-card)",
        hover: "var(--bg-hover)",
        divider: "var(--border-app)",
        main: "var(--text-main)",
        muted: "var(--text-muted)",
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px
        'xs': ['0.825rem', { lineHeight: '1.2rem' }],     // 13.2px (was 12px)
        'sm': ['0.95rem', { lineHeight: '1.4rem' }],      // 15.2px (was 14px)
        'base': ['1.05rem', { lineHeight: '1.6rem' }],    // 16.8px (was 16px)
        'lg': ['1.18rem', { lineHeight: '1.75rem' }],     // 18.8px (was 18px)
        'xl': ['1.32rem', { lineHeight: '1.85rem' }],     // 21.1px (was 20px)
        '2xl': ['1.6rem', { lineHeight: '2.1rem' }],      // 25.6px (was 24px)
        '3xl': ['2rem', { lineHeight: '2.4rem' }],        // 32px
        '4xl': ['2.45rem', { lineHeight: '2.8rem' }],     // 39px
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
 