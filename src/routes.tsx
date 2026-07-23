import { createBrowserRouter, Navigate, useLocation, useSearchParams } from 'react-router-dom'

/** Redirige /agenda/nuovo e /infortuni/nuovo → /infortuni con add=1 (apre il modal nuovo) */
function RedirectAgendaNuovo() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('add', '1')
  return <Navigate to={`/infortuni?${params.toString()}`} replace />
}

function RedirectOriginClubsToClubs() {
  const location = useLocation()
  return <Navigate to="/clubs" replace state={location.state} />
}
import LoginView from '@/pages/LoginView'
import HomeView from '@/pages/HomeView'

import AttendanceBoard from '@/pages/AttendanceBoard'
import CreatePlayer from '@/pages/CreatePlayer'
import CreateStaff from '@/pages/CreateStaff'
import CreateUser from '@/pages/CreateUser'
import BrandCustomization from '@/pages/BrandCustomization'
import Settings from '@/pages/Settings'
import PlayersView from '@/pages/PlayersView'
import StaffView from '@/pages/StaffView'
import Activities from '@/pages/Activities'
import StartTrainingQR from '@/pages/StartTrainingQR'

import CategoryActivities from '@/pages/CategoryActivities'
import Events from '@/pages/Events'
import EventsHistory from '@/pages/EventsHistory'
import CouncilManagement from '@/pages/CouncilManagement'
import ClubsManagement from '@/pages/ClubsManagement'
import PeopleView from '@/pages/PeopleView'
import CreatePersonView from '@/pages/CreatePersonView'
import AgendaView from '@/pages/AgendaView'
import FeesManagement from '@/pages/FeesManagement'
import AccountingManagement from '@/pages/AccountingManagement'
import AlertsPage from '@/pages/AlertsPage'
import ResocontoSettimanale from '@/pages/ResocontoSettimanale'
import MemoPage from '@/pages/MemoPage'
import BirthdaysPage from '@/pages/BirthdaysPage'
import UsersManagement from '@/pages/UsersManagement'
import EditUser from '@/pages/EditUser'
import RolePermissionsManagement from '@/pages/RolePermissionsManagement'
import InfortuniAssicurazioneSettings from '@/pages/InfortuniAssicurazioneSettings'
import MobileAttendance from '@/components/MobileAttendance'
import AuthLayout from '@/components/AuthLayout'
import DashboardLayout from '@/components/DashboardLayout'
import { PermissionGuard } from '@/components/PermissionGuard'
import { PERMISSIONS } from '@/config/permissions'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthLayout requireAuth={false}><LoginView /></AuthLayout>
  },
  {
    path: '/home',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <HomeView />
        </DashboardLayout>
      </AuthLayout>
    )
  },

  {
    path: '/activities',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <Activities embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/start-qr',
    element: (
      <AuthLayout requireAuth={true}>
        <StartTrainingQR />
      </AuthLayout>
    )
  },

  {
    path: '/category-activities',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <CategoryActivities embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/events',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <Events embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/events-history',
    element: (
      <AuthLayout requireAuth={true}>
        <EventsHistory />
      </AuthLayout>
    )
  },
  {
    path: '/council-management',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.COUNCIL.MANAGE}>
          <DashboardLayout>
            <CouncilManagement embedInLayout />
          </DashboardLayout>
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/clubs',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <ClubsManagement embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/origin-clubs',
    element: <RedirectOriginClubsToClubs />
  },
  {
    path: '/people',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <PeopleView embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/create-person',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <CreatePersonView embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/infortuni',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <AgendaView embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/infortuni/nuovo',
    element: <RedirectAgendaNuovo />
  },
  /* Redirect vecchi URL /agenda → /infortuni (per app mobile e bookmark) */
  {
    path: '/agenda',
    element: <Navigate to="/infortuni" replace />
  },
  {
    path: '/agenda/nuovo',
    element: <RedirectAgendaNuovo />
  },
  {
    path: '/fees',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <FeesManagement embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/accounting',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.ACCOUNTING.VIEW}>
          <DashboardLayout>
            <AccountingManagement embedInLayout />
          </DashboardLayout>
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/attendance',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <AttendanceBoard embedInLayout />
        </DashboardLayout>
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
    path: '/board-hybrid',
    element: (
      <AuthLayout requireAuth={true}>
        <AttendanceBoard variant="hybrid" />
      </AuthLayout>
    )
  },
  {
    path: '/mobile-attendance',
    element: (
      <AuthLayout requireAuth={true}>
        <MobileAttendance />
      </AuthLayout>
    )
  },
  {
    path: '/players',
    element: (
      <AuthLayout requireAuth={true}>
        <PlayersView />
      </AuthLayout>
    )
  },
  {
    path: '/create-player',
    element: (
      <AuthLayout requireAuth={true}>
        <CreatePlayer />
      </AuthLayout>
    )
  },
  {
    path: '/create-staff',
    element: (
      <AuthLayout requireAuth={true}>
        <CreateStaff />
      </AuthLayout>
    )
  },
  {
    path: '/staff',
    element: (
      <AuthLayout requireAuth={true}>
        <StaffView />
      </AuthLayout>
    )
  },
  {
    path: '/create-user',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.USERS.CREATE}>
          <DashboardLayout>
            <CreateUser />
          </DashboardLayout>
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/brand-customization',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.BRAND.MANAGE}>
          <DashboardLayout>
            <BrandCustomization embedInLayout />
          </DashboardLayout>
        </PermissionGuard>
      </AuthLayout>
    )
  },
  {
    path: '/settings',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <Settings embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/infortuni-assicurazione',
    element: (
      <AuthLayout requireAuth={true}>
        <InfortuniAssicurazioneSettings />
      </AuthLayout>
    )
  },
  {
    path: '/alerts',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <AlertsPage embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/resoconto-settimanale',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <ResocontoSettimanale embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/memo',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <MemoPage embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/birthdays',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <BirthdaysPage embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/users-management',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <UsersManagement embedInLayout />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/edit-user/:userId',
    element: (
      <AuthLayout requireAuth={true}>
        <DashboardLayout>
          <EditUser />
        </DashboardLayout>
      </AuthLayout>
    )
  },
  {
    path: '/role-permissions',
    element: (
      <AuthLayout requireAuth={true}>
        <PermissionGuard requiredPermission={PERMISSIONS.USERS.MANAGE_PERMISSIONS}>
          <RolePermissionsManagement />
        </PermissionGuard>
      </AuthLayout>
    )
  }
])
