import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type {
  AuthState,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
} from "../../types/auth";
import { authAPI } from "../../services/authApi";

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),
  isAuthenticated: !!localStorage.getItem("accessToken"),
  isLoading: false,
  error: null,
};

export const loginUser = createAsyncThunk<
  AuthResponse,
  LoginRequest,
  { rejectValue: string }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.login(credentials);
    return data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || "Login failed");
  }
});

export const registerUser = createAsyncThunk<
  AuthResponse,
  RegisterRequest,
  { rejectValue: string }
>("auth/register", async (userData, { rejectWithValue }) => {
  try {
    const { data } = await authAPI.register(userData);
    return data;
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || "Registration failed"
    );
  }
});

export const refreshToken = createAsyncThunk<
  string,
  void,
  { rejectValue: string }
>("auth/refreshToken", async (_, { getState, rejectWithValue }) => {
  try {
    const state = getState() as { auth: AuthState };
    const token = state.auth.refreshToken;
    if (!token) throw new Error("No refresh token found");

    const { data } = await authAPI.refreshToken(token);
    return data.accessToken;
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || "Token refresh failed"
    );
  }
});

export const getCurrentUser = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>("auth/getCurrentUser", async (_, { getState, rejectWithValue }) => {
  try {
    const state = getState() as { auth: AuthState };
    const { data } = await authAPI.getCurrentUser(state.auth.accessToken!);
    return data.user;
  } catch (error: any) {
    return rejectWithValue(
      error.response?.data?.message || "Failed to get user"
    );
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.clear();
    },
    clearError: (state) => {
      state.error = null;
    },
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
      console.log('Access Token: ', action.payload);
      localStorage.setItem("accessToken", action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(loginUser.fulfilled, (s, a) => {
        s.isLoading = false;
        s.isAuthenticated = true;
        s.user = a.payload.data.user;
        s.accessToken = a.payload.data.tokens.accessToken;
        s.refreshToken = a.payload.data.tokens.refreshToken;
        localStorage.setItem("accessToken", s.accessToken!);
        localStorage.setItem("refreshToken", s.refreshToken!);
      })
      .addCase(loginUser.rejected, (s, a) => {
        s.isLoading = false;
        s.error = a.payload || "Login failed";
      })

      // Register
      .addCase(registerUser.pending, (s) => {
        s.isLoading = true;
        s.error = null;
      })
      .addCase(registerUser.fulfilled, (s, a) => {
        s.isLoading = false;
        s.isAuthenticated = true;
        s.user = a.payload.data.user;
        s.accessToken = a.payload.data.tokens.accessToken;
        s.refreshToken = a.payload.data.tokens.refreshToken;
        console.log('addCase : AccessToken', s.accessToken!);
        localStorage.setItem("accessToken", s.accessToken!);
        localStorage.setItem("refreshToken", s.refreshToken!);
      })
      .addCase(registerUser.rejected, (s, a) => {
        s.isLoading = false;
        s.error = a.payload || "Registration failed";
      })

      // Refresh
      .addCase(refreshToken.fulfilled, (s, a) => {
        s.accessToken = a.payload;
        localStorage.setItem("accessToken", a.payload);
      })
      .addCase(refreshToken.rejected, (s) => {
        s.user = null;
        s.accessToken = null;
        s.refreshToken = null;
        s.isAuthenticated = false;
        localStorage.clear();
      })

      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload; 
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = action.payload || "Failed to get user";
      });
  },
});

export const { logout, clearError, setAccessToken } = authSlice.actions;
export default authSlice.reducer;
