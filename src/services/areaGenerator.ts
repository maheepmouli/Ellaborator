/**
 * Area generation utilities for accessibility, catchment, and impact zones
 */

import type { MapSegment } from "./trafficApi";

export interface MapArea {
  id: string;
  coordinates: [number, number][]; // Polygon coordinates [lat, lon]
  value: number;
  properties?: {
    type?: string;
    radius?: number; // For circular areas
    coverage?: number; // Coverage percentage
  };
}

/**
 * Generate isochrone-style circular areas around points
 */
export function generateIsochrones(
  centerLat: number,
  centerLon: number,
  radii: number[], // Radii in kilometers
  value: number
): MapArea[] {
  return radii.map((radius, index) => {
    const points: [number, number][] = [];
    const numPoints = 64; // Smooth circle
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      // Convert km to degrees (approximate: 1km ≈ 0.009 degrees)
      const latOffset = (radius * Math.cos(angle)) * 0.009;
      const lonOffset = (radius * Math.sin(angle)) * 0.009 / Math.cos(centerLat * Math.PI / 180);
      
      points.push([centerLat + latOffset, centerLon + lonOffset]);
    }
    
    // Close the polygon
    points.push(points[0]);
    
    return {
      id: `isochrone-${radius}km-${index}`,
      coordinates: points,
      value: value * (1 - index * 0.2), // Decreasing value for outer rings
      properties: {
        type: "isochrone",
        radius,
        coverage: (1 - index * 0.2) * 100,
      },
    };
  });
}

/**
 * Generate grid-based areas (hexagonal or square)
 */
export function generateGridAreas(
  centerLat: number,
  centerLon: number,
  gridSize: number, // Number of cells per side
  cellSize: number, // Size of each cell in km
  baseValue: number
): MapArea[] {
  const areas: MapArea[] = [];
  const startLat = centerLat - (gridSize * cellSize * 0.009) / 2;
  const startLon = centerLon - (gridSize * cellSize * 0.009) / (2 * Math.cos(centerLat * Math.PI / 180));
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = startLat + (i * cellSize * 0.009);
      const lon = startLon + (j * cellSize * 0.009) / Math.cos(centerLat * Math.PI / 180);
      
      // Create square cell
      const cellSizeDeg = cellSize * 0.009;
      const lonSizeDeg = cellSizeDeg / Math.cos(lat * Math.PI / 180);
      
      const coordinates: [number, number][] = [
        [lat, lon],
        [lat + cellSizeDeg, lon],
        [lat + cellSizeDeg, lon + lonSizeDeg],
        [lat, lon + lonSizeDeg],
        [lat, lon], // Close polygon
      ];
      
      // Calculate distance from center for value gradient
      const distFromCenter = Math.sqrt(
        Math.pow((i - gridSize / 2) * cellSize, 2) + 
        Math.pow((j - gridSize / 2) * cellSize, 2)
      );
      const maxDist = (gridSize / 2) * cellSize;
      const normalizedValue = Math.max(0, baseValue * (1 - distFromCenter / maxDist));
      
      areas.push({
        id: `grid-${i}-${j}`,
        coordinates,
        value: normalizedValue,
        properties: {
          type: "grid",
          coverage: normalizedValue,
        },
      });
    }
  }
  
  return areas;
}

/**
 * Generate emission zones/heat map areas for CO2 visualization
 * Creates gradient zones showing emission intensity
 */
export function generateEmissionZones(
  centerLat: number,
  centerLon: number,
  baseValue: number,
  numZones: number = 5
): MapArea[] {
  const zones: MapArea[] = [];
  const zoneRadii = [0.05, 0.08, 0.12, 0.16, 0.20]; // km radii for concentric zones
  
  for (let i = 0; i < numZones && i < zoneRadii.length; i++) {
    const radius = zoneRadii[i];
    const points: [number, number][] = [];
    const numPoints = 64; // Smooth circle
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * 2 * Math.PI;
      // Convert km to degrees (approximate: 1km ≈ 0.009 degrees)
      const latOffset = (radius * Math.cos(angle)) * 0.009;
      const lonOffset = (radius * Math.sin(angle)) * 0.009 / Math.cos(centerLat * Math.PI / 180);
      
      points.push([centerLat + latOffset, centerLon + lonOffset]);
    }
    
    // Close the polygon
    points.push(points[0]);
    
    // Higher emission values closer to center (traffic-heavy areas)
    // Outer zones have lower emissions
    const emissionIntensity = baseValue * (1 - i * 0.15);
    
    zones.push({
      id: `emission-zone-${i}`,
      coordinates: points,
      value: Math.max(20, emissionIntensity), // Minimum 20% for visibility
      properties: {
        type: "emission",
        radius,
        coverage: (1 - i * 0.15) * 100,
      },
    });
  }
  
  return zones;
}

/**
 * Generate catchment areas from segments
 * Creates buffer zones around road segments
 */
export function generateCatchmentFromSegments(
  segments: MapSegment[],
  bufferDistance: number // Buffer distance in km
): MapArea[] {
  return segments.map((segment) => {
    // Create a buffer polygon around the segment
    const bufferPoints: [number, number][] = [];
    const bufferDeg = bufferDistance * 0.009;
    
    // For each point in the segment, create perpendicular buffer points
    for (let i = 0; i < segment.coordinates.length - 1; i++) {
      const [lat1, lon1] = segment.coordinates[i];
      const [lat2, lon2] = segment.coordinates[i + 1];
      
      // Calculate perpendicular direction
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      const length = Math.sqrt(dLat * dLat + dLon * dLon);
      
      if (length > 0) {
        // Perpendicular vector (swap and negate one component)
        const perpLat = -dLon / length * bufferDeg;
        const perpLon = dLat / length * bufferDeg / Math.cos(lat1 * Math.PI / 180);
        
        bufferPoints.push([lat1 + perpLat, lon1 + perpLon]);
      }
    }
    
    // Create reverse side
    const reversePoints: [number, number][] = [];
    for (let i = segment.coordinates.length - 1; i > 0; i--) {
      const [lat1, lon1] = segment.coordinates[i];
      const [lat2, lon2] = segment.coordinates[i - 1];
      
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      const length = Math.sqrt(dLat * dLat + dLon * dLon);
      
      if (length > 0) {
        const perpLat = -dLon / length * bufferDeg;
        const perpLon = dLat / length * bufferDeg / Math.cos(lat1 * Math.PI / 180);
        
        reversePoints.push([lat1 + perpLat, lon1 + perpLon]);
      }
    }
    
    // Combine to form closed polygon
    const coordinates = [...bufferPoints, ...reversePoints, bufferPoints[0]];
    
    return {
      id: `catchment-${segment.id}`,
      coordinates,
      value: segment.value,
      properties: {
        type: "catchment",
        radius: bufferDistance,
      },
    };
  });
}
