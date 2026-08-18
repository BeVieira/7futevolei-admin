import { Route, Routes } from "react-router-dom";
import { Layout, RequireAdmin } from "./components";
import { PublicPage } from "./pages/PublicPage/PublicPage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { AdminPage } from "./pages/AdminPage/AdminPage";
import { AdminReceiptsPage } from "./pages/AdminReceiptsPage/AdminReceiptsPage";
import { MinhasAulasPage } from "./pages/MinhasAulasPage/MinhasAulasPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PublicPage />} />
        <Route path="minhas-aulas" element={<MinhasAulasPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="admin" element={<AdminPage />} />
          <Route path="admin/cobranca" element={<AdminReceiptsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
