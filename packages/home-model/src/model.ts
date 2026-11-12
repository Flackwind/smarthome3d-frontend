import type { EnergyConfiguration } from './energy';
import type { DashboardConfiguration } from './dashboard';
export const SCHEMA_VERSION = 1;
export const ROOM_PALETTE=['#b6d7ff','#c8e8a5','#f5df98','#b0e0d7','#efc4e8','#d3c2f5','#acdce9','#e4ddba'];
export interface Point2 { x: number; y: number }
export interface Vector3 { x: number; y: number; z: number }
export interface Vertex extends Point2 { id: string }
export interface MaterialConfiguration { color: string; roughness: number }
export interface WallOpening {
  id: string; type: 'door' | 'window'; offset: number; width: number; height: number; sill: number;
}
export interface Wall {
  id: string; startId: string; endId: string; thickness: number; height: number;
  material: MaterialConfiguration; openings: WallOpening[];
}
export interface Room {
  id: string; name: string; vertexIds: string[]; wallIds: string[];
  material: MaterialConfiguration;
}
export type FurnitureType = 'bulb' | 'floor-lamp' | 'ceiling-light' | 'led-strip' | 'radiator' | 'sensor' | 'vacuum' | 'outlet' | 'switch' | 'sofa' | 'table' | 'bed' | 'plant';
export interface FurnitureObject {
  id: string; name: string; type: FurnitureType; roomId?: string;
  position: Vector3; rotation: Vector3; scale: Vector3; dimensions: Vector3;
  material: MaterialConfiguration; assetId?: string;
}
export interface SmartDeviceBinding {
  id: string; objectId: string; provider: 'mock' | 'home-assistant'; entityId: string;
  relatedEntityIds: string[];
  positionCalibration?:RobotMapCalibration;
}
export interface RobotMapCalibration {
  sourceA:Point2;sourceB:Point2;homeA:Point2;homeB:Point2;flipY:boolean;
  mapEntityId?:string;mapState?:string;
}
export interface FloorplanReference {
  id: string; name: string; dataUrl: string; originalAssetId: string;
  width: number; height: number; metersPerPixel: number; rotation: number;
  origin: Point2; opacity: number; calibrated?: boolean;
}
export interface Floor {
  id: string; name: string; elevation: number; ceilingHeight: number;
  vertices: Vertex[]; walls: Wall[]; rooms: Room[]; objects: FurnitureObject[];
  floorplan?: FloorplanReference;
}
export interface Building { id: string; name: string; floors: Floor[] }
export interface SceneConfiguration {
  quality: 'low' | 'medium' | 'high'; theme: 'dark' | 'light'; showWalls: boolean;
  presentation?: 'model' | 'map';
  camera: { position: Vector3; target: Vector3 };
}
export interface HomeProject {
  energy?:EnergyConfiguration;
  dashboard?:DashboardConfiguration;
  schemaVersion: number; id: string; name: string; createdAt: string; updatedAt: string;
  building: Building; bindings: SmartDeviceBinding[]; scene: SceneConfiguration;
}
export const uid = (): string => crypto.randomUUID();
export const distance = (a: Point2, b: Point2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const material = (color = '#c7c9c2'): MaterialConfiguration => ({ color, roughness: 0.85 });
export const FURNITURE_CATALOG: { type: FurnitureType; name: string; icon: string; dimensions: Vector3; color: string }[] = [
  { type: 'bulb', name: 'Lampadina', icon: '◉', dimensions: { x: .18, y: .3, z: .18 }, color: '#f6d68a' },
  { type: 'floor-lamp', name: 'Lampada da terra', icon: '♧', dimensions: { x: .5, y: 1.65, z: .5 }, color: '#daceb7' },
  { type: 'ceiling-light', name: 'Plafoniera', icon: '◎', dimensions: { x: .65, y: .15, z: .65 }, color: '#e9e3d4' },
  { type: 'led-strip', name: 'Barra LED', icon: '━', dimensions: { x: 1.2, y: .06, z: .08 }, color: '#ffe0a5' },
  { type: 'radiator', name: 'Termosifone', icon: '▥', dimensions: { x: 1, y: .6, z: .15 }, color: '#e3ddd2' },
  { type: 'sensor', name: 'Sensore', icon: '◌', dimensions: { x: .15, y: .15, z: .08 }, color: '#9fc7b2' },
  { type: 'vacuum', name: 'Robot aspirapolvere', icon: '◉', dimensions: { x: .38, y: .12, z: .38 }, color: '#d6d7cf' },
  { type: 'outlet', name: 'Presa smart', icon: '⊙', dimensions: { x: .1, y: .15, z: .1 }, color: '#eeeee5' },
  { type: 'switch', name: 'Interruttore', icon: '▣', dimensions: { x: .1, y: .12, z: .05 }, color: '#eeeee5' },
  { type: 'sofa', name: 'Divano', icon: '▰', dimensions: { x: 2.2, y: .85, z: .95 }, color: '#799b8b' },
  { type: 'table', name: 'Tavolo', icon: '▱', dimensions: { x: 1.6, y: .76, z: .85 }, color: '#b29473' },
  { type: 'bed', name: 'Letto', icon: '▤', dimensions: { x: 1.7, y: .6, z: 2.1 }, color: '#c4b8a5' },
  { type: 'plant', name: 'Pianta', icon: '♧', dimensions: { x: .65, y: 1.1, z: .65 }, color: '#749781' }
];
