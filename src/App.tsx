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
import UserManagement from './pages/admin/UserManagement';
import ReportManagement from './pages/admin/ReportManagement';
import ChatMonitoring from './pages/admin/ChatMonitoring';
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
import CalendarPage from './pages/Calendar';
import InteractiveStories from './pages/InteractiveStories';
import Chat from './pages/Chat';
import AdminChat from './pages/admin/AdminChat';
import Friends from './pages/social/Friends';
import ProfileDetail from './pages/social/ProfileDetail';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#fdfcfb]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (!user) return <Navigate to="/login" />;
  
  if (adminOnly && !isAdmin) {
    return <Navigate to="/app/user/dashboard" />;
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
            <Route path="users" element={<UserManagement />} />
            <Route path="reports" element={<ReportManagement />} />
            <Route path="chats" element={<ChatMonitoring />} />
            <Route path="reviews" element={<ReviewManagement />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="testimoni" element={<TestimonialManagement />} />
            <Route path="chat" element={<AdminChat />} />
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
            <Route path="add-book" element={<AddBook />} />
            <Route path="details/:id" element={<BookDetails />} />
            <Route path="book/:id" element={<BookView />} />
            <Route path="tracker" element={<Tracker />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="bookmarks" element={<Bookmarks />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:id" element={<ProfileDetail />} />
            <Route path="friends" element={<Friends />} />
            <Route path="chat" element={<Chat />} />
          </Route>
          
          <Route path="/app/*" element={<Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  </AuthProvider>
  );
}
