import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppTopbar } from "./components/layout/AppTopbar";
import PageLoadingScreen from "./components/ui/PageLoadingScreen";
import { useAuth } from "./context/AuthContext";

const Home = lazy(() => import("./pages/Home"));
const Agentes = lazy(() => import("./pages/Agentes"));
const Armas = lazy(() => import("./pages/Armas"));
const Mapas = lazy(() => import("./pages/Mapas"));
const Actos = lazy(() => import("./pages/Actos"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Modos = lazy(() => import("./pages/Modos"));
const Informacion = lazy(() => import("./pages/Informacion"));
const EstadisticasGlobales = lazy(() => import("./pages/EstadisticasGlobales"));
const CosmeticosSkins = lazy(() => import("./pages/CosmeticosSkins"));
const CosmeticosLlaveros = lazy(() => import("./pages/CosmeticosLlaveros"));
const CosmeticosFlex = lazy(() => import("./pages/CosmeticosFlex"));
const CosmeticosBordes = lazy(() => import("./pages/CosmeticosBordes"));
const CosmeticosTitulosTarjetas = lazy(
  () => import("./pages/CosmeticosTitulosTarjetas"),
);
const CosmeticosSprays = lazy(() => import("./pages/CosmeticosSprays"));
const Estadisticas = lazy(() => import("./pages/Estadisticas"));
const HeatmapPage = lazy(() => import("./pages/HeatmapPage"));

interface LoadSignalProps {
  onSignal: () => void;
  children?: ReactNode;
}

function LoadSignal({ onSignal, children }: LoadSignalProps) {
  useEffect(() => {
    onSignal();
  }, [onSignal]);

  return children;
}

function RouteReadySignal({ onSignal, children }: LoadSignalProps) {
  const location = useLocation();

  useEffect(() => {
    onSignal();
  }, [location.key, onSignal]);

  return children;
}

interface LoadingOverlayProps {
  isLoading: boolean;
}

function LoadingOverlay({ isLoading }: LoadingOverlayProps) {
  const [isVisible, setIsVisible] = useState(isLoading);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    const syncTimerId = window.setTimeout(() => {
      if (isLoading) {
        setIsVisible(true);
        setIsCompleting(false);
      } else if (isVisible) {
        setIsCompleting(true);
      }
    }, 0);

    return () => window.clearTimeout(syncTimerId);
  }, [isLoading, isVisible]);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    setIsCompleting(false);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <PageLoadingScreen
      isCompleting={isCompleting}
      onComplete={handleComplete}
    />
  );
}

function App() {
  const { isLoading: isAuthLoading } = useAuth();
  const [isRouteLoading, setIsRouteLoading] = useState(true);
  const handleRouteLoading = useCallback(() => setIsRouteLoading(true), []);
  const handleRouteReady = useCallback(() => setIsRouteLoading(false), []);

  return (
    <>
      {!isAuthLoading && (
        <BrowserRouter>
          <div className="page-scale">
            <AppTopbar />
            <Suspense fallback={<LoadSignal onSignal={handleRouteLoading} />}>
              <RouteReadySignal onSignal={handleRouteReady}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/agentes" element={<Agentes />} />
                  <Route path="/armas" element={<Armas />} />
                  <Route path="/mapas" element={<Mapas />} />
                  <Route path="/actos" element={<Actos />} />
                  <Route path="/eventos" element={<Eventos />} />
                  <Route path="/modos" element={<Modos />} />
                  <Route path="/informacion" element={<Informacion />} />
                  <Route
                    path="/estadisticas-globales"
                    element={<EstadisticasGlobales />}
                  />
                  <Route path="/cosmeticos/skins" element={<CosmeticosSkins />} />
                  <Route
                    path="/cosmeticos/llaveros"
                    element={<CosmeticosLlaveros />}
                  />
                  <Route path="/cosmeticos/flex" element={<CosmeticosFlex />} />
                  <Route path="/cosmeticos/bordes" element={<CosmeticosBordes />} />
                  <Route
                    path="/cosmeticos/titulos-tarjetas"
                    element={<CosmeticosTitulosTarjetas />}
                  />
                  <Route path="/cosmeticos/sprays" element={<CosmeticosSprays />} />
                  <Route path="/estadisticas/:playerId" element={<Estadisticas />} />
                  <Route
                    path="/estadisticas/:playerId/heatmap"
                    element={<HeatmapPage />}
                  />
                </Routes>
              </RouteReadySignal>
            </Suspense>
          </div>
        </BrowserRouter>
      )}
      <LoadingOverlay isLoading={isAuthLoading || isRouteLoading} />
    </>
  );
}

export default App;
