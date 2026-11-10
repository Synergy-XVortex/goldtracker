import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../components/AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { DashboardPage } from '../features/portfolio/DashboardPage'
import { PortfolioPage } from '../features/portfolio/PortfolioPage'
import { PricesRoute } from './PricesRoute'
import { PurchaseFormPage } from '../features/purchases/PurchaseFormPage'
import { SettingsPage } from '../features/settings/SettingsPage'

export const router = createBrowserRouter([
  { path: '/cours', element: <PricesRoute /> },
  { path: '/connexion', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'portefeuille', element: <PortfolioPage /> },
          { path: 'reglages', element: <SettingsPage /> },
          { path: 'achats/nouveau', element: <PurchaseFormPage /> },
          { path: 'achats/:purchaseId', element: <PurchaseFormPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
