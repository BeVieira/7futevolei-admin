import { Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { PublicPage } from "./pages/PublicPage/PublicPage";
import { AdminPage } from "./pages/AdminPage/AdminPage";
import { AdminReceiptsPage } from "./pages/AdminReceiptsPage/AdminReceiptsPage";
import { MinhasAulasPage } from "./pages/MinhasAulasPage/MinhasAulasPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PublicPage />} />
        <Route path="minhas-aulas" element={<MinhasAulasPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/cobranca" element={<AdminReceiptsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
