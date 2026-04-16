import { useCallback } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';
import { useCursor } from './hooks/useCursor';

function AppRoutes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const handleSearch = useCallback((q: string) => {
    const nextQuery = q.trim();
    if (!nextQuery) {
      return;
    }

    navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
  }, [navigate]);

  const handleHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage onSearch={handleSearch} />} />
      <Route
        path="/search"
        element={<SearchPage initialQuery={query} onHome={handleHome} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  useCursor('cursor');

  return (
    <BrowserRouter>
      <div className="cursor" id="cursor" />
      <div className="noise" />
      <AppRoutes />
    </BrowserRouter>
  );
}
