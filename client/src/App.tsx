import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// Connect is the inline-CloudXR.js VR connect page. Lazy-loaded so the homepage
// bundle isn't bloated by the streaming SDK (~200–500 KB).
//
// Domain-based apex routing:
//   simxr.app   apex (`/`)      → Connect (operator-facing VR demo)
//   simxr.tech  apex (`/`)      → Home (marketing site)
//   either domain `/connect`    → Connect (legacy / direct path)
//
// The legacy v1 multi-scene picker (NVIDIA-hosted client via Netlify proxy)
// lives at `/connect-classic` as a static file in client/public/connect-classic/.
const Connect = lazy(() => import("./pages/Connect"));

function isAppDomain(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "simxr.app" || h === "www.simxr.app";
}

function Root() {
  return isAppDomain() ? (
    <Suspense fallback={null}>
      <Connect />
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
          <Connect />
        </Suspense>
      </Route>
      <Route path={"/connect/"}>
        <Suspense fallback={null}>
          <Connect />
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
