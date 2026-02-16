/**
 * API Configuration
 * Centralized configuration for external APIs
 */

// API Base URL configuration
// Configure VITE_API_BASE_URL in .env if the API is on a different domain
// Example: VITE_API_BASE_URL=https://data.gouv.fr/api/explore/v2.1/catalog/datasets
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  "/api/explore/v2.1/catalog/datasets"; // Relative path - adjust if needed

// Traffic API configuration
export const TRAFFIC_API_CONFIG = {
  baseUrl: API_BASE_URL,
  dataset: "traficissy",
  defaultLimit: 100,
  defaultTimezone: "Europe/Berlin",
} as const;

// Bicycle Counting API configuration
export const BICYCLE_COUNTING_API_CONFIG = {
  baseUrl: API_BASE_URL,
  dataset: "comptage-velo-donnees-compteurs-issy",
  defaultLimit: 200,
  defaultTimezone: "Europe/Berlin",
} as const;

// Cycling Infrastructure API configuration
export const CYCLING_INFRASTRUCTURE_API_CONFIG = {
  baseUrl: API_BASE_URL,
  dataset: "amenagements-cyclables-gpso",
  defaultLimit: 500,
  defaultTimezone: "Europe/Berlin",
} as const;

/**
 * Get the full API endpoint URL for traffic data
 */
export function getTrafficApiUrl(): string {
  return `${TRAFFIC_API_CONFIG.baseUrl}/${TRAFFIC_API_CONFIG.dataset}/records`;
}

/**
 * Get the full API endpoint URL for bicycle counting data
 */
export function getBicycleCountingApiUrl(): string {
  return `${BICYCLE_COUNTING_API_CONFIG.baseUrl}/${BICYCLE_COUNTING_API_CONFIG.dataset}/records`;
}

/**
 * Get the full API endpoint URL for cycling infrastructure data
 */
export function getCyclingInfrastructureApiUrl(): string {
  return `${CYCLING_INFRASTRUCTURE_API_CONFIG.baseUrl}/${CYCLING_INFRASTRUCTURE_API_CONFIG.dataset}/records`;
}
