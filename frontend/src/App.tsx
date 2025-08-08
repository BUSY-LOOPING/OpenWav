import { BrowserRouter, Routes, Route } from "react-router";
import Home from "./routes/public/home";
import Layout from "./routes/public/layout";

const App = () => {
  return (
    <BrowserRouter>
      <main id="main">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </main>
    </BrowserRouter>
  );
};

export default App;
