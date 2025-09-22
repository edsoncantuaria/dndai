export type CanvasComponentType = 'Button' | 'Input' | 'Card';

export interface CanvasComponent {
  id: string;
  type: CanvasComponentType;
  props: {
    style: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
    text?: string;
  };
}
