const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const slugify = require('slugify');
const emailService = require('../services/emailService');
const { invalidateHomepageBundleCache } = require('./cmsController');

// ==================== RENDER IMAGE (DECODE BASE64 & SERVE HIGH COMPATIBILITY BINARY) ====================
exports.renderImage = asyncHandler(async (req, res) => {
  const { url, imgId, productId } = req.query;

  let targetUrl = url;
  if (!targetUrl && imgId) {
    const imgRecord = await prisma.productImage.findUnique({ where: { id: imgId } });
    if (imgRecord) targetUrl = imgRecord.url;
  }
  if (!targetUrl && productId) {
    const imgRecord = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { isPrimary: 'desc' }
    });
    if (imgRecord) targetUrl = imgRecord.url;
  }

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.redirect('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80');
  }

  const clean = targetUrl.trim();

  // If Base64 Data URI, decode into binary image buffer so Gmail & Outlook render actual image!
  if (clean.startsWith('data:image/')) {
    const matches = clean.match(/^data:(image\/[a-zA-Z0-9+\-+.]+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(imgBuffer);
    }
  }

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return res.redirect(clean);
  }

  const serverBase = process.env.RENDER_EXTERNAL_URL || 'https://style-backup.onrender.com';
  const cleanPath = clean.startsWith('/') ? clean : `/${clean}`;
  return res.redirect(`${serverBase}${cleanPath}`);
});

// ==================== GET ALL PRODUCTS ====================
const isUUID = (str) =>
  typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

// ==================== GET ALL PRODUCTS ====================
exports.getAllProducts = asyncHandler(async (req, res, next) => {
  const {
    search,
    category,
    categoryId,
    subCategory,
    subCategoryId,
    featured,
    trending,
    newArrival,
    bestSeller,
    isRecommended,
    isPremium,
    isFestival,
    showOnHomepage,
    status,
    includeAll,
    sort,
    page = 1,
    limit = 12
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Where Clause Filtering
  let whereClause = {};
  const andConditions = [];

  // Admin view (includeAll=true) vs Customer & Guest view
  if (includeAll === 'true') {
    if (status && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }
  } else {
    // Guest & Customer public storefront view: Show active/published non-draft products
    andConditions.push({
      status: { notIn: ['DELETED', 'ARCHIVED', 'DRAFT', 'deleted', 'archived', 'draft'] }
    });
  }

  // Text Search
  if (search && search.trim()) {
    const q = search.trim();
    andConditions.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { shortDesc: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
      ]
    });
  }

  // Category Filtering (Supports UUID, categoryId param, slug, and category name)
  const targetCategory = category || categoryId;
  if (targetCategory && targetCategory !== 'ALL' && targetCategory !== 'all' && targetCategory !== 'undefined' && targetCategory !== 'null') {
    const catVal = String(targetCategory).trim();
    const keywords = catVal.toLowerCase().replace(/-/g, ' ').split(' ').filter(k => k.length > 2);
    andConditions.push({
      OR: [
        { categoryId: catVal },
        {
          category: {
            OR: [
              { id: catVal },
              { slug: { equals: catVal, mode: 'insensitive' } },
              { slug: { contains: catVal, mode: 'insensitive' } },
              { name: { contains: catVal, mode: 'insensitive' } },
              ...keywords.map(kw => ({ name: { contains: kw, mode: 'insensitive' } })),
              ...keywords.map(kw => ({ slug: { contains: kw, mode: 'insensitive' } }))
            ]
          }
        }
      ]
    });
  }

  // SubCategory Filtering (Supports UUID, subCategoryId param, slug, and subcategory name)
  const targetSubCategory = subCategory || subCategoryId;
  if (targetSubCategory && targetSubCategory !== 'ALL' && targetSubCategory !== 'all' && targetSubCategory !== 'undefined' && targetSubCategory !== 'null') {
    const subVal = String(targetSubCategory).trim();
    if (isUUID(subVal)) {
      andConditions.push({ subCategoryId: subVal });
    } else {
      const subKeywords = subVal.toLowerCase().replace(/-/g, ' ').split(' ').filter(k => k.length > 2);
      andConditions.push({
        OR: [
          { subCategoryId: subVal },
          {
            subCategory: {
              OR: [
                { id: subVal },
                { slug: { equals: subVal, mode: 'insensitive' } },
                { slug: { contains: subVal, mode: 'insensitive' } },
                { name: { contains: subVal, mode: 'insensitive' } },
                ...subKeywords.map(kw => ({ name: { contains: kw, mode: 'insensitive' } })),
                ...subKeywords.map(kw => ({ slug: { contains: kw, mode: 'insensitive' } }))
              ]
            }
          }
        ]
      });
    }
  }

  // Section Badges / Toggles
  if (featured === 'true') whereClause.featured = true;
  if (trending === 'true') whereClause.trending = true;
  if (newArrival === 'true') whereClause.newArrival = true;
  if (bestSeller === 'true') whereClause.bestSeller = true;
  if (isRecommended === 'true') whereClause.isRecommended = true;
  if (isPremium === 'true') whereClause.isPremium = true;
  if (isFestival === 'true') whereClause.isFestival = true;
  if (showOnHomepage === 'true') whereClause.showOnHomepage = true;

  // Combine AND conditions
  if (andConditions.length > 0) {
    whereClause.AND = andConditions;
  }

  // Sorting
  let orderByClause = [{ displayOrder: 'asc' }, { createdAt: 'desc' }];
  if (sort === 'price_asc') orderByClause = { price: 'asc' };
  else if (sort === 'price_desc') orderByClause = { price: 'desc' };
  else if (sort === 'newest') orderByClause = { createdAt: 'desc' };
  else if (sort === 'oldest') orderByClause = { createdAt: 'asc' };
  else if (sort === 'name_asc') orderByClause = { name: 'asc' };
  else if (sort === 'name_desc') orderByClause = { name: 'desc' };
  else if (sort === 'stock_asc') orderByClause = { stock: 'asc' };
  else if (sort === 'stock_desc') orderByClause = { stock: 'desc' };

  let [products, total] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: parseInt(skip),
      take: parseInt(limit),
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        discountPercent: true,
        discountPrice: true,
        stock: true,
        featured: true,
        trending: true,
        newArrival: true,
        bestSeller: true,
        flashSale: true,
        todaysDeal: true,
        showOnHomepage: true,
        isRecommended: true,
        isPremium: true,
        isVisible: true,
        shortDesc: true,
        status: true,
        sizes: true,
        colors: true,
        createdAt: true,
        shippingFee: true,
        freeShipping: true,
        images: { select: { id: true, url: true, isPrimary: true } },
        category: { select: { id: true, name: true, slug: true } },
        subCategory: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true } }
      }
    }),
    prisma.product.count({ where: whereClause })
  ]);

  res.status(200).json({
    success: true,
    message: 'Products fetched successfully',
    data: {
      products,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    }
  });
});

// ==================== GET PRODUCT BY SLUG / ID / SKU ====================
exports.getProductBySlug = asyncHandler(async (req, res, next) => {
  const { slug } = req.params;
  const clean = String(slug).trim();

  let product = await prisma.product.findFirst({
    where: {
      OR: [
        { slug: { equals: clean, mode: 'insensitive' } },
        { slug: { contains: clean, mode: 'insensitive' } },
        { id: clean },
        { sku: { equals: clean, mode: 'insensitive' } },
        { name: { equals: clean, mode: 'insensitive' } },
        { name: { contains: clean, mode: 'insensitive' } },
      ]
    },
    include: {
      images: true,
      category: true,
      subCategory: true,
      brand: true,
      reviews: {
        include: { user: { select: { id: true, fullName: true, avatar: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Product fetched successfully',
    data: product
  });
});

// ==================== CREATE PRODUCT ====================
exports.createProduct = asyncHandler(async (req, res, next) => {
  const {
    name, description, shortDesc, price, discountPercent, discountPrice, stock, sku,
    categoryId, subCategoryId, brandId, tags,
    featured, trending, newArrival, bestSeller, isRecommended, isPremium, isFestival,
    showOnHomepage, status, displayOrder,
    sizes, colors, material, occasion, gender, images,
    colorGalleries, colorSizeInventory,
    shippingFee, freeShipping
  } = req.body;

  if (!name || price === undefined || price === null || !categoryId) {
    return next(new ApiError(400, 'Product name, price, and categoryId are required'));
  }

  // Verify Category Existence with Automatic Fallback
  let targetCategoryId = categoryId;
  const categoryExists = await prisma.category.findUnique({ where: { id: targetCategoryId } });
  if (!categoryExists) {
    const fallbackCategory = await prisma.category.findFirst({
      where: { OR: [{ slug: targetCategoryId }, { name: { contains: targetCategoryId, mode: 'insensitive' } }] }
    });
    if (fallbackCategory) {
      targetCategoryId = fallbackCategory.id;
    } else {
      const firstCat = await prisma.category.findFirst({});
      if (firstCat) {
        targetCategoryId = firstCat.id;
      } else {
        return next(new ApiError(400, 'Invalid category specified. Please select a valid category.'));
      }
    }
  }

  // Verify SubCategory Existence
  let targetSubCategoryId = subCategoryId || null;
  if (targetSubCategoryId) {
    const subExists = await prisma.subCategory.findUnique({ where: { id: targetSubCategoryId } });
    if (!subExists) targetSubCategoryId = null;
  }

  let slug = slugify(name, { lower: true, strict: true });
  if (!slug) slug = `product-${Date.now()}`;
  const existingSlug = await prisma.product.findFirst({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  let cleanSku = (sku && typeof sku === 'string' && sku.trim())
    ? sku.trim()
    : `SV-PROD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const existingSku = await prisma.product.findFirst({ where: { sku: cleanSku } });
  if (existingSku) {
    cleanSku = `${cleanSku}-${Date.now().toString(36)}`;
  }

  const calculatedDiscountPrice = discountPrice
    ? parseFloat(discountPrice)
    : (discountPercent ? parseFloat(price) * (1 - parseFloat(discountPercent) / 100) : parseFloat(price));

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      sku: cleanSku,
      price: parseFloat(price),
      discountPercent: discountPercent ? parseFloat(discountPercent) : 0,
      discountPrice: calculatedDiscountPrice,
      stock: parseInt(stock || 0),
      categoryId: targetCategoryId,
      subCategoryId: targetSubCategoryId,
      brandId: brandId || null,
      shortDesc: shortDesc || '',
      description: description || '',
      sizes: typeof sizes === 'string' ? sizes : JSON.stringify(sizes || []),
      colors: typeof colors === 'string' ? colors : JSON.stringify(colors || []),
      colorGalleries: typeof colorGalleries === 'string' ? colorGalleries : JSON.stringify(colorGalleries || []),
      colorSizeInventory: typeof colorSizeInventory === 'string' ? colorSizeInventory : JSON.stringify(colorSizeInventory || []),
      material: material || null,
      occasion: occasion || null,
      gender: gender || null,
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      featured: featured === 'true' || featured === true,
      trending: trending === 'true' || trending === true,
      newArrival: newArrival === undefined ? true : (newArrival === 'true' || newArrival === true),
      bestSeller: bestSeller === 'true' || bestSeller === true,
      isRecommended: isRecommended === 'true' || isRecommended === true,
      isPremium: isPremium === 'true' || isPremium === true,
      isFestival: isFestival === 'true' || isFestival === true,
      showOnHomepage: showOnHomepage === undefined ? true : (showOnHomepage === 'true' || showOnHomepage === true),
      status: (status || 'PUBLISHED').toUpperCase(),
      displayOrder: displayOrder ? parseInt(displayOrder) : 0,
      isVisible: true,
      shippingFee: shippingFee ? parseFloat(shippingFee) : 0,
      freeShipping: freeShipping === 'true' || freeShipping === true,
    }
  });

  // Attach images
  if (images && Array.isArray(images) && images.length > 0) {
    const imageRecords = images.map((item, index) => ({
      productId: product.id,
      url: typeof item === 'string' ? item : (item.url || ''),
      isPrimary: typeof item === 'object' && item.isPrimary !== undefined ? Boolean(item.isPrimary) : index === 0,
      color: typeof item === 'object' ? item.color || null : null,
      sortOrder: typeof item === 'object' && item.sortOrder !== undefined ? parseInt(item.sortOrder) : index,
    })).filter(i => i.url);

    if (imageRecords.length > 0) {
      await prisma.productImage.createMany({ data: imageRecords });
    }
  }

  const fullProduct = await prisma.product.findUnique({
    where: { id: product.id },
    include: { images: true, category: true, subCategory: true }
  });

  // Send new product notification to all customers (in-app + email)
  if (fullProduct && (fullProduct.status === 'PUBLISHED' || fullProduct.isVisible)) {
    console.log(`[PRODUCT CONTROLLER] Product "${fullProduct.name}" published — sending notifications + emails to all customers.`);
    setImmediate(async () => {
      try {
        await emailService.sendNewProductNotificationToCustomers(fullProduct);
        console.log(`[PRODUCT CONTROLLER] New product email broadcast completed for "${fullProduct.name}"`);
      } catch (mailErr) {
        console.error('[NEW PRODUCT NOTIFICATION ERROR]', mailErr.message);
      }
    });
  }

  try { invalidateHomepageBundleCache(); } catch (e) {}

  res.status(201).json({
    success: true,
    message: 'Product created and published successfully',
    data: fullProduct
  });
});

const sanitizeUpdateData = (data, extraKeysToRemove = []) => {
  const clean = { ...data };
  const keysToRemove = [
    'id', 'createdAt', 'updatedAt', '_count', 'category', 'subCategory',
    'brand', 'images', 'reviews', 'items', 'user', 'products', 'subcategories',
    ...extraKeysToRemove
  ];
  keysToRemove.forEach(k => delete clean[k]);
  return clean;
};

// ==================== UPDATE PRODUCT ====================
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { images, ...rawUpdate } = req.body;
  const updateData = sanitizeUpdateData(rawUpdate);

  if (updateData.name) {
    updateData.slug = slugify(updateData.name, { lower: true, strict: true });
  }

  if (updateData.price !== undefined && updateData.price !== null) updateData.price = parseFloat(updateData.price);
  if (updateData.discountPercent !== undefined && updateData.discountPercent !== null) updateData.discountPercent = parseFloat(updateData.discountPercent);
  if (updateData.discountPrice !== undefined && updateData.discountPrice !== null) updateData.discountPrice = parseFloat(updateData.discountPrice);
  if (updateData.stock !== undefined && updateData.stock !== null) updateData.stock = parseInt(updateData.stock);
  if (updateData.displayOrder !== undefined && updateData.displayOrder !== null) updateData.displayOrder = parseInt(updateData.displayOrder);

  // Boolean Toggles
  if (updateData.featured !== undefined) updateData.featured = updateData.featured === 'true' || updateData.featured === true;
  if (updateData.trending !== undefined) updateData.trending = updateData.trending === 'true' || updateData.trending === true;
  if (updateData.newArrival !== undefined) updateData.newArrival = updateData.newArrival === 'true' || updateData.newArrival === true;
  if (updateData.bestSeller !== undefined) updateData.bestSeller = updateData.bestSeller === 'true' || updateData.bestSeller === true;
  if (updateData.flashSale !== undefined) updateData.flashSale = updateData.flashSale === 'true' || updateData.flashSale === true;
  if (updateData.todaysDeal !== undefined) updateData.todaysDeal = updateData.todaysDeal === 'true' || updateData.todaysDeal === true;
  if (updateData.isRecommended !== undefined) updateData.isRecommended = updateData.isRecommended === 'true' || updateData.isRecommended === true;
  if (updateData.isPremium !== undefined) updateData.isPremium = updateData.isPremium === 'true' || updateData.isPremium === true;
  if (updateData.isFestival !== undefined) updateData.isFestival = updateData.isFestival === 'true' || updateData.isFestival === true;
  if (updateData.showOnHomepage !== undefined) updateData.showOnHomepage = updateData.showOnHomepage === 'true' || updateData.showOnHomepage === true;
  if (updateData.isVisible !== undefined) updateData.isVisible = updateData.isVisible === 'true' || updateData.isVisible === true;
  if (updateData.freeShipping !== undefined) updateData.freeShipping = updateData.freeShipping === 'true' || updateData.freeShipping === true;
  if (updateData.shippingFee !== undefined) updateData.shippingFee = parseFloat(updateData.shippingFee) || 0;

  if (updateData.status) {
    updateData.status = updateData.status.toUpperCase();
  } else if (updateData.isVisible === true) {
    updateData.status = 'PUBLISHED';
  }

  if (updateData.sizes && typeof updateData.sizes !== 'string') updateData.sizes = JSON.stringify(updateData.sizes);
  if (updateData.colors && typeof updateData.colors !== 'string') updateData.colors = JSON.stringify(updateData.colors);
  if (updateData.colorGalleries && typeof updateData.colorGalleries !== 'string') updateData.colorGalleries = JSON.stringify(updateData.colorGalleries);
  if (updateData.colorSizeInventory && typeof updateData.colorSizeInventory !== 'string') updateData.colorSizeInventory = JSON.stringify(updateData.colorSizeInventory);
  // Check if product was out of stock prior to update
  const existingProduct = await prisma.product.findUnique({ where: { id }, select: { stock: true } });
  const wasOutOfStock = existingProduct && (existingProduct.stock <= 0 || !existingProduct.stock);

  const product = await prisma.product.update({
    where: { id },
    data: updateData
  });

  // If new images provided, sync images
  if (images && Array.isArray(images)) {
    await prisma.productImage.deleteMany({ where: { productId: id } });
    const imageRecords = images.map((item, index) => ({
      productId: id,
      url: typeof item === 'string' ? item : (item.url || ''),
      isPrimary: typeof item === 'object' && item.isPrimary !== undefined ? Boolean(item.isPrimary) : index === 0,
      color: typeof item === 'object' ? item.color || null : null,
      sortOrder: typeof item === 'object' && item.sortOrder !== undefined ? parseInt(item.sortOrder) : index,
    })).filter(i => i.url);

    if (imageRecords.length > 0) {
      await prisma.productImage.createMany({ data: imageRecords });
    }
  }

  const updatedFullProduct = await prisma.product.findUnique({
    where: { id },
    include: { images: true, category: true, subCategory: true }
  });

  // Notify back-in-stock subscribers if stock was 0 and is now restocked (>0)
  if (wasOutOfStock && updatedFullProduct && updatedFullProduct.stock > 0) {
    const subscribers = await prisma.backInStockSubscription.findMany({
      where: { productId: id, isNotified: false }
    });
    if (subscribers.length > 0) {
      setImmediate(async () => {
        for (const sub of subscribers) {
          try {
            await emailService.sendBackInStockEmail(sub.email, updatedFullProduct);
            await prisma.backInStockSubscription.update({
              where: { id: sub.id },
              data: { isNotified: true }
            });
          } catch (err) {
            console.error(`[PRODUCT UPDATE RESTOCK] Failed to notify ${sub.email}:`, err.message);
          }
        }
        console.log(`[PRODUCT UPDATE RESTOCK] Notified ${subscribers.length} subscribers for "${updatedFullProduct.name}"`);
      });
    }
  }

  // Broadcast notification to all customers if status changed to PUBLISHED
  if (updatedFullProduct && (updatedFullProduct.status === 'PUBLISHED' || updatedFullProduct.isVisible)) {
    setImmediate(() => {
      emailService.sendNewProductNotificationToCustomers(updatedFullProduct);
    });
  }

  try { invalidateHomepageBundleCache(); } catch (e) {}

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: updatedFullProduct
  });
});

// ==================== DELETE / SOFT DELETE PRODUCT ====================
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { hardDelete } = req.query;

  // Verify product exists
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  if (hardDelete === 'true') {
    // Permanent deletion — must clean up ALL related records to avoid FK constraint errors
    try {
      await prisma.$transaction(async (tx) => {
        // Delete all related records that reference this product
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.cartItem.deleteMany({ where: { productId: id } });
        await tx.wishlistItem.deleteMany({ where: { productId: id } });
        await tx.review.deleteMany({ where: { productId: id } });
        await tx.backInStockSubscription.deleteMany({ where: { productId: id } });
        await tx.recentlyViewed.deleteMany({ where: { productId: id } });

        // Delete order item references (set productId to null if possible, else skip)
        try {
          await tx.orderItem.deleteMany({ where: { productId: id } });
        } catch {
          // OrderItems may have constraints — soft-delete instead
          console.warn(`[DELETE PRODUCT] Could not remove order items for product ${id}, skipping`);
        }

        // Finally delete the product itself
        await tx.product.delete({ where: { id } });
      });
    } catch (err) {
      console.error('[DELETE PRODUCT ERROR]', err.message);
      return next(new ApiError(500, `Failed to delete product: ${err.message}`));
    }
  } else {
    // Soft Delete / Archive — wipe out active references so it never appears anywhere
    await prisma.$transaction([
      prisma.recentlyViewed.deleteMany({ where: { productId: id } }),
      prisma.wishlistItem.deleteMany({ where: { productId: id } }),
      prisma.cartItem.deleteMany({ where: { productId: id } }),
      prisma.product.update({
        where: { id },
        data: {
          status: 'DELETED',
          isVisible: false,
          showOnHomepage: false,
          featured: false,
          trending: false,
          newArrival: false,
          bestSeller: false,
          flashSale: false,
          todaysDeal: false,
        }
      })
    ]);
  }

  try { invalidateHomepageBundleCache(); } catch (e) {}

  res.status(200).json({
    success: true,
    message: hardDelete === 'true'
      ? `Product "${product.name}" permanently deleted`
      : `Product "${product.name}" archived successfully`,
    data: null
  });
});

// ==================== RESET ALL STOCKS TO 0 ====================
exports.resetAllStocks = asyncHandler(async (req, res) => {
  await prisma.product.updateMany({
    data: { stock: 0 }
  });
  res.status(200).json({
    success: true,
    message: 'All product stocks reset to 0 successfully!'
  });
});

// ==================== SUBSCRIBE: NOTIFY ME WHEN BACK IN STOCK ====================
exports.subscribeBackInStock = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const email = req.user?.email;

  if (!email) {
    return next(new ApiError(400, 'Please log in to subscribe for stock alerts'));
  }

  // Check product exists
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true, stock: true } });
  if (!product) return next(new ApiError(404, 'Product not found'));

  if (product.stock > 0) {
    return res.status(200).json({ success: true, message: 'This product is already in stock!' });
  }

  // Check if already subscribed
  const existing = await prisma.backInStockSubscription.findFirst({
    where: { productId: id, email, isNotified: false }
  });
  if (existing) {
    return res.status(200).json({ success: true, message: 'You are already subscribed for this product.' });
  }

  await prisma.backInStockSubscription.create({
    data: { productId: id, email }
  });

  res.status(201).json({
    success: true,
    message: `We'll notify you at ${email} when "${product.name}" is back in stock!`
  });
});

// ==================== ADMIN: RESTOCK PRODUCT + NOTIFY SUBSCRIBERS ====================
exports.restockProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { stock } = req.body;

  if (!stock || isNaN(stock) || parseInt(stock) <= 0) {
    return next(new ApiError(400, 'Please provide a valid stock quantity'));
  }

  const newStock = parseInt(stock);

  // Get current product
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: true }
  });
  if (!product) return next(new ApiError(404, 'Product not found'));

  const wasOutOfStock = product.stock <= 0;

  // Update stock
  const updatedProduct = await prisma.product.update({
    where: { id },
    data: { stock: newStock },
    include: { images: true }
  });

  // If product was out of stock and now restocked, notify subscribers
  let notifiedCount = 0;
  if (wasOutOfStock && newStock > 0) {
    const subscribers = await prisma.backInStockSubscription.findMany({
      where: { productId: id, isNotified: false }
    });

    if (subscribers.length > 0) {
      // Send emails asynchronously
      setImmediate(async () => {
        for (const sub of subscribers) {
          try {
            await emailService.sendBackInStockEmail(sub.email, updatedProduct);
            await prisma.backInStockSubscription.update({
              where: { id: sub.id },
              data: { isNotified: true }
            });
          } catch (err) {
            console.error(`[RESTOCK] Failed to notify ${sub.email}:`, err.message);
          }
        }
        console.log(`[RESTOCK] Notified ${subscribers.length} subscribers for "${updatedProduct.name}"`);
      });
      notifiedCount = subscribers.length;
    }
  }

  try { invalidateHomepageBundleCache(); } catch (e) {}

  res.status(200).json({
    success: true,
    message: `Stock updated to ${newStock} for "${updatedProduct.name}"${notifiedCount > 0 ? `. Sending back-in-stock email to ${notifiedCount} subscribers.` : '.'}`,
    data: updatedProduct
  });
});
