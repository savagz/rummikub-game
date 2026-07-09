/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Russo One', 'sans-serif'],
        body: ['Chakra Petch', 'sans-serif'],
      },
      colors: {
        tile: {
          red: '#C62828',
          blue: '#1565C0',
          black: '#212121',
          orange: '#B8860B',
        }
      },
      backgroundImage: {
        'game-bg': 'radial-gradient(ellipse at top, #1e1b4b 0%, #0F0F23 60%)',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(124, 58, 237, 0.5)',
        'tile': '0 2px 3px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
        'tile-hover': '0 14px 28px rgba(0,0,0,0.5), 0 0 20px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.95)',
        'btn-glow': '0 8px 25px rgba(0,0,0,0.4), 0 0 40px rgba(124,58,237,0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(124,58,237,0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(124,58,237,0.8)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        }
      }
    },
  },
  plugins: [],
}
