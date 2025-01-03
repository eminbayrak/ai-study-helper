import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LingoSlide from './pages/LingoSlide';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { CustomThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/ThemeContext';
import { Toaster } from './components/ui/toaster';

function AppContent() {
  const { currentTheme } = useTheme();

  return (
    <div 
      className="min-h-screen w-full fixed inset-0"
      style={{ backgroundColor: currentTheme.colors.bg }}
    >
      <Navbar />
      <main className="w-full h-full overflow-auto pt-12">
        <SpeedInsights />
        <Routes>
          <Route path="/lingoslide" element={<LingoSlide />} />
          <Route path="/" element={<Navigate to="/lingoslide" replace />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <CustomThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </CustomThemeProvider>
  );
}

export default App;
