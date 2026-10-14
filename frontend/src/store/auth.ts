import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api, errorMessage, getTokens, send, setTokens } from '../lib/api';
import type { AuthPayload, User } from '../lib/types';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
}

const initialState: AuthState = { user: null, status: getTokens() ? 'idle' : 'ready', error: null };

export const login = createAsyncThunk<User, { email: string; password: string }, { rejectValue: string }>(
  'auth/login',
  async (body, { rejectWithValue }) => {
    try {
      const payload = await send<AuthPayload>('post', '/auth/login', body);
      setTokens(payload.tokens);
      return payload.user;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Login failed'));
    }
  },
);

export const register = createAsyncThunk<User, { username: string; email: string; password: string }, { rejectValue: string }>(
  'auth/register',
  async (body, { rejectWithValue }) => {
    try {
      const payload = await send<AuthPayload>('post', '/auth/register', body);
      setTokens(payload.tokens);
      return payload.user;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Registration failed'));
    }
  },
);

export const loadUser = createAsyncThunk<User | null>('auth/me', async () => {
  if (!getTokens()) return null;
  try {
    const { data } = await api.get<{ data: User }>('/auth/me');
    return data.data;
  } catch {
    return null;
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  const tokens = getTokens();
  setTokens(null);
  if (tokens) await api.post('/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => undefined);
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.status = 'ready';
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'ready';
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'ready';
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'ready';
        state.error = action.payload ?? 'Login failed';
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'ready';
        state.error = action.payload ?? 'Registration failed';
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = 'ready';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export const { setUser, clearError } = authSlice.actions;
export default authSlice.reducer;
