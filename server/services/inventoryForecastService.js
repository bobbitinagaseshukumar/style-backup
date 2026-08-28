const prisma = require('../config/db');
const geminiService = require('./geminiService');

class InventoryForecastService {
  /**
   * Phase 11 — AI Smart Inventory & Demand Forecasting Service
   * Calculates real sales velocity, stockout risks, demand trends, and restock priorities
   * using authoritative PostgreSQL order & product records for Admin Decision Support.
   */
  async getInventoryIntelligence({ days = 30, categoryId = null, search = '' }) {
    const periodDays = Math.max(7, parseInt(days || 30, 10));
    const now = new Date();

    // Start dates for current period and comparison previous period
    const currentPeriodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000);

    // Step 1 & 2: Fetch products from DB
    const productWhere = { status: 'PUBLISHED', isVisible: true };
    if (categoryId) productWhere.categoryId = categoryId;
    if (search) {
      productWhere.OR = [
        { name: { contains: search } },
        { sku: { contains: search } }
      ];
    }

    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        images: { orderBy: { isPrimary: 'desc' }, take: 1 }
      }
    });

    // Step 2 & 3: Fetch order items for current and previous periods
    // Count valid orders (DELIVERED, SHIPPED, CONFIRMED, PACKED, PENDING_APPROVAL)
    const validStatuses = ['DELIVERED', 'SHIPPED', 'CONFIRMED', 'PACKED', 'PENDING_APPROVAL'];

    const currentOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: currentPeriodStart },
          orderStatus: { in: validStatuses }
        }
      },
      select: { productId: true, quantity: true, price: true }
    });

    const previousOrderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: previousPeriodStart, lt: currentPeriodStart },
          orderStatus: { in: validStatuses }
        }
      },
      select: { productId: true, quantity: true }
    });

    // Build sales aggregation maps per product ID
    const currentSalesMap = new Map(); // productId -> { units: number, revenue: number }
    for (const item of currentOrderItems) {
      if (!item.productId) continue;
      const curr = currentSalesMap.get(item.productId) || { units: 0, revenue: 0 };
      curr.units += item.quantity;
      curr.revenue += item.price * item.quantity;
      currentSalesMap.set(item.productId, curr);
    }

    const previousSalesMap = new Map(); // productId -> units
    for (const item of previousOrderItems) {
      if (!item.productId) continue;
      const prevUnits = previousSalesMap.get(item.productId) || 0;
      previousSalesMap.set(item.productId, prevUnits + item.quantity);
    }

    // Determine data confidence level based on total historical orders count
    const totalOrderCount = await prisma.order.count({
      where: { orderStatus: { in: validStatuses } }
    });
    let confidenceLevel = 'MEDIUM';
    if (periodDays < 14 || totalOrderCount < 5) confidenceLevel = 'INSUFFICIENT_DATA';
    else if (periodDays <= 30) confidenceLevel = 'LOW_CONFIDENCE';
    else if (periodDays <= 90) confidenceLevel = 'MEDIUM_CONFIDENCE';
    else confidenceLevel = 'HIGH_CONFIDENCE';

    // Process each product
    const processedProducts = products.map(p => {
      const currentSales = currentSalesMap.get(p.id) || { units: 0, revenue: 0 };
      const prevUnits = previousSalesMap.get(p.id) || 0;

      const unitsSold = currentSales.units;
      const revenue = Math.round(currentSales.revenue);
      const dailyVelocity = Math.round((unitsSold / periodDays) * 100) / 100;

      // Step 7 & 8: Stockout Risk Calculation
      let estimatedDaysLeft = null;
      let riskLevel = 'LOW';

      if (p.stock <= 0) {
        estimatedDaysLeft = 0;
        riskLevel = 'CRITICAL_OUT_OF_STOCK';
      } else if (dailyVelocity > 0) {
        estimatedDaysLeft = Math.round((p.stock / dailyVelocity) * 10) / 10;
        if (estimatedDaysLeft < 3) riskLevel = 'CRITICAL';
        else if (estimatedDaysLeft < 7) riskLevel = 'HIGH';
        else if (estimatedDaysLeft < 14) riskLevel = 'MEDIUM';
        else riskLevel = 'LOW';
      } else {
        estimatedDaysLeft = 999; // No recent velocity
        riskLevel = 'LOW';
      }

      // Step 9: Demand Trend Calculation
      let demandTrend = 'STABLE';
      if (prevUnits === 0 && unitsSold > 0) {
        demandTrend = 'RISING';
      } else if (prevUnits > 0) {
        const pctChange = ((unitsSold - prevUnits) / prevUnits) * 100;
        if (pctChange >= 15) demandTrend = 'RISING';
        else if (pctChange <= -15) demandTrend = 'DECLINING';
        else demandTrend = 'STABLE';
      }

      // Step 18: Suggested Restock Quantity (Target 30-day coverage)
      const targetCoverageDays = 30;
      const requiredStock = Math.ceil(dailyVelocity * targetCoverageDays);
      const suggestedRestock = Math.max(0, requiredStock - p.stock);

      // Product Age (Days listed)
      const daysListed = Math.max(1, Math.round((now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24)));

      // Fast vs Slow Moving classification
      let movementType = 'STABLE';
      if (p.stock > 20 && unitsSold === 0 && daysListed > 30) {
        movementType = 'SLOW_MOVING';
      } else if (dailyVelocity >= 1.0) {
        movementType = 'FAST_MOVING';
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        image: p.images?.[0]?.url || null,
        category: p.category?.name || 'Fashion',
        subCategory: p.subCategory?.name || null,
        currentStock: p.stock,
        unitsSold,
        revenue,
        dailyVelocity,
        estimatedDaysLeft,
        riskLevel,
        demandTrend,
        suggestedRestock,
        movementType,
        daysListed
      };
    });

    // Categorize table lists
    const stockoutRiskList = processedProducts
      .filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL_OUT_OF_STOCK')
      .sort((a, b) => (a.estimatedDaysLeft ?? 0) - (b.estimatedDaysLeft ?? 0));

    const fastMovingList = processedProducts
      .filter(p => p.movementType === 'FAST_MOVING' || p.dailyVelocity > 0.5)
      .sort((a, b) => b.dailyVelocity - a.dailyVelocity);

    const slowMovingList = processedProducts
      .filter(p => p.movementType === 'SLOW_MOVING' || (p.currentStock > 15 && p.unitsSold === 0))
      .sort((a, b) => b.currentStock - a.currentStock);

    const risingDemandList = processedProducts
      .filter(p => p.demandTrend === 'RISING')
      .sort((a, b) => b.unitsSold - a.unitsSold);

    const decliningDemandList = processedProducts
      .filter(p => p.demandTrend === 'DECLINING')
      .sort((a, b) => b.currentStock - a.currentStock);

    // Summary metrics
    const totalUnitsSold = processedProducts.reduce((sum, p) => sum + p.unitsSold, 0);
    const totalRevenue = processedProducts.reduce((sum, p) => sum + p.revenue, 0);
    const criticalStockoutCount = stockoutRiskList.length;

    // Step 16: AI Grounded Summary via Gemini or Fallback
    let aiSummary = null;
    if (geminiService.isConfigured()) {
      try {
        const topRisksText = stockoutRiskList.slice(0, 3).map(r =>
          `- ${r.name}: Stock ${r.currentStock}, ${r.dailyVelocity}/day (${r.estimatedDaysLeft} days left)`
        ).join('\n');

        const prompt = `Store Sales & Inventory Analytics (Last ${periodDays} days):
Total Units Sold: ${totalUnitsSold}
Total Revenue: ₹${totalRevenue}
Products at High Stockout Risk: ${criticalStockoutCount}
Top Fast Moving Items: ${fastMovingList.slice(0, 2).map(f => f.name).join(', ') || 'None'}

High Risk Items:
${topRisksText || 'None currently'}

Write a professional 2-sentence executive summary for store administrators highlighting the top inventory priorities and stockout risks.
STRICT RULE: Use ONLY exact numbers and product names listed above. Do NOT invent predictions.`;

        const res = await geminiService.generateWithFallback([{ role: 'user', parts: [{ text: prompt }] }], {
          temperature: 0.2,
          maxOutputTokens: 250
        });
        if (res?.text) {
          aiSummary = res.text.trim();
        }
      } catch (err) {
        console.warn('[InventoryForecastService] Gemini summary fallback:', err.message);
      }
    }

    if (!aiSummary) {
      if (criticalStockoutCount > 0) {
        aiSummary = `⚠️ You have ${criticalStockoutCount} product${criticalStockoutCount > 1 ? 's' : ''} at high stockout risk for the selected ${periodDays}-day window. '${stockoutRiskList[0]?.name}' has only ~${stockoutRiskList[0]?.estimatedDaysLeft} days of estimated stock remaining based on recent sales velocity (${stockoutRiskList[0]?.dailyVelocity} units/day).`;
      } else {
        aiSummary = `Inventory is healthy across all categories for the selected ${periodDays}-day period. A total of ${totalUnitsSold} units were sold generating ₹${totalRevenue} in revenue.`;
      }
    }

    return {
      success: true,
      periodDays,
      confidenceLevel,
      summary: {
        totalProducts: processedProducts.length,
        totalUnitsSold,
        totalRevenue,
        criticalStockoutCount,
        fastMovingCount: fastMovingList.length,
        slowMovingCount: slowMovingList.length,
        aiSummary
      },
      tables: {
        stockoutRisk: stockoutRiskList,
        fastMoving: fastMovingList,
        slowMoving: slowMovingList,
        risingDemand: risingDemandList,
        decliningDemand: decliningDemandList,
        allProducts: processedProducts
      }
    };
  }
}

module.exports = new InventoryForecastService();
