import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { MembersProvider, useMembers } from "./members";
import Login from "./components/Login";
import FamilyDashboard from "./components/FamilyDashboard";
import NagList from "./components/NagList";
import CreateNag from "./components/CreateNag";
import KidView from "./components/KidView";
import Gamification from "./components/Gamification";
import Consents from "./components/Consents";
import IncentiveRules from "./components/IncentiveRules";
import Reports from "./components/Reports";
import Deliveries from "./components/Deliveries";
import Safety from "./components/Safety";
import { VersionProvider } from "./version";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Route restricted to guardians only (admin features). */
function GuardianRoute({ children }: { children: React.ReactNode }) {
  const { token, userId } = useAuth();
  const { members } = useMembers();
  if (!token) return <Navigate to="/login" replace />;
  const role = members.find((m) => m.user_id === userId)?.role;
  if (role && role !== "guardian") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Route for users who can create nags (guardians + participants). */
function NagCreatorRoute({ children }: { children: React.ReactNode }) {
  const { token, userId } = useAuth();
  const { members } = useMembers();
  if (!token) return <Navigate to="/login" replace />;
  const role = members.find((m) => m.user_id === userId)?.role;
  if (role && role === "child") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { userId } = useAuth();
  const { members } = useMembers();
  const role = members.find((m) => m.user_id === userId)?.role;
  if (role === "guardian" || role === "participant") return <FamilyDashboard />;
  return <KidView />;
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
              <HomeRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/family"
          element={
            <GuardianRoute>
              <FamilyDashboard />
            </GuardianRoute>
          }
        />
        <Route
          path="/nags"
          element={
            <NagCreatorRoute>
              <NagList />
            </NagCreatorRoute>
          }
        />
        <Route
          path="/create-nag"
          element={
            <NagCreatorRoute>
              <CreateNag />
            </NagCreatorRoute>
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
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Gamification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/consents"
          element={
            <ProtectedRoute>
              <Consents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/incentive-rules"
          element={
            <GuardianRoute>
              <IncentiveRules />
            </GuardianRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <GuardianRoute>
              <Reports />
            </GuardianRoute>
          }
        />
        <Route
          path="/deliveries"
          element={
            <GuardianRoute>
              <Deliveries />
            </GuardianRoute>
          }
        />
        <Route
          path="/safety"
          element={
            <ProtectedRoute>
              <Safety />
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
      <VersionProvider>
        <AuthProvider>
          <MembersProvider>
            <AppRoutes />
          </MembersProvider>
        </AuthProvider>
      </VersionProvider>
    </BrowserRouter>
  );
}
