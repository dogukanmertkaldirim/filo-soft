import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import CustomerLayout from './components/CustomerLayout';
import SuperAdminLayout from './components/SuperAdminLayout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Notes = lazy(() => import('./pages/Notes'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const Reservations = lazy(() => import('./pages/Reservations'));
const Maintenances = lazy(() => import('./pages/Maintenances'));
const Customers = lazy(() => import('./pages/Customers'));
const Finance = lazy(() => import('./pages/Finance'));
const VipTransfers = lazy(() => import('./pages/VipTransfers'));
const Drivers = lazy(() => import('./pages/Drivers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Loans = lazy(() => import('./pages/Loans'));
const ExternalServices = lazy(() => import('./pages/ExternalServices'));
const Reports = lazy(() => import('./pages/Reports'));
const VehicleSales = lazy(() => import('./pages/VehicleSales'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Settings = lazy(() => import('./pages/Settings'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Modules = lazy(() => import('./pages/Modules'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const ServiceAppointments = lazy(() => import('./pages/ServiceAppointments'));
const CustomerRequests = lazy(() => import('./pages/CustomerRequests'));
const DriverPortal = lazy(() => import('./pages/DriverPortal'));
const EmployeeDriverPortal = lazy(() => import('./pages/EmployeeDriverPortal'));
const HgsAutomation = lazy(() => import('./pages/HgsAutomation'));
const KabisBildirimleri = lazy(() => import('./pages/KabisBildirimleri'));
const TaskApprovalPool = lazy(() => import('./pages/TaskApprovalPool'));

const SuperAdminDashboard = lazy(() => import('./pages/admin/SuperAdminDashboard'));
const Plans = lazy(() => import('./pages/admin/Plans'));
const SystemLogs = lazy(() => import('./pages/admin/SystemLogs'));
const SuperAdminSettings = lazy(() => import('./pages/admin/SuperAdminSettings'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
    </div>
  );
}

function SuperAdminPageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading, isAdmin, isCustomer, isDriver, isSuperAdmin, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Yukleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (isDriver) {
    const isEmployee = user?.driver_type === 'employee';
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {isEmployee ? (
            <>
              <Route path="/employee-ops" element={<EmployeeDriverPortal />} />
              <Route path="*" element={<Navigate to="/employee-ops" replace />} />
            </>
          ) : (
            <>
              <Route path="/driver" element={<DriverPortal />} />
              <Route path="*" element={<Navigate to="/driver" replace />} />
            </>
          )}
        </Routes>
      </Suspense>
    );
  }

  if (isCustomer) {
    return (
      <CustomerLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/portal" element={<CustomerPortal />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Routes>
        </Suspense>
      </CustomerLayout>
    );
  }

  if (isSuperAdmin) {
    return (
      <Routes>
        <Route path="/admin" element={<SuperAdminLayout />}>
          <Route path="dashboard" element={
            <Suspense fallback={<SuperAdminPageLoader />}>
              <SuperAdminDashboard />
            </Suspense>
          } />
          <Route path="plans" element={
            <Suspense fallback={<SuperAdminPageLoader />}>
              <Plans />
            </Suspense>
          } />
          <Route path="logs" element={
            <Suspense fallback={<SuperAdminPageLoader />}>
              <SystemLogs />
            </Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={<SuperAdminPageLoader />}>
              <SuperAdminSettings />
            </Suspense>
          } />
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/maintenances" element={<Maintenances />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/hgs-automation" element={<HgsAutomation />} />
          <Route path="/kabis" element={<KabisBildirimleri />} />
          <Route path="/vip-transfers" element={<VipTransfers />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/external-services" element={<ExternalServices />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/vehicle-sales" element={<VehicleSales />} />
          <Route path="/service-appointments" element={<ServiceAppointments />} />
          <Route path="/customer-requests" element={<CustomerRequests />} />
          <Route path="/audit-logs" element={isAdmin ? <AuditLogs /> : <Navigate to="/" replace />} />
          <Route path="/settings" element={isAdmin ? <Settings /> : <Navigate to="/" replace />} />
          <Route path="/integrations" element={isAdmin ? <Integrations /> : <Navigate to="/" replace />} />
          <Route path="/task-approvals" element={isAdmin ? <TaskApprovalPool /> : <Navigate to="/" replace />} />
          <Route
            path="/modules"
            element={isSuperAdmin ? <Modules /> : <Navigate to="/" replace />}
          />
          <Route path="/portal" element={<Navigate to="/" replace />} />
          <Route path="/admin/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
