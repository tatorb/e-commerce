import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Sale de app.studiomrb.com (tatorb/LGM-processor), con el estilo propio de
// esta app en los tokens de globals.css. Los colores van por esos tokens o por
// la paleta de Tailwind, no sueltos.
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        alert: {
          DEFAULT: 'hsl(var(--alert))',
          foreground: 'hsl(var(--alert-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Las tarjetas: una sombra suave que las despega del fondo.
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 2px 8px rgb(16 24 40 / 0.04)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // La barra de carga de arriba: un tramo que cruza de izquierda a derecha.
        'nav-progress': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(250%)' },
        },
        // El logo en las esperas: un latido doble y una pausa, como un corazón.
        'brand-beat': {
          '0%, 60%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '15%': { transform: 'scale(1.1)', opacity: '1' },
          '30%': { transform: 'scale(1)', opacity: '0.9' },
          '45%': { transform: 'scale(1.06)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'nav-progress': 'nav-progress 1.1s ease-in-out infinite',
        'brand-beat': 'brand-beat 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
