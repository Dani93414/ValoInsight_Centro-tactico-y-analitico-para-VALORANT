import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Agentes from "./pages/Agentes";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/agentes" element={<Agentes />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
