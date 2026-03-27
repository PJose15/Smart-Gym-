import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--color-bg-base)',
          raised: 'var(--color-bg-raised)',
          elevated: 'var(--color-bg-elevated)',
          highest: 'var(--color-bg-highest)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
          focus: 'var(--color-border-focus)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          disabled: 'var(--color-text-disabled)',
          inverse: 'var(--color-text-inverse)',
        },
        blue: {
          DEFAULT: 'var(--color-blue)',
          light: 'var(--color-blue-light)',
          dark: 'var(--color-blue-dark)',
          subtle: 'var(--color-blue-subtle)',
        },
        gold: {
          DEFAULT: 'var(--color-gold)',
          light: 'var(--color-gold-light)',
          dark: 'var(--color-gold-dark)',
          subtle: 'var(--color-gold-subtle)',
        },
        amber: {
          DEFAULT: 'var(--color-amber)',
          light: 'var(--color-amber-light)',
          dark: 'var(--color-amber-dark)',
          subtle: 'var(--color-amber-subtle)',
        },
        green: {
          DEFAULT: 'var(--color-green)',
          light: 'var(--color-green-light)',
          dark: 'var(--color-green-dark)',
          subtle: 'var(--color-green-subtle)',
        },
        purple: {
          DEFAULT: 'var(--color-purple)',
          light: 'var(--color-purple-light)',
          dark: 'var(--color-purple-dark)',
          subtle: 'var(--color-purple-subtle)',
        },
        red: {
          DEFAULT: 'var(--color-red)',
          light: 'var(--color-red-light)',
          subtle: 'var(--color-red-subtle)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        gold: 'var(--shadow-gold)',
        blue: 'var(--shadow-blue)',
      },
      zIndex: {
        base: '0',
        raised: '10',
        sticky: '100',
        nav: '200',
        overlay: '300',
        modal: '400',
        toast: '500',
        celebration: '600',
      },
    },
  },
  plugins: [],
}

export default config
