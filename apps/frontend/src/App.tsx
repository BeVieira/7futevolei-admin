import { Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { PublicPage } from "./pages/PublicPage";
import { AdminPage } from "./pages/AdminPage";
import { MinhasAulasPage } from "./pages/MinhasAulasPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PublicPage />} />
        <Route path="minhas-aulas" element={<MinhasAulasPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

export default App;
