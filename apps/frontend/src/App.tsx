import { Route, Routes } from "react-router-dom";
import { Layout, RequireAdmin, RequireAuth } from "./components";
import { PublicPage } from "./pages/PublicPage/PublicPage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { AdminPage } from "./pages/AdminPage/AdminPage";
import { AdminReceiptsPage } from "./pages/AdminReceiptsPage/AdminReceiptsPage";
import { MinhasAulasPage } from "./pages/MinhasAulasPage/MinhasAulasPage";
import { PerfilPage } from "./pages/PerfilPage/PerfilPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PublicPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="minhas-aulas" element={<MinhasAulasPage />} />
          <Route path="perfil" element={<PerfilPage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/cobranca" element={<AdminReceiptsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
