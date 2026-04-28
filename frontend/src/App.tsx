import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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

function App() {
  return (
    <BrowserRouter>
      <div className="page-scale">
        <Suspense fallback={<div className="loading-screen">Cargando...</div>}>
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
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
