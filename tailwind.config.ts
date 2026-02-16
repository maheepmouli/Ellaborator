import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1600px",
      },
    },
    extend: {
      colors: {
        /* ELAB Brand Colors */
        purple: "hsl(var(--purple))",
        violet: "hsl(var(--violet))",
        lavender: "hsl(var(--lavender))",
        blue: "hsl(var(--blue))",
        "blue-light": "hsl(var(--blue-light))",
        green: "hsl(var(--green))",
        
        /* Legacy/Base tokens */
        bg: "hsl(var(--bg))",
        card: "hsl(var(--card))",
        ink: "hsl(var(--ink))",
        black: "hsl(var(--black))",
        muted: "hsl(var(--muted))",
        border: "hsl(var(--border))",
        
        /* Semantic tokens */
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
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        "muted-bg": "hsl(var(--muted-bg))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        "border-color": "hsl(var(--border-color))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        numbers: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
