"use client";

import React, { useEffect, useState } from "react";
import { Upload } from "lucide-react";

interface UploadModalProgressProps {
  fileName?: string;
}

const SIMULATED_DURATION_MS = 8000;
const STEPS = 30;

const UploadModalProgress: React.FC<UploadModalProgressProps> = ({
  fileName,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const intervalMs = SIMULATED_DURATION_MS / STEPS;
    const increment = 90 / STEPS;
    let current = 0;

    const id = setInterval(() => {
      current = Math.min(current + increment, 90);
      setProgress(Math.round(current));
      if (current >= 90) clearInterval(id);
    }, intervalMs);

    return () => clearInterval(id);
  }, []);

  const circumference = 2 * Math.PI * 28;
  const strokeOffset = circumference * (1 - progress / 100);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="relative w-20 h-20">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="h-8 w-8 text-primary" />
        </div>
        <svg
          className="absolute inset-0 w-20 h-20 -rotate-90"
          viewBox="0 0 64 64"
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            className="text-muted/40"
            strokeWidth="3"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            className="text-primary transition-all duration-500"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="text-center space-y-1 w-full">
        <p className="text-sm font-medium text-foreground">
          Uploading your file...
        </p>
        {fileName && (
          <p className="text-xs text-muted-foreground truncate px-8">
            {fileName}
          </p>
        )}
      </div>

      <div className="w-full space-y-2">
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress}% uploaded</span>
          <span>Please wait...</span>
        </div>
      </div>
    </div>
  );
};

export default UploadModalProgress;
