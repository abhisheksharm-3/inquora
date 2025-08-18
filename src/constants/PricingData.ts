// src/constants/PricingData.ts

import { TypePricingData } from "@/types/TypeContent";

/**
 * A centralized data object for pricing, simplified for the Beta phase.
 *
 * Currently, only a single "Free" plan is offered, providing full access
 * to all features while the application is in beta.
 */
export const PricingData: TypePricingData = {
  // Both billing cycles point to the same single "Free" plan
  annual: {
    free: {
      title: "Free Beta",
      price: "₹0",
      subtitle: "Full access during Beta",
      features: [
        "AI-powered conversations",
        "Support for all document formats",
        "Unlimited uploads & queries",
        "Secure cloud storage",
        "Real-time collaboration",
        "Priority support",
      ],
    },
    // Personal and Pro plans can be added back later
    personal: {
        title: "Personal Plan",
        price: "₹2299/year",
        subtitle: "For individual power users",
        billingNote: "Billed annually",
        features: ["Feature A", "Feature B", "Feature C"],
    },
    pro: {
        title: "Pro Plan",
        price: "₹5999/year",
        subtitle: "For professionals & teams",
        billingNote: "Billed annually",
        features: ["Feature X", "Feature Y", "Feature Z"],
    },
  },
  lifetime: {
    free: {
      title: "Free Beta",
      price: "₹0",
      subtitle: "Full access during Beta",
      features: [
        "AI-powered conversations",
        "Support for all document formats",
        "Unlimited uploads & queries",
        "Secure cloud storage",
        "Real-time collaboration",
        "Priority support",
      ],
    },
     // Personal and Pro plans can be added back later
    personal: {
        title: "Personal Plan",
        price: "₹15,999",
        subtitle: "For individual power users",
        billingNote: "Billed once",
        features: ["Feature A", "Feature B", "Feature C"],
    },
    pro: {
        title: "Pro Plan",
        price: "₹35,999",
        subtitle: "For professionals & teams",
        billingNote: "Billed once",
        features: ["Feature X", "Feature Y", "Feature Z"],
    },
  },
};