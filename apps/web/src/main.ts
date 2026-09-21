import { mount } from 'svelte';
import './styles/tokens.css';
import App from './App.svelte';
import { registerServiceWorker } from './lib/registerSW.js';

registerServiceWorker();

const target = document.getElementById('app');
if (target === null) throw new Error('#app missing from index.html');

export default mount(App, { target });
