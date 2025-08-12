import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from './store';
import type { AppDispatch, RootState } from './store';
import { getCurrentUser } from './store/slices/authSlice';
import Home from './routes/public/home';
import Layout from './routes/public/layout';
import Playlist from './routes/public/playlist';
import LoginPage from './routes/LoginPage';
import SignupPage from './routes/SignupPage';
import ProtectedRoute from './components/ProtectedRoute';
import './services/axiosInterceptor';
import SearchPage from './routes/public/SearchPage';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { accessToken, user  } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      console.log('dispatched getCurrentUser');
      dispatch(getCurrentUser());
    }
  }, [dispatch, accessToken, user]);

  return <>{children}</>;
}

const AppRoutes = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return (
    <BrowserRouter>
      <main id="main">
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />} 
          />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Home />} />
            <Route path="playlist/:id" element={<Playlist />} />
            <Route path='/search' element={<SearchPage/>}/>
          </Route>
        </Routes>
      </main>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <Provider store={store}>
      <AuthInitializer>
        <AppRoutes />
      </AuthInitializer>
    </Provider>
  );
};

export default App;
