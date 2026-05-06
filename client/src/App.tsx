import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Dashboard is the operator-console version of the inline-CloudXR.js VR
// connect page. Lazy-loaded so the marketing-side homepage bundle isn't
// bloated by the streaming SDK (~200–500 KB).
//
// Domain-based apex routing:
//   simxr.app   apex (`/`)      → Dashboard (operator-facing VR demo)
//   simxr.tech  apex (`/`)      → Home (marketing site)
//   either domain `/connect`    → Dashboard (legacy direct path; v1 alias)
//   either domain `/v2`         → Dashboard (versioned alias kept stable)
//
// The original simpler `Connect.tsx` page is preserved in src/pages/ for
// reference and easy rollback (re-route here if the dashboard ever ships
// a regression). The legacy v1 multi-scene picker (NVIDIA-hosted client
// via Netlify proxy) still lives at `/connect-classic` as a static file
// in client/public/connect-classic/.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Recordings = lazy(() => import("./pages/Recordings"));

function isAppDomain(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "simxr.app" || h === "www.simxr.app";
}

function Root() {
  return isAppDomain() ? (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  ) : (
    <Home />
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Root} />
      <Route path={"/connect"}>
        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
      </Route>
      <Route path={"/connect/"}>
        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
      </Route>
      <Route path={"/v2"}>
        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
      </Route>
      <Route path={"/v2/"}>
        <Suspense fallback={null}>
          <Dashboard />
        </Suspense>
      </Route>
      <Route path={"/recordings"}>
        <Suspense fallback={null}>
          <Recordings />
        </Suspense>
      </Route>
      <Route path={"/recordings/"}>
        <Suspense fallback={null}>
          <Recordings />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
