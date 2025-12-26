import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 1000 * 15 * 1,
      cacheTime: 1000 * 60 * 5, // 캐시 유지 시간 (기본 5분)
      refetchOnMount: true,
      refetchOnWindowFocus: true, // 포커스 시 refetch 방지
      refetchOnReconnect: true, // reconnect 시 refetch 방지
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.VITE_RUN_ENV === 'DEV' && <ReactQueryDevtools />}
    </QueryClientProvider>
  </React.StrictMode>
);
