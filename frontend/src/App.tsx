import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider } from './context/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { EditListingPage } from './pages/EditListingPage';
import { ListingBookingsPage } from './pages/ListingBookingsPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { ListingInquiriesPage } from './pages/ListingInquiriesPage';
import { ListingTransactionsPage } from './pages/ListingTransactionsPage';
import { ListingsPage } from './pages/ListingsPage';
import { LoginPage } from './pages/LoginPage';
import { CreateListingPage } from './pages/CreateListingPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { MyInquiriesPage } from './pages/MyInquiriesPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { MyPaymentsPage } from './pages/MyPaymentsPage';
import { MySavedListingsPage } from './pages/MySavedListingsPage';
import { MyTransactionsPage } from './pages/MyTransactionsPage';
import { PaymentCancelPage } from './pages/PaymentCancelPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { RegisterPage } from './pages/RegisterPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/listings" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<AppLayout />}>
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/new"
              element={
                <ProtectedRoute>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/mine"
              element={
                <ProtectedRoute>
                  <MyListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:id/edit"
              element={
                <ProtectedRoute>
                  <EditListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings/mine"
              element={
                <ProtectedRoute>
                  <MyBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions/mine"
              element={
                <ProtectedRoute>
                  <MyTransactionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inquiries/mine"
              element={
                <ProtectedRoute>
                  <MyInquiriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/mine"
              element={
                <ProtectedRoute>
                  <MyPaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/success"
              element={
                <ProtectedRoute>
                  <PaymentSuccessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments/cancel"
              element={
                <ProtectedRoute>
                  <PaymentCancelPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved-listings/mine"
              element={
                <ProtectedRoute>
                  <MySavedListingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:id/bookings"
              element={
                <ProtectedRoute>
                  <ListingBookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:id/inquiries"
              element={
                <ProtectedRoute>
                  <ListingInquiriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listings/:id/transactions"
              element={
                <ProtectedRoute>
                  <ListingTransactionsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
