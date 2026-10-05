declare module "potrace" {
  /** The parts of potrace (npm) this app uses. The bundled callback receives only the error. */
  export class Potrace {
    setParameters(params: { threshold?: number; turdSize?: number; optCurve?: boolean; optTolerance?: number; alphaMax?: number; blackOnWhite?: boolean }): void;
    loadImage(image: Buffer | string, callback: (err: Error | null) => void): void;
    getPathTag(fillColor?: string, scale?: number): string;
    getSVG(): string;
  }
  const potrace: { Potrace: typeof Potrace };
  export default potrace;
}
