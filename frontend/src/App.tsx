import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const Agentes = lazy(() => import("./pages/Agentes"));
const Armas = lazy(() => import("./pages/Armas"));
const Estadisticas = lazy(() => import("./pages/Estadisticas"));

function App() {
  return (
    <BrowserRouter>
      <div className="page-scale">
        <Suspense fallback={<div className="loading-screen">Cargando...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agentes" element={<Agentes />} />
            <Route path="/armas" element={<Armas />} />
            <Route path="/estadisticas/:playerId" element={<Estadisticas />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
