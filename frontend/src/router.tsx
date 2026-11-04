import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router"
import RootLayout from "./components/layout/RootLayout"

const rootRoute = createRootRoute({
  component: RootLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./pages/DashboardPage")),
})

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  component: lazyRouteComponent(() => import("./pages/ProjectPage")),
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./pages/SettingsPage")),
})

const labelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/labels/$labelId",
  component: lazyRouteComponent(() => import("./pages/LabelsPage")),
})

const routeTree = rootRoute.addChildren([dashboardRoute, projectRoute, settingsRoute, labelsRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
