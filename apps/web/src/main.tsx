import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './lib/openpanel';
import { MetaPixelPageView } from './lib/metaPixel';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MetaPixelPageView />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
