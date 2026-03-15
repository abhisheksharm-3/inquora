"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { RiAlertLine, RiRefreshLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    className?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Reusable error boundary component for catching and displaying errors.
 * Provides a fallback UI and retry functionality.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className={`flex flex-col items-center justify-center p-8 ${this.props.className || ""}`}>
                    <RiAlertLine className="h-12 w-12 text-destructive mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
                    <p className="text-muted-foreground text-center mb-4">
                        {this.state.error?.message || "An unexpected error occurred"}
                    </p>
                    <Button onClick={this.handleRetry} variant="outline" className="gap-2">
                        <RiRefreshLine className="h-4 w-4" />
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

interface ErrorBoundaryWrapperProps {
    children: ReactNode;
    name?: string;
    fallback?: ReactNode;
    className?: string;
}

/**
 * HOC wrapper for easier error boundary usage with function components.
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    options?: { name?: string; fallback?: ReactNode }
) {
    const displayName = options?.name || WrappedComponent.displayName || WrappedComponent.name || "Component";

    const WithErrorBoundary = (props: P) => (
        <ErrorBoundary fallback={options?.fallback}>
            <WrappedComponent {...props} />
        </ErrorBoundary>
    );

    WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
    return WithErrorBoundary;
}

/**
 * Simple error boundary wrapper component for JSX usage.
 */
export function SafeComponent({ children, name, fallback, className }: ErrorBoundaryWrapperProps) {
    return (
        <ErrorBoundary
            fallback={fallback}
            className={className}
            onError={(error) => {
                console.error(`Error in ${name || "Component"}:`, error);
            }}
        >
            {children}
        </ErrorBoundary>
    );
}
