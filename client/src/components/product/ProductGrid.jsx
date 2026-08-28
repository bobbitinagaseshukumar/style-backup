import React from 'react';
import ProductCard from './ProductCard';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import { FiBox } from 'react-icons/fi';

const ProductGrid = ({ products, loading, skeletonCount = 8 }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton variant="card" className="h-[300px] sm:h-[400px]" />
            <Skeleton className="w-2/3 mt-2" />
            <Skeleton className="w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState 
        icon={FiBox}
        title="No products found"
        message="Try adjusting your filters or search query to find what you're looking for."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
      {products.map((product, idx) => (
        <ProductCard key={product.id || product._id || product.slug || idx} product={product} />
      ))}
    </div>
  );
};

export default ProductGrid;
