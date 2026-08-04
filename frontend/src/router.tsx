import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router"
import RootLayout from "./components/layout/RootLayout"
import DashboardPage from "./pages/DashboardPage"
import ProjectPage from "./pages/ProjectPage"
import SettingsPage from "./pages/SettingsPage"
import LabelsPage from "./pages/LabelsPage"

const rootRoute = createRootRoute({
  component: RootLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
})

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  component: ProjectPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
})

const labelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/labels/$labelId",
  component: LabelsPage,
})

const routeTree = rootRoute.addChildren([dashboardRoute, projectRoute, settingsRoute, labelsRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
