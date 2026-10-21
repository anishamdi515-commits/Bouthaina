import { createRoot } from 'react-dom/client';
import '@fontsource/tajawal/arabic-400.css';
import '@fontsource/tajawal/arabic-500.css';
import '@fontsource/tajawal/arabic-700.css';
import '@fontsource/tajawal/latin-400.css';
import '@fontsource/tajawal/latin-500.css';
import '@fontsource/tajawal/latin-700.css';
import '@fontsource/el-messiri/arabic-700.css';
import '@fontsource/el-messiri/latin-700.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
