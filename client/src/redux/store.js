import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import createWebStorage from 'redux-persist/lib/storage/createWebStorage';

import authReducer from './auth/authSlice';
import cartReducer from './cart/cartSlice';
import wishlistReducer from './wishlist/wishlistSlice';
import productReducer from './product/productSlice';
import categoryReducer from './category/categorySlice';
import orderReducer from './order/orderSlice';
import settingsReducer from './settings/settingsSlice';
import notificationReducer from './notification/notificationSlice';
import adminReducer from './admin/adminSlice';
import compareReducer from './compare/compareSlice';

const createNoopStorage = () => {
  return {
    getItem(_key) {
      return Promise.resolve(null);
    },
    setItem(_key, value) {
      return Promise.resolve(value);
    },
    removeItem(_key) {
      return Promise.resolve();
    },
  };
};

const safeStorage = typeof window !== 'undefined'
  ? createWebStorage('local')
  : createNoopStorage();

const rootReducer = combineReducers({
  auth: persistReducer({ key: 'auth', storage: safeStorage }, authReducer),
  cart: persistReducer({ key: 'cart', storage: safeStorage }, cartReducer),
  wishlist: persistReducer({ key: 'wishlist', storage: safeStorage }, wishlistReducer),
  compare: persistReducer({ key: 'compare', storage: safeStorage }, compareReducer),
  settings: persistReducer({ key: 'settings', storage: safeStorage }, settingsReducer),
  product: productReducer,
  category: categoryReducer,
  order: orderReducer,
  notification: notificationReducer,
  admin: adminReducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
