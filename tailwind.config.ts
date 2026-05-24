import type {Config} from 'tailwindcss';

/**
 * Cores `dnd.*` mapeiam CSS vars em `src/design-system/tokens.css`.
 * Preferir tokens semânticos (dnd-ember, dnd-gold, dnd-parchment) em UI v2.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-im-fell)'],
        serif: ['var(--font-cinzel)'],
        display: ['var(--font-cinzel)', 'Cinzel Decorative', 'serif'],
        narrative: ['var(--font-im-fell)', 'IM Fell English', 'serif'],
        ui: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        dnd: {
          ember: 'var(--dnd-ember)',
          'ember-hover': 'var(--dnd-ember-hover)',
          'ember-muted': 'var(--dnd-ember-muted)',
          gold: 'var(--dnd-gold)',
          'gold-dim': 'var(--dnd-gold-dim)',
          obsidian: 'var(--dnd-obsidian)',
          'obsidian-raised': 'var(--dnd-obsidian-raised)',
          'obsidian-glass': 'var(--dnd-obsidian-glass)',
          parchment: 'var(--dnd-parchment)',
          'parchment-muted': 'var(--dnd-parchment-muted)',
          mist: 'var(--dnd-mist)',
          'mist-strong': 'var(--dnd-mist-strong)',
          success: 'var(--dnd-success)',
          danger: 'var(--dnd-danger)',
        },
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
        "fadeIn": {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        "fadeInSlideUp": {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        "staggerIn": {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        "pulse": {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.7' },
        }
      },
      transitionTimingFunction: {
        'dnd-out': 'var(--dnd-ease-out-expo)',
      },
      transitionDuration: {
        ui: 'var(--dnd-duration-ui)',
        scene: 'var(--dnd-duration-scene)',
      },
      maxWidth: {
        'screen-xl': 'var(--dnd-container-max)',
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fadeIn": "fadeIn 0.5s ease-in-out",
        "fadeInSlideUp": "fadeInSlideUp 400ms ease-out forwards",
        "staggerIn": "staggerIn 0.4s var(--dnd-ease-out-expo) forwards",
      },
      backgroundSize: {
        '200%': '200%',
      },
      backgroundPosition: {
        'right-center': 'right center',
      }
    },
  },
  plugins: [require("tailwindcss-animate"), require('@tailwindcss/forms')],
}

export default config;
