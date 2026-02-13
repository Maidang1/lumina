import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/main.css';
import App from '@/app/App';
import { ClickToComponent } from 'click-to-react-component';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {process.env.NODE_ENV === 'development' ? <ClickToComponent editor="trae-cn" /> : null}
    <App />
  </React.StrictMode>
);
