/**
 * Calculates dynamic pricing details based on duration, weekend surges, and current fleet utilization.
 * 
 * @param {number} baseDailyRate Standard daily rate of the vehicle.
 * @param {string} startDateStr ISO date string (YYYY-MM-DD) for rental start.
 * @param {string} endDateStr ISO date string (YYYY-MM-DD) for rental end.
 * @param {number} activeBookingCount Number of vehicles currently rented ('Active' state).
 * @param {number} totalFleetCount Total number of active/available vehicles in fleet.
 * @param {Object} settings Pricing rule settings from database.
 * @returns {Object} Pricing breakdown containing sub-amounts and rates.
 */
export function calculateDynamicPrice(
  baseDailyRate,
  startDateStr,
  endDateStr,
  activeBookingCount,
  totalFleetCount,
  settings = {}
) {
  const enabled = settings.dynamicPricingEnabled !== false;

  // Compute duration in days
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  const diffTime = end - start;
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  if (!enabled) {
    return {
      basePrice: baseDailyRate * totalDays,
      weekendDays: 0,
      weekdays: totalDays,
      utilizationSurcharge: 0,
      utilizationRate: 0,
      utilizationSurchargeMultiplier: 0,
      rateDetails: Array.from({ length: totalDays }).map((_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return {
          date: d.toISOString().split('T')[0],
          rate: baseDailyRate,
          isWeekend: false
        };
      })
    };
  }

  let weekendDays = 0;
  let weekdays = 0;
  const rateDetails = [];
  const weekendMultiplier = settings.weekendMultiplier || 1.15;

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    let dayRate = baseDailyRate;
    if (isWeekend) {
      weekendDays++;
      dayRate = Math.round(baseDailyRate * weekendMultiplier);
    } else {
      weekdays++;
    }

    rateDetails.push({
      date: current.toISOString().split('T')[0],
      rate: dayRate,
      isWeekend
    });
  }

  // Calculate base sum after weekend surges
  const baseSum = rateDetails.reduce((sum, item) => sum + item.rate, 0);

  // Utilization Surcharge
  let utilizationRate = 0;
  let utilizationSurchargeMultiplier = 0;
  if (totalFleetCount > 0) {
    utilizationRate = activeBookingCount / totalFleetCount;
  }

  const threshold2 = settings.utilizationThreshold2 || 0.75;
  const surcharge2 = settings.utilizationSurcharge2 || 0.25;
  const threshold1 = settings.utilizationThreshold1 || 0.50;
  const surcharge1 = settings.utilizationSurcharge1 || 0.10;

  if (utilizationRate >= threshold2) {
    utilizationSurchargeMultiplier = surcharge2;
  } else if (utilizationRate >= threshold1) {
    utilizationSurchargeMultiplier = surcharge1;
  }

  const utilizationSurcharge = Math.round(baseSum * utilizationSurchargeMultiplier);
  const finalBasePrice = baseSum + utilizationSurcharge;

  return {
    basePrice: finalBasePrice,
    weekendDays,
    weekdays,
    utilizationSurcharge,
    utilizationRate,
    utilizationSurchargeMultiplier,
    rateDetails
  };
}
