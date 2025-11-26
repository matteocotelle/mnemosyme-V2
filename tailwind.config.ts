import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Nos couleurs personnalisées
				brand: {
					dark: '#0f172a',    // Fond principal (Slate 900)
					primary: '#6366f1', // Indigo (Bouton principal)
					secondary: '#ec4899', // Pink (Bouton secondaire)
					accent: '#8b5cf6'   // Violet (Accents)
				}
			},
			animation: {
				'float': 'float 6s ease-in-out infinite',
			},
			keyframes: {
				float: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' },
				}
			}
		}
	},
	plugins: []
} satisfies Config;