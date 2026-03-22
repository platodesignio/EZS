/**
 * Recharts 2.x type overrides for React 19 compatibility.
 * Recharts uses class components whose `shouldComponentUpdate` signature
 * changed in React 19's stricter type definitions. This module declaration
 * replaces all chart component types with plain `ComponentType`, which is
 * fully compatible.
 */
declare module "recharts" {
  import { ComponentType, ReactNode, CSSProperties } from "react";

  type AnyProps = {
    children?: ReactNode;
    [key: string]: unknown;
  };

  interface ContainerProps extends AnyProps {
    width?: number | string;
    height?: number | string;
    aspect?: number;
    minWidth?: number;
    minHeight?: number;
  }

  interface ChartProps extends ContainerProps {
    data?: Record<string, unknown>[];
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    cx?: number | string;
    cy?: number | string;
    startAngle?: number;
    endAngle?: number;
    layout?: "horizontal" | "vertical";
    onClick?: (data: unknown, index: number) => void;
    onMouseEnter?: (data: unknown, index: number) => void;
    onMouseLeave?: () => void;
  }

  export const ResponsiveContainer: ComponentType<ContainerProps>;
  export const BarChart: ComponentType<ChartProps>;
  export const RadarChart: ComponentType<ChartProps>;
  export const LineChart: ComponentType<ChartProps>;
  export const AreaChart: ComponentType<ChartProps>;
  export const PieChart: ComponentType<ChartProps>;
  export const ScatterChart: ComponentType<ChartProps>;
  export const ComposedChart: ComponentType<ChartProps>;

  export const Bar: ComponentType<AnyProps>;
  export const Line: ComponentType<AnyProps>;
  export const Area: ComponentType<AnyProps>;
  export const Pie: ComponentType<AnyProps>;
  export const Radar: ComponentType<AnyProps>;
  export const Scatter: ComponentType<AnyProps>;
  export const RadialBar: ComponentType<AnyProps>;

  export const XAxis: ComponentType<AnyProps>;
  export const YAxis: ComponentType<AnyProps>;
  export const ZAxis: ComponentType<AnyProps>;

  export const Tooltip: ComponentType<AnyProps>;
  export const Legend: ComponentType<AnyProps>;
  export const CartesianGrid: ComponentType<AnyProps>;
  export const PolarGrid: ComponentType<AnyProps>;
  export const PolarAngleAxis: ComponentType<AnyProps>;
  export const PolarRadiusAxis: ComponentType<AnyProps>;

  export const Cell: ComponentType<AnyProps>;
  export const LabelList: ComponentType<AnyProps>;
  export const ReferenceLine: ComponentType<AnyProps>;
  export const ReferenceArea: ComponentType<AnyProps>;
  export const Brush: ComponentType<AnyProps>;
  export const ErrorBar: ComponentType<AnyProps>;
}
