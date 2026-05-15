import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import UserLayout from './layouts/UserLayout';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ReviewManagement from './pages/admin/ReviewManagement';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import BookManagement from './pages/admin/BookManagement';
import ReportManagement from './pages/admin/ReportManagement';
import TestimonialManagement from './pages/admin/TestimonialManagement';

// User Pages
import Dashboard from './pages/Dashboard';
import AddBook from './pages/AddBook';
import Quotes from './pages/Quotes';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Reminders from './pages/Reminders';
import BookView from './pages/BookView';
import BookDetails from './pages/BookDetails';
import Bookmarks from './pages/Bookmarks';
import Tracker from './pages/Tracker';
import UserReports from './pages/UserReports';
import CalendarPage from './pages/Calendar';
import Testimonial from './pages/Testimonial';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, loading, isAdmin } = useAuth();

  // If auth is still determining if we have a user at all
  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#fdfcfb]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (!user) return <Navigate to="/login" />;
  
  // If we have a user but profile is still loading (initial state after login)
  // and we need to check admin status, we check email as a high-confidence fallback
  if (adminOnly) {
    const isActuallyAdmin = isAdmin || user.email === 'admin@gmail.com';
    if (!isActuallyAdmin) {
      return <Navigate to="/app/user/dashboard" />;
    }
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Admin App Branch */}
          <Route path="/app/admin" element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="books" element={<BookManagement />} />
            <Route path="reports" element={<ReportManagement />} />
            <Route path="reviews" element={<ReviewManagement />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="testimoni" element={<TestimonialManagement />} />
          </Route>

          {/* User App Branch */}
          <Route path="/app/user" element={
            <ProtectedRoute>
              <UserLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} /> 
            <Route path="library" element={<Library />} />
            <Route path="testimonial" element={<Testimonial />} />
            <Route path="add-book" element={<AddBook />} />
            <Route path="details/:id" element={<BookDetails />} />
            <Route path="book/:id" element={<BookView />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="bookmarks" element={<Bookmarks />} />
            <Route path="reports" element={<UserReports />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          
          <Route path="/app/*" element={<Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  </AuthProvider>
  );
}
