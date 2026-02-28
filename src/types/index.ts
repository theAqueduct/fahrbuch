// Trip-related types
export interface Location {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

export interface Address {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  formatted?: string;
}

export enum TripPurpose {
  UNTAGGED = 'untagged',
  BUSINESS = 'business',
  PRIVATE = 'private',
  COMMUTE = 'commute'
}

export enum TripStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  SYNCED = 'synced'
}

export interface Trip {
  id: string;
  startLocation: Location;
  endLocation?: Location;
  startAddress?: Address;
  endAddress?: Address;
  purpose: TripPurpose;
  status: TripStatus;
  distance?: number; // in meters
  duration?: number; // in milliseconds
  route: Location[];
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// Activity recognition types
export enum ActivityType {
  UNKNOWN = 'unknown',
  IN_VEHICLE = 'in_vehicle',
  ON_BICYCLE = 'on_bicycle',
  ON_FOOT = 'on_foot',
  RUNNING = 'running',
  STILL = 'still',
  WALKING = 'walking'
}

export interface ActivityEvent {
  type: ActivityType;
  confidence: number;
  timestamp: number;
}

// App state types
export interface AppSettings {
  homeAddress?: Address;
  workAddress?: Address;
  vehicleInfo?: {
    make?: string;
    model?: string;
    licensePlate?: string;
  };
  notificationsEnabled: boolean;
  backgroundLocationEnabled: boolean;
}