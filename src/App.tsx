import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { MembersProvider } from "./members";
import Login from "./components/Login";
import FamilyDashboard from "./components/FamilyDashboard";
import NagList from "./components/NagList";
import CreateNag from "./components/CreateNag";
import KidView from "./components/KidView";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token } = useAuth();

  return (
    <div className="app">
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <FamilyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nags"
          element={
            <ProtectedRoute>
              <NagList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-nag"
          element={
            <ProtectedRoute>
              <CreateNag />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kid"
          element={
            <ProtectedRoute>
              <KidView />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MembersProvider>
          <AppRoutes />
        </MembersProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
