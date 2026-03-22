// Type declarations for deck.gl 8.x packages that lack bundled .d.ts files
declare module "@deck.gl/core" {
  export class AmbientLight {
    constructor(opts?: { color?: [number, number, number]; intensity?: number });
  }
  export class DirectionalLight {
    constructor(opts?: {
      color?: [number, number, number];
      intensity?: number;
      direction?: [number, number, number];
    });
  }
  export class LightingEffect {
    constructor(lights: Record<string, AmbientLight | DirectionalLight>);
  }

  export interface MapViewState {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
    minZoom?: number;
    maxZoom?: number;
    minPitch?: number;
    maxPitch?: number;
    transitionDuration?: number;
  }
  export class Layer<PropsT = Record<string, unknown>> {
    constructor(props: PropsT);
  }
  export class CompositeLayer<PropsT = Record<string, unknown>> extends Layer<PropsT> {}
}

declare module "@deck.gl/react" {
  import type { MapViewState } from "@deck.gl/core";
  import { ComponentType, CSSProperties } from "react";

  interface DeckGLProps {
    viewState?: MapViewState;
    initialViewState?: MapViewState;
    controller?: boolean | Record<string, unknown>;
    layers?: unknown[];
    onViewStateChange?: (params: { viewState: MapViewState }) => void;
    getTooltip?: (info: { object?: unknown; x: number; y: number }) => string | null | { text: string };
    style?: CSSProperties;
    children?: React.ReactNode;
    effects?: unknown[];
    width?: string | number;
    height?: string | number;
  }

  const DeckGL: ComponentType<DeckGLProps>;
  export default DeckGL;
}

declare module "@deck.gl/layers" {
  export class PolygonLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class ScatterplotLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class TextLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class LineLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class IconLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class GeoJsonLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class ArcLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class PathLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
}

declare module "@deck.gl/aggregation-layers" {
  export class HeatmapLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class ScreenGridLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class HexagonLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class ContourLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
}

declare module "@deck.gl/geo-layers" {
  export class TripsLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class TileLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
  export class MVTLayer<DataT = unknown> {
    constructor(props: Record<string, unknown>);
  }
}
