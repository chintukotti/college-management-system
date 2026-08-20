// src/components/common/FileUpload.jsx

import React, { useRef, useState } from 'react';
import { Upload, File, X, CheckCircle } from 'lucide-react';

const FileUpload = ({ 
  onFileSelect, 
  accept = '.xlsx,.xls',
  label = 'Upload Excel File',
  description = 'Drag and drop or click to upload'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && isValidFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const isValidFile = (file) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    return validTypes.includes(file.type) || 
           file.name.endsWith('.xlsx') || 
           file.name.endsWith('.xls');
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileSelect(null);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Upload className={`w-12 h-12 mx-auto mb-4 ${
            isDragging ? 'text-blue-500' : 'text-gray-400'
          }`} />
          
          <p className="text-gray-600 font-medium">{description}</p>
          <p className="text-sm text-gray-400 mt-2">
            Supports: .xlsx, .xls files
          </p>
        </div>
      ) : (
        <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <File className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="p-1 hover:bg-red-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-red-500" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;