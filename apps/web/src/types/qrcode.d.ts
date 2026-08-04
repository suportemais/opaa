declare module 'qrcode' {
  export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  export type QRCodeToDataURLOptions = {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
  };

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
}

