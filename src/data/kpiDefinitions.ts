// ELABORATOR KPI Definitions
export interface KPIDefinition {
  id: string;
  ref: string;
  name: string;
  shortName: string;
  unit: string;
  icon: string;
  chartType: 'pie' | 'bar' | 'gauge' | 'stacked' | 'radar' | 'line';
  colorScheme: string[];
  description: string;
  question: string;
}

export const ELABORATOR_KPIS: KPIDefinition[] = [
  {
    id: "kpi1.2",
    ref: "KPI1.2",
    name: "Mobility Mode Share",
    shortName: "Mobility Mode Share",
    unit: "%",
    icon: "🚴",
    chartType: "stacked",
    colorScheme: ["#B0EDBA", "#96C2EF", "#657DF5", "#8578C3", "#2F1B6D"],
    description: "Tracks modal shift from cars to pedestrian, cycling, and public transport modes",
    question: "How has the share of sustainable transport modes changed?"
  },
  {
    id: "kpi2.1",
    ref: "KPI2.1",
    name: "Road User Safety",
    shortName: "Road User Safety",
    unit: "⭐",
    icon: "⭐",
    chartType: "radar",
    colorScheme: ["#657DF5", "#B0EDBA", "#96C2EF", "#8578C3"],
    description: "Star ratings for pedestrians, cyclists, motorcyclists, and vehicle occupants",
    question: "How safe are the streets for different road users?"
  },
  {
    id: "kpi3.1",
    ref: "KPI3.1",
    name: "Zero-Emission Facilities and Services",
    shortName: "Zero-Emission Facilities",
    unit: "units",
    icon: "🔋",
    chartType: "bar",
    colorScheme: ["#B0EDBA", "#96C2EF", "#657DF5"],
    description: "Count of EV charging, bike parking, and intermodal hub facilities",
    question: "How many zero-emission facilities have been deployed?"
  },
  {
    id: "kpi3.2",
    ref: "KPI3.2",
    name: "Climate and Environmental Impact",
    shortName: "Climate & Environmental",
    unit: "kg/day",
    icon: "🌱",
    chartType: "line",
    colorScheme: ["#2F1B6D", "#657DF5", "#B0EDBA"],
    description: "CO₂ emissions, pollutants, and noise levels measured against targets",
    question: "How much have emissions reduced since interventions?"
  },
  {
    id: "kpi4.1",
    ref: "KPI4.1",
    name: "User Satisfaction",
    shortName: "Satisfaction",
    unit: "%",
    icon: "😊",
    chartType: "gauge",
    colorScheme: ["#B0EDBA", "#96C2EF", "#657DF5"],
    description: "Survey-based ratings of physical accessibility, safety, and general satisfaction",
    question: "How satisfied are users with the mobility interventions?"
  },
  {
    id: "kpi4.2",
    ref: "KPI4.2",
    name: "Accessibility and Security",
    shortName: "Accessibility & Security",
    unit: "score",
    icon: "♿",
    chartType: "bar",
    colorScheme: ["#657DF5", "#8578C3", "#96C2EF"],
    description: "Accessibility features count, user diversity, and time spent at sites",
    question: "How accessible are public spaces for all users?"
  },
];

// Fake data for each city and KPI
export interface CityKPIData {
  city: string;
  lat: number;
  lon: number;
  population: string;
  kpiData: Record<string, KPIValue>;
}

export interface KPIValue {
  mainValue: number;
  unit: string;
  change: number; // percentage change
  status: 'before' | 'after' | 'ongoing';
  breakdown?: Record<string, number>;
  timeSeries?: { year: number; value: number }[];
  distribution?: number[];
}

export const CITY_DATA: CityKPIData[] = [
  {
    city: "Milan",
    lat: 45.4642,
    lon: 9.19,
    population: "1.4M",
    kpiData: {
      "kpi1.2": {
        mainValue: 42,
        unit: "%",
        change: 8,
        status: "after",
        breakdown: {
          "Pedestrian": 18,
          "Cycle": 12,
          "Public Transport": 35,
          "Private Car": 28,
          "PTW": 7,
        },
        distribution: [12, 15, 22, 28, 35, 42, 38, 32, 25, 18, 14, 10],
      },
      "kpi2.1": {
        mainValue: 3.8,
        unit: "⭐",
        change: 0.6,
        status: "after",
        breakdown: {
          "Pedestrian": 4.2,
          "Cyclist": 3.5,
          "Motorcyclist": 3.2,
          "Vehicle Occupant": 4.3,
        },
      },
      "kpi3.1": {
        mainValue: 847,
        unit: "units",
        change: 156,
        status: "after",
        breakdown: {
          "EV Charging": 245,
          "Bike Parking": 412,
          "Intermodal Hubs": 18,
          "Pedestrian Zones": 172,
        },
      },
      "kpi3.2": {
        mainValue: 17,
        unit: "% reduction",
        change: -17,
        status: "after",
        timeSeries: [
          { year: 2020, value: 100 },
          { year: 2021, value: 94 },
          { year: 2022, value: 88 },
          { year: 2023, value: 85 },
          { year: 2024, value: 83 },
        ],
        breakdown: {
          "CO₂ (kg/day)": 12500,
          "PM2.5 (µg/m³)": 18,
          "Noise (dB)": 62,
        },
      },
      "kpi4.1": {
        mainValue: 72,
        unit: "% satisfied",
        change: 12,
        status: "after",
        breakdown: {
          "Physical Accessibility": 68,
          "Safety & Security": 75,
          "General Satisfaction": 72,
        },
      },
      "kpi4.2": {
        mainValue: 156,
        unit: "features",
        change: 45,
        status: "after",
        breakdown: {
          "Ramps": 89,
          "Tactile Paving": 234,
          "Audio Signals": 67,
          "Rest Areas": 45,
        },
      },
    },
  },
  {
    city: "Trikala",
    lat: 39.5550,
    lon: 21.7687,
    population: "61K",
    kpiData: {
      "kpi1.2": {
        mainValue: 38,
        unit: "%",
        change: 9,
        status: "after",
        breakdown: {
          "Pedestrian": 16,
          "Cycle": 10,
          "Public Transport": 25,
          "Private Car": 42,
          "PTW": 7,
        },
        distribution: [10, 14, 20, 28, 35, 38, 36, 30, 24, 18, 14, 10],
      },
      "kpi2.1": {
        mainValue: 3.9,
        unit: "⭐",
        change: 0.7,
        status: "after",
        breakdown: {
          "Pedestrian": 4.2,
          "Cyclist": 3.6,
          "Motorcyclist": 3.4,
          "Vehicle Occupant": 4.4,
        },
      },
      "kpi3.1": {
        mainValue: 156,
        unit: "units",
        change: 48,
        status: "after",
        breakdown: {
          "EV Charging": 32,
          "Bike Parking": 78,
          "Intermodal Hubs": 4,
          "Pedestrian Zones": 42,
        },
      },
      "kpi3.2": {
        mainValue: 12,
        unit: "% reduction",
        change: -12,
        status: "after",
        timeSeries: [
          { year: 2020, value: 100 },
          { year: 2021, value: 96 },
          { year: 2022, value: 92 },
          { year: 2023, value: 90 },
          { year: 2024, value: 88 },
        ],
        breakdown: {
          "CO₂ (kg/day)": 2800,
          "PM2.5 (µg/m³)": 14,
          "Noise (dB)": 56,
        },
      },
      "kpi4.1": {
        mainValue: 74,
        unit: "% satisfied",
        change: 14,
        status: "after",
        breakdown: {
          "Physical Accessibility": 70,
          "Safety & Security": 78,
          "General Satisfaction": 74,
        },
      },
      "kpi4.2": {
        mainValue: 68,
        unit: "features",
        change: 22,
        status: "after",
        breakdown: {
          "Ramps": 38,
          "Tactile Paving": 95,
          "Audio Signals": 28,
          "Rest Areas": 18,
        },
      },
    },
  },
  {
    city: "Issy-les-Moulineaux",
    lat: 48.8247,
    lon: 2.2700,
    population: "69K",
    kpiData: {
      "kpi1.2": {
        mainValue: 45,
        unit: "%",
        change: 11,
        status: "after",
        breakdown: {
          "Pedestrian": 20,
          "Cycle": 12,
          "Public Transport": 35,
          "Private Car": 28,
          "PTW": 5,
        },
        distribution: [12, 16, 24, 32, 40, 45, 42, 36, 28, 22, 16, 12],
      },
      "kpi2.1": {
        mainValue: 4.3,
        unit: "⭐",
        change: 0.6,
        status: "after",
        breakdown: {
          "Pedestrian": 4.5,
          "Cyclist": 4.2,
          "Motorcyclist": 3.8,
          "Vehicle Occupant": 4.7,
        },
      },
      "kpi3.1": {
        mainValue: 312,
        unit: "units",
        change: 86,
        status: "after",
        breakdown: {
          "EV Charging": 95,
          "Bike Parking": 145,
          "Intermodal Hubs": 8,
          "Pedestrian Zones": 64,
        },
      },
      "kpi3.2": {
        mainValue: 20,
        unit: "% reduction",
        change: -20,
        status: "after",
        timeSeries: [
          { year: 2020, value: 100 },
          { year: 2021, value: 92 },
          { year: 2022, value: 86 },
          { year: 2023, value: 82 },
          { year: 2024, value: 80 },
        ],
        breakdown: {
          "CO₂ (kg/day)": 3200,
          "PM2.5 (µg/m³)": 13,
          "Noise (dB)": 54,
        },
      },
      "kpi4.1": {
        mainValue: 82,
        unit: "% satisfied",
        change: 16,
        status: "after",
        breakdown: {
          "Physical Accessibility": 78,
          "Safety & Security": 85,
          "General Satisfaction": 82,
        },
      },
      "kpi4.2": {
        mainValue: 124,
        unit: "features",
        change: 38,
        status: "after",
        breakdown: {
          "Ramps": 68,
          "Tactile Paving": 185,
          "Audio Signals": 52,
          "Rest Areas": 35,
        },
      },
    },
  },
  {
    city: "Zaragoza",
    lat: 41.6488,
    lon: -0.8891,
    population: "675K",
    kpiData: {
      "kpi1.2": {
        mainValue: 35,
        unit: "%",
        change: 6,
        status: "after",
        breakdown: {
          "Pedestrian": 15,
          "Cycle": 6,
          "Public Transport": 28,
          "Private Car": 45,
          "PTW": 6,
        },
        distribution: [8, 12, 18, 24, 30, 35, 32, 28, 22, 16, 12, 8],
      },
      "kpi2.1": {
        mainValue: 4.2,
        unit: "⭐",
        change: 0.5,
        status: "after",
        breakdown: {
          "Pedestrian": 4.4,
          "Cyclist": 4.0,
          "Motorcyclist": 3.8,
          "Vehicle Occupant": 4.6,
        },
      },
      "kpi3.1": {
        mainValue: 423,
        unit: "units",
        change: 89,
        status: "after",
        breakdown: {
          "EV Charging": 120,
          "Bike Parking": 215,
          "Intermodal Hubs": 8,
          "Pedestrian Zones": 80,
        },
      },
      "kpi3.2": {
        mainValue: 14,
        unit: "% reduction",
        change: -14,
        status: "after",
        timeSeries: [
          { year: 2020, value: 100 },
          { year: 2021, value: 96 },
          { year: 2022, value: 92 },
          { year: 2023, value: 88 },
          { year: 2024, value: 86 },
        ],
        breakdown: {
          "CO₂ (kg/day)": 8500,
          "PM2.5 (µg/m³)": 16,
          "Noise (dB)": 60,
        },
      },
      "kpi4.1": {
        mainValue: 68,
        unit: "% satisfied",
        change: 10,
        status: "after",
        breakdown: {
          "Physical Accessibility": 65,
          "Safety & Security": 72,
          "General Satisfaction": 68,
        },
      },
      "kpi4.2": {
        mainValue: 98,
        unit: "features",
        change: 28,
        status: "after",
        breakdown: {
          "Ramps": 54,
          "Tactile Paving": 145,
          "Audio Signals": 38,
          "Rest Areas": 28,
        },
      },
    },
  },
  {
    city: "Copenhagen",
    lat: 55.6761,
    lon: 12.5683,
    population: "640K",
    kpiData: {
      "kpi1.2": {
        mainValue: 62,
        unit: "%",
        change: 10,
        status: "after",
        breakdown: {
          "Pedestrian": 12,
          "Cycle": 35,
          "Public Transport": 32,
          "Private Car": 18,
          "PTW": 3,
        },
        distribution: [15, 22, 35, 48, 55, 62, 58, 50, 42, 32, 25, 18],
      },
      "kpi2.1": {
        mainValue: 4.5,
        unit: "⭐",
        change: 0.4,
        status: "after",
        breakdown: {
          "Pedestrian": 4.8,
          "Cyclist": 4.6,
          "Motorcyclist": 4.0,
          "Vehicle Occupant": 4.6,
        },
      },
      "kpi3.1": {
        mainValue: 1680,
        unit: "units",
        change: 420,
        status: "after",
        breakdown: {
          "EV Charging": 520,
          "Bike Parking": 890,
          "Intermodal Hubs": 32,
          "Pedestrian Zones": 238,
        },
      },
      "kpi3.2": {
        mainValue: 28,
        unit: "% reduction",
        change: -28,
        status: "after",
        timeSeries: [
          { year: 2020, value: 100 },
          { year: 2021, value: 88 },
          { year: 2022, value: 78 },
          { year: 2023, value: 74 },
          { year: 2024, value: 72 },
        ],
        breakdown: {
          "CO₂ (kg/day)": 6800,
          "PM2.5 (µg/m³)": 10,
          "Noise (dB)": 52,
        },
      },
      "kpi4.1": {
        mainValue: 85,
        unit: "% satisfied",
        change: 8,
        status: "after",
        breakdown: {
          "Physical Accessibility": 82,
          "Safety & Security": 88,
          "General Satisfaction": 85,
        },
      },
      "kpi4.2": {
        mainValue: 245,
        unit: "features",
        change: 78,
        status: "after",
        breakdown: {
          "Ramps": 145,
          "Tactile Paving": 380,
          "Audio Signals": 112,
          "Rest Areas": 85,
        },
      },
    },
  },
  {
    city: "Helsinki",
    lat: 60.1699,
    lon: 24.9384,
    population: "650K",
    kpiData: {
      "kpi1.2": {
        mainValue: 52,
        unit: "%",
        change: 7,
        status: "after",
        breakdown: {
          "Pedestrian": 18,
          "Cycle": 14,
          "Public Transport": 38,
          "Private Car": 26,
          "PTW": 4,
        },
        distribution: [12, 18, 28, 38, 48, 52, 48, 42, 35, 28, 20, 14],
      },
      "kpi2.1": {
        mainValue: 4.0,
        unit: "⭐",
        change: 0.5,
        status: "after",
        breakdown: {
          "Pedestrian": 4.3,
          "Cyclist": 4.0,
          "Motorcyclist": 3.5,
          "Vehicle Occupant": 4.2,
        },
      },
      "kpi3.1": {
        mainValue: 892,
        unit: "units",
        change: 215,
        status: "after",
        breakdown: {
          "EV Charging": 310,
          "Bike Parking": 425,
          "Intermodal Hubs": 15,
          "Pedestrian Zones": 142,
        },
      },
      "kpi3.2": {
        mainValue: 19,
        unit: "% reduction",
        change: -19,
        status: "after",
        timeSeries: [
          { year: 2020, value: 100 },
          { year: 2021, value: 94 },
          { year: 2022, value: 88 },
          { year: 2023, value: 83 },
          { year: 2024, value: 81 },
        ],
        breakdown: {
          "CO₂ (kg/day)": 7200,
          "PM2.5 (µg/m³)": 12,
          "Noise (dB)": 55,
        },
      },
      "kpi4.1": {
        mainValue: 78,
        unit: "% satisfied",
        change: 12,
        status: "after",
        breakdown: {
          "Physical Accessibility": 76,
          "Safety & Security": 80,
          "General Satisfaction": 78,
        },
      },
      "kpi4.2": {
        mainValue: 178,
        unit: "features",
        change: 52,
        status: "after",
        breakdown: {
          "Ramps": 98,
          "Tactile Paving": 265,
          "Audio Signals": 78,
          "Rest Areas": 52,
        },
      },
    },
  },
];

// Generate fake hexbin data points for map visualization
export function generateHexbinData(
  city: CityKPIData, 
  kpiId: string, 
  count: number = 200,
  realTrafficData?: Array<{ lat: number; lon: number; value: number; id: string }>
) {
  const kpi = city.kpiData[kpiId];
  if (!kpi) return [];
  
  // If real traffic data is provided, use it (for Issy-les-Moulineaux)
  if (realTrafficData && realTrafficData.length > 0) {
    return realTrafficData;
  }
  
  // Otherwise, generate synthetic data
  const baseValue = kpi.mainValue;
  const breakdownKeys = kpi.breakdown ? Object.keys(kpi.breakdown) : [];
  const points = [];
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.random() * 0.05; // ~5km spread
    const lat = city.lat + radius * Math.cos(angle);
    const lon = city.lon + radius * Math.sin(angle) * 1.5; // Adjust for lat/lon ratio
    
    // Generate value with variance around the city's KPI value
    const variance = (Math.random() - 0.5) * 40;
    const value = Math.max(0, Math.min(100, baseValue + variance));
    const infraCategory =
      kpiId === "kpi3.1" && breakdownKeys.length > 0
        ? breakdownKeys[i % breakdownKeys.length]
        : undefined;

    points.push({
      lat,
      lon,
      value,
      id: `${city.city}-${kpiId}-${i}`,
      ...(infraCategory ? { properties: { infraCategory } } : {}),
    });
  }
  
  return points;
}
