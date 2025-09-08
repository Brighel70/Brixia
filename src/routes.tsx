import { createBrowserRouter } from 'react-router-dom'
import LoginView from '@/pages/LoginView'
import HomeView from '@/pages/HomeView'

import AttendanceBoard from '@/pages/AttendanceBoard'
import CreatePlayer from '@/pages/CreatePlayer'
import CreateUser from '@/pages/CreateUser'
import BrandCustomization from '@/pages/BrandCustomization'
import Settings from '@/pages/Settings'
import PlayersView from '@/pages/PlayersView'
import StaffView from '@/pages/StaffView'
import Activities from '@/pages/Activities'
import StartTraining from '@/pages/StartTraining'

import CategoryActivities from '@/pages/CategoryActivities'
import Events from '@/pages/Events'
import CouncilManagement from '@/pages/CouncilManagement'
import PeopleView from '@/pages/PeopleView'
import CreatePersonView from '@/pages/CreatePersonView'
import AuthLayout from '@/components/AuthLayout'
import { PermissionGuard } from '@/components/PermissionGuard'
import { PERMISSIONS } from '@/config/permissions'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout requireAuth={false}><LoginView /></AuthLayout>
  },
  {
    path: '/login',
    element: <AuthLayout requireAuth={false}><LoginView /></AuthLayout>
  },
  {
    path: '/home',
    element: (
      <AuthLayout requireAuth={true}>
        <HomeView />
      </AuthLayout>
    )
  },
  {
    path: '/dashboard',
    element: (
      <AuthLayout requireAuth={true}>
        <HomeView />
      </AuthLayout>
    )
  },

  {
    path: '/activities',
    element: (
      <AuthLayout requireAuth={true}>
        <Activities />
      </AuthLayout>
    )
  },
  {
    path: '/start',
    element: (
      <AuthLayout requireAuth={true}>
        <StartTraining />
      </AuthLayout>
    )
  },

  {
    path: '/category-activities',
    element: (
      <AuthLayout requireAuth={true}>
        <CategoryActivities />
      </AuthLayout>
    )
  },
  {
    path: '/events',
    element: (
      <AuthLayout requireAuth={true}>
        <Events />
      </AuthLayout>
    )
  },
  {
    path: '/board',
    element: (
      <AuthLayout requireAuth={true}>
        <AttendanceBoard />
      </AuthLayout>
    )
  },
  {
    path: '/create-player',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.PLAYERS.CREATE} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <CreatePlayer />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/create-user',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.USERS.CREATE} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <CreateUser />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/brand-customization',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.SETTINGS.EDIT} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <BrandCustomization />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/settings',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.SETTINGS.EDIT} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <Settings />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/council-management',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.SETTINGS.EDIT} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <CouncilManagement />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/players',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.PLAYERS.VIEW} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <PlayersView />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/staff',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.USERS.VIEW} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <StaffView />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/people',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.USERS.VIEW} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <PeopleView />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/create-person',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.USERS.CREATE} fallback={<div className="p-6 text-center text-red-600">❌ Accesso negato: permesso insufficiente</div>}>
          <CreatePersonView />
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '*',
    element: (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600 mb-4">404</h1>
          <p className="text-gray-600 mb-4">Pagina non trovata</p>
          <a href="/home" className="text-blue-600 hover:underline">Torna alla Home</a>
        </div>
      </div>
    )
  }
], {
  future: {
    v7_startTransition: true
  }
})