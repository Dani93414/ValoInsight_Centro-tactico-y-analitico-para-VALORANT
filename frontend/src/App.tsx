import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Agentes from "./pages/Agentes";
import Armas from "./pages/Armas";
import Estadisticas from "./pages/Estadisticas";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agentes" element={<Agentes />} />
        <Route path="/armas" element={<Armas />} />
        <Route path="/estadisticas/:playerId" element={<Estadisticas />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
