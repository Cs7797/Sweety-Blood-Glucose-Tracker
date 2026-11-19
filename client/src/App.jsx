import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAppContext } from "../context/appContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Login from "./pages/Login.jsx";
import Account from "./pages/Account.jsx";
import Dashboard from "./pages/Dashboard.jsx";

function App() {
  const { user, isLoading, error, logout } = useAppContext();
  if (isLoading) return <p role="status" className="p-8 text-center text-gray-500">Loading your account…</p>;
  if (error) return (
    <main className="max-w-md mx-auto p-8 space-y-4">
      <p role="alert">{error}</p>
      <button onClick={() => window.location.reload()} className="bg-primary text-white rounded-md px-4 py-2">Try again</button>
      <button onClick={logout} className="ml-4 text-primary">Log out</button>
    </main>
  );
  return (
    <>
      <Toaster />
      {user ? (
        <div key={user.id}>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login key="login" />} />
          <Route path="/register" element={<Login key="register" />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </>
  );
}

export default App;
