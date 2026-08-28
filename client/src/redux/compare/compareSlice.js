import { createSlice } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';

const initialState = {
  items: [], // Array of product objects or IDs (max 4)
};

const compareSlice = createSlice({
  name: 'compare',
  initialState,
  reducers: {
    addToCompare: (state, action) => {
      const product = action.payload;
      if (!product || !product.id) return;

      const exists = state.items.some((item) => item.id === product.id);
      if (exists) {
        toast.info(`'${product.name}' is already in comparison!`);
        return;
      }

      if (state.items.length >= 4) {
        toast.warning('You can compare up to 4 products at a time.');
        return;
      }

      state.items.push(product);
      toast.success(`Added '${product.name}' to compare list (${state.items.length}/4).`);
    },

    removeFromCompare: (state, action) => {
      const productId = action.payload;
      state.items = state.items.filter((item) => item.id !== productId);
      toast.info('Item removed from compare.');
    },

    toggleCompare: (state, action) => {
      const product = action.payload;
      if (!product || !product.id) return;

      const exists = state.items.some((item) => item.id === product.id);
      if (exists) {
        state.items = state.items.filter((item) => item.id !== product.id);
        toast.info(`Removed '${product.name}' from compare.`);
      } else {
        if (state.items.length >= 4) {
          toast.warning('You can compare up to 4 products at a time.');
          return;
        }
        state.items.push(product);
        toast.success(`Added '${product.name}' to compare list (${state.items.length}/4).`);
      }
    },

    clearCompare: (state) => {
      state.items = [];
    },
  },
});

export const { addToCompare, removeFromCompare, toggleCompare, clearCompare } = compareSlice.actions;
export default compareSlice.reducer;
