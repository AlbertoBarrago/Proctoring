import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
        exclude: ['onnxruntime-web']
    },
    build: {
        rollupOptions: {
            external: [],
            output: {
                manualChunks: undefined
            }
        }
    },
    define: {
        global: 'globalThis'
    }

});
