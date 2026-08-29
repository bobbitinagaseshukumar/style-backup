const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding StyleVerse database for all 22 dynamic home page sections...\n');

  // 1. Store Settings
  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      storeName: 'StyleVerse',
      contactEmail: 'support@styleverse.com',
      contactPhone: '+91 98765 43210',
      address: '123 Fashion Street, Cyber City, Hyderabad, India',
      currencySymbol: '₹',
      primaryColor: '#D4AF37',
      secondaryColor: '#1A1A1A',
    },
  });
  console.log('✅ Store Settings seeded');

  // 2. Announcements
  await prisma.announcement.deleteMany({});
  await prisma.announcement.createMany({
    data: [
      {
        title: 'FESTIVE SALE',
        message: '✨ Grand Festive Sale: Extra 15% OFF on orders above ₹2,999! Code: FESTIVE15',
        link: '/categories/festive',
        buttonText: 'Shop Festive',
        textColor: '#FFFFFF',
        backgroundColor: '#D4AF37',
        isActive: true,
        priority: 1,
      },
      {
        title: 'FREE SHIPPING',
        message: '🚚 Express Delivery & Free Shipping on all pre-paid orders across India!',
        link: '/shipping-policy',
        buttonText: 'Know More',
        textColor: '#FFFFFF',
        backgroundColor: '#1A1A1A',
        isActive: true,
        priority: 2,
      },
    ],
  });
  console.log('✅ 2 Announcements seeded');

  // 3. Super Admin
  const hashedPassword = await bcrypt.hash('styleverse@2409', 12);
  await prisma.user.upsert({
    where: { email: 'styleverseshope@gmail.com' },
    update: { role: 'SUPER_ADMIN', isVerified: true },
    create: {
      fullName: 'Styleverse Admin',
      email: 'styleverseshope@gmail.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isVerified: true,
      status: 'ACTIVE',
    },
  });
  console.log('✅ Super Admin seeded (styleverseshope@gmail.com)');

  // 4. Categories
  const categories = [
    { name: "Women's Sarees", slug: 'womens-sarees', description: 'Exquisite collection of handcrafted sarees', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400' },
    { name: 'Jewellery', slug: 'jewellery', description: 'Stunning artificial and gold plated jewellery', image: 'https://images.unsplash.com/photo-1515562141589-67f0d93e5bb6?w=400' },
    { name: "Women's Kurtis", slug: 'womens-kurtis', description: 'Trendy kurtis for every occasion', image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400' },
    { name: 'Kids Wear', slug: 'kids-wear', description: 'Adorable clothing for little ones', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400' },
    { name: "Men's Wear", slug: 'mens-wear', description: 'Smart casual and formal wear for men', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400' },
    { name: 'Lehengas', slug: 'lehengas', description: 'Bridal and party wear lehengas', image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400' },
    { name: 'Night Wear', slug: 'night-wear', description: 'Comfortable night wear collections', image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400' },
    { name: 'Festival Collection', slug: 'festival-collection', description: 'Special festive occasion wear', image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400' },
  ];

  const createdCategories = {};
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    createdCategories[cat.slug] = created.id;
  }
  console.log('✅ 8 Categories seeded');

  // 5. Products
  const products = [
    {
      name: 'Royal Blue Banarasi Silk Saree',
      slug: 'royal-blue-banarasi-silk-saree',
      sku: 'SV-SAR-001',
      price: 4599,
      discountPercent: 20,
      discountPrice: 3679,
      stock: 25,
      categoryId: createdCategories['womens-sarees'],
      sizes: JSON.stringify(['Free Size']),
      colors: JSON.stringify(['Royal Blue', 'Red', 'Green']),
      material: 'Pure Banarasi Silk',
      occasion: 'Wedding',
      gender: 'Women',
      shortDesc: 'Handwoven pure Banarasi silk saree with gold zari border',
      description: 'This exquisite Royal Blue Banarasi Silk Saree features intricate gold zari weaving, perfect for weddings and festive occasions. Comes with an unstitched blouse piece.',
      tags: JSON.stringify(['saree', 'silk', 'banarasi', 'wedding', 'festive']),
      featured: true,
      trending: true,
      todaysDeal: true,
      newArrival: true,
    },
    {
      name: 'Kundan Bridal Necklace Set',
      slug: 'kundan-bridal-necklace-set',
      sku: 'SV-JWL-001',
      price: 8499,
      discountPercent: 15,
      discountPrice: 7224,
      stock: 12,
      categoryId: createdCategories['jewellery'],
      sizes: JSON.stringify(['Free Size']),
      colors: JSON.stringify(['Gold', 'Gold with Red', 'Gold with Green']),
      material: 'Kundan & Gold Plated',
      occasion: 'Wedding',
      gender: 'Women',
      shortDesc: 'Stunning kundan bridal necklace with matching earrings',
      description: 'Complete your bridal look with this magnificent Kundan necklace set. Includes necklace, earrings, and maang tikka.',
      tags: JSON.stringify(['jewellery', 'necklace', 'bridal', 'kundan', 'wedding']),
      featured: true,
      flashSale: true,
      bestSeller: true,
    },
    {
      name: 'Embroidered Cotton Kurti',
      slug: 'embroidered-cotton-kurti',
      sku: 'SV-KRT-001',
      price: 1299,
      discountPercent: 30,
      discountPrice: 909,
      stock: 50,
      categoryId: createdCategories['womens-kurtis'],
      sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colors: JSON.stringify(['Teal', 'Mustard', 'Maroon']),
      material: 'Premium Cotton',
      occasion: 'Casual',
      gender: 'Women',
      shortDesc: 'Elegant embroidered cotton kurti for daily wear',
      description: 'Lightweight and breathable cotton kurti with beautiful thread embroidery.',
      tags: JSON.stringify(['kurti', 'cotton', 'casual', 'office', 'embroidered']),
      featured: true,
      trending: true,
      newArrival: true,
    },
    {
      name: 'Gold Plated Temple Earrings',
      slug: 'gold-plated-temple-earrings',
      sku: 'SV-JWL-002',
      price: 899,
      discountPercent: 10,
      discountPrice: 809,
      stock: 80,
      categoryId: createdCategories['jewellery'],
      sizes: JSON.stringify(['Free Size']),
      colors: JSON.stringify(['Gold', 'Antique Gold']),
      material: 'Gold Plated Brass',
      occasion: 'Festive',
      gender: 'Women',
      shortDesc: 'Traditional south Indian temple earrings',
      description: 'Beautifully crafted gold plated temple earrings inspired by south Indian heritage.',
      tags: JSON.stringify(['earrings', 'temple', 'gold plated', 'south indian']),
      trending: true,
      bestSeller: true,
      todaysDeal: true,
    },
    {
      name: 'Designer Bridal Lehenga',
      slug: 'designer-bridal-lehenga',
      sku: 'SV-LHG-001',
      price: 12999,
      discountPercent: 25,
      discountPrice: 9749,
      stock: 8,
      categoryId: createdCategories['lehengas'],
      sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
      colors: JSON.stringify(['Red', 'Maroon', 'Pink']),
      material: 'Georgette with Net',
      occasion: 'Wedding',
      gender: 'Women',
      shortDesc: 'Heavily embroidered bridal lehenga with dupatta',
      description: 'A stunning designer bridal lehenga choli featuring heavy zari embroidery.',
      tags: JSON.stringify(['lehenga', 'bridal', 'wedding', 'designer', 'embroidered']),
      featured: true,
      flashSale: true,
      newArrival: true,
    },
    {
      name: 'Boys Casual Denim Jacket',
      slug: 'boys-casual-denim-jacket',
      sku: 'SV-KDS-001',
      price: 1499,
      discountPercent: 40,
      discountPrice: 899,
      stock: 35,
      categoryId: createdCategories['kids-wear'],
      sizes: JSON.stringify(['2-3Y', '4-5Y', '6-7Y', '8-9Y']),
      colors: JSON.stringify(['Blue', 'Light Blue']),
      material: 'Denim Cotton',
      occasion: 'Casual',
      gender: 'Boys',
      shortDesc: 'Trendy denim jacket for boys',
      description: 'Stylish denim jacket for boys featuring chest pockets and metal button closure.',
      tags: JSON.stringify(['kids', 'boys', 'denim', 'jacket', 'casual']),
      trending: true,
      newArrival: true,
    },
    {
      name: 'Mens Premium Cotton Shirt',
      slug: 'mens-premium-cotton-shirt',
      sku: 'SV-MEN-001',
      price: 1799,
      discountPercent: 35,
      discountPrice: 1169,
      stock: 40,
      categoryId: createdCategories['mens-wear'],
      sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
      colors: JSON.stringify(['White', 'Sky Blue', 'Navy']),
      material: 'Premium Cotton',
      occasion: 'Formal',
      gender: 'Men',
      shortDesc: 'Slim fit premium cotton formal shirt',
      description: 'Crafted from 100% premium cotton, slim-fit shirt featuring a spread collar.',
      tags: JSON.stringify(['shirt', 'men', 'formal', 'cotton', 'office']),
      featured: true,
      bestSeller: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
  console.log('✅ 7 Products seeded');

  // 6. Flash Sale
  await prisma.flashSale.deleteMany({});
  const flashSaleEndTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  await prisma.flashSale.create({
    data: {
      name: 'MIDNIGHT FLASH SALE ⚡',
      description: 'Huge discounts on selected Sarees & Jewellery! Limited stock remaining.',
      endDate: flashSaleEndTime,
      discountType: 'PERCENTAGE',
      discountValue: 40,
      status: 'PUBLISHED',
      isActive: true,
    },
  });
  console.log('✅ 1 Active Flash Sale seeded (ends in 24 hours)');

  // 7. Banners
  const banners = [
    {
      title: 'Wedding Season Collection',
      subtitle: 'Exclusive Sarees, Lehengas & Kundan Jewellery',
      imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&h=500&fit=crop',
      buttonLink: '/categories/womens-sarees',
      position: 'HOMEPAGE_HERO',
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Royal Jewellery Showcase',
      subtitle: 'Pure gold plated & kundan masterpieces',
      imageUrl: 'https://images.unsplash.com/photo-1515562141589-67f0d93e5bb6?w=1200&h=500&fit=crop',
      buttonLink: '/categories/jewellery',
      position: 'HOMEPAGE_HERO',
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Summer Kurti Specials',
      subtitle: 'Breathable handcrafted cotton kurtis starting ₹899',
      imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=1200&h=500&fit=crop',
      buttonLink: '/categories/womens-kurtis',
      position: 'HOMEPAGE_HERO',
      sortOrder: 3,
      isActive: true,
    },
  ];
  await prisma.banner.deleteMany({});
  for (const banner of banners) {
    await prisma.banner.create({ data: banner });
  }
  console.log('✅ 3 Hero Banners seeded');

  // 8. Brand Showcase
  await prisma.brandShowcase.deleteMany({});
  await prisma.brandShowcase.createMany({
    data: [
      { name: 'Kanjivaram Craft', logoUrl: '🥻', website: '#', sortOrder: 1 },
      { name: 'Kundan Jewels', logoUrl: '💎', website: '#', sortOrder: 2 },
      { name: 'Zari Silks', logoUrl: '✨', website: '#', sortOrder: 3 },
      { name: 'Jaipur Prints', logoUrl: '🌸', website: '#', sortOrder: 4 },
      { name: 'Royal Heritage', logoUrl: '👑', website: '#', sortOrder: 5 },
    ],
  });
  console.log('✅ 5 Brand Showcase items seeded');

  // 9. Testimonials
  await prisma.testimonial.deleteMany({});
  await prisma.testimonial.createMany({
    data: [
      {
        name: 'Sunita Agarwal',
        location: 'Mumbai, Maharashtra',
        rating: 5,
        comment: 'The Royal Blue Banarasi Saree was breathtaking! Soft silk, genuine gold zari work, and fast delivery. Absolutely loved it.',
        isApproved: true,
        sortOrder: 1,
      },
      {
        name: 'Pooja Hegde',
        location: 'Bengaluru, Karnataka',
        rating: 5,
        comment: 'Ordered the Kundan Bridal Set for my sister’s wedding. Looked completely authentic and shiny. 10/10 quality and service!',
        isApproved: true,
        sortOrder: 2,
      },
      {
        name: 'Ananya Sharma',
        location: 'New Delhi',
        rating: 5,
        comment: 'Fast 2-day delivery to Delhi and beautiful packaging. The cotton kurti fabric is so comfortable for daily wear.',
        isApproved: true,
        sortOrder: 3,
      },
    ],
  });
  console.log('✅ 3 Testimonials seeded');

  // 10. Instagram Gallery
  await prisma.instagramPost.deleteMany({});
  await prisma.instagramPost.createMany({
    data: [
      { imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400', caption: 'Gorgeous Silk Saree Vibes ✨ #StyleVerseSarees', sortOrder: 1 },
      { imageUrl: 'https://images.unsplash.com/photo-1515562141589-67f0d93e5bb6?w=400', caption: 'Kundan Elegance for Brides 💎 #StyleVerseJewellery', sortOrder: 2 },
      { imageUrl: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400', caption: 'Summer Cotton Outfits 🌸 #StyleVerseFashion', sortOrder: 3 },
      { imageUrl: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400', caption: 'Bridal Lehenga Details 👑 #BridalCollection', sortOrder: 4 },
    ],
  });
  console.log('✅ 4 Instagram Posts seeded');

  console.log('\n🎉 Complete Seeding Finished! Database is 100% prepared for all 22 dynamic Home Page sections.');
}

main()
  .catch((e) => { console.error('❌ Seeding error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
