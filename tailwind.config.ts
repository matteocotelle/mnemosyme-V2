import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				background: '#141726',
				surface: {
					DEFAULT: '#1E2237',
					light: '#262B44',
				},
				primary: '#FF5E5B',
				secondary: '#FFCD38',
				accent: '#48BFE3',
				'text-primary': '#F0F0F5',
				'text-muted': '#8B8CA0',
				success: '#34D399',
				error: '#F87171',
			},
			fontFamily: {
				heading: ['Space Grotesk', 'sans-serif'],
				body: ['Inter', 'sans-serif'],
			},
			animation: {
				'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
			},
			keyframes: {
				'pulse-dot': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.3' },
				},
			},
		},
	},
	plugins: [],
} satisfies Config;
