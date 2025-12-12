export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureResult {
  landmarks: Landmark[][];
  gestures: Array<{
    categories: Array<{
      score: number;
      categoryName: string;
    }>;
  }>;
  handednesses: Array<Array<{
    score: number;
    categoryName: string;
    displayName: string;
  }>>;
}

export type WorkerMessage = 
  | { type: 'init-success' }
  | { type: 'init-error', error: string }
  | { type: 'result', result: GestureResult, timestamp: number };
