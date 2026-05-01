import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onResult, facingMode = 'environment', className }) => {
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    const scannerId = 'qr-reader';
    html5QrCodeRef.current = new Html5Qrcode(scannerId);

    const config = { 
      fps: 30, 
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    };

    const startScanner = async () => {
      try {
        await html5QrCodeRef.current.start(
          { facingMode: facingMode },
          config,
          (decodedText) => {
            onResult(decodedText);
          },
          (errorMessage) => {
            // Quietly ignore errors unless needed
          }
        );
      } catch (err) {
        console.error('Failed to start scanner:', err);
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((err) => console.error('Error stopping scanner:', err));
      }
    };
  }, [onResult, facingMode]);

  return (
    <div id="qr-reader" className={className} style={{ width: '100%', height: '100%' }} />
  );
};

export default QRScanner;
