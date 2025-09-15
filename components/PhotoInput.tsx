'use client';

import { useState, useRef, useEffect } from 'react';
import CameraCapture from './CameraCapture';
import FileUpload from './FileUpload';

interface PhotoInputProps {
  value?: string;
  onChange: (photoUrl: string) => void;
  label?: string;
  description?: string;
  previewHeight?: string;
  cameraOnly?: boolean; // when true, only show camera capture option
}

export default function PhotoInput({
  value,
  onChange,
  label = "Photo",
  description = "Take a clear photo or upload an image",
  previewHeight = "h-32",
  cameraOnly = false,
}: PhotoInputProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check camera support on mount
  useEffect(() => {
    const checkCameraSupport = () => {
      if (typeof window === 'undefined' || !navigator) {
        setCameraSupported(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraSupported(false);
        return;
      }

      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraSupported(false);
        return;
      }

      setCameraSupported(true);
    };

    checkCameraSupport();
  }, []);

  const handleCameraCapture = (photoUrl: string) => {
    setPreviewUrl(photoUrl);
    onChange(photoUrl);
  };

  const handleFileSelect = (file: File, previewUrl: string) => {
    setPreviewUrl(previewUrl);
    onChange(previewUrl);
    setShowFileUpload(false);
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    onChange('');
  };

  const handleUrlInput = (url: string) => {
    setPreviewUrl(url);
    onChange(url);
  };

  return (
    <div className="space-y-3">
      <div className="font-medium text-gray-900">{label}</div>

      {/* Current Photo Preview */}
      {previewUrl && (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Preview"
            className={`w-full ${previewHeight} object-cover rounded-lg border`}
          />
          <button
            onClick={handleRemovePhoto}
            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 transition-colors"
            title="Remove photo"
          >
            ×
          </button>
        </div>
      )}

      {/* Photo Options */}
  {!previewUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cameraSupported !== false && (
            <button
              onClick={() => setShowCamera(true)}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Take Photo</span>
              <span className="text-xs text-gray-500">Use camera</span>
            </button>
          )}
          {!cameraOnly && (
            <>
              <button
                onClick={() => setShowFileUpload(true)}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Upload File</span>
                <span className="text-xs text-gray-500">From device</span>
              </button>

              <div className="flex flex-col p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 mb-2">Paste URL</span>
                <input
                  type="url"
                  placeholder="https://..."
                  onChange={(e) => handleUrlInput(e.target.value)}
                  className="text-xs border rounded px-2 py-1 w-full"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Description */}
      <p className="text-xs text-gray-500">
        {description}
        {cameraSupported === false && (
          <span className="block mt-1 text-orange-600">
            Camera not available - use file upload or URL instead
          </span>
        )}
      </p>

      {/* Camera Modal */}
      {showCamera && cameraSupported !== false && (
        <CameraCapture
          onPhotoCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          title="Take Inventory Photo"
        />
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Upload Photo</h3>
              <button
                onClick={() => setShowFileUpload(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <FileUpload
                onFileSelect={handleFileSelect}
                accept="image/*"
                maxSizeMB={10}
                title="Select Photo"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
